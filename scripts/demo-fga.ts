/**
 * Auth0 FGA Access Control Demo
 *
 * Demonstrates fine-grained authorization:
 *   Alice (HR Manager) → can see salary documents
 *   Bob (Engineer)      → access denied for salary documents
 *
 * Usage:
 *   npx tsx scripts/demo-fga.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fgaCheck, fgaWriteTuples } from "../lib/fga";
import { filterDocsByAccess } from "../lib/docAccess";
import { DEMO_USERS, DEMO_DOCUMENTS, DEMO_FGA_TUPLES } from "../lib/demoData";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

async function demoFgaDirect() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Auth0 FGA — Direct Check Demo         ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const hasFga = !!process.env.AUTH0_FGA_STORE_ID;
  console.log(`FGA Configured: ${hasFga ? "✅ YES" : "⚠️  NO — checks will return false"}`);

  if (!hasFga) {
    console.log("\n⚠️  Set AUTH0_FGA_STORE_ID in .env.local to enable real FGA checks.");
    console.log("   Without FGA, all sensitive documents are denied.\n");
  }

  // Test 1: Direct FGA check — Alice can view HR document
  console.log("─".repeat(50));
  console.log("Test 1: Direct FGA check (live Auth0 FGA)");
  console.log("─".repeat(50));

  let fgaWorking = false;
  const aliceHrCheck = await fgaCheck({
    user: "user:alice",
    relation: "viewer",
    object: "document:doc-salary-q4-2025",
  });
  fgaWorking = aliceHrCheck;
  console.log(`  user:alice can VIEW doc-salary-q4-2025 → ${aliceHrCheck ? "✅ ALLOWED" : "❌ DENIED"}${!hasFga ? " (no FGA store)" : ""}`);

  const bobHrCheck = await fgaCheck({
    user: "user:bob",
    relation: "viewer",
    object: "document:doc-salary-q4-2025",
  });
  console.log(`  user:bob   can VIEW doc-salary-q4-2025 → ${bobHrCheck ? "✅ ALLOWED" : "❌ DENIED"}${!hasFga ? " (no FGA store)" : ""}`);

  const anyonePublicCheck = await fgaCheck({
    user: "user:*",
    relation: "viewer",
    object: "document:doc-labor-law-basics",
  });
  console.log(`  user:*     can VIEW doc-labor-law-basics → ${anyonePublicCheck ? "✅ ALLOWED" : "❌ DENIED"}${!hasFga ? " (no FGA store)" : ""}`);

  if (!fgaWorking) {
    console.log("\n  ⚠️  FGA checks returning DENIED. This is expected if:");
    console.log("     - FGA credentials are invalid/expired");
    console.log("     - FGA tuples haven't been seeded yet");
    console.log("     Run: npx tsx scripts/seed-fga.ts");
    console.log("\n  ℹ️  The code structure is complete — see lib/fga.ts and lib/docAccess.ts");
    console.log("     With valid FGA credentials, the expected output would be:");
    console.log("       alice → ALLOWED (HR department member)");
    console.log("       bob   → DENIED  (engineering, no HR access)");
  }

  // Test 2: Filter documents by access
  console.log("\n" + "─".repeat(50));
  console.log("Test 2: Document-level access filtering");
  console.log("─".repeat(50));

  const demoDocs = DEMO_DOCUMENTS.map((d) => ({
    id: d.id,
    title: d.title,
    sensitivity: d.sensitivity,
    department: d.department,
  }));

  console.log("\n[Alice's View]");
  const aliceDocs = await filterDocsByAccess(demoDocs, "alice");
  aliceDocs.forEach((d) => console.log(`  ✅ ${d.title} [${d.department || "public"}]`));
  const aliceBlocked = demoDocs.filter(
    (d) => !aliceDocs.find((ad) => ad.id === d.id),
  );
  aliceBlocked.forEach((d) => console.log(`  ❌ ${d.title} [${d.department || "public"}] — blocked`));

  console.log("\n[Bob's View]");
  const bobDocs = await filterDocsByAccess(demoDocs, "bob");
  bobDocs.forEach((d) => console.log(`  ✅ ${d.title} [${d.department || "public"}]`));
  const bobBlocked = demoDocs.filter(
    (d) => !bobDocs.find((bd) => bd.id === d.id),
  );
  bobBlocked.forEach((d) => console.log(`  ❌ ${d.title} [${d.department || "public"}] — blocked`));

  // Summary
  console.log("\n" + "═".repeat(50));
  console.log("Summary");
  console.log("═".repeat(50));
  console.log(`  Alice (HR Manager): ${aliceDocs.length}/${demoDocs.length} documents visible`);
  console.log(`  Bob   (Engineer):   ${bobDocs.length}/${demoDocs.length} documents visible`);

  const fgaWorking = aliceDocs.length > bobDocs.length;
  console.log(`\n  FGA enforcing access control: ${fgaWorking ? "✅ YES" : "⚠️  Not enforced (no FGA store)"}`);
  console.log();
}

async function demoRagEndpoint() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   RAG Pipeline + FGA Demo               ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const query = "薪资调整";
  const users = [
    { id: "alice", label: "Alice (HR Manager)" },
    { id: "bob", label: "Bob (Engineer)" },
  ];

  for (const user of users) {
    console.log(`[${user.label}] Query: "${query}"`);
    try {
      const res = await fetch(
        `${BASE_URL}/api/rag-search?search=${encodeURIComponent(query)}&userId=${user.id}`,
      );
      const data = await res.json();

      if (data.accessDenied) {
        console.log("  Result: ❌ ACCESS DENIED");
        console.log(`  Message: ${data.data}`);
      } else {
        console.log(`  Result: ✅ ${data.cases?.length || 0} documents found`);
        (data.cases || []).slice(0, 3).forEach((c: { title: string }) => {
          console.log(`    - ${c.title}`);
        });
      }
    } catch (err) {
      console.log(`  Error: ${err}`);
    }
    console.log();
  }
}

async function main() {
  await demoFgaDirect();
  console.log("\n");
  await demoRagEndpoint();
}

main().catch(console.error);
