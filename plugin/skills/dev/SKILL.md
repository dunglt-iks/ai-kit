---
name: dev
description: Triển khai một việc từ spec đã duyệt (kế hoạch, code, test, review), đồng bộ khi spec đổi, hoặc sửa bug từ issue
argument-hint: <đường dẫn file spec> <mã feature | mã việc nhỏ> | #<số issue>
disable-model-invocation: true
---
Triển khai theo spec: $ARGUMENTS

Đọc `<kit>/process/dev.md` rồi làm đúng theo đó với đầu vào trên.

`<kit>` = thư mục gói ai-kit trong dự án: dòng `Kit` khi chạy `npx --no kit context` (thường `node_modules/ai-kit`).
Lệnh báo không có `kit` (dự án chưa cài gói ai-kit) thì dừng, báo người dùng: `npm install` (gói `ai-kit` trong
devDependencies), hoặc nhúng kit theo README của ai-kit — không tự cài.
