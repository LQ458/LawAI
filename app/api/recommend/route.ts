import { NextRequest, NextResponse } from "next/server";
import { Record, IRecord } from "@/models/record";
import DBconnect from "@/lib/mongodb";
import { Article } from "@/models/article";

// 推荐系统配置
const CONFIG = {
  CONTENT_TYPES: {
    RECORD: "record",
    ARTICLE: "article",
  },
  // 权重配置
  WEIGHTS: {
    VIEW: 1, // 浏览权重
    LIKE: 3, // 点赞权重
    BOOKMARK: 5, // 收藏权重
    DURATION: 0.1, // 停留时间权重(每秒)
    TAG_MATCH: 2, // 标签匹配权重
    CATEGORY_MATCH: 1.5, // 分类匹配权重
    TIME_DECAY: 0.8, // 时间衰减因子
  },
  // 推荐结果配置
  RESULTS: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 50,
    CANDIDATE_MULTIPLIER: 2, // 候选集大小倍数
  },
} as const;

/**
 * 计算内容与用户兴趣的相似度分数
 * @param record - 待评分的记录
 * @param userProfile - 用户画像
 * @returns 相似度分数
 */
// function calculateSimilarityScore(
//   record: IRecord,
//   userProfile: IUserProfile,
// ): number {
//   let score = 0;

//   // 计算标签匹配度
//   record.tags.forEach((tag) => {
//     score += (userProfile.tagWeights[tag] || 0) * CONFIG.WEIGHTS.TAG_MATCH;
//   });

//   // 计算分类匹配度
//   if (record.category) {
//     score +=
//       (userProfile.categoryWeights[record.category] || 0) *
//       CONFIG.WEIGHTS.CATEGORY_MATCH;
//   }

//   // 应用时间衰减
//   const daysSinceUpdate =
//     (Date.now() - new Date(record.lastUpdateTime).getTime()) /
//     (1000 * 60 * 60 * 24);
//   const timeDecay = Math.pow(CONFIG.WEIGHTS.TIME_DECAY, daysSinceUpdate);

//   // 结合交互分数
//   const interactionScore = record.interactionScore || 0;

//   // 最终分数 = (相似度 * 0.6 + 交互分数 * 0.4) * 时间衰减
//   return (score * 0.6 + interactionScore * 0.4) * timeDecay;
// }

/**
 * 获取个性化推荐
 * 基于用户画像和内容相似度计算推荐结果
 */
// async function getPersonalizedRecommendations(
//   userId: string,
//   limit: number,
// ): Promise<RecommendationItem[]> {
//   const userProfile = await UserProfile.findOne({ userId });

//   if (!userProfile) {
//     return getPopularRecommendations(limit);
//   }

//   // 获取候选集
//   const records = await Record.find({
//     tags: {
//       $in: Object.keys(userProfile.tagWeights).filter(
//         (tag) => userProfile.tagWeights[tag] > 0,
//       ),
//     },
//   }).limit(limit * CONFIG.RESULTS.CANDIDATE_MULTIPLIER);

//   // 计算推荐分数
//   const scoredRecords = records.map((record) => {
//     const similarityScore = calculateSimilarityScore(record, userProfile);
//     const interactionScore = record.interactionScore || 0;

//     return {
//       ...record.toObject(),
//       id: record._id.toString(),
//       score: similarityScore * 0.7 + interactionScore * 0.3,
//     };
//   });

//   // 排序并返回top N
//   return scoredRecords.sort((a, b) => b.score - a.score).slice(0, limit);
// }

/**
 * 获取热门推荐
 * 基于交互分数排序
 */
// async function getPopularRecommendations(
//   limit: number,
// ): Promise<RecommendationItem[]> {
//   const records = await Record.find()
//     .sort({ interactionScore: -1 })
//     .limit(limit);

//   return records.map((record) => ({
//     ...record.toObject(),
//     id: record._id.toString(),
//     score: record.interactionScore || 0,
//   }));
// }

/**
 * 获取最新推荐
 */
// async function getLatestRecommendations(
//   limit: number
// ): Promise<RecommendationItem[]> {
//   const records = await Record.find().sort({ lastUpdateTime: -1 }).limit(limit);

//   return records.map((record) => ({
//     ...record.toObject(),
//     id: record._id.toString(),
//     score: record.interactionScore || 0,
//   }));
// }

/**
 * 推荐API的GET处理函数
 */
export async function GET(req: NextRequest) {
  try {
    await DBconnect();

    const searchParams = req.nextUrl.searchParams;
    const contentType =
      searchParams.get("contentType") || CONFIG.CONTENT_TYPES.RECORD;

    // 根据contentType选择集合
    const Collection =
      contentType === CONFIG.CONTENT_TYPES.RECORD ? Record : Article;

    // 获取所有记录
    const recommendations = await Collection.find()
      .sort({ interactionScore: -1 })
      .select({
        _id: 1,
        title: 1,
        description: 1,
        tags: 1,
        category: 1,
        views: 1,
        likes: 1,
        lastUpdateTime: 1,
        interactionScore: 1,
        ...(contentType === CONFIG.CONTENT_TYPES.ARTICLE && {
          author: 1,
          publishDate: 1,
        }),
      });

    return NextResponse.json({
      recommendations,
      totalRecords: recommendations.length,
      hasMore: false,
      currentPage: 1,
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json(
      { error: "Failed to get recommendations" },
      { status: 500 },
    );
  }
}
