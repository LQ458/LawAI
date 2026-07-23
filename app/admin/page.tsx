"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressSpinner } from "primereact/progressspinner";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { Tag } from "primereact/tag";

interface ActivityStats {
  totalActions: number;
  totalQueries: number;
  activeUsers: number;
  period: string;
}

interface ActionBreakdown {
  action: string;
  count: number;
}

interface DailyActivity {
  date: string;
  actions: number;
  queries: number;
  activeUsers: number;
}

interface ActivityResponse {
  stats: ActivityStats;
  actionBreakdown: ActionBreakdown[];
  dailyActivity: DailyActivity[];
}

const ACTION_LABELS: Record<string, string> = {
  login: "登录",
  query: "查询",
  chat: "对话",
  view: "浏览",
  like: "点赞",
  bookmark: "收藏",
};

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useUser();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [actionBreakdown, setActionBreakdown] = useState<ActionBreakdown[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async (days: number) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/activity?days=${days}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setError(
          response.status === 403
            ? "当前账号没有管理员权限"
            : "无法加载活动统计",
        );
        return;
      }

      const data = (await response.json()) as ActivityResponse;
      setStats(data.stats);
      setActionBreakdown(data.actionBreakdown);
      setDailyActivity(data.dailyActivity);
    } catch {
      setError("无法加载活动统计");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void fetchStats(7);
    }
  }, [fetchStats, user]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <ProgressSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p>请先登录</p>
        <Button label="返回首页" onClick={() => (window.location.href = "/")} />
      </div>
    );
  }

  const chartData = {
    labels: dailyActivity.map((row) => row.date),
    datasets: [
      {
        label: "全部活动",
        data: dailyActivity.map((row) => row.actions),
        backgroundColor: "#6366f1",
        borderColor: "#4f46e5",
      },
      {
        label: "查询与对话",
        data: dailyActivity.map((row) => row.queries),
        backgroundColor: "#22c55e",
        borderColor: "#16a34a",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "bottom" as const },
    },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  const actionTag = (action: string) => (
    <Tag severity="info" value={ACTION_LABELS[action] || action} />
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">管理面板</h1>
          <div className="flex gap-2">
            <Button
              label="返回首页"
              icon="pi pi-home"
              severity="secondary"
              onClick={() => (window.location.href = "/")}
            />
            <Button label="7天" severity="info" onClick={() => fetchStats(7)} />
            <Button
              label="30天"
              severity="info"
              onClick={() => fetchStats(30)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <ProgressSpinner />
          </div>
        ) : error ? (
          <Card>
            <p className="text-red-600">{error}</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card title="总活动次数">
                <p className="text-3xl font-bold text-indigo-600">
                  {stats?.totalActions || 0}
                </p>
                <p className="text-sm text-gray-500">过去 {stats?.period}</p>
              </Card>
              <Card title="查询与对话">
                <p className="text-3xl font-bold text-orange-600">
                  {stats?.totalQueries || 0}
                </p>
                <p className="text-sm text-gray-500">过去 {stats?.period}</p>
              </Card>
              <Card title="活跃用户">
                <p className="text-3xl font-bold text-green-600">
                  {stats?.activeUsers || 0}
                </p>
                <p className="text-sm text-gray-500">窗口内不同登录账号数</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card title="每日活动趋势">
                <Chart type="bar" data={chartData} options={chartOptions} />
              </Card>
              <Card title="活动类型汇总">
                <DataTable value={actionBreakdown} size="small">
                  <Column
                    field="action"
                    header="活动"
                    body={(row: ActionBreakdown) => actionTag(row.action)}
                  />
                  <Column field="count" header="次数" sortable />
                </DataTable>
              </Card>
            </div>

            <Card title="每日聚合">
              <DataTable value={dailyActivity} size="small" paginator rows={10}>
                <Column field="date" header="日期（UTC）" />
                <Column field="actions" header="全部活动" />
                <Column field="queries" header="查询与对话" />
                <Column field="activeUsers" header="活跃用户" />
              </DataTable>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
