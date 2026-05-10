import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await DBconnect();
    const doc = await Record.findById(id)
      .select("title description content tags category")
      .lean() as { title?: string; description?: string; content?: string; tags?: string[]; category?: string } | null;

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      title: doc.title,
      description: doc.description,
      content: doc.content,
      tags: doc.tags,
      category: doc.category,
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
