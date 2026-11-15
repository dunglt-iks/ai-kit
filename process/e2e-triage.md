# Quy trình /e2e-triage — phân loại test e2e fail, sửa script, ghi bug app

Đầu vào: trống (lấy lần chạy gần nhất ở máy), hoặc link / số lần chạy CI (`gh run`), hoặc số PR. CI không phân
loại test fail (không có bước AI trên CI) — việc đó làm ở đây. Bước này thuộc TAF, ràng buộc: **không sửa code ứng
dụng** (chỉ ghi trong `scripts.allowedPaths` và `triage.json`), **không sửa script cho khớp app khi app làm khác
test case**.

## Bước 0 — Nạp quy định

`node .ai-kit/cli/bin/kit.mjs context` (gọi tắt `kit`) → đọc `.ai-kit/RULES.md` (§5) → đọc `scripts.guide`.

## Các bước

1. **Lấy kết quả cần phân loại** — `<report>` = `run.report` (mặc định `e2e/test-results/raw/results.json`). Báo cáo người đọc: `run.reportsDir/latest.md`.
   - **Ở máy:** dùng `<report>` hiện có. Chưa có thì hỏi người dùng bật app rồi chạy `kit e2e <mã…> --base-url <địa chỉ>` trước.
   - **Từ CI:** tìm lần chạy (`gh run list --workflow <file> --limit 5`; từ PR: `gh pr checks <số>`), đọc môi trường
     (`env`) và địa chỉ app trong log hoặc comment `E2E-TAF`, rồi `gh run download <run-id> -D <thư mục tạm ngoài repo>`. Tìm file
     `results.json` trong đó và chép đè lên `<report>` (thư mục này nằm trong `.gitignore`); ảnh / trace giữ ở thư
     mục tạm — đường dẫn `attachments` trong report là của máy CI, tìm lại file theo tên.
   - Lần chạy CI dùng code của commit nào thì `git log -1 <sha>`; code ở máy khác commit đó → nói rõ khi kết luận.
2. **Phân loại:** đọc `.ai-kit/prompts/triage.md` và làm đúng theo với môi trường đã xác định — kể cả ghi `triage.json`.
   Ngoại lệ khi kết quả lấy từ CI:
   - Chỉ chạy lại (`kit e2e <mã> --no-gate --merge --base-url <địa chỉ>`) nếu truy cập được app tương ứng từ máy
     (bật theo `stack.env`, hoặc môi trường dev dùng chung). Không được → phân loại theo log, ảnh, trace; **không** sửa script khi chưa chạy lại được, ghi rõ trong báo cáo.
   - Không tự đổi `results.json` ngoài lệnh `kit e2e … --merge`.
3. **Xem lại:** `kit report` → bảng kết quả kèm loại từng test fail. Trình bày cho người dùng: mỗi `app-bug` một dòng
   (tóm tắt sẽ thành issue), script đã sửa, `env` / `flaky` / `tc-wrong` kèm việc đề xuất (`tc-wrong` → `/testcase <mã>`,
   người duyệt lại).
4. **Ghi bug (tracker):** chỉ khi người dùng đồng ý. Tracker `github` cần biến môi trường:
   `GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=$(gh repo view --json nameWithOwner -q .nameWithOwner)`.
   Chạy `kit file-bugs --dry-run` trước, trình bày, rồi `kit file-bugs` (thêm `--close-fixed` nếu đây là kết quả
   hồi quy trên nhánh phát triển và người dùng muốn đóng bug đã hết).
5. **Script đã sửa:** `kit check-script <mã>`, `kit lint-script`, `kit check-paths` phải sạch. **Hỏi** trước khi
   commit (`test(e2e): sửa script sau triage`) và trước khi push.
6. **Báo lại:** số test fail theo loại, script đã sửa, bug đã ghi (số issue), việc còn lại — `app-bug` gợi ý
   `/dev #<issue>` để sửa code.
