"use client";

import React from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { countries } from "@/lib/mock-data";

interface Message {
  from: "bot" | "user";
  text: string;
}

const initialMessages: Message[] = [
  {
    from: "bot",
    text: "Chào bạn! Mình là trợ lý tư vấn du học của DuHoc24 😊 Bạn đang quan tâm du học ở quốc gia nào, hay đang phân vân giữa vài nước?",
  },
];

const STORAGE_KEY = "duhoc24_chat_conversation_id";

export function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const conversationIdRef = React.useRef<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  // Khôi phục hội thoại đã lưu trên Supabase (nếu trình duyệt này đã từng chat trước đó).
  React.useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) return;

    conversationIdRef.current = savedId;
    fetch(`/api/chat?conversationId=${encodeURIComponent(savedId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.messages?.length) {
          setMessages([...initialMessages, ...data.messages]);
        }
      })
      .catch(() => {});
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { from: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: conversationIdRef.current }),
      });
      const data = await res.json();

      if (res.ok) {
        conversationIdRef.current = data.conversationId;
        localStorage.setItem(STORAGE_KEY, data.conversationId);
        setMessages([...initialMessages, ...data.messages]);
      } else {
        setMessages((prev) => [
          ...prev,
          { from: "bot", text: data.error ?? "Có lỗi xảy ra, thử lại sau." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "Không kết nối được, thử lại sau." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border bg-card shadow-xl shadow-black/10 ring-1 ring-foreground/6.5 sm:w-96">
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-sm font-medium">Tư vấn du học</p>
              <p className="text-xs opacity-80">Trợ lý ảo luôn sẵn sàng hỗ trợ</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Đóng khung chat"
              className="flex size-7 items-center justify-center rounded-full hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                    m.from === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Đang trả lời...
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3">
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {countries.map((c) => (
                  <button
                    key={c}
                    onClick={() => sendMessage(c)}
                    disabled={loading}
                    className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground duration-150 hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập câu hỏi của bạn..."
                disabled={loading}
                className="h-9 flex-1 rounded-full border border-input bg-transparent px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0"
                aria-label="Gửi"
                disabled={loading}
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Đóng khung chat" : "Mở khung chat hỏi đáp"}
        className="ml-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 duration-150 hover:brightness-105 active:scale-95"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
