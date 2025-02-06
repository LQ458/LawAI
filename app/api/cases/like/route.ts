import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Like } from "@/models/like";

const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      cookieName,
      secret: process?.env?.NEXTAUTH_SECRET,
    });

    if (!token?.email) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { recordId } = await req.json();
    if (!recordId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    await DBconnect();

    const record = await Record.findById(recordId);
    if (!record) {
      return NextResponse.json({ error: "案例不存在" }, { status: 404 });
    }

    // 检查是否已点赞
    const existingLike = await Like.findOne({
      userId: token.email,
      recordId,
    });

    if (existingLike) {
      // 取消点赞
      await Promise.all([
        Like.deleteOne({ _id: existingLike._id }),
        Record.updateOne({ _id: recordId }, { $inc: { likes: -1 } }),
      ]);
      return NextResponse.json({ liked: false });
    } else {
      // 添加点赞
      await Promise.all([
        Like.create({
          userId: token.email,
          recordId,
          createdAt: new Date(),
        }),
        Record.updateOne({ _id: recordId }, { $inc: { likes: 1 } }),
      ]);
      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json({ error: "点赞失败" }, { status: 500 });
  }
}
