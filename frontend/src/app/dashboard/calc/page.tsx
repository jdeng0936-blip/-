"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calculator,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  Zap,
  Wind,
  Timer,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";

const TABS = [
  { key: "support", label: "支护计算", icon: ShieldCheck },
  { key: "vent", label: "通风计算", icon: Wind },
  { key: "cycle", label: "循环作业", icon: Timer },
] as const;
type Tab = (typeof TABS)[number]["key"];

const ROCK_CLASSES = ["I", "II", "III", "IV", "V"];
const SECTION_FORMS = ["矩形", "拱形", "梯形"];
const GAS_LEVELS = ["低瓦斯", "高瓦斯", "突出"];
const DIG_METHODS = ["钻爆法", "综掘"];

/* 预警等级颜色映射 */
const LEVEL_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  error: { bg: "bg-red-50", text: "text-red-700", icon: ShieldAlert },
  warning: { bg: "bg-amber-50", text: "text-amber-700", icon: AlertTriangle },
  info: { bg: "bg-blue-50", text: "text-blue-700", icon: Info },
};

export default function CalcPage() {
  const [tab, setTab] = useState<Tab>("support");
  const [loading, setLoading] = useState(false);

  /* ===== 支护计算 ===== */
  const [supportForm, setSupportForm] = useState({
    rock_class: "III", section_form: "拱形",
    section_width: 5.0, section_height: 4.0, rock_density: 2.5,
    bolt_length: 2.4, bolt_diameter: 22,
    bolt_spacing: "", bolt_row_spacing: "",
    cable_count: 0, cable_strength: 260,
  });
  const [supportResult, setSupportResult] = useState<any>(null);

  /* ===== 通风计算 ===== */
  const [ventForm, setVentForm] = useState({
    gas_emission: 3.0, gas_level: "高瓦斯",
    section_area: 20.0, excavation_length: 560,
    max_workers: 20, explosive_per_cycle: 0,
    design_air_volume: "", design_wind_speed: "",
  });
  const [ventResult, setVentResult] = useState<any>(null);

  /* ===== 循环作业 ===== */
  const [cycleForm, setCycleForm] = useState({
    dig_method: "钻爆法",
    hole_depth: 2.0, utilization_rate: 0.85, cut_depth: 0.8,
    t_drilling: 60, t_charging: 20, t_blasting: 15, t_ventilation: 30,
    t_mucking: 90, t_support: 60, t_other: 15,
    shifts_per_day: 3, hours_per_shift: 8, effective_rate: 0.75,
    work_days_per_month: 26, design_monthly_advance: "",
  });
  const [cycleResult, setCycleResult] = useState<any>(null);

  /* ===== 统一提交 ===== */
  const handleCalc = async () => {
    setLoading(true);
    try {
      if (tab === "support") {
        const payload: any = { ...supportForm,
          bolt_spacing: supportForm.bolt_spacing ? parseFloat(supportForm.bolt_spacing as string) : null,
          bolt_row_spacing: supportForm.bolt_row_spacing ? parseFloat(supportForm.bolt_row_spacing as string) : null,
        };
        const res = await api.post("/calc/support", payload);
        setSupportResult(res.data?.data);
      } else if (tab === "vent") {
        const payload: any = { ...ventForm,
          design_air_volume: ventForm.design_air_volume ? parseFloat(ventForm.design_air_volume as string) : null,
          design_wind_speed: ventForm.design_wind_speed ? parseFloat(ventForm.design_wind_speed as string) : null,
        };
        const res = await api.post("/calc/ventilation", payload);
        setVentResult(res.data?.data);
      } else {
        const payload: any = { ...cycleForm,
          design_monthly_advance: cycleForm.design_monthly_advance ? parseFloat(cycleForm.design_monthly_advance as string) : null,
        };
        const res = await api.post("/calc/cycle", payload);
        setCycleResult(res.data?.data);
      }
    } catch (e: any) {
      alert("计算失败: " + (e.response?.data?.detail || e.message));
    } finally { setLoading(false); }
  };

  /* 渲染预警列表 */
  const renderWarnings = (warnings: any[]) => {
    if (!warnings?.length) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">合规校核预警</h4>
        {warnings.map((w: any, i: number) => {
          const style = LEVEL_COLORS[w.level] || LEVEL_COLORS.info;
          const Icon = style.icon;
          return (
            <div key={i} className={`flex items-start gap-2 rounded-md px-3 py-2 ${style.bg}`}>
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
              <div className={`text-sm ${style.text}`}>
                <span className="font-medium">{w.field}：</span>{w.message}
                <span className="ml-2 text-xs">（当前 {w.current_value}，要求 {w.required_value}）</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">计算校验</h2>
          <p className="mt-1 text-sm text-slate-500">支护计算 · 通风计算 · 循环作业 — 合规校核一键验算</p>
        </div>
        <Button className="gap-2" onClick={handleCalc} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
          开始计算
        </Button>
      </div>

      {/* Tab */}
      <div className="flex gap-1 rounded-lg border bg-slate-100 p-1 dark:bg-slate-900">
        {TABS.map((t) => (
          <button key={t.key}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${
              tab === t.key ? "bg-white font-medium shadow dark:bg-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setTab(t.key)}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ===== 支护计算输入 ===== */}
        {tab === "support" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">输入参数</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">围岩级别</label>
                    <select className="w-full rounded-md border px-3 py-2 text-sm" value={supportForm.rock_class} onChange={e => setSupportForm({ ...supportForm, rock_class: e.target.value })}>
                      {ROCK_CLASSES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">断面形式</label>
                    <select className="w-full rounded-md border px-3 py-2 text-sm" value={supportForm.section_form} onChange={e => setSupportForm({ ...supportForm, section_form: e.target.value })}>
                      {SECTION_FORMS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="mb-1 block text-xs font-medium">净宽 (m)</label><Input type="number" value={supportForm.section_width} onChange={e => setSupportForm({ ...supportForm, section_width: +e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-medium">净高 (m)</label><Input type="number" value={supportForm.section_height} onChange={e => setSupportForm({ ...supportForm, section_height: +e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-medium">岩石容重 (t/m³)</label><Input type="number" value={supportForm.rock_density} onChange={e => setSupportForm({ ...supportForm, rock_density: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-xs font-medium">锚杆长度 (m)</label><Input type="number" value={supportForm.bolt_length} onChange={e => setSupportForm({ ...supportForm, bolt_length: +e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-medium">锚杆直径 (mm)</label><Input type="number" value={supportForm.bolt_diameter} onChange={e => setSupportForm({ ...supportForm, bolt_diameter: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-xs font-medium">指定间距 (mm) <span className="text-slate-400">可选</span></label><Input placeholder="留空自动计算" value={supportForm.bolt_spacing} onChange={e => setSupportForm({ ...supportForm, bolt_spacing: e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-medium">指定排距 (mm) <span className="text-slate-400">可选</span></label><Input placeholder="留空自动计算" value={supportForm.bolt_row_spacing} onChange={e => setSupportForm({ ...supportForm, bolt_row_spacing: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-xs font-medium">锚索数量</label><Input type="number" value={supportForm.cable_count} onChange={e => setSupportForm({ ...supportForm, cable_count: +e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-medium">锚索破断力 (kN)</label><Input type="number" value={supportForm.cable_strength} onChange={e => setSupportForm({ ...supportForm, cable_strength: +e.target.value })} /></div>
                </div>
              </CardContent>
            </Card>
            {supportResult && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base">{supportResult.is_compliant ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <ShieldAlert className="h-5 w-5 text-red-500" />} 计算结果</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">净断面积</div><div className="text-lg font-bold">{supportResult.section_area} m²</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">单根锚杆锚固力</div><div className="text-lg font-bold">{supportResult.bolt_force} kN</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">最大间距</div><div className="text-lg font-bold">{supportResult.max_bolt_spacing} mm</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">最大排距</div><div className="text-lg font-bold">{supportResult.max_bolt_row_spacing} mm</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">推荐每排锚杆数</div><div className="text-lg font-bold">{supportResult.recommended_bolt_count_per_row} 根</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">最少锚索</div><div className="text-lg font-bold">{supportResult.min_cable_count} 根</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">安全系数</div><div className="text-lg font-bold">{supportResult.safety_factor}</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">支护密度</div><div className="text-lg font-bold">{supportResult.support_density} 根/m²</div></div>
                  </div>
                  {renderWarnings(supportResult.warnings)}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ===== 通风计算输入 ===== */}
        {tab === "vent" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">输入参数</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-xs font-medium">瓦斯涌出量 (m³/min)</label><Input type="number" value={ventForm.gas_emission} onChange={e => setVentForm({ ...ventForm, gas_emission: +e.target.value })} /></div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">瓦斯等级</label>
                    <select className="w-full rounded-md border px-3 py-2 text-sm" value={ventForm.gas_level} onChange={e => setVentForm({ ...ventForm, gas_level: e.target.value })}>
                      {GAS_LEVELS.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-xs font-medium">净断面积 (m²)</label><Input type="number" value={ventForm.section_area} onChange={e => setVentForm({ ...ventForm, section_area: +e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-medium">掘进长度 (m)</label><Input type="number" value={ventForm.excavation_length} onChange={e => setVentForm({ ...ventForm, excavation_length: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-xs font-medium">最多人数</label><Input type="number" value={ventForm.max_workers} onChange={e => setVentForm({ ...ventForm, max_workers: +e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-medium">炸药消耗 (kg/循环)</label><Input type="number" value={ventForm.explosive_per_cycle} onChange={e => setVentForm({ ...ventForm, explosive_per_cycle: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="mb-1 block text-xs font-medium">设计供风量 (m³/min) <span className="text-slate-400">可选</span></label><Input placeholder="留空跳过校核" value={ventForm.design_air_volume} onChange={e => setVentForm({ ...ventForm, design_air_volume: e.target.value })} /></div>
                  <div><label className="mb-1 block text-xs font-medium">设计风速 (m/s) <span className="text-slate-400">可选</span></label><Input placeholder="留空跳过校核" value={ventForm.design_wind_speed} onChange={e => setVentForm({ ...ventForm, design_wind_speed: e.target.value })} /></div>
                </div>
              </CardContent>
            </Card>
            {ventResult && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base">{ventResult.is_compliant ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <ShieldAlert className="h-5 w-5 text-red-500" />} 计算结果</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-blue-50 p-3"><div className="text-xs text-blue-500">瓦斯法需风量</div><div className="text-lg font-bold text-blue-700">{ventResult.q_gas} m³/min</div></div>
                    <div className="rounded-md bg-blue-50 p-3"><div className="text-xs text-blue-500">人数法需风量</div><div className="text-lg font-bold text-blue-700">{ventResult.q_people} m³/min</div></div>
                    <div className="rounded-md bg-blue-50 p-3"><div className="text-xs text-blue-500">炸药法需风量</div><div className="text-lg font-bold text-blue-700">{ventResult.q_explosive} m³/min</div></div>
                    <div className="rounded-md bg-green-50 p-3"><div className="text-xs text-green-500">最终需风量</div><div className="text-xl font-bold text-green-700">{ventResult.q_required} m³/min</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">风速范围</div><div className="font-bold">{ventResult.wind_speed_min} ~ {ventResult.wind_speed_max} m/s</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">推荐局扇</div><div className="font-bold">{ventResult.recommended_fan}</div><div className="text-xs text-slate-400">{ventResult.fan_power} kW</div></div>
                  </div>
                  {renderWarnings(ventResult.warnings)}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ===== 循环作业输入 ===== */}
        {tab === "cycle" && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">输入参数</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">掘进方式</label>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={cycleForm.dig_method} onChange={e => setCycleForm({ ...cycleForm, dig_method: e.target.value })}>
                    {DIG_METHODS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                {cycleForm.dig_method === "钻爆法" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="mb-1 block text-xs font-medium">炮眼深度 (m)</label><Input type="number" value={cycleForm.hole_depth} onChange={e => setCycleForm({ ...cycleForm, hole_depth: +e.target.value })} /></div>
                    <div><label className="mb-1 block text-xs font-medium">利用率</label><Input type="number" step="0.01" value={cycleForm.utilization_rate} onChange={e => setCycleForm({ ...cycleForm, utilization_rate: +e.target.value })} /></div>
                  </div>
                ) : (
                  <div><label className="mb-1 block text-xs font-medium">截割深度 (m)</label><Input type="number" value={cycleForm.cut_depth} onChange={e => setCycleForm({ ...cycleForm, cut_depth: +e.target.value })} /></div>
                )}
                <p className="text-xs font-semibold text-slate-500">工序时间 (min)</p>
                <div className="grid grid-cols-4 gap-2">
                  {(["t_drilling", "t_charging", "t_blasting", "t_ventilation", "t_mucking", "t_support", "t_other"] as const).map(key => (
                    <div key={key}><label className="mb-0.5 block text-[10px] text-slate-400">{{ t_drilling: "打眼", t_charging: "装药", t_blasting: "放炮", t_ventilation: "通风", t_mucking: "出矸", t_support: "支护", t_other: "其他" }[key]}</label><Input type="number" value={cycleForm[key]} onChange={e => setCycleForm({ ...cycleForm, [key]: +e.target.value })} /></div>
                  ))}
                </div>
                <p className="text-xs font-semibold text-slate-500">工作制度</p>
                <div className="grid grid-cols-4 gap-2">
                  <div><label className="mb-0.5 block text-[10px] text-slate-400">日班次</label><Input type="number" value={cycleForm.shifts_per_day} onChange={e => setCycleForm({ ...cycleForm, shifts_per_day: +e.target.value })} /></div>
                  <div><label className="mb-0.5 block text-[10px] text-slate-400">班工时 (h)</label><Input type="number" value={cycleForm.hours_per_shift} onChange={e => setCycleForm({ ...cycleForm, hours_per_shift: +e.target.value })} /></div>
                  <div><label className="mb-0.5 block text-[10px] text-slate-400">有效率</label><Input type="number" step="0.01" value={cycleForm.effective_rate} onChange={e => setCycleForm({ ...cycleForm, effective_rate: +e.target.value })} /></div>
                  <div><label className="mb-0.5 block text-[10px] text-slate-400">月工作日</label><Input type="number" value={cycleForm.work_days_per_month} onChange={e => setCycleForm({ ...cycleForm, work_days_per_month: +e.target.value })} /></div>
                </div>
                <div><label className="mb-1 block text-xs font-medium">设计月进尺 (m) <span className="text-slate-400">可选</span></label><Input placeholder="留空跳过校核" value={cycleForm.design_monthly_advance} onChange={e => setCycleForm({ ...cycleForm, design_monthly_advance: e.target.value })} /></div>
              </CardContent>
            </Card>
            {cycleResult && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base">{cycleResult.is_compliant ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <ShieldAlert className="h-5 w-5 text-red-500" />} 计算结果</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-emerald-50 p-3"><div className="text-xs text-emerald-500">循环进尺</div><div className="text-xl font-bold text-emerald-700">{cycleResult.cycle_advance} m</div></div>
                    <div className="rounded-md bg-emerald-50 p-3"><div className="text-xs text-emerald-500">单循环时间</div><div className="text-xl font-bold text-emerald-700">{cycleResult.cycle_time} min</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">日循环数</div><div className="text-lg font-bold">{cycleResult.cycles_per_day}</div></div>
                    <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">日进尺</div><div className="text-lg font-bold">{cycleResult.daily_advance} m</div></div>
                    <div className="rounded-md bg-purple-50 p-3"><div className="text-xs text-purple-500">月进尺</div><div className="text-xl font-bold text-purple-700">{cycleResult.monthly_advance} m</div></div>
                    <div className="rounded-md bg-purple-50 p-3"><div className="text-xs text-purple-500">正规循环率</div><div className="text-xl font-bold text-purple-700">{cycleResult.cycle_rate}%</div></div>
                  </div>
                  {renderWarnings(cycleResult.warnings)}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
