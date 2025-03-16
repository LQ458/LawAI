import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Bookmark } from "@/models/bookmark";
import mongoose from "mongoose";

const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

/**
 * 收藏/取消收藏API
 *
 * @route POST /api/cases/bookmark
 * @param {string} recordId - 案例记录ID
 * @returns {object} 包含收藏状态的响应
 *
 * @description
 * 1. 验证用户登录状态和请求参数
 * 2. 检查记录是否存在
 * 3. 根据当前用户判断是否已收藏
 * 4. 更新收藏状态
 * 5. 返回最新状态用于前端同步
 */
export async function POST(req: NextRequest) {
  try {
    // 验证用户登录状态
    const token = await getToken({
      req,
      cookieName,
      secret: process?.env?.NEXTAUTH_SECRET,
    });

    if (!token?.email) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // 验证请求参数
    const { recordId } = await req.json();
    if (!recordId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 验证recordId格式
    if (!mongoose.Types.ObjectId.isValid(recordId)) {
      return NextResponse.json({ error: "无效的记录ID" }, { status: 400 });
    }

    await DBconnect();

    // 检查记录是否存在
    const record = await Record.findById(recordId);
    if (!record) {
      return NextResponse.json({ error: "案例不存在" }, { status: 404 });
    }

    // 检查当前用户是否已收藏
    const existingBookmark = await Bookmark.findOne({
      userId: token.email,
      recordId: new mongoose.Types.ObjectId(recordId),
    });

    if (existingBookmark) {
      // 取消收藏
      await Bookmark.deleteOne({ _id: existingBookmark._id });

      return NextResponse.json({
        bookmarked: false,
        message: "已取消收藏",
        recordId: recordId,
      });
    } else {
      // 添加收藏
      await Bookmark.create({
        userId: token.email,
        recordId: new mongoose.Types.ObjectId(recordId),
        createdAt: new Date(),
      });

      return NextResponse.json({
        bookmarked: true,
        message: "收藏成功",
        recordId: recordId,
      });
    }
  } catch (error) {
    console.error("Bookmark error:", error);
    return NextResponse.json({ error: "收藏操作失败" }, { status: 500 });
  }
}
