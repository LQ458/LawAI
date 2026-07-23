/** @jest-environment node */

import { ObjectId } from "mongodb";
import {
  classifyMigrationRecord,
  type LegacyRecord,
} from "@/scripts/migrate-document-metadata";

function record(overrides: Partial<LegacyRecord>): LegacyRecord {
  return {
    _id: new ObjectId("507f1f77bcf86cd799439011"),
    ...overrides,
  };
}

describe("document metadata migration classification", () => {
  it("never promotes an explicitly restricted synthetic document", () => {
    const result = classifyMigrationRecord(
      record({
        documentId: "restricted-demo",
        visibility: "restricted",
        department: "hr",
        sensitivity: "confidential",
        fgaObjectId: "restricted-demo",
        source: "LawAI access-control demo",
        sourceKind: "synthetic",
        sourceUrl: "synthetic://lawai/access-control-demo/restricted-demo",
        version: "demo-v1",
      }),
    );

    expect(result.category).toBe("restrictedPreserved");
    expect(result.update.visibility).toBe("restricted");
    expect(result.update.fgaObjectId).toBe("restricted-demo");
  });

  it("keeps an unverified legacy CAIL-shaped record restricted", () => {
    const result = classifyMigrationRecord(
      record({
        date: "2018",
        link: "",
        tags: ["legacy"],
      }),
    );

    expect(result.category).toBe("cailCandidateRestricted");
    expect(result.update.visibility).toBe("restricted");
    expect(result.update.needsReview).toBe(true);
  });

  it("marks trusted CAIL provenance public", () => {
    const result = classifyMigrationRecord(
      record({
        source: "CAIL2018",
        sourceKind: "source-derived",
        version: "CAIL2018",
      }),
    );

    expect(result.category).toBe("cailPublic");
    expect(result.update.visibility).toBe("public");
  });

  it("keeps synthetic records without explicit visibility restricted", () => {
    const result = classifyMigrationRecord(
      record({
        sourceKind: "synthetic",
        sourceUrl: "synthetic://lawai/legacy-seed",
      }),
    );

    expect(result.category).toBe("syntheticCandidateRestricted");
    expect(result.update.visibility).toBe("restricted");
  });

  it("preserves explicitly public synthetic records as public", () => {
    const result = classifyMigrationRecord(
      record({
        visibility: "public",
        sourceKind: "synthetic",
        sourceUrl: "synthetic://lawai/seed",
      }),
    );

    expect(result.category).toBe("syntheticPublic");
    expect(result.update.visibility).toBe("public");
  });
});
