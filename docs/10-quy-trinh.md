# 10 — Quy trình spec → prototype → dev → test → ship

Từ 2.0, kit có thêm **lớp quy trình**: các lệnh `/kit:spec` … `/kit:ship` (từ 3.0 qua plugin `kit`) và ba agent con (spec-reviewer, tester, reviewer) cho công cụ AI, khái quát từ cách làm của dự án
áp dụng đầu tiên. TAF (01–07) là phần kiểm thử e2e của quy trình này. Quy tắc mà AI phải theo nằm ở
[`RULES.md`](../RULES.md); tài liệu này giải thích thiết kế.

## 1. Hai lớp quy định

Repo nhúng kit thường **đã có** hướng dẫn cho AI (CLAUDE.md, AGENTS.md, GEMINI.md, rules của Cursor/Copilot…), nói về
kỹ thuật. Kit nói về quy trình. Hai thứ tách hẳn, mỗi thứ một chủ:

| Lớp | Gồm | Chủ | Nằm ở |
|---|---|---|---|
| Kỹ thuật — *code thế nào* | stack, framework, chia lớp, lint, bảo mật, i18n, cách viết test đơn vị, lệnh build/test | repo | file hướng dẫn của repo (`guides`), giữ nguyên |
| Quy trình — *đi đường nào* | tài liệu spec, mã, duyệt, version, kế hoạch, prototype, TC/e2e, truy vết, PR | kit | gói `ai-kit` (devDependencies, ghim bằng lockfile) + plugin `kit` + `ai-kit.yml` |

- **Kit không viết đè lớp của repo.** `kit init` chỉ đọc tên các file hướng dẫn để ghi vào `guides`, và chèn một
  khối ngắn có đánh dấu (§2).
- **Thứ tự ưu tiên:** code thế nào → repo; spec, quy trình, e2e đi đường nào → kit. Mâu thuẫn thật (vd repo bảo
  viết e2e tay ở thư mục cũ, kit bảo đi qua TAF) → AI dừng hỏi; quyết định ghi vào `ai-kit.yml` hoặc file của repo.
- **Bước 0 của mọi lệnh và agent:** `kit context` → đọc `guides` → đọc `RULES.md`. Agent con tự đọc lại, không giả
  định đã kế thừa ngữ cảnh. Không khai `stack.checks` thì AI lấy lệnh kiểm từ guides.

## 2. Khối cầu nối

`kit init` chèn (hoặc thay) đúng một khối giữa `<!-- ai-kit:start … -->` và `<!-- ai-kit:end -->` vào cuối
file hướng dẫn chính của từng công cụ. Nội dung: repo dùng ai-kit, hai lớp và thứ tự ưu tiên, bước 0, danh sách
lệnh. Phần ngoài khối giữ nguyên từng byte; chạy lại không nhân đôi.

| `agents` | Cài | Khối nằm ở |
|---|---|---|
| `claude` | `.claude/settings.json`: marketplace `ai-kit` ghim `ref` = tag của gói đang cài, bật plugin `kit@ai-kit`, luật deny `kit approve` | `CLAUDE.md` (liệt kê lệnh `/kit:x`) |

**Plugin `kit`** (thư mục `plugin/` của repo kit, marketplace ở `.claude-plugin/marketplace.json`) mang skill
`/kit:{spec,prototype,testcase,e2e-script,e2e-triage,dev,ship,adopt}`, agent `kit:{spec-reviewer,tester,reviewer}` và
một hook. Plugin **mỏng**: mỗi skill / agent chỉ trỏ tới `<kit>/process/<việc>.md` — `<kit>` là thư mục gói `ai-kit` cài
trong dự án (dòng `Kit` của `kit context`). Quy trình, prompt, CLI vì thế luôn đúng bản lockfile của dự án; plugin chỉ
cần cùng tag (kit init ghi `ref`, doctor báo khi lệch). Skill đặt `disable-model-invocation: true`: lệnh quy trình do
người gọi, AI không tự chuyển bước.

**Chặn AI tự duyệt** (D20) có hai lớp kỹ thuật, cộng quy tắc trong `RULES.md`:

| Lớp | Bắt | Bỏ sót |
|---|---|---|
| Luật deny trong `.claude/settings.json` (`Bash(npx kit approve *)`…) | cách gọi thường, kể cả trong lệnh ghép (`cd x && …`) | `npx -y`, `npm exec`, `node …/kit.mjs` |
| Hook `PreToolUse` của plugin (`plugin/hooks/guard.mjs`, thoát 2) | mọi cách gọi `kit … approve` ở vị trí lệnh | khi plugin chưa cài / bị tắt |

Cả hai chỉ chặn **lệnh**; trạng thái duyệt vẫn là chữ trong file (PRD, frontmatter TC), AI hay người đều sửa tay được
— gate chỉ bắt TC đã duyệt bị sửa (`approvedHash`), không chứng minh ai duyệt. Dự án cần chắc thì đặt **CODEOWNERS**
cho thư mục spec và test case, bật "Require review from Code Owners".

Không có plugin cho phiên Claude Code trên cloud (claude.ai/code chỉ nạp plugin do tổ chức quản lý). Công cụ khác
(Antigravity…) thêm adapter trong `adapters/agent/` sau.

## 3. Các bước

```
/kit:spec ─► (spec-reviewer) ─► /kit:prototype ─► kit approve (spec + prototype) ─► /kit:testcase ─► kit approve --testcase ─► /kit:e2e-script ─► /kit:dev ─► /kit:ship
(/kit:prototype chỉ khi có giao diện, chạy được khi spec còn nháp; /kit:dev gọi tester + reviewer; test e2e fail → /kit:e2e-triage;
 đổi nghiệp vụ ở bước sau → /kit:spec)
```

| Lệnh | Đầu vào | Ghi vào | Dừng chờ người |
|---|---|---|---|
| `/kit:spec` | mô tả việc | PRD/FSD (Spec, Prototype = nháp), việc nhỏ; tự gọi `spec-reviewer` | `kit approve <mã>` |
| `/kit:prototype` | file + mã (spec nháp hoặc đã duyệt) | `PROTOTYPE-<tên>.html`, phần màn hình của FSD (Prototype = nháp); `kit check-prototype` + `spec-reviewer` đối chiếu sau mỗi lần dựng | `kit approve <mã> --prototype` |
| `/kit:testcase` | mã qua `kit ready` | `testcases.dir` (TAF, [02](02-testcase-format.md)) | `kit approve <mã> --testcase` |
| `/kit:e2e-script` | mã qua `kit ready`, có TC đã duyệt | script + page object trong `scripts.allowedPaths` ([03](03-script-generation.md)) | trước khi chạy thử |
| `/kit:dev` | file + mã qua `kit ready`; mã việc nhỏ; hoặc `#<issue>` | kế hoạch (`spec.plansDir`), code, test, comment truy vết | duyệt kế hoạch; báo cáo cuối |
| `/kit:e2e-triage` | trống, run-id CI hoặc #PR | `triage.json`, bản sửa script; issue khi được đồng ý ([07](07-bug-reporting.md)) | trước khi ghi bug, commit |
| `/kit:ship` | nhánh hiện tại | rebase, `stack.checks`, `kit e2e changed`, PR | trước mỗi commit, push, tạo PR |
| `/kit:adopt` | — | đề xuất `ai-kit.yml` + bảng mâu thuẫn | duyệt trước khi ghi |

### 3.1 Duyệt bằng lệnh, cổng `kit ready`

- Bảng Feature Summary trong PRD có cột **Spec** và **Prototype**. AI chỉ được ghi **nháp**. Người duyệt bằng
  `kit approve <mã>` / `--prototype`: lệnh ghi `Đã duyệt (người, ngày)` — người lấy từ `git config user.name` — nên
  biết ai duyệt, lúc nào, và lịch sử nằm trong git. Test case: `kit approve <mã> --testcase` ghi `status` + `reviewer`
  trong file TC (từ chối TC còn lỗi lint hoặc lỗi thời).
- Duyệt prototype còn đóng dấu `<!-- ai-kit:prototype <MÃ>=<hash> -->` vào `PROTOTYPE-*.html`: hash của **phần màn
  hình** (các mục `SCR`) trong FSD lúc duyệt. Màn hình trong spec đổi sau đó → `kit ready` báo prototype không còn
  khớp, phải cập nhật và duyệt lại. Đổi luồng / quy tắc không làm mất duyệt prototype.
- `kit ready <mã>` (thoát 1 nếu chưa) là cổng của `/kit:testcase`, `/kit:e2e-script`, `/kit:dev`: spec đã duyệt, prototype đã
  duyệt và còn khớp (khi feature có màn hình và PRD có cột Prototype), mã không bị khai trùng.
- Tương thích: ô chỉ ghi `Đã duyệt` (không người, ngày) vẫn được coi là đã duyệt; PRD không có cột Prototype thì
  không theo dõi prototype; `spec.prototype: false` tắt hẳn.

### 3.2 Điểm chính khác

- **Thứ tự: test case trước code.** TC viết từ spec đã duyệt, không cần code. Có TC (và script) trước thì tester
  trong `/kit:dev` chạy được e2e ngay, và người duyệt TC thấy chỗ spec còn hở trước khi code. `/kit:dev` không chặn khi
  chưa có TC, chỉ nhắc.
- **Soát spec độc lập:** `/kit:spec` ghi xong thì tự gọi agent `spec-reviewer` (chỉ đọc) trước khi bàn giao; `/kit:prototype`
  sau mỗi lần dựng HTML chạy `kit check-prototype` (tất định: mỗi `SCR` có `<section id>`, mỗi thành phần đánh số
  có `data-ref`, không thừa) rồi gọi `spec-reviewer` đối chiếu phần cần đọc hiểu (nhãn, quy tắc hiển thị, luồng và
  nhánh bấm được, prototype không tự thêm nghiệp vụ) — cùng agent, không tách agent riêng (D22). Lỗi hình thức (mã, wireframe, Change Log…) AI tự sửa, soát lại tối đa 2
  vòng; vấn đề nội dung (tiêu chí mơ hồ, thiếu nhánh, mâu thuẫn, chỗ tự đoán) thành câu hỏi cho người dùng.
- **Không có agent BA/DEV riêng:** `/kit:spec`, `/kit:dev` cần hỏi qua lại với người dùng nên chạy ở luồng chính; agent con
  chỉ dùng cho việc cần **độc lập** (soát spec, test, review).
- **CI không gọi AI** (D8): TC, script, phân loại test fail làm ở máy trước khi push. `/kit:e2e-script` sinh script
  (`kit plan-gen` chọn việc, `check-script` / `check-paths` kiểm), hỏi trước khi chạy thử; gate (`kit e2e` ở máy, `kit gate --pr` trên CI)
  chặn PR khi script thiếu hoặc lệch TC (`gate.requireScript`). Test fail ở máy hay trên CI → `/kit:e2e-triage` (tải kết quả CI bằng
  `gh run download`), phân loại theo `prompts/triage.md`, sửa script, ghi bug app khi người dùng đồng ý.
- **Ba chế độ của `/kit:dev`:** *mới*; *đồng bộ* — dòng đầu kế hoạch `Spec đã triển khai: <file> v<x.y>` là mốc, spec đổi
  sau đó → diff từ mốc, bảng mã thêm / sửa / `[DEPRECATED]`, chỉ sửa phần bị ảnh hưởng; *sửa bug* — `/kit:dev #<số>`
  đọc issue (TAF ghi feature, mã TC, lỗi), tái hiện bằng `kit e2e <mã>`, sửa code, PR ghi `Fixes #<số>`.
- **Mã do code cấp:** `kit next-code` (feature, US, SCR, BR, việc nhỏ), không để AI tự đếm — số không bao giờ tái dùng.
  Hai nhánh cùng cấp một mã: `kit gate`, `kit ready`, `kit doctor` báo "khai ở nhiều chỗ".
- **Truy vết:** test mang mã spec; reviewer grep từng mã trong phạm vi, thiếu test là 🔴 — trừ mã tester đã ghi phủ
  bằng e2e hoặc kiểm thủ công. Repo không có framework test cho một tầng thì tester **không dựng mới**.
- **Ngữ cảnh gọn:** `kit context` đánh dấu guides mà công cụ đã tự nạp (vd `CLAUDE.md` với Claude Code) — luồng
  chính không đọc lại; agent con vẫn đọc. `--scope <module>` chỉ in feature của một module.
- **E2E chỉ qua TAF:** spec → TC (người duyệt) → script sinh → `kit e2e`. Luồng lỗi, phân quyền test ở tầng đơn vị.
- **Không commit/push/PR khi người dùng chưa xác nhận lần đó.**

## 4. Áp dụng vào một repo

1. **Cài gói và nhúng:** `npm install -D github:dunglt-iks/ai-kit#v3.0.0` → `npx kit init` → `ai-kit.yml` (dò
   `guides`), `.claude/settings.json` (plugin + deny), khối cầu nối, `.gitignore`, rồi tự kiểm (như `kit doctor`). Không
   đụng `.github/`. `--dry-run` để xem trước. Repo không có `package.json` ở gốc thì `npm init -y` trước — dự án dùng TAF
   đã có Node cho Playwright.
2. **Cài plugin:** mở Claude Code ở repo, chấp nhận tin cậy thư mục (marketplace `ai-kit` được khai từ settings), rồi
   `claude plugin install kit@ai-kit --scope project`. `enabledPlugins` trong settings **không tự cài** — mỗi người làm
   một lần cho mỗi bản clone.
3. **`/kit:adopt`** trong Claude Code → AI đề xuất giá trị `ai-kit.yml` có căn cứ (`run.command`, `stack.checks`…),
   liệt kê mâu thuẫn guides ↔ kit, gợi ý workflow mẫu `actions/gate` + `actions/e2e` (04 §4) → người duyệt → commit.

Đồng đội: `npm install` + bước 2. Nâng cấp: `npm install -D github:dunglt-iks/ai-kit#<tag mới>` → `npx kit init` (đổi
`ref` của plugin) → đổi `@<tag>` của action trong CI. Cắm vào CI (tuỳ dự án): [04](04-ci-workflow.md).

## 5. Ranh giới

- Kit không biết stack: không có lệnh build/test, cổng, tên thư mục code nào trong `process/`. Test
  `cli/test/kit.test.mjs` chặn chuỗi riêng của dự án lọt vào `process/`, `plugin/`, `prompts/`, `templates/`, `RULES.md`.
- Bước quyết định viết bằng code (`cli/`): cấp mã, ghi và đọc trạng thái duyệt (`approve`, `ready`), gate, chèn khối
  cầu nối, doctor. AI chỉ
  phỏng vấn, viết tài liệu, code, test, review.
