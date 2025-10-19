/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Like } from "@/models/like";
import { Bookmark } from "@/models/bookmark";
import mongoose from "mongoose";
import { getUserIdentityFromBody } from "@/lib/authUtils";

/**
 * 获取案例列表API - 支持已登录和未登录用户
 * 支持分页、排序、标签过滤
 * 已登录用户返回点赞和收藏状态
 * 未登录用户从请求体中获取guestProfile来显示状态
 */
export async function POST(req: NextRequest) {
  try {
    console.log("📚 Cases list request received");
    const body = await req.json();
    const {
      page = 1,
      pageSize = 12,
      sort = "latest",
      tags = [],
      guestProfile, // 未登录用户的本地profile数据
    } = body;

    // 获取用户身份 (已登录或未登录)
    const identity = await getUserIdentityFromBody(req, body, true);
    
    console.log(`👤 User identity: ${identity ? (identity.isGuest ? 'Guest' : 'Authenticated') : 'None'}`);

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

    // 根据用户类型添加点赞和收藏状态
    if (identity && !identity.isGuest) {
      // 已登录用户 - 从数据库获取状态
      const recordIds = records
        .map((r) => r._id?.toString())
        .filter((id): id is string => {
          return id !== undefined && mongoose.Types.ObjectId.isValid(id);
        })
        .map((id) => new mongoose.Types.ObjectId(id));

      if (recordIds.length > 0) {
        const [likes, bookmarks] = await Promise.all([
          Like.find({
            userId: identity.userId,
            recordId: { $in: recordIds },
          }).lean(),
          Bookmark.find({
            userId: identity.userId,
            recordId: { $in: recordIds },
          }).lean(),
        ]);

        const likedRecordIds = new Set(likes.map((l) => l.recordId.toString()));
        const bookmarkedRecordIds = new Set(
          bookmarks.map((b) => b.recordId.toString()),
        );

        records.forEach((r: any) => {
          const id = r._id?.toString();
          if (id) {
            r.isLiked = likedRecordIds.has(id);
            r.isBookmarked = bookmarkedRecordIds.has(id);
          }
        });
      }
    } else if (identity && identity.isGuest && guestProfile) {
      // 未登录用户 - 从前端传来的guestProfile获取状态
      const likedSet = new Set(guestProfile.likedRecords || []);
      const bookmarkedSet = new Set(guestProfile.bookmarkedRecords || []);

      records.forEach((r: any) => {
        const id = r._id?.toString();
        if (id) {
          r.isLiked = likedSet.has(id);
          r.isBookmarked = bookmarkedSet.has(id);
        }
      });
    } else {
      // 完全未认证的访客 - 默认状态为false
      records.forEach((r: any) => {
        r.isLiked = false;
        r.isBookmarked = false;
      });
    }

    console.log(`✅ Returned ${records.length} cases`);
    return NextResponse.json({ cases: records });
  } catch (error) {
    console.error("❌ Error fetching cases:", error);
    return NextResponse.json({ error: "获取案例列表失败" }, { status: 500 });
  }
}
