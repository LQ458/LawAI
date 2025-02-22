"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { ScrollTop } from "primereact/scrolltop";
import { Toast } from "primereact/toast";
import { useSession } from "next-auth/react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import CaseCard from "@/components/CaseCard";
import { IRecordWithUserState, RecommendationResponse } from "@/types";
import { ProgressSpinner } from "primereact/progressspinner";
import { Button } from "primereact/button";
import { useRouter } from "next/navigation";

export default function RecommendPage() {
  const { data: session, status } = useSession();
  const toast = useRef<Toast>(null);
  const [recommendations, setRecommendations] = useState<
    IRecordWithUserState[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const router = useRouter();

  // 获取推荐列表
  const fetchRecommendations = async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/recommend?page=${pageNum}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "获取推荐失败");
      }
      const data = await response.json();

      // 确保每个记录都有正确的用户状态字段
      const processedRecommendations = data.recommendations.map(
        (rec: RecommendationResponse) => ({
          ...rec,
          isLiked: rec.isLiked || false,
          isBookmarked: rec.isBookmarked || false,
          _id: rec.id || rec._id, // 确保_id字段存在
          tags: rec.tags || [], // 确保tags字段存在
          views: rec.views || 0,
          likes: rec.likes || 0,
          recommendScore: rec.recommendScore || 0,
          description: rec.description || "",
          lastUpdateTime: rec.lastUpdateTime || new Date(),
          createdAt: rec.createdAt || new Date(),
        }),
      ) as IRecordWithUserState[];

      console.log(data);

      if (pageNum === 1) {
        setRecommendations(processedRecommendations);
      } else {
        setRecommendations((prev) => [...prev, ...processedRecommendations]);
      }

      setHasMore(data.recommendations.length >= 20);
      setPage(pageNum);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "获取推荐失败";
      setError(errorMessage);
      toast.current?.show({
        severity: "error",
        summary: "错误",
        detail: errorMessage,
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // 处理点赞
  const handleLike = async (recordId: string) => {
    if (!session) {
      toast.current?.show({
        severity: "warn",
        summary: "提示",
        detail: "请先登录",
        life: 3000,
      });
      return;
    }

    try {
      const response = await fetch(`/api/cases/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordId }),
      });

      if (!response.ok) {
        throw new Error("点赞失败");
      }

      const data = await response.json();

      // 更新本地状态
      setRecommendations((prev) =>
        prev.map((rec) => {
          if (rec._id === recordId) {
            return {
              ...rec,
              likes: data.liked ? rec.likes + 1 : rec.likes - 1,
              isLiked: data.liked,
            } as IRecordWithUserState;
          }
          return rec;
        }),
      );

      toast.current?.show({
        severity: "success",
        summary: "成功",
        detail: data.liked ? "点赞成功" : "已取消点赞",
        life: 2000,
      });
    } catch (err) {
      console.error("Error liking case:", err);
      toast.current?.show({
        severity: "error",
        summary: "错误",
        detail: "点赞失败",
        life: 3000,
      });
    }
  };

  // 处理收藏
  const handleBookmark = async (recordId: string) => {
    if (!session) {
      toast.current?.show({
        severity: "warn",
        summary: "提示",
        detail: "请先登录",
        life: 3000,
      });
      return;
    }

    try {
      const response = await fetch(`/api/cases/bookmark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordId }),
      });

      if (!response.ok) {
        throw new Error("收藏失败");
      }

      const data = await response.json();

      // 更新本地状态
      setRecommendations((prev) =>
        prev.map((rec) => {
          if (rec._id === recordId) {
            return {
              ...rec,
              isBookmarked: data.bookmarked,
            } as IRecordWithUserState;
          }
          return rec;
        }),
      );

      toast.current?.show({
        severity: "success",
        summary: "成功",
        detail: data.bookmarked ? "收藏成功" : "已取消收藏",
        life: 2000,
      });
    } catch (err) {
      console.error("Error bookmarking case:", err);
      toast.current?.show({
        severity: "error",
        summary: "错误",
        detail: "收藏失败",
        life: 3000,
      });
    }
  };

  // 初始加载
  useEffect(() => {
    if (session) {
      fetchRecommendations(1);
    }
  }, [session]);

  // 加载更多数据
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchRecommendations(page + 1);
    }
  }, [loading, hasMore, page]);

  // 无限滚动
  const lastElementRef = useInfiniteScroll(loading, hasMore, loadMore);

  // 刷新数据
  const handleRefresh = () => {
    fetchRecommendations(1);
  };

  // 处理加载状态
  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <ProgressSpinner />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">请先登录</h2>
          <p className="text-gray-600 mb-6">登录后即可查看推荐案例</p>
          <Button
            label="返回首页"
            className="p-button-primary"
            onClick={() => (window.location.href = "/")}
          />
        </div>
      </div>
    );
  }

  if (error && !recommendations.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-red-500">加载失败</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button
            label="重试"
            className="p-button-primary"
            onClick={handleRefresh}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Toast ref={toast} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Button
              icon="pi pi-home"
              tooltip="返回首页"
              tooltipOptions={{ position: "bottom" }}
              className="p-button-text"
              onClick={() => router.push("/")}
            />
            <h1 className="text-2xl font-bold text-gray-800">推荐案例</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              icon="pi pi-file-edit"
              tooltip="案例总结"
              tooltipOptions={{ position: "bottom" }}
              className="p-button-text"
              onClick={() => router.push("/summary")}
            />
            <Button
              icon="pi pi-refresh"
              tooltip="刷新"
              tooltipOptions={{ position: "bottom" }}
              className="p-button-text"
              onClick={handleRefresh}
              disabled={loading}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 overflow-y-auto">
        {loading && recommendations.length === 0 ? (
          <div className="flex justify-center items-center min-h-[50vh]">
            <ProgressSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((record: IRecordWithUserState) => (
              <CaseCard
                key={record._id}
                record={record}
                onLike={() => handleLike(record._id)}
                onBookmark={() => handleBookmark(record._id)}
              />
            ))}
          </div>
        )}

        {/* 加载更多的触发器 */}
        <div
          ref={lastElementRef}
          className="h-20 flex justify-center items-center mt-4"
        >
          {loading && recommendations.length > 0 && (
            <ProgressSpinner style={{ width: "30px", height: "30px" }} />
          )}
          {!loading && !hasMore && recommendations.length > 0 && (
            <p className="text-gray-500">没有更多内容了</p>
          )}
        </div>
      </main>

      <ScrollTop className="hidden md:block" />
    </div>
  );
}
