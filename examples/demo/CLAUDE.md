# CLAUDE.md — Đơn hàng demo

Dự án mẫu của ai-kit. Phần dưới là **lớp kỹ thuật** của dự án (code thế nào); khối `ai-kit` ở cuối file nối sang
lớp quy trình.

## Kỹ thuật

- App: Node.js ≥ 20, ESM thuần, không framework, không phụ thuộc runtime. Một file `app/server.mjs` (HTTP server,
  dữ liệu trong bộ nhớ) và trang tĩnh `app/pages/*.html`.
- Chạy: `npm run app` (cổng 4310, bật test API). `DEMO_BUG=discount` bật lỗi cài sẵn.
- Không thêm thư viện runtime. Phân quyền kiểm ở server theo vai trò trong cookie phiên (`sale`, `manager`), không
  tin dữ liệu gửi từ trình duyệt.
- Kiểm cú pháp: `node --check` trên file đã đổi.
- Test: chỉ có e2e (Playwright, `e2e/`); cấu trúc `e2e/` và quy ước viết script, page object ở `e2e/README.md`. Không có unit test.

<!-- ai-kit:start — do `kit init` quản lý; sửa ngoài khối này -->
## ai-kit — quy trình spec → prototype → dev → test → ship

Repo dùng ai-kit (gắn ở `.ai-kit/`, cấu hình `ai-kit.yml`). Có hai lớp quy định:

- **Kỹ thuật** — stack, framework, cấu trúc code, lint, bảo mật, test đơn vị: theo hướng dẫn của
  repo (phần ngoài khối này và các file trong `guides` của `ai-kit.yml`).
- **Quy trình** — tài liệu spec, mã yêu cầu, trạng thái duyệt, version, kế hoạch, test case/e2e,
  truy vết, PR: theo `.ai-kit/RULES.md` và `ai-kit.yml`.

Khi hai lớp đụng nhau: *code thế nào* theo repo; *spec, quy trình, e2e đi đường nào* theo ai-kit.
Mâu thuẫn thật thì dừng và hỏi người dùng, không tự chọn.

Trước mọi việc thuộc quy trình, chạy `node .ai-kit/cli/bin/kit.mjs context`. Chưa có `.ai-kit/` thì
gắn kit theo `kitRef` trong `ai-kit.yml`: `git clone --depth 1 -b <kitRef> https://github.com/dunglt-iks/ai-kit .ai-kit`
rồi `npm ci --prefix .ai-kit --omit=dev`. Duyệt spec / prototype / test case là việc của người, bằng
`kit approve <mã>` (thêm `--prototype` / `--testcase`) — AI không tự đặt trạng thái đã duyệt.

- `/spec` — làm rõ yêu cầu, ghi vào tài liệu spec (trạng thái nháp)
- `/prototype` — dựng HTML tĩnh từ wireframe trong spec
- `/testcase` — sinh/đồng bộ test case e2e từ spec + prototype đã duyệt
- `/e2e-script` — sinh/cập nhật script e2e từ test case đã duyệt, chạy thử
- `/e2e-triage` — phân loại test e2e fail (ở máy hoặc lần chạy CI), sửa script, ghi bug app
- `/dev` — kế hoạch → code → test → review theo spec đã duyệt; sửa bug từ issue
- `/ship` — kiểm tra cuối, mở PR, theo dõi CI
- `/kit-adopt` — đề xuất cấu hình ai-kit.yml khi mới nhúng kit
<!-- ai-kit:end -->
