"use client";

/**
 * FeedbackStats — 反馈飞轮统计面板
 *
 * 展示 AI 生成内容的采纳/修改/拒绝统计，
 * 让用户直观看到"系统在学习"。
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, Pencil, ThumbsDown, TrendingUp, Loader2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import api from "@/lib/api";

interface Stats {
  total: number;
  accept_count: number;
  edit_count: number;
  reject_count: number;
  accept_rate: number;
  edit_rate: number;
  reject_rate: number;
}

const COLORS = {
  accept: "#22c55e",  // green-500
  edit: "#3b82f6",    // blue-500
  reject: "#ef4444",  // red-500
};

export default function FeedbackStatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/feedback/stats")
      .then((r) => setStats(r.data?.data ?? null))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            数据飞轮
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-slate-400 py-4">
            暂无反馈数据。在项目详情页使用「采纳/修改/拒绝」按钮即可开始积累。
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: "采纳", value: stats.accept_count, color: COLORS.accept },
    { name: "修改", value: stats.edit_count, color: COLORS.edit },
    { name: "拒绝", value: stats.reject_count, color: COLORS.reject },
  ].filter((d) => d.value > 0);

  const items = [
    {
      label: "采纳",
      count: stats.accept_count,
      rate: stats.accept_rate,
      icon: ThumbsUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "修改",
      count: stats.edit_count,
      rate: stats.edit_rate,
      icon: Pencil,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "拒绝",
      count: stats.reject_count,
      rate: stats.reject_rate,
      icon: ThumbsDown,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          数据飞轮
          <span className="ml-auto text-xs font-normal text-slate-400">
            共 {stats.total} 条反馈
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* 环形图 */}
          <div className="h-28 w-28 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} 条`, `${name}`]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 数据卡片 */}
          <div className="flex flex-1 gap-3">
            {items.map((item) => (
              <div
                key={item.label}
                className={`flex flex-1 flex-col items-center rounded-xl ${item.bg} p-3 transition-all hover:shadow-sm`}
              >
                <item.icon className={`h-4 w-4 ${item.color} mb-1`} />
                <span className="text-2xl font-bold text-slate-800">
                  {item.count}
                </span>
                <span className="text-xs text-slate-500">{item.label}</span>
                <span className={`text-xs font-medium ${item.color}`}>
                  {(item.rate * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
