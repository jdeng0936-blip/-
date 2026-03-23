"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  ArrowLeft,
  Plus,
  Pencil,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

/** 条款节点类型定义 */
interface ClauseNode {
  id: number;
  clause_no: string;
  title: string;
  content: string;
  level: number;
  children: ClauseNode[];
}

/** 文档信息类型 */
interface DocumentInfo {
  id: number;
  title: string;
  doc_type: string;
  version: string | null;
  is_current: boolean;
}

/** 条款树节点组件 */
function ClauseTreeNode({
  clause,
  selectedId,
  onSelect,
}: {
  clause: ClauseNode;
  selectedId: number | null;
  onSelect: (clause: ClauseNode) => void;
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
            <ClauseTreeNode
              key={child.id}
              clause={child}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 文档详情页 — 左侧条款树 + 右侧内容（动态从 API 加载） */
export default function StandardDetailPage() {
  const params = useParams();
  const docId = params.id as string;

  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [clauses, setClauses] = useState<ClauseNode[]>([]);
  const [selectedClause, setSelectedClause] = useState<ClauseNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从后端 API 加载文档详情和条款树
  useEffect(() => {
    async function fetchDocument() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/standards/${docId}`);
        const data = res.data?.data;
        if (data) {
          setDocument(data.document);
          setClauses(data.clauses || []);
          // 默认选中第一个条款
          if (data.clauses && data.clauses.length > 0) {
            setSelectedClause(data.clauses[0]);
          }
        }
      } catch (err: unknown) {
        console.error("加载文档失败:", err);
        setError("加载文档失败，请检查网络连接");
      } finally {
        setLoading(false);
      }
    }
    if (docId) {
      fetchDocument();
    }
  }, [docId]);

  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3 text-slate-500">加载文档中...</span>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">{error}</p>
        <Link href="/dashboard/standards">
          <Button variant="outline" className="mt-4">返回标准库</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶栏 — 动态显示文档标题和类型 */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/standards">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {document?.title || "未知文档"}
          </h2>
          <p className="text-sm text-slate-500">
            {document?.doc_type || "未分类"}
            {document?.version ? ` · ${document.version}` : ""}
          </p>
        </div>
      </div>

      {/* 主体 — 左右分栏 */}
      <div className="grid grid-cols-12 gap-4" style={{ height: "calc(100vh - 220px)" }}>
        {/* 左侧条款树 */}
        <Card className="col-span-4 overflow-hidden">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">
              条款目录
              <span className="ml-2 text-xs font-normal text-slate-400">
                共 {clauses.length} 章
              </span>
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              新增
            </Button>
          </CardHeader>
          <CardContent className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 310px)" }}>
            {clauses.length > 0 ? (
              <div className="space-y-0.5">
                {clauses.map((clause) => (
                  <ClauseTreeNode
                    key={clause.id}
                    clause={clause}
                    selectedId={selectedClause?.id ?? null}
                    onSelect={setSelectedClause}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-slate-400 py-10">
                暂无条款数据
              </p>
            )}
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
          <CardContent className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 310px)" }}>
            {selectedClause ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap leading-7 text-slate-700 dark:text-slate-300">
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
