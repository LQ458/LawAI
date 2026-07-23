import { createHash } from "crypto";

export type DocumentVisibility = "public" | "restricted";
export type DocumentSourceKind = "source-derived" | "synthetic";

export interface DocumentMetadata {
  documentId: string;
  visibility: DocumentVisibility;
  department?: string;
  sensitivity?: string;
  fgaObjectId?: string;
  source: string;
  sourceKind: DocumentSourceKind;
  sourceUrl: string;
  version: string;
  needsReview?: boolean;
  syntheticMetric?: boolean;
}

export interface MetadataCandidate {
  documentId?: unknown;
  visibility?: unknown;
  department?: unknown;
  sensitivity?: unknown;
  fgaObjectId?: unknown;
  source?: unknown;
  sourceKind?: unknown;
  sourceUrl?: unknown;
  version?: unknown;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createStableDocumentId(
  prefix: string,
  stableKey: string,
): string {
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const digest = createHash("sha256")
    .update(stableKey)
    .digest("hex")
    .slice(0, 32);
  return `${safePrefix}:${digest}`;
}

export function metadataValidationErrors(
  candidate: MetadataCandidate,
): string[] {
  const errors: string[] = [];

  if (!nonEmptyString(candidate.documentId)) errors.push("documentId");
  if (
    candidate.visibility !== "public" &&
    candidate.visibility !== "restricted"
  ) {
    errors.push("visibility");
  }
  if (!nonEmptyString(candidate.source)) errors.push("source");
  if (
    candidate.sourceKind !== "source-derived" &&
    candidate.sourceKind !== "synthetic"
  ) {
    errors.push("sourceKind");
  }
  if (!nonEmptyString(candidate.sourceUrl)) errors.push("sourceUrl");
  if (!nonEmptyString(candidate.version)) errors.push("version");

  if (candidate.visibility === "restricted") {
    if (!nonEmptyString(candidate.department)) errors.push("department");
    if (!nonEmptyString(candidate.sensitivity)) errors.push("sensitivity");
    if (
      !nonEmptyString(candidate.fgaObjectId) ||
      candidate.fgaObjectId.startsWith("document:")
    ) {
      errors.push("fgaObjectId");
    }
  }

  return errors;
}

export function hasValidDocumentMetadata(
  candidate: MetadataCandidate,
): candidate is MetadataCandidate & DocumentMetadata {
  return metadataValidationErrors(candidate).length === 0;
}
