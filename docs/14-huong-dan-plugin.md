# 14 — Hướng dẫn dùng ai-kit (gói `ai-kit` + plugin `kit`)

Hai trường hợp:

- **[Phần A](#phần-a--tích-hợp-vào-dự-án-đang-có)** — dự án đang chạy, đã có code, có thể đã có `CLAUDE.md`, tài liệu
  yêu cầu theo kiểu riêng, test e2e.
- **[Phần B](#phần-b--dự-án-mới)** — repo mới, chưa có code.

Phần C dùng chung: một vòng làm feature, đồng đội, nâng cấp, sự cố hay gặp. Bài thực hành có kết quả mong đợi từng bước:
[12](12-user-guide.md). Cách viết spec: [13](13-tai-lieu-spec.md). Cấu hình: [11](11-cau-hinh.md).

## 0. Cần biết trước

**Cần có:** Node.js ≥ 22, git, Claude Code; `gh` (đã đăng nhập) nếu muốn AI mở PR, ghi bug lên GitHub.

**Kit gồm ba kênh, cùng một tag** (vd `v3.0.0`):

| Kênh | Dùng để | Cài |
|---|---|---|
| Gói npm `ai-kit` | lệnh `kit` (cấp mã, duyệt, gate, chạy e2e, báo cáo) + quy trình, prompt, khuôn cho AI đọc | `npm install -D github:dunglt-iks/ai-kit#v3.0.0` |
| Plugin Claude Code `kit` | lệnh `/kit:spec` … `/kit:adopt`, agent `kit:reviewer` / `kit:spec-reviewer` / `kit:tester`, hook chặn AI chạy `kit approve` | `claude plugin install kit@ai-kit --scope project` |
| `actions/gate`, `actions/e2e` | CI GitHub của dự án (tuỳ chọn) | `uses: dunglt-iks/ai-kit/actions/<tên>@v3.0.0` |

Plugin **mỏng**: mỗi lệnh `/kit:*` chỉ bảo AI đọc file quy trình trong gói đã cài (`node_modules/ai-kit/process/…`). Vì
vậy quy trình AI theo luôn đúng bản kit trong lockfile của dự án; phải cài **cả hai** — thiếu gói thì lệnh `/kit:*`
dừng và nhờ bạn `npm install`.

**Ai làm gì:** **bạn** gõ lệnh, trả lời câu hỏi, duyệt (`kit approve`), đồng ý commit / push. **AI** (`/kit:*`) phỏng
vấn, viết spec, prototype, test case, script, code, review. **`kit`** (code tất định) cấp mã, ghi và kiểm trạng thái
duyệt, gate, chọn test, báo cáo. Dưới đây `kit` = `npx kit`.

Lệnh `/kit:*` chỉ **người** gọi được (AI không tự chuyển bước). Gõ `/kit` trong Claude Code để xem danh sách.

## Phần A — Tích hợp vào dự án đang có

Mục tiêu: thêm lớp **quy trình** mà không đụng lớp **kỹ thuật** của repo. Kit không sửa code, không sửa CI, không viết
đè `CLAUDE.md` — chỉ chèn một khối `<!-- ai-kit:start … end -->` ở cuối.

### A1. Chuẩn bị

- Làm trên nhánh riêng, cây làm việc sạch (`git status` trống) để dễ xem kit đổi gì.
- Repo **không có `package.json` ở gốc** (vd dự án Go, Python, hay JS nằm trong thư mục con) → `npm init -y` ở gốc.
  `package.json` gốc chỉ để ghim phiên bản kit (và Playwright nếu dùng TAF); không ảnh hưởng build của dự án.

### A2. Cài gói, nhúng

```bash
npm install -D github:dunglt-iks/ai-kit#v3.0.0
npx kit init --dry-run          # xem trước sẽ tạo / sửa gì
npx kit init
```

| File | Kit làm gì | Lưu ý với repo đang có |
|---|---|---|
| `ai-kit.yml` | tạo từ mẫu; `guides` điền các file hướng dẫn AI dò được ở gốc (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`…) | đã có thì giữ nguyên, không bao giờ ghi đè |
| `.claude/settings.json` | khai marketplace `ai-kit` ghim tag của gói, bật plugin `kit@ai-kit`, thêm luật deny `kit approve` | **trộn** với settings sẵn có: quyền, hook, plugin khác giữ nguyên; repo đặt `"kit@ai-kit": false` thì vẫn tắt |
| `CLAUDE.md` | chèn khối cầu nối ở cuối (chưa có file thì tạo) | nội dung ngoài khối giữ nguyên từng byte |
| `.gitignore` | thêm `/e2e/test-results/` | |

Cuối lệnh, kit tự kiểm (như `kit doctor`). Cảnh báo `⚠` ở bước này là bình thường — `/kit:adopt` sẽ xử lý. Lệnh `/spec`,
`/dev`… riêng của repo (trong `.claude/commands/`) không đụng nhau với plugin vì lệnh của kit có tiền tố `/kit:`.

### A3. Cài plugin

Mở `claude` ở gốc repo, **chấp nhận tin cậy thư mục** (Claude Code mới đọc marketplace khai trong settings), thoát ra rồi:

```bash
claude plugin install kit@ai-kit --scope project
```

Kiểm: trong Claude Code gõ `/kit` thấy `/kit:spec` … `/kit:adopt`. Thử bảo AI "chạy `npx kit approve <mã bất kỳ>`" —
phải bị chặn, AI nhờ bạn tự chạy.

### A4. `/kit:adopt` — khớp kit với repo

Trong Claude Code gõ `/kit:adopt`. AI đọc guides, cấu trúc repo, CI, lịch sử commit rồi trình bày (chưa ghi gì):

1. **Bản `ai-kit.yml` đề xuất** — mỗi khoá kèm căn cứ (file:dòng). Các khoá cần soát kỹ ở repo đang có:

   | Khoá | Soát gì |
   |---|---|
   | `guides` | đủ file hướng dẫn kỹ thuật chưa — kit chỉ dò ở gốc; file trong thư mục con (vd `fe/AGENTS.md`), tài liệu kiến trúc thì thêm tay |
   | `spec.roots`, `featurePattern`, `normalize`, `status` | tài liệu yêu cầu hiện có nằm đâu, mã đang dùng dạng gì |
   | `stack.checks` | đúng lệnh lint / build / test mà CI và guides đang chạy, đúng thư mục (`cwd`) |
   | `stack.traceability.searchPaths`, `trigger.codePaths` | thư mục code + test thật của repo (mặc định `src` thường không đúng) |
   | `stack.env` | cách bật app ở máy và địa chỉ, để chạy e2e |
   | `scripts.ext`, `scripts.guide`, `run.command`, `run.baseUrlEnv` | khớp khung e2e đang có (TypeScript → `.spec.ts`; biến địa chỉ app mà `playwright.config` đọc) |
   | `project.baseBranch`, `prTool` | nhánh chính, có dùng `gh` không |

2. **Bảng mâu thuẫn** guides ↔ kit (nơi viết spec, cách đánh mã, ai duyệt, e2e viết tay hay TAF, quy ước commit / PR).
   Bạn chọn từng dòng; AI không tự sửa guides — muốn sửa thì nói rõ.
3. **Gợi ý CI** (nếu repo có GitHub Actions) — chỉ đề xuất, không tự tạo workflow.

Duyệt xong AI mới ghi `ai-kit.yml` và chạy lại `kit init` để tự kiểm.

### A5. Tài liệu và test cũ — áp dụng dần

Không cần chuyển hết một lần. Cách hay dùng:

| Tình huống | Làm gì |
|---|---|
| Tài liệu yêu cầu theo kiểu khác (ticket, SRS, Confluence) | giữ làm tham khảo; **feature mới** viết theo khuôn kit (`/kit:spec`, PRD + FSD ở `docs/features/<MOD>-<tên>/`) |
| Feature cũ sắp sửa | chuyển sang khuôn kit lúc đụng tới: `/kit:spec chuyển chức năng <…> (<file cũ>) sang khuôn của kit` — AI mô tả đúng hành vi đang có, bạn duyệt |
| Không muốn đổi định dạng tài liệu | viết spec adapter riêng (`spec.adapter: ./…mjs`, xem `node_modules/ai-kit/adapters/README.md`) |
| Đã có test e2e viết tay | để nguyên (vd `e2e/tests/` — mặc định là `run.smoke`, chạy kèm mỗi lần `kit e2e changed`); test mới cho feature theo spec đi qua TAF (`e2e/scripts/<MOD>/`) |
| Chưa có e2e | làm như [B4](#b4-khung-e2e-khi-cần) khi bắt đầu dùng TAF |

`trigger.codePaths`: PR sửa file trong đây mà không khai mã feature thì `kit gate --pr` đỏ. Lúc mới áp dụng, phần lớn
code chưa có mã — để hẹp (chỉ thư mục đang làm theo kit) hoặc gắn nhãn `trigger.skipLabel` cho PR không đổi hành vi;
chuyển dần sang khuôn kit rồi mới mở rộng.

### A6. Kiểm, commit, báo đồng đội

```bash
kit doctor          # 0 lỗi
kit context         # kit hiểu repo thế nào: hai lớp quy định, module, feature
git add ai-kit.yml .claude/settings.json CLAUDE.md .gitignore package.json package-lock.json
git commit -m "chore: nhúng ai-kit"
```

Báo đồng đội làm [C2](#c2-đồng-đội-tham-gia). CI (tuỳ chọn): [C4](#c4-ci-tuỳ-chọn).

## Phần B — Dự án mới

Với repo mới, kit cho phép **viết spec trước, code sau**: chốt yêu cầu và màn hình, rồi mới dựng khung code. Lớp kỹ thuật
(stack, cấu trúc, lint) vẫn là của bạn — kit không chọn stack.

### B1. Khởi tạo repo, cài kit

```bash
mkdir my-app && cd my-app && git init
npm init -y
npm install -D github:dunglt-iks/ai-kit#v3.0.0
npx kit init
```

Kit tạo `ai-kit.yml`, `.claude/settings.json`, `CLAUDE.md` (chỉ có khối cầu nối), `.gitignore`. Kết quả tự kiểm mong đợi:
**0 lỗi, 4 cảnh báo** — `guides` rỗng, chưa có `docs/features`, chưa có `e2e/README.md`, `stack.checks` rỗng. Các cảnh báo
này hết dần ở các bước sau.

Cài plugin như [A3](#a3-cài-plugin), rồi commit một mốc:

```bash
git add -A && git commit -m "chore: khởi tạo, nhúng ai-kit"
```

### B2. Spec module đầu tiên

Trong Claude Code:

```
/kit:spec <mô tả sản phẩm / module đầu tiên, vd: quản lý đơn hàng cho cửa hàng nhỏ>
```

AI hỏi (tối đa 5 câu mỗi lượt), đề xuất mã module (vd `DH`) — **xác nhận rõ** đây là module mới — rồi tạo
`docs/features/DH-<tên>/PRD-<tên>.md` + `FSD-<tên>.md`, feature `DH-F01`… ở trạng thái **Nháp**, và gọi `spec-reviewer`
soát. Tiếp:

```
/kit:prototype docs/features/DH-…/FSD-….md DH-F01      # HTML tĩnh, mở bằng trình duyệt bấm thử
```

```bash
kit approve DH-F01 && kit approve DH-F01 --prototype     # người duyệt
kit ready DH-F01                                         # ✓
```

Ứng dụng không có giao diện → đặt `spec.prototype: false` trong `ai-kit.yml`, bỏ bước prototype.

### B3. Lớp kỹ thuật: dựng khung, viết guides

1. Chọn stack, dựng khung (công cụ của framework, hoặc nhờ Claude Code bình thường — ngoài `/kit:*`).
2. Viết quy định kỹ thuật vào `CLAUDE.md` **phía trên** khối `ai-kit:start` (hoặc file riêng như `docs/architecture.md`):
   stack, cấu trúc thư mục, chia lớp, lint, test đơn vị, lệnh trước khi commit. Có thể nhờ AI soạn nháp rồi sửa.
3. Khai vào `ai-kit.yml`:

   ```yaml
   guides: [CLAUDE.md]                       # + docs/architecture.md nếu có
   stack:
     checks:
       - { name: lint, run: npm run lint }
       - { name: test, run: npm test }
     traceability: { searchPaths: [src, e2e] }
     env: "npm run dev → http://localhost:3000"
   trigger:
     codePaths: [src/**]
   ```

   Hoặc chạy lại `/kit:adopt` — giờ repo đã có code, AI đề xuất được có căn cứ.

### B4. Khung e2e (khi cần)

TAF chạy Playwright của dự án; kit không dựng sẵn. Một lần:

```bash
npm init playwright@latest          # chọn TypeScript, thư mục e2e
```

- `ai-kit.yml`: `scripts.ext: .spec.ts` (nếu TypeScript); `run.baseUrlEnv` khớp biến mà `playwright.config` đọc làm
  `baseURL` (mặc định `E2E_BASE_URL`).
- Viết `e2e/README.md` (`scripts.guide`) — AI đọc trước khi sinh script: page object để ở đâu, fixture dựng dữ liệu /
  đăng nhập, quy ước tên, cách dọn dữ liệu. Có thể nhờ AI soạn, bạn duyệt. Tham khảo cấu trúc `e2e/` ở
  [01 §3](01-architecture.md), dữ liệu test [06](06-test-data.md), Playwright cơ bản [09](09-playwright-primer.md).
- Có nhiều vai trò người dùng → `e2e/testdata/personas.yml` (`testcases.personas`).

```bash
kit doctor          # 0 lỗi, hết các cảnh báo ở B1
git add -A && git commit -m "chore: khung code, guides, e2e"
```

### B5. Feature đầu tiên đến PR

Đi đủ vòng ở [C1](#c1-một-vòng-feature) cho `DH-F01`. Feature tiếp theo: `/kit:spec` (AI tự cấp mã kế tiếp qua
`kit next-code`) → lặp lại vòng.

## Phần C — Dùng chung

### C1. Một vòng feature

| # | Ai | Lệnh | Kết quả |
|---|---|---|---|
| 1 | AI | `/kit:spec <yêu cầu>` | PRD / FSD nháp, có mã `<MOD>-F##`, US, SCR, BR; spec-reviewer soát |
| 2 | AI | `/kit:prototype <FSD> <mã>` | `PROTOTYPE-….html`; đổi bố cục ghi ngược về FSD |
| 3 | Người | `kit approve <mã>` · `kit approve <mã> --prototype` · `kit ready <mã>` | spec, prototype đã duyệt |
| 4 | AI | `/kit:testcase <mã>` | `e2e/testcases/<MOD>/<mã>.md` nháp |
| 5 | Người | `kit approve <mã> --testcase` | TC đã duyệt (ghi người, `approvedHash`) |
| 6 | AI | `/kit:e2e-script <mã>` | script + page object; code chưa có thì fail — đúng mong đợi |
| 7 | AI + người | `/kit:dev <FSD> <mã>` | kế hoạch → **dừng chờ bạn đồng ý** → code, `stack.checks`, tester, reviewer |
| 8 | Người | `kit e2e <mã> --base-url <địa chỉ app>` | báo cáo `e2e/test-results/reports/latest.md`; fail → `/kit:e2e-triage` |
| 9 | AI | `/kit:ship` | kiểm cuối, mở PR (hỏi trước khi push), theo dõi CI |

Bug từ issue: `/kit:dev #<số issue>`. Đổi yêu cầu giữa chừng: quay lại `/kit:spec` — AI đặt lại ô Spec (và Prototype nếu
màn hình đổi) về nháp, phải duyệt lại; TC viết theo spec cũ thành lỗi thời, `kit gate` báo.

### C2. Đồng đội tham gia

Mỗi người, một lần mỗi bản clone:

```bash
npm install                                        # có gói ai-kit đúng bản trong lockfile
claude                                             # chấp nhận tin cậy thư mục, thoát
claude plugin install kit@ai-kit --scope project
```

`enabledPlugins` trong `.claude/settings.json` **không tự cài** plugin — thiếu bước cuối thì không có `/kit:*`.

### C3. Nâng cấp kit

```bash
npm install -D github:dunglt-iks/ai-kit#<tag mới>
npx kit init                       # đổi ref của plugin trong settings cho khớp gói
```

Rồi đổi `@<tag>` của action trong CI (nếu dùng), commit `package.json`, lockfile, `.claude/settings.json`. Mỗi người
`npm install` rồi cập nhật plugin theo `ref` mới: `claude plugin marketplace update ai-kit && claude plugin update
kit@ai-kit --scope project`. Quên bước này, `/kit:*` vẫn chạy (đọc quy trình từ gói mới) nhưng hook / agent là bản cũ.
Lên phiên bản chính (vd 3 → 4) đọc Change Log ở [README](README.md) trước.

### C4. CI (tuỳ chọn)

Chép workflow mẫu ở [04 §4](04-ci-workflow.md): PR → `actions/gate` (tuân thủ: mã, duyệt, TC, script; không cần app);
sau deploy dev / hằng đêm → `actions/e2e` vào địa chỉ đã deploy. CI không gọi AI; test fail thì về máy chạy
`/kit:e2e-triage`. Muốn chắc trạng thái duyệt không bị sửa tay: đặt CODEOWNERS cho thư mục spec và test case
([10 §2](10-quy-trinh.md)).

### C5. Sự cố hay gặp

| Hiện tượng | Nguyên nhân · cách xử lý |
|---|---|
| Gõ `/kit` không thấy lệnh | plugin chưa cài ([A3](#a3-cài-plugin)), hoặc chưa chấp nhận tin cậy thư mục; kiểm bằng `/plugin` |
| `claude plugin install` báo không tìm thấy marketplace / ref | chưa mở Claude Code ở repo để chấp nhận tin cậy; hoặc tag trong `.claude/settings.json` chưa được phát hành |
| `/kit:*` dừng, báo không có `kit` | chưa `npm install` (thiếu gói `ai-kit` trong `node_modules`) |
| `kit doctor`: settings "chưa khớp ai-kit X" | vừa nâng gói mà chưa chạy lại `npx kit init` |
| `kit doctor`: "tắt plugin kit@ai-kit" | `enabledPlugins` đặt `false` — xoá dòng đó hoặc đặt `true` nếu muốn dùng |
| AI bị chặn khi chạy `kit approve` | đúng thiết kế: duyệt là việc của người — bạn tự chạy |
| Phiên Claude Code trên cloud (claude.ai/code) không có `/kit:*` | cloud không nạp plugin khai trong repo; dùng ở máy, hoặc nhờ quản trị bật plugin cho tổ chức |
| `kit ready` ✘ dù đã duyệt | màn hình trong spec đổi sau khi duyệt prototype (dấu hash lệch) — `/kit:prototype` cập nhật rồi `kit approve <mã> --prototype` |
