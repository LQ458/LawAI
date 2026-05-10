import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Like } from "@/models/like";
import { Bookmark } from "@/models/bookmark";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    const userSub = session?.user?.sub;

    const {
      page = 1,
      pageSize = 12,
      sort = "latest",
      tags = [],
    } = await req.json();

    await DBconnect();

    const query: Record<string, unknown> = {};
    if (tags.length > 0) {
      query.tags = { $in: tags };
    }

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

    const records = await Record.find(query)
      .sort(sortQuery)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    if (userSub) {
      const recordIds = records
        .map((r) => r._id?.toString())
        .filter((id): id is string => {
          return id !== undefined && mongoose.Types.ObjectId.isValid(id);
        })
        .map((id) => new mongoose.Types.ObjectId(id));

      if (recordIds.length > 0) {
        const [likes, bookmarks] = await Promise.all([
          Like.find({
            userId: userSub,
            recordId: { $in: recordIds },
          }).lean(),
          Bookmark.find({
            userId: userSub,
            recordId: { $in: recordIds },
          }).lean(),
        ]);

        const likedRecordIds = new Set(likes.map((l) => l.recordId.toString()));
        const bookmarkedRecordIds = new Set(
          bookmarks.map((b) => b.recordId.toString()),
        );

        records.forEach((r: Record<string, unknown>) => {
          const id = (r._id as mongoose.Types.ObjectId)?.toString();
          if (id) {
            (r as Record<string, unknown>).isLiked = likedRecordIds.has(id);
            (r as Record<string, unknown>).isBookmarked =
              bookmarkedRecordIds.has(id);
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
