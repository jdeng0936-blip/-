"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle2, Loader2, X, AlertCircle } from "lucide-react";
import api from "@/lib/api";

interface UploadStandardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

const DOC_TYPES = ["法律法规", "技术规范", "集团标准", "安全规程"];
const ACCEPTED_EXTENSIONS = [".doc", ".docx", ".txt"];

export default function UploadStandardDialog({
  open,
  onOpenChange,
  onSuccess,
}: UploadStandardDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("安全规程");
  const [version, setVersion] = useState("v1.0");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ clause_count: number; vectorized_count: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setDocType("安全规程");
    setVersion("v1.0");
    setStatus("idle");
    setProgress("");
    setResult(null);
    setErrorMsg("");
  }, []);

  const validateFile = (f: File): boolean => {
    const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setErrorMsg(`不支持的文件格式: ${ext}，仅支持 .doc/.docx/.txt`);
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (validateFile(f)) {
      setFile(f);
      setStatus("idle");
      setResult(null);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const f = files[0];
      const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setErrorMsg(`不支持的文件格式: ${ext}，仅支持 .doc/.docx/.txt`);
        return;
      }
      setErrorMsg("");
      setFile(f);
      setStatus("idle");
      setResult(null);
    }
  }, []);

  // 上传并解析
  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress("正在上传文件...");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("doc_type", docType);
      formData.append("version", version);

      setProgress("正在解析文档结构并向量化...");

      const res = await api.post("/standards/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });

      const data = res.data?.data;
      setResult({
        clause_count: data?.clause_count || 0,
        vectorized_count: data?.vectorized_count || 0,
      });
      setProgress("");
      setStatus("success");
      onSuccess?.();
    } catch (err: unknown) {
      setStatus("error");
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setErrorMsg(axiosErr?.response?.data?.detail || "上传解析失败，请检查文件格式");
      setProgress("");
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>上传规范文档</DialogTitle>
          <DialogDescription>
            上传 .doc / .docx / .txt 文件，自动提取章节结构并入库
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 拖拽上传区域 */}
          <div
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
              isDragOver
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : file
                ? "border-green-400 bg-green-50 dark:bg-green-950"
                : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".doc,.docx,.txt"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            {file ? (
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-green-500" />
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  className="ml-2 rounded-full p-1 hover:bg-slate-200 dark:hover:bg-slate-700"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setStatus("idle"); }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mb-2 h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  拖拽文件到此处，或点击选择文件
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  支持 .doc、.docx、.txt 格式
                </p>
              </>
            )}
          </div>

          {/* 文档类型 + 版本 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="upload-doc-type">文档类型</Label>
              <select
                id="upload-doc-type"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upload-version">版本号</Label>
              <Input
                id="upload-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="如：v1.0"
              />
            </div>
          </div>

          {/* 错误提示 */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* 上传进度 */}
          {status === "uploading" && (
            <div className="flex items-center gap-3 rounded-md bg-blue-50 p-3 dark:bg-blue-950">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="text-sm text-blue-700 dark:text-blue-300">{progress}</span>
            </div>
          )}

          {/* 成功结果 */}
          {status === "success" && result && (
            <div className="flex items-center gap-3 rounded-md bg-green-50 p-3 dark:bg-green-950">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="text-sm text-green-700 dark:text-green-300">
                <p className="font-medium">解析入库成功</p>
                <p>共提取 {result.clause_count} 条条款，{result.vectorized_count} 条已向量化</p>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              {status === "success" ? "关闭" : "取消"}
            </Button>
            {status !== "success" && (
              <Button onClick={handleUpload} disabled={!file || status === "uploading"}>
                {status === "uploading" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />解析中...</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />上传并解析</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
