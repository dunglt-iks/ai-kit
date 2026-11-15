# process/

Quy trình từng bước cho AI. Vỏ lệnh trong dự án (`.claude/commands/*.md`, khối cầu nối trong `AGENTS.md`) chỉ trỏ tới
đây, nên đổi phiên bản kit là đổi quy trình. Quy tắc chung: [`../RULES.md`](../RULES.md). Thiết kế:
[docs/10](../docs/10-quy-trinh.md).

| File | Lệnh | Việc |
|---|---|---|
| `spec.md` | `/spec` | Phỏng vấn, ghi yêu cầu vào PRD/FSD (nháp), duyệt từng mã |
| `prototype.md` | `/prototype` | HTML tĩnh từ wireframe, đồng bộ ngược phần giao diện |
| `dev.md` | `/dev` | Kế hoạch → code → tester → reviewer; chế độ mới / đồng bộ / sửa bug (`#issue`) |
| `testcase.md` | `/testcase` | Trỏ tới `prompts/testcase.md` (TAF) |
| `e2e-script.md` | `/e2e-script` | `plan-gen` → `prompts/script.md` → kiểm → hỏi rồi chạy thử (TAF) |
| `e2e-triage.md` | `/e2e-triage` | Phân loại test fail (ở máy / tải từ CI) theo `prompts/triage.md`, sửa script, ghi bug khi được đồng ý |
| `ship.md` | `/ship` | Rebase, kiểm tra cuối, PR, theo dõi CI |
| `adopt.md` | `/kit-adopt` | Đề xuất `ai-kit.yml`, liệt kê mâu thuẫn guides ↔ kit |
| `agents/spec-reviewer.md` | agent `spec-reviewer` | Soát spec và đối chiếu spec ↔ prototype độc lập trước khi duyệt; `/spec`, `/prototype` tự gọi |
| `agents/tester.md` | agent `tester` | Viết, chạy test theo spec; e2e qua TAF |
| `agents/reviewer.md` | agent `reviewer` | Review độc lập: quy trình (yêu cầu, truy vết, e2e, tài liệu) + kỹ thuật theo guides |

Mỗi file mở đầu bằng **bước 0**: `kit context` → đọc `guides` → đọc `RULES.md`. Viết trung tính: không stack, không mã
hay đường dẫn của một dự án — giá trị lấy từ `ai-kit.yml`.
