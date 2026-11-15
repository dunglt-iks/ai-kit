# PRD — Đơn hàng demo (DM)

App quản lý đơn hàng rất nhỏ: sale tạo và xem đơn của mình, manager xem và xoá mọi đơn.

## Feature Summary

| Code | Tên | Mô tả ngắn | Spec |
|---|---|---|---|
| DM-F01 | Danh sách đơn hàng | Xem, tìm, xoá đơn; sale chỉ thấy đơn của mình | Đã duyệt |
| DM-F02 | Tạo đơn hàng | Form tạo đơn, tính thành tiền có chiết khấu | Đã duyệt |

## Vai trò × luồng

| Luồng | sale | manager |
|---|---|---|
| DM-F01-US01 Xem và tìm đơn | Đơn của mình | Mọi đơn |
| DM-F01-US02 Xoá đơn | — | ✓ |
| DM-F02-US01 Tạo đơn | ✓ | ✓ |
