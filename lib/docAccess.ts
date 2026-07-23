import "server-only";

import { fgaCheck } from "@/lib/fga";
import { toFgaUserObject } from "@/lib/fgaIdentity";

export type DocumentVisibility = "public" | "restricted";

export interface DocCandidate {
  id: string;
  documentId?: string;
  title?: string;
  link?: string;
  description?: string;
  summary?: string;
  content?: string;
  visibility?: DocumentVisibility;
  sensitivity?: string;
  department?: string;
  fgaObjectId?: string;
  source?: string;
  sourceKind?: "source-derived" | "synthetic";
  score?: number;
}

export type FgaChecker = typeof fgaCheck;

export function hasCompleteRestrictedMetadata(
  doc: DocCandidate,
): doc is DocCandidate & {
  visibility: "restricted";
  documentId: string;
  department: string;
  sensitivity: string;
  fgaObjectId: string;
} {
  return Boolean(
    doc.visibility === "restricted" &&
    doc.documentId &&
    doc.department &&
    doc.sensitivity &&
    doc.fgaObjectId,
  );
}

/**
 * Only explicitly public documents bypass FGA. Missing or incomplete
 * authorization metadata is denied, never inferred to mean public.
 */
export async function filterDocsByAccess(
  docs: DocCandidate[],
  authenticatedSubject: string | null,
  check: FgaChecker = fgaCheck,
): Promise<DocCandidate[]> {
  if (docs.length === 0) {
    return [];
  }

  const fgaUser = authenticatedSubject
    ? toFgaUserObject(authenticatedSubject)
    : null;

  const decisions = await Promise.all(
    docs.map(async (doc) => {
      if (doc.visibility === "public") {
        return doc;
      }

      if (!fgaUser || !hasCompleteRestrictedMetadata(doc)) {
        return null;
      }

      try {
        const allowed = await check({
          user: fgaUser,
          relation: "viewer",
          object: doc.fgaObjectId,
        });
        return allowed ? doc : null;
      } catch {
        return null;
      }
    }),
  );

  return decisions.filter((doc): doc is DocCandidate => doc !== null);
}
