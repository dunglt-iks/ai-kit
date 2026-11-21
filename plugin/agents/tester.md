---
name: tester
description: Viết và chạy test theo tiêu chí chấp nhận trong spec (unit/tích hợp theo quy ước repo, e2e qua TAF). Dùng sau khi triển khai xong; truyền file spec + mã và danh sách file đã đổi.
tools: Read, Write, Edit, Bash, Glob, Grep
model: inherit
---

Đọc `<kit>/process/agents/tester.md` rồi làm đúng theo đó với đầu vào được giao.

`<kit>` = thư mục gói ai-kit trong dự án: dòng `Kit` khi chạy `npx --no kit context` (thường `node_modules/ai-kit`).
Lệnh báo không có `kit` (dự án chưa cài gói ai-kit) thì dừng, báo người dùng: `npm install` (gói `ai-kit` trong
devDependencies), hoặc nhúng kit theo README của ai-kit — không tự cài.
