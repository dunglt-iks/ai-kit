# Hướng dẫn viết test cho dự án demo

Claude đọc file này trước khi sinh script từ test case (`scripts.guide` trong `ai-kit.yml`).

## Thư mục `e2e/`

| Thư mục | Nội dung | Ai sửa |
|---|---|---|
| `testcases/<MOD>/<MÃ>.md` | Test case markdown | Claude soạn (`/testcase`), người duyệt |
| `scripts/<MOD>/<MÃ>.spec.mjs` | Script sinh từ TC | Claude (`/e2e-script`) |
| `pages/<MOD>/*.mjs`, `pages/common/` | Page object theo module / dùng chung | Dự án; Claude được bổ sung |
| `tests/` | Test viết tay không theo TC (smoke) | Dự án |
| `support/` | `fixtures.mjs`, `global-setup.mjs`, `personas.mjs` — khung test | Dự án |
| `testdata/` | `personas.yml`, dữ liệu tĩnh | Dự án |
| `test-results/` | Kết quả (không commit): `reports/latest.md`, `playwright/`, `.auth/`, `raw/` | Kit, Playwright |

## File và tên

- Mỗi feature một file: `e2e/scripts/<MOD>/<MÃ>.spec.mjs`, vd `e2e/scripts/DM/DM-F01.spec.mjs` (JavaScript ESM, không
  TypeScript).
- Import duy nhất từ fixture và page object của dự án:

```js
import { test, expect, persona } from "../../support/fixtures.mjs";
import { OrderListPage } from "../../pages/DM/OrderListPage.mjs";
import { OrderFormPage } from "../../pages/DM/OrderFormPage.mjs";
```

Không import `@playwright/test` trực tiếp.

## Persona

TC ghi `persona: <tên>` (frontmatter hoặc từng TC). Ánh xạ:

```js
test.use({ storageState: persona("sale") });                 // cả file, theo persona của frontmatter
test.describe(() => { test.use({ storageState: persona("manager") }); test("…", …); });  // TC có persona khác
```

Có sẵn: `sale`, `sale-2`, `manager` (xem `e2e/testdata/personas.yml`). Không đăng nhập trong test.

## Dữ liệu

- Tạo đơn bằng `fx.order({ customer, product, qty, price, discount })` (qua API, bằng phiên của persona hiện tại, tự xoá sau test). Trả về `{ id, customer, total, … }`.
- Tên khách hàng luôn duy nhất: `fx.uniq("Khách")`. Các test chạy song song và dùng chung app, nên **luôn tìm theo tên khách hàng duy nhất** trước khi kiểm danh sách.
- Cần đơn do persona khác tạo: `fx.order({ customer }, { as: "sale-2" })` — cũng tự xoá sau test.
- Đơn tạo **qua giao diện** (TC có bước Lưu): `const id = await form.saveCreated(); fx.track(id);` — `saveCreated()` chờ về
  *Đơn hàng*, đọc mã từ thông báo *Đã tạo đơn #<mã>*; `fx.track` đăng ký xoá sau test. Kiểm dòng đó bằng mã:
  `list.totalOf(id)`, `list.cell(id, "Bút bi")` — không `toContainText` trên cả dòng.
- TC nhiều bước: mỗi bước một `test.step("Bước <n>: … → …", async () => { … })`.
- Trạng thái "Chưa có đơn hàng" không dựng được khi chạy song song (người khác có thể đang có đơn). Kiểm bằng persona `sale-2` khi persona này chưa tạo đơn nào trong test đó, hoặc dùng tìm kiếm: chuỗi tìm không khớp đơn nào → *Không tìm thấy đơn phù hợp*.

## Page object

| Màn hình | Class | Có sẵn |
|---|---|---|
| DM-F01-SCR01 | `OrderListPage` | `open()`, `searchFor(text)`, `row(id)`, `totalOf(id)`, `firstRow()`, `deleteButton(id)`, `confirmDelete()`, `cancelDelete()`, `startCreate()`, `search`, `addButton`, `table`, `empty`, `ownerHeader`, `actionHeader`, `toast`, `confirmDialog` |
| DM-F02-SCR01 | `OrderFormPage` | `open()`, `fill({...})`, `save()`, `saveCreated()` → mã đơn, `cancel()`, `error(field)`, `customer`, `product`, `qty`, `price`, `discount`, `total`, `saveButton`, `cancelButton` |

- Locator **chỉ** nằm trong page object. Script không gọi `page.locator`, `page.getBy…`. Thiếu locator thì thêm vào page object của module (được phép sửa `e2e/pages/`).
- Không dùng `waitForTimeout`. Chờ bằng `expect(...)` (tự chờ) hoặc các hàm page object đã chờ sẵn.

## Kết quả mong đợi

- Mỗi ô "Kết quả mong đợi" của TC thành ít nhất một `expect`.
- Số tiền hiển thị theo `vi-VN`: `45.000`. So sánh chuỗi đúng như trên màn hình (`toHaveText("45.000")`).
- Thông báo: `expect(list.toast).toHaveText("Đã tạo đơn #12")`.
