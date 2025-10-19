import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Article } from "@/models/article";
import { Like } from "@/models/like";
import mongoose from "mongoose";
import { CONFIG } from "@/config";
import { getUserIdentityFromBody } from "@/lib/authUtils";

/**
 * 点赞/取消点赞API - 支持已登录和未登录用户
 * 
 * @route POST /api/cases/like
 * @param {string} recordId - 案例记录ID或文章ID
 * @param {string} contentType - 内容类型："record" 或 "article"
 * @param {string} guestId - 未登录用户的临时ID (可选)
 * @returns {object} 包含点赞状态的响应
 *
 * @description
 * 已登录用户: 更新数据库中的点赞记录
 * 未登录用户: 返回成功,由前端管理点赞状态
 */
export async function POST(req: NextRequest) {
  try {
    console.log("👍 Like API request received");
    const body = await req.json();
    const { recordId, contentType = "record", guestId } = body;

    // 获取用户身份
    const identity = await getUserIdentityFromBody(req, body, true);
    
    if (!identity) {
      return NextResponse.json({ error: "User identity required" }, { status: 400 });
    }

    console.log(`👤 Like request from ${identity.isGuest ? 'guest' : 'user'}: ${identity.identifier}`);

    // 验证请求参数
    if (!recordId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 验证contentType
    if (!["record", "article"].includes(contentType)) {
      return NextResponse.json({ error: "无效的内容类型" }, { status: 400 });
    }

    // 验证recordId格式
    if (!mongoose.Types.ObjectId.isValid(recordId)) {
      return NextResponse.json({ error: "无效的记录ID" }, { status: 400 });
    }

    // 临时用户模式 - 直接返回成功,由前端管理状态
    if (identity.isGuest) {
      console.log("🔓 Guest mode: Like tracked on frontend");
      return NextResponse.json({ 
        success: true,
        isGuest: true,
        message: "点赞状态已更新(本地保存)",
        liked: true, // 前端会根据实际状态切换
      });
    }

    // 已登录用户模式 - 更新数据库
    await DBconnect();

    // 根据contentType检查记录是否存在
    const Collection = contentType === "record" ? Record : Article;
    const item = await Collection.findById(recordId);
    if (!item) {
      return NextResponse.json({ 
        error: contentType === "record" ? "案例不存在" : "文章不存在" 
      }, { status: 404 });
    }

    // 转换recordId为ObjectId
    const recordObjectId = new mongoose.Types.ObjectId(recordId);

    // 检查当前用户是否已点赞
    const existingLike = await Like.findOne({
      userId: identity.userId,
      recordId: recordObjectId,
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (existingLike) {
        // 取消点赞 - 先删除Like记录
        await Like.deleteOne({ _id: existingLike._id }).session(session);

        // 成功后更新计数
        await Collection.findByIdAndUpdate(
          recordObjectId,
          {
            $inc: {
              likes: -1,
              interactionScore: -CONFIG.WEIGHTS.LIKE,
            },
          },
          { new: true },
        ).session(session);

        await session.commitTransaction();

        console.log("✅ Like cancelled for user");
        return NextResponse.json({
          liked: false,
          isGuest: false,
          message: "已取消点赞",
        });
      } else {
        // 添加点赞 - 先创建Like记录
        await Like.create(
          [
            {
              userId: identity.userId,
              recordId: recordObjectId,
              contentType,
              createdAt: new Date(),
            },
          ],
          { session },
        );

        // 成功后更新计数
        await Collection.findByIdAndUpdate(
          recordObjectId,
          {
            $inc: {
              likes: 1,
              interactionScore: CONFIG.WEIGHTS.LIKE,
            },
          },
          { new: true },
        ).session(session);

        await session.commitTransaction();

        console.log("✅ Liked successfully");
        return NextResponse.json({
          liked: true,
          isGuest: false,
          message: "点赞成功",
        });
      }
    } catch (err: unknown) {
      await session.abortTransaction();

      if (err instanceof Error && "code" in err && err.code === 11000) {
        console.log(err.message);
        return NextResponse.json(
          { error: "您已经点赞过这条记录" },
          { status: 400 },
        );
      }
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error: unknown) {
    console.error("❌ Like error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "点赞操作失败" },
      { status: 500 },
    );
  }
}
