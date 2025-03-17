import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Record } from "@/models/record";
import { UserProfile } from "@/models/userProfile";
import DBconnect from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    await DBconnect();

    const token = await getToken({ req: request });
    if (!token?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { action, recordId, duration } = data;

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
    let userProfile = await UserProfile.findOne({ userId: token.email });
    if (!userProfile) {
      userProfile = new UserProfile({
        userId: token.email,
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
    record.tags.forEach((tag) => {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in user action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
