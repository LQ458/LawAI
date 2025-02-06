import mongoose, { Schema, Document } from "mongoose";

export interface IRecord extends Document {
  title: string;
  link: string;
  description: string;
  date: string;
  content: string;
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
});

// 添加索引以优化查询性能
recordSchema.index({ title: "text", description: "text", content: "text" });

export const Record =
  mongoose.models.Record || mongoose.model<IRecord>("Record", recordSchema);
