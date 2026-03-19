/**
 * 前端核心业务类型定义
 *
 * 减少 any 使用，提升 IDE 提示和类型安全。
 */

import type { LucideIcon } from "lucide-react";

/* ===== 项目相关 ===== */

/** 矿井信息 */
export interface Mine {
  id: number;
  name: string;
  tenant_id?: number;
}

/** 项目参数 */
export interface ProjectParams {
  rock_class?: string;
  gas_level?: string;
  section_width?: number;
  section_height?: number;
  section_form?: string;
  excavation_method?: string;
  coal_thickness?: number;
  spontaneous_combustion?: string;
  excavation_length?: number;
  gas_emission?: number;
  max_workers?: number;
  bolt_length?: number;
  bolt_diameter?: number;
  bolt_spacing?: number;
  bolt_row_spacing?: number;
  cable_count?: number;
  cable_strength?: number;
}

/** 项目信息 */
export interface Project {
  id: number;
  face_name: string;
  mine_name?: string;
  mine_id?: number;
  status: "draft" | "in_progress" | "completed";
  updated_at?: string;
  created_at?: string;
  params?: ProjectParams;
  // 展开后的参数（前端会把 params 展开到顶层）
  rock_class?: string;
  gas_level?: string;
  section_width?: number;
  section_height?: number;
  section_form?: string;
  excavation_method?: string;
}

/* ===== 文档相关 ===== */

/** 生成的文档 */
export interface GeneratedDoc {
  filename: string;
  size: number;
  created_at: string;
  download_url: string;
}

/** 章节内容 */
export interface Chapter {
  title: string;
  content?: string;
  source?: string;
  warnings?: CalcWarning[];
}

/** 文档生成结果 */
export interface DocGenerateResult {
  project_id: number;
  project_name: string;
  file_path: string;
  total_chapters: number;
  total_warnings: number;
  chapters: Chapter[];
}

/* ===== 计算校验 ===== */

/** 预警项 */
export interface CalcWarning {
  level: "error" | "warning" | "info";
  field: string;
  message: string;
}

/** 合规校验项 */
export interface ComplianceItem {
  category: string;
  item: string;
  status: "pass" | "fail" | "warning";
  message: string;
  suggestion?: string;
}

/** 规则冲突 */
export interface RuleConflict {
  type: string;
  severity: "error" | "warning";
  rule_a_id: number;
  rule_a_name: string;
  rule_b_id: number;
  rule_b_name: string;
  detail: string;
  suggestion?: string;
}

/* ===== 通用 ===== */

/** 颜色映射（图标 + 背景 + 文字） */
export interface ColorStyle {
  bg: string;
  text: string;
  icon: LucideIcon;
}

/** API 错误（catch 中使用） */
export interface ApiError {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message: string;
}
