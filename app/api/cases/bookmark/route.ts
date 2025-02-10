import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Bookmark } from "@/models/bookmark";

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

    if (!token?.email) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { recordId } = await req.json();
    if (!recordId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    await DBconnect();

    const record = await Record.findById(recordId);
    if (!record) {
      return NextResponse.json({ error: "案例不存在" }, { status: 404 });
    }

    // 检查是否已收藏
    const existingBookmark = await Bookmark.findOne({
      userId: token.email,
      recordId,
    });

    if (existingBookmark) {
      // 取消收藏
      await Bookmark.deleteOne({ _id: existingBookmark._id });
      return NextResponse.json({ bookmarked: false });
    } else {
      // 添加收藏
      await Bookmark.create({
        userId: token.email,
        recordId,
        createdAt: new Date(),
      });
      return NextResponse.json({ bookmarked: true });
    }
  } catch (error) {
    console.error("Bookmark error:", error);
    return NextResponse.json({ error: "收藏失败" }, { status: 500 });
  }
}
