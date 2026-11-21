---
name: reviewer
description: Review độc lập thay đổi so với nhánh gốc trước khi mở PR, theo spec, quy trình ai-kit và quy ước kỹ thuật của repo. Chỉ đọc và báo cáo, không sửa code.
tools: Read, Grep, Glob, Bash
model: inherit
---

Đọc `<kit>/process/agents/reviewer.md` rồi làm đúng theo đó với đầu vào được giao.

`<kit>` = thư mục gói ai-kit trong dự án: dòng `Kit` khi chạy `npx --no kit context` (thường `node_modules/ai-kit`).
Lệnh báo không có `kit` (dự án chưa cài gói ai-kit) thì dừng, báo người dùng: `npm install` (gói `ai-kit` trong
devDependencies), hoặc nhúng kit theo README của ai-kit — không tự cài.
