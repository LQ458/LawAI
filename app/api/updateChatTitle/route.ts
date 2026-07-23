import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";
import { readJsonObject, cleanBoundedString } from "@/lib/request";
import { getServerIdentity } from "@/lib/serverAuth";

const MAX_BODY_BYTES = 4_096;
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
    const newTitle = cleanBoundedString(body.value.newTitle, { max: 120 });
    if (!chatId || !OBJECT_ID_PATTERN.test(chatId) || !newTitle) {
      return NextResponse.json(
        { error: "A valid chat ID and title are required" },
        { status: 400 },
      );
    }

    await DBconnect();
    const updatedChat = await Chat.findOneAndUpdate(
      { _id: chatId, userId: identity.subject },
      { title: newTitle },
      { new: true },
    );

    if (!updatedChat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      chat: {
        _id: updatedChat._id,
        title: updatedChat.title,
      },
    });
  } catch {
    console.error("Failed to update authenticated user's chat title");
    return NextResponse.json(
      { error: "Failed to update chat title" },
      { status: 500 },
    );
  }
}
