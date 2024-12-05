import { useState, useEffect, useCallback } from "react";
import { Case, SortOption } from "@/types";

const PAGE_SIZE = 12;

export function useCases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [sortOption, setSortOption] = useState<SortOption>("latest");
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      setCases((prev) => [...prev, ...data.cases]);
      setHasMore(data.cases.length === PAGE_SIZE);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [page, sortOption, filterTags]);

  useEffect(() => {
    setCases([]);
    setPage(1);
    setHasMore(true);
  }, [sortOption, filterTags]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases, page]);

  const loadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  return {
    cases,
    loading,
    error,
    hasMore,
    sortOption,
    setSortOption,
    filterTags,
    setFilterTags,
    loadMore,
  };
}
