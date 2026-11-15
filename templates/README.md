# templates/

File mẫu và khuôn. `kit init` tạo `ai-kit.yml` từ đây (không ghi đè file đã có); các khuôn tài liệu thì AI đọc tại
chỗ (`spec.templates` ghi đè được).

| File | Dùng thế nào | Tài liệu |
|---|---|---|
| `ai-kit.yml` | `kit init` → `ai-kit.yml` ở gốc dự án (điền `agents`, `guides` dò được) | [11](../docs/11-cau-hinh.md) |
| `prd.md`, `fsd.md` | Khuôn PRD / cách viết FSD cho `/spec`, `/prototype` | [13](../docs/13-tai-lieu-spec.md), [`RULES.md`](../RULES.md) §2 |
| `plan.md` | Khuôn kế hoạch của `/dev` | [10 §3](../docs/10-quy-trinh.md) |
| `prototype.html` | Khuôn HTML tĩnh của `/prototype` | [10 §3](../docs/10-quy-trinh.md) |
| `testcase.md` | Mẫu một file TC (tham khảo) | [02](../docs/02-testcase-format.md) |
