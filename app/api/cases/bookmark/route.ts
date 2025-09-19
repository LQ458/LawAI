import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Article } from "@/models/article";
import { Bookmark } from "@/models/bookmark";
import mongoose from "mongoose";
import { CONFIG } from "@/config";

const cookieName = process.env.NODE_ENV === "production"
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";

// 备选cookie名称（用于Codespace等环境）
const alternateCookieNames = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token.0",
  "next-auth.session-token.1"
];

/**
 * 收藏/取消收藏API
 *
 * @route POST /api/cases/bookmark
 * @param {string} recordId - 案例记录ID或文章ID
 * @param {string} contentType - 内容类型："record" 或 "article"
 * @returns {object} 包含收藏状态的响应
 *
 * @description
 * 1. 验证用户登录状态和请求参数
 * 2. 根据contentType检查记录或文章是否存在
 * 3. 根据当前用户判断是否已收藏
 * 4. 更新收藏状态
 * 5. 返回最新状态用于前端同步
 */
export async function POST(req: NextRequest) {
  try {
    // 尝试多种方式获取用户认证信息
    let token = await getToken({
      req,
      cookieName,
      secret: process?.env?.NEXTAUTH_SECRET,
    });

    // 如果第一次失败，尝试其他cookie名称
    if (!token?.email) {
      for (const altCookieName of alternateCookieNames) {
        try {
          token = await getToken({
            req,
            cookieName: altCookieName,
            secret: process?.env?.NEXTAUTH_SECRET,
          });
          if (token?.email) {
            console.log("Found token with cookie name:", altCookieName);
            break;
          }
        } catch {
          console.log("Failed with cookie name:", altCookieName);
        }
      }
    }

    console.log("Bookmark API - Token:", token?.email ? "Found" : "Not found");

    if (!token?.email) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // 验证请求参数
    const { recordId, contentType = "record" } = await req.json();
    console.log("Bookmark API - Params:", { recordId, contentType });
    
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

    // 检查当前用户是否已收藏
    const existingBookmark = await Bookmark.findOne({
      userId: token.email,
      recordId: recordObjectId,
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (existingBookmark) {
        // 取消收藏 - 先删除Bookmark记录
        await Bookmark.deleteOne({ _id: existingBookmark._id }).session(
          session,
        );

        // 成功后更新计数
        await Collection.findByIdAndUpdate(
          recordObjectId,
          {
            $inc: {
              bookmarks: -1,
              interactionScore: -CONFIG.WEIGHTS.BOOKMARK,
            },
          },
          { new: true },
        ).session(session);

        await session.commitTransaction();

        return NextResponse.json({
          bookmarked: false,
          message: "已取消收藏",
          recordId: recordId,
        });
      } else {
        // 添加收藏 - 先创建Bookmark记录
        await Bookmark.create(
          [
            {
              userId: token.email,
              recordId: recordObjectId,
              contentType, // 添加内容类型标记
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
              bookmarks: 1,
              interactionScore: CONFIG.WEIGHTS.BOOKMARK,
            },
          },
          { new: true },
        ).session(session);

        await session.commitTransaction();

        return NextResponse.json({
          bookmarked: true,
          message: "收藏成功",
          recordId: recordId,
        });
      }
    } catch (err: unknown) {
      await session.abortTransaction();

      if (err instanceof Error && "code" in err && err.code === 11000) {
        return NextResponse.json(
          { error: "您已经收藏过这条记录" },
          { status: 400 },
        );
      }
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error: unknown) {
    console.error("Bookmark error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "收藏操作失败" },
      { status: 500 },
    );
  }
}
