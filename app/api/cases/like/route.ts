import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Like } from "@/models/like";
import mongoose from "mongoose";

const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

/**
 * 点赞/取消点赞API
 *
 * @route POST /api/cases/like
 * @param {string} recordId - 案例记录ID
 * @returns {object} 包含点赞状态的响应
 *
 * @description
 * 1. 验证用户登录状态和请求参数
 * 2. 检查记录是否存在
 * 3. 根据当前用户判断是否已点赞
 * 4. 更新点赞状态和计数
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

    // 检查当前用户是否已点赞
    const existingLike = await Like.findOne({
      userId: token.email,
      recordId: new mongoose.Types.ObjectId(recordId),
    });

    if (existingLike) {
      // 取消点赞
      await Promise.all([
        Like.deleteOne({ _id: existingLike._id }),
        Record.findByIdAndUpdate(
          recordId,
          { $inc: { likes: -1 } },
          { new: true },
        ),
      ]);

      return NextResponse.json({
        liked: false,
        message: "已取消点赞",
      });
    } else {
      // 添加点赞
      await Promise.all([
        Like.create({
          userId: token.email,
          recordId: new mongoose.Types.ObjectId(recordId),
          createdAt: new Date(),
        }),
        Record.findByIdAndUpdate(
          recordId,
          { $inc: { likes: 1 } },
          { new: true },
        ),
      ]);

      return NextResponse.json({
        liked: true,
        message: "点赞成功",
      });
    }
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json({ error: "点赞操作失败" }, { status: 500 });
  }
}
