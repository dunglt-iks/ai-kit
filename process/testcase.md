# Quy trình /kit:testcase — test case e2e từ spec đã duyệt

Đầu vào: mã feature. Bước này thuộc TAF; ràng buộc: **không sửa code ứng dụng**, test case viết **theo spec,
không theo hành vi hiện tại của code**.

1. `npx --no kit context` → đọc `<kit>/RULES.md` (§5). Không cần đọc guides kỹ thuật, trừ phần
   mô tả persona/dữ liệu thử nếu có.
2. `npx --no kit ready <mã>` — spec **và** prototype (nếu feature có giao diện) phải đã được người
   duyệt. Chưa qua → dừng, chép đúng lý do `kit ready` báo. Không tự duyệt.
3. Đọc `<kit>/prompts/testcase.md` và làm đúng theo đó với mã feature trên.
