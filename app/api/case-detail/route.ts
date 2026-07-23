import { NextRequest, NextResponse } from "next/server";
import { getServerIdentity } from "@/lib/serverAuth";
import { getAuthorizedDocument, RagServiceError } from "@/lib/rag";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || id.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid_document_id" }, { status: 400 });
  }

  let subject: string | null = null;
  try {
    subject = (await getServerIdentity(request))?.subject || null;
  } catch {
    // A failed identity lookup is anonymous and therefore public-only.
  }

  try {
    const document = await getAuthorizedDocument(id, subject);
    if (!document) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      id: document.documentId || document.id,
      title: document.title,
      description: document.description || "",
      content: document.content || "",
      source: document.source || "unspecified",
    });
  } catch (error) {
    if (error instanceof RagServiceError) {
      return NextResponse.json(
        { error: "document_upstream_unavailable" },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
