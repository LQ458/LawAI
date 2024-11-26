import { MongoClient } from "mongodb"

if (!process.env.MONGODB_URL) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URL"')
}

const uri = process.env.MONGODB_URL
const options = {}

let client: MongoClient

if (process.env.NODE_ENV === "development") {
  const globalWithMongo = global as typeof globalThis & {
    mongodb: MongoClient
  }
  if (!globalWithMongo.mongodb) {
    client = new MongoClient(uri, options)
    globalWithMongo.mongodb = client
  }
  client = globalWithMongo.mongodb
} else {
  // 在生产环境中创建新的连接
  client = new MongoClient(uri, options)
}

export default client