# 08 — Lộ trình, rủi ro, điểm còn mở

## 1. Lộ trình

Bản 1.x (chỉ TAF) ở nhánh `release/1.x`, sửa lỗi cắt tag `v1.0.x`. Main là ai-kit 2.x.

**v2.0.0 — ai-kit**

| # | Việc | Xong khi | Trạng thái |
|---|---|---|---|
| 1 | `ai-kit.yml` v2 (`kitRef`, `run.command`), `kit init` chuyển từ `taf.config.yml` v1; CLI `kit` | Test xanh | ✓ |
| 2 | Quy trình trung tính: `RULES.md`, `process/` (spec, prototype, testcase, e2e-script, e2e-triage, dev, ship, adopt; spec-reviewer, tester, reviewer), khuôn PRD/FSD/kế hoạch/prototype | Không còn chuỗi riêng dự án (test chặn) | ✓ |
| 3 | Nhúng hai bước vào repo đã có hướng dẫn AI: `kit init` (dò `guides`, khối cầu nối, vỏ lệnh có dấu, tự kiểm) + `/kit-adopt`; vỏ tự clone kit | Demo `kit doctor` xanh; init không đổi nội dung file của repo | ✓ |
| 4 | Duyệt bằng `kit approve` (spec, prototype, test case), cổng `kit ready`, `kit check-prototype` + spec-reviewer đối chiếu prototype, mã trùng | Test xanh | ✓ |
| 5 | Điểm cắm CI: `kit e2e` + action `actions/e2e`; CI không gọi AI; triage và ghi bug ở máy (`/e2e-triage`) | Demo sạch 24/24, `DEMO_BUG` đúng 2 fail, không bug giả | ✓ |
| 6 | Tag `v2.0.0` + tag nổi `v2` | CI xanh | |

**Sau v2.0.0** (PR riêng trong app-base): chuyển `e2e/taf.config.yml` → `ai-kit.yml` bằng `kit init --migrate` (dời script vào `scripts/<MOD>/`; khai lại
`featurePattern` có `CORE-C##`, `normalize`, `smallItem: KI-##`, `progress.file`, `stack.checks`, `guides`); thêm bước
`actions/e2e` vào job e2e sẵn có của app-base (sau bước dựng app); lệnh/agent hiện có của app-base được giữ (không có
dấu `ai-kit:shell`) cho tới khi đổi sang vỏ của kit — phần riêng chuyển vào guides/`review.checklist` của app-base.
Adapter cho công cụ khác (Antigravity workflows, Cursor rules) khi có dự án cần.

## 2. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Quên sinh script / phân loại test fail | Trung bình | Gate chặn PR khi script thiếu hoặc lệch TC; comment báo cáo nhắc `/e2e-triage` khi có test fail chưa phân loại |
| Hồi quy đỏ mà không ai phân loại | Trung bình | Workflow đỏ, GitHub gửi thông báo; dự án giao người trực chạy `/e2e-triage <run-id>` |
| Script AI đúng cú pháp nhưng kiểm sai ý | Cao | Người duyệt TC (ý định); tên test là mã TC; `check-script` kiểm mỗi TC có test; `forbid` cấm locator ngoài page object; script commit vào PR |
| Chặn mềm bị bỏ qua | Trung bình | Nhãn + comment rõ; repo public hoặc gói trả phí thì bật required check |
| Dự án mẫu đơn giản hơn app thật | Trung bình | Lần áp dụng đầu vào app-base có thể cần bản vá `v2.0.x` |
| TC lỗi thời khi spec đổi | Thấp | `specHash` + gate báo lỗi thời |
| Hướng dẫn kỹ thuật của repo mâu thuẫn với quy trình kit | Trung bình | Hai lớp + thứ tự ưu tiên ([10 §1](10-quy-trinh.md)); `/kit-adopt` liệt kê mâu thuẫn; AI dừng hỏi thay vì tự chọn |
| Prompt quy trình trôi dần về một dự án | Trung bình | `test/kit.test.mjs` chặn chuỗi riêng dự án trong `process/`, `claude/`, `prompts/`, `templates/` |

## 3. Điểm còn mở

| # | Câu hỏi | Mặc định |
|---|---|---|
| O2 | "Đã review" xác định thế nào? | `kit approve <mã> --testcase` ghi `status` + `reviewer` trong frontmatter, nằm trong commit đã merge. Không dựa vào approve của GitHub. |
| O3 | Repo kit public hay private? | Public, không cần token để clone / dùng action. |
| O6 | Có ghi kết quả e2e vào status file của dự án không? | Chưa. `e2e/test-results/raw/result.json` để sẵn. |
