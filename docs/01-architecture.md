# 01 — Kiến trúc

## 1. Ranh giới: TAF chỉ giữ cơ chế

TAF không biết gì về nghiệp vụ hay hạ tầng của ứng dụng. Nó làm ba việc:

1. **Spec → test case → chặn PR**: đọc spec qua adapter, sinh TC, kiểm định dạng, độ phủ, TC lỗi thời; comment và gắn nhãn PR.
2. **Test case → script**: Claude viết script theo hướng dẫn của dự án, chỉ ghi vào thư mục được phép, commit vào PR.
3. **Điều phối chạy và báo cáo**: gọi lệnh của dự án theo thứ tự cố định, đọc kết quả Playwright, phân loại lỗi, mở/đóng bug, comment PR.

Phần còn lại là của **dự án**: dựng và cấu hình môi trường, tài khoản và vai trò, persona, dữ liệu test, page object, cấu hình Playwright. TAF **không dựng app, không deploy**: CI của dự án dựng app rồi gọi `kit e2e --base-url …` ([04](04-ci-workflow.md), [05 §1](05-environments.md)).

## 2. Điểm cắm

Mọi thứ riêng của dự án đi qua `ai-kit.yml`:

| Điểm cắm | Khai ở | TAF lo | Dự án lo |
|---|---|---|---|
| Spec adapter | `spec.adapter`: `prd-fsd` (có sẵn) hoặc `./đường/dẫn.mjs` | Gate, lint, detect, prompt dùng kết quả của adapter | Đọc spec, luật đánh mã, mã nào bắt buộc phủ |
| Định dạng TC | `testcases.labels`: `vi` \| `en` \| ghi đè | Đọc, kiểm cú pháp | Chọn ngôn ngữ nhãn |
| Persona | `testcases.personas` (tuỳ chọn) | Chỉ kiểm tên persona trong TC có trong danh sách | Ý nghĩa, cách tạo, cách đăng nhập |
| Viết script | `scripts.guide`, `scripts.allowedPaths`, `scripts.forbid`, `scripts.lint` | Prompt, kiểm đường dẫn, kiểm script khớp TC, gọi lệnh lint | Hướng dẫn viết test, page object, fixture |
| Chạy test | `run.command`, `run.baseUrlEnv`, `run.cwd` | Chọn file theo phạm vi, đặt địa chỉ app, gom JSON report, gate, báo cáo (`kit e2e`) | Lệnh test, dựng app, dữ liệu |
| Bug tracker | `tracker.adapter`: `github` (có sẵn) hoặc `./x.mjs` | Fingerprint, mở / mở lại / đóng | — |

### Hợp đồng spec adapter

Module export `createSpecAdapter(cfg)` trả object có:

| Hàm | Trả |
|---|---|
| `findFeature(code)` | `null` hoặc `{ code, name, file, line, deprecated, approved, status, statusFile, hash, ... }`. `hash` đổi khi nội dung spec của feature đổi |
| `listFeatures()` | Danh sách mã feature |
| `requiredCodes(feature)` | Các mã TC phải phủ (luồng, nhánh, màn hình… tuỳ dự án) |
| `scopeOf(code)` | Thư mục module chứa TC và script (vd `DL-F05` → `DL`) |
| `featureRegex()` | RegExp `g`, nhóm 1 là mã feature. Dùng tìm mã trong tiêu đề PR, nhánh, commit |
| `traceRegex()` | RegExp `g`, nhóm 1 là mã truy vết. Dùng đọc dòng truy vết của TC và tên test |

Adapter `prd-fsd` có sẵn đọc định dạng PRD + FSD của app-base (feature `## N. MÃ — tên`, luồng `#### MÃ-USnn`, nhánh `- **A1 — …`, màn hình `#### MÃ-SCRnn`, trạng thái ở cột "Spec" của PRD).

## 3. Hai repo, Claude chạy trong repo dự án

```
repo dự án (CWD)                         .ai-kit/  (ai-kit @ tag đã ghim)
├── ai-kit.yml          cấu hình         ├── cli/        kit init | doctor | context | approve | e2e | gate …
├── CLAUDE.md, AGENTS.md… (guides)       ├── RULES.md, process/   quy trình /spec … /ship, agent tester/reviewer
├── .claude/commands|agents  vỏ lệnh     ├── actions/e2e  điểm cắm CI (GitHub)
├── <spec>                               ├── prompts/    testcase, script, triage
├── playwright.config.mjs                ├── adapters/   spec (prd-fsd), tracker (github), agent (claude, agents-md)
├── e2e/        (§3.1)                   ├── claude/     vỏ lệnh/agent cài vào .claude/
└── .github/workflows/  của dự án        ├── templates/  ai-kit.yml, khuôn PRD/FSD/kế hoạch/prototype
    (thêm một bước actions/e2e nếu muốn) └── examples/demo/  dự án mẫu chạy đủ luồng
```

### 3.1 Thư mục `e2e/`

```
e2e/
├── README.md                       hướng dẫn viết test của dự án (scripts.guide)
├── testcases/<MOD>/<MÃ>.md         test case            ← /testcase, người duyệt
├── scripts/<MOD>/<MÃ>.spec.mjs     script sinh từ TC    ← /e2e-script
├── pages/<MOD>/*.mjs               page object theo module; pages/common/ dùng chung
├── tests/                          test viết tay không theo TC (smoke…)
├── support/                        khung test: fixtures.mjs, global-setup.mjs, global-teardown.mjs, personas.mjs
├── testdata/                       dữ liệu tĩnh: personas.yml, *.json, *.csv
└── test-results/                   sinh ra, không commit (một dòng .gitignore)
    ├── reports/latest.md           báo cáo cho người đọc + <YYYY-MM-DD-HHmm>-<env>.md (giữ run.keepReports file)
    ├── playwright/                 trace, ảnh, video (outputDir của Playwright — bị xoá mỗi lần chạy)
    ├── .auth/                      storageState theo persona
    └── raw/                        results.json (Playwright), result.json (kit), triage.json (/e2e-triage)
```

`<MOD>` là mã module lấy từ mã feature (`DM-F01` → `DM`), giống thư mục test case. `ai-kit.yml` và
`playwright.config.mjs` ở gốc repo (Playwright và extension VS Code tìm ở đó).

| Phần | Kit bắt buộc? | Ghi chú |
|---|---|---|
| `testcases/<MOD>/`, `scripts/<MOD>/`, `test-results/reports`, `test-results/raw` | **Có** — kit đọc / ghi theo đúng chỗ (đổi gốc bằng `testcases.dir`, `scripts.dir`, `run.report`, `run.reportsDir`) | Script phẳng kiểu cũ: `kit doctor` cảnh báo, `kit init --migrate` dời vào thư mục module |
| `pages/`, `tests/`, `support/`, `testdata/`, `README.md` | Khuyến nghị — là phần của dự án | Khi sinh script / triage, AI chỉ được ghi `scripts/`, `pages/` (`scripts.allowedPaths`), không sửa TC đã duyệt; repo có cấu trúc riêng thì khai ở `scripts.guide` |

Mọi đường dẫn trong cấu hình tính từ **gốc repo dự án**, không phải từ `e2e/`. `kit init` còn tạo vỏ lệnh/agent trong
`.claude/`, khối cầu nối trong `CLAUDE.md`/`AGENTS.md` ([10 §2](10-quy-trinh.md)) và thêm `/.ai-kit`,
`/e2e/test-results/` vào `.gitignore`. Playwright xoá `outputDir` mỗi lần chạy, nên đặt nó ở thư mục con
`e2e/test-results/playwright`.

- Dự án **dùng** TAF, TAF không biết gì về dự án. Phát hành theo tag, dự án ghim phiên bản.
- Claude luôn chạy trong repo dự án: đọc được code, spec, TC cùng commit; tự nạp `CLAUDE.md` của dự án; không cần cấp quyền đọc thư mục ngoài.

## 4. Phần TAF của `ai-kit.yml`

Khoá trùng mặc định có thể bỏ. Lớp quy trình (`language`, `guides`, `spec.status`, `progress`, `stack`…) và cách chuyển từ `taf.config.yml` 1.x: [11](11-cau-hinh.md).

```yaml
version: 2
spec:
  adapter: prd-fsd
  roots: [docs/features]
  codeDigits: 2                        # 2: DM-F01, 3: DM-F001 (tuỳ chọn)
  status: { draft: Nháp, approved: Đã duyệt }
testcases:
  dir: e2e/testcases                   # mặc định
  labels: vi
  personas: e2e/testdata/personas.yml  # tuỳ chọn
scripts:
  dir: e2e/scripts                     # mặc định; <dir>/<MOD>/<MÃ><ext>
  ext: .spec.mjs                       # mặc định; dự án TypeScript đặt .spec.ts
  guide: e2e/README.md                 # Claude đọc trước khi viết script
  allowedPaths: [e2e/scripts/**, e2e/pages/**]   # mặc định; TC đã duyệt không bao giờ được AI sửa (03 §5)
  forbid: ['page\.locator\(']          # cấm trong script sinh ra (locator chỉ nằm trong page object)
  lint: npx tsc --noEmit               # tuỳ chọn
run:
  command: npx playwright test --reporter=json,list {files}   # mặc định
  baseUrlEnv: E2E_BASE_URL             # mặc định; kit e2e --base-url đặt biến này
  report: e2e/test-results/raw/results.json   # mặc định; kit đặt PLAYWRIGHT_JSON_OUTPUT_NAME tới đây
  reportsDir: e2e/test-results/reports # mặc định; báo cáo markdown cho người đọc
  keepReports: 20                      # mặc định
trigger:
  codePaths: [src/**]
  statusFile: docs/status.md           # tuỳ chọn; mặc định = progress.file
gate: { blockedLabel: e2e-blocked }
tracker: { adapter: github, labels: [bug, e2e] }
```

## 5. Thành phần trong TAF

| Thành phần | Việc | AI |
|---|---|---|
| `kit spec` | In cấu trúc spec qua adapter (`--json` cho prompt) | Không |
| `kit lint-tc`, `kit gate` | Kiểm TC, kiểm TC + script trước khi chạy | Không |
| `kit plan-gen`, `kit check-paths`, `kit check-script`, `kit rehash` | Chọn feature cần sinh script, kiểm Claude chỉ ghi chỗ được phép, kiểm script khớp TC | Không |
| `kit e2e` | Điểm cắm CI và chạy ở máy: lấy mã feature của PR → gate → chạy → báo cáo ([04](04-ci-workflow.md)) | Không |
| `kit report`, `kit file-bugs` | Báo cáo theo feature, bug theo fingerprint (test đã phân loại) | Không |
| `kit init`, `doctor`, `context`, `next-code`, `approve` | Nhúng kit, kiểm việc nhúng, ngữ cảnh cho AI, cấp mã ([11 §4](11-cau-hinh.md)) | Không |
| `prompts/testcase.md`, `script.md`, `triage.md` | Spec → TC, TC → script, phân loại lỗi — chạy ở máy (`/testcase`, `/e2e-script`, `/e2e-triage`) | Có |
| `process/*.md` | Quy trình `/spec` … `/ship`, agent tester/reviewer ([10](10-quy-trinh.md)) | Có |

Mọi bước quyết định là code tất định. Ở phần TAF, AI chỉ dùng ở ba chỗ cần đọc hiểu.

## 6. Điều kiện áp dụng

1. Spec có mã truy vết ổn định cho từng thứ cần phủ, và có (hoặc viết được) một spec adapter.
2. Ứng dụng web, test bằng Playwright (report JSON).
3. Dự án có lệnh chạy test không cần tương tác, nhận địa chỉ app qua biến môi trường.
