# Quy trình /e2e-script — sinh hoặc cập nhật script e2e từ test case đã duyệt

Đầu vào: một hoặc nhiều mã feature. Bước này thuộc TAF. CI không sinh script: gate chặn PR khi TC đã duyệt mà
script chưa có hoặc lệch TC, nên script phải sinh và chạy thử ở máy trước khi push. Ràng buộc: **không sửa code ứng dụng** (chỉ ghi trong `scripts.allowedPaths`),
script làm **đúng ý test case**, không theo hành vi hiện tại của app.

## Bước 0 — Nạp quy định

`node .ai-kit/cli/bin/kit.mjs context` (gọi tắt `kit`) → đọc `.ai-kit/RULES.md` (§5) → đọc `scripts.guide` (hướng dẫn
viết test e2e của dự án).

## Các bước

1. **Việc cần làm:** `kit ready <mã…>` (spec + prototype đã duyệt) rồi `kit plan-gen <mã…>`.
   - `+` / `~` (sinh mới / cập nhật): làm tiếp.
   - `✓` (script đã khớp TC): báo không có gì để sinh, dừng — trừ khi người dùng yêu cầu viết lại.
   - `-` (bỏ qua: chưa có TC, TC chưa duyệt…): báo lý do, gợi ý `/testcase <mã>` hoặc người duyệt TC (`kit approve <mã> --testcase`); dừng với mã đó.
2. **Sinh:** đọc `.ai-kit/prompts/script.md` và làm đúng theo cho các mã cần làm (gồm `kit rehash`,
   `kit check-script`, `kit lint-script`, `kit check-paths`) — **trừ bước chạy thử của prompt**: làm ở bước 3,
   sau khi hỏi người dùng.
3. **Chạy thử:** hỏi người dùng có chạy không. App phải đang chạy (người bật theo `stack.env`, hoặc `webServer` của
   cấu hình test); hỏi địa chỉ nếu `stack.env` không ghi. Được đồng ý: `kit e2e <mã…> --no-gate --base-url <địa chỉ>`
   (in bảng kết quả theo feature).
   Test fail:
   - **Script / page object sai** (locator, chờ, dựng dữ liệu) → sửa theo `prompts/script.md`, chạy lại, tối đa 2 vòng.
   - **App làm khác test case** → **không** sửa script cho khớp app; ghi vào báo cáo là lỗi nghi do code (kèm mã TC),
     gợi ý `/dev` để sửa code, hoặc đánh dấu lỗi đã biết theo `scripts.guide` nếu người dùng chọn để lại.
4. **Báo lại:** file đã tạo/sửa, kết quả các lệnh kiểm, kết quả chạy (pass / fail / lỗi đã biết), việc còn lại.
   Không commit khi người dùng chưa xác nhận.
