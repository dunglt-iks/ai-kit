# Quy tắc ai-kit — lớp quy trình

> AI đọc file này ở bước 0 của mọi lệnh quy trình, sau `kit context`. Giá trị cụ thể (thư mục, mẫu mã,
> chữ trạng thái, ngôn ngữ…) lấy từ `ai-kit.yml` qua `kit context` — tài liệu này chỉ dùng tên khoá.
> Ví dụ mã trong file dùng module giả `DM` (đơn hàng). `kit` = `node .ai-kit/cli/bin/kit.mjs`.

## 1. Hai lớp quy định

| Lớp | Gồm | Nguồn |
|---|---|---|
| **Kỹ thuật** — code thế nào | stack, framework, cấu trúc thư mục code, chia lớp, lint/format, bảo mật, i18n, cách viết test đơn vị/tích hợp, lệnh build/test | `guides` (file hướng dẫn AI của repo), `review.checklist`, `stack.*` |
| **Quy trình** — đi đường nào | tài liệu spec, mã yêu cầu, trạng thái duyệt, version + Change Log, kế hoạch, prototype, test case/e2e (TAF), truy vết, PR | file này, `.ai-kit/process/`, `ai-kit.yml` |

- Đọc **cả hai** trước khi làm. Agent con (tester, reviewer) tự đọc lại — không giả định đã có ngữ cảnh.
- Đụng nhau: việc *code thế nào* theo repo; việc *spec, quy trình, e2e đi đường nào* theo ai-kit.
- **Mâu thuẫn thật** (vd guides bảo viết e2e tay ở `web/e2e/`, kit bảo đi qua TAF; guides bảo spec ở
  `docs/specs/`, `spec.roots` nói khác) → không tự chọn. Dừng, nêu hai nguồn, hỏi người dùng; quyết định
  được ghi vào `ai-kit.yml` hoặc file hướng dẫn của repo, không chỉ nằm trong cuộc trò chuyện.
- Không sửa nội dung ngoài khối `ai-kit:start/end` của file hướng dẫn repo trừ khi người dùng yêu cầu.
- Viết tài liệu, câu hỏi, báo cáo bằng `language`. Mã, tên khoá, đường dẫn giữ nguyên.

## 2. Tài liệu spec (adapter `prd-fsd`)

Bản giải thích cho người, kèm ví dụ hoàn chỉnh: `.ai-kit/docs/13-tai-lieu-spec.md`.

Spec nằm **trong tài liệu đã có** dưới `spec.roots` — không tạo thư mục spec riêng ngoài cấu hình.

```
<root>/
├── <index>                      ← tuỳ chọn (spec.index): PRD tổng, bảng đăng ký module
├── <progress.file>              ← tuỳ chọn: tiến độ triển khai theo mã (không phải tài liệu yêu cầu)
└── <MOD>-<tên-module>/          ← module: nhóm chức năng có mã 2–4 chữ hoa (vd DM-demo/)
    ├── PRD-<tên>.md             ← phạm vi module, bảng Feature Summary (cột Spec = trạng thái), vai trò × luồng
    ├── FSD-<tên>.md             ← từng feature: màn hình trước, luồng sau; mô hình dữ liệu
    │   (hoặc FSD-<tên>/ khi file vượt docs.splitAt: README.md giữ metadata + Change Log + mục lục)
    └── PROTOTYPE-<tên>.html     ← do /prototype dựng, một file cho cả module
```

- Khuôn viết: `spec.templates` trong `kit context` (mặc định `.ai-kit/templates/{prd,fsd}.md`). Đọc khuôn
  trước khi viết.
- Một repo có thể có nhiều loại module (vd module nghiệp vụ và năng lực nền) — phân biệt bằng
  `featurePattern`/`normalize`, không bằng quy tắc riêng trong prompt.
- PRD chỉ nói về module của nó; phần dùng chung trỏ về `spec.index`, không chép lại.

### 2.1 Mã yêu cầu

| Loại | Dạng | Ví dụ |
|---|---|---|
| Feature | `<MOD>-F##` | `DM-F01` |
| User story = một luồng | `<MOD>-F##-US##` | `DM-F01-US02` |
| Nhánh rẽ / ngoại lệ | `<MOD>-F##-US##-A#` / `-E#` | `DM-F01-US02-A1` |
| Màn hình | `<MOD>-F##-SCR##` | `DM-F01-SCR01` |
| Quy tắc nghiệp vụ | `<MOD>-BR##` (cấp module) | `DM-BR03` |
| NFR / thành phần dùng chung | `<MOD>-NFR##` / `<MOD>-CMP##` | `DM-NFR01` |
| Việc nhỏ (tuỳ chọn) | `spec.smallItem.pattern` | `TASK-07` |

- `##` có `spec.codeDigits` chữ số (mặc định 2: `DM-F01`; dự án chọn 3: `DM-F001`), tăng dần trong phạm vi cha,
  **không bao giờ tái dùng**. Bỏ thì giữ mã, đánh `[DEPRECATED]`. Phạm vi dùng hết số (99 / 999) thì `kit next-code`
  cấp thêm một chữ số (`DM-BR100`) — không đổi mã cũ.
- Nhánh `A#`/`E#` đánh số theo từng US, không có số 0 đứng đầu.
- **Cấp mã bằng `kit next-code`** (`<MOD>` cho F, `--type US|SCR <feature>`, `--type BR <MOD>`,
  `--type small`) — không tự đếm.
- Tiêu đề mục chỉ gồm mã (`#### DM-F01-US02`), tên ở dòng in đậm ngay dưới — neo link ổn định.

### 2.2 Trạng thái duyệt

Bảng Feature Summary của PRD có cột **Spec** và (feature có giao diện) cột **Prototype**. Giá trị: nháp
(`spec.status.draft`), đã duyệt (`spec.status.approved (người, ngày)`), hoặc `—` ở cột Prototype khi không cần.
Việc nhỏ (`smallItem`) không có trạng thái, không bị chặn.

- **AI chỉ được đặt nháp**: `/spec` đặt Spec = nháp khi thêm/sửa nội dung nghiệp vụ, và Prototype = nháp khi màn
  hình bị thêm/sửa; `/prototype` đặt Prototype = nháp khi dựng/sửa HTML.
- **Duyệt là việc của người, bằng lệnh** `kit approve <mã>` (spec) và `kit approve <mã> --prototype` — lệnh ghi
  người + ngày, và đóng dấu hash phần màn hình vào `PROTOTYPE-*.html`. AI không tự sửa ô sang đã duyệt; người dùng
  nhờ chạy lệnh thì chỉ chạy cho đúng mã họ nêu rõ, không suy ra từ "ok", "được".
- **`kit ready <mã>`** là cổng cho `/testcase`, `/e2e-script`, `/dev`: spec đã duyệt; feature có giao diện (và PRD
  có cột Prototype) thì prototype đã duyệt **và** màn hình trong spec chưa đổi kể từ lúc duyệt prototype; mã không
  bị khai trùng. `/prototype` chạy được khi spec còn nháp.
- Đổi trạng thái không phải thay đổi nội dung: không bump version, không thêm dòng Change Log.
- PRD cũ không có cột Prototype: không theo dõi prototype (tương thích ngược); `/spec` thêm cột khi đụng tới.

### 2.3 Version và Change Log

Mỗi PRD/FSD có bảng metadata (Phiên bản, Cập nhật lần cuối…) và mục **Change Log ngay sau metadata**:

```markdown
| Phiên bản | Ngày | Mô tả thay đổi | Tác giả |
|---|---|---|---|
| 1.1 | YYYY-MM-DD | <thay đổi> | <docs.author> |
```

- Mỗi lần sửa: bump **minor** (1.2 → 1.3), cập nhật ngày, thêm dòng **lên đầu** bảng.
- **Ngoại lệ bản nháp:** dòng trên cùng là phiên bản mà mọi mục nó đổi còn nháp → gộp thay đổi mới vào
  dòng đó (sửa mô tả + ngày), không bump. Phiên bản đóng lại khi có mục được duyệt.
- Tên cột Change Log/metadata viết theo `language`; giữ nguyên nếu tài liệu đã có.
- `progress.file` không phải tài liệu yêu cầu: không bump version, chỉ thêm dòng Change Log của chính nó.

### 2.4 Phản ánh code

- `progress.file` phản ánh **code thật**, không suy từ spec: kiểm code trước khi đổi trạng thái tiến độ.
- Kế hoạch triển khai ở `spec.plansDir/<mã-kebab>.md`; dòng đầu `Spec đã triển khai: <file> v<x.y>` là mốc
  để `/dev` biết spec đã đổi gì từ lần trước (chế độ đồng bộ).

## 3. Các bước

```
/spec ─► (spec-reviewer) ─► /prototype ─► kit approve (spec + prototype) ─► /testcase ─► người duyệt TC (`kit approve <mã> --testcase`) ─► /e2e-script ─► /dev ─► /ship
(/prototype chỉ khi có giao diện, chạy được khi spec còn nháp; /dev gọi tester + reviewer, cũng nhận #issue để sửa bug;
 test e2e fail ở máy hoặc trên CI → /e2e-triage; đổi nghiệp vụ ở bước sau → quay về /spec)
```

| Bước | Ghi vào | Dừng chờ người |
|---|---|---|
| `/spec` | PRD/FSD (nháp), `progress.file`/việc nhỏ; tự gọi `spec-reviewer` trước khi bàn giao | `kit approve <mã>` |
| `/prototype` | `PROTOTYPE-<tên>.html`, phần màn hình trong FSD; `kit check-prototype` + tự gọi `spec-reviewer` đối chiếu | `kit approve <mã> --prototype` |
| `/testcase` | `testcases.dir/<scope>/<MÃ>.md` (TAF) — cần `kit ready` | người duyệt TC |
| `/e2e-script` | `scripts.dir`, page object (trong `scripts.allowedPaths`) — cần `kit ready` | trước khi chạy thử |
| `/e2e-triage` | `triage.json`, bản sửa script (trong `scripts.allowedPaths`); bug app vào tracker | trước khi ghi bug, commit |
| `/dev` | kế hoạch, code, test, comment truy vết — cần `kit ready` (trừ việc nhỏ, `#issue`) | duyệt kế hoạch; báo cáo cuối |
| `/ship` | commit, PR | trước mỗi commit, push, tạo PR |

Không bước nào tự mở rộng phạm vi ngoài spec. Thay đổi **nghiệp vụ** (luồng, quy tắc, dữ liệu) phát hiện ở
bước sau → ghi lại, đề xuất `/spec`; không tự sửa spec ở chỗ khác.

## 4. Truy vết

- Mỗi test ứng với một yêu cầu mang **mã nguyên dạng có dấu gạch** (cụ thể nhất có thể: nhánh > US > BR >
  feature) trong tên test hoặc comment ngay trên test — cú pháp theo framework test của repo (guides).
- Chỗ code thực thi một quy tắc nghiệp vụ / nhánh của spec có comment ngắn chứa mã (vd `DM-BR03: …`).
  Chỉ ở chỗ thực thi, không rải lên mọi hàm.
- Kiểm bằng `grep -rn "<mã>"` trên `stack.traceability.searchPaths` (và `scripts.dir` cho e2e).
- Trường hợp biên tự thêm mà spec không có mã: gắn mã feature cha, không bịa mã mới.

## 5. Kiểm thử

- Test theo **spec**, không theo hành vi hiện tại của code. Code và spec khác nhau → test theo spec, ghi lỗi
  nghi do code; không sửa test cho khớp code sai, không sửa test case.
- Luồng lỗi, nhánh rẽ, phân quyền: test ở tầng đơn vị/tích hợp (theo guides). E2E chỉ kiểm cái quan sát
  được trên giao diện, **đi qua TAF**: spec đã duyệt → TC markdown (người duyệt) → script sinh từ TC →
  `kit e2e`. **CI không gọi AI**: TC, script và phân loại test fail làm ở máy (`/testcase`,
  `/e2e-script`, `/e2e-triage`) trước khi push; `kit gate` (cả trên CI) đòi script có và khớp TC. Không viết e2e tay ở chỗ khác trừ khi `ai-kit.yml`/guides nói rõ (mâu thuẫn → §1).
- Lỗi đã biết chưa sửa trong phạm vi việc: hỏi người dùng có ghi issue và đánh dấu lỗi đã biết theo
  `scripts.guide` không.

## 6. Git

- **Không commit, push, tạo PR khi người dùng chưa xác nhận lần đó.**
- Nhánh gốc, remote, công cụ PR: `project.*`. Commit/PR theo quy ước của repo (guides, lịch sử git); chưa có
  thì `feat(<phạm vi>): …` / `fix(<phạm vi>): …`.
- Tiêu đề PR hoặc tên nhánh chứa **mã feature** — TAF lấy mã từ đó để chạy gate và e2e; PR sửa
  `trigger.codePaths` mà không có mã bị chặn, trừ nhãn `trigger.skipLabel`.
