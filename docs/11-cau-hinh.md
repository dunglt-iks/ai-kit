# 11 — Cấu hình `ai-kit.yml` và lệnh `kit`

Một file ở gốc repo dự án, `version: 2`. Mọi đường dẫn tính từ gốc repo. Khoá trùng mặc định có thể bỏ. Mẫu có chú
thích: [`templates/ai-kit.yml`](../templates/ai-kit.yml). Mặc định nằm trong `DEFAULTS` của
[`cli/src/config.mjs`](../cli/src/config.mjs).

Kit đọc `ai-kit.yml` ở gốc dự án, hoặc `--config <file>`.

## 1. Lớp quy trình

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `language` | `vi` | Ngôn ngữ tài liệu, câu hỏi, báo cáo AI viết ra |
| `project.baseBranch`, `remote`, `prTool` | `main`, `origin`, `gh` | Rebase, diff, tạo PR (`none`: in mô tả để người tự tạo) |
| `agents` | `[claude]` | Công cụ AI kit nối vào (settings + plugin, khối cầu nối): `claude` ([10 §2](10-quy-trinh.md)); `[]` = chỉ dùng TAF |
| `guides` | `[]` (init tự dò) | Lớp kỹ thuật của repo — file/thư mục AI đọc trước khi làm |
| `docs.author`, `docs.splitAt` | `BA Team`, `50000` | Cột Tác giả của Change Log; ngưỡng byte tách FSD thành thư mục |
| `spec.codeDigits` | `2` | Số chữ số của `F`/`US`/`SCR`/`BR`/`NFR`/`CMP`: `2` (`DM-F01`) hoặc `3` (`DM-F001`). Hết số thì `next-code` cấp thêm một chữ số; kit đọc cả hai độ dài |
| `spec.adapter`, `roots`, `featurePattern`, `normalize` | `prd-fsd`, `[docs/features]`, `[A-Z]{2,4}-F\d{2,3}` (theo `codeDigits`), `[]` | Đọc spec (dùng chung với TAF, [01 §2](01-architecture.md)) |
| `spec.status.draft`, `.approved` | `Nháp`, `Đã duyệt` | Chữ ở cột Spec của Feature Summary |
| `spec.index` | `null` | File đăng ký module (PRD tổng) |
| `spec.smallItem` | `null` | `{ pattern, file }`: việc nhỏ/bug ghi một dòng, không qua duyệt |
| `spec.plansDir` | `docs/plans` | Kế hoạch của `/kit:dev` |
| `spec.templates` | `{}` | Ghi đè khuôn `fsd`, `prd`, `plan`, `prototype` (mặc định trong `templates/` của gói ai-kit) |
| `spec.wireframeWidth`, `spec.prototype` | `76`, `true` | Bề rộng wireframe; `false` = bỏ bước `/kit:prototype` và không đòi duyệt prototype |
| `progress.file`, `progress.values` | `null`; `Chưa bắt đầu` / `Đang triển khai` / `[Hoàn thành, Đã kiểm thử]` | Bảng tiến độ; `/kit:dev` dựa vào để chọn chế độ |
| `stack.checks` | `[]` | `[{ name, run, cwd? }]` — lệnh kiểm `/kit:dev`, `/kit:ship` chạy theo thứ tự |
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
| `run.setupPaths` | `[e2e/support/**]` | Code dựng dữ liệu / fixture: test fail mà lỗi nằm ở đây → **lỗi dựng dữ liệu**, báo riêng ([06](06-test-data.md)); `check-script` gợi ý dựng dữ liệu qua đây |
| `tracker.trackLabel` | `e2e:{env}` | Nhãn issue theo dõi môi trường của `kit e2e --track` ([04 §5](04-ci-workflow.md)) |
| `trigger.featureMap` | `{}` | `{ "<glob file code>": [<mã feature>…] }` — file code đổi kéo thêm feature vào phạm vi `changed` |
| `gate.allowSelfApproval` | `true` | `false`: người viết / sửa TC không được tự duyệt (`kit approve --testcase` từ chối, gate báo); `true` chỉ cảnh báo |
| `run.cwd`, `run.report` | `.`, `e2e/test-results/raw/results.json` | Thư mục chạy lệnh; JSON report (cạnh nó: `result.json`, `triage.json`) |
| `run.reportsDir`, `run.keepReports` | `e2e/test-results/reports`, `20` | Báo cáo markdown cho người đọc: `latest.md` + mỗi lần chạy một file, giữ N file gần nhất |
| `scripts.dir` | `e2e/scripts` | Script ở `<dir>/<MOD>/<MÃ><ext>` (cấu trúc `e2e/`: [01 §3.1](01-architecture.md)) |
| `gate.requireScript` | `true` | Gate đòi script có và khớp TC |
| `trigger.statusFile`, `trigger.statusDone` | `progress.file`, `progress.values.done` | Lấy mã feature của PR từ bảng tiến độ |

## 3. Từ ai-kit 2.x

`ai-kit.yml` vẫn `version: 2`. Khoá `kitRef` bỏ (phiên bản kit là gói `ai-kit` trong devDependencies; `kit doctor` nhắc
xoá). `agents` chỉ còn `claude`. `taf.config.yml` (TAF 1.x) không còn đọc.

## 4. Lệnh

`npx kit <lệnh>` (gọi tắt `kit`; AI và CI dùng `npx --no kit` để không tải nhầm gói khác khi chưa cài). Mọi lệnh tất định.

| Lệnh | Việc |
|---|---|
| `kit init [--dry-run]` | Nhúng / cập nhật kit, chạy lại được ([10 §4](10-quy-trinh.md)): tạo `ai-kit.yml` nếu chưa có (không bao giờ ghi đè); trộn vào `.claude/settings.json` marketplace `ai-kit` ghim tag của gói đang cài, bật plugin `kit@ai-kit` (repo đặt `false` thì giữ), luật deny `kit approve` — phần khác của settings giữ nguyên; khối cầu nối, `.gitignore`; rồi tự kiểm. Không đụng `.github/` |
| `kit doctor` | Kiểm cấu hình, `guides`, khuôn, settings (plugin đúng tag, không bị tắt, deny), khối cầu nối, `run.command`, gói `ai-kit` trong devDependencies, spec adapter, mã feature khai trùng. Có ✘ thì thoát 1 |
| `kit context [--json] [--scope <module>]` | In cấu hình đã giải theo hai lớp (đánh dấu guides công cụ đã tự nạp) + feature với trạng thái spec / prototype / sẵn sàng. Bước 0 của mọi lệnh quy trình |
| `kit approve <mã…> [--prototype \| --testcase] [--by <tên>]` | Người duyệt spec (cột Spec), prototype (cột Prototype + dấu hash màn hình trong `PROTOTYPE-*.html`) hoặc test case (`status` + `reviewer` trong file TC) ([10 §3.1](10-quy-trinh.md)) |
| `kit check-prototype <mã…> [--json]` | Đối chiếu spec ↔ prototype: mỗi `SCR` có `<section id>`, mỗi thành phần đánh số có `data-ref`, không màn hình / thành phần lạ; phiên bản spec trên thanh PROTOTYPE. Thoát 1 nếu lệch |
| `kit ready <mã…> [--json]` | Đủ điều kiện viết TC / script / code chưa: spec + prototype đã duyệt, prototype còn khớp màn hình, mã không trùng. Thoát 1 nếu chưa |
| `kit next-code <cha> [--type F\|US\|SCR\|BR\|small]` | Mã kế tiếp, tính cả mã `[DEPRECATED]`. `F`, `BR`: cha là module (`DM`); `US`, `SCR`: cha là feature (`DM-F01`) |
| `kit gate --pr [--publish github]` | Điểm cắm CI cho PR: kiểm tuân thủ (mã feature, spec / TC đã duyệt, script khớp TC), không chạy test ([04 §2](04-ci-workflow.md)) |
| `kit e2e all \| changed \| <mã…> […]` | Điểm cắm CI sau deploy / hằng đêm và chạy e2e ở máy: chờ app, chạy, báo cáo, issue theo dõi (`--track`) ([04 §2](04-ci-workflow.md)) |
| `kit spec`, `lint-tc`, `gate`, `plan-gen`, `check-script`, `check-paths`, `lint-script`, `rehash`, `report`, `file-bugs` | Lệnh TAF ([01 §5](01-architecture.md)) |
