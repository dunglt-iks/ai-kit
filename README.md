# ai-kit

Bộ công cụ nhúng vào repo bất kỳ để làm phần mềm cùng AI theo một quy trình: **spec → prototype → dev → test → ship**,
kèm **TAF** (Test Automation Framework) cho e2e: spec → test case markdown → script Playwright → chạy (ở máy và trong CI
của dự án) → báo cáo → bug.

> Trạng thái: **v3.0.0** — kit phân phối thành gói npm (cài từ git tag) + plugin Claude Code `kit`. Tài liệu thiết
> kế: [`docs/`](docs/README.md). Dự án mẫu để demo: [`examples/project1`](examples/project1/).

## Quy trình

```
/kit:spec ─► /kit:prototype ─► kit approve ─► /kit:testcase ─► kit approve --testcase
PRD/FSD      HTML tĩnh          người duyệt    TC markdown       người duyệt TC
(spec-reviewer soát spec + đối chiếu prototype)
        ─► /kit:e2e-script ─► /kit:dev ─► /kit:ship
           script             code        PR (tester → reviewer)

CI của dự án (tuỳ chọn, không AI): PR → kit gate --pr (tuân thủ: mã, duyệt, TC, script) ; deploy dev xong / hằng đêm
                                   → kit e2e all (chờ app → chạy → báo cáo → issue theo dõi môi trường)
test fail (máy hoặc CI) → /kit:e2e-triage ở máy → sửa script / ghi bug   ;   bug → /kit:dev #<issue>
```

Chi tiết: [docs/10](docs/10-quy-trinh.md). Quy tắc AI phải theo: [`RULES.md`](RULES.md). Thực hành từng bước: [docs/12](docs/12-user-guide.md).

## Hai lớp quy định

Repo thường đã có hướng dẫn cho AI (CLAUDE.md, AGENTS.md…) về **kỹ thuật**. Kit chỉ mang **quy trình**:

| Lớp | Gồm | Ở đâu |
|---|---|---|
| Kỹ thuật — code thế nào | stack, framework, chia lớp, lint, bảo mật, test đơn vị | file hướng dẫn của repo (`guides`), kit không sửa |
| Quy trình — đi đường nào | spec, mã, duyệt, version, kế hoạch, TC/e2e, truy vết, PR | gói `ai-kit` + plugin `kit` + `ai-kit.yml` |

`kit init` dò file hướng dẫn sẵn có, chèn một khối nhỏ `ai-kit:start/end` để nối hai lớp. Đụng nhau: code thế nào theo
repo; quy trình theo kit; mâu thuẫn thật thì AI dừng hỏi.

## Áp dụng cho một repo

Kit có ba kênh, cùng một tag phát hành (`v3.0.0`, tag nổi `v3`):

| Kênh | Cho ai | Cài thế nào |
|---|---|---|
| Gói npm `ai-kit` (CLI `kit`, quy trình, prompt, khuôn) | người, AI, CI không dùng GitHub | `devDependencies` của dự án, lấy từ git tag; lockfile ghim commit |
| Plugin Claude Code `kit` (`/kit:spec`…, agent, hook chặn AI chạy `kit approve`) | Claude Code | `claude plugin install`; `kit init` khai marketplace ghim đúng tag |
| `actions/gate`, `actions/e2e` | CI GitHub của dự án | `uses: dunglt-iks/ai-kit/actions/<tên>@v3.0.0` |

```bash
npm install -D github:dunglt-iks/ai-kit#v3.0.0
npx kit init                                      # ai-kit.yml, .claude/settings.json, khối cầu nối, .gitignore
claude plugin install kit@ai-kit --scope project  # mở Claude Code ở repo, chấp nhận tin cậy thư mục trước
```

`kit init` tạo `ai-kit.yml`, ghi vào `.claude/settings.json` (marketplace `ai-kit` ghim tag của gói đang cài, bật plugin
`kit`, luật deny `kit approve`), chèn khối cầu nối vào `CLAUDE.md`, thêm `.gitignore`, rồi tự kiểm. Sau đó trong Claude
Code chạy **`/kit:adopt`**: AI đề xuất giá trị `ai-kit.yml` theo repo và chỉ chỗ hướng dẫn của repo mâu thuẫn với kit
→ bạn duyệt → commit (`ai-kit.yml`, `.claude/settings.json`, `CLAUDE.md`, `.gitignore`, `package.json` + lockfile).

- **Đồng đội:** `npm install` (có gói kit) + `claude plugin install kit@ai-kit --scope project` một lần mỗi bản clone.
- **Nâng cấp:** `npm install -D github:dunglt-iks/ai-kit#<tag mới>` → `npx kit init` (đổi `ref` của plugin cho khớp) →
  đổi `@<tag>` của action trong CI.
- **CI (tuỳ chọn):** chép workflow mẫu một file ở [docs/04 §4](docs/04-ci-workflow.md): PR → `actions/gate`; deploy
  dev xong / hằng đêm → `actions/e2e` vào địa chỉ đã deploy. Build, deploy vẫn là workflow của dự án; kit không sửa
  workflow, không dựng app, không gọi AI trên CI.
- **Phiên Claude Code trên cloud** (claude.ai/code) không nạp plugin khai trong repo — chỉ plugin do tổ chức quản lý
  (managed settings). Dùng kit ở máy, hoặc nhờ quản trị bật plugin cho tổ chức.

## Cấu trúc repo

| Thư mục | Nội dung |
|---|---|
| [`RULES.md`](RULES.md), [`process/`](process/README.md) | Quy tắc và quy trình từng bước cho AI (spec, prototype, testcase, e2e-script, e2e-triage, dev, ship, adopt; agent spec-reviewer, tester, reviewer) |
| [`plugin/`](plugin/), [`.claude-plugin/`](.claude-plugin/marketplace.json) | Plugin Claude Code `kit` (skill `/kit:*`, agent, hook chặn AI tự duyệt) và marketplace `ai-kit`. Plugin mỏng: trỏ tới `process/` của gói đã cài trong dự án |
| [`cli/`](cli/README.md) | Lệnh `kit`: init, doctor, context, approve, ready, next-code, e2e + lệnh TAF |
| [`templates/`](templates/README.md) | `ai-kit.yml`, khuôn PRD/FSD/kế hoạch/prototype, mẫu test case |
| [`adapters/`](adapters/README.md) | Spec (`prd-fsd`), tracker (`github`), agent (`claude`). Dự án viết adapter spec / tracker riêng được |
| [`actions/`](actions/README.md) | Action `gate`, `e2e`: điểm cắm của kit vào CI GitHub của dự án (không AI) |
| [`prompts/`](prompts/README.md) | Prompt TAF chạy ở máy: sinh TC, sinh script, triage |
| [`docs/`](docs/README.md) | Tài liệu thiết kế |
| [`cli/test/`](cli/test/) | Unit test của kit (`npm test`) — dự án giả ở `cli/test/fixtures/` |
| [`examples/project1/`](examples/project1/) | Dự án mẫu BE Go + FE Next.js (đăng nhập JWT), chưa nhúng kit — để demo / thực hành ([docs/12](docs/12-user-guide.md)) |

## Nguyên tắc

1. **Kit chỉ giữ cơ chế và quy trình.** Stack, CI/CD, dựng app, tài khoản, dữ liệu test, page object là của dự án; mọi thứ riêng đi qua `ai-kit.yml` hoặc adapter.
2. **AI luôn chạy trong repo dự án**; kit cung cấp quy trình, prompt, CLI, action.
3. **Bước quyết định là code tất định** (cấp mã, trạng thái duyệt, gate, chọn test, ghi bug, chèn khối cầu nối). AI phỏng vấn, viết tài liệu, code, test, review.
4. **Test theo spec, không theo hành vi hiện tại của code.** Ở phần TAF, AI không sửa code ứng dụng.
5. **Người duyệt** spec, prototype, test case bằng `kit approve` (ghi người, ngày), và kế hoạch; AI chỉ đặt nháp, không commit/push khi chưa được xác nhận. AI bị chặn chạy `kit approve` bằng luật deny + hook của plugin — nhưng trạng thái duyệt vẫn là chữ trong file: muốn chắc thì đặt CODEOWNERS cho thư mục spec và test case ([docs/10](docs/10-quy-trinh.md)).
