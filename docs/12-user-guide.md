# 12 — Hướng dẫn sử dụng (demo với `examples/project1`)

Bài demo đi hết một vòng ai-kit trên máy, không cần CI:

- **Phần A:** nhúng kit vào [`examples/project1`](../examples/project1/) — repo **BE Go + FE Next.js** đã có chức năng
  đăng nhập (JWT), có `CLAUDE.md` quy định kỹ thuật riêng, tài liệu theo kiểu riêng (ticket `docs/features/login.md`, đặc
  tả SRS `docs/SRS-quan-ly-nhan-vien.md` chưa triển khai), khung e2e Playwright nhưng **chưa có test nào**.
- **Phần B:** làm chức năng mới **quên mật khẩu**, rồi **đăng ký tài khoản** theo quy trình spec → prototype → duyệt →
  test case → script → code → chạy e2e.

Ai làm gì: **bạn** gõ lệnh, trả lời câu hỏi, duyệt (`kit approve`), đồng ý commit; **AI** (lệnh `/…` trong Claude Code)
viết tài liệu, test case, script, code; **`kit`** (lệnh tất định) cấp mã, ghi trạng thái duyệt, gate, chạy test, báo cáo.
Cách viết spec: [13](13-tai-lieu-spec.md). Thiết kế quy trình: [10](10-quy-trinh.md). Cấu hình: [11](11-cau-hinh.md).

## 0. Chuẩn bị (một lần)

Cần Go ≥ 1.22 (`be/go.mod` tự tải toolchain 1.23), Node.js ≥ 20.9, git. Chép `project1` ra **thư mục riêng** — như một
repo thật, không lẫn với repo kit:

```bash
cp -R <repo ai-kit>/examples/project1 ~/demo/project1 && cd ~/demo/project1
git init -q && git add -A && git commit -qm "project1: đăng nhập"     # mốc để xem kit / AI đổi gì
npm ci && (cd fe && npm ci) && npx playwright install chromium
bash scripts/up.sh                   # BE :8080 + FE :3000 — mở http://localhost:3000, đăng nhập admin / Admin@123
```

Mọi lệnh `kit` và Claude Code chạy **ở gốc `~/demo/project1`**. Sau mỗi bước, `git status` / `git diff` cho thấy kit và
AI đã đổi gì. Tắt app: `bash scripts/down.sh`.

## Phần A — Nhúng kit

### A1. Cài kit một lệnh

```bash
git clone --depth 1 -b v2 https://github.com/dunglt-iks/ai-kit .ai-kit && bash .ai-kit/setup.sh
```

(Chưa có tag `v2` thì thay `-b v2` bằng nhánh đang thử.) `setup.sh` kiểm Node / npm / git, cài thư viện của kit, **xem
trước** rồi hỏi trước khi `kit init`, hỏi có thêm lệnh tắt `kit` vào shell không, cuối cùng tự kiểm.

| Thấy gì | Ý nghĩa |
|---|---|
| `ai-kit.yml` | Cấu hình; `guides: [CLAUDE.md]` do kit tìm thấy, `kitRef: v2` |
| `.claude/commands/` (8 lệnh), `.claude/agents/` (spec-reviewer, tester, reviewer) | Vỏ lệnh trỏ tới `.ai-kit/process/` |
| `CLAUDE.md`: chỉ thêm khối `<!-- ai-kit:start … end -->` ở cuối | Khối cầu nối; quy định BE / FE / stack của repo giữ nguyên |
| `.gitignore` thêm `/.ai-kit` | Kit không bị commit vào repo |
| `guides` không có `fe/AGENTS.md` (file có sẵn trong repo, do Next.js sinh) | Kit chỉ dò file hướng dẫn ở gốc repo — `/kit-adopt` sẽ hỏi có thêm không |

### A2. `/kit-adopt` — AI đề xuất cấu hình

Trong Claude Code gõ `/kit-adopt`. AI đọc `CLAUDE.md`, `e2e/README.md`, cấu trúc repo, rồi đề xuất từng giá trị kèm căn
cứ. Đối chiếu với bảng, duyệt xong mới cho AI ghi:

| Khoá | Giá trị nên có | Căn cứ |
|---|---|---|
| `guides` | `[CLAUDE.md, e2e/README.md]` (cân nhắc `fe/AGENTS.md`) | hướng dẫn kỹ thuật và hướng dẫn viết test |
| `stack.checks` | BE: `gofmt -l . && go vet ./... && go build ./...` (`cwd: be`); FE: `npm run lint && npm run build` (`cwd: fe`) | CLAUDE.md "Trước khi commit" |
| `stack.traceability.searchPaths` | `[be, fe/src, e2e]` | code và test |
| `stack.env` | `bash scripts/up.sh → http://localhost:3000` | README |
| `testcases.personas` | `e2e/testdata/personas.yml` | file persona có sẵn |
| `scripts.ext` | `.spec.ts` | Playwright TypeScript (`playwright.config.ts`) |
| `scripts.guide` | `e2e/README.md` | hướng dẫn viết test |
| `trigger.codePaths` | `[be/**, fe/src/**]` | code app |

AI cũng nên chỉ ra **chỗ khác với khuôn của kit**: tài liệu hiện có là ticket (`docs/features/login.md`) và SRS (mã
`REQ-###`), không phải PRD/FSD có mã truy vết. Đề xuất hợp lý: giữ nguyên tài liệu cũ làm tham khảo, **chức năng mới
viết theo khuôn kit** ở `docs/features/<MOD>-<tên>/` (vd module `AUTH`). Bạn quyết; AI không tự sửa tài liệu cũ.

### A3. Kiểm lại, commit

```bash
kit doctor                 # 0 lỗi
kit context                # hai lớp quy định, chưa có feature nào theo khuôn kit
kit next-code AUTH         # → AUTH-F01
git add -A && git commit -qm "chore: nhúng ai-kit"
```

## Phần B — Quên mật khẩu, đăng ký theo quy trình

Thứ tự: `/spec` → `/prototype` → `kit approve` (spec + prototype) → `/testcase` → `kit approve --testcase` →
`/e2e-script` → `/dev` → `kit e2e` → (`/e2e-triage` nếu fail) → `/ship`.

### B0. (Tuỳ chọn) Đưa chức năng đăng nhập vào khuôn kit

```
/spec chuyển chức năng đăng nhập (docs/features/login.md) sang khuôn của kit
```

AI tạo module `AUTH` (PRD + FSD), feature `AUTH-F01` đăng nhập, mô tả đúng hành vi đang có. Lợi ích: chức năng mới dẫn
được tới màn hình / luồng đăng nhập bằng mã; `/testcase AUTH-F01` có e2e cho chức năng cũ.

### B1. `/spec` — quên mật khẩu

```
/spec người dùng quên mật khẩu thì tự đặt lại được
```

AI hỏi tối đa 5 câu. Các điểm nên chốt (repo không gửi được email): gửi link đặt lại thế nào trong demo (vd BE ghi link
vào log, hoặc hiện ngay trên màn hình), hạn của link, quy tắc mật khẩu mới, có báo "email không tồn tại" hay không (tránh
lộ tài khoản — giống quy tắc của đăng nhập). AI ghi `AUTH-F02` vào PRD + FSD (màn hình *Quên mật khẩu*, *Đặt lại mật
khẩu*; luồng chính, nhánh lỗi A/E; quy tắc BR), trạng thái **Nháp**, rồi tự gọi `spec-reviewer` soát.

```bash
kit spec AUTH-F02          # các mã US / nhánh / SCR phải phủ
kit ready AUTH-F02         # ✘ spec chưa duyệt, ✘ chưa có prototype
```

### B2. `/prototype`

```
/prototype docs/features/AUTH-…/FSD-….md AUTH-F02
```

Mở file `PROTOTYPE-….html` bằng trình duyệt, bấm thử. Đổi bố cục thì nói với AI (ghi ngược về FSD); đổi nghiệp vụ thì
quay lại `/spec`. AI tự chạy `kit check-prototype` và nhờ `spec-reviewer` đối chiếu với spec.

### B3. Duyệt — bằng lệnh

```bash
kit approve AUTH-F02                 # ô Spec → "Đã duyệt (<git user.name>, <ngày>)"
kit approve AUTH-F02 --prototype     # ô Prototype → đã duyệt, đóng dấu hash màn hình vào prototype
kit ready AUTH-F02                   # ✓
```

### B4. `/testcase` → duyệt test case

```
/testcase AUTH-F02
```

AI tạo `e2e/testcases/AUTH/AUTH-F02.md` (nháp). Đọc, sửa nếu cần, rồi:

```bash
kit approve AUTH-F02 --testcase      # status + reviewer + approvedHash
kit gate AUTH-F02                    # TC qua; báo "không có script" → bước sau
```

### B5. `/e2e-script` — script đầu tiên của repo

```
/e2e-script AUTH-F02
```

AI viết `e2e/scripts/AUTH/AUTH-F02.spec.ts` và page object (`e2e/pages/AUTH/…`) theo `e2e/README.md`: dùng
`fx.user()` tạo tài khoản riêng, `test.step` theo bước TC, kiểm đúng chữ trên màn hình. Lúc này **chưa có code** → chạy
thử thì fail — đúng như mong đợi; AI phải báo "nghi do app chưa làm", không sửa script cho khớp app.

### B6. `/dev` — kế hoạch, code, test, review

```
/dev docs/features/AUTH-…/FSD-….md AUTH-F02
```

AI ghi kế hoạch (`docs/plans/…`) rồi **dừng** chờ bạn đồng ý; code BE (endpoint, store, service theo `CLAUDE.md`) và FE
(trang, `apiClient`), chạy `stack.checks`; agent **tester** chạy e2e (repo chưa có unit test → không tự dựng framework
mới, hỏi bạn nếu muốn thêm `go test`), agent **reviewer** chấm 🔴 / 🟡 / 🟢.

### B7. Chạy e2e, đọc báo cáo

```bash
bash scripts/down.sh && bash scripts/up.sh                  # bật lại app với code mới
kit e2e AUTH-F02 --base-url http://localhost:3000           # gate + chạy
open e2e/test-results/reports/latest.md                     # báo cáo cho người đọc: bước fail, ảnh, trace
```

Có test fail → `/e2e-triage`: AI phân loại (lỗi app / lỗi script / TC sai / môi trường), sửa script nếu lỗi script; lỗi
app thì sửa bằng `/dev`, rồi chạy lại.

### B8. Đăng ký tài khoản — làm lại vòng trên

`/spec người dùng tự đăng ký tài khoản` → `AUTH-F03` → B2 … B7. Chú ý ở `/spec`: tên đăng nhập trùng, quy tắc mật khẩu
(dùng chung `BR` với quên mật khẩu nếu giống), đăng ký xong có tự đăng nhập không. Script đăng ký tạo tài khoản qua giao
diện nên phải `fx.track(username)` để dọn.

### B9. `/ship`

```
/ship
```

AI chạy kiểm tra cuối (`stack.checks`, `kit e2e changed`), soạn mô tả PR, **hỏi trước khi push**. Repo demo không có
remote thì trả lời không.

## Phần C (nâng cao) — CI

Khi repo đã có workflow build + deploy dev: chép workflow mẫu một file ở [04 §4](04-ci-workflow.md) — PR chạy
`actions/gate` (kiểm tuân thủ, không cần app), deploy dev xong / hằng đêm chạy `actions/e2e` vào địa chỉ đã deploy
(chờ app, báo cáo, issue theo dõi "E2E `dev` đang đỏ"). Test fail trên dev: người trực chạy `/e2e-triage <run-id>` ở
máy. `/kit-adopt` đề xuất sẵn tên workflow deploy và các biến cần khai.

## Dọn dẹp, làm lại

```bash
bash ~/demo/project1/scripts/down.sh && rm -rf ~/demo/project1     # rồi làm lại từ mục 0
```

## Tra cứu nhanh

| Muốn | Dùng |
|---|---|
| Cài / nâng cấp kit | `bash .ai-kit/setup.sh` / `bash .ai-kit/setup.sh --update` |
| Kiểm kit nhúng đúng chưa · xem kit hiểu repo thế nào | `kit doctor` · `kit context` |
| Đề xuất cấu hình khi mới nhúng | `/kit-adopt` |
| Lấy mã mới | `kit next-code AUTH`, `kit next-code AUTH-F02 --type US` |
| Viết / sửa yêu cầu · xem màn hình | `/spec` · `/prototype <file> <mã>` |
| Duyệt spec / prototype / test case | `kit approve <mã>` / `--prototype` / `--testcase` |
| Đủ điều kiện viết TC, code chưa | `kit ready <mã>` |
| Test case · script e2e | `/testcase <mã>` · `/e2e-script <mã>` |
| Code theo spec / sửa bug | `/dev <file> <mã>` / `/dev #<issue>` |
| Chạy e2e (app đang chạy) | `kit e2e <mã> --base-url http://localhost:3000`; `kit e2e changed` cho cả nhánh |
| Đọc kết quả · test fail | `e2e/test-results/reports/latest.md` · `/e2e-triage` |
| Mở PR | `/ship` |

**Ai làm gì:** AI phỏng vấn, viết tài liệu, test case, script, code, review. **Người** duyệt spec, prototype, test case
(`kit approve`), kế hoạch, và xác nhận mỗi lần commit / push. **`kit`** cấp mã, ghi và kiểm trạng thái duyệt, gate,
chọn test, báo cáo.
