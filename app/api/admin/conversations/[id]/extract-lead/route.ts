import {
  buildLeadExtractionPrompt,
  LEAD_EXTRACTION_RESPONSE_SCHEMA,
  type ExtractedLead,
} from "@/lib/lead-extraction";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function buildTranscript(messages: { from_role: "user" | "bot"; text: string }[]) {
  return messages
    .map((m) => `${m.from_role === "user" ? "Khách" : "Bot"}: ${m.text}`)
    .join("\n");
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/admin/conversations/[id]/extract-lead">,
) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "Chưa cấu hình GEMINI_API_KEY trên server." },
      { status: 500 },
    );
  }

  const { id: conversationId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: messages, error: msgError } = await supabase
    .from("chat_messages")
    .select("from_role, text")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgError) {
    return Response.json({ error: "Không đọc được hội thoại." }, { status: 500 });
  }
  if (!messages || messages.length === 0) {
    return Response.json({ error: "Hội thoại chưa có tin nhắn nào để trích xuất." }, { status: 400 });
  }

  let extracted: ExtractedLead;
  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildLeadExtractionPrompt(buildTranscript(messages)) }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: LEAD_EXTRACTION_RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      console.error("[extract-lead] gemini HTTP", response.status, await response.text());
      return Response.json({ error: "Gemini trả lỗi khi trích xuất." }, { status: 502 });
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("");

    if (!text) {
      return Response.json({ error: "Gemini không trả về dữ liệu trích xuất." }, { status: 502 });
    }

    extracted = JSON.parse(text) as ExtractedLead;
  } catch (err) {
    console.error("[extract-lead] error", err);
    return Response.json({ error: "Có lỗi xảy ra khi trích xuất, thử lại sau." }, { status: 500 });
  }

  const { data: lead, error: upsertError } = await supabase
    .from("leads")
    .upsert(
      {
        conversation_id: conversationId,
        full_name: extracted.full_name,
        email: extracted.email,
        phone: extracted.phone,
        country: extracted.country,
        study_level: extracted.study_level,
        major: extracted.major,
        availability: extracted.availability,
        has_booked_consultation: extracted.has_booked_consultation,
        notes: extracted.notes,
        lead_quality: extracted.lead_quality,
      },
      { onConflict: "conversation_id" },
    )
    .select()
    .single();

  if (upsertError) {
    console.error("[extract-lead] upsert error", upsertError);
    return Response.json({ error: "Không lưu được lead vào Supabase." }, { status: 500 });
  }

  return Response.json({ lead });
}
