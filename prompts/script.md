# Prompt: test case → script Playwright

Bạn là kỹ sư tự động hoá kiểm thử. Nhiệm vụ: viết (hoặc cập nhật) **script Playwright** cho các feature được giao, từ **test case đã duyệt**. Ý định của test đã được người duyệt chốt trong TC; việc của bạn là chuyển TC thành code **đúng ý TC**, không thêm bớt.

Bạn đang chạy trong **repo dự án** (có `ai-kit.yml`). Lệnh CLI của framework: `npx --no kit`, gọi tắt `kit`.

## Đầu vào

Danh sách mã feature (vd `DM-F01 DM-F02`). Chỉ làm các feature này.

## Đọc trước

1. `ai-kit.yml`: `scripts.dir`, `scripts.ext`, `scripts.guide`, `scripts.allowedPaths`, `scripts.forbid`, `testcases.dir`.
2. **Hướng dẫn viết test của dự án** (`scripts.guide`). Đây là luật cao nhất về cách import, persona, fixture dữ liệu, page object, cách chờ. Làm đúng hướng dẫn, kể cả khi bạn quen cách khác.
3. Với mỗi feature: `kit plan-gen <MÃ>` (biết là sinh mới hay cập nhật), file TC, script hiện có (nếu có), phần spec mà TC trỏ tới (để hiểu màn hình).
4. Page object và fixture hiện có mà hướng dẫn nêu.
5. Khi cần biết phần tử trên giao diện: đọc code giao diện của app (chỉ đọc).

## Viết script

File: `<scripts.dir>/<MOD>/<MÃ><scripts.ext>` — `<MOD>` là mã module (cùng thư mục với TC trong `testcases.dir`), vd
`e2e/scripts/DM/DM-F01.spec.mjs`. Import tương đối tính từ thư mục đó. Page object mới đặt theo module
(`e2e/pages/<MOD>/`) hoặc phần dùng chung (`e2e/pages/common/`) — theo `scripts.guide` nếu dự án quy định khác.

- **Dòng đầu** là kết quả của `kit rehash <MÃ>` (chạy sau khi viết xong, lệnh tự ghi dòng `// @taf-source <TC> sha256:<hash>`). Không tự gõ hash.
- **Mỗi TC không `[DEPRECATED]` có ít nhất một `test(...)`**, tên bắt đầu bằng mã TC, theo sau là tên TC: `test("TC-DM-F01-001 Sale thấy đơn của mình…", …)`.
- TC có bảng "Dữ liệu kiểm tra": **một test cho mỗi dòng**, tên `"<mã TC> <tên> [<số dòng>] <giá trị chính>"`.
- TC `[DEPRECATED]`: không có test. Không viết test cho mã TC không có trong file TC.
- **Persona**: theo frontmatter, TC ghi đè thì theo TC. Cách áp dụng: theo hướng dẫn của dự án.
- **Tiền điều kiện, dữ liệu**: dựng bằng fixture / factory của dự án (`run.setupPaths`, mặc định `e2e/support/`), không
  qua giao diện. **Script không gọi API ghi trực tiếp** (`request.post / put / patch / delete`) — `check-script` báo lỗi;
  chỉ TC tầng `api` mới gọi thẳng API mà nó kiểm. Chưa có fixture cho loại dữ liệu TC cần: thêm fixture vào
  `e2e/support/` (nếu nằm trong `scripts.allowedPaths`) theo thứ tự nguồn API: fixture đã có (dùng lại) → mục API trong
  FSD → route trong code BE (chỉ đọc); ưu tiên **API công khai của app** gọi bằng persona đủ quyền, rồi mới tới API riêng
  cho test. Ghi fixture mới vào danh sách fixture của `scripts.guide` nếu guide có danh sách đó. **Không có API phù hợp →
  DỪNG, hỏi người dùng** (thêm API test qua `/kit:dev`, dựng qua giao diện, hay dùng dữ liệu có sẵn) — không sửa code app.
- **Dữ liệu tạo qua giao diện** (bước "Lưu" của TC) cũng phải được dọn: lấy mã bản ghi vừa tạo (từ thông báo / URL / response
  theo page object) và đăng ký dọn qua fixture — cách cụ thể theo hướng dẫn của dự án. Không để sót dữ liệu.
- **TC tầng `api`** (`{layer}: api`): kiểm qua fixture `request` của Playwright (gọi API, kiểm status / body), không dùng
  `page`, không mở trình duyệt.
- **TC nhiều bước**: mỗi bước của bảng TC là một `test.step("Bước <n>: <thao tác> → <kết quả>", …)`, để báo cáo chỉ
  ra bước fail.
- **Bước**: gọi page object. Thiếu thao tác hoặc locator thì **thêm vào page object** (mặc định `e2e/pages/`, hoặc nơi hướng dẫn của dự án chỉ; phải nằm trong `scripts.allowedPaths`), không viết locator trong script.
- **Kết quả mong đợi**: mỗi ô thành ít nhất một `expect`, kiểm đúng chữ / số như TC ghi, trên **đúng phần tử** (ô của
  đúng dòng, theo mã bản ghi) bằng `toHaveText` / `toHaveValue` / `toHaveCount`… Không nới lỏng (`toContainText` trên cả
  dòng, chỉ `toBeVisible`, bỏ bớt ý) để test dễ qua — `kit check-script` cảnh báo assertion yếu và số `expect` giảm.
- **Lỗi đã biết** (`test.fail`): chỉ khi người dùng chọn để lại lỗi app, và **phải kèm link issue**
  (`test.fail(true, "Lỗi app đã biết: <url issue>")`) — thiếu link thì `check-script` báo lỗi.
- Page object chỉ chứa locator và thao tác (kể cả chờ); **không** chứa assertion kết quả nghiệp vụ của TC.
- Không `test.only`, không `waitForTimeout`, không mẫu nào trong `scripts.forbid`.
- Cập nhật (TC đổi): giữ các test của TC không đổi, sửa test của TC đã đổi, thêm test cho TC mới, xoá test của TC đã DEPRECATED.

## Kiểm tra (bắt buộc, lặp đến khi sạch)

1. `kit rehash <MÃ>` → `kit check-script <MÃ>`: hết lỗi ✘.
2. `kit lint-script`: lệnh kiểm của dự án qua.
3. `kit check-paths`: mọi file bạn đổi nằm trong `scripts.allowedPaths`.
4. Chạy thử khi quy trình gọi prompt này cho phép (`/kit:e2e-script` hỏi người dùng trước; app phải đang chạy theo
   `stack.env`): `kit e2e <MÃ> --no-gate --base-url <địa chỉ app>`. Test fail thì đọc lỗi:
   - Lỗi ở script hoặc page object (sai locator, thiếu chờ, dữ liệu dựng sai): sửa, chạy lại. Tối đa 3 vòng.
   - App làm khác TC (sai số tiền, sai thông báo, thiếu chức năng): **không sửa script cho khớp app**. Để test fail, ghi vào báo cáo là nghi bug ứng dụng.

## Phạm vi file

Chỉ ghi vào `scripts.allowedPaths`. **Không sửa code ứng dụng, spec, test case, cấu hình Playwright, fixture ngoài phạm vi được phép.** Thiếu thứ gì ở phần không được sửa (vd fixture chưa có hàm tạo dữ liệu cần thiết, app thiếu `data-testid`) thì dùng cách khác trong phạm vi được phép nếu có, không thì ghi vào báo cáo.

## Kết thúc

Báo lại ngắn gọn:

1. File đã ghi (script, page object), số test mỗi feature.
2. Kết quả `check-script`, `lint-script`, `check-paths`, và `run` nếu có.
3. Test còn fail: mã TC, lý do, bạn cho là lỗi script hay nghi bug ứng dụng.
4. Fixture mới / đã sửa (nếu có) và API nó gọi — để người duyệt cùng script.
5. Việc cần dự án bổ sung (API dựng dữ liệu, testid…).
