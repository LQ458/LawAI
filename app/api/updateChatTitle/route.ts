import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";

export async function POST(req: NextRequest) {
  try {
    await DBconnect();
    const { chatId, newTitle } = await req.json();

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 },
      );
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { title: newTitle },
      { new: true },
    );

    if (!updatedChat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, chat: updatedChat });
  } catch (error) {
    console.error("Error updating chat title:", error);
    return NextResponse.json(
      { error: "Failed to update chat title" },
      { status: 500 },
    );
  }
}
