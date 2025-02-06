import { NextRequest, NextResponse } from "next/server";
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

  // 使用 recentTags 计算相关性分数
  const records = await Record.find({
    tags: { $in: recentTags },
  }).limit(limit);

  // 计算标签匹配度作为相关性分数
  return records.map((record) => {
    const matchingTags = record.tags.filter((tag: string) =>
      recentTags.includes(tag),
    );
    const relevanceScore = matchingTags.length / recentTags.length;

    return {
      id: record._id.toString(),
      title: record.title,
      content: record.content,
      score: record.interactionScore * (1 + relevanceScore), // 结合互动分数和相关性
    };
  });
}

// 基于热度的召回
async function getPopularRecommendations(limit: number) {
  return await Record.find().sort({ interactionScore: -1 }).limit(limit);
}

// 基于最新更新的召回
async function getLatestRecommendations(limit: number) {
  return await Record.find().sort({ lastUpdateTime: -1 }).limit(limit);
}

interface RecommendationItem {
  id: string;
  title: string;
  content: string;
  score: number;
}

function rankRecommendations(
  items: RecommendationItem[],
): RecommendationItem[] {
  return items.sort((a, b) => b.score - a.score);
}

interface RecommendationParams {
  page: number;
  limit: number;
  userId?: string;
}

export async function GET(request: NextRequest) {
  try {
    await DBconnect();
    const session = await getServerSession();
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const recommendations = await getRecommendations({
      page,
      limit,
      userId: session?.user?.email || undefined,
    });

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("Error in recommendations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function getRecommendations(params: RecommendationParams) {
  const { page, limit, userId } = params;
  let recommendations = [];

  if (userId) {
    // 获取基于用户兴趣的推荐
    const contentBased = await getContentBasedRecommendations(userId, limit);
    recommendations.push(...contentBased);
  }

  // 如果推荐数量不足,补充热门内容
  if (recommendations.length < limit) {
    const popular = await getPopularRecommendations(
      limit - recommendations.length,
    );
    recommendations.push(...popular);
  }

  // 获取最新内容
  const latest = await getLatestRecommendations(limit);
  recommendations.push(...latest);

  // 对推荐结果进行排序和去重
  recommendations = rankRecommendations(recommendations);

  return {
    recommendations: recommendations.slice((page - 1) * limit, page * limit),
    hasMore: recommendations.length > page * limit,
  };
}
