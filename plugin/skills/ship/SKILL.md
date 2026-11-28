---
name: ship
description: Rebase lên nhánh gốc, chạy kiểm tra cuối, mở Pull Request và theo dõi CI
disable-model-invocation: true
---
Đọc `<kit>/process/ship.md` rồi làm đúng theo đó.

`<kit>` = thư mục gói ai-kit trong dự án: dòng `Kit` khi chạy `npx --no kit context` (thường `node_modules/ai-kit`).
Lệnh báo không có `kit` (dự án chưa cài gói ai-kit) thì dừng, báo người dùng: `npm install` (gói `ai-kit` trong
devDependencies), hoặc nhúng kit theo README của ai-kit — không tự cài.
