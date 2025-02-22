/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Like } from "@/models/like";
import { Bookmark } from "@/models/bookmark";
import mongoose from "mongoose";
const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

/**
 * 获取案例列表API
 * 支持分页、排序、标签过滤
 * 同时返回当前用户的点赞和收藏状态
 */
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
        sortQuery = { lastUpdateTime: -1 };
        break;
      case "popular":
        sortQuery = { interactionScore: -1 };
        break;
      case "mostLiked":
        sortQuery = { likes: -1 };
        break;
      default:
        sortQuery = { lastUpdateTime: -1 };
    }

    // 获取案例列表
    const records = await Record.find(query)
      .sort(sortQuery)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    // 如果用户已登录,获取点赞和收藏状态
    if (token?.email) {
      // 过滤并转换有效的ObjectId
      const recordIds = records
        .map((r) => r._id?.toString())
        .filter((id): id is string => {
          return id !== undefined && mongoose.Types.ObjectId.isValid(id);
        })
        .map((id) => new mongoose.Types.ObjectId(id));

      if (recordIds.length > 0) {
        // 获取当前用户的点赞和收藏记录
        const [likes, bookmarks] = await Promise.all([
          Like.find({
            userId: token.email,
            recordId: { $in: recordIds },
          }).lean(),
          Bookmark.find({
            userId: token.email,
            recordId: { $in: recordIds },
          }).lean(),
        ]);

        // 创建点赞和收藏记录的Set用于快速查找
        const likedRecordIds = new Set(likes.map((l) => l.recordId.toString()));
        const bookmarkedRecordIds = new Set(
          bookmarks.map((b) => b.recordId.toString()),
        );

        // 为每条记录添加点赞和收藏状态
        records.forEach((r: any) => {
          const id = r._id?.toString();
          if (id) {
            r.isLiked = likedRecordIds.has(id);
            r.isBookmarked = bookmarkedRecordIds.has(id);
          }
        });
      }
    }

    return NextResponse.json({ cases: records });
  } catch (error) {
    console.error("Error fetching cases:", error);
    return NextResponse.json({ error: "获取案例列表失败" }, { status: 500 });
  }
}
