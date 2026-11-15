# 12 — Hướng dẫn sử dụng (thực hành với `examples/demo-plain`)

Bài thực hành đi hết một vòng ai-kit trên máy, không push gì lên GitHub:

- **Phần A:** nhúng kit vào [`examples/demo-plain`](../examples/demo-plain/), một app đơn hàng chưa có kit.
- **Phần B:** làm một feature mới `DM-F03` theo quy trình spec → prototype → duyệt → test case → script → code → ship.
- **Phần C:** (đọc) cắm kit vào CI của dự án thật.

Ai làm gì trong bài: **bạn** gõ lệnh, trả lời câu hỏi, duyệt (`kit approve`), đồng ý commit; **AI** (lệnh `/…` trong
Claude Code) viết tài liệu, test case, script, code; **`kit`** (lệnh tất định) cấp mã, ghi trạng thái duyệt, gate, chạy
test, báo cáo.

Bản đã nhúng sẵn để đối chiếu: [`examples/demo`](../examples/demo/). Cách viết spec: [13](13-tai-lieu-spec.md). Thiết kế: [10](10-quy-trinh.md). Cấu hình: [11](11-cau-hinh.md).

## 0. Chuẩn bị

```bash
cd <repo ai-kit>
git switch -c practice/kit                 # nhánh nháp (bỏ qua nếu đã ở nhánh nháp), xoá được sau
npm ci                                     # phụ thuộc của kit
cd examples/demo-plain
npm ci && npx playwright install chromium  # phụ thuộc của app mẫu
ln -s ../.. .ai-kit                        # gắn kit bản đang có trên đĩa
alias kit='node .ai-kit/cli/bin/kit.mjs'
bash ci/app-up.sh                          # bật app ở http://127.0.0.1:4310 (tắt: bash ci/app-down.sh)
```

Dự án thật thay dòng `ln -s` bằng `git clone --depth 1 -b v2 https://github.com/dunglt-iks/ai-kit .ai-kit`. Mọi lệnh
`kit` và Claude Code đều chạy **trong thư mục `examples/demo-plain`**, để Claude nạp `CLAUDE.md` và `.claude/` của dự án
này. Sau mỗi bước, `git status .` và `git diff .` cho thấy kit / AI đã đổi gì.

## Phần A — Nhúng kit

### A1. `kit init`

```bash
kit init --dry-run          # xem trước: + tạo, ~ sửa, = giữ nguyên
kit init                    # ghi + tự kiểm (như kit doctor)
git status . && git diff CLAUDE.md .gitignore
```

| Thấy gì | Ý nghĩa |
|---|---|
| `ai-kit.yml` | Cấu hình. `guides: [CLAUDE.md]` do kit tìm thấy hướng dẫn AI sẵn có; `kitRef: v2` |
| `.claude/commands/` (8 lệnh: spec, prototype, testcase, e2e-script, e2e-triage, dev, ship, kit-adopt), `.claude/agents/` (spec-reviewer, tester, reviewer) | Vỏ lệnh trỏ tới `.ai-kit/process/`, có dấu `ai-kit:shell` |
| `CLAUDE.md`: chỉ thêm khối `<!-- ai-kit:start … end -->` ở cuối | Khối cầu nối. Phần **Kỹ thuật** của dự án giữ nguyên |
| `.gitignore` thêm `/.ai-kit`, `/e2e/test-results/` | Kit và kết quả chạy không bị commit |
| Không có gì trong `.github/` | CI là của dự án; cắm kit vào CI là việc tuỳ chọn ([04](04-ci-workflow.md)) |

Cuối lệnh in phần **Kiểm tra**: 0 lỗi kèm vài cảnh báo (vd `stack.checks rỗng`) — chỗ cấu hình còn để mặc định.

### A2. `/kit-adopt` — để AI đề xuất cấu hình

Trong Claude Code gõ `/kit-adopt`. AI đọc `CLAUDE.md` và cấu trúc repo, rồi đề xuất sửa `ai-kit.yml`, mỗi giá trị kèm
căn cứ. Đối chiếu với bảng dưới (giá trị đúng cho demo-plain), duyệt xong mới cho AI ghi.

demo-plain đóng vai **repo đã có e2e theo cách riêng** (`e2e/GUIDE.md`, `e2e/personas.yml`, `e2e/fixtures.mjs` nằm
phẳng), nên giá trị khác mặc định của kit (`e2e/README.md`, `e2e/testdata/`, `e2e/support/` — [01 §3.1](01-architecture.md)).
Kit chỉ bắt buộc phần nó đọc / ghi: test case ở `e2e/testcases/<MOD>/`, script ở `e2e/scripts/<MOD>/`, kết quả ở
`e2e/test-results/`. Bản đã sắp theo cấu trúc khuyến nghị để so: `examples/demo/e2e/`.

| Khoá | Giá trị nên có | Căn cứ |
|---|---|---|
| `guides` | `[CLAUDE.md, e2e/GUIDE.md]` | CLAUDE.md trỏ tới hướng dẫn viết test |
| `stack.checks` | `[{ name: cú pháp, run: 'for f in app/server.mjs e2e/*.mjs e2e/pages/*.mjs; do node --check "$f" \|\| exit 1; done' }]` | CLAUDE.md: kiểm bằng `node --check` |
| `stack.traceability.searchPaths` | `[app, e2e]` | code ở `app/`, test ở `e2e/` |
| `stack.env` | `npm run app → http://127.0.0.1:4310` | CLAUDE.md |
| `run.baseUrlEnv` | `E2E_BASE_URL` (mặc định) | `playwright.config.mjs` đọc biến này |
| `testcases.personas` | `e2e/personas.yml` | file persona có sẵn |
| `scripts.guide` | `e2e/GUIDE.md` | hướng dẫn viết test |
| `scripts.forbid` | thêm `'page\.getBy'`, `'from ["'']@playwright/test'` | GUIDE: locator chỉ trong page object, không import Playwright trực tiếp |
| `trigger.codePaths` | `[app/**]` | code app nằm ở `app/` |

AI cũng có thể chỉ ra chỗ demo **chưa theo khuôn của kit**: FSD chưa có bảng metadata và Change Log, wireframe vẽ
bằng ký tự khung Unicode. Đây là mâu thuẫn giữa tài liệu cũ và kit. Bạn quyết sửa hay để nguyên; AI không tự sửa.

### A3. Kiểm lại

```bash
kit init                    # chạy lại được: làm mới phần của kit, tự kiểm — 0 lỗi
kit context                 # hai lớp quy định, feature: DM: DM-F01 ✓, DM-F02 ✓
kit next-code DM            # → DM-F03
```

Đến đây ứng với bước "duyệt rồi commit `ai-kit.yml`, `.claude/`, khối cầu nối" của dự án thật
([10 §4](10-quy-trinh.md)). Trên nhánh nháp thì tuỳ bạn.

### A4. (Tuỳ chọn) TC cho feature đã có

```
/testcase DM-F01
```

DM-F01, DM-F02 đã duyệt sẵn và PRD của demo-plain chưa có cột Prototype (tài liệu cũ — không theo dõi prototype), nên
`kit ready DM-F01` qua ngay. Lệnh tạo `e2e/testcases/DM/DM-F01.md` với `status: Nháp`. Duyệt TC (`kit approve DM-F01 --testcase`) rồi
`/e2e-script DM-F01` (như B4–B5) để có e2e cho feature cũ.

## Phần B — Một vòng quy trình với DM-F03

Thứ tự: `/spec` → `/prototype` → **người duyệt bằng `kit approve`** → `/testcase` → `kit approve --testcase` → `/e2e-script`
→ `/dev` → `/ship`. Test case và script có trước code, nên khi code xong tester chạy e2e được ngay.

### B1. `/spec` — viết yêu cầu

```
/spec cho manager sửa số lượng của một đơn hàng đã tạo
```

AI hỏi tối đa 5 câu, rồi ghi DM-F03 vào PRD + FSD trong `docs/features/addon/DM-demo/`. Bảng Feature Summary của
PRD có thêm cột **Prototype**; DM-F03 có Spec = **Nháp**, Prototype = **Nháp**. Sau đó AI **tự gọi agent
`spec-reviewer`** soát spec: lỗi hình thức (mã, wireframe, Change Log) AI tự sửa; vấn đề nội dung (tiêu chí mơ hồ,
thiếu nhánh lỗi…) hiện thành câu hỏi trong phần bàn giao — trả lời để AI sửa spec.

```bash
kit spec DM-F03             # "CHƯA duyệt" + danh sách US / nhánh / SCR phải phủ
kit ready DM-F03            # ✘ spec chưa duyệt, ✘ chưa có prototype
```

### B2. `/prototype` — xem màn hình (spec vẫn đang nháp)

```
/prototype docs/features/addon/DM-demo/FSD-demo.md DM-F03
```

AI dựng HTML, rồi tự đối chiếu với spec: `kit check-prototype DM-F03` (mỗi màn hình có `<section>`, mỗi thành phần đánh
số có `data-ref`) và agent `spec-reviewer` (nhãn, quy tắc hiển thị, luồng bấm được). Mở
`docs/features/addon/DM-demo/PROTOTYPE-demo.html` bằng trình duyệt và bấm thử.

- Muốn đổi bố cục: nói với AI. Thay đổi giao diện được ghi ngược về FSD, rồi `spec-reviewer` soát lại phần đó.
- Thay đổi nghiệp vụ (thêm nhánh, quy tắc mới): AI bảo quay lại `/spec`.

### B3. Duyệt spec và prototype — bằng lệnh

Duyệt là việc của **người**: AI không tự đổi trạng thái, kể cả khi bạn gõ "duyệt".

```bash
kit approve DM-F03                 # ô Spec → "Đã duyệt (<git user.name>, <ngày>)"
kit approve DM-F03 --prototype     # ô Prototype → đã duyệt; đóng dấu hash màn hình vào PROTOTYPE-demo.html
kit ready DM-F03                   # ✓ sẵn sàng viết test case và code
git diff docs/                     # xem lệnh đã ghi gì
```

Thử: sửa một chữ trong phần `#### DM-F03-SCR01` của FSD → `kit ready DM-F03` báo "Màn hình trong spec đã đổi sau
khi duyệt prototype". Hoàn tác (`git checkout` file FSD) → lại ✓.

### B4. `/testcase` — test case e2e, người duyệt

```
/testcase DM-F03
```

AI kiểm `kit ready`, rồi tạo `e2e/testcases/DM/DM-F03.md` với `status: Nháp`. **Bạn duyệt**: đọc file, sửa nếu cần,
rồi duyệt bằng lệnh.

```bash
kit approve DM-F03 --testcase   # status: Đã duyệt, reviewer: <git user.name>; từ chối nếu TC còn lỗi / lỗi thời
kit gate DM-F03                 # TC qua; còn báo "không có script — chạy /e2e-script DM-F03" (bước sau)
```

### B5. `/e2e-script` — sinh script

```
/e2e-script DM-F03
```

AI chạy `kit plan-gen` (sinh mới / cập nhật / đã khớp), viết script `e2e/scripts/DM/DM-F03.spec.mjs` + page object theo `e2e/GUIDE.md`, tự kiểm
(`rehash`, `check-script`, `lint-script`, `check-paths`), rồi **hỏi** có chạy thử (app đang chạy ở 4310: `kit e2e DM-F03 --no-gate --base-url …`). Lúc này app **chưa có**
chức năng sửa số lượng, nên chạy thử thì test của DM-F03 **fail** — đúng như mong đợi: AI phải báo "nghi do app
chưa làm", **không** sửa script cho khớp app. CI không sinh script: thiếu bước này thì gate chặn PR.

### B6. `/dev` — kế hoạch, code, test, review

```
/dev docs/features/addon/DM-demo/FSD-demo.md DM-F03
```

1. AI kiểm `kit ready`, thấy đã có TC + script.
2. Ghi kế hoạch `docs/plans/dm-f03.md` (dòng đầu `Spec đã triển khai: … v<x.y>`), rồi **dừng** chờ bạn đồng ý.
3. Bạn đồng ý thì AI code `app/`, gắn comment truy vết `DM-…`, chạy `stack.checks`.
4. Agent **tester**: demo không có unit test → tester **không dựng framework mới**; phủ tiêu chí bằng e2e (chạy script
   ở B5, giờ phải xanh) và ghi "kiểm thủ công" cho phần không quan sát được. Agent **reviewer** chấm 🔴 / 🟡 / 🟢.
5. Báo cáo cuối. Muốn commit thì AI hỏi trước.

```bash
kit e2e DM-F03 --base-url http://127.0.0.1:4310     # tự kiểm lại (gate + chạy): script DM-F03 xanh
open e2e/test-results/reports/latest.md              # báo cáo cho người đọc (lịch sử: các file theo giờ bên cạnh)
```

App đang chạy là bản cũ: khởi động lại sau khi AI sửa `app/` (`bash ci/app-down.sh && bash ci/app-up.sh`).

### B7. Bắt bug, sửa bug từ issue

```bash
bash ci/app-down.sh && DEMO_BUG=discount bash ci/app-up.sh   # bật app với lỗi cài sẵn
kit e2e all --base-url http://127.0.0.1:4310                 # test của DM-F02 fail; không bug nào bị ghi tự động
```

```
/e2e-triage
```

AI đọc report, ảnh, TC, spec → phân loại từng test fail (lỗi app / lỗi script / môi trường / chập chờn / TC sai),
ghi `e2e/test-results/raw/triage.json`, rồi trình bày (báo cáo `e2e/test-results/reports/latest.md` được ghi lại kèm loại lỗi). Ở đây phải ra **app-bug** (chiết khấu bị bỏ, sai DM-BR01) — AI
**không** sửa script cho khớp app. Bước ghi bug AI sẽ hỏi; trong bài thực hành chỉ cho chạy `kit file-bugs --dry-run`
(in bug "sẽ ghi", không tạo issue). Trên dự án thật, test fail trên CI thì `/e2e-triage <run-id>` tải kết quả về rồi
làm như trên.

Cần đã có TC + script của DM-F02 (A4 với DM-F02). Trên dự án thật, bug được ghi thành issue (vd `#12`); sửa bằng:

```
/dev #12
```

AI đọc issue (feature, mã TC, lỗi), tái hiện bằng `kit e2e`, sửa code, chạy lại test, PR ghi `Fixes #12`. Ở bài
thực hành không có issue thật — có thể thử bằng cách mô tả lỗi: `/dev sửa lỗi DM-F02: số lượng ≥ 10 không được chiết
khấu (TC-DM-F02-002 fail)` khi đang bật `DEMO_BUG` (lỗi nằm ở app: AI sẽ tìm ra chỗ đọc `DEMO_BUG`). Xong thì bật lại
app bình thường: `bash ci/app-down.sh && bash ci/app-up.sh`.

### B8. Chế độ đồng bộ (spec đổi sau khi đã làm)

```
/spec DM-F03 thêm: không cho sửa số lượng về 0
```

1. Spec quay về **Nháp** (đổi luồng, không đổi màn hình → prototype vẫn còn duyệt). `kit approve DM-F03`.
2. `kit gate DM-F03` báo TC **lỗi thời** → `/testcase DM-F03` (đồng bộ), duyệt lại TC, `/e2e-script DM-F03`
   (`plan-gen` báo "cập nhật").
3. `/dev … DM-F03`: AI nhận **chế độ đồng bộ**, diff spec từ mốc trong kế hoạch, lập bảng mã thêm / sửa /
   deprecated, chỉ sửa phần bị đổi.

### B9. `/ship`

```
/ship
```

AI rebase lên nhánh gốc, chạy kiểm tra cuối và `kit e2e changed --base-url …` (lấy mã feature từ tên nhánh / commit,
gate + chạy script của các feature đó), soạn mô tả PR (tiêu đề chứa `dm-f03`), rồi **hỏi trước khi push**. Trong bài
thực hành hãy **trả lời không**: demo-plain nằm trong repo kit, push sẽ đẩy lên repo kit.

## Phần C — (Đọc) Cắm kit vào CI của dự án thật

`demo-plain` nằm trong repo kit nên không có CI riêng để thử. Ở dự án thật, CI vẫn là của dự án; kit chỉ thêm **một
bước** sau bước dựng app ([04](04-ci-workflow.md)):

```yaml
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      # … bước của dự án: cài, dựng app ở http://localhost:4310 …
      - uses: dunglt-iks/ai-kit/actions/e2e@v2
        with: { scope: changed, base-url: http://localhost:4310, env: pr }
```

| | `scope: none` (chỉ gate) | `scope: changed` / `all` (chạy e2e) |
|---|---|---|
| Dự án cần | Không dựng app | Bước dựng app trước bước kit |
| PR thiếu / lệch TC hoặc script | Đỏ + comment ghi lệnh cần chạy ở máy (`/testcase`, `/e2e-script`) | Như bên trái |
| Test fail | — | Đỏ + comment; người chạy `/e2e-triage <run-id>` ở máy để phân loại, ghi bug |

Ví dụ chạy thật trong repo kit: [`.github/workflows/demo-e2e-spec.yml`](../.github/workflows/demo-e2e-spec.yml) cho
`examples/demo`.

## Dọn dẹp, làm lại

Chạy ở gốc repo kit; chỉ đụng `examples/demo-plain`, không ảnh hưởng thay đổi khác của repo:

```bash
bash examples/demo-plain/ci/app-down.sh                                 # tắt app
git restore --source=HEAD --staged --worktree -- examples/demo-plain   # file đã sửa về bản đã commit
git clean -fd -- examples/demo-plain                                    # xoá file kit init + bài tập tạo ra, cả symlink .ai-kit
rm -rf examples/demo-plain/e2e/test-results examples/demo-plain/ci/logs # kết quả chạy (giữ node_modules)
```

Rồi làm lại từ mục 0 (dòng `ln -s`). Có commit từng bước trên nhánh thực hành thì thay `HEAD` bằng commit đã thêm
demo-plain. Muốn giữ bài đã làm thì sao chép ra chỗ khác trước khi dọn.

## Tra cứu nhanh

| Muốn | Dùng |
|---|---|
| Nhúng kit / làm mới sau khi đổi `kitRef` | `kit init` (tự kiểm) |
| Kiểm kit nhúng đúng chưa | `kit doctor` |
| Xem kit hiểu repo thế nào | `kit context` (`--scope DM`: chỉ một module) |
| Đề xuất cấu hình khi mới nhúng | `/kit-adopt` |
| Lấy mã mới (feature, US, SCR, BR) | `kit next-code DM`, `kit next-code DM-F03 --type US` |
| Viết / sửa yêu cầu | `/spec` |
| Xem màn hình trước khi duyệt | `/prototype <file> <mã>` |
| Duyệt spec / prototype / test case | `kit approve <mã>` / `--prototype` / `--testcase` |
| Đủ điều kiện viết TC, code chưa | `kit ready <mã>` |
| Test case e2e | `/testcase <mã>` → `kit approve <mã> --testcase` → `kit gate <mã>` |
| Sinh script e2e | `/e2e-script <mã>` |
| Code theo spec đã duyệt / sửa bug | `/dev <file> <mã>` / `/dev #<issue>` |
| Chạy e2e, báo cáo (app đang chạy) | `kit e2e <mã> --base-url <địa chỉ>`; `kit e2e changed` cho cả nhánh |
| Đọc kết quả lần chạy gần nhất | `e2e/test-results/reports/latest.md` |
| Dời script phẳng kiểu cũ vào thư mục module | `kit init --migrate` (`--dry-run` để xem trước) |
| Test e2e fail: phân loại, ghi bug | `/e2e-triage` (ở máy) / `/e2e-triage <run-id>` (lần chạy CI) |
| Mở PR | `/ship` |
| Cắm vào CI của dự án | một bước `dunglt-iks/ai-kit/actions/e2e@v2` ([04](04-ci-workflow.md)) |

**Ai làm gì:** AI phỏng vấn, viết tài liệu, code, test, review. **Người** duyệt spec, prototype, test case (`kit approve`),
kế hoạch, và xác nhận mỗi lần commit / push. Code tất định (`kit`) cấp mã, ghi và kiểm trạng thái duyệt,
chặn PR, chọn test, ghi bug. CI chỉ kiểm và chạy, không gọi AI.
