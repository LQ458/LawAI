import { NextResponse } from "next/server";
import { Record } from "@/models/record";
import DBconnect from "@/lib/mongodb";
import { getServerSession } from "next-auth/next";

// 获取用户最近浏览的标签
async function getUserRecentTags(userId: string) {
  const records = await Record.find({
    "views.userId": userId,
  })
    .sort({ "views.timestamp": -1 })
    .limit(10)
    .select("tags");

  return [...new Set(records.flatMap((r) => r.tags))];
}

// 基于内容相似度的召回
async function getContentBasedRecommendations(userId: string, limit: number) {
  const recentTags = await getUserRecentTags(userId);

  return await Record.find({
    tags: { $in: recentTags },
  })
    .sort({ interactionScore: -1 })
    .limit(limit);
}

// 基于热度的召回
async function getPopularRecommendations(limit: number) {
  return await Record.find().sort({ interactionScore: -1 }).limit(limit);
}

// 基于最新更新的召回
async function getLatestRecommendations(limit: number) {
  return await Record.find().sort({ lastUpdateTime: -1 }).limit(limit);
}

// 对推荐结果进行排序
function rankRecommendations(recommendations: any[], userTags: string[]) {
  return recommendations
    .map((rec) => {
      // 计算标签匹配度
      const tagMatchScore =
        rec.tags.filter((tag: string) => userTags.includes(tag)).length /
        userTags.length;

      // 计算时间衰减因子
      const timeDecay = Math.exp(
        -(Date.now() - new Date(rec.lastUpdateTime).getTime()) /
          (1000 * 60 * 60 * 24 * 7),
      );

      // 最终排序分数
      const finalScore =
        rec.interactionScore * 0.4 + tagMatchScore * 0.4 + timeDecay * 0.2;

      return {
        ...rec.toObject(),
        recommendScore: finalScore,
      };
    })
    .sort((a, b) => b.recommendScore - a.recommendScore);
}

export async function GET(req: Request) {
  try {
    await DBconnect();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = session.user.email;

    // 多路召回
    const [contentBased, popular, latest] = await Promise.all([
      getContentBasedRecommendations(userId, 10),
      getPopularRecommendations(10),
      getLatestRecommendations(5),
    ]);

    // 合并去重
    const mergedRecommendations = [
      ...new Map(
        [...contentBased, ...popular, ...latest].map((item) => [
          item._id.toString(),
          item,
        ]),
      ).values(),
    ];

    // 获取用户标签兴趣
    const userTags = await getUserRecentTags(userId);

    // 排序
    const rankedRecommendations = rankRecommendations(
      mergedRecommendations,
      userTags,
    );

    return NextResponse.json({
      recommendations: rankedRecommendations.slice(0, 20), // 返回前20条推荐
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json({ error: "获取推荐失败" }, { status: 500 });
  }
}
