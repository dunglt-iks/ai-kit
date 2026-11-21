# Quy trình /kit:spec — làm rõ yêu cầu, ghi vào tài liệu spec

Đầu vào: mô tả ngắn việc cần làm. Bạn làm rõ yêu cầu rồi ghi nó vào **đúng một chỗ đã có** trong hệ thống
tài liệu spec của repo. Bạn **không viết code** trong lệnh này.

## Bước 0 — Nạp hai lớp quy định

1. `npx --no kit context` — ngôn ngữ, thư mục spec, mẫu mã, chữ trạng thái, khuôn, feature hiện có.
2. Đọc các file `guides` (bỏ qua file `kit context` đánh dấu "công cụ đã tự nạp") (lớp kỹ thuật: để biết ràng buộc kỹ thuật cần hỏi — quyền, đa ngôn ngữ, đa tenant…).
3. Đọc `<kit>/RULES.md` (lớp quy trình) và khuôn `spec.templates.prd`, `spec.templates.fsd`.

Viết mọi thứ bằng `language`. Dưới đây "nháp"/"đã duyệt" là giá trị `spec.status.draft`/`approved`.

## Bước 1 — Xác định loại việc

Đọc `spec.index` (nếu có), danh sách feature trong `kit context`, `progress.file` (nếu có) và PRD của module
liên quan **trước khi hỏi** những gì đã tự trả lời được. Chọn một trong bốn nhánh:

1. **Sửa / mở rộng feature đã có** — có `<MOD>-F##` khớp việc này.
2. **Feature mới trong module đã có** — có thư mục `<MOD>-<tên>/` khớp.
3. **Module mới** — chưa có module nào khớp. **Chỉ chọn khi người dùng xác nhận rõ** đây là module mới; không
   chắc thì hỏi thẳng.
4. **Việc nhỏ** — sửa lỗi, nợ kỹ thuật, việc hạ tầng: không định nghĩa feature mới. Chỉ khi `spec.smallItem`
   được khai; không khai thì hỏi người dùng ghi ở đâu (feature, hay một dòng trong `progress.file`).

Không tự tin phân loại thì hỏi (1–2 câu, câu hỏi loại việc trước mọi câu khác).

## Bước 2 — Phỏng vấn

Tối đa 5 câu hỏi quan trọng nhất, mỗi lượt tối đa 3. Ưu tiên: ai dùng, trường hợp lỗi, giới hạn phạm vi, ràng
buộc kỹ thuật mà guides bắt buộc phải xét (quyền/phân vùng dữ liệu, đa ngôn ngữ…), và chỗ code hiện tại có thể
xung đột với yêu cầu (tìm rộng thì giao subagent tìm kiếm, chỉ nhận tóm tắt). Không hỏi điều đã tự trả lời được.

## Bước 3 — Ghi vào đúng tài liệu

Cấp mọi mã mới bằng `kit next-code` (RULES §2.1), không tự đếm.

- **Nhánh 1:** sửa phần của feature trong FSD (và PRD nếu đổi phạm vi). Mã bị bỏ: giữ, đánh `[DEPRECATED]`.
- **Nhánh 2:** `kit next-code <MOD>` → thêm dòng vào bảng Feature Summary của PRD (cột Spec = nháp); trong FSD
  viết **màn hình `SCR##` trước** (4 phần, xem "Vẽ màn hình") rồi **luồng theo từng `US##`** (luồng chính /
  `A#` / `E#`, có "Kích hoạt từ" link về màn hình); thêm thực thể/thuộc tính vào mô hình dữ liệu; quy tắc mới
  thành `<MOD>-BR##`. Cập nhật bảng vai trò × luồng trong PRD. Feature mới có giao diện: ô Prototype = nháp. FSD còn định dạng cũ (chưa có mục luồng) thì
  viết phần mới theo khuôn và báo người dùng — không tự chuyển cả FSD.
- **Nhánh 3:** tạo `<spec.roots[0]>/<MOD>-<tên>/PRD-<tên>.md` + `FSD-<tên>.md` theo khuôn, đăng ký vào
  `spec.index` (nếu có). Mã module 2–4 chữ hoa, không trùng module đã có. Feature bắt đầu từ `<MOD>-F01`.
- **Nhánh 4:** `kit next-code --type small` → thêm một dòng vào `spec.smallItem.file`, mô tả yêu cầu + tiêu chí
  chấp nhận ngay trong dòng đó. Không tạo file riêng.

Mọi tài liệu bị sửa: bump version + Change Log theo RULES §2.3 (gồm ngoại lệ bản nháp). FSD vượt `docs.splitAt`
thì đề xuất tách thành thư mục (RULES §2) — không tự tách khi chưa hỏi.

**Vẽ màn hình** (khi việc có giao diện; bỏ qua nếu `spec.prototype` là false và không có UI):
- Wireframe text cho **mọi** màn hình, chế độ xem, hộp thoại trong phạm vi, đúng khuôn FSD: khung ASCII
  `+ - |`, rộng ≤ `spec.wireframeWidth`, thẳng cột, thành phần đánh số. Kiểm độ thẳng cột bằng script
  (vd đếm độ dài từng dòng), không canh bằng mắt.
- Mỗi luồng chính đi hết được trên wireframe; mỗi nhánh `A#` có hệ quả nhìn thấy phải có chỗ thể hiện.
- Chỗ bố cục có nhiều phương án đáng cân nhắc: đưa 2–3 phương án wireframe để người dùng chọn. Vị trí tự đề
  xuất mà yêu cầu gốc không nêu thì nói rõ khi bàn giao.
- Repo có khuôn giao diện dùng chung (guides hoặc một module nền) thì tuân theo, không vẽ lại kiểu khác; cần
  lệch thì ghi lý do ở quy tắc hiển thị.
- Đây là nơi duy nhất vẽ bố cục — `/kit:prototype` chỉ dựng HTML từ đây và đồng bộ ngược thay đổi giao diện.

Trong mọi nhánh:
- Tiêu chí chấp nhận kiểm chứng được, gồm cả trường hợp lỗi. Với FSD: luồng chính + từng nhánh `A#`/`E#` — mỗi
  nhánh là một tiêu chí có mã riêng. Với việc nhỏ: dạng "Khi … thì …".
- Điều chưa rõ thì hỏi; người dùng muốn để ngỏ thì ghi `?` trong FSD và đưa vào mục câu hỏi còn mở của PRD —
  không tự đoán, không tạo danh sách câu hỏi ở chỗ khác.
- Ghi rõ phạm vi **không** làm lần này, để `/kit:dev` không tự mở rộng.
- Mọi feature có nội dung nghiệp vụ bị thêm/sửa → ô **Spec** = `spec.status.draft` (RULES §2.2). Feature có giao
  diện mà màn hình bị thêm/sửa → ô **Prototype** = `spec.status.draft` (thêm cột Prototype vào Feature Summary nếu
  chưa có); feature không có giao diện → ô Prototype = `—`. Bạn chỉ được đặt nháp, không bao giờ đặt đã duyệt.

## Bước 3b — Soát độc lập (giao subagent `spec-reviewer`)

Tự làm, không chờ người dùng yêu cầu. Gọi `spec-reviewer`, truyền: file spec, các mã vừa thêm/sửa, tóm tắt ngắn
cuộc phỏng vấn (điều người dùng đã nói rõ, điều còn để ngỏ).

- Mục **hình thức** (mã, định dạng, wireframe, Change Log, trạng thái): tự sửa, rồi gọi soát lại. Tối đa 2 vòng.
- Mục **nội dung** (tiêu chí mơ hồ, thiếu nhánh, mâu thuẫn, chỗ tự đoán): **không tự quyết** — đưa vào Bước 4 thành
  câu hỏi cho người dùng. Người dùng trả lời thì sửa spec theo câu trả lời và soát lại phần đó.

## Bước 4 — Bàn giao

Hiển thị đúng phần vừa thêm/sửa, kèm **kết quả soát** (kết luận của `spec-reviewer`, mục đã tự sửa, câu hỏi nội
dung còn mở). Còn `?` chưa chốt trong một mã thì nói rõ — duyệt khi còn để ngỏ là quyết định của người dùng.

**Duyệt là việc của người, bằng lệnh** — bạn không tự đổi ô sang đã duyệt, kể cả khi người dùng nói "duyệt":
hướng dẫn họ chạy `npx --no kit approve <mã>` (ghi người + ngày). Người dùng nhờ bạn chạy lệnh đó
thì chỉ chạy cho đúng mã họ nêu rõ.

Ghi rõ **đường dẫn file + mã** vừa dùng, và bước tiếp (RULES §3):
- Có giao diện (và `spec.prototype`): `/kit:prototype <file> <mã>` — chạy được **khi spec còn nháp**, để xem màn hình
  rồi mới duyệt. Sau đó người duyệt cả hai: `kit approve <mã>` và `kit approve <mã> --prototype`.
- Không có giao diện: `kit approve <mã>`.
- Rồi: `/kit:testcase <mã>` → người duyệt TC (`kit approve <mã> --testcase`) → `/kit:e2e-script <mã>` → `/kit:dev <file> <mã>`. `kit ready <mã>` cho biết đã
  đủ điều kiện chưa.
- Việc **đã được triển khai** (tiến độ khác `progress.values.todo`, hoặc đã có kế hoạch trong `spec.plansDir`):
  đây là thay đổi spec cần đồng bộ xuống code — duyệt lại (và `/kit:prototype` nếu đụng màn hình), `/kit:testcase <mã>`
  (đồng bộ), rồi `/kit:dev` (tự nhận chế độ đồng bộ).
