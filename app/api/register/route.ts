// 注册用户逻辑
"use server";
import { NextResponse, NextRequest } from "next/server.js";
import User from "@/models/user";
import DBconnect from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import { RateLimiterMemory } from "rate-limiter-flexible";

// 创建速率限制器，使用内存存储
const rateLimiter = new RateLimiterMemory({
  points: 5, // 每个 IP 每 60 秒最多 5 次请求
  duration: 60, // 60 秒
});

export async function POST(req: NextRequest) {
  const ip = req.ip ?? "127.0.0.1";

  try {
    // 尝试消耗一个点
    await rateLimiter.consume(ip);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (rejRes) {
    // 超过限制时返回 429 状态
    return NextResponse.json({ message: "请求太频繁" }, { status: 429 });
  }
  try {
    const { username, password, email } = await req.json();
    if (!/^[^\W_]+$/.test(username)) {
      return NextResponse.json({ message: "用户名不合法" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "密码长度至少8位" }, { status: 400 });
    }
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/.test(
        password,
      )
    ) {
      return NextResponse.json(
        { message: "密码必须包含大小写字母、数字、特殊字符" },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email !== "") {
      return NextResponse.json({ message: "邮箱不合法" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await DBconnect();

    const oripw = password;
    await User.create({
      username,
      originalPassword: oripw,
      password: hashedPassword,
      email: email ?? "",
      admin: false,
    });

    return NextResponse.json({ message: "用户创建成功" }, { status: 201 });
  } catch (error) {
    console.error("创建用户失败:", error);
    return NextResponse.json({ message: "用户名或邮箱重复" }, { status: 500 });
  }
}
