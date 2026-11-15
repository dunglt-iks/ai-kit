# 04 — Cắm ai-kit vào CI: `kit e2e` và action `e2e`

## 1. Ranh giới

CI/CD là của dự án: build, dựng / tắt app và dịch vụ, deploy, runner, secret. ai-kit cung cấp **một điểm cắm**: lệnh
`kit e2e` và GitHub action `actions/e2e` bọc lệnh đó. Dự án gọi điểm cắm ở chỗ mình muốn, sau bước dựng app của mình,
với tham số chọn luồng test. Kit không chép, không sửa workflow nào của dự án, không đụng deploy, và **không gọi AI
trên CI** (D8): test case, script, phân loại test fail đều làm ở máy (`/testcase`, `/e2e-script`, `/e2e-triage`).
Phạm vi giữa CI, bộ khung test và kit: [05 §1](05-environments.md).

## 2. `kit e2e`

```
kit e2e <phạm vi> [tuỳ chọn]
```

| Phạm vi | Chạy | Gate mặc định |
|---|---|---|
| `none` | Không chạy script nào | Có — các feature của PR |
| `changed` | Script các feature của PR (kể cả feature kéo theo bởi `trigger.featureMap`) **+ bộ smoke** (`run.smoke`, mặc định `e2e/tests/**`) **+ TC P1 của các feature khác** (`run.smokePriority`, lượt hai, gộp kết quả) — bắt hồi quy ở feature PR không khai | Có |
| `all` | Mọi test của lệnh `run.command` | Không |
| `<mã\|tên script>…` | Chỉ các script này (`DM-F01`, `DM-F01.spec.mjs`) | Có |

| Tuỳ chọn | Việc |
|---|---|
| `--base-url <url>` | Địa chỉ app dự án đã dựng → biến `run.baseUrlEnv` cho lệnh test |
| `--env <tên>` | Nhãn môi trường trong báo cáo / issue (`pr`, `dev`, `staging`…; mặc định `local`) |
| `--grep <mẫu>` | Chỉ chạy test có tên khớp (vd một mã TC) |
| `--gate` / `--no-gate` | Bật / tắt gate (TC có, đã duyệt, phủ đủ, khớp spec; script có, khớp TC) |
| `--close-fixed` | Đóng issue có test đã pass lại (hồi quy trên nhánh chính) |
| `--publish github` | Comment PR (gate + kết quả), nhãn `gate.blockedLabel`, step summary — action bật sẵn |
| `--merge` | Gộp vào kết quả cũ (chạy lại một phần — `/e2e-triage` dùng) |
| `--shard i/n` | Chạy phần i trong n (song song nhiều máy). Lệnh ghép thì đặt chỗ `{shard}` trong `run.command`. Gộp ở job sau: `kit report --results a.json --results b.json … --strict --publish github` |
| `--fail-on gate\|test\|never` | Khi nào thoát 1: `test` (mặc định) — gate đỏ hoặc test fail; `gate` — chỉ gate; `never` |

Thứ tự: lấy feature (PR: tiêu đề, nhánh, tiêu đề commit, status file; danh sách: từ tham số) → gate → chạy
`run.command` → báo cáo (`reports/latest.md`, `raw/result.json`, comment PR) → đóng issue đã hết (nếu `--close-fixed`). Test fail chưa
phân loại **không** thành bug; comment nhắc chạy `/e2e-triage` ([07](07-bug-reporting.md)). Lệnh test thoát khác 0
mà không test nào chạy (app chưa lên, `globalSetup` lỗi) vẫn là đỏ; TC đã duyệt trong phạm vi mà không có test nào
thực sự chạy (thiếu, bị comment, skip) cũng là đỏ — trừ khi `--grep`. Đăng lên GitHub lỗi (PR từ fork, token chỉ đọc)
chỉ cảnh báo, không chặn việc chạy test. Lệnh test của dự án **không** nhận `GITHUB_TOKEN` / `GH_TOKEN` của kit.

Ở máy dùng cùng lệnh: `kit e2e changed --base-url http://localhost:3000` trước khi push (`/ship`), `kit e2e DM-F03
--no-gate --base-url …` khi chạy thử script (`/e2e-script`). Không có PR thì kit so nhánh hiện tại với
`<project.remote>/<project.baseBranch>` (đổi bằng `--base`, `--title`).

### Nhận diện mã feature của PR

| Nguồn | Ví dụ |
|---|---|
| Tiêu đề PR | `feat(dl-f05): dòng sản phẩm` |
| Tên nhánh | `feat/dl-f05-dong-san-pham` (luật chuẩn hoá: `spec.normalize`) |
| Tiêu đề commit (không đọc phần thân) | `fix(DL-F05-US02): …` |
| `trigger.statusFile` (tuỳ chọn) | Dòng bảng có mã feature đổi sang một giá trị trong `trigger.statusDone` |

`trigger.featureMap` (`{ "<glob file code>": [<mã feature>…] }`): PR đổi file khớp thì kéo thêm các feature đó vào phạm vi
(code dùng chung). Vẫn phải khai ít nhất một mã trong tiêu đề / nhánh / commit.

Mẫu mã do spec adapter quyết. Mã không có trong spec chỉ cảnh báo. Feature `[DEPRECATED]`: gate bỏ qua, script của nó
không chạy. PR sửa `trigger.codePaths` mà không có mã nào →
gate đỏ, trừ khi có nhãn `trigger.skipLabel`.

## 3. Action `e2e` (GitHub)

`uses: dunglt-iks/ai-kit/actions/e2e@<kitRef>` — cài kit theo đúng ref, đọc sự kiện PR, gọi `kit e2e --publish
github`, upload thư mục kết quả làm artifact (cho `/e2e-triage <run-id>`). Input: `scope`, `base-url`, `env`, `grep`,
`gate` (`auto` | `true` | `false`), `close-fixed`, `fail-on`, `root` (thư mục chứa `ai-kit.yml`), `artifact`. Output:
`features`, `gate`, `failed`. Đổi phiên bản kit: đổi `@<ref>` cùng lúc với `kitRef` trong `ai-kit.yml`.

Job cần `actions/checkout` với `fetch-depth: 0` (kit đọc commit của PR) và quyền:

```yaml
permissions:
  contents: read
  pull-requests: write   # comment
  issues: write          # nhãn chặn, đóng issue đã hết
```

### Mẫu 1 — PR chỉ gate (không dựng app)

```yaml
on: pull_request
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: dunglt-iks/ai-kit/actions/e2e@v2
        with: { scope: none }
```

### Mẫu 2 — PR chạy e2e, sau bước dựng app của dự án

```yaml
      # … các bước của dự án: checkout (fetch-depth: 0), cài, build, dựng app ở http://localhost:3000 …
      - uses: dunglt-iks/ai-kit/actions/e2e@v2
        with:
          scope: changed
          base-url: http://localhost:3000
          env: pr
```

Dự án đã có job e2e thì chỉ thêm bước này vào job đó, không cần job mới.

Action giữ lịch sử kết quả (`run.history`) giữa các lần chạy bằng cache (input `history`, mặc định bật) — để `kit flaky`
và `/e2e-triage` phân loại chập chờn theo dữ liệu. Bộ test lớn: chia `shard` bằng matrix (`shard: ${{ matrix.shard }}/4`,
`artifact: e2e-${{ matrix.shard }}`), rồi một job gộp tải các artifact và chạy `kit report --results … --strict
--publish github`.

### Mẫu 3 — Hồi quy sau deploy / hằng đêm

```yaml
on:
  workflow_run: { workflows: ["<tên workflow deploy của dự án>"], types: [completed] }
  schedule: [{ cron: "0 19 * * *" }]
jobs:
  regression:
    if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - # … cài phụ thuộc + trình duyệt của dự án …
      - uses: dunglt-iks/ai-kit/actions/e2e@v2
        with:
          scope: all
          base-url: https://dev.example.com
          env: dev
          close-fixed: 'true'
```

Ví dụ chạy thật: [`.github/workflows/demo-e2e-spec.yml`](../.github/workflows/demo-e2e-spec.yml) (dự án mẫu
`examples/demo`). Hệ CI khác GitHub: clone kit theo `kitRef`, `npm ci --prefix .ai-kit --omit=dev`, rồi gọi
`node .ai-kit/cli/bin/kit.mjs e2e …` (không có `--publish`: kết quả ở `e2e/test-results/reports/latest.md`, `raw/result.json` và mã thoát).

## 4. Người, AI, CI làm gì

**Giống nhau, ở máy:** `/spec` → `kit approve` → `/prototype` → `kit approve --prototype` → `/testcase` →
`kit approve --testcase` → `/e2e-script` → `/dev` → `/ship` (`kit e2e changed`). Test fail → `/e2e-triage`.

| Lúc | Người | AI (ở máy, người gọi) | CI (`kit e2e`, không AI) |
|---|---|---|---|
| Cắm vào CI (một lần) | Thêm bước action vào workflow của dự án (mẫu 1, 2 hoặc 3); khai `run.command`, `run.baseUrlEnv` | `/kit-adopt` đề xuất `run.command`, chỗ cắm | — |
| PR | Đọc comment khi đỏ, làm theo | — | Gate (+ chạy e2e với mẫu 2); comment, nhãn chặn |
| Gate đỏ: thiếu / lệch TC | `kit approve <mã> --testcase` sau khi đọc; push | `/testcase <mã>` | Gate lại khi push |
| Gate đỏ: thiếu / lệch script | Xác nhận commit, push | `/e2e-script <mã>` | Gate lại khi push |
| Test fail (PR hoặc hồi quy) | Gọi `/e2e-triage <run-id>`; quyết ghi bug; xác nhận commit | Phân loại; sửa script; ghi issue khi được đồng ý; lỗi app → `/dev #<issue>` (agent con tester, reviewer) | Báo, không ghi bug; hồi quy đóng issue đã hết |

Hồi quy đỏ thì GitHub gửi thông báo; dự án nên giao một người trực chạy `/e2e-triage`, vì CI không phân loại và không
ghi bug.

## 5. Bẫy

| Bẫy | Cách xử lý |
|---|---|
| Script sinh ở máy nhưng quên push / TC sửa sau khi sinh | Gate đỏ (thiếu script, hash lệch) kèm lệnh `/e2e-script <mã>` |
| Checkout nông (`fetch-depth: 1`), thiếu remote | `kit e2e none` / `changed` báo lỗi kèm hướng dẫn: đặt `fetch-depth: 0`; chạy hằng đêm / sau deploy dùng `all` |
| Artifact chứa trace | Trace của test fail có cookie phiên đăng nhập test. Action không đưa `.auth/` (file ẩn) lên artifact; giữ tài khoản test tách khỏi tài khoản thật, artifact tự xoá sau 7 ngày |
| Hai push liên tiếp vào cùng PR | `concurrency: e2e-<PR>`, `cancel-in-progress: true` trong workflow của dự án |
| App chưa lên khi test chạy | Bước dựng app của dự án phải chờ app sẵn sàng (health check) rồi mới tới bước kit |
| Gói Free, repo private: không bật được required check | Gate đỏ + comment + nhãn `e2e-blocked`; quy ước không merge PR còn nhãn. Gói trả phí / repo public: đặt check bắt buộc |
