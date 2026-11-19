# CLAUDE.md — repo ai-kit

Repo này là **ai-kit**: quy trình spec → prototype → dev → test → ship cho AI, cộng TAF (kiểm thử e2e), nhúng vào repo
bất kỳ. Đọc [README.md](README.md) và [docs/README.md](docs/README.md) trước khi làm.

## Quy tắc

1. **Không đưa thứ riêng của một dự án vào repo này** (mã spec, đường dẫn, tên màn hình, tài khoản, stack, lệnh
   build). Ví dụ trong tài liệu được phép lấy từ `app-base`, nhưng phải ghi rõ là ví dụ. `process/`, `claude/`,
   `prompts/`, `templates/`, `RULES.md` phải trung tính — `cli/test/kit.test.mjs` chặn chuỗi riêng dự án.
2. Phần riêng của dự án đi qua `ai-kit.yml` hoặc adapter trong `adapters/`. Lớp kỹ thuật là của repo dự án (`guides`):
   kit không chép lại, không viết đè — chỉ chèn khối `ai-kit:start/end`.
3. Prompt TAF trong `prompts/` (và `process/testcase.md`) phải giữ hai ràng buộc: AI **không sửa code ứng dụng** (chỉ
   ghi vào `scripts.allowedPaths`), và **test theo spec/TC, không theo hành vi hiện tại của code**. Quy trình
   `/dev` được sửa code ứng dụng, nhưng test vẫn theo spec.
4. Bước quyết định (cấp mã, trạng thái duyệt, gate, chọn test, fingerprint, ghi bug, khối cầu nối) viết bằng code tất
   định trong `cli/`, không giao cho AI.
5. Tài liệu và prompt viết bằng tiếng Việt, súc tích. Mỗi file trong `docs/` dưới ~50KB.
6. Đổi thiết kế thì cập nhật tài liệu trong `docs/` cùng commit: tăng phiên bản phụ, thêm dòng Change Log ở
   `docs/README.md`.
7. Phát hành theo tag semver (`v2.0.0`) và tag nổi (`v2`). Bản 1.x ở nhánh `release/1.x`, sửa lỗi cắt `v1.0.x`; không
   dời tag cũ. Đổi định dạng TC hay `ai-kit.yml` không tương thích ngược thì tăng phiên bản chính.
