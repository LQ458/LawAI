import mongoose, { Schema, Document } from "mongoose";

export interface ILike extends Document {
  userId: mongoose.Types.ObjectId;
  caseId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const likeSchema = new Schema<ILike>(
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

// 确保用户只能给一个案例点赞一次
likeSchema.index({ userId: 1, caseId: 1 }, { unique: true });

export const Like =
  mongoose.models.Like || mongoose.model<ILike>("Like", likeSchema);
