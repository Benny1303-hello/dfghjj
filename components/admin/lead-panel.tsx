"use client";

import React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export interface LeadData {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  study_level: string | null;
  major: string | null;
  availability: string | null;
  has_booked_consultation: boolean | null;
  notes: string | null;
  lead_quality: "good" | "ok" | "spam" | null;
}

const qualityMeta = {
  good: { label: "Tốt", tone: "green" as const },
  ok: { label: "Tạm ổn", tone: "yellow" as const },
  spam: { label: "Spam", tone: "red" as const },
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export function LeadPanel({
  conversationId,
  initialLead,
}: {
  conversationId: string;
  initialLead: LeadData | null;
}) {
  const [lead, setLead] = React.useState<LeadData | null>(initialLead);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function extract() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/conversations/${conversationId}/extract-lead`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setLead(data.lead);
      } else {
        setError(data.error ?? "Có lỗi xảy ra, thử lại sau.");
      }
    } catch {
      setError("Không kết nối được, thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Thông tin lead</CardTitle>
        <Button size="sm" variant="outline" onClick={extract} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {lead ? "Trích xuất lại" : "Trích xuất bằng AI"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!lead && !error && (
          <p className="text-sm text-muted-foreground">
            Chưa có dữ liệu lead. Bấm &quot;Trích xuất bằng AI&quot; để Gemini đọc hội thoại và tự điền
            thông tin.
          </p>
        )}

        {lead && (
          <>
            <div className="flex flex-wrap gap-2">
              {lead.lead_quality && (
                <StatusBadge
                  tone={qualityMeta[lead.lead_quality].tone}
                  label={`Chất lượng: ${qualityMeta[lead.lead_quality].label}`}
                />
              )}
              <StatusBadge
                tone={lead.has_booked_consultation ? "green" : "gray"}
                label={lead.has_booked_consultation ? "Đã đặt lịch tư vấn" : "Chưa đặt lịch"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Họ tên" value={lead.full_name} />
              <Field label="Email" value={lead.email} />
              <Field label="Số điện thoại" value={lead.phone} />
              <Field label="Quốc gia" value={lead.country} />
              <Field label="Bậc học" value={lead.study_level} />
              <Field label="Ngành học" value={lead.major} />
              <Field label="Thời gian rảnh" value={lead.availability} />
            </div>

            {lead.notes && <Field label="Ghi chú" value={lead.notes} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
