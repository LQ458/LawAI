/* eslint-disable @typescript-eslint/no-unused-expressions */
import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";

const PAGE_SIZE = 12;

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

export function useCases() {
  const { user } = useUser();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [sortOption, setSortOption] = useState<SortOption>("latest");
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set<string>());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    new Set<string>(),
  );

  const operationQueue = useRef<
    Array<{ type: "like" | "bookmark"; id: string; action: boolean }>
  >([]);

  const saveToLocalStorage = useCallback(
    (type: "liked" | "bookmarked", ids: Set<string>) => {
      if (user?.sub) {
        try {
          localStorage.setItem(
            `${type}Ids_${user.sub}`,
            JSON.stringify(Array.from(ids)),
          );
        } catch (error) {
          console.error(`Error saving ${type} ids to localStorage:`, error);
        }
      }
    },
    [user?.sub],
  );

  useEffect(() => {
    let mounted = true;

    const restoreState = () => {
      if (user?.sub && mounted) {
        try {
          const storedLikedIds = localStorage.getItem(
            `likedIds_${user.sub}`,
          );
          const storedBookmarkedIds = localStorage.getItem(
            `bookmarkedIds_${user.sub}`,
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
  }, [user?.sub]);

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
        operationQueue.current.push(op);
      }
    }
  }, [saveToLocalStorage]);

  useEffect(() => {
    const intervalId = setInterval(syncServerState, 5000);
    return () => clearInterval(intervalId);
  }, [syncServerState]);

  const handleLike = useCallback(
    async (recordId: string) => {
      if (!user) {
        throw new Error("请先登录");
      }

      const isCurrentlyLiked = likedIds.has(recordId);
      const optimisticUpdate = !isCurrentlyLiked;

      try {
        setLikedIds((prev: Set<string>) => {
          const newIds: Set<string> = new Set(prev);
          optimisticUpdate ? newIds.add(recordId) : newIds.delete(recordId);
          saveToLocalStorage("liked", newIds);
          return newIds;
        });

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

        operationQueue.current.push({
          type: "like",
          id: recordId,
          action: optimisticUpdate,
        });

        return { liked: optimisticUpdate };
      } catch (error) {
        console.error("Like error:", error);
        setLikedIds((prev: Set<string>) => {
          const newIds: Set<string> = new Set(prev);
          isCurrentlyLiked ? newIds.add(recordId) : newIds.delete(recordId);
          saveToLocalStorage("liked", newIds);
          return newIds;
        });
        throw error;
      }
    },
    [user, likedIds, saveToLocalStorage],
  );

  const handleBookmark = useCallback(
    async (recordId: string) => {
      if (!user) {
        throw new Error("请先登录");
      }

      const isCurrentlyBookmarked = bookmarkedIds.has(recordId);
      const optimisticUpdate = !isCurrentlyBookmarked;

      try {
        setBookmarkedIds((prev: Set<string>) => {
          const newIds: Set<string> = new Set(prev);
          optimisticUpdate ? newIds.add(recordId) : newIds.delete(recordId);
          saveToLocalStorage("bookmarked", newIds);
          return newIds;
        });

        setCases((prev) =>
          prev.map((c) =>
            c._id === recordId ? { ...c, isBookmarked: optimisticUpdate } : c,
          ),
        );

        operationQueue.current.push({
          type: "bookmark",
          id: recordId,
          action: optimisticUpdate,
        });

        return { bookmarked: optimisticUpdate };
      } catch (error) {
        console.error("Bookmark error:", error);
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
    [user, bookmarkedIds, saveToLocalStorage],
  );

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

      if (user?.sub) {
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
  }, [page, sortOption, filterTags, user?.sub, saveToLocalStorage]);

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
