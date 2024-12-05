"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { ScrollTop } from "primereact/scrolltop";
import { Toast } from "primereact/toast";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";
import { useSession } from "next-auth/react";
import { useCases } from "@/hooks/useCases";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { CaseCard } from "@/components/CaseCard";
import { CaseFilter } from "@/components/CaseFilter";
import { Case, SortOption } from "@/types";

export default function Recommend() {
  const { data: session } = useSession();
  const toast = useRef<Toast>(null);

  const {
    cases,
    loading,
    error,
    hasMore,
    sortOption,
    setSortOption,
    filterTags,
    setFilterTags,
    loadMore,
  } = useCases();

  const lastElementRef = useInfiniteScroll(loading, hasMore, loadMore);

  if (error) {
    toast.current?.show({
      severity: "error",
      summary: "错误",
      detail: "加载案例失败",
      life: 3000,
    });
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Toast ref={toast} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">推荐案例</h1>
          <CaseFilter
            sortOption={sortOption}
            onSortChange={setSortOption}
            filterTags={filterTags}
            onFilterChange={setFilterTags}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((caseItem: Case, index: number) => {
            if (cases.length === index + 1) {
              return (
                <div ref={lastElementRef} key={caseItem.id}>
                  <CaseCard
                    caseData={caseItem}
                    onLike={() => {}}
                    onBookmark={() => {}}
                    isAuthenticated={!!session}
                  />
                </div>
              );
            }
            return (
              <CaseCard
                key={caseItem.id}
                caseData={caseItem}
                onLike={() => {}}
                onBookmark={() => {}}
                isAuthenticated={!!session}
              />
            );
          })}

          {/* Loading Skeletons */}
          {loading && (
            <>
              <Skeleton className="h-[300px] rounded-lg" />
              <Skeleton className="h-[300px] rounded-lg" />
              <Skeleton className="h-[300px] rounded-lg" />
            </>
          )}
        </div>
      </main>

      <ScrollTop />
    </div>
  );
}
