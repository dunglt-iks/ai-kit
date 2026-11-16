# 10 — Quy trình spec → prototype → dev → test → ship

Từ 2.0, kit có thêm **lớp quy trình**: các lệnh `/spec` … `/ship` và ba agent con (spec-reviewer, tester, reviewer) cho công cụ AI, khái quát từ cách làm của dự án
áp dụng đầu tiên. TAF (01–07) là phần kiểm thử e2e của quy trình này. Quy tắc mà AI phải theo nằm ở
[`RULES.md`](../RULES.md); tài liệu này giải thích thiết kế.

## 1. Hai lớp quy định

Repo nhúng kit thường **đã có** hướng dẫn cho AI (CLAUDE.md, AGENTS.md, GEMINI.md, rules của Cursor/Copilot…), nói về
kỹ thuật. Kit nói về quy trình. Hai thứ tách hẳn, mỗi thứ một chủ:

| Lớp | Gồm | Chủ | Nằm ở |
|---|---|---|---|
| Kỹ thuật — *code thế nào* | stack, framework, chia lớp, lint, bảo mật, i18n, cách viết test đơn vị, lệnh build/test | repo | file hướng dẫn của repo (`guides`), giữ nguyên |
| Quy trình — *đi đường nào* | tài liệu spec, mã, duyệt, version, kế hoạch, prototype, TC/e2e, truy vết, PR | kit | `.ai-kit/` (ghim phiên bản) + `ai-kit.yml` |

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
| `claude` | `.claude/commands/{spec,prototype,testcase,e2e-script,e2e-triage,dev,ship,kit-adopt}.md`, `.claude/agents/{spec-reviewer,tester,reviewer}.md` | `CLAUDE.md` (liệt kê lệnh `/x`) |
| `agents-md` | — | `AGENTS.md` (mỗi việc trỏ tới `.ai-kit/process/<việc>.md`; công cụ không có agent con thì tự làm phần của agent) — cho mọi công cụ đọc AGENTS.md |

Vỏ lệnh/agent chỉ vài dòng: chưa có `.ai-kit/` thì tự clone theo `kitRef`, rồi đọc `.ai-kit/process/<việc>.md`.
Đổi phiên bản kit là đổi quy trình. Vỏ mang dấu `<!-- ai-kit:shell … -->` và được `kit init` làm mới mỗi lần chạy;
file **không** có dấu là lệnh riêng của repo (vd repo đã có `/spec` của mình): `kit init` không ghi đè (trừ
`--force`), `doctor` cảnh báo. Công cụ khác
(Antigravity workflows, Cursor rules…) thêm adapter trong `adapters/agent/` sau.

## 3. Các bước

```
/spec ─► (spec-reviewer) ─► /prototype ─► kit approve (spec + prototype) ─► /testcase ─► kit approve --testcase ─► /e2e-script ─► /dev ─► /ship
(/prototype chỉ khi có giao diện, chạy được khi spec còn nháp; /dev gọi tester + reviewer; test e2e fail → /e2e-triage;
 đổi nghiệp vụ ở bước sau → /spec)
```

| Lệnh | Đầu vào | Ghi vào | Dừng chờ người |
|---|---|---|---|
| `/spec` | mô tả việc | PRD/FSD (Spec, Prototype = nháp), việc nhỏ; tự gọi `spec-reviewer` | `kit approve <mã>` |
| `/prototype` | file + mã (spec nháp hoặc đã duyệt) | `PROTOTYPE-<tên>.html`, phần màn hình của FSD (Prototype = nháp); `kit check-prototype` + `spec-reviewer` đối chiếu sau mỗi lần dựng | `kit approve <mã> --prototype` |
| `/testcase` | mã qua `kit ready` | `testcases.dir` (TAF, [02](02-testcase-format.md)) | `kit approve <mã> --testcase` |
| `/e2e-script` | mã qua `kit ready`, có TC đã duyệt | script + page object trong `scripts.allowedPaths` ([03](03-script-generation.md)) | trước khi chạy thử |
| `/dev` | file + mã qua `kit ready`; mã việc nhỏ; hoặc `#<issue>` | kế hoạch (`spec.plansDir`), code, test, comment truy vết | duyệt kế hoạch; báo cáo cuối |
| `/e2e-triage` | trống, run-id CI hoặc #PR | `triage.json`, bản sửa script; issue khi được đồng ý ([07](07-bug-reporting.md)) | trước khi ghi bug, commit |
| `/ship` | nhánh hiện tại | rebase, `stack.checks`, `kit e2e changed`, PR | trước mỗi commit, push, tạo PR |
| `/kit-adopt` | — | đề xuất `ai-kit.yml` + bảng mâu thuẫn | duyệt trước khi ghi |

### 3.1 Duyệt bằng lệnh, cổng `kit ready`

- Bảng Feature Summary trong PRD có cột **Spec** và **Prototype**. AI chỉ được ghi **nháp**. Người duyệt bằng
  `kit approve <mã>` / `--prototype`: lệnh ghi `Đã duyệt (người, ngày)` — người lấy từ `git config user.name` — nên
  biết ai duyệt, lúc nào, và lịch sử nằm trong git. Test case: `kit approve <mã> --testcase` ghi `status` + `reviewer`
  trong file TC (từ chối TC còn lỗi lint hoặc lỗi thời).
- Duyệt prototype còn đóng dấu `<!-- ai-kit:prototype <MÃ>=<hash> -->` vào `PROTOTYPE-*.html`: hash của **phần màn
  hình** (các mục `SCR`) trong FSD lúc duyệt. Màn hình trong spec đổi sau đó → `kit ready` báo prototype không còn
  khớp, phải cập nhật và duyệt lại. Đổi luồng / quy tắc không làm mất duyệt prototype.
- `kit ready <mã>` (thoát 1 nếu chưa) là cổng của `/testcase`, `/e2e-script`, `/dev`: spec đã duyệt, prototype đã
  duyệt và còn khớp (khi feature có màn hình và PRD có cột Prototype), mã không bị khai trùng.
- Tương thích: ô chỉ ghi `Đã duyệt` (không người, ngày) vẫn được coi là đã duyệt; PRD không có cột Prototype thì
  không theo dõi prototype; `spec.prototype: false` tắt hẳn.

### 3.2 Điểm chính khác

- **Thứ tự: test case trước code.** TC viết từ spec đã duyệt, không cần code. Có TC (và script) trước thì tester
  trong `/dev` chạy được e2e ngay, và người duyệt TC thấy chỗ spec còn hở trước khi code. `/dev` không chặn khi
  chưa có TC, chỉ nhắc.
- **Soát spec độc lập:** `/spec` ghi xong thì tự gọi agent `spec-reviewer` (chỉ đọc) trước khi bàn giao; `/prototype`
  sau mỗi lần dựng HTML chạy `kit check-prototype` (tất định: mỗi `SCR` có `<section id>`, mỗi thành phần đánh số
  có `data-ref`, không thừa) rồi gọi `spec-reviewer` đối chiếu phần cần đọc hiểu (nhãn, quy tắc hiển thị, luồng và
  nhánh bấm được, prototype không tự thêm nghiệp vụ) — cùng agent, không tách agent riêng (D22). Lỗi hình thức (mã, wireframe, Change Log…) AI tự sửa, soát lại tối đa 2
  vòng; vấn đề nội dung (tiêu chí mơ hồ, thiếu nhánh, mâu thuẫn, chỗ tự đoán) thành câu hỏi cho người dùng.
- **Không có agent BA/DEV riêng:** `/spec`, `/dev` cần hỏi qua lại với người dùng nên chạy ở luồng chính; agent con
  chỉ dùng cho việc cần **độc lập** (soát spec, test, review).
- **CI không gọi AI** (D8): TC, script, phân loại test fail làm ở máy trước khi push. `/e2e-script` sinh script
  (`kit plan-gen` chọn việc, `check-script` / `check-paths` kiểm), hỏi trước khi chạy thử; gate (`kit e2e`, ở máy và trên CI)
  chặn PR khi script thiếu hoặc lệch TC (`gate.requireScript`). Test fail ở máy hay trên CI → `/e2e-triage` (tải kết quả CI bằng
  `gh run download`), phân loại theo `prompts/triage.md`, sửa script, ghi bug app khi người dùng đồng ý.
- **Ba chế độ của `/dev`:** *mới*; *đồng bộ* — dòng đầu kế hoạch `Spec đã triển khai: <file> v<x.y>` là mốc, spec đổi
  sau đó → diff từ mốc, bảng mã thêm / sửa / `[DEPRECATED]`, chỉ sửa phần bị ảnh hưởng; *sửa bug* — `/dev #<số>`
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

1. **Nhúng (một dòng):** `git clone --depth 1 -b v2 https://github.com/dunglt-iks/ai-kit .ai-kit && bash
   .ai-kit/setup.sh` (kiểm Node / npm / git, cài thư viện của kit, xem trước rồi hỏi trước khi `kit init`, tuỳ chọn thêm
   lệnh tắt `kit`; `--update` để nâng cấp, `--yes` cho CI) → `ai-kit.yml` (dò `guides`, `agents`, `kitRef`), vỏ lệnh/agent, khối cầu nối,
   `.gitignore`, rồi tự kiểm (như `kit doctor`). Không đụng `.github/`. `--dry-run` để xem trước.
2. **`/kit-adopt`** trong Claude Code → AI đề xuất giá trị `ai-kit.yml` có căn cứ (`run.command`, `stack.checks`…),
   liệt kê mâu thuẫn guides ↔ kit, gợi ý chỗ cắm `actions/e2e` vào CI sẵn có → người duyệt → commit.

Đồng đội: không cài gì — lệnh đầu tiên (vd `/spec`) tự clone kit theo `kitRef`. Nâng cấp: đổi `kitRef` (và `@<ref>`
của action trong CI) → `kit init`. Cắm vào CI (tuỳ dự án): [04](04-ci-workflow.md).

**Từ TAF 1.x:** `kit init` thấy `e2e/taf.config.yml` thì tạo `ai-kit.yml` chuyển từ đó (giữ khoá TAF, lệnh test của
`run.targets` thành `run.command`; file cũ để nguyên cho người kiểm rồi xoá).

## 5. Ranh giới

- Kit không biết stack: không có lệnh build/test, cổng, tên thư mục code nào trong `process/`. Test
  `test/kit.test.mjs` chặn chuỗi riêng của dự án lọt vào `process/`, `claude/`, `prompts/`, `templates/`, `RULES.md`.
- Bước quyết định viết bằng code (`cli/`): cấp mã, ghi và đọc trạng thái duyệt (`approve`, `ready`), gate, chèn khối
  cầu nối, doctor. AI chỉ
  phỏng vấn, viết tài liệu, code, test, review.
