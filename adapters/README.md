# adapters/

Điểm cắm để framework chạy với dự án khác nhau. Chọn trong `ai-kit.yml`: tên adapter có sẵn ở đây, hoặc đường dẫn `./…mjs` tới adapter dự án tự viết.

| Loại | Khai ở | Có sẵn | Hợp đồng |
|---|---|---|---|
| `spec/` | `spec.adapter` | `prd-fsd`: PRD + FSD (khuôn ở `templates/`; định dạng gốc lấy từ app-base) | [01 §2](../docs/01-architecture.md) |
| `tracker/` | `tracker.adapter` | `github` | [07 §5](../docs/07-bug-reporting.md) |
| `agent/` | `agents` | `claude` (plugin `kit` + luật deny trong `.claude/settings.json`, khối trong CLAUDE.md) | [10 §2](../docs/10-quy-trinh.md) — trả về `{ name, instructionFile, autoLoads, commandPrefix, settingsFile, settings() }`; chỉ dùng adapter có sẵn. Công cụ khác (vd Antigravity) thêm adapter mới ở đây |
