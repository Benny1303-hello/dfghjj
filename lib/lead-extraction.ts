// Trích xuất thông tin lead từ một hội thoại đã có, dùng ở trang admin.
// Khác với save_lead trong luồng chat trực tiếp (chỉ lưu khi bot tự thu thập đủ
// trong hội thoại), tính năng này đọc lại TOÀN BỘ transcript và suy luận thêm
// các trường đánh giá (availability, đã đặt lịch chưa, chất lượng lead).

export interface ExtractedLead {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  study_level: string | null;
  major: string | null;
  availability: string | null;
  has_booked_consultation: boolean;
  notes: string | null;
  lead_quality: "good" | "ok" | "spam";
}

export function buildLeadExtractionPrompt(transcript: string) {
  return `Bạn là hệ thống trích xuất dữ liệu cho đội tư vấn du học. Đọc đoạn hội thoại giữa chatbot tư vấn và khách dưới đây, rồi trích xuất thông tin đúng theo schema JSON đã cho.

QUY TẮC BẮT BUỘC:
- CHỈ điền giá trị nếu thông tin đó THỰC SỰ xuất hiện rõ ràng trong hội thoại — TUYỆT ĐỐI không suy đoán hay bịa. Nếu không có, để null.
- "availability": thời gian khách rảnh để được tư vấn, chỉ điền nếu khách có nhắc tới.
- "has_booked_consultation": true nếu khách đã xác nhận đồng ý/đặt lịch tư vấn bằng lời trong hội thoại, false nếu không đề cập hoặc từ chối.
- "lead_quality":
  - "good": khách nghiêm túc, đã cung cấp đủ thông tin liên hệ hợp lệ (ít nhất họ tên + email hoặc số điện thoại) và có nhu cầu du học rõ ràng.
  - "ok": khách có tiềm năng nhưng thông tin liên hệ chưa đầy đủ, hoặc nhu cầu chưa rõ ràng.
  - "spam": nội dung hội thoại là rác, thử nghiệm, vô nghĩa, hoặc không liên quan đến du học.

HỘI THOẠI:
${transcript}`;
}

export const LEAD_EXTRACTION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    full_name: { type: "STRING", nullable: true },
    email: { type: "STRING", nullable: true },
    phone: { type: "STRING", nullable: true },
    country: { type: "STRING", nullable: true },
    study_level: { type: "STRING", nullable: true },
    major: { type: "STRING", nullable: true },
    availability: { type: "STRING", nullable: true },
    has_booked_consultation: { type: "BOOLEAN" },
    notes: { type: "STRING", nullable: true },
    lead_quality: { type: "STRING", enum: ["good", "ok", "spam"] },
  },
  required: ["has_booked_consultation", "lead_quality"],
} as const;
