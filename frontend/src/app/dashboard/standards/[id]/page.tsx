"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  ArrowLeft,
  Plus,
  Pencil,
} from "lucide-react";
import Link from "next/link";

/** 模拟条款树数据 — 待后端对接后替换 */
const MOCK_CLAUSES = [
  {
    id: 1,
    clause_no: "第一章",
    title: "总则",
    content: "为加强煤矿安全管理，保障煤矿职工生命安全和健康...",
    level: 0,
    children: [
      {
        id: 2,
        clause_no: "第1条",
        title: "适用范围",
        content:
          "本规程适用于中华人民共和国领域内从事煤炭开采活动的企业和个人。",
        level: 1,
        children: [],
      },
      {
        id: 3,
        clause_no: "第2条",
        title: "基本原则",
        content: "煤矿企业必须坚持安全第一、预防为主、综合治理的安全生产方针。",
        level: 1,
        children: [],
      },
    ],
  },
  {
    id: 4,
    clause_no: "第二章",
    title: "掘进",
    content: "",
    level: 0,
    children: [
      {
        id: 5,
        clause_no: "第36条",
        title: "掘进工作面安全要求",
        content:
          "掘进工作面应当保持安全出口畅通，严禁堵塞安全出口。工作面支护应当紧跟迎头...",
        level: 1,
        children: [],
      },
    ],
  },
];

/** 条款树节点组件 */
function ClauseNode({
  clause,
  selectedId,
  onSelect,
}: {
  clause: (typeof MOCK_CLAUSES)[0];
  selectedId: number | null;
  onSelect: (clause: (typeof MOCK_CLAUSES)[0]) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = clause.children && clause.children.length > 0;

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
          selectedId === clause.id
            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            : "hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
        style={{ paddingLeft: `${clause.level * 16 + 8}px` }}
        onClick={() => onSelect(clause)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
        <span className="font-mono text-xs text-slate-400">
          {clause.clause_no}
        </span>
        <span className="truncate">{clause.title}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {clause.children.map((child) => (
            <ClauseNode
              key={child.id}
              clause={child as (typeof MOCK_CLAUSES)[0]}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 文档详情页 — 左侧条款树 + 右侧内容 */
export default function StandardDetailPage() {
  const [selectedClause, setSelectedClause] = useState<
    (typeof MOCK_CLAUSES)[0] | null
  >(MOCK_CLAUSES[0]);

  return (
    <div className="space-y-4">
      {/* 顶栏 */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/standards">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            煤矿安全规程
          </h2>
          <p className="text-sm text-slate-500">法律法规 · 2022版</p>
        </div>
      </div>

      {/* 主体 — 左右分栏 */}
      <div className="grid grid-cols-12 gap-4" style={{ height: "calc(100vh - 220px)" }}>
        {/* 左侧条款树 */}
        <Card className="col-span-4 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">条款目录</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              新增
            </Button>
          </CardHeader>
          <CardContent className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 310px)" }}>
            <div className="space-y-0.5">
              {MOCK_CLAUSES.map((clause) => (
                <ClauseNode
                  key={clause.id}
                  clause={clause}
                  selectedId={selectedClause?.id ?? null}
                  onSelect={setSelectedClause}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 右侧条款内容 */}
        <Card className="col-span-8 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">
              {selectedClause
                ? `${selectedClause.clause_no} ${selectedClause.title}`
                : "请选择条款"}
            </CardTitle>
            {selectedClause && (
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                <Pencil className="h-3 w-3" />
                编辑
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {selectedClause ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="leading-7 text-slate-700 dark:text-slate-300">
                  {selectedClause.content || "（此条款暂无正文内容）"}
                </p>
              </div>
            ) : (
              <p className="text-center text-sm text-slate-400 py-20">
                点击左侧条款目录查看内容
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
