"use client";
import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressSpinner } from "primereact/progressspinner";
import { Button } from "primereact/button";
import { Chart } from "primereact/chart";
import { Tag } from "primereact/tag";

interface ActivityStats {
  totalQueries: number;
  activeUsers: number;
  period: string;
}

interface TopUser {
  userId: string;
  username: string;
  actions: number;
  queries: number;
  interactions: number;
  logins: number;
  activityScore: number;
}

interface RecentActivity {
  userId: string;
  username: string;
  action: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useUser();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchStats(7);
  }, [user]);

  const fetchStats = async (days: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/activity?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setTopUsers(data.topUsers);
        setRecentActivity(data.recentActivity);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

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
    labels: topUsers.slice(0, 10).map((u) => u.username || u.userId.slice(0, 8)),
    datasets: [
      {
        label: "活跃度分数",
        data: topUsers.slice(0, 10).map((u) => u.activityScore),
        backgroundColor: "#6366f1",
        borderColor: "#4f46e5",
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  const actionTag = (action: string) => {
    const map: Record<string, { severity: "success" | "info" | "warning" | "danger"; label: string }> = {
      login: { severity: "success", label: "登录" },
      query: { severity: "info", label: "查询" },
      chat: { severity: "info", label: "对话" },
      view: { severity: "warning", label: "浏览" },
      like: { severity: "danger", label: "点赞" },
      bookmark: { severity: "danger", label: "收藏" },
    };
    const cfg = map[action] || { severity: "info" as const, label: action };
    return <Tag severity={cfg.severity} value={cfg.label} />;
  };

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
            <Button
              label="7天"
              severity="info"
              onClick={() => fetchStats(7)}
            />
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
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card title="总查询次数">
                <p className="text-3xl font-bold text-indigo-600">
                  {stats?.totalQueries || 0}
                </p>
                <p className="text-sm text-gray-500">
                  过去 {stats?.period}
                </p>
              </Card>
              <Card title="活跃用户">
                <p className="text-3xl font-bold text-green-600">
                  {stats?.activeUsers || 0}
                </p>
                <p className="text-sm text-gray-500">
                  过去 {stats?.period}
                </p>
              </Card>
              <Card title="Top 用户">
                <p className="text-3xl font-bold text-orange-600">
                  {topUsers[0]?.username || topUsers[0]?.userId?.slice(0, 8) || "N/A"}
                </p>
                <p className="text-sm text-gray-500">
                  活跃度: {topUsers[0]?.activityScore || 0}
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card title="用户活跃度排名 (Top 10)">
                <Chart type="bar" data={chartData} options={chartOptions} />
              </Card>
              <Card title="用户活跃度详情">
                <DataTable value={topUsers} size="small" paginator rows={5}>
                  <Column header="排名" body={(_, { rowIndex }) => rowIndex + 1} />
                  <Column
                    field="username"
                    header="用户"
                    body={(row) => row.username || row.userId.slice(0, 8) + "..."}
                  />
                  <Column field="activityScore" header="活跃度" sortable />
                  <Column field="queries" header="查询" />
                  <Column field="interactions" header="交互" />
                  <Column field="logins" header="登录" />
                </DataTable>
              </Card>
            </div>

            <Card title="最近活动">
              <DataTable value={recentActivity} size="small" paginator rows={10}>
                <Column
                  field="username"
                  header="用户"
                  body={(row) => row.username || row.userId.slice(0, 8) + "..."}
                />
                <Column
                  field="action"
                  header="操作"
                  body={(row) => actionTag(row.action)}
                />
                <Column
                  field="timestamp"
                  header="时间"
                  body={(row) => new Date(row.timestamp).toLocaleString("zh-CN")}
                />
              </DataTable>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
