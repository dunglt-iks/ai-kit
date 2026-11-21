# Quy trình /kit:prototype — HTML tĩnh từ màn hình trong spec

Đầu vào: đường dẫn file spec + mã (feature hoặc module). Prototype là bản minh hoạ UI/UX **tĩnh**, dựng từ màn
hình đã có trong spec, để bấm thử những gì wireframe text chưa cho cảm giác (kéo-thả, chuyển tab, hộp thoại,
ẩn/hiện) trước khi `/kit:dev` viết code thật. Prototype **không** là nguồn sự thật — spec luôn thắng.

## Bước 0 — Nạp hai lớp quy định

`npx --no kit context` → đọc `guides` (bỏ qua file `kit context` đánh dấu "công cụ đã tự nạp") (khuôn giao diện, thành phần dùng chung của repo nếu có)
→ đọc `<kit>/RULES.md`. `spec.prototype` là false thì báo dự án không dùng bước này và dừng.

## Giai đoạn 1 — Đọc spec, kiểm đầu vào

- Đọc đúng tài liệu + mã được truyền vào (PRD + FSD của module), và khuôn `spec.templates.fsd` phần màn hình,
  luồng.
- Mỗi màn hình trong phạm vi phải đủ 4 phần: tóm tắt, **wireframe text**, bảng thành phần, quy tắc hiển thị.
  Thiếu wireframe hoặc thiếu luồng/tiêu chí kiểm chứng được → **DỪNG**, yêu cầu chạy `/kit:spec` trước. Lệnh này
  không tự vẽ bố cục, không tự đoán yêu cầu.
- Trạng thái spec **không chặn** lệnh này (nháp hay đã duyệt đều được). Ghi nhận trạng thái từng mã (`kit spec
  <mã>`) — nó quyết định cách đồng bộ ngược ở Giai đoạn 3.

## Giai đoạn 2 — Dựng HTML

- File: `<thư mục module>/PROTOTYPE-<tên-module>.html` — **một file cho cả module**, gộp mọi màn hình. Đã có
  thì sửa/bổ sung đúng file đó, không tạo file thứ hai.
- HTML/CSS/JS thuần, không build, không gọi API thật. Theo khuôn `spec.templates.prototype` (có banner
  "PROTOTYPE" để không ai nhầm là UI thật).
- Dựng **đúng** bố cục, thành phần, quy tắc hiển thị trong spec. Mỗi luồng chính đi hết được; mỗi nhánh `A#` có
  hệ quả nhìn thấy (báo lỗi, hộp xác nhận…) bấm thử được. Gắn số thành phần của wireframe vào HTML
  (`data-ref="DM-F01-SCR01-6"`) để đối chiếu. Không cần pixel-perfect hay responsive đầy đủ.

## Giai đoạn 3 — Đồng bộ ngược về spec → ⏸ DỪNG CHỜ DUYỆT

| Loại thay đổi | Ví dụ | Xử lý |
|---|---|---|
| **Giao diện** — bố cục, thêm/bớt/đổi thành phần, quy tắc hiển thị | dời nút, gộp bộ lọc vào menu | Sửa phần màn hình trong spec (wireframe, bảng thành phần, quy tắc hiển thị) cho khớp HTML; wireframe vẫn đúng khuôn |
| **Nghiệp vụ** — nhánh luồng, quy tắc, trường dữ liệu | cần hộp xác nhận trước khi xoá | **Không sửa spec, không đưa vào HTML.** Ghi lại, đề xuất `/kit:spec` |
| Thuần thẩm mỹ — màu, khoảng cách, icon | | Chỉ ở HTML |

Đã sửa spec thì theo trạng thái mã (RULES §2.2, §2.3):
- Spec **nháp:** là một phần bản nháp — không bump, gộp vào dòng Change Log trên cùng, giữ nháp.
- Spec **đã duyệt:** bump minor + dòng Change Log mới. Ô Spec giữ nguyên (thay đổi chỉ là giao diện); việc duyệt
  giao diện mới nằm ở bước duyệt prototype. `kit ready` sẽ báo màn hình đã đổi cho tới khi prototype được duyệt lại.

Mỗi lần dựng/sửa HTML: đặt ô **Prototype** của các mã liên quan = `spec.status.draft` (thêm cột nếu chưa có) —
không bao giờ đặt đã duyệt, không tự sửa dòng dấu `<!-- ai-kit:prototype … -->` trong HTML (do `kit approve` ghi).

**Đối chiếu, luôn làm sau mỗi lần dựng / sửa HTML:**
1. `kit check-prototype <mã…>` — lỗi (thiếu `<section>`, thiếu / thừa `data-ref`, màn hình lạ) thì sửa HTML hoặc
   đồng bộ ngược phần màn hình của spec, chạy lại tới khi sạch.
2. Gọi subagent **`spec-reviewer`**, phạm vi "đối chiếu prototype" (truyền file spec, mã, file prototype; có sửa phần
   màn hình trong spec thì thêm "soát cả phần màn hình vừa sửa"). Mục hình thức tự sửa rồi soát lại, tối đa 2 vòng;
   mục nội dung đưa vào phần trình bày dưới đây.

Trình bày rồi **DỪNG**: đường dẫn HTML + màn/luồng/nhánh bấm thử được; kết quả `kit check-prototype` và kết quả
đối chiếu của spec-reviewer; phần spec đã sửa (trích đúng thay đổi); thay đổi nghiệp vụ phát hiện mà chưa làm, kèm đề xuất `/kit:spec`.

## Sau khi người dùng xem xong

Duyệt là việc của người, bằng lệnh: `npx --no kit approve <mã> --prototype` (và
`kit approve <mã>` nếu spec còn nháp). Bạn không tự chạy khi người dùng chưa nêu rõ mã. Duyệt prototype không
thay cho duyệt spec, và ngược lại. Khi `kit ready <mã>` qua: `/kit:testcase <mã>` → người duyệt TC (`kit approve <mã> --testcase`) →
`/kit:e2e-script <mã>` → `/kit:dev <file> <mã>`.
