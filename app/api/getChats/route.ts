import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";
import User from "@/models/user";

export async function POST(req: NextRequest) {
  try {
    await DBconnect();
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const chats = await Chat.find({ userId: user._id }).sort({ time: -1 });

    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Error in getChats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 },
    );
  }
}
