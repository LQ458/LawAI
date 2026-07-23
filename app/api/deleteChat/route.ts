import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";
import { readJsonObject, cleanBoundedString } from "@/lib/request";
import { getServerIdentity } from "@/lib/serverAuth";

const MAX_BODY_BYTES = 2_048;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

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

    const chatId = cleanBoundedString(body.value.chatId, {
      min: 24,
      max: 24,
    });
    if (!chatId || !OBJECT_ID_PATTERN.test(chatId)) {
      return NextResponse.json(
        { error: "A valid chat ID is required" },
        { status: 400 },
      );
    }

    await DBconnect();
    const deletedChat = await Chat.findOneAndDelete({
      _id: chatId,
      userId: identity.subject,
    });

    if (!deletedChat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error("Failed to delete authenticated user's chat");
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 },
    );
  }
}
