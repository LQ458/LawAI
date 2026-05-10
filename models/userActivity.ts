import mongoose, { Schema, Document } from "mongoose";

export interface IUserActivity extends Document {
  userId: string;
  username: string;
  action: "login" | "query" | "view" | "like" | "bookmark" | "chat";
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const userActivitySchema = new Schema<IUserActivity>(
  {
    userId: { type: String, required: true, index: true },
    username: { type: String, default: "" },
    action: {
      type: String,
      required: true,
      enum: ["login", "query", "view", "like", "bookmark", "chat"],
    },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

userActivitySchema.index({ userId: 1, action: 1 });
userActivitySchema.index({ timestamp: -1 });
userActivitySchema.index({ userId: 1, timestamp: -1 });

export const UserActivity =
  mongoose.models.UserActivity ||
  mongoose.model<IUserActivity>("UserActivity", userActivitySchema);
