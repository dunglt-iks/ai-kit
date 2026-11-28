# Quy trình /kit:ship — kiểm tra cuối, mở PR, theo dõi CI

Chuẩn bị đưa nhánh hiện tại lên PR.

## Bước 0 — Nạp hai lớp quy định

`npx --no kit context` → đọc `guides` (bỏ qua file `kit context` đánh dấu "công cụ đã tự nạp") (quy ước commit/PR, lệnh kiểm của repo) → đọc
`<kit>/RULES.md` (§6 Git). Dưới đây `<base>` = `project.baseBranch`, `<remote>` = `project.remote`.

## Các bước

1. `git status`. Còn thay đổi chưa commit thì **hỏi** trước khi commit.
2. `git fetch <remote>` rồi `git rebase <remote>/<base>`. Xung đột: giải quyết theo hiểu biết về thay đổi của
   nhánh, giữ ý định của cả hai phía; chỗ không chắc thì DỪNG và hỏi.
3. **Kiểm tra cuối**, sửa lỗi nếu có, không sửa được thì dừng và báo:
   - Lần lượt mọi lệnh trong `stack.checks` (không khai thì lấy từ guides).
   - **E2E (TAF):** `kit e2e changed --base-url <địa chỉ app ở máy>` — lấy mã feature của nhánh (tên nhánh,
     commit), gate (TC + script) rồi chạy script của các feature đó. Gate phải xanh (CI cũng gate, đỏ thì PR bị chặn):
     thiếu / lỗi thời TC → `/kit:testcase <mã>` và người duyệt (`kit approve <mã> --testcase`); thiếu / lệch script →
     `/kit:e2e-script <mã>`. App chưa bật được ở máy (`stack.env`) → `kit gate --pr` (chỉ kiểm tuân thủ, không chạy), nói rõ e2e sẽ chạy trên dev sau deploy. Test fail → `/kit:e2e-triage` để phân loại: app làm khác test case → sửa code, không sửa test; lỗi để lại → hỏi người dùng có đánh dấu lỗi đã biết kèm issue không (`scripts.guide`).
4. **Tài liệu:** diff đụng tài liệu spec (`spec.roots`) → xác nhận đã bump version + Change Log (RULES §2.3).
   Việc làm thay đổi tiến độ → xác nhận `progress.file` đã cập nhật.
5. **Mô tả PR:**
   - Tiêu đề theo quy ước repo (mặc định `feat(<phạm vi>): …` / `fix(<phạm vi>): …`), **chứa mã feature** (vd
     `feat(dm-f01): …`) — TAF lấy mã từ tiêu đề, nhánh, commit để chạy gate và e2e; PR sửa
     `trigger.codePaths` mà không có mã bị chặn, trừ nhãn `trigger.skipLabel`.
   - Link tài liệu spec và kế hoạch (`spec.plansDir`), tóm tắt thay đổi, checklist tiêu chí chấp nhận, hướng
     dẫn kiểm tra thủ công, ghi chú migration / biến môi trường mới.
   - Dòng ghi công (attribution) theo hướng dẫn hiện hành của công cụ AI và của repo — không chép cứng.
6. Trình bày mô tả PR và **HỎI** trước khi push. Được đồng ý: `git push -u <remote> HEAD`, rồi tạo PR bằng
   `project.prTool` (`gh pr create`; `none` hoặc chưa cài thì in mô tả để người dùng tự tạo).
7. **Theo dõi CI** (`gh pr checks <số> --watch` nếu dùng gh). Có check fail:
   - Đọc log (`gh run view <run> --log-failed`); với e2e đọc thêm comment báo cáo `E2E-TAF` trên PR.
   - Gate chặn (nhãn `gate.blockedLabel`): thiếu / chưa duyệt / lỗi thời test case → báo người dùng chạy
     `/kit:testcase <mã>` và duyệt; không tự sửa test case. Thiếu / lệch script → `/kit:e2e-script <mã>`.
   - Test e2e fail: CI không phân loại → `/kit:e2e-triage <run-id>` (tải kết quả về, phân loại): app sai → sửa code;
     script / page object sai → sửa script; lỗi đã biết nay pass → gỡ đánh dấu.
   - Sửa xong: chạy lại kiểm tra tương ứng ở máy, commit và **HỎI** trước khi push. Tối đa 3 vòng, vẫn đỏ thì
     dừng và báo.
