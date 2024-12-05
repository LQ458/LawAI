import mongoose from "mongoose";

const caseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    required: true,
  },
  tags: [
    {
      type: String,
    },
  ],
  likes: {
    type: Number,
    default: 0,
  },
  bookmarks: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // 添加用户关联
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

// 添加索引以优化查询
caseSchema.index({ createdAt: -1 });
caseSchema.index({ likes: -1 });
caseSchema.index({ bookmarks: -1 });
caseSchema.index({ tags: 1 });

export const Case = mongoose.models.Case || mongoose.model("Case", caseSchema);

// 用户点赞记录
const likeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Case",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

likeSchema.index({ userId: 1, caseId: 1 }, { unique: true });

export const Like = mongoose.models.Like || mongoose.model("Like", likeSchema);

// 用户收藏记录
const bookmarkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Case",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

bookmarkSchema.index({ userId: 1, caseId: 1 }, { unique: true });

export const Bookmark =
  mongoose.models.Bookmark || mongoose.model("Bookmark", bookmarkSchema);
