# Quy trình /dev — triển khai một việc từ spec đã duyệt

Đầu vào: đường dẫn file spec + mã (feature `<MOD>-F##`, hoặc mã việc nhỏ), **hoặc** `#<số issue>`. Làm lần lượt
các giai đoạn; có hai điểm DỪNG bắt buộc chờ người dùng. Ba chế độ, tự xác định ở Giai đoạn 1:
- **Mới** — việc chưa từng được triển khai.
- **Đồng bộ** — việc đã triển khai (một phần hoặc toàn bộ), sau đó spec bị sửa. Chỉ sửa code/test ứng với phần
  spec đã đổi, không làm lại cả việc.
- **Sửa bug** — đầu vào là issue (thường do `/e2e-triage` ghi khi test e2e fail). Spec không đổi; code làm sai spec.

## Bước 0 — Nạp hai lớp quy định

1. `node .ai-kit/cli/bin/kit.mjs context`.
2. Đọc các file `guides` mà `kit context` **không** đánh dấu "công cụ đã tự nạp" — bắt buộc trước khi sinh/sửa bất
   kỳ code nào: cấu trúc code, chia lớp và thứ tự phụ thuộc, quy ước đặt tên, migration, đa ngôn ngữ, bảo mật/phân
   quyền, cách viết test, lệnh kiểm.
3. Đọc `.ai-kit/RULES.md`.

Code thế nào theo guides; spec, kế hoạch, truy vết, e2e theo kit (RULES §1). Mâu thuẫn thì hỏi.

## Giai đoạn 1 — Hiểu yêu cầu

- Đọc đúng phần spec của mã (`kit spec <mã>` cho vị trí; feature thì đọc cả PRD lẫn FSD của module). Mã không
  tồn tại, hoặc thiếu tiêu chí chấp nhận kiểm chứng được → DỪNG, nêu cần làm rõ gì (`/spec` nếu chưa có spec).
- **Sẵn sàng:** feature phải qua `kit ready <mã>` — spec đã duyệt, prototype đã duyệt và còn khớp màn hình trong
  spec (nếu feature có giao diện và PRD theo dõi prototype), mã không bị khai trùng. Chưa qua → DỪNG, chép đúng
  lý do `kit ready` báo (vd "chạy `kit approve <mã>`") — cả ở chế độ đồng bộ. Việc nhỏ (`spec.smallItem`) không
  bị chặn. Không tự đổi trạng thái duyệt.
- **Chế độ sửa bug** (`#<số>`): `gh issue view <số>` (hoặc nhờ người dùng dán nội dung). Lấy mã TC / feature từ
  issue (TAF ghi `feature:<MÃ>`, mã TC, file:dòng, lỗi). Đọc TC và phần spec tương ứng, tái hiện bằng
  `kit e2e <MÃ> --no-gate --base-url <địa chỉ app ở máy>`. Không tái hiện được → báo, hỏi. Rồi đi thẳng Giai đoạn 2 với kế hoạch
  ngắn (nguyên nhân, chỗ sửa, test chứng minh) — không cần kế hoạch trong `spec.plansDir`. Kết quả cho thấy spec
  hoặc TC sai chứ không phải code → dừng, đề xuất `/spec` hoặc `/testcase`. Commit / PR ghi `Fixes #<số>`.
- **Chế độ:** tra `progress.file` (nếu có) và kế hoạch cũ `<spec.plansDir>/<mã-kebab>*.md`. Chưa bắt đầu và
  không có kế hoạch cũ → **mới**. Đã có tiến độ khác `progress.values.todo` hoặc có kế hoạch cũ → **đồng bộ**,
  làm thêm Giai đoạn 1b. Nói rõ chế độ đã chọn; tín hiệu mâu thuẫn (vd tiến độ ghi chưa bắt đầu nhưng đã có
  code) thì hỏi.
- **Test case e2e:** `kit gate <mã>`. Đã có TC đã duyệt → tester chạy e2e theo TC ở Giai đoạn 4 (thiếu script thì
  gợi ý `/e2e-script <mã>` trước). Chưa có TC, TC lỗi thời hay thiếu script (gate đỏ) → **không chặn** `/dev`, nhưng nói rõ và gợi ý `/testcase <mã>`
  (thứ tự khuyến nghị: `/testcase` → `/e2e-script` → `/dev`).
- Tìm hiểu code liên quan; tìm rộng thì giao subagent tìm kiếm và chỉ nhận tóm tắt.

## Giai đoạn 1b — Chỉ chế độ đồng bộ: phần spec đã đổi

- **Mốc:** dòng `Spec đã triển khai: <file> v<x.y>` ở đầu kế hoạch cũ. Không có dòng này thì lấy commit gần
  nhất đụng tới kế hoạch cũ; không xác định được thì hỏi.
- **Diff spec:** đọc các dòng Change Log mới hơn mốc, rồi `git log -p <mốc>..HEAD -- <file spec>` (FSD dạng thư
  mục thì cả thư mục, cộng PRD). Change Log chỉ là tóm tắt — diff mới là căn cứ. Chỉ giữ phần thuộc mã được
  truyền vào. Diff rỗng → DỪNG, báo không có gì để đồng bộ.
- **Bảng thay đổi:** mỗi dòng một mã bị ảnh hưởng (`US##`, nhánh, `SCR##`, `BR##`, thực thể/thuộc tính, tiêu
  chí) — loại (thêm / sửa / `[DEPRECATED]`) — cũ → mới.
- **Code + test đang cài đặt từng mã:** `grep -rn "<mã>"` trên `stack.traceability.searchPaths`. Không ra thì
  tìm theo ngữ nghĩa, ghi "chưa gắn mã" — gắn bổ sung khi sửa.
- Mã `[DEPRECATED]`: gỡ code/test tương ứng, **không xoá dữ liệu đã có**; đổi schema thì tạo migration mới
  theo chính sách dữ liệu của guides.

## Giai đoạn 2 — Kế hoạch → ⏸ DỪNG CHỜ DUYỆT

**Đồng bộ:** không tạo kế hoạch mới — thêm vào cuối kế hoạch cũ mục `## Đồng bộ v<cũ> → v<mới> (<ngày>)` gồm
bảng thay đổi (thêm cột "code/test bị ảnh hưởng") và các ý dưới đây, chỉ cho phần bị ảnh hưởng. Không refactor
hay "tiện tay sửa" phần spec không đổi.

**Mới:** ghi `<spec.plansDir>/<mã-kebab>.md` theo khuôn `spec.templates.plan`. Dòng đầu:
`Spec đã triển khai: <file spec> v<phiên bản hiện tại>`. Kế hoạch gồm:
- File sẽ tạo/sửa **theo thứ tự lớp của repo** (lấy từ guides; không có thì suy từ cấu trúc code và nói rõ).
- Hợp đồng API (endpoint, request, response, mã lỗi) nếu có — FSD không có mục API, thiết kế ở đây.
- Migration/thay đổi dữ liệu và cách giữ an toàn dữ liệu (migration đã merge thì không sửa, tạo cái mới).
- Văn bản hiển thị mới có phải đi qua cơ chế đa ngôn ngữ của repo không (theo guides).
- **E2E qua TAF:** feature đã có TC/script (`testcases.dir`, `scripts.dir`) → script nào bị ảnh hưởng; chưa có
  TC → sau khi xong cần `/testcase <mã>` để người duyệt, rồi `/e2e-script <mã>`. Không viết e2e tay ở chỗ khác
  (RULES §5).
- Thư viện mới (nếu có) và lý do — không thêm khi chưa được duyệt ở bước này.
- Rủi ro, điểm chưa chắc. Ước lượng nhỏ / vừa / lớn; lớn thì đề xuất chia nhiều PR.

Tóm tắt kế hoạch 5–10 dòng rồi DỪNG. Không viết code cho tới khi người dùng đồng ý.

## Giai đoạn 3 — Triển khai

- Làm theo kế hoạch đã duyệt, trọn lát cắt dọc trong một phiên. Phải lệch kế hoạch đáng kể thì dừng và hỏi.
- **Comment truy vết** tại chỗ thực thi quy tắc nghiệp vụ / nhánh của spec (RULES §4), vd `DM-BR03: …`.
- Commit theo bước hợp lý, message theo quy ước repo (RULES §6) — **chỉ commit khi người dùng xác nhận**.
- Chạy lần lượt `stack.checks` (không khai thì lấy lệnh lint/format/test từ guides), sửa hết lỗi.

## Giai đoạn 4 — Kiểm thử (giao subagent `tester`)

- Gọi `tester`, truyền: file spec + mã, danh sách file đã đổi (`git diff <project.baseBranch>...HEAD
  --name-only`); chế độ đồng bộ thêm bảng thay đổi ở 1b.
- Tester báo lỗi nghi do code — kể cả test TAF fail vì app làm khác test case: **sửa code**, không sửa test,
  không sửa test case; rồi chạy lại (TAF: `kit e2e <mã> --no-gate --base-url <địa chỉ app ở máy>`).
- Tối đa 3 vòng; vẫn fail thì dừng và báo. Lỗi để lại ngoài phạm vi: hỏi người dùng có ghi issue và đánh dấu lỗi
  đã biết (theo `scripts.guide`) không.
- Test case lệch spec (gate báo lỗi thời) hoặc chưa có TC: không tự viết/sửa TC — ghi vào báo cáo để người dùng
  chạy `/testcase <mã>`.

## Giai đoạn 5 — Review (giao subagent `reviewer`)

- Gọi `reviewer`, truyền file spec + mã (và bảng thay đổi nếu đồng bộ).
- Sửa mọi mục 🔴. Mục 🟡 sửa nếu hợp lý, không thì ghi lý do.
- Chạy lại toàn bộ `stack.checks` và TAF run cho feature đã có script.
- Đồng bộ: cập nhật dòng `Spec đã triển khai` ở đầu kế hoạch. Cập nhật `progress.file` (nếu có) theo code thật.

## Báo cáo cuối → ⏸ DỪNG

```
## ✅ Hoàn thành: <tên việc> (<mã>)
Chế độ: <mới | đồng bộ v<cũ> → v<mới>>
Tiêu chí chấp nhận: <x/y đạt> (liệt kê tiêu chí chưa đạt)
Truy vết: <số mã trong phạm vi có test mang mã / tổng> (liệt kê mã chưa có test)
E2E (TAF): <mỗi feature: gate ✓/✘, script pass/fail/lỗi đã biết> — việc cần làm: <`/testcase <mã>` (mới | đồng bộ), rồi `/e2e-script <mã>`>
Thay đổi chính: <3–5 dòng>
Review: <số mục đã sửa / bỏ qua kèm lý do>
Tài liệu: <đã bump version + Change Log ở tài liệu spec bị sửa chưa; đã cập nhật progress.file chưa>
Cần kiểm tra thủ công: <những gì test tự động không bao được>
Bước tiếp theo: kiểm tra thủ công rồi chạy /ship
```
