/**
 * CAIL2018 Dataset Ingestion (JSONL parser)
 *
 * Downloads CAIL2018 Chinese legal judgment dataset,
 * parses JSONL files, loads into MongoDB, then ingests into Pinecone.
 *
 * Usage:
 *   npx tsx scripts/ingest-cail.ts --limit=100000
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { execSync } from "child_process";
import { createInterface } from "readline";
import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const DATASET_URL = "https://cail.oss-cn-qingdao.aliyuncs.com/CAIL2018_ALL_DATA.zip";
const DATA_DIR = path.resolve(__dirname, "../data");
const ZIP_PATH = path.join(DATA_DIR, "CAIL2018_ALL_DATA.zip");
const EXTRACT_DIR = path.join(DATA_DIR, "CAIL2018");

const args = process.argv.slice(2);
const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0") || Infinity;
const clearMongo = args.includes("--clear-mongo");

function download(): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(ZIP_PATH)) {
      const stat = fs.statSync(ZIP_PATH);
      console.log(`Dataset already downloaded: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
      return resolve();
    }
    console.log(`Downloading CAIL2018 (984 MB)...`);
    const file = fs.createWriteStream(ZIP_PATH);
    https.get(DATASET_URL, (res) => {
      let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total % (50 * 1024 * 1024) < 100000) process.stdout.write(`\r  ${(total / 1024 / 1024).toFixed(0)} MB`);
      });
      res.pipe(file);
      file.on("finish", () => { console.log("\nDownload complete."); file.close(); resolve(); });
    }).on("error", reject);
  });
}

function extract(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const hasFiles = fs.existsSync(EXTRACT_DIR) &&
    fs.readdirSync(EXTRACT_DIR, { recursive: true }).some((f: unknown) => String(f).endsWith(".json"));

  if (hasFiles) {
    console.log("Already extracted.");
    return;
  }
  console.log("Extracting...");
  execSync(`unzip -o "${ZIP_PATH}" -d "${EXTRACT_DIR}"`, { stdio: "ignore" });
  console.log("Extracted.");
}

function findJsonFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonFiles(full));
    } else if (entry.name.endsWith(".json")) {
      results.push(full);
    }
  }
  return results;
}

async function loadFile(filePath: string, collection: any, total: number): Promise<number> {
  const fileStream = fs.createReadStream(filePath, "utf-8");
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let batch: any[] = [];
  let count = 0;

  for await (const line of rl) {
    if (total + count >= limit) break;
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const item = JSON.parse(trimmed);
      const fact = item.fact || "";
      const meta = item.meta || {};
      const accusation = Array.isArray(meta.accusation) ? meta.accusation.join(",") : "unknown";

      batch.push({
        title: accusation + "案",
        link: "",
        description: fact.slice(0, 200),
        content: fact,
        date: "2018",
        tags: Array.isArray(meta.accusation) ? meta.accusation : [],
        category: Array.isArray(meta.accusation) ? meta.accusation[0] : "criminal",
        views: Math.floor(Math.random() * 100),
        likes: Math.floor(Math.random() * 20),
        bookmarks: Math.floor(Math.random() * 10),
        interactionScore: 0,
        lastUpdateTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      count++;

      if (batch.length >= 1000) {
        await collection.insertMany(batch, { ordered: false }).catch(() => {});
        batch = [];
      }
    } catch {
      // skip malformed lines
    }
  }

  if (batch.length > 0) {
    await collection.insertMany(batch, { ordered: false }).catch(() => {});
  }

  rl.close();
  fileStream.destroy();
  return count;
}

async function main() {
  console.log("=== CAIL2018 Ingestion ===\n");
  if (limit < Infinity) console.log(`Limit: ${limit.toLocaleString()} records\n`);

  await download();
  extract();

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) throw new Error("MONGODB_URL not set");

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 60000, connectTimeoutMS: 60000 });
  console.log("Connected to MongoDB\n");

  const db = mongoose.connection.db!;
  const collection = db.collection("records");

  if (clearMongo) {
    await collection.deleteMany({});
    console.log("Cleared existing records.");
  }

  const jsonFiles = findJsonFiles(EXTRACT_DIR);
  console.log(`Found ${jsonFiles.length} JSON files:`);
  jsonFiles.forEach((f) => console.log(`  ${path.relative(EXTRACT_DIR, f)} (${(fs.statSync(f).size / 1024 / 1024).toFixed(0)} MB)`));

  let total = 0;
  const startTime = Date.now();

  for (const file of jsonFiles) {
    if (total >= limit) break;
    const rel = path.relative(EXTRACT_DIR, file);
    process.stdout.write(`Loading ${rel}...`);
    const count = await loadFile(file, collection, total);
    total += count;
    console.log(` ${count.toLocaleString()} docs (total: ${total.toLocaleString()})`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone. ${total.toLocaleString()} records in ${elapsed}s`);

  await mongoose.disconnect();

  // Now run Pinecone ingestion
  console.log("\n=== Pinecone Ingestion ===\n");
  execSync(`npx tsx scripts/ingest-pinecone.ts --clear`, {
    stdio: "inherit",
    cwd: path.resolve(__dirname, ".."),
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
