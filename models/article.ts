import mongoose, { Schema, Document } from "mongoose";

export interface IArticle extends Document {
  title: string;
  author: string;
  content: string;
  description: string;
  publishDate: Date;
  tags: string[];
  views: number;
  likes: number;
  bookmarks: number;
  category: string;
  interactionScore: number;
  lastUpdateTime: Date;
  vectorEmbedding?: number[];
  _id: string;
}

const articleSchema = new Schema<IArticle>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    publishDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    tags: [
      {
        type: String,
        index: true,
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    bookmarks: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    interactionScore: {
      type: Number,
      default: 0,
    },
    lastUpdateTime: {
      type: Date,
      default: Date.now,
    },
    vectorEmbedding: [
      {
        type: Number,
      },
    ],
  },
  {
    timestamps: true,
  },
);

// 添加文本搜索索引
articleSchema.index({ title: "text", description: "text", content: "text" });

// 添加交互分数更新方法
articleSchema.methods.updateInteractionScore = function () {
  const viewWeight = 1;
  const likeWeight = 3;
  const timeDecay = Math.exp(
    -(Date.now() - this.lastUpdateTime.getTime()) / (1000 * 60 * 60 * 24 * 7),
  );

  this.interactionScore =
    (this.views * viewWeight + this.likes * likeWeight) * timeDecay;
  return this.save();
};

export const Article =
  mongoose.models.Article || mongoose.model<IArticle>("Article", articleSchema);
