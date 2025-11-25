// Component to display weekly query statistics
"use client";
import React, { useEffect, useState } from "react";
import { Skeleton } from "primereact/skeleton";

interface WeeklyStatsProps {
  className?: string;
}

export default function WeeklyStats({ className = "" }: WeeklyStatsProps) {
  const [queryCount, setQueryCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats/weekly-queries");
        if (!response.ok) {
          throw new Error("Failed to fetch statistics");
        }
        const data = await response.json();
        setQueryCount(data.count);
        setError(false);
      } catch (err) {
        console.error("Error fetching weekly stats:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className={`p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100 ${className}`}>
        <Skeleton width="100%" height="1.5rem" />
      </div>
    );
  }

  if (error || queryCount === null) {
    return null; // Don't show anything if there's an error
  }

  return (
    <div
      className={`p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2">
        <i className="pi pi-chart-line text-blue-600 text-lg"></i>
        <p className="text-sm text-gray-700 m-0">
          <span className="font-medium">本周，法律AI 已帮助解答了 </span>
          <span className="font-bold text-blue-600 text-base">{queryCount}</span>
          <span className="font-medium"> 个用户查询</span>
        </p>
      </div>
    </div>
  );
}
