import mongoose from "mongoose";

/**
 * 收藏记录接口
 * @interface IBookmark
 * @extends {Document}
 *
 * @property {string} userId - 用户邮箱，作为唯一标识
 * @property {mongoose.Types.ObjectId} recordId - 案例记录ID
 * @property {Date} createdAt - 收藏时间
 */
export interface IBookmark extends mongoose.Document {
  userId: string; // 使用email作为userId
  recordId: mongoose.Types.ObjectId;
  createdAt: Date;
}

/**
 * 收藏记录Schema
 * @description
 * 1. userId使用email作为唯一标识
 * 2. 创建复合索引确保每个用户只能收藏一个记录一次
 * 3. 添加创建时间用于后续分析
 */
const bookmarkSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Record",
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 创建复合索引以确保每个用户只能收藏一个记录一次
bookmarkSchema.index({ userId: 1, recordId: 1 }, { unique: true });

export const Bookmark =
  mongoose.models.Bookmark || mongoose.model("Bookmark", bookmarkSchema);
