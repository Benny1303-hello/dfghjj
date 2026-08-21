import { buildChatSystemInstruction, SAVE_LEAD_FUNCTION_DECLARATION } from "@/lib/chat-persona";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface ChatRow {
  from_role: "bot" | "user";
  text: string;
}

interface LeadArgs {
  full_name: string;
  email: string;
  phone: string;
  country?: string;
  study_level?: string;
  major?: string;
  notes?: string;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  thoughtSignature?: string;
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

async function callGeminiRaw(body: unknown) {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error("[gemini] HTTP", response.status, await response.text());
    throw new Error("gemini_error");
  }
  return response.json();
}

function extractParts(data: { candidates?: { content?: { parts?: GeminiPart[] } }[] }): GeminiPart[] {
  return data?.candidates?.[0]?.content?.parts ?? [];
}

function extractText(parts: GeminiPart[]): string {
  return parts.map((p) => p.text ?? "").join("");
}

function parseLead(args: Record<string, unknown>): LeadArgs | undefined {
  if (
    typeof args.full_name !== "string" ||
    !args.full_name.trim() ||
    typeof args.email !== "string" ||
    !args.email.trim() ||
    typeof args.phone !== "string" ||
    !args.phone.trim()
  ) {
    return undefined;
  }

  const asString = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  return {
    full_name: args.full_name,
    email: args.email,
    phone: args.phone,
    country: asString(args.country),
    study_level: asString(args.study_level),
    major: asString(args.major),
    notes: asString(args.notes),
  };
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

// Chống model tự bịa email/số điện thoại: chỉ chấp nhận lead nếu email/SĐT
// thực sự xuất hiện trong những gì người dùng đã tự gõ trong hội thoại.
function isLeadGrounded(lead: LeadArgs, history: ChatRow[], currentMessage: string): boolean {
  const userText = [
    ...history.filter((h) => h.from_role === "user").map((h) => h.text),
    currentMessage,
  ].join(" \n ");

  const emailOk = userText.toLowerCase().includes(lead.email.trim().toLowerCase());
  const phoneDigits = onlyDigits(lead.phone);
  const phoneOk = phoneDigits.length >= 8 && onlyDigits(userText).includes(phoneDigits);

  return emailOk && phoneOk;
}

async function runChat(history: ChatRow[], message: string): Promise<{ reply: string; lead?: LeadArgs }> {
  const contents = [
    ...history.map((turn) => ({
      role: turn.from_role === "user" ? "user" : "model",
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const baseBody = {
    systemInstruction: { parts: [{ text: buildChatSystemInstruction() }] },
    tools: [{ functionDeclarations: [SAVE_LEAD_FUNCTION_DECLARATION] }],
    generationConfig: { temperature: 0.4 },
  };

  const first = await callGeminiRaw({ ...baseBody, contents });
  const parts = extractParts(first);
  const functionCallPart = parts.find((p) => p.functionCall);

  if (!functionCallPart?.functionCall) {
    const reply = extractText(parts);
    if (!reply) {
      console.error("[gemini] empty reply, parts:", JSON.stringify(parts));
      throw new Error("gemini_empty_reply");
    }
    return { reply };
  }
  const parsedLead = parseLead(functionCallPart.functionCall.args);
  const lead = parsedLead && isLeadGrounded(parsedLead, history, message) ? parsedLead : undefined;

  const followupContents = [
    ...contents,
    // Giữ nguyên part gốc (gồm cả thoughtSignature) — Gemini API bắt buộc phải có
    // thoughtSignature khi gửi lại lượt functionCall của model, thiếu sẽ bị 400.
    { role: "model", parts: [functionCallPart] },
    {
      // Gemini API không nhận role "function" cho lượt phản hồi function call — phải dùng "user".
      role: "user",
      parts: [
        {
          functionResponse: {
            name: "save_lead",
            response: { success: Boolean(lead) },
          },
        },
      ],
    },
  ];

  const second = await callGeminiRaw({ ...baseBody, contents: followupContents });
  const reply = extractText(extractParts(second));
  if (!reply) throw new Error("gemini_empty_reply");

  return { reply, lead };
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

    const { reply, lead } = await runChat(history, message);

    const { error: insertError } = await supabase.from("chat_messages").insert([
      { conversation_id: convId, from_role: "user", text: message },
      { conversation_id: convId, from_role: "bot", text: reply },
    ]);
    if (insertError) throw insertError;

    if (lead) {
      const { error: leadError } = await supabase.from("leads").upsert(
        {
          conversation_id: convId,
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          country: lead.country ?? null,
          study_level: lead.study_level ?? null,
          major: lead.major ?? null,
          notes: lead.notes ?? null,
        },
        { onConflict: "conversation_id" },
      );
      if (leadError) throw leadError;
    }

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
