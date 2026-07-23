import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const MAX_BUFFER_BYTES = 40 * 1024 * 1024;
const MAX_HISTORY_BLOBS = 20_000;
const MAX_BLOB_BYTES = 2 * 1024 * 1024;
const scanGitHistory = !process.argv.includes("--working-tree-only");

function git(args, options = {}) {
  return spawnSync("git", args, {
    encoding: options.encoding || "utf8",
    maxBuffer: MAX_BUFFER_BYTES,
  });
}

const rules = [
  {
    name: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    name: "github-token",
    pattern: /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  },
  { name: "openai-style-key", pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { name: "pinecone-key", pattern: /\bpcsk_[A-Za-z0-9_-]{24,}\b/ },
  { name: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: "credentialed-mongodb-uri",
    pattern: /mongodb(?:\+srv)?:\/\/[^:@/\s]+:[^@/\s]+@/i,
  },
];

const sensitiveAssignment =
  /\b(?:AUTH0_CLIENT_SECRET|AUTH0_SECRET|AUTH0_FGA_CLIENT_SECRET|DEEPSEEK_API_KEY|PINECONE_API_KEY|MONGODB_URL)\s*=\s*([^\s#]+)/g;
const placeholder =
  /^(?:["']?(?:|placeholder|replace-me|example|test(?:[_-].*)?|ci(?:[_-].*)?|your[_-].*|<.*>|\.\.\.|\$\{.*\})["']?)$/i;

function isPlaceholderValue(value) {
  return (
    placeholder.test(value) ||
    /(?:placeholder|username:password|your[-_.]|example\.invalid|<[^>]+>)/i.test(
      value,
    )
  );
}

function scanText(path, text, scope, findings) {
  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (
      match &&
      !(
        rule.name === "credentialed-mongodb-uri" &&
        /username:password|<[^>]+>/i.test(match[0])
      )
    ) {
      findings.push({ path, rule: rule.name, scope });
    }
  }

  for (const match of text.matchAll(sensitiveAssignment)) {
    const value = match[1].replace(/[;,]$/, "").replace(/^["']|["']$/g, "");
    if (
      value &&
      !isPlaceholderValue(value) &&
      !value.includes("process.env") &&
      !value.startsWith("env.")
    ) {
      findings.push({ path, rule: "sensitive-env-assignment", scope });
      break;
    }
  }
}

function scanWorkingTree(findings) {
  const files = git([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ]);
  if (files.status !== 0) {
    throw new Error("Secret scan could not enumerate repository files.");
  }

  const paths = files.stdout.split("\0").filter(Boolean);
  for (const path of paths) {
    let content;
    try {
      content = readFileSync(path);
    } catch {
      continue;
    }
    if (content.length > MAX_BLOB_BYTES || content.includes(0)) {
      continue;
    }
    scanText(path, content.toString("utf8"), "working-tree", findings);
  }
  return paths.length;
}

function scanHistory(findings) {
  const commitsResult = git(["rev-list", "--all"]);
  if (commitsResult.status !== 0) {
    throw new Error("Secret scan could not enumerate git history.");
  }

  const blobs = new Map();
  for (const commit of commitsResult.stdout.split("\n").filter(Boolean)) {
    const tree = git(["ls-tree", "-r", "-z", commit]);
    if (tree.status !== 0) {
      throw new Error("Secret scan could not read a historical tree.");
    }
    for (const entry of tree.stdout.split("\0").filter(Boolean)) {
      const separator = entry.indexOf("\t");
      if (separator < 0) continue;
      const metadata = entry.slice(0, separator).split(" ");
      const path = entry.slice(separator + 1);
      const hash = metadata[2];
      if (metadata[1] === "blob" && hash && !blobs.has(hash)) {
        blobs.set(hash, path);
      }
    }
  }

  if (blobs.size > MAX_HISTORY_BLOBS) {
    throw new Error(
      `Secret scan history limit exceeded (${blobs.size} blobs).`,
    );
  }

  for (const [hash, path] of blobs) {
    const sizeResult = git(["cat-file", "-s", hash]);
    const size = Number(sizeResult.stdout.trim());
    if (
      sizeResult.status !== 0 ||
      !Number.isFinite(size) ||
      size > MAX_BLOB_BYTES
    ) {
      continue;
    }
    const blob = spawnSync("git", ["cat-file", "blob", hash], {
      encoding: "buffer",
      maxBuffer: MAX_BLOB_BYTES + 1,
    });
    if (blob.status !== 0 || blob.stdout.includes(0)) {
      continue;
    }
    scanText(path, blob.stdout.toString("utf8"), "history", findings);
  }

  return blobs.size;
}

const findings = [];
let workingTreeFiles = 0;
let historyBlobs = 0;
try {
  workingTreeFiles = scanWorkingTree(findings);
  historyBlobs = scanGitHistory ? scanHistory(findings) : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Secret scan failed.");
  process.exit(2);
}

const unique = Array.from(
  new Map(
    findings.map((finding) => [
      `${finding.scope}:${finding.path}:${finding.rule}`,
      finding,
    ]),
  ).values(),
);

if (unique.length > 0) {
  console.error(`Secret scan found ${unique.length} potential issue(s).`);
  for (const finding of unique) {
    console.error(`${finding.scope}:${finding.path}: ${finding.rule}`);
  }
  console.error(
    "Values are intentionally suppressed. Review and rotate any real credential.",
  );
  process.exit(1);
}

console.log(
  `Secret scan passed: workingTreeFiles=${workingTreeFiles}, historyBlobs=${historyBlobs}.`,
);
