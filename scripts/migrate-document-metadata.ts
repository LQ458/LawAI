/**
 * Backfill document authorization and provenance metadata.
 *
 * Default mode is read-only dry-run. This script never mutates Pinecone and
 * never prints document text, titles, identifiers, or sensitive metadata.
 */

import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as path from "path";
import { createStableDocumentId } from "./lib/document-metadata";
import {
  getIntegerArg,
  hasFlag,
  readCheckpoint,
  resolveCheckpointPath,
  safeFailureMessage,
  withRetry,
  writeCheckpoint,
} from "./lib/safe-cli";

const CAIL_DATASET_URL =
  "https://cail.oss-cn-qingdao.aliyuncs.com/CAIL2018_ALL_DATA.zip";

export type MigrationCategory =
  | "cailPublic"
  | "syntheticPublic"
  | "recognizedSource"
  | "restrictedPreserved"
  | "cailCandidateRestricted"
  | "syntheticCandidateRestricted"
  | "explicitPublicNeedsReview"
  | "restrictedNeedsReview";

type CategoryCounts = Record<MigrationCategory, number> & {
  total: number;
  duplicateDocumentIdRepaired: number;
};

export interface LegacyRecord {
  _id: ObjectId;
  documentId?: unknown;
  visibility?: unknown;
  department?: unknown;
  sensitivity?: unknown;
  fgaObjectId?: unknown;
  source?: unknown;
  sourceKind?: unknown;
  sourceUrl?: unknown;
  version?: unknown;
  needsReview?: unknown;
  syntheticMetric?: unknown;
  title?: unknown;
  link?: unknown;
  date?: unknown;
  tags?: unknown;
  category?: unknown;
}

interface MigrationCheckpoint {
  schemaVersion: 2;
  processed: number;
  lastMongoId?: string;
  counts: CategoryCounts;
}

export interface ClassifiedUpdate {
  category: MigrationCategory;
  documentIdWasDuplicate: boolean;
  update: Record<string, unknown>;
}

function emptyCounts(): CategoryCounts {
  return {
    cailPublic: 0,
    syntheticPublic: 0,
    recognizedSource: 0,
    restrictedPreserved: 0,
    cailCandidateRestricted: 0,
    syntheticCandidateRestricted: 0,
    explicitPublicNeedsReview: 0,
    restrictedNeedsReview: 0,
    total: 0,
    duplicateDocumentIdRepaired: 0,
  };
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/migrate-document-metadata.ts [options]

Safe default: dry-run. No writes occur unless --apply is present.

Options:
  --apply                      Apply MongoDB metadata updates
  --dry-run                    Explicit read-only mode (default)
  --batch-size=N               Read/write batch size (default: 250)
  --resume-from=N              Skip N records
  --checkpoint=PATH            Resume from/write a checkpoint
  --help                       Show this help

This script never deletes MongoDB or Pinecone data.
`);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTrustedCail(record: LegacyRecord): boolean {
  return (
    record.source === "CAIL2018" ||
    record.version === "CAIL2018" ||
    record.sourceUrl === CAIL_DATASET_URL
  );
}

function isLegacyCailCandidate(record: LegacyRecord): boolean {
  return (
    !nonEmpty(record.source) &&
    record.date === "2018" &&
    record.link === "" &&
    Array.isArray(record.tags)
  );
}

function isRecognizedSynthetic(record: LegacyRecord): boolean {
  if (record.sourceKind === "synthetic") return true;
  if (
    nonEmpty(record.sourceUrl) &&
    record.sourceUrl.startsWith("synthetic://")
  ) {
    return true;
  }
  if (
    nonEmpty(record.link) &&
    record.link.startsWith("https://example.com/case/")
  ) {
    return true;
  }
  if (nonEmpty(record.title) && record.title.startsWith("[合成示例]")) {
    return true;
  }
  return Array.isArray(record.tags) && record.tags.includes("合成示例");
}

function hasRecognizedSource(record: LegacyRecord): boolean {
  return (
    nonEmpty(record.source) &&
    record.sourceKind === "source-derived" &&
    nonEmpty(record.sourceUrl) &&
    nonEmpty(record.version)
  );
}

function rawFgaObjectId(value: unknown, fallback: string): string {
  if (!nonEmpty(value)) return fallback;
  const raw = value.startsWith("document:")
    ? value.slice("document:".length)
    : value;
  return raw || fallback;
}

function restrictedUpdate(
  record: LegacyRecord,
  documentId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const recognizedSynthetic = isRecognizedSynthetic(record);
  return {
    documentId,
    visibility: "restricted",
    department: nonEmpty(record.department) ? record.department : "unassigned",
    sensitivity: nonEmpty(record.sensitivity)
      ? record.sensitivity
      : "restricted",
    fgaObjectId: rawFgaObjectId(record.fgaObjectId, documentId),
    source: nonEmpty(record.source) ? record.source : "unknown",
    sourceKind: recognizedSynthetic ? "synthetic" : "source-derived",
    sourceUrl: nonEmpty(record.sourceUrl)
      ? record.sourceUrl
      : "unavailable://legacy-record",
    version: nonEmpty(record.version)
      ? record.version
      : "legacy-unclassified-v1",
    needsReview: true,
    syntheticMetric: recognizedSynthetic,
    ...overrides,
  };
}

export function classifyMigrationRecord(
  record: LegacyRecord,
  duplicateDocumentIds: Set<string> = new Set(),
): ClassifiedUpdate {
  const existingDocumentId = nonEmpty(record.documentId)
    ? record.documentId
    : undefined;
  const documentIdWasDuplicate = Boolean(
    existingDocumentId && duplicateDocumentIds.has(existingDocumentId),
  );
  const documentId =
    existingDocumentId && !documentIdWasDuplicate
      ? existingDocumentId
      : createStableDocumentId("legacy-record", record._id.toHexString());

  if (record.visibility === "restricted") {
    const metadataComplete =
      nonEmpty(record.department) &&
      nonEmpty(record.sensitivity) &&
      nonEmpty(record.fgaObjectId) &&
      !record.fgaObjectId.startsWith("document:") &&
      nonEmpty(record.source) &&
      (record.sourceKind === "source-derived" ||
        record.sourceKind === "synthetic") &&
      nonEmpty(record.sourceUrl) &&
      nonEmpty(record.version);
    return {
      category: "restrictedPreserved",
      documentIdWasDuplicate,
      update: restrictedUpdate(record, documentId, {
        needsReview: !metadataComplete,
      }),
    };
  }

  if (isTrustedCail(record)) {
    return {
      category: "cailPublic",
      documentIdWasDuplicate,
      update: {
        documentId,
        visibility: "public",
        sensitivity: "public",
        source: "CAIL2018",
        sourceKind: "source-derived",
        sourceUrl: CAIL_DATASET_URL,
        version: "CAIL2018",
        needsReview: false,
        syntheticMetric: false,
        views: 0,
        likes: 0,
        bookmarks: 0,
        interactionScore: 0,
      },
    };
  }

  if (record.visibility === "public" && isRecognizedSynthetic(record)) {
    return {
      category: "syntheticPublic",
      documentIdWasDuplicate,
      update: {
        documentId,
        visibility: "public",
        sensitivity: "public",
        source: nonEmpty(record.source)
          ? record.source
          : "LawAI legacy synthetic dataset",
        sourceKind: "synthetic",
        sourceUrl: nonEmpty(record.sourceUrl)
          ? record.sourceUrl
          : "synthetic://lawai/legacy-seed",
        version: nonEmpty(record.version)
          ? record.version
          : "legacy-synthetic-v1",
        needsReview: false,
        syntheticMetric: true,
      },
    };
  }

  if (hasRecognizedSource(record)) {
    const restricted = record.visibility !== "public";
    const restrictedMetadataComplete =
      record.visibility === "restricted" &&
      nonEmpty(record.department) &&
      nonEmpty(record.sensitivity) &&
      nonEmpty(record.fgaObjectId) &&
      !record.fgaObjectId.startsWith("document:");
    return {
      category: "recognizedSource",
      documentIdWasDuplicate,
      update: {
        documentId,
        visibility: restricted ? "restricted" : "public",
        ...(restricted
          ? {
              department: nonEmpty(record.department)
                ? record.department
                : "unassigned",
              sensitivity: nonEmpty(record.sensitivity)
                ? record.sensitivity
                : "restricted",
              fgaObjectId: rawFgaObjectId(record.fgaObjectId, documentId),
            }
          : {
              sensitivity: nonEmpty(record.sensitivity)
                ? record.sensitivity
                : "public",
            }),
        source: record.source,
        sourceKind: "source-derived",
        sourceUrl: record.sourceUrl,
        version: record.version,
        needsReview: restricted && !restrictedMetadataComplete,
        syntheticMetric: false,
      },
    };
  }

  if (record.visibility === "public") {
    return {
      category: "explicitPublicNeedsReview",
      documentIdWasDuplicate,
      update: {
        documentId,
        visibility: "public",
        sensitivity: "public",
        source: nonEmpty(record.source) ? record.source : "unknown",
        sourceKind:
          record.sourceKind === "synthetic" ? "synthetic" : "source-derived",
        sourceUrl: nonEmpty(record.sourceUrl)
          ? record.sourceUrl
          : "unavailable://legacy-record",
        version: nonEmpty(record.version)
          ? record.version
          : "legacy-unclassified-v1",
        needsReview: true,
        syntheticMetric: record.sourceKind === "synthetic",
      },
    };
  }

  if (isLegacyCailCandidate(record)) {
    return {
      category: "cailCandidateRestricted",
      documentIdWasDuplicate,
      update: restrictedUpdate(record, documentId),
    };
  }

  if (isRecognizedSynthetic(record)) {
    return {
      category: "syntheticCandidateRestricted",
      documentIdWasDuplicate,
      update: restrictedUpdate(record, documentId),
    };
  }

  return {
    category: "restrictedNeedsReview",
    documentIdWasDuplicate,
    update: restrictedUpdate(record, documentId),
  };
}

async function main(): Promise<void> {
  dotenv.config({
    path: path.resolve(__dirname, "../.env.local"),
    quiet: true,
  });
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    printHelp();
    return;
  }

  const apply = hasFlag(args, "--apply");
  if (apply && hasFlag(args, "--dry-run")) {
    throw new Error("--apply and --dry-run are mutually exclusive");
  }
  const batchSize = getIntegerArg(args, "--batch-size", 250, {
    min: 1,
    max: 5000,
  });
  const explicitResume = args.some(
    (arg) => arg === "--resume-from" || arg.startsWith("--resume-from="),
  );
  const resumeFrom = getIntegerArg(args, "--resume-from", 0, { min: 0 });
  const explicitCheckpoint = args.some(
    (arg) => arg === "--checkpoint" || arg.startsWith("--checkpoint="),
  );
  const checkpointPath = resolveCheckpointPath(
    args,
    "migrate-document-metadata.json",
  );
  const checkpoint = explicitCheckpoint
    ? readCheckpoint<MigrationCheckpoint>(checkpointPath)
    : undefined;
  if (checkpoint && checkpoint.schemaVersion !== 2) {
    throw new Error(
      "Checkpoint schema is outdated; use a new checkpoint for this migration version",
    );
  }

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error("MONGODB_URL is not configured");
  await mongoose.connect(mongoUrl);

  try {
    const collection =
      mongoose.connection.db!.collection<LegacyRecord>("records");
    const duplicateRows = await collection
      .aggregate<{ _id: string }>([
        {
          $match: {
            documentId: { $type: "string", $regex: /\S/ },
          },
        },
        { $group: { _id: "$documentId", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $project: { _id: 1 } },
      ])
      .toArray();
    const duplicateDocumentIds = new Set(duplicateRows.map((row) => row._id));

    const useCheckpointCursor =
      !explicitResume &&
      checkpoint?.lastMongoId &&
      ObjectId.isValid(checkpoint.lastMongoId);
    const cursor = collection
      .find(
        useCheckpointCursor
          ? { _id: { $gt: new ObjectId(checkpoint!.lastMongoId) } }
          : {},
        {
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
            needsReview: 1,
            syntheticMetric: 1,
            title: 1,
            link: 1,
            date: 1,
            tags: 1,
            category: 1,
          },
        },
      )
      .sort({ _id: 1 });
    if (!useCheckpointCursor) {
      const skip = explicitResume ? resumeFrom : checkpoint?.processed || 0;
      if (skip > 0) cursor.skip(skip);
    }

    let processed = explicitResume ? resumeFrom : checkpoint?.processed || 0;
    const counts =
      !explicitResume && checkpoint?.counts
        ? { ...checkpoint.counts }
        : emptyCounts();

    while (await cursor.hasNext()) {
      const sourceBatch: LegacyRecord[] = [];
      while (sourceBatch.length < batchSize && (await cursor.hasNext())) {
        const record = await cursor.next();
        if (record) sourceBatch.push(record);
      }
      if (sourceBatch.length === 0) break;

      const classified = sourceBatch.map((record) =>
        classifyMigrationRecord(record, duplicateDocumentIds),
      );
      for (const item of classified) {
        counts[item.category]++;
        counts.total++;
        if (item.documentIdWasDuplicate) {
          counts.duplicateDocumentIdRepaired++;
        }
      }

      if (apply) {
        await withRetry(
          () =>
            collection.bulkWrite(
              sourceBatch.map((record, index) => ({
                updateOne: {
                  filter: { _id: record._id },
                  update: { $set: classified[index].update },
                },
              })),
              { ordered: false },
            ),
          {
            onRetry: () => {
              // Deliberately silent: migration output is aggregate counts only.
            },
          },
        );
      }

      processed += sourceBatch.length;
      if (apply) {
        writeCheckpoint<MigrationCheckpoint>(checkpointPath, {
          schemaVersion: 2,
          processed,
          lastMongoId: sourceBatch[sourceBatch.length - 1]._id.toHexString(),
          counts,
        });
      }
    }

    console.log(JSON.stringify(counts));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error(safeFailureMessage("Document metadata migration", error));
    process.exitCode = 1;
  });
}
