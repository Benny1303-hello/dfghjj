import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { LeadPanel } from "@/components/admin/lead-panel";
import { cn } from "@/lib/utils";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Luôn đọc dữ liệu mới nhất từ Supabase, không cache lại HTML tĩnh lúc build.
export const dynamic = "force-dynamic";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function AdminConversationDetailPage({
  params,
}: PageProps<"/admin/conversations/[id]">) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const [{ data: conversation }, { data: messages, error: msgError }, { data: lead }] = await Promise.all([
    supabase.from("chat_conversations").select("id, channel, started_at").eq("id", id).single(),
    supabase
      .from("chat_messages")
      .select("from_role, text, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("leads")
      .select(
        "full_name, email, phone, country, study_level, major, availability, has_booked_consultation, notes, lead_quality",
      )
      .eq("conversation_id", id)
      .maybeSingle(),
  ]);

  if (!conversation) notFound();

  return (
    <>
      <Link
        href="/admin/conversations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Quay lại danh sách hội thoại
      </Link>

      <AdminPageHeader
        title={`Hội thoại · ${conversation.channel}`}
        description={`Bắt đầu lúc ${formatDateTime(conversation.started_at)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="space-y-3 p-6">
          {msgError && (
            <p className="text-center text-sm text-muted-foreground">
              Không tải được tin nhắn, thử lại sau.
            </p>
          )}
          {!msgError && (messages ?? []).length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Hội thoại này chưa có tin nhắn nào.
            </p>
          )}
          {(messages ?? []).map((m, i) => (
            <div key={i} className={cn("flex", m.from_role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] space-y-1 rounded-2xl px-3.5 py-2 text-sm",
                  m.from_role === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted text-foreground",
                )}
              >
                <p>{m.text}</p>
                <p
                  className={cn(
                    "text-[0.7rem]",
                    m.from_role === "user" ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {formatDateTime(m.created_at)}
                </p>
              </div>
            </div>
          ))}
        </Card>

        <LeadPanel conversationId={id} initialLead={lead ?? null} />
      </div>
    </>
  );
}
