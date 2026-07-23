/**
 * CAIL2018 JSONL ingestion.
 *
 * New records are explicitly public, source-derived documents. MongoDB is the
 * authoritative store; optional Pinecone synchronization is a non-destructive
 * follow-up.
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { spawnSync } from "child_process";
import { createInterface } from "readline";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { createStableDocumentId } from "./lib/document-metadata";
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

const DATASET_URL =
  "https://cail.oss-cn-qingdao.aliyuncs.com/CAIL2018_ALL_DATA.zip";
const DATA_DIR = path.resolve(__dirname, "../data");
const ZIP_PATH = path.join(DATA_DIR, "CAIL2018_ALL_DATA.zip");
const EXTRACT_DIR = path.join(DATA_DIR, "CAIL2018");

interface CailCheckpoint {
  schemaVersion: 1;
  fileIndex: number;
  lineNumber: number;
  sourceProcessed: number;
  accepted: number;
  malformed: number;
  destructiveCompleted?: boolean;
}

interface LoadCounters {
  sourceProcessed: number;
  accepted: number;
  malformed: number;
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/ingest-cail.ts [options]

Options:
  --dry-run                    Plan only; no download, database, or vector writes
  --limit=N                    Maximum accepted records (0 means unlimited)
  --batch-size=N               MongoDB write batch size (default: 500)
  --resume-from=N              Skip N source lines
  --checkpoint=PATH            Resume from/write a checkpoint
  --clear-mongo                Delete all MongoDB records before ingestion
  --confirm-destructive        Required with --clear-mongo
  --backup-acknowledged        Required with --clear-mongo
  --pinecone                   Run safe Pinecone upsert after MongoDB completes
  --help                       Show this help
`);
}

function downloadToFile(url: string, redirectsRemaining = 3): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(ZIP_PATH)) {
      resolve();
      return;
    }

    const temporaryPath = `${ZIP_PATH}.part`;
    const request = https.get(url, (response) => {
      const location = response.headers.location;
      if (
        location &&
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400
      ) {
        response.resume();
        if (redirectsRemaining <= 0) {
          reject(new Error("Too many dataset redirects"));
          return;
        }
        const redirected = new URL(location, url).toString();
        downloadToFile(redirected, redirectsRemaining - 1)
          .then(resolve)
          .catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error("Dataset download returned a non-success status"));
        return;
      }

      const file = fs.createWriteStream(temporaryPath);
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        fs.renameSync(temporaryPath, ZIP_PATH);
        resolve();
      });
      file.on("error", reject);
    });
    request.on("error", reject);
  });
}

function extract(): void {
  const hasFiles =
    fs.existsSync(EXTRACT_DIR) &&
    fs
      .readdirSync(EXTRACT_DIR, { recursive: true })
      .some((entry: unknown) => String(entry).endsWith(".json"));
  if (hasFiles) return;

  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  const result = spawnSync("unzip", ["-n", ZIP_PATH, "-d", EXTRACT_DIR], {
    stdio: "ignore",
  });
  if (result.status !== 0) throw new Error("Dataset extraction failed");
}

function findJsonFiles(directory: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...findJsonFiles(fullPath));
    else if (entry.name.endsWith(".json")) results.push(fullPath);
  }
  return results.sort();
}

function buildCailDocument(
  item: Record<string, unknown>,
  relativeFile: string,
  lineNumber: number,
): Record<string, unknown> {
  const fact = typeof item.fact === "string" ? item.fact : "";
  const meta =
    item.meta && typeof item.meta === "object"
      ? (item.meta as Record<string, unknown>)
      : {};
  const accusations = Array.isArray(meta.accusation)
    ? meta.accusation.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const documentId = createStableDocumentId(
    "cail2018",
    `${relativeFile}:${lineNumber}`,
  );

  return {
    documentId,
    visibility: "public",
    sensitivity: "public",
    source: "CAIL2018",
    sourceKind: "source-derived",
    sourceUrl: DATASET_URL,
    version: "CAIL2018",
    needsReview: false,
    syntheticMetric: false,
    title: `${accusations.join(",") || "未分类"}案`,
    link: DATASET_URL,
    description: fact.slice(0, 200),
    content: fact,
    date: "2018",
    tags: accusations,
    category: accusations[0] || "criminal",
    views: 0,
    likes: 0,
    bookmarks: 0,
    interactionScore: 0,
    lastUpdateTime: new Date(),
    updatedAt: new Date(),
  };
}

async function loadFile(options: {
  filePath: string;
  relativeFile: string;
  fileIndex: number;
  collection: ReturnType<typeof mongoose.connection.collection>;
  batchSize: number;
  limit: number;
  startLine: number;
  skipRemaining: { value: number };
  counters: LoadCounters;
  checkpointPath: string;
  destructiveCompleted: boolean;
}): Promise<number> {
  const stream = fs.createReadStream(options.filePath, "utf8");
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  const operations: Array<Record<string, unknown>> = [];
  let currentLine = 0;

  const flush = async (): Promise<void> => {
    if (operations.length === 0) return;
    const pending = operations.splice(0);
    await withRetry(
      () =>
        options.collection.bulkWrite(
          pending.map((document) => ({
            updateOne: {
              filter: { documentId: document.documentId },
              update: {
                $set: document,
                $setOnInsert: { createdAt: new Date() },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        ),
      {
        onRetry: (attempt) =>
          console.warn(
            `MongoDB batch retry ${attempt}/3; record data omitted.`,
          ),
      },
    );
    writeCheckpoint<CailCheckpoint>(options.checkpointPath, {
      schemaVersion: 1,
      fileIndex: options.fileIndex,
      lineNumber: currentLine,
      sourceProcessed: options.counters.sourceProcessed,
      accepted: options.counters.accepted,
      malformed: options.counters.malformed,
      destructiveCompleted: options.destructiveCompleted,
    });
  };

  try {
    for await (const line of reader) {
      if (options.counters.accepted >= options.limit) break;
      currentLine++;
      if (currentLine <= options.startLine) continue;
      options.counters.sourceProcessed++;

      if (options.skipRemaining.value > 0) {
        options.skipRemaining.value--;
        continue;
      }
      const trimmed = line.trim();
      if (!trimmed) {
        options.counters.malformed++;
        continue;
      }
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== "object") {
          options.counters.malformed++;
          continue;
        }
        if (
          typeof (parsed as Record<string, unknown>).fact !== "string" ||
          ((parsed as Record<string, unknown>).fact as string).trim().length ===
            0
        ) {
          options.counters.malformed++;
          continue;
        }
        operations.push(
          buildCailDocument(
            parsed as Record<string, unknown>,
            options.relativeFile,
            currentLine,
          ),
        );
        options.counters.accepted++;
      } catch {
        options.counters.malformed++;
      }

      if (operations.length >= options.batchSize) await flush();
    }
    await flush();
    return currentLine;
  } finally {
    reader.close();
    stream.destroy();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    printHelp();
    return;
  }

  const dryRun = hasFlag(args, "--dry-run");
  const clearMongo = hasFlag(args, "--clear-mongo");
  assertDestructiveConfirmation(args, clearMongo);
  const batchSize = getIntegerArg(args, "--batch-size", 500, {
    min: 1,
    max: 5000,
  });
  const requestedLimit = getIntegerArg(args, "--limit", 0, { min: 0 });
  const limit =
    requestedLimit === 0 ? Number.POSITIVE_INFINITY : requestedLimit;
  const explicitResume = args.some(
    (arg) => arg === "--resume-from" || arg.startsWith("--resume-from="),
  );
  const resumeFrom = getIntegerArg(args, "--resume-from", 0, { min: 0 });
  const explicitCheckpoint = args.some(
    (arg) => arg === "--checkpoint" || arg.startsWith("--checkpoint="),
  );
  const checkpointPath = resolveCheckpointPath(args, "ingest-cail.json");
  const checkpoint = explicitCheckpoint
    ? readCheckpoint<CailCheckpoint>(checkpointPath)
    : undefined;

  console.log("CAIL2018 ingestion");
  console.log(`Mode: ${dryRun ? "dry-run" : "MongoDB upsert"}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Limit: ${requestedLimit === 0 ? "unlimited" : requestedLimit}`);

  if (dryRun) {
    const localState = fs.existsSync(EXTRACT_DIR)
      ? "local extracted data available"
      : fs.existsSync(ZIP_PATH)
        ? "local archive available"
        : "download required";
    console.log(
      `Plan: ${localState}; external writes=0; document text output=0.`,
    );
    console.log(
      `Classification: public/source-derived/CAIL2018; synthetic metrics=0.`,
    );
    return;
  }

  await withRetry(() => downloadToFile(DATASET_URL), {
    attempts: 3,
    baseDelayMs: 1000,
    onRetry: (attempt) => console.warn(`Dataset download retry ${attempt}/3.`),
  });
  extract();
  const files = findJsonFiles(EXTRACT_DIR);
  console.log(`Source files: ${files.length}`);

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error("MONGODB_URL is not configured");
  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 60_000,
    connectTimeoutMS: 60_000,
  });

  try {
    const collection = mongoose.connection.collection("records");
    const destructiveAlreadyCompleted =
      Boolean(checkpoint?.destructiveCompleted) && !explicitResume;
    if (clearMongo && !destructiveAlreadyCompleted) {
      await withRetry(() => collection.deleteMany({}));
      writeCheckpoint<CailCheckpoint>(checkpointPath, {
        schemaVersion: 1,
        fileIndex: 0,
        lineNumber: 0,
        sourceProcessed: 0,
        accepted: 0,
        malformed: 0,
        destructiveCompleted: true,
      });
      console.log("Confirmed MongoDB clear completed.");
    }

    const counters: LoadCounters = {
      sourceProcessed: explicitResume ? 0 : checkpoint?.sourceProcessed || 0,
      accepted: explicitResume ? 0 : checkpoint?.accepted || 0,
      malformed: explicitResume ? 0 : checkpoint?.malformed || 0,
    };
    const skipRemaining = {
      value: explicitResume ? resumeFrom : 0,
    };
    const firstFile = explicitResume ? 0 : checkpoint?.fileIndex || 0;

    for (let fileIndex = firstFile; fileIndex < files.length; fileIndex++) {
      if (counters.accepted >= limit) break;
      const filePath = files[fileIndex];
      const startLine =
        !explicitResume && fileIndex === checkpoint?.fileIndex
          ? checkpoint.lineNumber
          : 0;
      const finalLine = await loadFile({
        filePath,
        relativeFile: path.relative(EXTRACT_DIR, filePath),
        fileIndex,
        collection,
        batchSize,
        limit,
        startLine,
        skipRemaining,
        counters,
        checkpointPath,
        destructiveCompleted:
          clearMongo || checkpoint?.destructiveCompleted || false,
      });
      writeCheckpoint<CailCheckpoint>(checkpointPath, {
        schemaVersion: 1,
        fileIndex: fileIndex + 1,
        lineNumber: 0,
        sourceProcessed: counters.sourceProcessed,
        accepted: counters.accepted,
        malformed: counters.malformed,
        destructiveCompleted:
          clearMongo || checkpoint?.destructiveCompleted || false,
      });
      console.log(
        `Progress: files=${fileIndex + 1}/${files.length}, sourceLines=${counters.sourceProcessed}, accepted=${counters.accepted}, malformed=${counters.malformed}, lastFileLines=${finalLine}`,
      );
    }

    console.log(
      `Complete: accepted=${counters.accepted}, malformed=${counters.malformed}.`,
    );
  } finally {
    await mongoose.disconnect();
  }

  if (hasFlag(args, "--pinecone")) {
    const child = spawnSync(
      "npx",
      [
        "tsx",
        "scripts/ingest-pinecone.ts",
        `--batch-size=${Math.min(batchSize, 96)}`,
      ],
      {
        cwd: path.resolve(__dirname, ".."),
        stdio: "inherit",
      },
    );
    if (child.status !== 0) {
      throw new Error("Pinecone follow-up failed");
    }
  }
}

main().catch((error) => {
  console.error(safeFailureMessage("CAIL2018 ingestion", error));
  process.exitCode = 1;
});
