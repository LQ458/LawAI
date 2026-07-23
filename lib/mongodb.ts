import mongoose, { ConnectOptions } from "mongoose";

const MONGODB_OPTIONS: ConnectOptions = {
  bufferCommands: false,
  autoIndex:
    process.env.NODE_ENV !== "production" ||
    process.env.MONGODB_AUTO_INDEX === "true",
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15_000,
  socketTimeoutMS: 45_000,
  family: 4,
  connectTimeoutMS: 10_000,
  retryWrites: true,
  retryReads: true,
};

let connectionPromise: Promise<typeof mongoose> | null = null;

/**
 * Connects once per server process. Schema/index migration is deliberately not
 * performed here: request handling must never drop or rebuild indexes.
 */
export default async function DBconnect(): Promise<void> {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    throw new Error("MongoDB is not configured");
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUrl, MONGODB_OPTIONS);
  }

  try {
    await connectionPromise;
  } catch {
    connectionPromise = null;
    throw new Error("MongoDB connection failed");
  }
}
