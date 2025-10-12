import { NextResponse, NextRequest } from "next/server";
import DBconnect from "@/lib/mongodb";
import User from "@/models/user";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    await DBconnect();

    const user = await User.findOne({ username });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      trialChatsUsed: user.trialChatsUsed || 0,
      trialChatsLimit: user.trialChatsLimit || 10,
      isPremium: user.isPremium || false,
      remainingTrialChats: Math.max(0, (user.trialChatsLimit || 10) - (user.trialChatsUsed || 0))
    });
  } catch (error) {
    console.error("Error fetching user trial status:", error);
    return NextResponse.json(
      { error: "Failed to fetch trial status" },
      { status: 500 }
    );
  }
}