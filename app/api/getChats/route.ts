import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";

export async function POST(req: NextRequest) {
  try {
    await DBconnect();
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const chats = await Chat.find({ userId }).sort({ time: -1 });

    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Error in getChats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 },
    );
  }
}
