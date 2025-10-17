import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import { Record } from "@/models/record";
import { Article } from "@/models/article";
import { Bookmark } from "@/models/bookmark";
import mongoose from "mongoose";
import { CONFIG } from "@/config";
import { getUserIdentityFromBody } from "@/lib/authUtils";

export async function POST(req: NextRequest) {
  try {
    console.log("⭐ Bookmark API request received");
    const body = await req.json();
    const { recordId, contentType = "record" } = body;

    const identity = await getUserIdentityFromBody(req, body, true);
    
    if (!identity) {
      return NextResponse.json({ error: "User identity required" }, { status: 400 });
    }

    console.log(`👤 Bookmark request from ${identity.isGuest ? 'guest' : 'user'}: ${identity.identifier}`);

    if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
      return NextResponse.json({ error: "Invalid recordId" }, { status: 400 });
    }

    if (!["record", "article"].includes(contentType)) {
      return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
    }

    if (identity.isGuest) {
      console.log("🔓 Guest mode: Bookmark tracked on frontend");
      return NextResponse.json({ 
        success: true,
        isGuest: true,
        message: "Bookmark updated locally",
        bookmarked: true
      });
    }

    await DBconnect();

    const Collection = contentType === "record" ? Record : Article;
    const item = await Collection.findById(recordId);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const recordObjectId = new mongoose.Types.ObjectId(recordId);
    const existingBookmark = await Bookmark.findOne({
      userId: identity.userId,
      recordId: recordObjectId,
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (existingBookmark) {
        await Bookmark.deleteOne({ _id: existingBookmark._id }).session(session);
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
        console.log("✅ Bookmark cancelled");
        return NextResponse.json({
          bookmarked: false,
          isGuest: false,
          message: "已取消收藏"
        });
      } else {
        await Bookmark.create([{
          userId: identity.userId,
          recordId: recordObjectId,
          contentType,
          createdAt: new Date(),
        }], { session });

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
        console.log("✅ Bookmarked");
        return NextResponse.json({
          bookmarked: true,
          isGuest: false,
          message: "收藏成功"
        });
      }
    } catch (err: unknown) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error: unknown) {
    console.error("❌ Bookmark error:", error);
    return NextResponse.json(
      { error: "Failed" },
      { status: 500 },
    );
  }
}
