# 06 — Test data: phần của dự án

TAF không tạo dữ liệu test. Script sinh ra gọi **factory và fixture của dự án**, theo cách dự án mô tả trong `scripts.guide`. Tài liệu này là các nguyên tắc nên theo để script sinh ra chạy ổn định, và là những gì Claude được dặn khi viết script.

## Nguyên tắc

1. **Mỗi test tự tạo dữ liệu nó cần.** Không dựa vào dữ liệu test khác để lại, không dựa vào thứ tự chạy.
2. **Tạo qua API**, không qua UI. Chỉ thao tác UI cho đúng phần TC đang kiểm.
3. **Tên duy nhất, có tiền tố nhận diện** (vd `E2E <chuỗi ngẫu nhiên>`), để chạy song song và dọn được.
4. **Tự dọn sau test** khi chạy trên môi trường dùng chung.

TC chỉ mô tả **trạng thái** cần có ("đơn có 2 dòng, đã duyệt"), không mô tả cách tạo. Script dùng factory của dự án để tạo trạng thái đó.

## Dựng dữ liệu bằng gì

Kit **không biết và không gọi** API nào của app. Việc dựng dữ liệu nằm trong **fixture của bộ khung test**
(`run.setupPaths`, mặc định `e2e/support/**`); script chỉ gọi fixture. Thứ tự ưu tiên khi viết fixture:

| # | Cách | Khi nào | Lưu ý |
|---|---|---|---|
| 1 | Persona, dữ liệu có sẵn trên môi trường | Test chỉ đọc | App không phải làm gì; test sửa dữ liệu dùng chung dễ đụng nhau |
| 2 | **API công khai của app** (vd QTV tạo user qua API quản trị), gọi bằng persona đủ quyền | Mặc định để tạo dữ liệu | Không cần cửa hậu; dữ liệu đi đúng luồng thật |
| 3 | API riêng cho test (`/api/test/*`) | App không có API công khai tương ứng | App phải làm thêm (qua `/dev`, người duyệt); chỉ bật ở môi trường test, **không bao giờ ở production** |
| 4 | Giao diện | Chính luồng đó là thứ TC đang kiểm | Chậm, dễ vỡ; dọn bằng `fx.track` |
| — | Ghi thẳng vào DB | Tránh | Dính chặt schema; thường không có quyền vào DB của dev / staging |

**API dựng dữ liệu bị lỗi thì sao?** Lỗi của chính API đó được bắt bởi test riêng của nó (TC tầng `api`). Trong test
khác, lỗi xảy ra trong fixture được kit báo riêng là **lỗi dựng dữ liệu** (vị trí lỗi nằm trong `run.setupPaths`):
feature đang test chưa được kiểm, không kết luận feature hỏng — sửa fixture / môi trường rồi chạy lại ([07](07-bug-reporting.md)).

**Ai viết fixture, khi nào.** Fixture nền (persona, đăng nhập, tài khoản test) do dev / QA dựng khi lập bộ khung test.
Fixture cho loại dữ liệu mới: AI viết ở `/e2e-script` khi TC cần dữ liệu chưa có fixture ("Tiền điều kiện", "Dữ liệu
kiểm tra"), lấy API theo thứ tự: fixture đã có (dùng lại) → mục API trong FSD → route trong code BE; người duyệt cùng
script. Danh sách fixture và cách dùng ghi trong `scripts.guide` (vd `e2e/README.md`). Không có API phù hợp → AI **dừng,
hỏi người** (thêm API test qua `/dev`, dựng qua giao diện, hay dùng dữ liệu có sẵn) — AI không sửa code app ở bước viết
script.

**Script không gọi API ghi trực tiếp.** `check-script` (và gate) báo lỗi khi script tự gọi `request.post / put / patch /
delete` — dựng / dọn dữ liệu phải qua fixture: API đổi chỉ sửa một chỗ, lỗi dựng dữ liệu được phân loại đúng. TC tầng
`api` (kiểm chính API đó) thì được gọi trực tiếp. Đọc (`request.get`) để kiểm kết quả vẫn được.

## Fixture tự dọn (gợi ý)

```ts
// e2e/support/fixtures.ts của dự án (cấu trúc e2e/: 01 §3.1)
export const test = base.extend<{ fx: Factories }>({
  fx: async ({ request }, use) => {
    const created: (() => Promise<void>)[] = [];
    await use(makeFactories(request, created));           // test chạy ở đây
    for (const del of created.reverse()) await del().catch(() => {});   // dọn, kể cả khi test fail
  },
});
```

Script sinh ra import `test` từ fixture của dự án, không từ `@playwright/test`. Hướng dẫn trong `scripts.guide` phải nói rõ điều này.

**Dữ liệu tạo qua giao diện** (TC có bước "Lưu") cũng phải dọn: page object trả mã bản ghi vừa tạo (đọc từ thông báo, URL
hoặc response), script đăng ký dọn qua fixture (vd `fx.track(id)`). Dọn lỗi không làm test fail nhưng fixture ghi
annotation `cleanup` (`testInfo.annotations.push({ type: "cleanup", description })`) — báo cáo của kit có mục
**Dọn dữ liệu test lỗi** để thấy môi trường đang bẩn dần (vd API dọn không bật trên môi trường dev). Ví dụ:
`examples/project1/e2e/support/fixtures.ts` (`fx.user`, `fx.track`).

## Bảng "Dữ liệu kiểm tra"

TC có bảng dữ liệu thì script sinh **một test cho mỗi dòng**, tên test có số dòng:

```ts
for (const [i, row] of rows.entries())
  test(`TC-DM-F01-004 số lượng không hợp lệ [${i + 1}] ${row.qty}`, async ({ page }) => { /* … */ });
```

## Phụ thuộc ngoài

Dịch vụ ngoài (AI, bản đồ, email, thanh toán), giờ hệ thống, vị trí: giả lập trong phần của dự án (`page.route`, `clock`, `geolocation`, server giả). Hướng dẫn của dự án liệt kê sẵn để Claude dùng đúng.
