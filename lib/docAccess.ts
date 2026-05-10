import { fgaCheck } from "./fga";

interface DocCandidate {
  id: string;
  title: string;
  link?: string;
  sensitivity?: string;
  department?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export async function filterDocsByAccess(
  docs: DocCandidate[],
  userId: string,
): Promise<DocCandidate[]> {
  if (!docs.length) return [];

  const results = await Promise.all(
    docs.map(async (doc) => {
      const docId = doc.id || "unknown";

      // If document has no sensitivity/department metadata, treat as public
      if (!doc.sensitivity && !doc.department) {
        return doc;
      }

      const allowed = await fgaCheck({
        user: `user:${userId}`,
        relation: "viewer",
        object: `document:${docId}`,
      });
      return allowed ? doc : null;
    }),
  );

  return results.filter((d): d is DocCandidate => d !== null);
}
