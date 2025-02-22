import { NextRequest, NextResponse } from "next/server";
import { Record } from "@/models/record";
import { Like } from "@/models/like";
import { Bookmark } from "@/models/bookmark";
import DBconnect from "@/lib/mongodb";
import { getToken } from "next-auth/jwt";

const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

/**
 * 获取用户最近浏览的标签
 * @param userId 用户ID(email)
 * @returns 用户最近浏览的标签数组
 */
async function getUserRecentTags(userId: string) {
  const records = await Record.find({
    "views.userId": userId,
  })
    .sort({ "views.timestamp": -1 })
    .limit(10)
    .select("tags");

  return [...new Set(records.flatMap((r) => r.tags))];
}

/**
 * 基于内容相似度的推荐
 * 根据用户最近浏览的标签计算相关性分数
 * @param userId 用户ID(email)
 * @param limit 返回结果数量限制
 */
async function getContentBasedRecommendations(userId: string, limit: number) {
  const recentTags = await getUserRecentTags(userId);

  // 使用标签匹配查找相关案例
  const records = await Record.find({
    tags: { $in: recentTags },
  }).limit(limit);

  // 计算相关性分数：标签匹配度 + 交互分数
  return records.map((record) => {
    const matchingTags = record.tags.filter((tag: string) =>
      recentTags.includes(tag),
    );
    const relevanceScore = matchingTags.length / recentTags.length;

    return {
      id: record._id.toString(),
      title: record.title,
      description: record.description,
      content: record.content,
      tags: record.tags || [],
      views: record.views || 0,
      likes: record.likes || 0,
      recommendScore: record.recommendScore || 0,
      lastUpdateTime: record.lastUpdateTime || new Date(),
      createdAt: record.createdAt || new Date(),
      score: record.interactionScore * (1 + relevanceScore),
    };
  });
}

/**
 * 获取热门案例推荐
 * 基于案例的交互分数排序
 * @param limit 返回结果数量限制
 */
async function getPopularRecommendations(limit: number) {
  const records = await Record.find()
    .sort({ interactionScore: -1 })
    .limit(limit);
  return records.map((record) => ({
    id: record._id.toString(),
    title: record.title,
    description: record.description,
    content: record.content,
    tags: record.tags || [],
    views: record.views || 0,
    likes: record.likes || 0,
    recommendScore: record.recommendScore || 0,
    lastUpdateTime: record.lastUpdateTime || new Date(),
    createdAt: record.createdAt || new Date(),
    score: record.interactionScore || 0,
    isLiked: false,
    isBookmarked: false,
  }));
}

/**
 * 获取最新更新的案例
 * @param limit 返回结果数量限制
 */
async function getLatestRecommendations(limit: number) {
  const records = await Record.find().sort({ lastUpdateTime: -1 }).limit(limit);
  return records.map((record) => ({
    id: record._id.toString(),
    title: record.title,
    description: record.description,
    content: record.content,
    tags: record.tags || [],
    views: record.views || 0,
    likes: record.likes || 0,
    recommendScore: record.recommendScore || 0,
    lastUpdateTime: record.lastUpdateTime || new Date(),
    createdAt: record.createdAt || new Date(),
    score: record.interactionScore || 0,
    isLiked: false,
    isBookmarked: false,
  }));
}

interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  views: number;
  likes: number;
  recommendScore: number;
  lastUpdateTime: string | Date;
  createdAt: string | Date;
  score: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

/**
 * 对推荐结果进行排序
 * 根据综合得分降序排序
 */
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

/**
 * 获取推荐结果的主函数
 * 整合多种推荐策略的结果：
 * 1. 基于用户兴趣的个性化推荐
 * 2. 热门内容推荐
 * 3. 最新内容推荐
 */
async function getRecommendations(params: RecommendationParams) {
  const { page, limit, userId } = params;
  let recommendations = [];

  // 登录用户获取个性化推荐
  if (userId) {
    const contentBased = await getContentBasedRecommendations(userId, limit);
    recommendations.push(...contentBased);
  }

  // 补充热门内容
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

  // 获取分页后的结果
  let paginatedResults = recommendations.slice(
    (page - 1) * limit,
    page * limit,
  );

  // 如果用户已登录,获取点赞和收藏状态
  if (userId) {
    const recordIds = paginatedResults.map((r) => r.id);

    // 获取用户的点赞记录
    const userLikes = await Like.find({
      userId,
      recordId: { $in: recordIds },
    }).select("recordId");

    // 获取用户的收藏记录
    const userBookmarks = await Bookmark.find({
      userId,
      recordId: { $in: recordIds },
    }).select("recordId");

    // 将用户状态添加到结果中
    const likedIds = new Set(userLikes.map((like) => like.recordId.toString()));
    const bookmarkedIds = new Set(
      userBookmarks.map((bookmark) => bookmark.recordId.toString()),
    );

    // 修改这里: 使用Object.assign确保属性可枚举,并格式化日期
    paginatedResults = paginatedResults.map((record) =>
      Object.assign({}, record, {
        isLiked: likedIds.has(record.id),
        isBookmarked: bookmarkedIds.has(record.id),
        lastUpdateTime: record.lastUpdateTime
          ? new Date(record.lastUpdateTime).toISOString()
          : new Date().toISOString(),
        createdAt: record.createdAt
          ? new Date(record.createdAt).toISOString()
          : new Date().toISOString(),
      }),
    );
  }

  return {
    recommendations: paginatedResults,
    hasMore: recommendations.length > page * limit,
  };
}

/**
 * 推荐API的GET处理函数
 * 根据用户登录状态返回个性化或通用推荐
 */
export async function GET(request: NextRequest) {
  try {
    await DBconnect();
    const token = await getToken({
      req: request,
      cookieName,
      secret: process?.env?.NEXTAUTH_SECRET,
    });
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const recommendations = await getRecommendations({
      page,
      limit,
      userId: token?.email || undefined,
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
