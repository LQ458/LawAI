import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import DBconnect from "@/lib/mongodb";
import { UserActivity } from "@/models/userActivity";

export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await DBconnect();

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "7");
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalQueries, activeUsers, topUsers, recentActivity] =
      await Promise.all([
        UserActivity.countDocuments({
          action: { $in: ["query", "chat"] },
          timestamp: { $gte: since },
        }),
        UserActivity.distinct("userId", {
          timestamp: { $gte: since },
        }),
        UserActivity.aggregate([
          {
            $match: {
              timestamp: { $gte: since },
            },
          },
          {
            $group: {
              _id: "$userId",
              username: { $first: "$username" },
              totalActions: { $sum: 1 },
              queries: {
                $sum: {
                  $cond: [
                    { $in: ["$action", ["query", "chat"]] },
                    1,
                    0,
                  ],
                },
              },
              interactions: {
                $sum: {
                  $cond: [
                    { $in: ["$action", ["like", "bookmark", "view"]] },
                    1,
                    0,
                  ],
                },
              },
              logins: {
                $sum: {
                  $cond: [{ $eq: ["$action", "login"] }, 1, 0],
                },
              },
            },
          },
          {
            $addFields: {
              activityScore: {
                $add: [
                  { $multiply: ["$logins", 10] },
                  { $multiply: ["$queries", 5] },
                  { $multiply: ["$interactions", 1] },
                ],
              },
            },
          },
          { $sort: { activityScore: -1 as const } },
          { $limit: 20 },
        ]),
        UserActivity.find()
          .sort({ timestamp: -1 })
          .limit(50)
          .lean(),
      ]);

    return NextResponse.json({
      stats: {
        totalQueries,
        activeUsers: activeUsers.length,
        period: `${days} days`,
      },
      topUsers: topUsers.map((u) => ({
        userId: u._id,
        username: u.username,
        actions: u.totalActions,
        queries: u.queries,
        interactions: u.interactions,
        logins: u.logins,
        activityScore: u.activityScore,
      })),
      recentActivity: recentActivity.map((a) => ({
        userId: a.userId,
        username: a.username,
        action: a.action,
        timestamp: a.timestamp,
      })),
    });
  } catch (error) {
    console.error("Error fetching activity stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity stats" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await DBconnect();

    const { action, metadata } = await req.json();

    await UserActivity.create({
      userId: session.user.sub,
      username: session.user.name || session.user.email || "",
      action,
      timestamp: new Date(),
      metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging activity:", error);
    return NextResponse.json(
      { error: "Failed to log activity" },
      { status: 500 },
    );
  }
}
