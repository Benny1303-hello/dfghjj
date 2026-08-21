import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
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

const qualityMeta = {
  good: { label: "Tốt", tone: "green" as const },
  ok: { label: "Tạm ổn", tone: "yellow" as const },
  spam: { label: "Spam", tone: "red" as const },
};

export default async function AdminLeadsPage() {
  const { data: leads, error } = await getSupabaseAdmin()
    .from("leads")
    .select(
      "id, conversation_id, full_name, email, phone, country, study_level, major, lead_quality, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <>
      <AdminPageHeader
        title="Lead tư vấn"
        description="Thông tin liên hệ chatbot thu thập được từ khách quan tâm du học."
      />

      <Card>
        {error ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Không tải được danh sách lead, thử lại sau.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Số điện thoại</TableHead>
                <TableHead>Quốc gia</TableHead>
                <TableHead>Bậc học</TableHead>
                <TableHead>Ngành</TableHead>
                <TableHead>Chất lượng</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(leads ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Chưa có lead nào.
                  </TableCell>
                </TableRow>
              )}
              {(leads ?? []).map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.phone ?? "—"}</TableCell>
                  <TableCell>{lead.country ?? "—"}</TableCell>
                  <TableCell>{lead.study_level ?? "—"}</TableCell>
                  <TableCell>{lead.major ?? "—"}</TableCell>
                  <TableCell>
                    {lead.lead_quality ? (
                      <StatusBadge
                        tone={qualityMeta[lead.lead_quality].tone}
                        label={qualityMeta[lead.lead_quality].label}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(lead.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/conversations/${lead.conversation_id}`}
                      className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
                    >
                      Xem hội thoại
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
