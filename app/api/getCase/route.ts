import { NextResponse } from "next/server";

/**
 * The legacy URL-query search bypassed document authorization and exposed
 * legal queries in URLs. Grounded retrieval is available only through the
 * JSON POST /api/rag-search endpoint.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "legacy_search_removed",
      replacement: "POST /api/rag-search",
    },
    { status: 410 },
  );
}
