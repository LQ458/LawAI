import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";
import { readJsonObject } from "@/lib/request";
import { getServerIdentity } from "@/lib/serverAuth";

const MAX_BODY_BYTES = 1_024;

export async function POST(req: NextRequest) {
  try {
    const identity = await getServerIdentity(req);
    if (!identity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonObject(req, MAX_BODY_BYTES);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    await DBconnect();
    const chats = await Chat.find({ userId: identity.subject })
      .select("_id title time messages")
      .sort({ time: -1 })
      .lean();

    return NextResponse.json({ chats });
  } catch {
    console.error("Failed to fetch authenticated user's chats");
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 },
    );
  }
}
