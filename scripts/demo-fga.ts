/**
 * Auth0 FGA Access Control Demo
 *
 * Demonstrates fine-grained authorization:
 *   mapped HR manager subject → can see salary documents
 *   mapped employee subject   → access denied for salary documents
 *
 * Usage:
 *   npx tsx scripts/demo-fga.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { toFgaUserObject } from "../lib/fgaIdentity";
import { DEMO_DOCUMENTS, type DemoAuth0Subjects } from "../lib/demoData";
import { isScriptFgaConfigured, scriptFgaCheck } from "./lib/fga-client";
import { CliUsageError, hasFlag, safeFailureMessage } from "./lib/safe-cli";

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), quiet: true });

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

interface DemoDocument {
  id: string;
  documentId: string;
  title: string;
  visibility: "public" | "restricted";
  department: string;
  sensitivity: string;
  fgaObjectId: string;
  source: string;
  sourceKind: "synthetic";
}

async function filterDemoDocuments(
  documents: readonly DemoDocument[],
  subject: string,
): Promise<DemoDocument[]> {
  const user = toFgaUserObject(subject);
  const decisions = await Promise.all(
    documents.map(async (document) => {
      if (document.visibility === "public") return document;
      if (
        !document.documentId ||
        !document.department ||
        !document.sensitivity ||
        !document.fgaObjectId
      ) {
        return null;
      }
      return (await scriptFgaCheck({
        user,
        relation: "viewer",
        object: `document:${document.fgaObjectId}`,
      }))
        ? document
        : null;
    }),
  );
  return decisions.filter(
    (document): document is DemoDocument => document !== null,
  );
}

function printHelp(): void {
  console.log(`Usage: npx tsx scripts/demo-fga.ts [options]

Options:
  --dry-run                    Show aggregate demo plan; make no external calls
  --help                       Show this help

Set DEMO_AUTH_COOKIE to an existing session cookie only when testing the RAG
endpoint as that current server session. The script never accepts a user ID.

Live FGA checks require DEMO_MANAGER_AUTH0_SUBJECT and
DEMO_EMPLOYEE_AUTH0_SUBJECT. Subject values are never printed.
`);
}

function liveSubjects(): DemoAuth0Subjects {
  const managerSubject = process.env.DEMO_MANAGER_AUTH0_SUBJECT;
  const employeeSubject = process.env.DEMO_EMPLOYEE_AUTH0_SUBJECT;
  if (!managerSubject || !employeeSubject) {
    throw new CliUsageError(
      "Live FGA demo refused: set DEMO_MANAGER_AUTH0_SUBJECT and DEMO_EMPLOYEE_AUTH0_SUBJECT to server-verified Auth0 subject values.",
    );
  }
  return {
    managerSubject,
    employeeSubject,
    legalFinanceSubject: process.env.DEMO_LEGAL_FINANCE_AUTH0_SUBJECT,
  };
}

async function demoFgaDirect(subjects: DemoAuth0Subjects) {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Auth0 FGA — Direct Check Demo         ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const hasFga = isScriptFgaConfigured();
  console.log(
    `FGA Configured: ${hasFga ? "✅ YES" : "⚠️  NO — checks will return false"}`,
  );

  if (!hasFga) {
    console.log(
      "\n⚠️  Set AUTH0_FGA_STORE_ID in .env.local to enable real FGA checks.",
    );
    console.log("   Without FGA, all sensitive documents are denied.\n");
  }

  // Test 1: Direct FGA check — mapped manager can view HR document
  console.log("─".repeat(50));
  console.log("Test 1: Direct FGA check (live Auth0 FGA)");
  console.log("─".repeat(50));

  let fgaWorking = false;
  const managerHrCheck = await scriptFgaCheck({
    user: toFgaUserObject(subjects.managerSubject),
    relation: "viewer",
    object: "document:doc-salary-q4-2025",
  });
  fgaWorking = managerHrCheck;
  console.log(
    `  mapped manager subject can VIEW salary document → ${managerHrCheck ? "✅ ALLOWED" : "❌ DENIED"}${!hasFga ? " (no FGA store)" : ""}`,
  );

  const employeeHrCheck = await scriptFgaCheck({
    user: toFgaUserObject(subjects.employeeSubject),
    relation: "viewer",
    object: "document:doc-salary-q4-2025",
  });
  console.log(
    `  mapped employee subject can VIEW salary document → ${employeeHrCheck ? "✅ ALLOWED" : "❌ DENIED"}${!hasFga ? " (no FGA store)" : ""}`,
  );

  if (!fgaWorking) {
    console.log("\n  ⚠️  FGA checks returning DENIED. This is expected if:");
    console.log("     - FGA credentials are invalid/expired");
    console.log("     - FGA tuples haven't been seeded yet");
    console.log("     Run: npx tsx scripts/seed-fga.ts");
    console.log(
      "\n  ℹ️  The code structure is complete — see lib/fga.ts and lib/docAccess.ts",
    );
    console.log(
      "     With valid FGA credentials, the expected output would be:",
    );
    console.log("       mapped manager → ALLOWED (HR department member)");
    console.log("       mapped employee → DENIED (engineering, no HR access)");
  }

  // Test 2: Filter documents by access
  console.log("\n" + "─".repeat(50));
  console.log("Test 2: Document-level access filtering");
  console.log("─".repeat(50));

  const demoDocs = DEMO_DOCUMENTS.map((d) => ({
    id: d.id,
    documentId: d.documentId,
    title: d.title,
    visibility: d.visibility,
    sensitivity: d.sensitivity,
    department: d.department,
    fgaObjectId: d.fgaObjectId,
    source: d.source,
    sourceKind: d.sourceKind,
  }));

  console.log("\n[Mapped HR manager view]");
  const managerDocs = await filterDemoDocuments(
    demoDocs,
    subjects.managerSubject,
  );
  managerDocs.forEach((d) =>
    console.log(`  ✅ ${d.title} [${d.department || "public"}]`),
  );
  const managerBlocked = demoDocs.filter(
    (d) => !managerDocs.find((allowed) => allowed.id === d.id),
  );
  managerBlocked.forEach((d) =>
    console.log(`  ❌ ${d.title} [${d.department || "public"}] — blocked`),
  );

  console.log("\n[Mapped employee view]");
  const employeeDocs = await filterDemoDocuments(
    demoDocs,
    subjects.employeeSubject,
  );
  employeeDocs.forEach((d) =>
    console.log(`  ✅ ${d.title} [${d.department || "public"}]`),
  );
  const employeeBlocked = demoDocs.filter(
    (d) => !employeeDocs.find((allowed) => allowed.id === d.id),
  );
  employeeBlocked.forEach((d) =>
    console.log(`  ❌ ${d.title} [${d.department || "public"}] — blocked`),
  );

  // Summary
  console.log("\n" + "═".repeat(50));
  console.log("Summary");
  console.log("═".repeat(50));
  console.log(
    `  Mapped HR manager: ${managerDocs.length}/${demoDocs.length} documents visible`,
  );
  console.log(
    `  Mapped employee: ${employeeDocs.length}/${demoDocs.length} documents visible`,
  );

  const accessDifferentiated = managerDocs.length > employeeDocs.length;
  console.log(
    `\n  FGA enforcing access control: ${accessDifferentiated ? "✅ YES" : "⚠️  Not enforced (no FGA store)"}`,
  );
  console.log();
}

async function demoRagEndpoint() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   RAG Pipeline + FGA Demo               ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const query = "薪资调整";
  const sessionCookie = process.env.DEMO_AUTH_COOKIE;
  console.log(
    `POST query (identity: ${sessionCookie ? "current DEMO_AUTH_COOKIE server session" : "anonymous/public-only"})`,
  );
  try {
    const response = await fetch(`${BASE_URL}/api/rag-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    if (!response.ok || data.accessDenied) {
      console.log("  Result: ❌ ACCESS DENIED or unauthenticated");
    } else {
      console.log(`  Result: ✅ ${data.cases?.length || 0} documents found`);
    }
  } catch {
    console.log("  Error: request failed; response data omitted");
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help")) {
    printHelp();
    return;
  }
  if (hasFlag(args, "--dry-run")) {
    const publicCount = DEMO_DOCUMENTS.filter(
      (document) => document.visibility === "public",
    ).length;
    console.log(
      `Synthetic FGA demo dry-run: documents=${DEMO_DOCUMENTS.length}, public=${publicCount}, restricted=${DEMO_DOCUMENTS.length - publicCount}, external calls=0.`,
    );
    return;
  }

  const subjects = liveSubjects();
  await demoFgaDirect(subjects);
  console.log("\n");
  await demoRagEndpoint();
}

main().catch((error) => {
  console.error(safeFailureMessage("Synthetic FGA demo", error));
  process.exitCode = 1;
});
