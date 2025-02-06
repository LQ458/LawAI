import mongoose, { Schema, Document } from "mongoose";

export interface IRecord extends Document {
  title: string;
  link: string;
  description: string;
  date: string;
  content: string;
  views: number;
  likes: number;
  tags: string[];
  category: string;
  relevantCases: string[]; // 相关案例ID
  vectorEmbedding: number[]; // 文本向量表示
  interactionScore: number; // 交互分数
  lastUpdateTime: Date;
  bookmarked?: boolean; // 是否被当前用户收藏
  _id: string; // MongoDB文档ID
  recommendScore?: number; // 推荐指数
}

const recordSchema = new Schema<IRecord>({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  link: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  views: {
    type: Number,
    default: 0,
  },
  likes: {
    type: Number,
    default: 0,
  },
  tags: [
    {
      type: String,
      index: true,
    },
  ],
  category: {
    type: String,
    required: true,
    index: true,
  },
  relevantCases: [
    {
      type: Schema.Types.ObjectId,
      ref: "Record",
    },
  ],
  vectorEmbedding: [
    {
      type: Number,
    },
  ],
  interactionScore: {
    type: Number,
    default: 0,
  },
  lastUpdateTime: {
    type: Date,
    default: Date.now,
  },
});

// 添加索引以优化查询性能
recordSchema.index({ title: "text", description: "text", content: "text" });
recordSchema.index({ tags: 1 });
recordSchema.index({ category: 1 });
recordSchema.index({ interactionScore: -1 });
recordSchema.index({ lastUpdateTime: -1 });

// 添加更新interactionScore的方法
recordSchema.methods.updateInteractionScore = function () {
  const viewWeight = 1;
  const likeWeight = 3;
  const timeDecay = Math.exp(
    -(Date.now() - this.lastUpdateTime.getTime()) / (1000 * 60 * 60 * 24 * 7),
  ); // 7天的时间衰减

  this.interactionScore =
    (this.views * viewWeight + this.likes * likeWeight) * timeDecay;
  return this.save();
};

export const Record =
  mongoose.models.Record || mongoose.model<IRecord>("Record", recordSchema);
