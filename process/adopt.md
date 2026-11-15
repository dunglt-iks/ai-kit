# Quy trình /kit-adopt — đề xuất cấu hình khi mới nhúng ai-kit

Chạy một lần sau `kit init` (hoặc khi đổi lớn cấu trúc repo). Bạn **đề xuất**, người dùng **quyết**: không ghi
`ai-kit.yml` hay file hướng dẫn nào trước khi được duyệt. Không sửa code ứng dụng.

## Bước 1 — Đọc

1. `node .ai-kit/cli/bin/kit.mjs context` và `node .ai-kit/cli/bin/kit.mjs doctor`.
2. Đọc `ai-kit.yml`, `.ai-kit/RULES.md`, `.ai-kit/templates/ai-kit.yml` (ý nghĩa từng khoá).
3. Đọc **mọi file `guides`** và các file chúng trỏ tới mà nói về tài liệu yêu cầu, quy trình, test.
4. Xem cấu trúc repo: thư mục tài liệu, kế hoạch, code, test, e2e; file build (`package.json`, `Makefile`,
   `go.mod`, `pyproject.toml`…); CI (`.github/workflows/`); lịch sử commit gần đây (quy ước message, tên nhánh).

## Bước 2 — Đề xuất giá trị `ai-kit.yml`

Mỗi khoá đề xuất kèm **căn cứ** (file:dòng). Không có căn cứ thì để mặc định và nói rõ.

| Khoá | Lấy từ |
|---|---|
| `language` | ngôn ngữ tài liệu hiện có |
| `guides` | file hướng dẫn AI + tài liệu kỹ thuật chúng bắt đọc (kiến trúc, cách test) |
| `spec.roots`, `featurePattern`, `normalize`, `status`, `index`, `smallItem` | tài liệu yêu cầu hiện có; mẫu mã đang dùng; chữ trạng thái đang dùng |
| `progress.file`, `progress.values` | bảng tiến độ nếu có |
| `spec.plansDir` | nơi đang để kế hoạch |
| `stack.checks` | lệnh lint/test mà guides hoặc CI đang chạy (đúng thứ tự, đúng thư mục) |
| `stack.traceability.searchPaths` | thư mục code + test |
| `stack.env` | cách bật app ở máy + địa chỉ, để chạy e2e (theo guides) |
| `project.*` | nhánh mặc định, remote, `gh` có dùng không |
| TAF (`testcases`, `scripts`, `run.command`, `run.baseUrlEnv`, `trigger.codePaths`) | e2e hiện có, lệnh chạy test (Playwright…), biến địa chỉ app mà cấu hình test đọc, thư mục code nên chặn PR thiếu mã |

Repo đã có tài liệu theo dạng khác PRD/FSD: nêu chỗ khác, đề xuất (a) chuyển dần theo khuôn của kit, hoặc (b) viết
spec adapter riêng (`./…mjs`, xem `.ai-kit/adapters/README.md`). Không tự chuyển tài liệu.

## Bước 3 — Liệt kê mâu thuẫn giữa guides và kit

Đối chiếu guides với RULES. Mỗi mâu thuẫn một dòng: **guides nói gì (file:dòng) — kit nói gì (RULES §) — đề xuất**.
Hay gặp: nơi viết spec, cách đánh mã, ai duyệt, nơi viết e2e (tay vs TAF), quy ước commit/PR, lệnh `/spec`…
trùng tên đã có trong repo. Không tự chọn bên nào.

## Bước 4 — Trình bày → ⏸ DỪNG

Trình bày: bản `ai-kit.yml` đề xuất (dạng diff so với file hiện tại), bảng mâu thuẫn, và — nếu repo có CI GitHub —
gợi ý chỗ cắm bước `uses: dunglt-iks/ai-kit/actions/e2e@<kitRef>` vào workflow sẵn có (sau bước dựng app; theo
docs/04 của kit), không tự sửa workflow. Chờ người dùng duyệt từng phần; được duyệt mới ghi `ai-kit.yml`. Thay đổi
file hướng dẫn của repo (ngoài khối `ai-kit:start/end`) chỉ làm khi người dùng yêu cầu rõ. Cuối cùng chạy lại
`kit init` (tự kiểm), báo kết quả và đề xuất commit (hỏi trước).
