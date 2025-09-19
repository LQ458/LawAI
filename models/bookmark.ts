import mongoose, { Schema } from "mongoose";

/**
 * 收藏记录接口
 * @interface IBookmark
 * @extends {Document}
 *
 * @property {string} userId - 用户邮箱，作为唯一标识
 * @property {mongoose.Types.ObjectId} recordId - 案例记录ID或文章ID
 * @property {string} contentType - 内容类型："record" 或 "article"
 * @property {Date} createdAt - 收藏时间
 */
export interface IBookmark {
  userId: string;
  recordId: mongoose.Types.ObjectId;
  contentType: "record" | "article";
  createdAt: Date;
}

/**
 * 收藏记录Schema
 * @description
 * 1. userId使用email作为唯一标识
 * 2. 支持案例和文章的收藏
 * 3. 创建复合索引确保每个用户只能收藏一个记录一次
 * 4. 添加创建时间用于后续分析
 */
const bookmarkSchema = new Schema<IBookmark>({
  userId: {
    type: String,
    required: true,
  },
  recordId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  contentType: {
    type: String,
    enum: ["record", "article"],
    default: "record",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 删除所有现有索引
bookmarkSchema.pre("save", async function (next) {
  try {
    const collection = mongoose.connection.collections["bookmarks"];
    if (collection) {
      const indexes = await collection.listIndexes().toArray();
      for (const index of indexes) {
        // 保留_id的默认索引
        if (index.name !== "_id_") {
          await collection.dropIndex(index.name);
        }
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// 创建新的复合唯一索引
bookmarkSchema.index(
  { userId: 1, recordId: 1 },
  {
    unique: true,
    name: "userId_recordId_unique", // 显式指定索引名称
  },
);

// 防止model重复编译
export const Bookmark =
  mongoose.models.Bookmark ||
  mongoose.model<IBookmark>("Bookmark", bookmarkSchema);
