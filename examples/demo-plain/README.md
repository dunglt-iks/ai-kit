# Dự án mẫu chưa nhúng ai-kit

Bản sao của [`../demo`](../demo/) ở trạng thái **trước khi nhúng ai-kit**, để thực hành `kit init` từ đầu. Có sẵn:
app, spec (DM-F01, DM-F02 đã duyệt), hướng dẫn AI về kỹ thuật (`CLAUDE.md`), Playwright, persona, page object, một
test viết tay. Chưa có: `ai-kit.yml`, `.claude/`, test case, script sinh.

| Thành phần | File |
|---|---|
| App | `app/server.mjs`, `app/pages/*.html` |
| Spec | `docs/features/addon/DM-demo/PRD-demo.md`, `FSD-demo.md` |
| Hướng dẫn AI (lớp kỹ thuật) | `CLAUDE.md` |
| Dựng app tạm | `ci/app-up.sh`, `ci/app-down.sh` |
| Playwright, persona, đăng nhập | `playwright.config.mjs`, `e2e/personas.yml`, `e2e/global-setup.mjs` |
| Fixture, page object, hướng dẫn viết test | `e2e/fixtures.mjs`, `e2e/pages/`, `e2e/GUIDE.md` |
| Test viết tay | `e2e/smoke.spec.mjs` |

## Thực hành

Hướng dẫn đầy đủ từng bước: [docs/12-user-guide.md](../../docs/12-user-guide.md). Tóm tắt:

```bash
cd examples/demo-plain
npm ci && npx playwright install chromium
ln -s ../.. .ai-kit                         # dự án thật: git clone -b v2 …/ai-kit .ai-kit
node .ai-kit/cli/bin/kit.mjs init --dry-run # xem trước
node .ai-kit/cli/bin/kit.mjs init
```

Rồi mở Claude Code trong thư mục này: `/kit-adopt` → duyệt đề xuất `ai-kit.yml` → `kit doctor` → `/testcase DM-F01`
… Đối chiếu kết quả với [`../demo`](../demo/) (bản đã nhúng). Làm lại từ đầu: `git clean -fdx . && git checkout .`
trong thư mục này.
