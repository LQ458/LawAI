import { MongoClient, MongoClientOptions } from "mongodb";

if (!process.env.MONGODB_URL) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URL"');
}

const uri = process.env.MONGODB_URL;
const options: MongoClientOptions = {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 1,
  retryWrites: true,
  retryReads: true,
  // 放宽SSL验证以解决Codespace环境问题
  tlsInsecure: true,
};

let client: MongoClient;

if (process.env.NODE_ENV === "development") {
  const globalWithMongo = global as typeof globalThis & {
    mongodb: MongoClient;
  };
  if (!globalWithMongo.mongodb) {
    client = new MongoClient(uri, options);
    globalWithMongo.mongodb = client;
  }
  client = globalWithMongo.mongodb;
} else {
  // 在生产环境中创建新的连接
  client = new MongoClient(uri, options);
}

export default client;
