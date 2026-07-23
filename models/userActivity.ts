import mongoose, { Schema, Document } from "mongoose";

export type UserActivityAction =
  | "login"
  | "query"
  | "view"
  | "like"
  | "bookmark"
  | "chat";

export interface IUserActivityMetadata {
  recordId?: string;
  duration?: number;
  source?: "home" | "chat" | "case" | "recommendations";
}

export interface IUserActivity extends Document {
  userId: string;
  action: UserActivityAction;
  timestamp: Date;
  metadata?: IUserActivityMetadata;
}

const activityMetadataSchema = new Schema<IUserActivityMetadata>(
  {
    recordId: { type: String, match: /^[a-f\d]{24}$/i },
    duration: { type: Number, min: 0, max: 3_600 },
    source: {
      type: String,
      enum: ["home", "chat", "case", "recommendations"],
    },
  },
  { _id: false, strict: "throw" },
);

const userActivitySchema = new Schema<IUserActivity>(
  {
    userId: { type: String, required: true, index: true, select: false },
    action: {
      type: String,
      required: true,
      enum: ["login", "query", "view", "like", "bookmark", "chat"],
    },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: activityMetadataSchema, default: undefined },
  },
  { timestamps: true, strict: "throw" },
);

userActivitySchema.index({ userId: 1, action: 1 });
userActivitySchema.index({ timestamp: -1 });
userActivitySchema.index({ userId: 1, timestamp: -1 });

export const UserActivity =
  mongoose.models.UserActivity ||
  mongoose.model<IUserActivity>("UserActivity", userActivitySchema);
