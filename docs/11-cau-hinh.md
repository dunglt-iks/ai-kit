# 11 — Cấu hình `ai-kit.yml` và lệnh `kit`

Một file ở gốc repo dự án, `version: 2`. Mọi đường dẫn tính từ gốc repo. Khoá trùng mặc định có thể bỏ. Mẫu có chú
thích: [`templates/ai-kit.yml`](../templates/ai-kit.yml). Mặc định nằm trong `DEFAULTS` của
[`cli/src/config.mjs`](../cli/src/config.mjs).

Kit tìm cấu hình theo thứ tự `ai-kit.yml`, `e2e/taf.config.yml`, `taf.config.yml` (hai file sau là TAF 1.x,
`version: 1`, xem §3), hoặc `--config <file>`.

## 1. Lớp quy trình

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `kitRef` | `v2` | Phiên bản kit (tag). Vỏ lệnh tự clone bản này vào `.ai-kit/`; đổi cùng `@<ref>` của action trong CI, rồi `kit init` |
| `language` | `vi` | Ngôn ngữ tài liệu, câu hỏi, báo cáo AI viết ra |
| `project.baseBranch`, `remote`, `prTool` | `main`, `origin`, `gh` | Rebase, diff, tạo PR (`none`: in mô tả để người tự tạo) |
| `agents` | `[claude]` | Công cụ AI cần vỏ lệnh + khối cầu nối: `claude`, `agents-md` ([10 §2](10-quy-trinh.md)) |
| `guides` | `[]` (init tự dò) | Lớp kỹ thuật của repo — file/thư mục AI đọc trước khi làm |
| `docs.author`, `docs.splitAt` | `BA Team`, `50000` | Cột Tác giả của Change Log; ngưỡng byte tách FSD thành thư mục |
| `spec.codeDigits` | `2` | Số chữ số của `F`/`US`/`SCR`/`BR`/`NFR`/`CMP`: `2` (`DM-F01`) hoặc `3` (`DM-F001`). Hết số thì `next-code` cấp thêm một chữ số; kit đọc cả hai độ dài |
| `spec.adapter`, `roots`, `featurePattern`, `normalize` | `prd-fsd`, `[docs/features]`, `[A-Z]{2,4}-F\d{2,3}` (theo `codeDigits`), `[]` | Đọc spec (dùng chung với TAF, [01 §2](01-architecture.md)) |
| `spec.status.draft`, `.approved` | `Nháp`, `Đã duyệt` | Chữ ở cột Spec của Feature Summary |
| `spec.index` | `null` | File đăng ký module (PRD tổng) |
| `spec.smallItem` | `null` | `{ pattern, file }`: việc nhỏ/bug ghi một dòng, không qua duyệt |
| `spec.plansDir` | `docs/plans` | Kế hoạch của `/dev` |
| `spec.templates` | `{}` | Ghi đè khuôn `fsd`, `prd`, `plan`, `prototype` (mặc định trong `.ai-kit/templates/`) |
| `spec.wireframeWidth`, `spec.prototype` | `76`, `true` | Bề rộng wireframe; `false` = bỏ bước `/prototype` và không đòi duyệt prototype |
| `progress.file`, `progress.values` | `null`; `Chưa bắt đầu` / `Đang triển khai` / `[Hoàn thành, Đã kiểm thử]` | Bảng tiến độ; `/dev` dựa vào để chọn chế độ |
| `stack.checks` | `[]` | `[{ name, run, cwd? }]` — lệnh kiểm `/dev`, `/ship` chạy theo thứ tự |
| `stack.traceability.searchPaths` | `[src]` | Nơi grep mã truy vết |
| `stack.env` | `null` | Cách bật app ở máy + địa chỉ (để chạy e2e ở máy) |
| `review.checklist` | `null` | Checklist review riêng của repo |

## 2. Lớp TAF

`testcases`, `scripts`, `run`, `trigger`, `gate`, `tracker` — xem [01 §4](01-architecture.md).

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `run.command` | `npx playwright test --reporter=json,list {files}` | Lệnh test của dự án; `{files}` = script được chọn, `{grep}` = `--grep` |
| `run.baseUrlEnv` | `E2E_BASE_URL` | Biến nhận địa chỉ app (`kit e2e --base-url`) — cấu hình test của dự án đọc nó |
| `run.smoke` | `[e2e/tests/**]` | Test luôn chạy kèm ở phạm vi `changed` (smoke / đường chính) |
| `run.smokePriority` | `P1` | Phạm vi `changed` chạy thêm TC có ưu tiên này của các feature khác (`null` = tắt) |
| `run.history`, `run.keepHistory` | `e2e/test-results/history.jsonl`, `50` | Lịch sử kết quả cho `kit flaky` |
| `run.quarantine` | `e2e/quarantine.yml` | Test đang cách ly `[{ test, issue, until, reason }]` ([07 §2b](07-bug-reporting.md)) |
| `trigger.featureMap` | `{}` | `{ "<glob file code>": [<mã feature>…] }` — file code đổi kéo thêm feature vào phạm vi `changed` |
| `gate.allowSelfApproval` | `true` | `false`: người viết / sửa TC không được tự duyệt (`kit approve --testcase` từ chối, gate báo); `true` chỉ cảnh báo |
| `run.cwd`, `run.report` | `.`, `e2e/test-results/raw/results.json` | Thư mục chạy lệnh; JSON report (cạnh nó: `result.json`, `triage.json`) |
| `run.reportsDir`, `run.keepReports` | `e2e/test-results/reports`, `20` | Báo cáo markdown cho người đọc: `latest.md` + mỗi lần chạy một file, giữ N file gần nhất |
| `scripts.dir` | `e2e/scripts` | Script ở `<dir>/<MOD>/<MÃ><ext>` (cấu trúc `e2e/`: [01 §3.1](01-architecture.md)) |
| `gate.requireScript` | `true` | Gate đòi script có và khớp TC |
| `trigger.statusFile`, `trigger.statusDone` | `progress.file`, `progress.values.done` | Lấy mã feature của PR từ bảng tiến độ |

## 3. Chuyển từ `taf.config.yml` (1.x)

| 1.x | 2.x |
|---|---|
| `e2e/taf.config.yml`, `version: 1` | `ai-kit.yml`, `version: 2` |
| `spec.approvedValue` | `spec.status.approved` |
| `run.targets.<tên>.test` (start / stop / logs) | `run.command` (lệnh test của `ci`, hoặc target đầu tiên); dựng app là việc của CI dự án |
| `featurePattern` mặc định `(?:[A-Z]{2,4}\|CORE-C\d{2})-F\d{2}` | `[A-Z]{2,4}-F\d{2,3}` — dự án cần mẫu cũ thì khai rõ |
| `trigger.statusDone` mặc định `[Hoàn thành]` | lấy từ `progress.values.done` |
| `scripts.personas` (0.1) | `testcases.personas` |
| (không có) | `agents` — file v1 được coi `agents: []` |

`kit init` làm việc này tự động (§4).

## 4. Lệnh

`node .ai-kit/cli/bin/kit.mjs <lệnh>` (gọi tắt `kit`). Mọi lệnh tất định.

| Lệnh | Việc |
|---|---|
| `kit init [--force] [--dry-run] [--migrate]` | Nhúng / cập nhật kit, chạy lại được ([10 §4](10-quy-trinh.md)): tạo `ai-kit.yml` nếu chưa có (không bao giờ ghi đè), làm mới vỏ lệnh/agent có dấu `ai-kit:shell` và khối cầu nối, `.gitignore`; rồi tự kiểm. Không đụng `.github/`. `--force`: thay cả lệnh trùng tên của repo; `--migrate`: dời script phẳng kiểu cũ vào `scripts/<MOD>/`, sửa import tương đối |
| `kit doctor` | Kiểm cấu hình, `guides`, khuôn, vỏ lệnh, khối cầu nối, `run.command`, `.gitignore`, spec adapter, mã feature khai trùng. Có ✘ thì thoát 1 |
| `kit context [--json] [--scope <module>]` | In cấu hình đã giải theo hai lớp (đánh dấu guides công cụ đã tự nạp) + feature với trạng thái spec / prototype / sẵn sàng. Bước 0 của mọi lệnh quy trình |
| `kit approve <mã…> [--prototype \| --testcase] [--by <tên>]` | Người duyệt spec (cột Spec), prototype (cột Prototype + dấu hash màn hình trong `PROTOTYPE-*.html`) hoặc test case (`status` + `reviewer` trong file TC) ([10 §3.1](10-quy-trinh.md)) |
| `kit check-prototype <mã…> [--json]` | Đối chiếu spec ↔ prototype: mỗi `SCR` có `<section id>`, mỗi thành phần đánh số có `data-ref`, không màn hình / thành phần lạ; phiên bản spec trên thanh PROTOTYPE. Thoát 1 nếu lệch |
| `kit ready <mã…> [--json]` | Đủ điều kiện viết TC / script / code chưa: spec + prototype đã duyệt, prototype còn khớp màn hình, mã không trùng. Thoát 1 nếu chưa |
| `kit next-code <cha> [--type F\|US\|SCR\|BR\|small]` | Mã kế tiếp, tính cả mã `[DEPRECATED]`. `F`, `BR`: cha là module (`DM`); `US`, `SCR`: cha là feature (`DM-F01`) |
| `kit e2e <phạm vi> […]` | Điểm cắm CI và chạy e2e ở máy ([04 §2](04-ci-workflow.md)) |
| `kit spec`, `lint-tc`, `gate`, `plan-gen`, `check-script`, `check-paths`, `lint-script`, `rehash`, `report`, `file-bugs` | Lệnh TAF ([01 §5](01-architecture.md)) |
