# CLAUDE.md — Đơn hàng demo

## Kỹ thuật

- App: Node.js ≥ 20, ESM thuần, không framework, không phụ thuộc runtime. Một file `app/server.mjs` (HTTP server,
  dữ liệu trong bộ nhớ) và trang tĩnh `app/pages/*.html`.
- Chạy: `npm run app` (cổng 4310, bật test API). `DEMO_BUG=discount` bật lỗi cài sẵn (bỏ chiết khấu khi số lượng ≥ 10).
- Không thêm thư viện runtime. Phân quyền kiểm ở server theo vai trò trong cookie phiên (`sale`, `manager`), không
  tin dữ liệu gửi từ trình duyệt.
- Kiểm cú pháp: `node --check` trên file đã đổi.
- Test: chỉ có e2e (Playwright, `e2e/`). Quy ước viết test và page object: `e2e/GUIDE.md`. Không có unit test.
  Chạy: `npm run app` ở một terminal, `npx playwright test` ở terminal khác; hoặc `bash ci/app-up.sh` / `ci/app-down.sh`.

## Tài liệu

- Yêu cầu ở `docs/features/addon/DM-demo/` (PRD + FSD). Mã feature dạng `DM-F01`; cột Spec của bảng Feature Summary
  ghi `Nháp` / `Đã duyệt`.
