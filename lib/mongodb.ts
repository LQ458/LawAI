import mongoose, { ConnectOptions } from "mongoose";

const MONGODB_OPTIONS: ConnectOptions = {
  bufferCommands: true,
  autoIndex: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 15000, // 增加服务器选择超时时间
  socketTimeoutMS: 45000,
  family: 4,
  connectTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
};

let isConnected = false;

// Connect to MongoDB
export default async function DBconnect(): Promise<void> {
  if (!process.env.MONGODB_URL) {
    console.error("MONGODB_URL is not defined");
    return;
  }

  try {
    if (mongoose.connection.readyState === 1) {
      console.log("Already connected to MongoDB");
      return;
    }

    const mongoUrl = process.env.MONGODB_URL;
    await mongoose.connect(mongoUrl, MONGODB_OPTIONS);

    mongoose.connection.on("connected", () => {
      console.log("MongoDB connected successfully");
      isConnected = true;
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
      isConnected = false;
      // 断开连接后尝试重连
      setTimeout(async () => {
        if (!isConnected) {
          console.log("Attempting to reconnect to MongoDB...");
          try {
            await mongoose.connect(mongoUrl, MONGODB_OPTIONS);
          } catch (error) {
            console.error("Reconnection failed:", error);
          }
        }
      }, 5000);
    });

    // 优雅关闭连接
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      process.exit(0);
    });

    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    isConnected = false;
    // 初始连接失败后尝试重连
    setTimeout(async () => {
      console.log("Retrying initial connection...");
      await DBconnect();
    }, 5000);
  }
}
