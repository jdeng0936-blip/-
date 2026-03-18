"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings2,
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Zap,
  Loader2,
  X,
} from "lucide-react";
import api from "@/lib/api";

/** 字段中文映射 */
const FIELD_OPTIONS = [
  { value: "rock_class", label: "围岩级别" },
  { value: "coal_thickness", label: "煤层厚度" },
  { value: "gas_level", label: "瓦斯等级" },
  { value: "hydro_type", label: "水文类型" },
  { value: "section_form", label: "断面形式" },
  { value: "section_width", label: "断面宽度" },
  { value: "section_height", label: "断面高度" },
  { value: "dig_method", label: "掘进方式" },
  { value: "roadway_type", label: "巷道类型" },
  { value: "excavation_type", label: "掘进类型" },
];
const FIELD_LABELS: Record<string, string> = Object.fromEntries(FIELD_OPTIONS.map(f => [f.value, f.label]));

const OP_OPTIONS = [
  { value: "eq", label: "等于" },
  { value: "ne", label: "不等于" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "contains", label: "包含" },
  { value: "in", label: "属于" },
  { value: "between", label: "区间" },
];
const OP_LABELS: Record<string, string> = Object.fromEntries(OP_OPTIONS.map(o => [o.value, o.label]));

const CATEGORY_OPTIONS = ["支护", "装备", "安全", "断面", "通风"];

interface RuleGroup { id: number; name: string; description?: string; rule_count?: number; }
interface Condition { field: string; operator: string; value: string; }
interface Action { target_chapter: string; snippet_id?: number; }
interface Rule { id: number; name: string; category?: string; priority?: number; is_active?: boolean; conditions: Condition[]; actions: Action[]; }

// 规则创建表单
interface RuleFormCondition { field: string; operator: string; value: string; }
interface RuleFormAction { target_chapter: string; snippet_id: string; }

export default function RulesPage() {
  const [groups, setGroups] = useState<RuleGroup[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(false);

  // 新建规则组
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);

  // 新建规则
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", category: "支护" as string, priority: 0 });
  const [ruleConditions, setRuleConditions] = useState<RuleFormCondition[]>([{ field: "rock_class", operator: "eq", value: "" }]);
  const [ruleActions, setRuleActions] = useState<RuleFormAction[]>([{ target_chapter: "", snippet_id: "" }]);
  const [creatingRule, setCreatingRule] = useState(false);

  // 加载规则组
  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.get("/rules/groups");
      const items = res.data?.data || [];
      setGroups(items);
      if (items.length > 0 && !selectedGroupId) setSelectedGroupId(items[0].id);
    } catch { /* 静默 */ }
    finally { setLoading(false); }
  }, []);

  // 加载规则
  const fetchRules = useCallback(async (groupId: number) => {
    setRulesLoading(true);
    try {
      const res = await api.get(`/rules/groups/${groupId}/rules`);
      setRules(res.data?.data || []);
    } catch { setRules([]); }
    finally { setRulesLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);
  useEffect(() => { if (selectedGroupId) fetchRules(selectedGroupId); }, [selectedGroupId, fetchRules]);

  const toggleRule = (id: number) => {
    setExpandedRules(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // 创建规则组
  const handleCreateGroup = async () => {
    if (!groupForm.name) return;
    setCreating(true);
    try {
      await api.post("/rules/groups", groupForm);
      setGroupForm({ name: "", description: "" });
      setShowCreateGroup(false);
      fetchGroups();
    } catch (e: any) { alert(e.response?.data?.detail || "创建失败"); }
    finally { setCreating(false); }
  };

  // 创建规则（含条件+结论）
  const handleCreateRule = async () => {
    if (!ruleForm.name.trim()) { alert("规则名称不能为空"); return; }
    if (!selectedGroupId) return;

    // 校验条件
    for (const c of ruleConditions) {
      if (!c.value.trim()) { alert("条件值不能为空"); return; }
    }
    // 校验结论
    for (const a of ruleActions) {
      if (!a.target_chapter.trim()) { alert("目标章节不能为空"); return; }
    }

    setCreatingRule(true);
    try {
      await api.post("/rules", {
        group_id: selectedGroupId,
        name: ruleForm.name.trim(),
        category: ruleForm.category,
        priority: ruleForm.priority,
        conditions: ruleConditions.map(c => ({ field: c.field, operator: c.operator, value: c.value.trim() })),
        actions: ruleActions.map(a => ({
          target_chapter: a.target_chapter.trim(),
          snippet_id: a.snippet_id ? parseInt(a.snippet_id) : null,
        })),
      });
      // 重置表单
      setRuleForm({ name: "", category: "支护", priority: 0 });
      setRuleConditions([{ field: "rock_class", operator: "eq", value: "" }]);
      setRuleActions([{ target_chapter: "", snippet_id: "" }]);
      setShowCreateRule(false);
      fetchRules(selectedGroupId);
      fetchGroups(); // 刷新 rule_count
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      alert("创建失败: " + (typeof detail === "string" ? detail : JSON.stringify(detail)));
    } finally { setCreatingRule(false); }
  };

  // 删除规则组
  const deleteGroup = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("删除规则组将级联删除所有规则，确认？")) return;
    try {
      await api.delete(`/rules/groups/${id}`);
      if (selectedGroupId === id) { setSelectedGroupId(null); setRules([]); }
      fetchGroups();
    } catch { alert("删除失败"); }
  };

  // 删除规则
  const deleteRule = async (id: number) => {
    if (!confirm("确认删除该规则？")) return;
    try {
      await api.delete(`/rules/${id}`);
      if (selectedGroupId) { fetchRules(selectedGroupId); fetchGroups(); }
    } catch { alert("删除失败"); }
  };

  // 条件增删
  const addCondition = () => setRuleConditions([...ruleConditions, { field: "rock_class", operator: "eq", value: "" }]);
  const removeCondition = (i: number) => setRuleConditions(ruleConditions.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, key: keyof RuleFormCondition, val: string) => {
    const next = [...ruleConditions]; next[i] = { ...next[i], [key]: val }; setRuleConditions(next);
  };

  // 结论增删
  const addAction = () => setRuleActions([...ruleActions, { target_chapter: "", snippet_id: "" }]);
  const removeAction = (i: number) => setRuleActions(ruleActions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, key: keyof RuleFormAction, val: string) => {
    const next = [...ruleActions]; next[i] = { ...next[i], [key]: val }; setRuleActions(next);
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">规则管理</h2>
          <p className="mt-1 text-sm text-slate-500">配置&quot;地质条件 → 掘进参数 → 规程段落&quot;的精准联动映射</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : (
        <div className="grid grid-cols-12 gap-4" style={{ minHeight: "calc(100vh - 240px)" }}>
          {/* 左侧：规则组列表 */}
          <Card className="col-span-3">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">规则组</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setShowCreateGroup(!showCreateGroup)}>
                <Plus className="h-3 w-3" />新增
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 p-2">
              {showCreateGroup && (
                <div className="mb-3 space-y-2 rounded-lg border bg-blue-50/50 p-3">
                  <Input placeholder="规则组名称" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} />
                  <Input placeholder="描述（可选）" value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={handleCreateGroup} disabled={creating}>
                      {creating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}创建
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowCreateGroup(false)}>取消</Button>
                  </div>
                </div>
              )}
              {groups.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">暂无规则组</p>
              ) : groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => { setSelectedGroupId(group.id); setShowCreateRule(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedGroupId === group.id ? "bg-blue-100 text-blue-800" : "hover:bg-slate-100"
                  }`}
                >
                  <Settings2 className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{group.name}</div>
                    <div className="text-xs text-slate-400">{group.rule_count ?? 0} 条规则</div>
                  </div>
                  <button onClick={(e) => deleteGroup(group.id, e)} className="rounded p-1 text-slate-300 hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* 右侧：规则列表 */}
          <div className="col-span-9 space-y-3">
            {selectedGroup ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{selectedGroup.name}</h3>
                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{rules.length} 条</span>
                  </div>
                  <Button size="sm" className="gap-1" onClick={() => setShowCreateRule(!showCreateRule)}>
                    <Plus className="h-3.5 w-3.5" />添加规则
                  </Button>
                </div>

                {/* ========== 新建规则表单 ========== */}
                {showCreateRule && (
                  <Card className="border-green-200 bg-green-50/30">
                    <CardContent className="space-y-4 pt-4">
                      {/* 基本信息 */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium">规则名称 <span className="text-red-500">*</span></label>
                          <Input value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="如：IV类围岩支护方案" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">分类</label>
                          <select className="w-full rounded-md border px-3 py-2 text-sm" value={ruleForm.category} onChange={e => setRuleForm({ ...ruleForm, category: e.target.value })}>
                            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">优先级</label>
                          <Input type="number" value={ruleForm.priority} onChange={e => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 0 })} />
                        </div>
                      </div>

                      {/* 匹配条件 */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase text-slate-500">匹配条件（AND 逻辑）</label>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={addCondition}><Plus className="h-3 w-3" />添加条件</Button>
                        </div>
                        <div className="space-y-2">
                          {ruleConditions.map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <select className="rounded-md border px-2 py-1.5 text-sm" value={c.field} onChange={e => updateCondition(i, "field", e.target.value)}>
                                {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                              <select className="rounded-md border px-2 py-1.5 text-sm" value={c.operator} onChange={e => updateCondition(i, "operator", e.target.value)}>
                                {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              <Input className="flex-1" placeholder="值" value={c.value} onChange={e => updateCondition(i, "value", e.target.value)} />
                              {ruleConditions.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCondition(i)}>
                                  <X className="h-3.5 w-3.5 text-red-400" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 命中结论 */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase text-slate-500">命中结论</label>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={addAction}><Plus className="h-3 w-3" />添加结论</Button>
                        </div>
                        <div className="space-y-2">
                          {ruleActions.map((a, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input className="flex-1" placeholder="目标章节（如：第五章 顶板管理）" value={a.target_chapter} onChange={e => updateAction(i, "target_chapter", e.target.value)} />
                              <Input className="w-28" placeholder="片段ID" value={a.snippet_id} onChange={e => updateAction(i, "snippet_id", e.target.value)} />
                              {ruleActions.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAction(i)}>
                                  <X className="h-3.5 w-3.5 text-red-400" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowCreateRule(false)}>取消</Button>
                        <Button size="sm" onClick={handleCreateRule} disabled={creatingRule}>
                          {creatingRule && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}创建规则
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {rulesLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
                ) : rules.length === 0 && !showCreateRule ? (
                  <Card className="flex h-40 items-center justify-center">
                    <p className="text-sm text-slate-400">该规则组下暂无规则，点击「添加规则」创建</p>
                  </Card>
                ) : rules.map((rule) => (
                  <Card key={rule.id} className="overflow-hidden">
                    <div className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50" onClick={() => toggleRule(rule.id)}>
                      <div className="flex items-center gap-3">
                        {expandedRules.has(rule.id) ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        <span className="font-medium">{rule.name}</span>
                        {rule.category && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{rule.category}</span>}
                        <span className="text-xs text-slate-400">优先级 {rule.priority || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rule.is_active ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-slate-300" />}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                          onClick={(e) => { e.stopPropagation(); deleteRule(rule.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {expandedRules.has(rule.id) && (
                      <div className="border-t bg-slate-50 px-4 py-3">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase text-slate-400">匹配条件（AND）</div>
                            <div className="space-y-1.5">
                              {(rule.conditions || []).map((c, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm shadow-sm">
                                  <span className="font-medium text-blue-700">{FIELD_LABELS[c.field] || c.field}</span>
                                  <span className="rounded bg-orange-100 px-1.5 text-xs text-orange-700">{OP_LABELS[c.operator] || c.operator}</span>
                                  <span className="font-mono text-slate-600">{c.value}</span>
                                </div>
                              ))}
                              {(!rule.conditions || rule.conditions.length === 0) && <p className="text-xs text-slate-400">暂无条件</p>}
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase text-slate-400">命中结论</div>
                            <div className="space-y-1.5">
                              {(rule.actions || []).map((a, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm shadow-sm">
                                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                                  <span className="font-medium">{a.target_chapter}</span>
                                  {a.snippet_id && <span className="text-xs text-slate-400">片段 #{a.snippet_id}</span>}
                                </div>
                              ))}
                              {(!rule.actions || rule.actions.length === 0) && <p className="text-xs text-slate-400">暂无结论</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                请从左侧选择一个规则组
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
