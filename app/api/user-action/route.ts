import { NextRequest, NextResponse } from "next/server";
import { Record } from "@/models/record";
import { UserProfile } from "@/models/userProfile";
import DBconnect from "@/lib/mongodb";
import { getUserIdentityFromBody } from "@/lib/authUtils";

/**
 * 用户行为追踪API - 支持已登录和未登录用户
 * 已登录用户: 记录到数据库
 * 未登录用户: 返回成功,由前端管理行为数据
 */
export async function POST(request: NextRequest) {
  try {
    console.log("📊 User action tracking request received");
    const body = await request.json();
    const { action, recordId, duration } = body;

    // 获取用户身份
    const identity = await getUserIdentityFromBody(request, body, true);
    
    if (!identity) {
      return NextResponse.json({ error: "User identity required" }, { status: 400 });
    }

    console.log(`👤 Tracking ${action} for ${identity.isGuest ? 'guest' : 'user'}: ${identity.identifier}`);

    // 临时用户模式 - 直接返回成功,由前端管理数据
    if (identity.isGuest) {
      console.log("🔓 Guest mode: Action tracked on frontend");
      return NextResponse.json({ 
        success: true, 
        isGuest: true,
        message: "Action tracked locally"
      });
    }

    // 已登录用户模式 - 记录到数据库
    await DBconnect();

    const record = await Record.findById(recordId);
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // 更新记录的交互分数
    let interactionScore = record.interactionScore || 0;
    const weights = {
      view: 1,
      like: 3,
      bookmark: 5,
      duration: 0.1, // 每秒的权重
    };

    switch (action) {
      case "view":
        interactionScore += weights.view;
        if (duration) {
          interactionScore += duration * weights.duration;
        }
        break;
      case "like":
        interactionScore += weights.like;
        break;
      case "bookmark":
        interactionScore += weights.bookmark;
        break;
    }

    // 更新记录的交互分数
    await Record.findByIdAndUpdate(recordId, {
      interactionScore,
      $inc: { views: action === "view" ? 1 : 0 },
    });

    // 更新用户画像
    let userProfile = await UserProfile.findOne({ userId: identity.userId });
    if (!userProfile) {
      userProfile = new UserProfile({
        userId: identity.userId,
        tagWeights: {},
        categoryWeights: {},
        interactions: {
          views: 0,
          likes: 0,
          bookmarks: 0,
          avgDuration: 0,
        },
      });
    }

    // 更新标签权重
    record.tags.forEach((tag: string) => {
      userProfile.tagWeights[tag] = (userProfile.tagWeights[tag] || 0) + 1;
    });

    // 更新交互统计
    const interactions = userProfile.interactions;
    switch (action) {
      case "view":
        interactions.views += 1;
        if (duration) {
          interactions.avgDuration =
            (interactions.avgDuration * (interactions.views - 1) + duration) /
            interactions.views;
        }
        break;
      case "like":
        interactions.likes += 1;
        break;
      case "bookmark":
        interactions.bookmarks += 1;
        break;
    }

    await userProfile.save();

    console.log("✅ Action tracked in database");
    return NextResponse.json({ success: true, isGuest: false });
  } catch (error) {
    console.error("❌ Error in user action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
