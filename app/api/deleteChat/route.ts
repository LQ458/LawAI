import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";
import User from "@/models/user";

export async function POST(req: NextRequest) {
  try {
    await DBconnect();
    const { chatId, username } = await req.json();

    if (!chatId || !username) {
      return NextResponse.json(
        { error: "Chat ID and username are required" },
        { status: 400 },
      );
    }

    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const deletedChat = await Chat.findOneAndDelete({
      _id: chatId,
      userId: user._id,
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
