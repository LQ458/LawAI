import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/serverAuth";
import { cleanBoundedString, readJsonObject } from "@/lib/request";
import { RagServiceError, runGroundedRag } from "@/lib/rag";
import { consumeRateLimit } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 8_192;
const MAX_QUERY_CHARS = 1_000;

export async function POST(request: NextRequest) {
  const body = await readJsonObject(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const query = cleanBoundedString(body.value.query, {
    max: MAX_QUERY_CHARS,
  });
  if (!query) {
    return NextResponse.json(
      { error: "query_must_be_a_non_empty_string" },
      { status: 400 },
    );
  }

  let authenticatedSubject: string | null = null;
  try {
    authenticatedSubject = (await getServerIdentity(request))?.subject || null;
  } catch {
    // Identity-provider failure is treated as anonymous. Restricted documents
    // remain fail-closed while explicit public documents stay available.
  }

  if (!(await consumeRateLimit("rag", request, authenticatedSubject))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const result = await runGroundedRag(query, authenticatedSubject);
    return NextResponse.json({
      ...result,
      cases: result.sources,
      data: result.answer,
    });
  } catch (error) {
    const upstream =
      error instanceof RagServiceError ? error.service : "configuration";
    return NextResponse.json(
      { error: "rag_upstream_unavailable", upstream },
      { status: 502 },
    );
  }
}
