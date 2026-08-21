import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Luôn đọc dữ liệu mới nhất từ Supabase, không cache lại HTML tĩnh lúc build.
export const dynamic = "force-dynamic";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function AdminConversationsPage() {
  const supabase = getSupabaseAdmin();

  const [{ data: conversations, error: convError }, { data: messages, error: msgError }] =
    await Promise.all([
      supabase
        .from("chat_conversations")
        .select("id, channel, started_at")
        .order("started_at", { ascending: false }),
      supabase.from("chat_messages").select("conversation_id"),
    ]);

  const messageCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    messageCounts.set(m.conversation_id, (messageCounts.get(m.conversation_id) ?? 0) + 1);
  }

  return (
    <>
      <AdminPageHeader
        title="Hội thoại"
        description="Lịch sử hội thoại của khách với chatbot hỏi đáp trên trang chủ."
      />

      <Card>
        {convError || msgError ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Không tải được dữ liệu hội thoại, thử lại sau.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kênh</TableHead>
                <TableHead>Số tin nhắn</TableHead>
                <TableHead>Thời gian bắt đầu</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(conversations ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Chưa có hội thoại nào.
                  </TableCell>
                </TableRow>
              )}
              {(conversations ?? []).map((conv) => (
                <TableRow key={conv.id}>
                  <TableCell className="font-medium">{conv.channel}</TableCell>
                  <TableCell>{messageCounts.get(conv.id) ?? 0} tin nhắn</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(conv.started_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/conversations/${conv.id}`}
                      className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
                    >
                      Xem chi tiết
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
