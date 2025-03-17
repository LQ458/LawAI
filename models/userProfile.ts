import mongoose, { Schema, Document } from "mongoose";

interface IUserProfile extends Document {
  userId: string;
  // 用户兴趣标签权重
  tagWeights: {
    [key: string]: number;
  };
  // 分类偏好权重
  categoryWeights: {
    [key: string]: number;
  };
  // 交互行为统计
  interactions: {
    likes: number;
    bookmarks: number;
    views: number;
    avgDuration: number;
  };
  // 活跃度分数
  activityScore: number;
  lastUpdateTime: Date;
}

const UserProfileSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  tagWeights: { type: Map, of: Number, default: {} },
  categoryWeights: { type: Map, of: Number, default: {} },
  interactions: {
    likes: { type: Number, default: 0 },
    bookmarks: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 },
  },
  activityScore: { type: Number, default: 0 },
  lastUpdateTime: { type: Date, default: Date.now },
});

export const UserProfile =
  mongoose.models.UserProfile ||
  mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);

export type { IUserProfile };
