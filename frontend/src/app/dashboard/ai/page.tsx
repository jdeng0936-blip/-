"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Send,
  User,
  Loader2,
  Sparkles,
  Wrench,
  AlertTriangle,
} from "lucide-react";

/** API 基础地址 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

/** 快捷提示 */
const QUICK_PROMPTS = [
  "IV 类围岩拱形断面 5×4m，帮我算支护参数",
  "高瓦斯矿井掘进面风量怎么计算？",
  "钻爆法循环作业时间怎么排？",
  "帮我推荐掘进工作面安全措施",
];

interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** 发送消息（SSE 流式） */
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // 构建历史（最近 10 条）
    const history = messages.slice(-10).map((m) => ({
      role: m.role === "tool" ? "assistant" : m.role,
      content: m.content,
    }));

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          message: text,
          history,
          stream: true,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      // 先添加空的助手消息
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const evt = JSON.parse(data);

            if (evt.type === "tool_start") {
              // 显示工具调用（兼容 name / tool_name 两种字段）
              const toolName = evt.name || evt.tool_name;
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: "tool", content: `正在调用: ${toolName}`, toolName },
                { role: "assistant", content: assistantContent },
              ]);
            } else if (evt.type === "tool_done") {
              // 工具完成（兼容 name / tool_name）
              const toolName = evt.name || evt.tool_name;
              setMessages((prev) => {
                const list = [...prev];
                const toolIdx = list.findLastIndex((m) => m.role === "tool");
                if (toolIdx >= 0) {
                  list[toolIdx].content = `✅ ${toolName} 完成`;
                }
                return list;
              });
            } else if (evt.type === "text" || evt.type === "content") {
              // 文本流（兼容 content / text 两种字段名）
              assistantContent += evt.content || evt.text || "";
              setMessages((prev) => {
                const list = [...prev];
                list[list.length - 1] = { role: "assistant", content: assistantContent };
                return list;
              });
            }
          } catch {
            // 非 JSON 数据，当做纯文本流
            assistantContent += data;
            setMessages((prev) => {
              const list = [...prev];
              list[list.length - 1] = { role: "assistant", content: assistantContent };
              return list;
            });
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ 请求失败: ${err.message}。请检查后端是否运行以及 API Key 是否配置。`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-3 border-b bg-white px-6 py-3 dark:bg-slate-900">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">AI 智能助手</h2>
          <p className="text-xs text-slate-400">支护计算 · 通风校核 · 循环排程 · 安全建议</p>
        </div>
      </div>

      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-700">有什么可以帮你？</h3>
              <p className="mt-1 text-sm text-slate-400">试试下面的快捷问题，或直接输入你的需求</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  className="rounded-xl border bg-white px-4 py-3 text-left text-sm text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role !== "user" && (
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  msg.role === "tool"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                }`}
              >
                {msg.role === "tool" ? (
                  <Wrench className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
            )}

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : msg.role === "tool"
                  ? "border border-amber-200 bg-amber-50 text-amber-800"
                  : "border bg-white text-slate-700 shadow-sm"
              }`}
            >
              {msg.content.includes("⚠️") ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <span>{msg.content}</span>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                <User className="h-4 w-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
            <div className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
              思考中...
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t bg-white px-6 py-4 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Input
            className="flex-1"
            placeholder="输入问题，例如：帮我计算通风量..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            disabled={loading}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4" /> 发送
          </Button>
        </div>
      </div>
    </div>
  );
}
