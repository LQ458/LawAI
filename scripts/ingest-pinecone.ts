/**
 * Pinecone Ingestion Script
 *
 * Reads all legal case records from MongoDB, generates embeddings
 * via Pinecone Inference API, and upserts them into the Pinecone index.
 *
 * Usage:
 *   npx tsx scripts/ingest-pinecone.ts             # ingest (skip existing)
 *   npx tsx scripts/ingest-pinecone.ts --clear      # delete all then ingest
 *   npx tsx scripts/ingest-pinecone.ts --delete     # delete only (no ingest)
 */

import { Pinecone } from "@pinecone-database/pinecone";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const BATCH_SIZE = 50;
const EMBEDDING_MODEL = process.env.PINECONE_EMBEDDING_MODEL || "multilingual-e5-large";
const INDEX_NAME = "finalindex";
const NAMESPACE = "caselist";

const args = process.argv.slice(2);
const doDelete = args.includes("--delete") || args.includes("--clear");
const doIngest = !args.includes("--delete");

interface RecordDoc {
  _id: string;
  title: string;
  link: string;
  description: string;
  content: string;
  tags: string[];
  category: string;
}

async function getRecords(): Promise<RecordDoc[]> {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error("MONGODB_URL not set");

  await mongoose.connect(mongoUrl);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;
  const records = await db
    .collection("records")
    .find<RecordDoc>(
      {},
      {
        projection: {
          _id: 1,
          title: 1,
          link: 1,
          description: 1,
          content: 1,
          tags: 1,
          category: 1,
        },
      },
    )
    .toArray();

  console.log(`Found ${records.length} records in MongoDB`);
  return records;
}

function buildEmbeddingText(record: RecordDoc): string {
  const parts: string[] = [];
  if (record.title) parts.push(record.title);
  if (record.description) {
    const desc = record.description.slice(0, 500);
    parts.push(desc);
  }
  if (record.content) {
    const content = record.content.slice(0, 1000);
    parts.push(content);
  }
  return parts.join("\n");
}

async function clearNamespace(pc: Pinecone) {
  const host = process.env.HOST_ADD;
  if (!host) throw new Error("HOST_ADD not set");

  const index = pc.index(INDEX_NAME, host);
  const namespace = index.namespace(NAMESPACE);

  console.log(`Deleting all vectors from ${INDEX_NAME}/${NAMESPACE}...`);

  try {
    await namespace.deleteAll();
    console.log("  Cleared.");
  } catch (err) {
    console.warn("  Delete may have failed (namespace might be empty):", err);
  }
}

async function ingest() {
  console.log("=== Pinecone Data Ingestion ===\n");
  console.log(`Model: ${EMBEDDING_MODEL}`);
  console.log(`Index: ${INDEX_NAME}`);
  console.log(`Namespace: ${NAMESPACE}`);

  if (doDelete) {
    console.log(`Mode: delete old vectors${doIngest ? " then ingest" : " only"}\n`);
  } else {
    console.log("Mode: ingest (skip delete)\n");
  }

  const apiKey = process.env.PINECONE_API_KEY;
  const host = process.env.HOST_ADD;
  if (!apiKey) throw new Error("PINECONE_API_KEY not set");

  const pc = new Pinecone({ apiKey });

  if (doDelete) {
    await clearNamespace(pc);
    if (!doIngest) {
      console.log("Delete only mode — done.");
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  const records = await getRecords();
  if (records.length === 0) {
    console.log("No records found. Exiting.");
    process.exit(0);
  }

  const texts = records.map(buildEmbeddingText);
  console.log(`Generated embedding texts for ${texts.length} records`);

  console.log("Generating embeddings via Pinecone Inference...");
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }

  const index = pc.index(INDEX_NAME, host!);
  const namespace = index.namespace(NAMESPACE);

  let upsertedCount = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    console.log(
      `  Batch ${bi + 1}/${batches.length} (${batch.length} texts) — embedding...`,
    );

    const embeddings = await pc.inference.embed(EMBEDDING_MODEL, batch, {
      inputType: "passage",
    });

    const vectors = embeddings.data
      .map((e, i) => {
        if (e.vectorType !== "dense" || !e.values) return null;
        const record = records[bi * BATCH_SIZE + i];
        return {
          id: record._id.toString(),
          values: e.values,
          metadata: {
            title: record.title,
            link: record.link || "",
            description: record.description?.slice(0, 200) || "",
            tags: record.tags?.join(",") || "",
            category: record.category || "",
          },
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (vectors.length > 0) {
      await namespace.upsert(vectors);
      upsertedCount += vectors.length;
      console.log(`  Batch ${bi + 1}/${batches.length} — upserted ${vectors.length} vectors`);
      // Respect Pinecone free tier rate limit: 250K tokens/min
      if (bi < batches.length - 1) {
        await new Promise((r) => setTimeout(r, 8000));
      }
    }
  }

  console.log(`\nDone. Upserted ${upsertedCount} vectors into Pinecone.`);

  await mongoose.disconnect();
  process.exit(0);
}

ingest().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
