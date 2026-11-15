# 13 — Tổ chức tài liệu spec (cho người viết)

Tài liệu cho BA, PO, dev mới vào: cách kit tổ chức tài liệu yêu cầu, vì sao, và một ví dụ hoàn chỉnh. Quy tắc mà AI
phải theo nằm ở [`RULES.md`](../RULES.md) §2; khuôn chi tiết ở [`templates/fsd.md`](../templates/fsd.md),
[`templates/prd.md`](../templates/prd.md). Đường dẫn, mẫu mã, chữ trạng thái dưới đây là mặc định — dự án đổi trong
`ai-kit.yml` ([11](11-cau-hinh.md)). Ví dụ dùng module giả `DM` (đơn hàng) như [`examples/demo`](../examples/demo/).

## 1. Vì sao phải chặt như vậy

Spec là đầu chuỗi: **spec → test case → script e2e → code → bug**. Mọi mắt xích nối với nhau bằng **mã**:

```
FSD: #### DM-F01-US02, nhánh A1        ← người viết spec đặt mã
 └─ TC: "Truy vết: DM-F01-US02-A1"     ← /testcase phủ từng mã, kit gate kiểm phủ đủ
     └─ script: test "TC-DM-F01-003 …" ← /e2e-script, chạy bằng kit e2e
 └─ code: // DM-F01-US02-A1: …         ← /dev gắn ở chỗ thực thi quy tắc
     └─ test đơn vị: "DM-F01-US02-A1: …"
 └─ issue: [e2e] TC-DM-F01-003 …       ← TAF ghi bug, /dev #<số> sửa
```

Nhờ vậy: spec đổi chỗ nào thì `grep` mã ra đúng test, code, TC phải sửa; gate biết TC còn thiếu mã nào; reviewer
biết yêu cầu nào chưa có test. Mã sai định dạng hoặc tái dùng số là đứt chuỗi — nên mã do `kit next-code` cấp và
định dạng do kit đọc bằng code, không do người nhớ.

## 2. Cây thư mục

```
docs/features/                       ← spec.roots
├── PRD-<sản phẩm>.md                ← (tuỳ chọn, spec.index) tổng quan, danh sách module
├── implementation-status.md         ← (tuỳ chọn, progress.file) tiến độ theo mã — không phải yêu cầu
└── addon/DM-demo/                   ← một module: thư mục mang mã module
    ├── PRD-demo.md                  ← phạm vi, vai trò, Feature Summary (trạng thái duyệt), quy tắc BR
    ├── FSD-demo.md                  ← từng feature: màn hình → luồng; mô hình dữ liệu
    └── PROTOTYPE-demo.html          ← do /prototype dựng, một file cho cả module
docs/plans/dm-f01.md                 ← kế hoạch của /dev (spec.plansDir) — không phải yêu cầu
```

- **Module** là một nhóm chức năng có mã 2–4 chữ hoa (`DM`, `CM`…). Thư mục mang mã, tên file bên trong thì không.
- **PRD** trả lời *làm gì, cho ai, phạm vi tới đâu*. **FSD** trả lời *trông thế nào, hệ thống phản ứng ra sao*.
- FSD lớn quá `docs.splitAt` (mặc định ~50KB) thì tách thành thư mục `FSD-demo/`: `README.md` giữ metadata, Change
  Log và mục lục; mỗi nhóm feature một file; số mục giữ nguyên để link cũ không gãy. Chưa tới ngưỡng thì đừng tách.
- Việc nhỏ / bug / nợ kỹ thuật (nếu dự án khai `spec.smallItem`) ghi **một dòng** trong file của nó, không mở file mới.

## 3. Mã

| Loại | Dạng | Ví dụ | Thuộc |
|---|---|---|---|
| Feature | `<MOD>-F##` | `DM-F01` | module |
| User story = một luồng | `<MOD>-F##-US##` | `DM-F01-US02` | feature |
| Nhánh rẽ / ngoại lệ | `…-US##-A#` / `-E#` | `DM-F01-US02-A1` | luồng |
| Màn hình | `<MOD>-F##-SCR##` | `DM-F01-SCR01` | feature |
| Quy tắc nghiệp vụ | `<MOD>-BR##` | `DM-BR03` | module (không theo feature) |
| Yêu cầu phi chức năng / thành phần dùng chung | `<MOD>-NFR##` / `<MOD>-CMP##` | `DM-NFR01` | module |

- Số có `spec.codeDigits` chữ số — mặc định **2** (`DM-F01`, tối đa 99 mỗi phạm vi cha); dự án mới muốn đều độ dài
  có thể chọn **3** (`DM-F001`) trong `ai-kit.yml`, chọn từ đầu, không đổi giữa chừng. Tăng dần trong cha, **không bao
  giờ tái dùng**. Bỏ thì giữ mã, ghi `[DEPRECATED]`.
- Dùng hết số của một phạm vi (vd `DM-BR99`): `kit next-code` cấp tiếp `DM-BR100`; kit đọc cả hai độ dài, mã cũ giữ nguyên.
  Repo đã có nhiều mã (vd app-base) giữ 2 chữ số: đổi sang 3 phải đổi tên mọi mã trong tài liệu, code, test, làm mọi
  TC lỗi thời và đứt truy vết với commit / issue cũ.
- Nhánh đánh số theo từng luồng: `A1, A2…`, `E1…`, không có số 0 đứng đầu.
- Lấy mã: `kit next-code DM` (feature), `kit next-code DM-F03 --type US` / `--type SCR`, `kit next-code DM --type BR`.
  Lệnh tính cả mã đã `[DEPRECATED]`. Hai nhánh git cùng cấp một mã thì `kit gate` / `kit doctor` báo trùng.
- Tiêu đề mục **chỉ gồm mã** (`#### DM-F01-US02`), tên đặt ở dòng in đậm ngay dưới: neo link `#dm-f01-us02` không đổi
  khi đổi tên.

## 4. PRD

Thứ tự: metadata → **Change Log** (ngay sau metadata) → mục tiêu, phạm vi, ngoài phạm vi → vai trò → **Feature
Summary** → vai trò × luồng → quy tắc `BR` → NFR → phụ thuộc → câu hỏi còn mở. Khuôn: `templates/prd.md`.

**Feature Summary** là nơi duy nhất ghi trạng thái duyệt — kit đọc bảng này bằng code:

```markdown
| Code | Tên | Mô tả ngắn | Spec | Prototype |
|---|---|---|---|---|
| DM-F01 | Danh sách đơn hàng | Xem, tìm, xoá đơn | Đã duyệt (Lan, 2026-11-10) | Đã duyệt (Minh, 2026-11-10) |
| DM-F03 | Sửa số lượng | Manager sửa số lượng đơn | Nháp | Nháp |
| DM-F04 | Xuất CSV | Tải danh sách đơn | Đã duyệt (Lan, 2026-11-12) | — |
```

- Cột đầu tên `Code` hoặc `Mã`, phải có cột `Spec`. Cột `Prototype`: `—` khi feature không có giao diện.
- AI chỉ ghi `Nháp`. **Người** duyệt bằng `kit approve DM-F03` / `kit approve DM-F03 --prototype` — lệnh ghi người,
  ngày. Không sửa tay ô sang đã duyệt.
- PRD chỉ nói về module của nó; bối cảnh chung trỏ về PRD tổng, không chép lại.

## 5. FSD

Mỗi feature một mục, **màn hình trước, luồng sau**. Người đọc đi từ màn hình (thứ nhìn thấy), bấm link trong bảng
thành phần để xuống luồng (thứ hệ thống làm); luồng link ngược lên màn hình. Đổi giao diện không phải viết lại luồng.

```
## 3. DM-F03 — Sửa số lượng          ← kit đọc đúng dạng "<mã> — <tên>"
### Màn hình
#### DM-F03-SCR01                    ← 4 phần: tóm tắt, wireframe, thành phần, quy tắc hiển thị
### Luồng nghiệp vụ
#### DM-F03-US01                     ← luồng chính, nhánh A#/E#, hậu điều kiện
```

Cuối FSD: **Mô hình dữ liệu** (sơ đồ ER + mỗi thực thể một bảng thuộc tính) và **Điểm tích hợp** (nếu có). FSD
**không có** mục Edge Cases (mọi tình huống là nhánh của luồng, hoặc quy tắc hiển thị của màn hình) và **không có**
mục API (hợp đồng API thiết kế trong kế hoạch của `/dev`).

### Màn hình — 4 phần

1. **Tóm tắt** một câu: mục đích, ai dùng, mở từ đâu.
2. **Wireframe text**: khung ASCII `+ - |`, rộng ≤ 76 ký tự, thẳng cột, mỗi thành phần một số. Không dùng ký tự vẽ
   khung Unicode hay số khoanh tròn — lệch cột ở nhiều font. Wireframe là khung dây (vùng, thứ tự), không phải thiết
   kế thị giác.
3. **Bảng thành phần**: số, tên, mô tả, cột **Luồng** link tới US. Không viết lại quy tắc nghiệp vụ ở đây — dẫn mã.
4. **Quy tắc hiển thị**: ẩn/hiện theo quyền hoặc dữ liệu, trạng thái rỗng, khoá nút. Thuần giao diện → ở đây, không
   phải nhánh luồng.

### Luồng — nhánh A và E

- **Luồng chính**: mỗi bước một hành động **quan sát được** ("Manager bấm Lưu", "Hệ thống báo …"). Không viết "gọi
  API", "mở transaction".
- **A# — rẽ nhánh do quy tắc nghiệp vụ** (kể cả khi bị chặn: "số lượng ≤ 0").
- **E# — ngoại lệ do quyền / cách ly dữ liệu**, hoặc lỗi không thuộc nghiệp vụ ("sale không có quyền sửa").
- Mỗi nhánh ghi **tại bước nào** rẽ ra và kết thúc ra sao. Dòng nhánh đúng dạng `- **A1 — …**` (kit đọc dòng này).
- Một user story có hai luồng chính khác hẳn nhau → tách thành hai US.

## 6. Ví dụ hoàn chỉnh — DM-F03

Dòng trong PRD:

```markdown
| DM-F03 | Sửa số lượng | Manager sửa số lượng của đơn đã tạo | Nháp | Nháp |
```

Quy tắc trong PRD: `| DM-BR04 | Số lượng là số nguyên ≥ 1; thành tiền tính lại theo DM-BR01 khi số lượng đổi |`.

Phần trong FSD:

````markdown
## 3. DM-F03 — Sửa số lượng

### Màn hình

#### DM-F03-SCR01

**Hộp sửa số lượng** — đổi số lượng một đơn. Manager dùng; mở từ nút Sửa
trên dòng đơn ở [DM-F01-SCR01](#dm-f01-scr01).

```
+--------------------------------------------------+
| Sửa số lượng — Đơn #<mã đơn>                     |
|                                                  |
| 1 Sản phẩm: <tên sản phẩm>                       |
| 2 Số lượng: [ <số>      ]                        |
| 3 Thành tiền mới: <số tiền>                      |
| 4 <thông báo lỗi>                                |
|                                                  |
|                          [5 Huỷ]  [6 Lưu]        |
+--------------------------------------------------+
```

**Thành phần**

| # | Thành phần | Mô tả | Luồng |
|---|---|---|---|
| 1 | Sản phẩm | Chỉ đọc | — |
| 2 | Ô số lượng | Nhập số nguyên | [DM-F03-US01](#dm-f03-us01) |
| 3 | Thành tiền mới | Tính lại khi đổi ô 2 (DM-BR04) | [DM-F03-US01](#dm-f03-us01) |
| 4 | Thông báo lỗi | Hiện khi nhánh A1 | [DM-F03-US01](#dm-f03-us01)-A1 |
| 5 | Nút Huỷ | Đóng hộp, không đổi gì | — |
| 6 | Nút Lưu | Lưu số lượng mới | [DM-F03-US01](#dm-f03-us01) |

**Quy tắc hiển thị**

| Điều kiện | Hiển thị |
|---|---|
| Số lượng chưa đổi | Nút 6 khoá |
| Người dùng là sale | Không có nút Sửa trên DM-F01-SCR01 |

### Luồng nghiệp vụ

#### DM-F03-US01

**Sửa số lượng đơn**

> Là manager, tôi muốn sửa số lượng của một đơn, để sửa sai khi khách đổi ý.

- **Actor:** manager
- **Tiền điều kiện:** đơn tồn tại
- **Kích hoạt từ:** [DM-F03-SCR01](#dm-f03-scr01) (6)

**Luồng chính**
1. Manager nhập số lượng mới và bấm Lưu.
2. Hệ thống kiểm số lượng (DM-BR04).
3. Hệ thống lưu số lượng, tính lại thành tiền (DM-BR01), đóng hộp.
4. Danh sách đơn hiện số lượng và thành tiền mới.

**Luồng rẽ nhánh**
- **A1 — Số lượng không hợp lệ** (tại bước 2): số lượng trống, ≤ 0 hoặc không
  nguyên → hiện thông báo ở 4, giữ hộp mở; quay lại bước 1.

**Ngoại lệ**
- **E1 — Không có quyền** (tại bước 2): người gửi không phải manager → từ chối,
  báo "Không có quyền"; dữ liệu giữ nguyên.

**Hậu điều kiện**
- Thành công: đơn có số lượng và thành tiền mới.
- Thất bại: không có gì thay đổi.
````

Từ ví dụ này, `kit spec DM-F03` sẽ báo phải phủ: `DM-F03-US01`, `DM-F03-US01-A1`, `DM-F03-US01-E1`, `DM-F03-SCR01`.

## 7. Vòng đời

```
/spec viết ──► Spec: Nháp ──► kit approve DM-F03 ──► Đã duyệt (người, ngày)
/prototype ──► Prototype: Nháp ──► kit approve DM-F03 --prototype ──► Đã duyệt + dấu hash màn hình
                    kit ready DM-F03 ✓ ──► /testcase → /e2e-script → /dev
```

- **Mỗi lần sửa tài liệu**: bump phiên bản phụ (1.2 → 1.3), cập nhật ngày, thêm dòng Change Log **lên đầu**
  (`| Phiên bản | Ngày | Mô tả thay đổi | Tác giả |`).
- **Ngoại lệ bản nháp**: dòng Change Log trên cùng là phiên bản mà mọi mục nó đổi còn nháp → gộp thay đổi mới vào
  dòng đó, không bump. Phiên bản "đóng" khi có mục được duyệt.
- **Sửa spec đã duyệt** → ô Spec quay về Nháp, phải duyệt lại. Sửa **màn hình** sau khi duyệt prototype → `kit ready`
  báo prototype không còn khớp cho tới khi cập nhật và duyệt lại prototype. TC viết trước đó bị gate báo lỗi thời →
  `/testcase` đồng bộ.
- Đổi trạng thái (nháp ↔ đã duyệt) không phải thay đổi nội dung: không bump, không Change Log.
- Chưa chốt được thì ghi `?` ngay chỗ đó và đưa vào mục câu hỏi còn mở của PRD — đừng đoán.

## 8. Lỗi hay gặp

| Lỗi | Hậu quả | Đúng |
|---|---|---|
| Tiêu đề `## DM-F03 Sửa số lượng` (thiếu `—`) | kit không thấy feature | `## 3. DM-F03 — Sửa số lượng` |
| Nhánh viết `A1: …` thay vì `- **A1 — …**` | gate không biết phải phủ A1 | đúng dạng dòng nhánh |
| Tự đặt `DM-F03` khi nhánh khác cũng vừa thêm | trùng mã khi merge | `kit next-code DM` |
| Tái dùng số của mục đã bỏ | test cũ lẫn với yêu cầu mới | giữ mã cũ `[DEPRECATED]`, cấp số mới |
| "Hệ thống xử lý hợp lệ" | không viết được test đạt / trượt | nói rõ điều kiện và kết quả nhìn thấy |
| Tình huống lỗi để ở mục "Edge Cases" riêng | không có mã, không ai phủ | thành nhánh `A#`/`E#` của luồng |
| Wireframe vẽ bằng `┌─┐` hoặc số khoanh `①` | lệch cột, khó sửa | ASCII `+ - \|`, số thường |
| Sửa tay ô Spec thành "Đã duyệt" | không biết ai duyệt | `kit approve` |
| Mô tả quy tắc nghiệp vụ trong bảng thành phần | hai nơi lệch nhau | dẫn mã BR/luồng |

> `examples/demo` viết trước khi có khuôn này nên FSD của nó còn wireframe Unicode và chưa có Change Log — dùng để
> chạy TAF, không phải mẫu định dạng. Mẫu định dạng là §6 ở trên và `templates/`.

## 9. Kit hỗ trợ gì

| Việc | Lệnh |
|---|---|
| Viết spec theo khuôn, phỏng vấn | `/spec` (tự gọi `spec-reviewer` soát) |
| Lấy mã mới | `kit next-code` |
| Xem kit đọc được gì từ spec của một feature | `kit spec DM-F03` |
| Danh sách feature + trạng thái của một module | `kit context --scope DM` |
| Duyệt / kiểm đủ điều kiện | `kit approve`, `kit ready` |
| Kiểm mã trùng, cấu hình | `kit doctor` |
