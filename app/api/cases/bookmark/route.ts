import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Bookmark } from "@/models/bookmark";
import mongoose from "mongoose";
import { CONFIG } from "@/config";

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    const userSub = session?.user?.sub;

    if (!userSub) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { recordId } = await req.json();
    if (!recordId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(recordId)) {
      return NextResponse.json({ error: "无效的记录ID" }, { status: 400 });
    }

    await DBconnect();

    const record = await Record.findById(recordId);
    if (!record) {
      return NextResponse.json({ error: "案例不存在" }, { status: 404 });
    }

    const recordObjectId = new mongoose.Types.ObjectId(recordId);

    const existingBookmark = await Bookmark.findOne({
      userId: userSub,
      recordId: recordObjectId,
    });

    const sessionDb = await mongoose.startSession();
    sessionDb.startTransaction();

    try {
      if (existingBookmark) {
        await Bookmark.deleteOne({ _id: existingBookmark._id }).session(
          sessionDb,
        );

        await Record.findByIdAndUpdate(
          recordObjectId,
          {
            $inc: {
              bookmarks: -1,
              interactionScore: -CONFIG.WEIGHTS.BOOKMARK,
            },
          },
          { new: true },
        ).session(sessionDb);

        await sessionDb.commitTransaction();

        return NextResponse.json({
          bookmarked: false,
          message: "已取消收藏",
          recordId: recordId,
        });
      } else {
        await Bookmark.create(
          [
            {
              userId: userSub,
              recordId: recordObjectId,
              createdAt: new Date(),
            },
          ],
          { session: sessionDb },
        );

        await Record.findByIdAndUpdate(
          recordObjectId,
          {
            $inc: {
              bookmarks: 1,
              interactionScore: CONFIG.WEIGHTS.BOOKMARK,
            },
          },
          { new: true },
        ).session(sessionDb);

        await sessionDb.commitTransaction();

        return NextResponse.json({
          bookmarked: true,
          message: "收藏成功",
          recordId: recordId,
        });
      }
    } catch (err: unknown) {
      await sessionDb.abortTransaction();

      if (err instanceof Error && "code" in err && err.code === 11000) {
        return NextResponse.json(
          { error: "您已经收藏过这条记录" },
          { status: 400 },
        );
      }
      throw err;
    } finally {
      sessionDb.endSession();
    }
  } catch (error: unknown) {
    console.error("Bookmark error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "收藏操作失败" },
      { status: 500 },
    );
  }
}
