"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Image,
  Upload,
  Grid3X3,
  FileImage,
  Shield,
  Ruler,
  LayoutPanelLeft,
  ClipboardList,
} from "lucide-react";

const CATEGORIES = [
  { key: "section", label: "断面图", icon: Grid3X3, desc: "巷道断面形状、尺寸标注图", count: 0 },
  { key: "support", label: "支护图", icon: Shield, desc: "锚杆/锚索/金属网支护布置图", count: 0 },
  { key: "layout", label: "布置图", icon: LayoutPanelLeft, desc: "掘进工作面设备布置图", count: 0 },
  { key: "schedule", label: "作业图表", icon: ClipboardList, desc: "循环作业图表、工序安排图", count: 0 },
  { key: "safety", label: "安全图", icon: Shield, desc: "避灾路线、通风示意等安全图", count: 0 },
  { key: "measure", label: "测量图", icon: Ruler, desc: "巷道中腰线标定、测量布局图", count: 0 },
];

/** 图纸管理 */
export default function DrawingsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">图纸管理</h2>
          <p className="mt-1 text-sm text-slate-500">
            管理断面图、支护图、布置图、作业图表等配套图纸模板
          </p>
        </div>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />上传图纸
        </Button>
      </div>

      {/* 图纸分类网格 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <Card
            key={cat.key}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selected === cat.key ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => setSelected(selected === cat.key ? null : cat.key)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <cat.icon className="h-5 w-5 text-blue-500" />
                {cat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{cat.desc}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">{cat.count} 份图纸</span>
                <FileImage className="h-4 w-4 text-slate-300" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 选中分类后的图纸列表区 */}
      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {CATEGORIES.find(c => c.key === selected)?.label} — 图纸列表
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-12 text-slate-400">
              <Image className="mb-3 h-12 w-12 opacity-30" />
              <p className="text-sm">暂无图纸，点击「上传图纸」添加</p>
              <p className="mt-1 text-xs">支持 PNG, JPG, SVG, DWG, PDF 格式</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
