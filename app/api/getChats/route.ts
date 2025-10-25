import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";
import User from "@/models/user";

export async function POST(req: NextRequest) {
  try {
    console.log("📥 getChats request received");
    await DBconnect();
    const { username } = await req.json();
    console.log("👤 Requested username:", username);

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    // 支持多种用户字段查找
    const user = await User.findOne({
      $or: [
        { username: username },
        { name: username }
      ]
    });
    
    if (!user) {
      console.log("❌ User not found for:", username);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("✅ User found:", user._id);
    const chats = await Chat.find({ userId: user._id }).sort({ time: -1 });
    console.log("📊 Found chats:", chats.length);

    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Error in getChats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 },
    );
  }
}
