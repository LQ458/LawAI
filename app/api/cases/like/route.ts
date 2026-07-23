import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Like } from "@/models/like";
import mongoose from "mongoose";
import { CONFIG } from "@/config";
import { filterDocsByAccess } from "@/lib/docAccess";
import { getServerIdentity } from "@/lib/serverAuth";
import { cleanBoundedString, readJsonObject } from "@/lib/request";

const MAX_BODY_BYTES = 1_024;

export async function POST(req: NextRequest) {
  try {
    const identity = await getServerIdentity(req);
    if (!identity) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await readJsonObject(req, MAX_BODY_BYTES);
    if (!body.ok) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }
    const recordId = cleanBoundedString(body.value.recordId, {
      min: 24,
      max: 24,
    });

    if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
      return NextResponse.json({ error: "无效的记录ID" }, { status: 400 });
    }
    const userSub = identity.subject;

    await DBconnect();

    const record = await Record.findById(recordId);
    if (!record) {
      return NextResponse.json({ error: "案例不存在" }, { status: 404 });
    }
    const [authorized] = await filterDocsByAccess(
      [
        {
          id: record._id.toString(),
          documentId: record.documentId,
          title: record.title,
          visibility: record.visibility,
          sensitivity: record.sensitivity,
          department: record.department,
          fgaObjectId: record.fgaObjectId,
        },
      ],
      userSub,
    );
    if (!authorized) {
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
  } catch {
    return NextResponse.json({ error: "点赞操作失败" }, { status: 500 });
  }
}
