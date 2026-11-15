# cli/

Công cụ dòng lệnh `kit` (Node.js ≥ 20, JavaScript ESM có `// @ts-check`, phụ thuộc duy nhất `yaml`). Mọi lệnh đều tất
định, không gọi AI.

Chạy với cwd là repo dự án: `node .ai-kit/cli/bin/kit.mjs <lệnh>` (`--help` để xem tuỳ chọn). Unit test: `npm test` ở
gốc repo này.

| Lệnh | Việc làm | Tài liệu |
|---|---|---|
| `kit init` | Nhúng / cập nhật kit (chạy lại được): `ai-kit.yml`, vỏ lệnh/agent, khối cầu nối, `.gitignore`; tự kiểm | [10 §4](../docs/10-quy-trinh.md) |
| `kit doctor`, `kit context`, `kit next-code` | Kiểm việc nhúng; ngữ cảnh cho AI; cấp mã | [11 §4](../docs/11-cau-hinh.md) |
| `kit approve`, `kit ready` | Người duyệt spec / prototype / test case (ghi người, ngày); cổng trước TC / script / code | [10 §3.1](../docs/10-quy-trinh.md) |
| `kit check-prototype` | Đối chiếu spec ↔ prototype (màn hình, thành phần) | [10 §3.2](../docs/10-quy-trinh.md) |
| `kit e2e` | **Điểm cắm CI** và chạy e2e ở máy: phạm vi (none / changed / all / mã) → gate → chạy `run.command` → báo cáo | [04](../docs/04-ci-workflow.md) |
| `kit spec <mã>` | In luồng/nhánh/màn hình cần phủ, trạng thái duyệt, specHash (`--json` cho prompt) | [02 §4](../docs/02-testcase-format.md) |
| `kit gate` | Kiểm TC: có, đã duyệt, phủ đủ US/A/E/SCR, `specHash` khớp; script có và khớp TC | [02 §3–4](../docs/02-testcase-format.md) |
| `kit lint-tc` | Kiểm cú pháp TC markdown | [02 §2](../docs/02-testcase-format.md) |
| `kit plan-gen`, `check-script`, `check-paths`, `lint-script`, `rehash` | Script: cần sinh gì, khớp TC, chỉ ghi chỗ được phép | [03](../docs/03-script-generation.md) |
| `kit report`, `kit file-bugs` | Bảng kết quả theo feature (kèm `triage.json`); ghi / đóng issue theo fingerprint | [07](../docs/07-bug-reporting.md) |

## Mã nguồn

| File | Nội dung |
|---|---|
| `bin/kit.mjs` | Điểm vào, phân lệnh |
| `src/init.mjs`, `src/bridge.mjs` | `kit init`: cấu hình, dò guides, vỏ lệnh/agent, khối cầu nối |
| `src/context.mjs` | `kit context`, `doctor`, `next-code` |
| `src/approve.mjs` | `kit approve`, `kit ready` |
| `src/prototype.mjs` | `kit check-prototype` |
| `src/config.mjs` | Đọc `ai-kit.yml` (hoặc `taf.config.yml` 1.x, chuyển sang v2), giá trị mặc định, nạp adapter (`loadProject`) |
| `src/codes.mjs` | Tìm mã trong văn bản (mẫu mã lấy từ spec adapter), luật chuẩn hoá |
| `src/labels.mjs` | Bộ nhãn TC `vi` / `en` |
| `src/e2e.mjs` | `kit e2e`: chọn phạm vi, gate, chạy, báo cáo, comment PR |
| `src/detect.mjs` | Lấy mã feature của PR (tiêu đề, nhánh, tiêu đề commit, diff status file) |
| `src/run.mjs` | Chạy `run.command` cho các script được chọn, gộp kết quả chạy lại |
| `src/report.mjs`, `src/bugs.mjs` | Báo cáo, `file-bugs` |
| `src/scripts.mjs` | `plan-gen`, `check-script`, `check-paths`, `rehash` |
| `src/testcase.mjs` | Đọc TC markdown, `lint-tc` |
| `src/gate.mjs` | Gate, báo cáo text/markdown |
| `src/github.mjs` | Output Actions, comment, nhãn qua REST API |
| `../adapters/spec/prd-fsd.mjs` | Spec adapter cho PRD + FSD |
