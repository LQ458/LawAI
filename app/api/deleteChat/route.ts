import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";

export async function POST(req: NextRequest) {
  try {
    await DBconnect();
    const { chatId, userId } = await req.json();

    if (!chatId || !userId) {
      return NextResponse.json(
        { error: "Chat ID and user ID are required" },
        { status: 400 },
      );
    }

    const deletedChat = await Chat.findOneAndDelete({
      _id: chatId,
      userId: userId,
    });

    if (!deletedChat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 },
    );
  }
}
