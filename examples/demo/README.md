# Dự án mẫu: Đơn hàng demo

Dự án nhỏ đã nhúng ai-kit, để kiểm tra kit trên CI của repo này và làm hình mẫu cho dự án mới. Mọi thứ trong thư mục này là **phần của dự án**. Kit (ở `../../`, dự án thật gắn ở `.ai-kit/`) chỉ đọc `ai-kit.yml` rồi gọi lệnh; dựng app, dữ liệu, CI là của dự án. Mọi file TAF tạo ra nằm dưới `e2e/`.

| Thành phần | File | Ai viết |
|---|---|---|
| App cần test | `app/server.mjs`, `app/pages/*.html` | Dự án |
| Spec (định dạng `prd-fsd`) | `docs/features/addon/DM-demo/PRD-demo.md`, `FSD-demo.md` | Dự án (BA) |
| Test case | `e2e/testcases/DM/DM-F01.md`, `DM-F02.md` | Claude sinh (`/testcase`), người duyệt (`kit approve --testcase`) |
| Cấu hình ai-kit (quy trình + TAF) | `ai-kit.yml` | Dự án |
| Lớp kỹ thuật (guides) + khối cầu nối | `CLAUDE.md` (khối `ai-kit:start/end` do `kit init` chèn) | Dự án / kit |
| Lệnh, agent Claude Code | `.claude/commands/`, `.claude/agents/` (vỏ trỏ tới `.ai-kit/process/`) | `kit init` |
| Dựng / tắt app (CI và ở máy) | `ci/app-up.sh`, `ci/app-down.sh` | Dự án |
| CI của dự án (cắm `actions/e2e`) | [`../../.github/workflows/demo-e2e-spec.yml`](../../.github/workflows/demo-e2e-spec.yml) | Dự án |
| Playwright | `playwright.config.mjs` (gốc dự án) | Dự án |
| Khung test: fixture dữ liệu, đăng nhập theo persona | `e2e/support/` (`fixtures.mjs`, `global-setup.mjs`, `personas.mjs`) | Dự án |
| Dữ liệu tĩnh, persona | `e2e/testdata/personas.yml` | Dự án |
| Page object theo module | `e2e/pages/DM/` | Dự án (Claude được bổ sung) |
| Hướng dẫn viết test + cấu trúc `e2e/` | `e2e/README.md` | Dự án |
| Script sinh từ TC | `e2e/scripts/DM/*.spec.mjs` | Claude sinh (`/e2e-script`) |
| Test viết tay | `e2e/tests/smoke.spec.mjs` | Dự án |
| Kết quả chạy (không commit) | `e2e/test-results/`: `reports/latest.md` (người đọc), `playwright/` (trace, ảnh), `.auth/`, `raw/` (JSON) | Kit, Playwright |

## Chạy thử

```bash
cd examples/demo
npm ci && npx playwright install chromium
T="node ../../cli/bin/kit.mjs"
$T gate DM-F01 DM-F02                 # TC đã duyệt, phủ đủ, script khớp TC
bash ci/app-up.sh                     # phần của dự án: bật app ở cổng 4310
$T e2e all --base-url http://127.0.0.1:4310   # chạy mọi script → bảng kết quả theo feature
bash ci/app-down.sh
```

## Bug cài sẵn

`DEMO_BUG=discount` làm app bỏ chiết khấu khi số lượng ≥ 10 (sai DM-BR01). TC `TC-DM-F02-002` và một dòng của `TC-DM-F02-003` bắt được lỗi này. Dùng để kiểm luồng `/e2e-triage` (ở máy) → issue → run hồi quy tự đóng khi hết lỗi:

```bash
DEMO_BUG=discount bash ci/app-up.sh && $T e2e all --base-url http://127.0.0.1:4310; bash ci/app-down.sh
```

`ci/app-up.sh` chuyển biến `DEMO_BUG` sang app.
