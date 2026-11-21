# Khuôn viết FSD — màn hình, luồng nghiệp vụ, mô hình dữ liệu

> Tài liệu tham chiếu cho `/kit:spec`, `/kit:prototype` và người viết FSD. Không phải tài liệu yêu cầu, không có mã,
> không có Change Log. Quy tắc tổng thể: `node_modules/ai-kit/RULES.md` §2. Ví dụ dùng module giả `DM`
> (đơn hàng), ví dụ hoàn chỉnh ở `node_modules/ai-kit/docs/13-tai-lieu-spec.md` §6. Dự án có thể ghi đè khuôn này qua
> `spec.templates.fsd`. Tên mục viết theo `language` của dự án.

## 0. Đầu file FSD

```markdown
# FSD — <Tên module> (<MOD>)

| Phiên bản | Trạng thái | Cập nhật lần cuối | PRD |
|---|---|---|---|
| 1.0 | — | YYYY-MM-DD | [PRD-<tên>.md](PRD-<tên>.md) |

## Change Log

| Phiên bản | Ngày | Mô tả thay đổi | Tác giả |
|---|---|---|---|
| 1.0 | YYYY-MM-DD | Khởi tạo tài liệu | <docs.author> |

---
```

Trạng thái duyệt **không** nằm ở FSD mà ở cột Spec của bảng Feature Summary trong PRD (theo từng feature).

## 1. Bố cục

Mỗi feature `<MOD>-F##` là một mục, **màn hình trước, luồng nghiệp vụ sau**:

```
## N. <MOD>-F## — <Tên feature>
### Màn hình
#### <MOD>-F##-SCR##           ← nhìn thấy gì, bấm vào đâu
### Luồng nghiệp vụ
#### <MOD>-F##-US##            ← hệ thống phản hồi thế nào, không phụ thuộc giao diện
```

Tiêu đề feature phải đúng dạng `<mã> — <tên>` (TAF đọc tiêu đề này). Feature không có giao diện thì bỏ mục Màn hình.

Sau các feature là các mục dùng chung của module: **Mô hình dữ liệu** và **Điểm tích hợp** (nếu có). Không có:

- **Mục Edge Cases riêng**: tình huống nghiệp vụ là nhánh `A#`/`E#` của luồng, tình huống giao diện là "Quy tắc
  hiển thị" của màn hình, tình huống do module khác gọi tới nằm ở mục điểm tích hợp.
- **Mục API Endpoints**: hợp đồng API thiết kế ở kế hoạch của `/kit:dev`. Ràng buộc nghiệp vụ API phải giữ ghi ở
  mục Ràng buộc của thực thể.

Người đọc đi từ màn hình, bấm link trong bảng thành phần để xuống luồng; luồng có dòng "Kích hoạt từ" link ngược
về màn hình. Đổi giao diện không phải viết lại luồng, và ngược lại.

**Tiêu đề chỉ gồm mã** (`#### DM-F01-US02`), tên đặt ở dòng in đậm ngay dưới. Neo link khi đó luôn là
`#dm-f01-us02` — ổn định khi đổi tên. Link viết `[DM-F01-US02](#dm-f01-us02)`; nhánh viết
`[DM-F01-US02](#dm-f01-us02)-A1` (nhánh không có neo riêng).

## 2. Màn hình (SCR)

Mỗi SCR có đúng 4 phần, theo thứ tự:

````markdown
#### <MOD>-F##-SCR##

**<Tên màn hình>** — <mục đích, 1 câu>. <Ai dùng>; mở từ <đâu>.

```
+--------------------------------------------------------------------------+
| <wireframe text, mỗi thành phần gắn một số: [1 Nút], 2 Tiêu đề cột ...>  |
+--------------------------------------------------------------------------+
```

**Thành phần**

| # | Thành phần | Mô tả | Luồng |
|---|---|---|---|
| 1 | ... | <hiển thị gì, thao tác được gì> | [<mã US>](#<mã-us-chữ-thường>) / Mở [<mã SCR>](#...) / — |

**Quy tắc hiển thị**

| Điều kiện | Hiển thị |
|---|---|
| <khi nào> | <thành phần nào ẩn/hiện/khoá/cảnh báo ra sao> |
````

Quy tắc viết:

- **Wireframe** là khung dây mức thấp: vùng, thành phần, thứ tự — không phải thiết kế thị giác. Rộng tối đa
  `spec.wireframeWidth` ký tự (mặc định 76: khung 74 + 2 viền), chỉ dùng ASCII cho khung (`+ - |`), đánh số thành
  phần bằng chữ số thường (`[6 + Thêm]`, `7 Đầu cột`) — không dùng ①②, emoji hay ký tự vẽ khung Unicode (lệch cột
  ở nhiều font). Các dòng phải thẳng cột.
- Màn có nhiều chế độ xem hoặc hộp thoại riêng: mỗi thứ một wireframe con, đánh số tiếp theo hoặc đặt tên, cùng
  dùng một bảng thành phần.
- **Khuôn giao diện dùng chung của repo** (nếu guides hoặc một module nền định nghĩa: phần đầu trang, danh sách,
  hộp thoại…) thì dẫn tới khuôn đó, chỉ liệt kê phần riêng — không vẽ lại kiểu khác. Cần lệch thì ghi lý do ở quy
  tắc hiển thị.
- **Cột Luồng** là cầu nối duy nhất sang nghiệp vụ. Không mô tả lại quy tắc nghiệp vụ trong cột Mô tả — dẫn mã.
- **Quy tắc hiển thị**: ẩn/hiện theo quyền hoặc dữ liệu, cảnh báo, trạng thái rỗng, cuộn, hành vi giao diện thuần.
  Không có thì bỏ bảng.
- Wireframe do `/kit:spec` vẽ và duyệt cùng spec. `/kit:prototype` dựng HTML từ đây; thay đổi giao diện phát sinh khi làm
  prototype được đồng bộ ngược về 4 phần này.

## 3. Luồng nghiệp vụ

Mỗi user story là một luồng, **dùng luôn mã US**. Một US có hai luồng chính khác hẳn nhau thì tách thành hai US.

```markdown
#### <MOD>-F##-US##

**<Tên hành động, dạng động từ>**

> Là <vai trò>, tôi muốn <hành động>, để <lợi ích>.

- **Actor:** <vai trò>
- **Tiền điều kiện:** <điều phải đúng trước khi bắt đầu>
- **Kích hoạt từ:** [<mã SCR>](#...) (<số thành phần>); <điểm vào khác>

**Luồng chính**
1. <Actor> <hành động quan sát được>.
2. Hệ thống <kiểm tra / phản hồi quan sát được> (<mã BR liên quan>).

**Luồng rẽ nhánh**
- **A1 — <tên tình huống>** (tại bước N): <hệ thống làm gì>; <kết thúc ra sao / quay lại bước nào>.

**Ngoại lệ**
- **E1 — <tên>** (tại bước N): <hệ thống từ chối / báo lỗi>; dữ liệu giữ nguyên.

**Hậu điều kiện**
- Thành công: <trạng thái dữ liệu sau cùng>.
- Thất bại: <thường là: không có gì thay đổi>.
```

Quy tắc viết:

- **Chỉ hành vi quan sát được.** Không viết "mở transaction", "gọi API X", "bấm nút xanh". Chi tiết kỹ thuật thuộc
  mô hình dữ liệu hoặc kế hoạch của `/kit:dev`; chi tiết điều khiển thuộc màn hình.
- **Mỗi bước một hành động.** Câu có "và/hoặc" nối hai việc khác nhau thì tách bước.
- **Rẽ nhánh (`A#`) vs ngoại lệ (`E#`):** `A#` là nhánh do **quy tắc nghiệp vụ** (kể cả khi bị chặn). `E#` là bị từ
  chối do **quyền / cách ly dữ liệu**, hoặc lỗi không thuộc nghiệp vụ. Mỗi nhánh ghi rõ rẽ ra **tại bước nào**.
- Dòng nhánh phải đúng dạng `- **A1 — …**` / `- **E1 — …**` (TAF đọc để biết mã cần phủ).
- **Mã nhánh** là mã US + hậu tố: `DM-F01-US02-A1`. Đánh số theo từng US, không tái dùng. Đây là mã test mang theo.
- Tình huống thuần giao diện **không** phải nhánh luồng — ghi ở "Quy tắc hiển thị" của màn hình.

## 4. Mô hình dữ liệu

Mở đầu bằng **sơ đồ ER** (Mermaid `erDiagram`, chỉ vẽ quan hệ, không vẽ cột). Sau đó mỗi thực thể một khối:

```markdown
### N.k <Tên nghiệp vụ> (`<tên bảng / collection>`)

*<1–2 câu: thực thể này là gì trong nghiệp vụ.>*

| Thuộc tính | Cột | Kiểu | Bắt buộc | Quy tắc | Ý nghĩa |
|---|---|---|---|---|---|
| ... | ... | Chuỗi / Số / Số tiền / Ngày / Cờ / Enum `a`\|`b` / → <Thực thể> | ✔ / — / điều kiện | <ràng buộc + mã BR> | ... |

**Ràng buộc** — mỗi dòng một quy tắc, dẫn mã BR/US:
- ...

**Vòng đời** (chỉ khi thực thể có trạng thái): Mermaid `stateDiagram-v2` hoặc 1–2 câu.
```

- Cột hệ thống dùng chung (id, thời điểm tạo, xoá mềm…) ghi một lần ở đầu mục. Thuộc tính tính ra (không lưu) ghi
  thành bảng "Thuộc tính suy ra".
- **Kiểu ở mức nghiệp vụ**, không phải kiểu của CSDL — kiểu cụ thể, độ dài, index chốt ở `/kit:dev`.
- **Chưa đặc tả thì ghi `?`**, không tự đoán, và đưa vào mục câu hỏi còn mở của PRD.
- **Không ghi lịch sử phiên bản trong ô bảng** — đó là việc của Change Log.
- Quyết định cài đặt để ngỏ gom vào mục **"Để `/kit:dev` chốt"** ở cuối.

## 5. Điểm tích hợp

Chỉ khi module đăng ký vào điểm mở rộng của module khác hoặc phản ứng với sự kiện của module khác. **Mỗi thứ module
cung cấp một mục con**, 2–4 gạch đầu dòng: đăng ký vào đâu, hiển thị/hành xử ra sao. Phản ứng với sự kiện viết
thành bảng **một dòng mỗi sự kiện** (Sự kiện | Dữ liệu bị ảnh hưởng | Thay đổi).
