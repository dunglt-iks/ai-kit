---
name: prototype
description: Dựng/cập nhật prototype HTML tĩnh từ màn hình trong spec, đồng bộ ngược thay đổi giao diện về spec
argument-hint: <đường dẫn file spec> <mã feature hoặc module>
disable-model-invocation: true
---
Làm prototype cho: $ARGUMENTS

Đọc `<kit>/process/prototype.md` rồi làm đúng theo đó với đầu vào trên.

`<kit>` = thư mục gói ai-kit trong dự án: dòng `Kit` khi chạy `npx --no kit context` (thường `node_modules/ai-kit`).
Lệnh báo không có `kit` (dự án chưa cài gói ai-kit) thì dừng, báo người dùng: `npm install` (gói `ai-kit` trong
devDependencies), hoặc nhúng kit theo README của ai-kit — không tự cài.
