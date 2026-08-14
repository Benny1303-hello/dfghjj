# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Về dự án

`DuHoc24` — repo mẫu cho khoá lập trình 6 tuần, dựng UI cho "Cổng Tiếp Nhận Hồ Sơ Du Học".
Bản hiện tại (Tuần 1) **chỉ có UI tĩnh** — toàn bộ dữ liệu là mock viết cứng trong
[`lib/mock-data.ts`](lib/mock-data.ts). Chưa có API route, chưa nối database, chưa có auth.
Xem lộ trình đầy đủ theo tuần (Gemini API, Supabase, upload/OCR giấy tờ, Make.com, magic-link auth)
trong [`README.md`](README.md) trước khi thêm tính năng backend — nhiều thứ trông như "còn thiếu"
(login, API thật, nút Duyệt/Từ chối có tác dụng) là cố ý chưa làm ở bước này.

## Lệnh thường dùng

```bash
npm install       # bắt buộc trước khi làm gì khác — node_modules chưa được cài trong repo này
npm run dev        # Next.js dev server, http://localhost:3000
npm run build       # production build
npm run lint        # eslint (eslint-config-next core-web-vitals + typescript)
```

Không có test runner nào được cấu hình trong `package.json`.

## Kiến trúc

- **Next.js App Router** (v16, canary/breaking-changes so với kiến thức huấn luyện thông thường —
  đọc kỹ ghi chú trong [`AGENTS.md`](AGENTS.md) trước khi viết code, đặc biệt là các API route,
  layout, và data fetching có thể khác so với Next.js quen thuộc).
- Toàn bộ state là client-side (`useState`), không có server actions/route handlers thật —
  submit form chỉ set state `submitted = true`, không gọi API nào (ví dụ
  [`components/landing/quote-form.tsx`](components/landing/quote-form.tsx)).
- **Hai khu vực UI tách biệt**, mỗi khu có layout/chrome riêng:
  - `/` (khách) — `SiteHeader` + nội dung landing (`Hero`, `QuoteForm`, `Highlights`) + `SiteFooter` +
    `ChatWidget` nổi. Xem [`app/page.tsx`](app/page.tsx).
  - `/portal` — cổng học viên demo, dùng `currentStudent` (hồ sơ hard-code sẵn) trong mock-data,
    không có chọn user.
  - `/admin/*` — dashboard nội bộ, dùng chung [`app/admin/layout.tsx`](app/admin/layout.tsx) với
    `AdminSidebar`/`AdminMobileNav` ([`components/admin/sidebar.tsx`](components/admin/sidebar.tsx)).
    `/admin` tự redirect sang `/admin/requests`. Điều hướng admin định nghĩa tập trung trong
    `adminNavItems` — thêm trang admin mới thì thêm vào mảng đó để tự có trong sidebar + mobile nav.
- **Nguồn dữ liệu duy nhất**: [`lib/mock-data.ts`](lib/mock-data.ts) — export types
  (`DocStatus`, `RequestStatus`, `ServicePackage`, `School`, `AdmissionRequest`, `StudentProfile`,
  `Conversation`...) và data (`schools`, `servicePackages`, `admissionRequests`, `studentProfiles`,
  `conversations`, `currentStudent`). Khi thêm UI cần dữ liệu mới, mở rộng file này thay vì hard-code
  rải rác trong component — các tuần sau sẽ thay thế trực tiếp file này bằng Supabase.
- **Status/badge dùng chung**: [`components/status-badge.tsx`](components/status-badge.tsx) định nghĩa
  mapping `DocStatus`/`RequestStatus` → label/màu/icon (`docStatusMeta`, `requestStatusMeta`) và các
  component `DocStatusBadge`, `RequestStatusBadge`, `StatusBadge`, `StatusDot`. Thêm status mới thì sửa
  type trong mock-data.ts rồi bổ sung mapping ở đây, không tự vẽ badge riêng trong page.
- **shadcn/ui** (`components/ui/*`), style `base-nova` trên nền Base UI, cấu hình trong
  [`components.json`](components.json) (alias `@/components`, `@/lib`, `@/ui`, baseColor `neutral`).
  Thêm component shadcn mới qua CLI `npx shadcn add <name>` để đồng bộ style thay vì tự copy code.
  Registry ngoài `@tailark-oss` (`https://oss.tailark.com/r/{name}.json`) dùng cho khối landing nền
  (`@tailark-oss/dusk-landing-2`, đã tuỳ biến sang light theme + nội dung du học).
- **Tailwind CSS v4**, cấu hình qua `app/globals.css` (không có `tailwind.config.*` riêng — v4 dùng
  CSS-based config).
- Toàn bộ UI text là tiếng Việt (`lang="vi"` trong root layout, font `Be_Vietnam_Pro`). Giữ nguyên
  tiếng Việt khi thêm string mới, không dịch sang tiếng Anh.
- Biến môi trường cho các tuần sau (Supabase, site URL) liệt kê trong [`.env.example`](.env.example) —
  chưa cần thiết để `npm run dev` chạy ở bản hiện tại.

## Quy tắc Git

- Luôn hỏi xác nhận trước khi push lên GitHub.
- Không bao giờ commit file `.env` hoặc bất kỳ file chứa API key.
