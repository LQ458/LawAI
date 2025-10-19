import mongoose, { ConnectOptions } from "mongoose";

const MONGODB_OPTIONS: ConnectOptions = {
  bufferCommands: false, // 禁用缓冲以避免超时
  autoIndex: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
  // 添加更稳定的连接选项
  heartbeatFrequencyMS: 30000,
  maxIdleTimeMS: 30000,
};

let isConnected = false;

async function checkAndFixIndexes() {
  try {
    // 检查数据库连接状态
    if (!mongoose.connection.db) {
      console.log("数据库未连接，跳过索引检查");
      return;
    }

    const db = mongoose.connection.db;
    
    // 检查并修复Like集合的索引（如果存在）
    try {
      const likeCollections = await db.listCollections({ name: "likes" }).toArray();
      if (likeCollections.length > 0) {
        const likeCollection = mongoose.connection.collection("likes");
        const likeIndexes = await likeCollection.listIndexes().toArray();
        for (const index of likeIndexes) {
          if (index.name !== "_id_" && index.name !== "userId_recordId_unique") {
            await likeCollection.dropIndex(index.name);
          }
        }
      }
    } catch {
      console.log("Like集合不存在或索引检查失败，将在首次使用时创建");
    }

    // 检查并修复Bookmark集合的索引（如果存在）
    try {
      const bookmarkCollections = await db.listCollections({ name: "bookmarks" }).toArray();
      if (bookmarkCollections.length > 0) {
        const bookmarkCollection = mongoose.connection.collection("bookmarks");
        const bookmarkIndexes = await bookmarkCollection.listIndexes().toArray();
        for (const index of bookmarkIndexes) {
          if (index.name !== "_id_" && index.name !== "userId_recordId_unique") {
            await bookmarkCollection.dropIndex(index.name);
          }
        }
      }
    } catch {
      console.log("Bookmark集合不存在或索引检查失败，将在首次使用时创建");
    }
    
  } catch (error) {
    console.error("Error fixing indexes:", error);
  }
}

// Connect to MongoDB
export default async function DBconnect(): Promise<void> {
  if (!process.env.MONGODB_URL) {
    console.error("MONGODB_URL is not defined");
    return;
  }

  try {
    if (mongoose.connection.readyState >= 1) return;

    const mongoUrl = process.env.MONGODB_URL;
    await mongoose.connect(mongoUrl, MONGODB_OPTIONS);
    await checkAndFixIndexes();

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

    // 重建索引以确保索引定义是最新的
    if (process.env.NODE_ENV === "development") {
      const collections = await mongoose?.connection?.db?.collections();
      if (collections) {
        for (const collection of collections) {
          await collection.dropIndexes().catch(() => {}); // 忽略错误
          if (collection.collectionName === "records") {
            await collection.createIndex({ category: 1 });
          }
        }
      }
    }
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
