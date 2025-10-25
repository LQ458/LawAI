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
import { SelectButton, SelectButtonChangeEvent } from "primereact/selectbutton";
import { useGuest } from "@/hooks/useGuest";

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

// 修复 SelectButton context 类型
interface SelectButtonContext {
  selected: boolean;
}

export default function RecommendPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { guestId, guestProfile } = useGuest(); // 添加游客用户支持
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
  const [contentType, setContentType] = useState<"record" | "article">(
    "record",
  );

  // 添加初始化标记
  const isInitialLoadRef = useRef(true);

  // 添加缓存状态
  const [recordsCache, setRecordsCache] = useState<{
    record: IRecordWithUserState[];
    article: IRecordWithUserState[];
  }>({
    record: [],
    article: [],
  });

  // 获取推荐列表
  const fetchRecommendations = useCallback(
    async (type = contentType, forceRefresh = false) => {
      try {
        setPageLoading(true);
        setLoading(true);
        setIsError(false);

        // 检查缓存但不作为依赖项
        const currentCache = recordsCache;
        if (currentCache[type].length > 0 && !forceRefresh) {
          setRecommendations(currentCache[type]);
          setTotalRecords(currentCache[type].length);
          setPageLoading(false);
          setLoading(false);
          return;
        }

        // 使用 POST 请求并包含用户状态信息
        const requestBody: Record<string, unknown> = {
          contentType: type,
        };

        // 如果是游客用户，添加 guestProfile
        if (guestId && guestProfile) {
          requestBody.guestId = guestId;
          requestBody.guestProfile = guestProfile;
        }

        const response = await fetch(`/api/recommend`, {
          method: "POST",
          cache: forceRefresh ? "no-cache" : "force-cache",
          headers: {
            "Content-Type": "application/json",
            ...(guestId && { "x-guest-id": guestId }),
          },
          body: JSON.stringify(requestBody),
        });

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

        // 更新缓存
        setRecordsCache((prev) => ({
          ...prev,
          [type]: processedRecommendations,
        }));

        // 更新状态
        setRecommendations(processedRecommendations);
        setTotalRecords(processedRecommendations.length);

        // 更新 Fuse 实例
        fuseRef.current = new Fuse(processedRecommendations, fuseOptions);
      } catch (err) {
        setIsError(true);
        const errorMessage =
          err instanceof Error ? err.message : "获取推荐失败";
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
    },
    [contentType, recordsCache],
  );

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
      console.log("Attempting to like:", { recordId, contentType, session: !!session });
      
      const response = await fetch(`/api/cases/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          recordId, 
          contentType // 传递当前的contentType
        }),
      });

      console.log("Like response status:", response.status);
      
      const data = await response.json();
      console.log("Like response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "点赞失败");
      }

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

      // 同时更新缓存
      setRecordsCache((prevCache) => ({
        ...prevCache,
        [contentType]: prevCache[contentType].map((rec) => {
          if (rec._id === recordId) {
            return {
              ...rec,
              likes: data.liked ? rec.likes + 1 : rec.likes - 1,
              isLiked: data.liked,
            } as IRecordWithUserState;
          }
          return rec;
        }),
      }));

      // 更新过滤记录（如果用户正在搜索）
      if (searchQuery.trim()) {
        setFilteredRecords((prev) =>
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
      }

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
      console.log("Attempting to bookmark:", { recordId, contentType, session: !!session });
      
      const response = await fetch(`/api/cases/bookmark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          recordId, 
          contentType // 传递当前的contentType
        }),
      });

      console.log("Bookmark response status:", response.status);
      
      const data = await response.json();
      console.log("Bookmark response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "收藏失败");
      }

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

      // 同时更新缓存
      setRecordsCache((prevCache) => ({
        ...prevCache,
        [contentType]: prevCache[contentType].map((rec) => {
          if (rec._id === recordId) {
            return {
              ...rec,
              isBookmarked: data.bookmarked,
            } as IRecordWithUserState;
          }
          return rec;
        }),
      }));

      // 更新过滤记录（如果用户正在搜索）
      if (searchQuery.trim()) {
        setFilteredRecords((prev) =>
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
      }

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

  // 修改搜索处理函数
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        if (!query.trim()) {
          // 清空搜索时恢复原始记录
          setFilteredRecords(recommendations);
          setTotalRecords(recommendations.length);
          return;
        }

        if (fuseRef.current) {
          // 每次搜索都使用完整的数据集
          fuseRef.current = new Fuse(recommendations, fuseOptions);
          const results = fuseRef.current.search(query);
          const filteredResults = results.map((result) => result.item);
          setFilteredRecords(filteredResults);
          // 更新总记录数为搜索结果数量
          setTotalRecords(filteredResults.length);
          setFirst(0); // 重置到第一页
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
      const pageNum = (e.page || 0) + 1;
      const maxPage = Math.ceil(totalRecords / rows) || 1;

      // 检查页码是否超出范围
      if (pageNum > maxPage) {
        toast.current?.show({
          severity: "warn",
          summary: "页码超出范围",
          detail: `最大页码为 ${maxPage}，已为您跳转`,
          life: 3000,
        });

        // 跳转到最大页码
        const newFirst = (maxPage - 1) * rows;
        setFirst(newFirst);
        return;
      }

      setFirst(e.first);
      setRows(e.rows);
    },
    [totalRecords, rows, toast],
  );

  // 修改数据展示逻辑
  const displayedRecords = useMemo(() => {
    const records = searchQuery.trim() ? filteredRecords : recommendations;
    const start = first;
    const end = first + rows;

    return records
      .slice(start, end)
      .filter((record): record is IRecordWithUserState =>
        Boolean(record && record._id),
      );
  }, [filteredRecords, recommendations, first, rows, searchQuery]);

  // 修改事件处理函数类型
  const handleRetry = () => {
    // 清除缓存并重新获取
    setRecordsCache({ record: [], article: [] });
    fetchRecommendations(contentType, true);
  };

  const handleRefresh = () => {
    // 强制刷新，绕过缓存
    setRecordsCache({ record: [], article: [] });
    fetchRecommendations(contentType, true);
  };

  // 修改内容类型切换处理函数
  const onContentTypeChange = useCallback(
    (e: SelectButtonChangeEvent) => {
      if (e.value === contentType) return;

      setContentType(e.value);
      setFirst(0); // 重置分页
      // 清除缓存，强制刷新
      setRecordsCache({ record: [], article: [] });
      fetchRecommendations(e.value, true);
    },
    [contentType, fetchRecommendations],
  );

  // 修改初始化加载 - 允许未登录用户查看推荐，登录状态变化时重新加载
  useEffect(() => {
    if (isInitialLoadRef.current) {
      // 清除缓存，强制刷新获取最新数据（包括用户相关的点赞收藏状态）
      setRecordsCache({ record: [], article: [] });
      fetchRecommendations(contentType, true);
      isInitialLoadRef.current = false;
    } else if (status === "authenticated") {
      // 用户登录后，重新获取数据以包含用户状态
      setRecordsCache({ record: [], article: [] });
      fetchRecommendations(contentType, true);
    }
  }, [status, contentType, fetchRecommendations]);

  // 处理加载状态 - 移除session loading检查，直接加载内容
  // if (status === "loading") {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen">
  //       <ProgressSpinner />
  //     </div>
  //   );
  // }

  // 移除未登录用户的阻拦，允许访问推荐页面
  // if (status === "unauthenticated") {
  //   return (
  //     <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
  //       <div className="text-center p-8 bg-white rounded-lg shadow-md">
  //         <h2 className="text-2xl font-bold mb-4">请先登录</h2>
  //         <p className="text-gray-600 mb-6">登录后即可查看推荐案例</p>
  //         <Button
  //           label="返回首页"
  //           className="p-button-primary"
  //           onClick={() => (window.location.href = "/")}
  //         />
  //       </div>
  //     </div>
  //   );
  // }

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

  const contentTypeOptions = [
    { label: "案例推荐", value: "record" },
    { label: "文章推荐", value: "article" },
  ];

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
              <h1 className="text-xl font-semibold text-gray-800">
                {contentType === "record" ? "案例推荐" : "文章推荐"}
              </h1>
              <SelectButton
                value={contentType}
                onChange={onContentTypeChange}
                options={contentTypeOptions}
                className="ml-4"
                pt={{
                  button: ({ context }: { context: SelectButtonContext }) => ({
                    className: context.selected
                      ? "bg-primary text-white"
                      : "bg-surface-100 text-gray-700",
                  }),
                }}
              />
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
                onClick={() => fetchRecommendations()}
              />
            </div>
          ) : displayedRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <i className="pi pi-search text-gray-400 text-4xl mb-4" />
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  暂无匹配的{contentType === "record" ? "案例" : "文章"}
                </p>
                {searchQuery ? (
                  // 搜索无结果时的提示
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">建议您：</p>
                    <ul className="text-sm text-gray-500 list-disc list-inside mb-4">
                      <li>检查输入是否正确</li>
                      <li>尝试使用不同的关键词</li>
                      <li>使用更少的筛选条件</li>
                    </ul>
                    <div className="flex gap-3 justify-center">
                      <Button
                        label="清除搜索"
                        icon="pi pi-times"
                        className="p-button-outlined p-button-secondary"
                        onClick={() => setSearchQuery("")}
                      />
                      <Button
                        label="返回推荐列表"
                        icon="pi pi-list"
                        className="p-button-primary"
                        onClick={() => {
                          setSearchQuery("");
                          setRecordsCache({ record: [], article: [] });
                          fetchRecommendations(contentType, true);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  // 初始加载无数据时的提示
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                      当前{contentType === "record" ? "案例" : "文章"}
                      分类暂无内容
                    </p>
                    <div className="flex flex-col gap-3 items-center">
                      <Button
                        label={
                          contentType === "record"
                            ? "查看文章推荐"
                            : "返回案例推荐"
                        }
                        icon={
                          contentType === "record"
                            ? "pi pi-file"
                            : "pi pi-arrow-left"
                        }
                        className="p-button-outlined p-button-secondary w-full max-w-xs"
                        onClick={() => {
                          const newType =
                            contentType === "record" ? "article" : "record";
                          setContentType(newType);
                          // 清除缓存，强制刷新
                          setRecordsCache({ record: [], article: [] });
                          fetchRecommendations(newType, true);
                        }}
                      />
                      <Button
                        label="刷新当前列表"
                        icon="pi pi-refresh"
                        className="p-button-primary w-full max-w-xs"
                        onClick={() => {
                          setRecordsCache({ record: [], article: [] });
                          fetchRecommendations(contentType, true);
                        }}
                      />
                      <Button
                        label="返回默认推荐"
                        icon="pi pi-list"
                        className="p-button-text w-full max-w-xs"
                        onClick={() => {
                          setSearchQuery("");
                          setContentType("record");
                          setRecordsCache({ record: [], article: [] });
                          fetchRecommendations("record", true);
                        }}
                      />
                    </div>
                    {contentType === "article" && (
                      <p className="text-sm text-gray-500 mt-4">
                        暂无推荐文章，您可以返回查看案例推荐
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // 数据列表显示部分
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-8">
              {displayedRecords.map((record) => (
                <div key={record._id} className="flex w-full">
                  <MemoizedCaseCard
                    record={record}
                    onLike={() => handleLike(record._id)}
                    onBookmark={() => handleBookmark(record._id)}
                  />
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
                alwaysShow={true}
                pageLinkSize={5}
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
