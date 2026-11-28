---
name: e2e-script
description: Sinh hoặc cập nhật script e2e (Playwright) từ test case đã duyệt, kiểm và chạy thử ở máy trước khi mở PR
argument-hint: <mã feature…>
disable-model-invocation: true
---
Mã feature: $ARGUMENTS

Đọc `<kit>/process/e2e-script.md` rồi làm đúng theo đó với đầu vào trên.

`<kit>` = thư mục gói ai-kit trong dự án: dòng `Kit` khi chạy `npx --no kit context` (thường `node_modules/ai-kit`).
Lệnh báo không có `kit` (dự án chưa cài gói ai-kit) thì dừng, báo người dùng: `npm install` (gói `ai-kit` trong
devDependencies), hoặc nhúng kit theo README của ai-kit — không tự cài.
