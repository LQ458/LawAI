import mongoose from "mongoose";

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
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}
