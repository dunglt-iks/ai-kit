# 03 — Sinh test script

## 1. Ai lo gì

| TAF | Dự án |
|---|---|
| Prompt [`prompts/script.md`](../prompts/script.md): đọc TC + hướng dẫn của dự án → viết script | Hướng dẫn viết test (`scripts.guide`): import, persona, fixture dữ liệu, page object có sẵn, cách chờ |
| `plan-gen`: chọn feature cần sinh. `check-script`: script khớp TC. `check-paths`: chỉ ghi chỗ được phép. `rehash` | Page object, fixture, Playwright config, `globalSetup` |
| Lệnh `/e2e-script` (ở máy): chạy Claude, kiểm tra, chạy thử; gate trên CI chặn khi script thiếu / lệch TC | Lệnh lint (`scripts.lint`), cách bật app ở máy (`stack.env`) |

Ví dụ đầy đủ phần của dự án: [`examples/demo/e2e/`](../examples/demo/e2e/) và [`README.md`](../examples/demo/e2e/README.md) của nó (cấu trúc thư mục: [01 §3.1](01-architecture.md)).

## 2. Khi nào sinh

`kit plan-gen <mã…>` cho mỗi feature:

| Kết quả | Khi |
|---|---|
| `new` | TC đã duyệt, chưa có `<scripts.dir>/<MOD>/<MÃ><ext>` |
| `update` | Dòng `@taf-source` của script lệch hash TC hiện tại (TC đã đổi) |
| `ok` | Script khớp TC |
| `skip` | Chưa có TC, TC còn lỗi lint, hoặc TC chưa duyệt |

Chỉ TC đã duyệt, còn khớp `approvedHash`, mới được sinh script. Hash tính trên toàn bộ file TC, bỏ khoảng trắng cuối dòng
và các dòng do việc duyệt ghi (`status`, `reviewer`, `approvedHash`) — duyệt TC không làm script "lệch".

## 3. Luật của script (`check-script` kiểm)

1. Dòng đầu: `// @taf-source <đường dẫn TC> sha256:<hash>` (do `kit rehash <MÃ>` ghi).
2. Mỗi TC không `[DEPRECATED]` có ít nhất một `test("<mã TC> …")`. TC có bảng "Dữ liệu kiểm tra" → một test mỗi dòng, cùng mã TC.
3. Không có test cho TC lạ hoặc TC đã `[DEPRECATED]`. Không `test.only`.
4. Không chứa mẫu trong `scripts.forbid` (vd `page\.locator\(` để locator chỉ nằm trong page object, `waitForTimeout\(`).

Kit dò test và mẫu cấm trên mã đã bỏ comment (`//`, `/* */`): test bị comment không được tính. Thêm về assertion:

| Kiểm | Mức |
|---|---|
| Test của một TC không có `expect` nào | Lỗi |
| `test.fail(…)` (lỗi đã biết) không kèm link issue (`…/issues/<số>` hoặc `#<số>`) | Lỗi |
| TC chỉ có assertion yếu (`toBeVisible`, `toContainText`, `toBeTruthy`…) | Cảnh báo |
| Dùng `toContainText` | Cảnh báo — nên `toHaveText` trên đúng ô / phần tử |
| Số `expect` của một TC giảm so với bản đã commit (`HEAD`) | Cảnh báo — dấu hiệu test bị nới, người review xem kỹ |
| TC tầng `api` mà test dùng `page` | Cảnh báo — kiểm qua `request`, không mở trình duyệt |

Lớp kiểm này chỉ bắt dấu hiệu; việc assertion có đúng **ý** TC hay không vẫn do người review đọc diff script. Lúc chạy (`kit e2e`),
mỗi TC đã duyệt trong phạm vi phải có ít nhất một test **thực sự chạy** (không tính skip / fixme); thiếu thì lần chạy
đỏ — trừ khi chạy một phần (`--grep`).

Người sửa tay script (hoặc sửa TC mà không cần sinh lại) chạy `kit rehash <MÃ>` để lần sau không bị coi là lệch.

## 4. Claude viết script thế nào

Theo [`prompts/script.md`](../prompts/script.md):

| Bước | Nguồn |
|---|---|
| Hiểu ý định | TC (tiền điều kiện, bước, kết quả mong đợi) và phần spec TC trỏ tới |
| Cách viết | Hướng dẫn của dự án (`scripts.guide`), luật cao nhất |
| Thao tác giao diện | Page object có sẵn. Thiếu thì bổ sung page object (nếu nằm trong `allowedPaths`) |
| Tìm phần tử | Đọc code giao diện của app (chỉ đọc) |
| Chạy thử | `kit e2e <MÃ> --no-gate --base-url <địa chỉ app ở máy>` (sau khi người dùng đồng ý), sửa lỗi script tối đa 3 vòng |

Nguyên tắc: **không sửa script cho khớp app khi app làm khác TC.** Kết quả mong đợi luôn theo TC; test đó để fail và được báo là nghi bug.

## 5. Phạm vi file Claude được ghi

**Claude không sửa code ứng dụng**, spec, TC (khi sinh script), cấu hình test. Chỉ ghi vào `scripts.allowedPaths`.

Cưỡng chế hai lớp:

1. **Prompt và quy trình** (`prompts/script.md`, `process/e2e-script.md`): chỉ ghi trong `allowedPaths`.
2. **Kiểm tra sau**: `kit check-paths` so mọi file đã đổi (kể cả file mới, kể cả file ngoài thư mục dự án) với `allowedPaths` (mặc định `e2e/scripts/**`, `e2e/pages/**`). File TC chỉ được chấp nhận khi là nháp, hoặc đã duyệt mà còn khớp `approvedHash` (người vừa duyệt, chưa commit) — **TC đã duyệt bị sửa luôn bị bắt**. Có file ngoài phạm vi → `/e2e-script`, `/e2e-triage` dừng, báo lại, không commit.

## 6. Sinh ở máy, CI chỉ kiểm

Script **sinh ở máy** bằng `/e2e-script <mã…>` ([`process/e2e-script.md`](../process/e2e-script.md)): `kit ready` →
`kit plan-gen` → Claude theo `prompts/script.md` → `check-script`, `lint-script`, `check-paths` → hỏi rồi chạy thử →
người dùng commit. CI không gọi AI (D8): gate (`kit e2e`) kiểm `check-script` cho feature có TC đã duyệt
(`gate.requireScript`), thiếu hoặc lệch thì PR bị chặn kèm lệnh cần chạy.
