import { buildChatSystemInstruction } from "@/lib/chat-qna";

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface ChatTurn {
  from: "bot" | "user";
  text: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Chưa cấu hình GEMINI_API_KEY trên server." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const message: unknown = body?.message;
  const history: unknown = body?.history;

  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Thiếu nội dung câu hỏi." }, { status: 400 });
  }

  const historyTurns: ChatTurn[] = Array.isArray(history)
    ? history.filter(
        (m): m is ChatTurn =>
          m && typeof m.text === "string" && (m.from === "bot" || m.from === "user"),
      )
    : [];

  const contents = [
    ...historyTurns.map((turn) => ({
      role: turn.from === "user" ? "user" : "model",
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildChatSystemInstruction() }] },
        contents,
        generationConfig: { temperature: 0.2 },
      }),
    });
  } catch {
    return Response.json(
      { error: "Không kết nối được tới Gemini, thử lại sau." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return Response.json(
      { error: "Gemini trả lỗi, thử lại sau." },
      { status: 502 },
    );
  }

  const data = await response.json();
  const reply: string | undefined =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");

  if (!reply) {
    return Response.json(
      { error: "Không nhận được câu trả lời từ Gemini." },
      { status: 502 },
    );
  }

  return Response.json({ reply });
}
