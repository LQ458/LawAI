import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Like } from "@/models/like";
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

    const existingLike = await Like.findOne({
      userId: userSub,
      recordId: recordObjectId,
    });

    const sessionDb = await mongoose.startSession();
    sessionDb.startTransaction();

    try {
      if (existingLike) {
        await Like.deleteOne({ _id: existingLike._id }).session(sessionDb);

        await Record.findByIdAndUpdate(
          recordObjectId,
          {
            $inc: {
              likes: -1,
              interactionScore: -CONFIG.WEIGHTS.LIKE,
            },
          },
          { new: true },
        ).session(sessionDb);

        await sessionDb.commitTransaction();

        return NextResponse.json({
          liked: false,
          message: "已取消点赞",
        });
      } else {
        await Like.create(
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
              likes: 1,
              interactionScore: CONFIG.WEIGHTS.LIKE,
            },
          },
          { new: true },
        ).session(sessionDb);

        await sessionDb.commitTransaction();

        return NextResponse.json({
          liked: true,
          message: "点赞成功",
        });
      }
    } catch (err: unknown) {
      await sessionDb.abortTransaction();

      if (err instanceof Error && "code" in err && err.code === 11000) {
        return NextResponse.json(
          { error: "您已经点赞过这条记录" },
          { status: 400 },
        );
      }
      throw err;
    } finally {
      sessionDb.endSession();
    }
  } catch (error: unknown) {
    console.error("Like error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "点赞操作失败" },
      { status: 500 },
    );
  }
}
