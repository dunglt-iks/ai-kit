# 08 — Lộ trình, rủi ro, điểm còn mở

## 1. Lộ trình

**v3.0.0 — phân phối bằng gói npm + plugin Claude Code**

| # | Việc | Xong khi | Trạng thái |
|---|---|---|---|
| 1 | Gói npm cài từ git tag (`files`, `bin`), Node ≥ 22; bỏ `.ai-kit/`, `kitRef`, `setup.sh` | CI cài gói vào repo trống, `kit init` hai lần, doctor xanh | ✓ |
| 2 | Plugin `kit` (`plugin/`, marketplace `.claude-plugin/`): skill `/kit:*`, agent, hook chặn AI chạy `kit approve`; `kit init` ghi `.claude/settings.json` (ghim tag, deny) | `claude plugin validate` qua; test cấu trúc plugin xanh | ✓ |
| 3 | Bỏ adapter `agents-md`, phần chuyển từ TAF 1.x (`taf.config.yml`, `--migrate`) | Test xanh | ✓ |
| 4 | Thử plugin trên `examples/project1` (cài, `/kit:spec` → `/kit:ship`, hook chặn) | | |
| 5 | Tag `v3.0.0` + tag nổi `v3` | CI xanh | |

**v2.0.0 — ai-kit** (lịch sử)

| # | Việc | Xong khi | Trạng thái |
|---|---|---|---|
| 1 | `ai-kit.yml` v2 (`kitRef`, `run.command`), `kit init` chuyển từ `taf.config.yml` v1; CLI `kit` | Test xanh | ✓ |
| 2 | Quy trình trung tính: `RULES.md`, `process/` (spec, prototype, testcase, e2e-script, e2e-triage, dev, ship, adopt; spec-reviewer, tester, reviewer), khuôn PRD/FSD/kế hoạch/prototype | Không còn chuỗi riêng dự án (test chặn) | ✓ |
| 3 | Nhúng hai bước vào repo đã có hướng dẫn AI: `kit init` (dò `guides`, khối cầu nối, vỏ lệnh có dấu, tự kiểm) + `/kit:adopt`; vỏ tự clone kit | Demo `kit doctor` xanh; init không đổi nội dung file của repo | ✓ |
| 4 | Duyệt bằng `kit approve` (spec, prototype, test case), cổng `kit ready`, `kit check-prototype` + spec-reviewer đối chiếu prototype, mã trùng | Test xanh | ✓ |
| 5 | Điểm cắm CI: `kit gate --pr` + `actions/gate` (PR), `kit e2e` + `actions/e2e` (sau deploy / hằng đêm: chờ app, issue theo dõi môi trường, lỗi dựng dữ liệu); workflow mẫu một file; CI không gọi AI; triage và ghi bug ở máy (`/kit:e2e-triage`) | Demo sạch 24/24, `DEMO_BUG` đúng 2 fail, không bug giả; workflow `sample-e2e` (project1) xanh | ✓ |
| 6 | Tag `v2.0.0` + tag nổi `v2` | CI xanh | bỏ — phát hành thẳng v3.0.0 |

**Sau v3.0.0:** áp dụng vào app-base bằng `npm install -D github:dunglt-iks/ai-kit#v3.0.0` + `kit init` (khai lại
`featurePattern` có `CORE-C##`, `normalize`, `smallItem: KI-##`, `progress.file`, `stack.checks`, `guides`); thêm workflow
mẫu (`actions/gate` cho PR, `actions/e2e` sau deploy dev của app-base); lệnh riêng của app-base chuyển phần riêng vào
guides/`review.checklist`. Adapter cho công cụ khác (Antigravity) khi có dự án cần.

## 2. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Quên sinh script / phân loại test fail | Trung bình | Gate chặn PR khi script thiếu hoặc lệch TC; comment báo cáo nhắc `/kit:e2e-triage` khi có test fail chưa phân loại |
| Hồi quy đỏ mà không ai phân loại | Trung bình | Workflow đỏ, GitHub gửi thông báo; dự án giao người trực chạy `/kit:e2e-triage <run-id>` |
| Script AI đúng cú pháp nhưng kiểm sai ý | Cao | Người duyệt TC (ý định); tên test là mã TC; `check-script` kiểm mỗi TC có test; `forbid` cấm locator ngoài page object; script commit vào PR |
| Chặn mềm bị bỏ qua | Trung bình | Nhãn + comment rõ; repo public hoặc gói trả phí thì bật required check |
| Dự án mẫu đơn giản hơn app thật | Trung bình | Lần áp dụng đầu vào app-base có thể cần bản vá `v2.0.x` |
| TC lỗi thời khi spec đổi | Thấp | `specHash` + gate báo lỗi thời |
| Hướng dẫn kỹ thuật của repo mâu thuẫn với quy trình kit | Trung bình | Hai lớp + thứ tự ưu tiên ([10 §1](10-quy-trinh.md)); `/kit:adopt` liệt kê mâu thuẫn; AI dừng hỏi thay vì tự chọn |
| Prompt quy trình trôi dần về một dự án | Trung bình | `cli/test/kit.test.mjs` chặn chuỗi riêng dự án trong `process/`, `claude/`, `prompts/`, `templates/` |

## 3. Điểm còn mở

| # | Câu hỏi | Mặc định |
|---|---|---|
| O2 | "Đã review" xác định thế nào? | `kit approve <mã> --testcase` ghi `status` + `reviewer` trong frontmatter, nằm trong commit đã merge. Không dựa vào approve của GitHub. |
| O3 | Repo kit public hay private? | Public, không cần token để clone / dùng action. |
| O6 | Có ghi kết quả e2e vào status file của dự án không? | Chưa. `e2e/test-results/raw/result.json` để sẵn. |
