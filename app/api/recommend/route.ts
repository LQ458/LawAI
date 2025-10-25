import { NextRequest, NextResponse } from "next/server";
import { Record } from "@/models/record";
import DBconnect from "@/lib/mongodb";
import { Article } from "@/models/article";
import { Like } from "@/models/like";
import { Bookmark } from "@/models/bookmark";
import mongoose from "mongoose";
import { getUserIdentityFromBody } from "@/lib/authUtils";

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
 * 推荐API的POST处理函数 - 支持已登录和未登录用户
 */
export async function POST(req: NextRequest) {
  try {
    await DBconnect();

    const body = await req.json();
    const { contentType = "record", guestProfile } = body;
    
    // 获取用户身份 (已登录或未登录)
    const identity = await getUserIdentityFromBody(req, body, true);
    
    console.log(`👤 Recommend request from ${identity ? (identity.isGuest ? 'guest' : 'user') : 'anonymous'}`);

    // 根据contentType选择集合
    const Collection = contentType === "record" ? Record : Article;

    // 查询推荐数据
    const recommendations = await Collection.find()
      .sort({ interactionScore: -1 })
      .limit(100) // 限制最多返回100条，避免过载
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
        ...(contentType === "article" && {
          author: 1,
          publishDate: 1,
        }),
      })
      .lean();

    // 添加用户状态 (isLiked, isBookmarked)
    if (identity && !identity.isGuest) {
      // 已登录用户 - 从数据库获取状态
      const recordIds = recommendations
        .map((r: any) => r._id?.toString())
        .filter((id): id is string => id !== undefined && mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (recordIds.length > 0) {
        const [likes, bookmarks] = await Promise.all([
          Like.find({
            userId: identity.userId,
            recordId: { $in: recordIds },
          }).lean(),
          Bookmark.find({
            userId: identity.userId,
            recordId: { $in: recordIds },
          }).lean(),
        ]);

        const likedRecordIds = new Set(likes.map((l) => l.recordId.toString()));
        const bookmarkedRecordIds = new Set(bookmarks.map((b) => b.recordId.toString()));

        recommendations.forEach((r: any) => {
          const id = r._id?.toString();
          if (id) {
            r.isLiked = likedRecordIds.has(id);
            r.isBookmarked = bookmarkedRecordIds.has(id);
          }
        });
      }
    } else if (identity && identity.isGuest && guestProfile) {
      // 未登录用户 - 从前端传来的guestProfile获取状态
      const likedSet = new Set(guestProfile.likedRecords || []);
      const bookmarkedSet = new Set(guestProfile.bookmarkedRecords || []);

      recommendations.forEach((r: any) => {
        const id = r._id?.toString();
        if (id) {
          r.isLiked = likedSet.has(id);
          r.isBookmarked = bookmarkedSet.has(id);
        }
      });
    } else {
      // 完全未认证的访客 - 默认状态为false
      recommendations.forEach((r: any) => {
        r.isLiked = false;
        r.isBookmarked = false;
      });
    }

    console.log(`✅ Returned ${recommendations.length} recommendations`);

    return NextResponse.json({
      recommendations,
      totalRecords: recommendations.length,
      hasMore: false,
      currentPage: 1,
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    
    // 提供更详细的错误信息
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { 
        error: "Failed to get recommendations",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 },
    );
  }
}

/**
 * 保留 GET 方法以支持旧的请求方式 (向后兼容)
 */
export async function GET(req: NextRequest) {
  try {
    await DBconnect();

    const searchParams = req.nextUrl.searchParams;
    const contentType = searchParams.get("contentType") || "record";

    // 根据contentType选择集合
    const Collection = contentType === "record" ? Record : Article;

    // 简化查询 - 限制返回数量但不使用复杂的分页
    const recommendations = await Collection.find()
      .sort({ interactionScore: -1 })
      .limit(100) // 限制最多返回100条，避免过载
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
        ...(contentType === "article" && {
          author: 1,
          publishDate: 1,
        }),
      })
      .lean();

    // GET 请求默认所有状态为 false
    recommendations.forEach((r: any) => {
      r.isLiked = false;
      r.isBookmarked = false;
    });

    return NextResponse.json({
      recommendations,
      totalRecords: recommendations.length,
      hasMore: false,
      currentPage: 1,
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    
    // 提供更详细的错误信息
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { 
        error: "Failed to get recommendations",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 },
    );
  }
}
