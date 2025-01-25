import mongoose, { Schema, Document } from "mongoose";

export interface ICase extends Document {
  title: string;
  link: string;
  description: string;
  content: string;
  summary: string;
  tags: string[];
  likes: number;
  bookmarks: number;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const caseSchema = new Schema<ICase>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    content: {
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
        trim: true,
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true, // 自动管理createdAt和updatedAt
  },
);

// 添加索引以优化查询性能
caseSchema.index({ title: "text", description: "text", content: "text" });
caseSchema.index({ createdAt: -1 });
caseSchema.index({ likes: -1 });
caseSchema.index({ bookmarks: -1 });
caseSchema.index({ tags: 1 });
caseSchema.index({ userId: 1 });

export const Record =
  mongoose.models.Record || mongoose.model<ICase>("Record", caseSchema);
