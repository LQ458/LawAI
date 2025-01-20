import mongoose, { Schema, Document } from "mongoose";

export interface IBookmark extends Document {
  userId: mongoose.Types.ObjectId;
  caseId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const bookmarkSchema = new Schema<IBookmark>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    caseId: {
      type: Schema.Types.ObjectId,
      ref: "Case",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// 确保用户只能收藏一个案例一次
bookmarkSchema.index({ userId: 1, caseId: 1 }, { unique: true });

export const Bookmark =
  mongoose.models.Bookmark ||
  mongoose.model<IBookmark>("Bookmark", bookmarkSchema);
