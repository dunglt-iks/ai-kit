# 05 — Phạm vi TAF; môi trường, dữ liệu, persona là phần của dự án

TAF **không** dựng hay tắt app, không cấu hình hệ thống, không tạo tài khoản, vai trò, persona hay dữ liệu. Những việc
này mỗi ứng dụng làm một kiểu, và CI của dự án cùng Playwright đã có sẵn chỗ cho chúng (`globalSetup`, fixture,
`storageState`, `webServer`).

## 1. Ba tầng

| Việc | Ai lo | Ở đâu |
|---|---|---|
| Build, dựng / tắt app và dịch vụ đi kèm (DB, queue…), deploy | **CI của dự án** | Workflow build / deploy của dự án; ở máy người tự bật app (`stack.env`) hoặc `webServer` của Playwright |
| Dữ liệu nền (seed), tài khoản, vai trò, persona, đăng nhập sẵn | **Bộ khung test của dự án** | `globalSetup` / `globalTeardown`, `personas.yml`, `storageState` |
| Dữ liệu riêng từng test: dựng trước, dọn sau | **Bộ khung test của dự án** — script chỉ **gọi** | Fixture (`run.setupPaths`, mặc định `e2e/support/**`), ưu tiên gọi API công khai của app ([06](06-test-data.md)). Script không gọi API ghi trực tiếp (`check-script` chặn) |
| Kiểm tuân thủ của PR; chờ app trả lời, chọn test theo feature, chạy vào địa chỉ app, gom kết quả theo mã TC/spec, tách lỗi dựng dữ liệu, báo cáo, issue theo dõi môi trường, đóng bug đã hết | **ai-kit (TAF)** | `kit gate --pr`, `kit e2e` ([04](04-ci-workflow.md)) |

TAF chỉ cần dự án khai **lệnh chạy test** và **biến nhận địa chỉ app**:

```yaml
run:
  command: npx playwright test --reporter=json,list {files}   # {files}: script được chọn; {grep}: --grep (tuỳ chọn)
  baseUrlEnv: E2E_BASE_URL     # kit e2e --base-url <url> đặt biến này; playwright.config đọc nó
  cwd: .                       # thư mục chạy lệnh, mặc định gốc repo
  report: e2e/test-results/raw/results.json
```

| TAF lo | Dự án lo |
|---|---|
| Thay `{files}` bằng script của các feature cần chạy (để trống với `all`), `{grep}` bằng `--grep` | Nội dung cấu hình test: Playwright config, `globalSetup`, fixture |
| Chờ địa chỉ app trả lời (`--wait`; mã HTTP < 500, không cần endpoint health); hết giờ → "môi trường không lên", không chạy | App đã deploy / đang chạy ở địa chỉ đó |
| Đặt `<baseUrlEnv>` (= `--base-url`), `TAF_ENV` (= `--env`), `TAF_ROOT`, `PLAYWRIGHT_JSON_OUTPUT_NAME` | Secret, tài khoản, đăng nhập (secret của CI truyền qua `env:` của bước action — tới được lệnh test) |
| Đọc JSON report sau khi chạy | Bật reporter `json` trong lệnh test hoặc trong config |

## 2. Persona trong test case

TC có dòng `persona: sale`. Với TAF đó chỉ là **một cái tên**:

- `testcases.personas` (tuỳ chọn) trỏ tới file liệt kê tên hợp lệ (map YAML thì lấy các khoá, danh sách thì lấy phần tử). `lint-tc` báo lỗi persona lạ.
- Khi sinh script, Claude ánh xạ tên persona sang code theo **hướng dẫn của dự án** (`scripts.guide`), vd "persona X dùng `test.use({ storageState: '.auth/X.json' })`".

## 3. Gợi ý cách dự án tự làm

Không bắt buộc, chỉ là cách đã dùng trong [`examples/project1`](../examples/project1/) và dự kiến cho app-base:

| Việc | Gợi ý |
|---|---|
| Chọn môi trường | `baseURL: process.env.E2E_BASE_URL \|\| "<địa chỉ ở máy>"` trong Playwright config; CI truyền `--base-url` |
| Bí mật | Secret của CI, file `.env.e2e.local` (gitignore) khi chạy local |
| Persona | Khai trong file của dự án (vd `e2e/testdata/personas.yml`). `globalSetup` (`e2e/support/`) tạo tài khoản qua API (nếu cần) và đăng nhập một lần, lưu `e2e/test-results/.auth/<persona>.json` |
| Cách ly giữa các lần chạy | Tuỳ app: DB trắng mỗi lần CI dựng app cho PR, hoặc tenant/workspace riêng cho test, hoặc tiền tố tên dữ liệu |
| Môi trường dùng chung (dev, staging) | Persona cố định có sẵn trên môi trường (mật khẩu ở secret); dữ liệu tạo qua API công khai của app, có tiền tố để dọn ([06](06-test-data.md)) |
| Môi trường production | Không chạy test ghi dữ liệu |

Ví dụ app-base (đa tenant): `globalSetup` đăng nhập tài khoản quản trị nền tảng, tạo tenant `E2E <runId>`, tạo vai trò và tài khoản theo `personas.yml` của app-base, lưu `storageState`. Toàn bộ nằm trong repo app-base.
