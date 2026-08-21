import { buildChatSystemInstruction } from "@/lib/chat-qna";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface ChatRow {
  from_role: "bot" | "user";
  text: string;
}

async function fetchMessages(conversationId: string): Promise<ChatRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("chat_messages")
    .select("from_role, text")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as ChatRow[];
}

async function callGemini(history: ChatRow[], message: string) {
  const contents = [
    ...history.map((turn) => ({
      role: turn.from_role === "user" ? "user" : "model",
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildChatSystemInstruction() }] },
      contents,
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!response.ok) throw new Error("gemini_error");

  const data = await response.json();
  const reply: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");

  if (!reply) throw new Error("gemini_empty_reply");
  return reply;
}

// GET /api/chat?conversationId=... — nạp lại lịch sử hội thoại từ Supabase để hiển thị.
export async function GET(request: Request) {
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) {
    return Response.json({ error: "Thiếu conversationId." }, { status: 400 });
  }

  try {
    const rows = await fetchMessages(conversationId);
    return Response.json({
      messages: rows.map((r) => ({ from: r.from_role, text: r.text })),
    });
  } catch {
    return Response.json({ error: "Không đọc được lịch sử hội thoại." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "Chưa cấu hình GEMINI_API_KEY trên server." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const message: unknown = body?.message;
  const conversationId: unknown = body?.conversationId;

  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Thiếu nội dung câu hỏi." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    let convId: string;
    let history: ChatRow[];

    if (typeof conversationId === "string" && conversationId) {
      convId = conversationId;
      history = await fetchMessages(convId);
    } else {
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({ channel: "Web" })
        .select("id")
        .single();
      if (error) throw error;
      convId = data.id as string;
      history = [];
    }

    const reply = await callGemini(history, message);

    const { error: insertError } = await supabase.from("chat_messages").insert([
      { conversation_id: convId, from_role: "user", text: message },
      { conversation_id: convId, from_role: "bot", text: reply },
    ]);
    if (insertError) throw insertError;

    const messages = [
      ...history.map((r) => ({ from: r.from_role, text: r.text })),
      { from: "user" as const, text: message },
      { from: "bot" as const, text: reply },
    ];

    return Response.json({ conversationId: convId, messages });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    const message =
      reason === "gemini_error" || reason === "gemini_empty_reply"
        ? "Gemini trả lỗi, thử lại sau."
        : "Có lỗi xảy ra, thử lại sau.";
    return Response.json({ error: message }, { status: 502 });
  }
}
