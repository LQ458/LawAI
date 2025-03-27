/* eslint-disable @typescript-eslint/no-unused-expressions */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

const PAGE_SIZE = 12;

// 明确定义类型
export interface Case {
  _id: string;
  title: string;
  description: string;
  tags: string[];
  isLiked: boolean;
  isBookmarked: boolean;
  views: number;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SortOption = "latest" | "popular" | "recommended";

/**
 * 案例状态管理Hook
 * @description
 * 管理案例列表、点赞、收藏等状态，实现：
 * 1. 本地状态持久化
 * 2. 服务器状态同步
 * 3. 乐观更新UI
 * 4. 错误处理和回滚
 */
export function useCases() {
  const { data: session } = useSession();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [sortOption, setSortOption] = useState<SortOption>("latest");
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // 状态缓存
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set<string>());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    new Set<string>(),
  );

  // 用于存储操作队列的ref
  const operationQueue = useRef<
    Array<{ type: "like" | "bookmark"; id: string; action: boolean }>
  >([]);

  /**
   * 保存状态到localStorage
   * 实现状态持久化，确保刷新后状态不丢失
   */
  const saveToLocalStorage = useCallback(
    (type: "liked" | "bookmarked", ids: Set<string>) => {
      if (session?.user?.email) {
        try {
          localStorage.setItem(
            `${type}Ids_${session.user.email}`,
            JSON.stringify(Array.from(ids)),
          );
        } catch (error) {
          console.error(`Error saving ${type} ids to localStorage:`, error);
        }
      }
    },
    [session?.user?.email],
  );

  /**
   * 从localStorage恢复状态
   * 确保用户登录后立即恢复之前的状态
   */
  useEffect(() => {
    let mounted = true;

    const restoreState = () => {
      if (session?.user?.email && mounted) {
        try {
          const storedLikedIds = localStorage.getItem(
            `likedIds_${session.user.email}`,
          );
          const storedBookmarkedIds = localStorage.getItem(
            `bookmarkedIds_${session.user.email}`,
          );

          if (storedLikedIds) {
            setLikedIds(new Set(JSON.parse(storedLikedIds)));
          }
          if (storedBookmarkedIds) {
            setBookmarkedIds(new Set(JSON.parse(storedBookmarkedIds)));
          }
        } catch (error) {
          console.error("Error restoring state from localStorage:", error);
        }
      }
    };

    restoreState();

    return () => {
      mounted = false;
    };
  }, [session?.user?.email]);

  /**
   * 同步服务器状态
   * 处理队列中的操作，确保状态同步
   */
  const syncServerState = useCallback(async () => {
    if (operationQueue.current.length === 0) return;

    const operations = [...operationQueue.current];
    operationQueue.current = [];

    for (const op of operations) {
      try {
        const endpoint = op.type === "like" ? "like" : "bookmark";
        const response = await fetch(`/api/cases/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordId: op.id }),
        });

        if (!response.ok) {
          throw new Error(`Failed to sync ${op.type} state`);
        }

        // 更新本地状态
        if (op.type === "like") {
          setLikedIds((prev) => {
            const newIds = new Set(prev);
            op.action ? newIds.add(op.id) : newIds.delete(op.id);
            saveToLocalStorage("liked", newIds);
            return newIds;
          });
        } else {
          setBookmarkedIds((prev) => {
            const newIds = new Set(prev);
            op.action ? newIds.add(op.id) : newIds.delete(op.id);
            saveToLocalStorage("bookmarked", newIds);
            return newIds;
          });
        }
      } catch (error) {
        console.error(`Error syncing ${op.type} state:`, error);
        // 将失败的操作重新加入队列
        operationQueue.current.push(op);
      }
    }
  }, [saveToLocalStorage]);

  // 定期同步状态
  useEffect(() => {
    const intervalId = setInterval(syncServerState, 5000);
    return () => clearInterval(intervalId);
  }, [syncServerState]);

  /**
   * 处理点赞操作
   * 实现乐观更新和错误回滚
   */
  const handleLike = useCallback(
    async (recordId: string) => {
      if (!session) {
        throw new Error("请先登录");
      }

      const isCurrentlyLiked = likedIds.has(recordId);
      const optimisticUpdate = !isCurrentlyLiked;

      try {
        // 乐观更新UI
        setLikedIds((prev: Set<string>) => {
          const newIds: Set<string> = new Set(prev);
          optimisticUpdate ? newIds.add(recordId) : newIds.delete(recordId);
          saveToLocalStorage("liked", newIds);
          return newIds;
        });

        // 更新案例列表
        setCases((prev) =>
          prev.map((c) =>
            c._id === recordId
              ? {
                  ...c,
                  isLiked: optimisticUpdate,
                  likes: c.likes + (optimisticUpdate ? 1 : -1),
                }
              : c,
          ),
        );

        // 添加到操作队列
        operationQueue.current.push({
          type: "like",
          id: recordId,
          action: optimisticUpdate,
        });

        return { liked: optimisticUpdate };
      } catch (error) {
        console.error("Like error:", error);
        // 错误回滚
        setLikedIds((prev: Set<string>) => {
          const newIds: Set<string> = new Set(prev);
          isCurrentlyLiked ? newIds.add(recordId) : newIds.delete(recordId);
          saveToLocalStorage("liked", newIds);
          return newIds;
        });
        throw error;
      }
    },
    [session, likedIds, saveToLocalStorage],
  );

  /**
   * 处理收藏操作
   * 实现乐观更新和错误回滚
   */
  const handleBookmark = useCallback(
    async (recordId: string) => {
      if (!session) {
        throw new Error("请先登录");
      }

      const isCurrentlyBookmarked = bookmarkedIds.has(recordId);
      const optimisticUpdate = !isCurrentlyBookmarked;

      try {
        // 乐观更新UI
        setBookmarkedIds((prev: Set<string>) => {
          const newIds: Set<string> = new Set(prev);
          optimisticUpdate ? newIds.add(recordId) : newIds.delete(recordId);
          saveToLocalStorage("bookmarked", newIds);
          return newIds;
        });

        // 更新案例列表
        setCases((prev) =>
          prev.map((c) =>
            c._id === recordId ? { ...c, isBookmarked: optimisticUpdate } : c,
          ),
        );

        // 添加到操作队列
        operationQueue.current.push({
          type: "bookmark",
          id: recordId,
          action: optimisticUpdate,
        });

        return { bookmarked: optimisticUpdate };
      } catch (error) {
        console.error("Bookmark error:", error);
        // 错误回滚
        setBookmarkedIds((prev: Set<string>) => {
          const newIds: Set<string> = new Set(prev);
          isCurrentlyBookmarked
            ? newIds.add(recordId)
            : newIds.delete(recordId);
          saveToLocalStorage("bookmarked", newIds);
          return newIds;
        });
        throw error;
      }
    },
    [session, bookmarkedIds, saveToLocalStorage],
  );

  /**
   * 获取案例列表
   * 同时更新本地状态缓存
   */
  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          pageSize: PAGE_SIZE,
          sort: sortOption,
          tags: filterTags,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch cases");
      }

      const data = await response.json();

      // 更新状态缓存
      if (session?.user?.email) {
        // 明确指定类型
        const newLikedIds: Set<string> = new Set(
          data.cases
            .filter((c: Case) => c.isLiked)
            .map((c: Case) => c._id.toString()),
        );

        const newBookmarkedIds: Set<string> = new Set(
          data.cases
            .filter((c: Case) => c.isBookmarked)
            .map((c: Case) => c._id.toString()),
        );

        setLikedIds((prev: Set<string>) => {
          const merged: Set<string> = new Set([...prev, ...newLikedIds]);
          saveToLocalStorage("liked", merged);
          return merged;
        });

        setBookmarkedIds((prev: Set<string>) => {
          const merged: Set<string> = new Set([...prev, ...newBookmarkedIds]);
          saveToLocalStorage("bookmarked", merged);
          return merged;
        });
      }

      setCases((prev) => [...prev, ...data.cases]);
      setHasMore(data.cases.length === PAGE_SIZE);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Unknown error occurred"),
      );
    } finally {
      setLoading(false);
    }
  }, [page, sortOption, filterTags, session?.user?.email, saveToLocalStorage]);

  // 重置列表
  useEffect(() => {
    let mounted = true;

    if (mounted) {
      setCases([]);
      setPage(1);
      setHasMore(true);
    }

    return () => {
      mounted = false;
    };
  }, [sortOption, filterTags]);

  // 加载数据
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (mounted) {
        await fetchCases();
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [fetchCases]);

  const loadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  return {
    cases,
    loading,
    error,
    hasMore,
    loadMore,
    sortOption,
    setSortOption,
    filterTags,
    setFilterTags,
    likedIds,
    bookmarkedIds,
    handleLike,
    handleBookmark,
  };
}
