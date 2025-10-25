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

    // 检查chatId是否为空字符串（新建聊天的情况）
    if (chatId === "" || chatId === "new") {
      return NextResponse.json({ success: true, message: "No chat to delete" });
    }

    // 使用更灵活的用户查找方式，支持username和email
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username },
        { name: username }
      ]
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const deletedChat = await Chat.findOneAndDelete({
      _id: chatId,
      userId: user.email,
    });

    if (!deletedChat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 },
    );
  }
}
