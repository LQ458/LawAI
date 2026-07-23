/**
 * Safely synchronize authoritative MongoDB records into Pinecone.
 *
 * Pinecone stores only vectors and access/provenance metadata. MongoDB remains
 * the source of truth for document text.
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as path from "path";
import {
  hasValidDocumentMetadata,
  type DocumentSourceKind,
  type DocumentVisibility,
} from "./lib/document-metadata";
import {
  assertDestructiveConfirmation,
  getIntegerArg,
  hasFlag,
  readCheckpoint,
  resolveCheckpointPath,
  safeFailureMessage,
  withRetry,
  writeCheckpoint,
} from "./lib/safe-cli";

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true });

const EMBEDDING_MODEL =
  process.env.PINECONE_EMBEDDING_MODEL || "multilingual-e5-large";
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "finalindex";
const NAMESPACE = process.env.PINECONE_NAMESPACE || "caselist";

interface RecordDoc {
  _id: ObjectId;
  documentId?: string;
  visibility?: DocumentVisibility;
  department?: string;
  sensitivity?: string;
  fgaObjectId?: string;
  source?: string;
  sourceKind?: DocumentSourceKind;
  sourceUrl?: string;
  version?: string;
  title?: string;
  description?: string;
  content?: string;
  category?: string;
}

interface IngestionCheckpoint {
  schemaVersion: 1;
  processed: number;
  lastMongoId?: string;
  destructiveCompleted?: boolean;
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/ingest-pinecone.ts [options]

Safe default: upsert metadata-valid MongoDB records without deleting vectors.

Options:
  --dry-run                    Validate and count only; no Pinecone writes
  --batch-size=N               Source batch size, 1-96 (default: 50)
  --resume-from=N              Skip N MongoDB records
  --checkpoint=PATH            Resume from/write a checkpoint
  --clear                      Delete namespace once, then ingest
  --delete                     Delete namespace only
  --confirm-destructive        Required with --clear/--delete
  --backup-acknowledged        Required with --clear/--delete
  --help                       Show this help
`);
}

function buildEmbeddingText(record: RecordDoc): string {
  return [
    record.title,
    record.description?.slice(0, 500),
    record.content?.slice(0, 1000),
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

async function clearNamespace(pc: Pinecone, host: string): Promise<void> {
  const namespace = pc.index(INDEX_NAME, host).namespace(NAMESPACE);
  await withRetry(() => namespace.deleteAll(), {
    onRetry: (attempt) =>
      console.warn(
        `Pinecone delete retry ${attempt}/3 (no document data logged).`,
      ),
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    printHelp();
    return;
  }

  const dryRun = hasFlag(args, "--dry-run");
  const clearRequested = hasFlag(args, "--clear");
  const deleteOnly = hasFlag(args, "--delete");
  const destructiveRequested = clearRequested || deleteOnly;
  assertDestructiveConfirmation(args, destructiveRequested);

  const batchSize = getIntegerArg(args, "--batch-size", 50, {
    min: 1,
    max: 96,
  });
  const explicitResume = args.some(
    (arg) => arg === "--resume-from" || arg.startsWith("--resume-from="),
  );
  const resumeFrom = getIntegerArg(args, "--resume-from", 0, { min: 0 });
  const explicitCheckpoint = args.some(
    (arg) => arg === "--checkpoint" || arg.startsWith("--checkpoint="),
  );
  const checkpointPath = resolveCheckpointPath(args, "ingest-pinecone.json");
  const checkpoint = explicitCheckpoint
    ? readCheckpoint<IngestionCheckpoint>(checkpointPath)
    : undefined;

  console.log("Pinecone synchronization");
  console.log(
    `Mode: ${dryRun ? "dry-run" : deleteOnly ? "delete-only" : "upsert"}`,
  );
  console.log("Authority: MongoDB");
  console.log(`Batch size: ${batchSize}`);

  if (deleteOnly && dryRun) {
    console.log(
      "Planned destructive operations: 1 namespace delete; writes: 0.",
    );
    return;
  }

  const apiKey = process.env.PINECONE_API_KEY;
  const host = process.env.HOST_ADD;
  let pc: Pinecone | undefined;

  if (!dryRun) {
    if (!apiKey) throw new Error("PINECONE_API_KEY is not configured");
    if (!host) throw new Error("HOST_ADD is not configured");
    pc = new Pinecone({ apiKey });
  }

  if (
    destructiveRequested &&
    !(checkpoint?.destructiveCompleted && !explicitResume)
  ) {
    if (!dryRun) {
      await clearNamespace(pc!, host!);
      writeCheckpoint<IngestionCheckpoint>(checkpointPath, {
        schemaVersion: 1,
        processed: 0,
        destructiveCompleted: true,
      });
      console.log("Confirmed namespace delete completed.");
    }
  }

  if (deleteOnly) return;

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error("MONGODB_URL is not configured");

  await mongoose.connect(mongoUrl);
  try {
    const collection = mongoose.connection.db!.collection<RecordDoc>("records");
    const useCheckpointCursor =
      !explicitResume &&
      checkpoint?.lastMongoId &&
      ObjectId.isValid(checkpoint.lastMongoId);
    const filter = useCheckpointCursor
      ? { _id: { $gt: new ObjectId(checkpoint!.lastMongoId) } }
      : {};
    const cursor = collection
      .find(filter, {
        projection: {
          _id: 1,
          documentId: 1,
          visibility: 1,
          department: 1,
          sensitivity: 1,
          fgaObjectId: 1,
          source: 1,
          sourceKind: 1,
          sourceUrl: 1,
          version: 1,
          title: 1,
          description: 1,
          content: 1,
          category: 1,
        },
      })
      .sort({ _id: 1 });

    if (!useCheckpointCursor) {
      const skip = explicitResume ? resumeFrom : checkpoint?.processed || 0;
      if (skip > 0) cursor.skip(skip);
    }

    const namespace =
      !dryRun && pc && host
        ? pc.index(INDEX_NAME, host).namespace(NAMESPACE)
        : undefined;
    let processed = explicitResume ? resumeFrom : checkpoint?.processed || 0;
    let valid = 0;
    let invalid = 0;
    let upserted = 0;

    while (await cursor.hasNext()) {
      const sourceBatch: RecordDoc[] = [];
      while (sourceBatch.length < batchSize && (await cursor.hasNext())) {
        const record = await cursor.next();
        if (record) sourceBatch.push(record);
      }
      if (sourceBatch.length === 0) break;

      const validBatch = sourceBatch.filter((record) => {
        const isValid =
          hasValidDocumentMetadata(record) &&
          buildEmbeddingText(record).trim().length > 0;
        if (isValid) valid++;
        else invalid++;
        return isValid;
      }) as Array<
        RecordDoc & {
          documentId: string;
          visibility: DocumentVisibility;
          source: string;
          sourceKind: DocumentSourceKind;
          sourceUrl: string;
          version: string;
        }
      >;

      if (!dryRun && validBatch.length > 0) {
        const texts = validBatch.map(buildEmbeddingText);
        const embeddings = await withRetry(
          () =>
            pc!.inference.embed(EMBEDDING_MODEL, texts, {
              inputType: "passage",
            }),
          {
            onRetry: (attempt) =>
              console.warn(
                `Embedding retry ${attempt}/3 (no document data logged).`,
              ),
          },
        );

        if (embeddings.data.length !== validBatch.length) {
          throw new Error("Embedding response count mismatch");
        }

        const vectors = embeddings.data.map((embedding, index) => {
          if (embedding.vectorType !== "dense" || !embedding.values) {
            throw new Error(
              "Embedding response did not contain a dense vector",
            );
          }
          const record = validBatch[index];
          return {
            id: record.documentId,
            values: embedding.values,
            metadata: {
              documentId: record.documentId,
              visibility: record.visibility,
              department: record.department || "",
              sensitivity: record.sensitivity || "",
              fgaObjectId: record.fgaObjectId || "",
              source: record.source,
              sourceKind: record.sourceKind,
              sourceUrl: record.sourceUrl,
              version: record.version,
              category: record.category || "",
            },
          };
        });

        await withRetry(() => namespace!.upsert(vectors), {
          onRetry: (attempt) =>
            console.warn(
              `Upsert retry ${attempt}/3 (no document data logged).`,
            ),
        });
        upserted += vectors.length;
      }

      processed += sourceBatch.length;
      if (!dryRun) {
        writeCheckpoint<IngestionCheckpoint>(checkpointPath, {
          schemaVersion: 1,
          processed,
          lastMongoId: sourceBatch[sourceBatch.length - 1]._id.toHexString(),
          destructiveCompleted:
            destructiveRequested || checkpoint?.destructiveCompleted || false,
        });
      }
      console.log(
        `Progress: processed=${processed}, valid=${valid}, invalid=${invalid}, upserted=${upserted}`,
      );
    }

    console.log(
      `Complete: processed=${processed}, valid=${valid}, invalid=${invalid}, upserted=${upserted}.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(safeFailureMessage("Pinecone synchronization", error));
  process.exitCode = 1;
});
