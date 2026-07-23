import mongoose, { Schema, Document } from "mongoose";

/**
 * 点赞记录接口
 * @interface ILike
 * @extends {Document}
 *
 * @property {string} userId - 服务端 Auth0 subject
 * @property {mongoose.Types.ObjectId} recordId - 案例记录ID
 * @property {Date} createdAt - 点赞时间
 */
export interface ILike extends Document {
  userId: string;
  recordId: mongoose.Types.ObjectId;
  createdAt: Date;
}

/**
 * 点赞记录Schema
 * @description
 * 1. userId使用服务端 Auth0 subject
 * 2. 创建复合索引确保每个用户只能对每个记录点赞一次
 * 3. 添加创建时间用于后续分析
 */
const likeSchema = new Schema<ILike>({
  userId: {
    type: String,
    required: true,
  },
  recordId: {
    type: Schema.Types.ObjectId,
    ref: "Record",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 创建新的复合唯一索引
likeSchema.index(
  { userId: 1, recordId: 1 },
  {
    unique: true,
    name: "userId_recordId_unique", // 显式指定索引名称
  },
);

// 防止model重复编译
export const Like =
  mongoose.models.Like || mongoose.model<ILike>("Like", likeSchema);
