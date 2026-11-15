# PRD — <Tên module> (<MOD>)

<!--
  Khuôn PRD của ai-kit (spec.templates.prd). Quy tắc: .ai-kit/RULES.md §2. Xoá các chú thích HTML khi dùng.
  PRD chỉ nói về module này; bối cảnh toàn hệ thống trỏ về spec.index, không chép lại.
  Tên mục, tên cột viết theo `language` của dự án — trừ cột "Code"/"Mã" và "Spec" của Feature Summary:
  TAF đọc trạng thái duyệt ở cột Spec của bảng này.
-->

| Phiên bản | Cập nhật lần cuối | FSD |
|---|---|---|
| 1.0 | YYYY-MM-DD | [FSD-<tên>.md](FSD-<tên>.md) |

> Tổng quan toàn hệ thống: <link tới spec.index nếu có>

## Change Log

| Phiên bản | Ngày | Mô tả thay đổi | Tác giả |
|---|---|---|---|
| 1.0 | YYYY-MM-DD | Khởi tạo tài liệu | <docs.author> |

---

## 1. Mục tiêu và phạm vi

- **Vấn đề:** <ai gặp vấn đề gì>
- **Mục tiêu:** <đo được nếu có thể>
- **Ngoài phạm vi:** <những gì module này không làm>

## 2. Vai trò

| Vai trò | Mô tả | Quyền chính |
|---|---|---|
| <vai trò> | ... | ... |

## 3. Feature Summary

<!-- Spec, Prototype: AI chỉ ghi spec.status.draft; người duyệt bằng `kit approve <mã>` / `kit approve <mã> --prototype`
     (ghi "<đã duyệt> (người, ngày)"). Prototype = — khi feature không có giao diện. Feature bỏ: giữ dòng, Tên thêm
     [DEPRECATED], Spec = —. -->

| Code | Tên | Mô tả ngắn | Spec | Prototype |
|---|---|---|---|---|
| <MOD>-F01 | <tên> | <1 câu> | Nháp | Nháp |

## 4. Vai trò × luồng

| Luồng | <vai trò 1> | <vai trò 2> |
|---|---|---|
| <MOD>-F01-US01 <tên> | ✓ | — |

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| <MOD>-BR01 | ... |

## 6. Yêu cầu phi chức năng

| Mã | Yêu cầu |
|---|---|
| <MOD>-NFR01 | ... |

## 7. Phụ thuộc

- Module phụ thuộc: <MOD khác> — <dùng gì>. Không phụ thuộc vòng.

## 8. Câu hỏi còn mở

| # | Câu hỏi | Liên quan | Trạng thái |
|---|---|---|---|
| 1 | ... | <mã> | Mở |
