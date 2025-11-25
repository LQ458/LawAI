// API endpoint to get the count of user queries from the past week
import { NextResponse } from "next/server";
import DBconnect from "@/lib/mongodb";
import ChatModel from "@/models/chat";
import QueryLog from "@/models/queryLog";

export async function GET() {
  try {
    await DBconnect();

    // Calculate the start of the current week (Monday)
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) to 6 (Sat)
    // Calculate difference to get to Monday
    // If Sunday (0), subtract 6 days. If Monday (1), subtract 0 days. etc.
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // 1. Count from QueryLog (New system, includes guests)
    const logCount = await QueryLog.countDocuments({
      timestamp: { $gte: startOfWeek }
    });

    // 2. Count from ChatModel (Legacy system & authenticated users before migration)
    // To avoid double counting, we could try to filter out recent chats if we assume QueryLog is active now.
    // However, since QueryLog is new, any count from ChatModel that is recent is likely NOT in QueryLog yet (unless just added).
    // But wait, we just added QueryLog. So any NEW query will be in QueryLog.
    // Any OLD query (from earlier this week) will ONLY be in ChatModel.
    // So we should count:
    // - All QueryLogs (since they are all new)
    // - All Chat messages from startOfWeek UNTIL the time we deployed QueryLog (approx now).
    // But "now" is hard to pin down in code.
    
    // Simplification: 
    // Since the user said "it shows 0", it implies there are NO queries this week in ChatModel yet (or very few).
    // So we can just sum them up, but that risks double counting if we deploy and then query.
    // If I query now, it goes to QueryLog AND ChatModel (if authenticated).
    // If I am guest, it goes ONLY to QueryLog.
    
    // To prevent double counting for authenticated users:
    // We can just use QueryLog for everything going forward.
    // But we need to include the "0" (or whatever small number) from earlier this week from ChatModel.
    // Let's assume the deployment time is roughly "now".
    // But actually, the cleanest way is:
    // If we have QueryLogs, use them.
    // But we also want historical data from this week.
    
    // Let's do a distinct count or just accept a small overlap during transition.
    // Or, we can query ChatModel for messages < specific_timestamp (deployment time).
    // But I don't want to hardcode a timestamp.
    
    // Alternative:
    // Just count QueryLog. The user said it was 0 anyway. So starting fresh is fine.
    // But if the user HAD some data, they would lose it.
    
    // Let's try to be smart.
    // If we are authenticated, we write to ChatModel AND QueryLog.
    // If we are guest, we write to QueryLog only.
    
    // So QueryLog contains ALL queries made after this deployment.
    // ChatModel contains ALL authenticated queries (past and future).
    
    // We want: (Authenticated Old) + (All New).
    // All New = QueryLog.
    // Authenticated Old = ChatModel where timestamp < First_QueryLog_Timestamp.
    
    const firstLog = await QueryLog.findOne().sort({ timestamp: 1 });
    let legacyCount = 0;
    
    if (firstLog) {
      // Count chats before the first log entry
      const chats = await ChatModel.find({
        "messages.timestamp": { 
          $gte: startOfWeek,
          $lt: firstLog.timestamp 
        },
      }).select("messages");
      
      chats.forEach((chat) => {
        chat.messages.forEach((message) => {
          if (
            message.role === "user" &&
            message.timestamp &&
            new Date(message.timestamp) >= startOfWeek &&
            new Date(message.timestamp) < firstLog.timestamp
          ) {
            legacyCount++;
          }
        });
      });
    } else {
      // No logs yet, count everything from ChatModel
      const chats = await ChatModel.find({
        "messages.timestamp": { $gte: startOfWeek },
      }).select("messages");
      
      chats.forEach((chat) => {
        chat.messages.forEach((message) => {
          if (
            message.role === "user" &&
            message.timestamp &&
            new Date(message.timestamp) >= startOfWeek
          ) {
            legacyCount++;
          }
        });
      });
    }

    const totalCount = logCount + legacyCount;

    return NextResponse.json({ count: totalCount });
  } catch (error) {
    console.error("Error fetching weekly query count:", error);
    return NextResponse.json(
      { error: "Failed to fetch query statistics" },
      { status: 500 }
    );
  }
}
