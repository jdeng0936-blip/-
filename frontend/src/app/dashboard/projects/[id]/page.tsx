"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";

/** 参数中文映射 */
const PARAM_LABELS: Record<string, string> = {
  rock_class: "围岩级别", coal_thickness: "煤层厚度", coal_dip: "煤层倾角",
  gas_level: "瓦斯等级", section_form: "断面形式",
  section_width: "断面宽度 (m)", section_height: "断面高度 (m)",
  excavation_length: "掘进长度 (m)", dig_method: "掘进方式",
  equipment: "掘进设备", transport: "运输方式", hydro_type: "水文类型",
};

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  template: { label: "模板", color: "bg-slate-200 text-slate-600" },
  calc_engine: { label: "计算引擎", color: "bg-blue-100 text-blue-700" },
  rule_match: { label: "规则匹配", color: "bg-purple-100 text-purple-700" },
  ai: { label: "AI 生成", color: "bg-green-100 text-green-700" },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [projectParams, setProjectParams] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  // 加载项目数据
  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, paramsRes] = await Promise.allSettled([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/params`),
      ]);
      if (projRes.status === "fulfilled") setProject(projRes.value.data?.data);
      if (paramsRes.status === "fulfilled") setProjectParams(paramsRes.value.data?.data);
      // 加载已生成文档列表
      try {
        const docsRes = await api.get(`/projects/${projectId}/documents`);
        setDocuments(docsRes.data?.data || []);
      } catch { /* 静默 */ }
    } catch (e: any) {
      alert("加载项目失败: " + (e.response?.data?.detail || e.message));
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // 一键生成
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/projects/${projectId}/generate`);
      setGenerateResult(res.data?.data);
      // 刷新文档列表
      const docsRes = await api.get(`/projects/${projectId}/documents`);
      setDocuments(docsRes.data?.data || []);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      alert("生成失败: " + (typeof detail === "string" ? detail : JSON.stringify(detail)));
    } finally { setGenerating(false); }
  };

  // 下载文档
  const handleDownload = async (filename: string) => {
    try {
      const res = await api.get(`/projects/${projectId}/documents/download`, {
        params: { filename },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      window.URL.revokeObjectURL(url);
    } catch { alert("下载失败"); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;
  }

  // 参数展平显示
  const paramEntries: [string, string][] = projectParams
    ? Object.entries(projectParams)
        .filter(([k]) => !["id", "project_id", "created_at", "updated_at", "created_by", "tenant_id"].includes(k))
        .filter(([, v]) => v !== null && v !== "")
        .map(([k, v]) => [PARAM_LABELS[k] || k, String(v)])
    : [];

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {project?.face_name || project?.name || `项目 #${projectId}`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {project?.mine_name || ""} · {project?.status || "进行中"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button className="gap-2" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {generating ? "生成中..." : "一键生成规程"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧：项目参数 */}
        <Card className="col-span-4">
          <CardHeader><CardTitle className="text-sm">项目参数</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {paramEntries.length > 0 ? paramEntries.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            )) : (
              <p className="py-4 text-center text-sm text-slate-400">暂未填写参数</p>
            )}
          </CardContent>
        </Card>

        {/* 右侧：文档 */}
        <div className="col-span-8 space-y-4">
          {/* 已生成文档列表 */}
          {documents.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">已生成文档</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {documents.map((doc: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">{doc.filename}</span>
                      <span className="text-xs text-slate-400">{doc.size_kb} KB</span>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => handleDownload(doc.filename)}>
                      <Download className="h-3.5 w-3.5" />下载
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 生成结果预览 */}
          {generateResult ? (
            <>
              <div className="grid grid-cols-4 gap-3">
                <Card><CardContent className="py-3 text-center"><div className="text-xs text-slate-500">文件</div><div className="mt-1 text-sm font-bold truncate">{generateResult.file_path || "-"}</div></CardContent></Card>
                <Card><CardContent className="py-3 text-center"><div className="text-xs text-slate-500">章节数</div><div className="mt-1 text-lg font-bold">{generateResult.chapters?.length || 0}</div></CardContent></Card>
                <Card><CardContent className="py-3 text-center"><div className="text-xs text-slate-500">预警数</div><div className="mt-1 text-lg font-bold text-red-500">{generateResult.total_warnings || 0}</div></CardContent></Card>
                <Card className="border-green-200 bg-green-50"><CardContent className="flex items-center justify-center gap-2 py-3"><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="font-medium text-green-700">生成完成</span></CardContent></Card>
              </div>

              {generateResult.chapters && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4" />文档结构预览</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {generateResult.chapters.map((ch: any, i: number) => {
                      const chKey = ch.chapter_no || ch.no || `ch-${i}`;
                      const isExpanded = expandedChapter === chKey;
                      return (
                        <div key={i} className="overflow-hidden rounded-lg border">
                          <div
                            className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition-colors hover:bg-slate-50 ${ch.has_warning ? "bg-red-50/50" : ""}`}
                            onClick={() => setExpandedChapter(isExpanded ? null : chKey)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                              <span className="font-mono text-xs text-slate-400">{chKey}</span>
                              <span className="font-medium">{ch.title}</span>
                              {ch.source && <span className={`rounded-full px-2 py-0.5 text-xs ${SOURCE_BADGE[ch.source]?.color || "bg-slate-100"}`}>{SOURCE_BADGE[ch.source]?.label || ch.source}</span>}
                            </div>
                            {ch.has_warning && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          </div>
                          {isExpanded && (
                            <div className="border-t bg-slate-50 px-4 py-3 space-y-2">
                              {ch.has_warning && (
                                <div className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  <span>本章节存在合规预警，请重点审查</span>
                                </div>
                              )}
                              <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans">{ch.content}</pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          ) : !generating && (
            <Card className="flex h-64 items-center justify-center">
              <div className="text-center text-slate-400">
                <FileText className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p>点击&quot;一键生成规程&quot;开始</p>
                <p className="mt-1 text-xs">系统将自动匹配规则、计算校核、生成 Word 文档</p>
              </div>
            </Card>
          )}

          {generating && (
            <Card className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-500" />
                <p className="font-medium">正在生成规程文档...</p>
                <div className="mt-3 space-y-1 text-left text-xs text-slate-500">
                  <p>⏳ 加载项目参数...</p>
                  <p>⏳ 规则匹配中...</p>
                  <p>⏳ 计算校核中...</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
