import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import DBconnect from "@/lib/mongodb";
import { Case, Like } from "@/models/case";
import mongoose from "mongoose";
const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      cookieName,
      secret: process?.env?.NEXTAUTH_SECRET,
    });
    if (!token?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { caseId } = await req.json();
    if (!caseId) {
      return NextResponse.json(
        { error: "Case ID is required" },
        { status: 400 },
      );
    }

    await DBconnect();

    const userId = mongoose.Types.ObjectId.createFromHexString(
      token.user.id as string,
    );
    const caseObjectId = mongoose.Types.ObjectId.createFromHexString(caseId);

    // 检查是否已点赞
    const existingLike = await Like.findOne({ userId, caseId: caseObjectId });

    if (existingLike) {
      // 取消点赞
      await Promise.all([
        Like.deleteOne({ _id: existingLike._id }),
        Case.updateOne({ _id: caseObjectId }, { $inc: { likes: -1 } }),
      ]);
      return NextResponse.json({ liked: false });
    } else {
      // 添加点赞
      await Promise.all([
        Like.create({ userId, caseId: caseObjectId }),
        Case.updateOne({ _id: caseObjectId }, { $inc: { likes: 1 } }),
      ]);
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error("Error handling like:", error);
    return NextResponse.json(
      { error: "Failed to handle like" },
      { status: 500 },
    );
  }
}
