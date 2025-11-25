import mongoose, { Schema, Model, Document } from "mongoose";

export interface IQueryLog extends Document {
  userId?: string;
  isGuest: boolean;
  timestamp: Date;
}

const queryLogSchema = new Schema<IQueryLog>({
  userId: { type: String },
  isGuest: { type: Boolean, required: true, default: false },
  timestamp: { type: Date, default: Date.now },
});

// Add index for timestamp to speed up range queries
queryLogSchema.index({ timestamp: 1 });

const QueryLog: Model<IQueryLog> = 
  mongoose.models.QueryLog || mongoose.model<IQueryLog>("QueryLog", queryLogSchema);

export default QueryLog;
