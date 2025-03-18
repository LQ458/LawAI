"use client";
import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";
import { ScrollTop } from "primereact/scrolltop";
import { Toast } from "primereact/toast";
import { useSession } from "next-auth/react";
import CaseCard from "@/components/CaseCard";
import { IRecordWithUserState, RecommendationResponse } from "@/types";
import { ProgressSpinner } from "primereact/progressspinner";
import { Button } from "primereact/button";
import { useRouter } from "next/navigation";
import { InputText } from "primereact/inputtext";
import { Paginator } from "primereact/paginator";
import Fuse from "fuse.js";
import { debounce } from "lodash";

// Fuse.js 配置
const fuseOptions = {
  keys: ["title", "description", "tags"],
  threshold: 0.3,
  distance: 100,
};

// 修改常量定义
const PAGE_SIZE = 20; // 每页固定20条记录

// 添加记忆化组件
const MemoizedCaseCard = memo(CaseCard);

export default function RecommendPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const toast = useRef<Toast>(null);
  const [recommendations, setRecommendations] = useState<
    IRecordWithUserState[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filteredRecords, setFilteredRecords] = useState<
    IRecordWithUserState[]
  >([]);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const fuseRef = useRef<Fuse<IRecordWithUserState> | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isError, setIsError] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  // 获取推荐列表
  const fetchRecommendations = useCallback(async (pageNum = 1) => {
    try {
      setPageLoading(true);
      setLoading(true);
      setIsError(false);
      const response = await fetch(
        `/api/recommend?page=${pageNum}&limit=${PAGE_SIZE}`,
        {
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error((await response.text()) || "获取推荐失败");
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.recommendations)) {
        throw new Error("数据格式错误");
      }

      const processedRecommendations = data.recommendations.map(
        (rec: RecommendationResponse) => ({
          ...rec,
          isLiked: rec.isLiked || false,
          isBookmarked: rec.isBookmarked || false,
          _id: rec.id || rec._id,
          tags: rec.tags || [],
          views: rec.views || 0,
          likes: rec.likes || 0,
          recommendScore: rec.recommendScore || 0,
          description: rec.description || "",
          date: rec.date,
          lastUpdateTime: rec.lastUpdateTime || new Date(),
          createdAt: rec.createdAt || new Date(),
        }),
      );

      setRecommendations((prev) =>
        pageNum === 1
          ? processedRecommendations
          : [...prev, ...processedRecommendations],
      );

      setFilteredRecords((prev) =>
        pageNum === 1
          ? processedRecommendations
          : [...prev, ...processedRecommendations],
      );

      setTotalRecords(data.totalRecords);

      // 更新 Fuse 实例
      fuseRef.current = new Fuse(
        pageNum === 1
          ? processedRecommendations
          : [...recommendations, ...processedRecommendations],
        fuseOptions,
      );
    } catch (err) {
      setIsError(true);
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
      setPageLoading(false);
    }
  }, []);

  // 修改点赞和收藏处理函数
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

      // 更新用户画像
      await fetch("/api/user-action", {
        method: "POST",
        body: JSON.stringify({
          action: "like",
          recordId,
        }),
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

  // 修改收藏处理函数
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

      // 更新用户画像
      await fetch("/api/user-action", {
        method: "POST",
        body: JSON.stringify({
          action: "bookmark",
          recordId,
        }),
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

  // 优化初始化加载
  useEffect(() => {
    let mounted = true;

    const initLoad = async () => {
      if (session?.user?.email && mounted) {
        await fetchRecommendations(1);
      } else if (status === "unauthenticated" && mounted) {
        setLoading(false);
      }
    };

    initLoad();

    return () => {
      mounted = false;
    };
  }, [session?.user?.email, status, fetchRecommendations]);

  // 添加防抖的搜索处理
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        if (!query.trim()) {
          setFilteredRecords(recommendations);
          return;
        }

        if (fuseRef.current) {
          const results = fuseRef.current.search(query);
          setFilteredRecords(results.map((result) => result.item));
          setFirst(0);
        }
      }, 300),
    [recommendations],
  );

  // 修改搜索效果
  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  // 修改分页变化处理函数
  const onPageChange = useCallback(
    (e: { first: number; rows: number; page?: number }) => {
      const pageNum = e.page ? e.page + 1 : Math.floor(e.first / e.rows) + 1;
      setFirst(e.first);
      setRows(e.rows);

      // 检查是否已经加载过该页数据
      const startIndex = (pageNum - 1) * rows;
      const hasPageData = recommendations.length > startIndex;

      if (!hasPageData && !loading && !pageLoading) {
        fetchRecommendations(pageNum);
      }
    },
    [fetchRecommendations, rows, recommendations.length, loading, pageLoading],
  );

  // 修改数据展示逻辑
  const displayedRecords = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredRecords.slice(first, first + rows);
    }
    return recommendations.slice(first, first + rows);
  }, [filteredRecords, recommendations, first, rows, searchQuery]);

  // 修改数据展示模板
  const itemTemplate = useCallback(
    (record: IRecordWithUserState) => {
      return (
        <MemoizedCaseCard
          key={record._id}
          record={record}
          onLike={() => handleLike(record._id)}
          onBookmark={() => handleBookmark(record._id)}
        />
      );
    },
    [handleLike, handleBookmark],
  );

  // 修改事件处理函数类型
  const handleRetry = () => {
    fetchRecommendations(1);
  };

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
            onClick={handleRetry}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Toast ref={toast} />

      {/* 调整header样式 */}
      <header className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-8">
          {" "}
          {/* 增加水平内边距 */}
          <div className="flex justify-between items-center h-[60px]">
            {" "}
            {/* 固定高度并居中对齐 */}
            <div className="flex items-center gap-4">
              {" "}
              {/* 增加间距 */}
              <Button
                icon="pi pi-home"
                tooltip="返回首页"
                tooltipOptions={{ position: "bottom" }}
                className="p-button-text p-button-rounded"
                onClick={() => router.push("/")}
              />
              <h1 className="text-xl font-semibold text-gray-800">推荐案例</h1>
            </div>
            <div className="flex items-center gap-3">
              {" "}
              {/* 调整按钮间距 */}
              <Button
                icon="pi pi-file-edit"
                tooltip="案例总结"
                tooltipOptions={{ position: "bottom" }}
                className="p-button-text p-button-rounded"
                onClick={() => router.push("/summary")}
              />
              <Button
                icon="pi pi-refresh"
                tooltip="刷新"
                tooltipOptions={{ position: "bottom" }}
                className="p-button-text p-button-rounded"
                onClick={handleRefresh}
                disabled={loading}
              />
            </div>
          </div>
        </div>
      </header>

      {/* 调整main容器样式 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-6">
          {" "}
          {/* 增加容器最大宽度和内边距 */}
          {/* 搜索框 */}
          <div className="mb-8 max-w-2xl mx-auto">
            {" "}
            {/* 增加下边距 */}
            <span className="p-input-icon-left w-full">
              <i
                className="pi pi-search text-gray-400"
                style={{ left: "1rem" }}
              />
              <InputText
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索案例..."
                className="w-full pl-12 rounded-lg shadow-sm border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </span>
          </div>
          {/* 修改加载状态显示 */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <ProgressSpinner
                style={{ width: "50px", height: "50px" }}
                strokeWidth="4"
                fill="var(--surface-ground)"
                animationDuration="1.5s"
              />
              <p className="mt-4 text-gray-600">加载中...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <i className="pi pi-exclamation-circle text-red-500 text-4xl mb-4" />
              <p className="text-gray-600">{error || "加载失败"}</p>
              <Button
                label="重试"
                className="p-button-primary mt-4"
                onClick={() => fetchRecommendations(1)}
              />
            </div>
          ) : displayedRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <i className="pi pi-search text-gray-400 text-4xl mb-4" />
              <p className="text-gray-600">暂无匹配的案例</p>
            </div>
          ) : (
            // 显示数据列表
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-8">
              {displayedRecords.map((record) => (
                <div key={record._id} className="col-span-1">
                  {itemTemplate(record)}
                </div>
              ))}
            </div>
          )}
          {/* 修改 Paginator 配置 */}
          {displayedRecords.length > 0 && (
            <div className="flex justify-center mt-8 mb-6">
              <Paginator
                first={first}
                rows={rows}
                totalRecords={totalRecords}
                onPageChange={onPageChange}
                template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink JumpToPageInput"
                className="bg-white shadow-sm rounded-lg p-2"
              />
            </div>
          )}
          {/* 在分页器旁添加加载指示器 */}
          {pageLoading && (
            <div className="flex justify-center items-center mt-4">
              <ProgressSpinner
                style={{ width: "30px", height: "30px" }}
                strokeWidth="4"
                fill="var(--surface-ground)"
                animationDuration="1.5s"
              />
            </div>
          )}
        </div>
      </main>

      <ScrollTop
        className="hidden md:block"
        icon="pi pi-arrow-up"
        style={{
          bottom: "2rem",
          right: "2rem",
          borderRadius: "50%",
        }}
      />
    </div>
  );
}
