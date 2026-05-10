import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { Record } from "@/models/record";
import { UserProfile } from "@/models/userProfile";
import DBconnect from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    await DBconnect();

    const session = await auth0.getSession();
    const userSub = session?.user?.sub;
    if (!userSub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { action, recordId, duration } = data;

    const record = await Record.findById(recordId);
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    let interactionScore = record.interactionScore || 0;
    const weights = {
      view: 1,
      like: 3,
      bookmark: 5,
      duration: 0.1,
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

    await Record.findByIdAndUpdate(recordId, {
      interactionScore,
      $inc: { views: action === "view" ? 1 : 0 },
    });

    let userProfile = await UserProfile.findOne({ userId: userSub });
    if (!userProfile) {
      userProfile = new UserProfile({
        userId: userSub,
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

    record.tags.forEach((tag: string) => {
      userProfile.tagWeights[tag] = (userProfile.tagWeights[tag] || 0) + 1;
    });

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
