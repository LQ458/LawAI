import { NextRequest, NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import Chat from "@/models/chat";
import { Like } from "@/models/like";
import { Bookmark } from "@/models/bookmark";
import { UserProfile } from "@/models/userProfile";
import { Record } from "@/models/record";
import mongoose from "mongoose";
import { getUserIdentityFromBody } from "@/lib/authUtils";
import { GuestProfile } from "@/types";

/**
 * 临时用户数据迁移API
 * 
 * 在用户注册/登录后,将临时用户的数据迁移到真实用户账户
 * 
 * @route POST /api/migrate-guest-data
 * @param {string} guestId - 临时用户ID
 * @param {object} guestData - 临时用户的所有数据 (chats, profile等)
 * @returns {object} 迁移结果
 */
export async function POST(req: NextRequest) {
  try {
    console.log("🔄 Guest data migration request received");
    const body = await req.json();
    const { guestId, guestData } = body;

    // 验证必须是已登录用户才能迁移数据
    const identity = await getUserIdentityFromBody(req, body, false);
    
    if (!identity || identity.isGuest) {
      return NextResponse.json(
        { error: "Must be authenticated to migrate data" },
        { status: 401 }
      );
    }

    if (!guestId || !guestData) {
      return NextResponse.json(
        { error: "Missing guestId or guestData" },
        { status: 400 }
      );
    }

    console.log(`🔄 Migrating data from guest ${guestId} to user ${identity.userId}`);

    await DBconnect();

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let migratedCount = {
        chats: 0,
        likes: 0,
        bookmarks: 0,
        viewHistory: 0,
      };

      // 1. 迁移聊天记录
      if (guestData.chats && Array.isArray(guestData.chats)) {
        for (const guestChat of guestData.chats) {
          // 检查是否已存在相同的聊天
          const existingChat = await Chat.findOne({
            userId: identity.userId,
            title: guestChat.title,
          }).session(session);

          if (!existingChat) {
            await Chat.create([{
              title: guestChat.title,
              userId: identity.userId,
              time: guestChat.time,
              messages: guestChat.messages,
            }], { session });
            migratedCount.chats++;
          }
        }
      }

      // 2. 迁移点赞记录
      if (guestData.profile?.likedRecords && Array.isArray(guestData.profile.likedRecords)) {
        for (const recordId of guestData.profile.likedRecords) {
          if (!mongoose.Types.ObjectId.isValid(recordId)) continue;

          const recordObjectId = new mongoose.Types.ObjectId(recordId);

          // 检查是否已存在
          const existingLike = await Like.findOne({
            userId: identity.userId,
            recordId: recordObjectId,
          }).session(session);

          if (!existingLike) {
            await Like.create([{
              userId: identity.userId,
              recordId: recordObjectId,
              createdAt: new Date(),
            }], { session });

            // 更新记录的点赞数
            await Record.findByIdAndUpdate(
              recordObjectId,
              { $inc: { likes: 1 } },
              { session }
            );

            migratedCount.likes++;
          }
        }
      }

      // 3. 迁移收藏记录
      if (guestData.profile?.bookmarkedRecords && Array.isArray(guestData.profile.bookmarkedRecords)) {
        for (const recordId of guestData.profile.bookmarkedRecords) {
          if (!mongoose.Types.ObjectId.isValid(recordId)) continue;

          const recordObjectId = new mongoose.Types.ObjectId(recordId);

          // 检查是否已存在
          const existingBookmark = await Bookmark.findOne({
            userId: identity.userId,
            recordId: recordObjectId,
          }).session(session);

          if (!existingBookmark) {
            await Bookmark.create([{
              userId: identity.userId,
              recordId: recordObjectId,
              createdAt: new Date(),
            }], { session });

            // 更新记录的收藏数
            await Record.findByIdAndUpdate(
              recordObjectId,
              { $inc: { bookmarks: 1 } },
              { session }
            );

            migratedCount.bookmarks++;
          }
        }
      }

      // 4. 迁移浏览历史到用户画像
      if (guestData.profile?.viewHistory && Array.isArray(guestData.profile.viewHistory)) {
        let userProfile = await UserProfile.findOne({ userId: identity.userId }).session(session);
        
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

        // 处理浏览历史
        for (const view of guestData.profile.viewHistory) {
          if (!mongoose.Types.ObjectId.isValid(view.recordId)) continue;

          const record = await Record.findById(view.recordId).session(session);
          if (record) {
            // 更新标签权重
            record.tags.forEach((tag: string) => {
              userProfile.tagWeights[tag] = (userProfile.tagWeights[tag] || 0) + 1;
            });

            // 更新浏览统计
            userProfile.interactions.views += 1;
            if (view.duration) {
              const totalDuration = 
                userProfile.interactions.avgDuration * (userProfile.interactions.views - 1) + 
                view.duration;
              userProfile.interactions.avgDuration = totalDuration / userProfile.interactions.views;
            }

            migratedCount.viewHistory++;
          }
        }

        await userProfile.save({ session });
      }

      await session.commitTransaction();

      console.log("✅ Migration completed:", migratedCount);
      return NextResponse.json({
        success: true,
        message: "数据迁移成功",
        migratedCount,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: unknown) {
    console.error("❌ Migration error:", error);
    return NextResponse.json(
      { error: "数据迁移失败" },
      { status: 500 }
    );
  }
}
