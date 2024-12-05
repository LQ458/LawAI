import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import DBconnect from "@/lib/mongodb";
import { Case, Bookmark } from "@/models/case";
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

    // 检查是否已收藏
    const existingBookmark = await Bookmark.findOne({
      userId,
      caseId: caseObjectId,
    });

    if (existingBookmark) {
      // 取消收藏
      await Promise.all([
        Bookmark.deleteOne({ _id: existingBookmark._id }),
        Case.updateOne({ _id: caseObjectId }, { $inc: { bookmarks: -1 } }),
      ]);
      return NextResponse.json({ bookmarked: false });
    } else {
      // 添加收藏
      await Promise.all([
        Bookmark.create({ userId, caseId: caseObjectId }),
        Case.updateOne({ _id: caseObjectId }, { $inc: { bookmarks: 1 } }),
      ]);
      return NextResponse.json({ bookmarked: true });
    }
  } catch (error) {
    console.error("Error handling bookmark:", error);
    return NextResponse.json(
      { error: "Failed to handle bookmark" },
      { status: 500 },
    );
  }
}
