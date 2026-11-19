# 04 — Cắm ai-kit vào CI: `kit gate`, `kit e2e`, action `gate` và `e2e`

## 1. Ranh giới

CI/CD là của dự án: build, dựng / tắt app và dịch vụ, deploy, runner, secret. ai-kit cung cấp **hai điểm cắm**, mỗi điểm
là một lệnh và một GitHub action bọc lệnh đó:

| Điểm cắm | Lệnh | Action | Khi nào | Cần app? |
|---|---|---|---|---|
| **Kiểm tuân thủ của PR** | `kit gate --pr` | `actions/gate` | PR mở / cập nhật | Không |
| **Chạy e2e / hồi quy** | `kit e2e all \| changed \| <mã>` | `actions/e2e` | Sau deploy dev / staging, hằng đêm, chạy tay | Có — địa chỉ app đã deploy |

Dự án đặt hai bước này vào workflow của mình (mẫu §4). Kit không chép, không sửa workflow nào, không build, không deploy,
và **không gọi AI trên CI** (D8): test case, script, phân loại test fail đều làm ở máy (`/testcase`, `/e2e-script`,
`/e2e-triage`). Phạm vi giữa CI, bộ khung test và kit: [05 §1](05-environments.md).

**Vì sao PR chỉ gate, không chạy e2e?** Code của PR chưa có trên dev — chạy e2e vào dev lúc đó là test code cũ. Muốn
chạy e2e trên PR thì dự án phải dựng app cho từng PR (build trong job hoặc preview deploy), tức là kit dính vào build.
Thay vào đó: người làm chạy `kit e2e changed` vào app ở máy trước khi push (`/ship`), CI gate PR, và e2e chạy trên dev
ngay sau khi PR được merge và deploy.

| | Được | Mất |
|---|---|---|
| PR gate + e2e sau deploy (mặc định) | Nhanh (10–20 giây), không phụ thuộc hạ tầng; chặn sớm PR thiếu spec / TC / script; kit không cần biết dự án build thế nào | Lỗi hành vi lộ ra sau merge + deploy dev, sửa bằng PR khác — bù bằng `kit e2e changed` ở máy (`/ship`) |
| E2E ngay trên PR | Bắt lỗi trước merge | Dự án dựng app / preview cho từng PR; job dài hơn. Làm được: gọi `actions/e2e` với `scope: changed`, `base-url` của bản dựng PR |

## 2. Lệnh

### `kit gate --pr` — tuân thủ của PR

Lấy mã feature của PR (bảng dưới), rồi với từng feature: spec đã duyệt; test case có, đã duyệt, còn khớp spec
(`specHash`, `approvedHash`), phủ đủ US / nhánh / SCR; script e2e có và khớp TC (`gate.requireScript`). PR sửa
`trigger.codePaths` mà không khai mã nào → đỏ, trừ khi có nhãn `trigger.skipLabel`. `--publish github`: comment PR
(một comment, sửa lại mỗi lần), nhãn `gate.blockedLabel`, step summary. Thoát 1 khi không qua. `kit gate <mã…>` (không
`--pr`) kiểm đúng các mã đó — dùng ở máy.

| Nguồn mã feature | Ví dụ |
|---|---|
| Tiêu đề PR | `feat(dl-f05): dòng sản phẩm` |
| Tên nhánh | `feat/dl-f05-dong-san-pham` (luật chuẩn hoá: `spec.normalize`) |
| Tiêu đề commit (không đọc phần thân) | `fix(DL-F05-US02): …` |
| `trigger.statusFile` (tuỳ chọn) | Dòng bảng có mã feature đổi sang một giá trị trong `trigger.statusDone` |
| `trigger.featureMap` | `{ "<glob file code>": [<mã>…] }` — PR đổi file khớp thì kéo thêm các feature đó (code dùng chung) |

Mẫu mã do spec adapter quyết. Mã không có trong spec chỉ cảnh báo. Feature `[DEPRECATED]`: bỏ qua. Không có PR (ở máy)
thì kit so nhánh hiện tại với `<project.remote>/<project.baseBranch>` (đổi bằng `--base`, `--title`).

### `kit e2e` — chạy e2e vào app đã dựng

```
kit e2e <phạm vi> [tuỳ chọn]
```

| Phạm vi | Chạy | Gate mặc định |
|---|---|---|
| `all` | Mọi test của lệnh `run.command` — hồi quy | Không |
| `changed` | Script các feature của nhánh / PR (cách lấy mã như trên) **+ bộ smoke** (`run.smoke`, mặc định `e2e/tests/**`) **+ TC P1 của các feature khác** (`run.smokePriority`, lượt hai) | Có |
| `<mã\|tên script>…` | Chỉ các script này (`DM-F01`, `DM-F01.spec.mjs`) | Có |

| Tuỳ chọn | Việc |
|---|---|
| `--base-url <url>` | Địa chỉ app → biến `run.baseUrlEnv` cho lệnh test |
| `--env <tên>` | Tên môi trường (`dev`, `staging`…; mặc định `local`) — ghi vào báo cáo, đặt tên issue theo dõi |
| `--wait <giây>` / `--no-wait` | Chờ app trả lời trước khi chạy (mặc định 0 = thử một lần). Xem dưới |
| `--wait-url <url>` | Địa chỉ để chờ, mặc định `--base-url` |
| `--track` | Issue theo dõi "E2E `<env>` đang đỏ" (§5). Cần `--env` |
| `--grep <mẫu>` | Chỉ chạy test có tên khớp (vd một mã TC) |
| `--gate` / `--no-gate` | Bật / tắt gate trước khi chạy |
| `--close-fixed` | Đóng issue bug có test đã pass lại ([07](07-bug-reporting.md)) |
| `--publish github` | Step summary, comment PR (khi chạy trong sự kiện PR) |
| `--merge` | Gộp vào kết quả cũ (chạy lại một phần — `/e2e-triage` dùng) |
| `--shard i/n` | Chạy phần i trong n (nhiều máy song song); gộp ở job sau: `kit report --results a.json --results b.json … --strict --publish github`. Lệnh ghép thì đặt chỗ `{shard}` trong `run.command` |
| `--fail-on test\|gate\|never` | Khi nào thoát 1: `test` (mặc định) — gate đỏ, test fail hoặc môi trường không lên; `gate` — chỉ gate; `never` |

Thứ tự: lấy feature → (gate) → **chờ app** → chạy `run.command` → báo cáo (`reports/latest.md`, `raw/result.json`,
step summary) → issue theo dõi (`--track`) → đóng bug đã hết (`--close-fixed`).

**Chờ app, app không phải làm thêm gì.** Kit gọi thẳng địa chỉ app (HTTP GET, không đi theo chuyển hướng) tới khi có
phản hồi mã **< 500** — kể cả 401 / 404, vì server đã trả lời; không đòi endpoint health. Hết thời gian chờ → **"môi
trường không lên"**: không chạy test, không tính là test fail, không đụng issue theo dõi; trạng thái `env-down`, thoát 1
(trừ `--fail-on never`). App có sẵn endpoint health thì đặt `--wait-url` cho chính xác hơn. Không cần kiểm "đúng phiên
bản đã deploy": workflow chỉ chạy sau khi deploy **thành công** (bước deploy thường đã chờ rollout xong) và checkout đúng
commit đó (§4), nên script luôn khớp code đang chạy.

**Đỏ hay xanh.** Test fail; lệnh test thoát khác 0 mà không test nào chạy (`globalSetup` lỗi); TC đã duyệt trong phạm vi
mà không có test nào thực sự chạy (thiếu, bị comment, skip — trừ khi `--grep`) — đều là đỏ. Test fail trong code dựng
dữ liệu (`run.setupPaths`, mặc định `e2e/support/**`) vẫn đỏ nhưng báo riêng là **lỗi dựng dữ liệu** — feature chưa được
kiểm, không kết luận feature hỏng ([06](06-test-data.md), [07](07-bug-reporting.md)). Test fail chưa phân loại
**không** thành bug. Đăng lên GitHub lỗi (PR từ fork, token chỉ đọc) chỉ cảnh báo. Lệnh test của dự án **không** nhận
`GITHUB_TOKEN` / `GH_TOKEN` của kit.

Ở máy dùng cùng lệnh: `kit e2e changed --base-url http://localhost:3000` trước khi push (`/ship`), `kit e2e DM-F03
--no-gate --base-url …` khi chạy thử script (`/e2e-script`), `kit e2e DM-F03 --merge --grep …` khi chạy lại (`/e2e-triage`).

## 3. Action

Dùng `dunglt-iks/ai-kit/actions/<tên>@<kitRef>` — action cài kit theo đúng ref của nó. Đổi phiên bản kit: đổi `@<ref>`
cùng lúc với `kitRef` trong `ai-kit.yml`.

**`actions/gate`** — gọi `kit gate --pr --publish github`. Input: `features` (trống = lấy từ PR), `publish` (mặc định
`true`), `fail` (mặc định `true`: bước đỏ khi gate không qua — đặt làm required check được; `false` = chỉ báo), `root`.
Output: `features`, `ok`. Cần `actions/checkout` với `fetch-depth: 0` (kit đọc commit của PR).

**`actions/e2e`** — chờ app, gọi `kit e2e`, upload thư mục kết quả làm artifact (cho `/e2e-triage <run-id>`), giữ lịch sử
kết quả (`run.history`) bằng cache cho `kit flaky`. Input:

| Input | Mặc định | Việc |
|---|---|---|
| `scope` | `all` | `all` \| `changed` (cần sự kiện PR) \| danh sách mã / tên script |
| `base-url` | — | Địa chỉ app đã deploy |
| `env` | `dev` | Tên môi trường |
| `wait-timeout` | `300` | Giây chờ app trả lời; `wait-url` (tuỳ chọn) địa chỉ để chờ |
| `track` | `auto` | Issue theo dõi môi trường: `auto` = bật trừ sự kiện PR và chạy chia shard |
| `close-fixed` | `false` | Đóng bug có test đã pass lại |
| `gate` | `false` | Kiểm TC + script trước khi chạy (tuân thủ PR đã có `actions/gate`) |
| `grep`, `shard`, `fail-on`, `history`, `publish`, `artifact`, `root` | | Như tuỳ chọn cùng tên của `kit e2e`; `publish: 'false'` cho job chạy thử |

Output: `status` (`passed` \| `failed` \| `gate-failed` \| `env-down` \| `skipped`), `failed`, `features`, `gate`.

Quyền job cần:

```yaml
permissions:
  contents: read
  pull-requests: write   # actions/gate: comment, nhãn chặn
  issues: write          # actions/e2e: issue theo dõi, đóng bug đã hết
```

## 4. Workflow mẫu

Một file, ba lúc chạy: PR → gate; deploy dev xong → e2e vào dev; hằng đêm → hồi quy trên staging. Chép vào
`.github/workflows/ai-kit.yml`, điền các chỗ `<…>`, khai biến repo `E2E_DEV_URL`, `E2E_STAGING_URL` (Settings →
Variables) và secret mà bộ khung test cần (vd mật khẩu persona trên môi trường dùng chung — [06](06-test-data.md)).
Workflow này **không** sửa workflow build / deploy sẵn có của dự án.

```yaml
name: ai-kit

on:
  pull_request:
  workflow_run:
    workflows: ["<tên workflow deploy dev>"]   # name: của workflow deploy hiện có
    types: [completed]
  schedule:
    - cron: "0 19 * * *"                      # 2 giờ sáng giờ Việt Nam
  workflow_dispatch:
    inputs:
      env: { description: "dev | staging", default: dev }
      scope: { description: "all | mã feature", default: all }

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  gate:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    concurrency: { group: "ai-kit-gate-${{ github.event.pull_request.number }}", cancel-in-progress: true }
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: dunglt-iks/ai-kit/actions/gate@v2

  e2e:
    if: >-
      github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success')
    runs-on: ubuntu-latest
    timeout-minutes: 60
    concurrency: { group: "ai-kit-e2e-${{ inputs.env || github.event_name }}", cancel-in-progress: false }
    env:
      E2E_ENV: ${{ inputs.env || (github.event_name == 'schedule' && 'staging') || 'dev' }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}   # đúng commit vừa deploy
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npx playwright install --with-deps chromium     # <cài phụ thuộc test của dự án>
      - uses: dunglt-iks/ai-kit/actions/e2e@v2
        with:
          scope: ${{ inputs.scope || 'all' }}
          env: ${{ env.E2E_ENV }}
          base-url: ${{ env.E2E_ENV == 'staging' && vars.E2E_STAGING_URL || vars.E2E_DEV_URL }}
          close-fixed: 'true'
        env:
          E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}        # <secret bộ khung test cần>
```

Ghi chú:

- **Deploy ngoài GitHub** (ArgoCD, Jenkins…): thay `workflow_run` bằng `repository_dispatch` do hệ CD gọi sau khi
  deploy xong, hoặc chỉ dùng `schedule` + chạy tay.
- **Lệnh, đường dẫn riêng của dự án**: cài phụ thuộc test, thư mục dự án (`root` khi `ai-kit.yml` không ở gốc repo).
- **Bộ test lớn**: chia shard bằng matrix — mỗi job `shard: ${{ matrix.shard }}/4`, `artifact: e2e-${{ matrix.shard }}`,
  `track: 'false'`; job gộp tải các artifact rồi `kit report --results … --strict --publish github`.
- **Hệ CI khác GitHub**: clone kit theo `kitRef`, `npm ci --prefix .ai-kit --omit=dev`, rồi gọi
  `node .ai-kit/cli/bin/kit.mjs gate --pr` / `… e2e all --base-url … --wait 300` (không `--publish` / `--track`: kết quả
  ở `e2e/test-results/reports/latest.md`, `raw/result.json` và mã thoát).
- **Required check**: là cài đặt branch protection của repo (cần quyền admin), kit không quản lý. Khuyến nghị: chạy
  job `gate` vài tuần, khi team quen thì đặt nó làm required check. Job `e2e` không gắn với PR nên không liên quan.

Repo ai-kit tự kiểm mẫu này: [`.github/workflows/sample-e2e.yml`](../.github/workflows/sample-e2e.yml) dựng
`examples/project1` làm "môi trường dev" rồi gọi `actions/gate`, `actions/e2e` (cả trường hợp môi trường không lên); unit
test đối chiếu mọi input dùng trong khối YAML trên với `action.yml`.

## 5. Issue theo dõi môi trường

Lần chạy `actions/e2e` (hoặc `kit e2e --track`) cập nhật **một issue đang mở cho mỗi môi trường**, nhãn
`tracker.trackLabel` (mặc định `e2e:<env>`):

| Lần chạy | Chưa có issue mở | Đang có issue mở |
|---|---|---|
| Đỏ | Mở "🔴 E2E `dev` đang đỏ": danh sách test fail, lỗi dựng dữ liệu, TC chưa chạy; việc cần làm (`/e2e-triage <run-id>`) | Sửa thân theo danh sách hiện tại (giữ mốc "đỏ từ"); comment: commit, run, **mới fail**, **đã hết** |
| Xanh | — | Comment "xanh lại ở commit …", đóng |
| Môi trường không lên, chạy một phần (`--grep`, `--shard`, `--merge`) | Không đụng | Không đụng |

Issue theo dõi **không phải bug**: nó trả lời "môi trường này đỏ từ khi nào, ở những test nào". Người trực nhận việc từ
đó, chạy `/e2e-triage <run-id>` ở máy; bug app được ghi thành issue riêng theo fingerprint ([07](07-bug-reporting.md)),
nhắc lại issue theo dõi. Lần đỏ sau khi đã đóng → mở issue mới.

## 6. Người, AI, CI làm gì

**Ở máy:** `/spec` → `kit approve` → `/prototype` → `kit approve --prototype` → `/testcase` → `kit approve --testcase` →
`/e2e-script` → `/dev` → `/ship` (`kit e2e changed` vào app ở máy). Test fail → `/e2e-triage`.

| Lúc | Người | AI (ở máy, người gọi) | CI (không AI) |
|---|---|---|---|
| Cắm vào CI (một lần) | Chép workflow mẫu §4, điền tên workflow deploy, biến URL, secret | `/kit-adopt` đề xuất `run.command`, chỗ cắm | — |
| PR | Đọc comment khi đỏ, làm theo | — | `actions/gate`: comment, nhãn chặn |
| Gate đỏ: thiếu / lệch TC | `kit approve <mã> --testcase` sau khi đọc; push | `/testcase <mã>` | Gate lại khi push |
| Gate đỏ: thiếu / lệch script | Xác nhận commit, push | `/e2e-script <mã>` | Gate lại khi push |
| Deploy dev xong / hằng đêm | — | — | `actions/e2e`: chờ app, chạy, báo cáo, issue theo dõi, đóng bug đã hết |
| Môi trường đỏ | Người trực: `/e2e-triage <run-id>`; quyết ghi bug; xác nhận commit | Phân loại; sửa script; ghi bug khi được đồng ý; lỗi app → `/dev #<issue>` | Lần chạy sau tự cập nhật / đóng issue theo dõi |
| Môi trường không lên | Kiểm deploy / địa chỉ | — | Step đỏ `env-down`, không chạy test |

## 7. Bẫy

| Bẫy | Cách xử lý |
|---|---|
| Script sinh ở máy nhưng quên push / TC sửa sau khi sinh | Gate đỏ (thiếu script, hash lệch) kèm lệnh `/e2e-script <mã>` |
| Checkout nông (`fetch-depth: 1`), thiếu remote | `kit gate --pr` / `kit e2e changed` báo lỗi kèm hướng dẫn: `fetch-depth: 0`; sau deploy / hằng đêm dùng `all` |
| Test chạy bản script khác bản đã deploy | Checkout `github.event.workflow_run.head_sha` (mẫu §4) |
| Deploy xong nhưng app chưa nhận request | `wait-timeout` (mặc định 300 giây); hết giờ → `env-down`, không báo test fail giả |
| Dữ liệu test trên môi trường dùng chung | Bộ khung test dựng / dọn qua fixture; ưu tiên API công khai của app ([06](06-test-data.md)) |
| Artifact chứa trace | Trace của test fail có cookie phiên đăng nhập test. Action không đưa `.auth/` (file ẩn) lên artifact; tài khoản test tách khỏi tài khoản thật; artifact tự xoá sau 7 ngày |
| Hai lần deploy sát nhau | `concurrency` theo môi trường, `cancel-in-progress: false` — chạy lần lượt, issue theo dõi cập nhật đúng thứ tự |
| Gói Free, repo private: không bật được required check | Gate đỏ + comment + nhãn `e2e-blocked`; quy ước không merge PR còn nhãn |
