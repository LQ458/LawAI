/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import DBconnect from "@/lib/mongodb";
import { Case } from "@/models/case";
import { Like } from "@/models/like";
import { Bookmark } from "@/models/bookmark";
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
    const {
      page = 1,
      pageSize = 12,
      sort = "latest",
      tags = [],
    } = await req.json();

    await DBconnect();

    // 构建查询条件
    const query: any = {};
    if (tags.length > 0) {
      query.tags = { $in: tags };
    }

    // 构建排序条件
    let sortQuery = {};
    switch (sort) {
      case "latest":
        sortQuery = { createdAt: -1 };
        break;
      case "popular":
        sortQuery = { bookmarks: -1, likes: -1 };
        break;
      case "mostLiked":
        sortQuery = { likes: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }

    // 获取案例列表
    const cases = await Case.find(query)
      .sort(sortQuery)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    // 如果用户已登录,获取点赞和收藏状态
    if (token?.user) {
      const userId = mongoose.Types.ObjectId.createFromHexString(
        token.user.id as string,
      );
      const caseIds = cases.map((c) =>
        mongoose.Types.ObjectId.createFromHexString(c._id as string),
      );

      const [likes, bookmarks] = await Promise.all([
        Like.find({ userId, caseId: { $in: caseIds } }).lean(),
        Bookmark.find({ userId, caseId: { $in: caseIds } }).lean(),
      ]);

      const likedCaseIds = new Set(likes.map((l) => l.caseId.toString()));
      const bookmarkedCaseIds = new Set(
        bookmarks.map((b) => b.caseId.toString()),
      );

      cases.forEach((c: any) => {
        c.isLiked = likedCaseIds.has(c._id.toString());
        c.isBookmarked = bookmarkedCaseIds.has(c._id.toString());
      });
    }

    return NextResponse.json({ cases });
  } catch (error) {
    console.error("Error fetching cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch cases" },
      { status: 500 },
    );
  }
}
