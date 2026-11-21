---
name: e2e-triage
description: Phân loại test e2e fail (lần chạy ở máy hoặc trên CI), sửa script sai, ghi bug app sau khi người dùng đồng ý
argument-hint: "[run-id | link lần chạy CI | #PR]"
disable-model-invocation: true
---
Đầu vào: $ARGUMENTS

Đọc `<kit>/process/e2e-triage.md` rồi làm đúng theo đó với đầu vào trên.

`<kit>` = thư mục gói ai-kit trong dự án: dòng `Kit` khi chạy `npx --no kit context` (thường `node_modules/ai-kit`).
Lệnh báo không có `kit` (dự án chưa cài gói ai-kit) thì dừng, báo người dùng: `npm install` (gói `ai-kit` trong
devDependencies), hoặc nhúng kit theo README của ai-kit — không tự cài.
