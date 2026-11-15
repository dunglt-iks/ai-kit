# ai-kit

Bộ công cụ nhúng vào repo bất kỳ để làm phần mềm cùng AI theo một quy trình: **spec → prototype → dev → test → ship**,
kèm **TAF** (Test Automation Framework) cho e2e: spec → test case markdown → script Playwright → chạy (ở máy và trong CI
của dự án) → báo cáo → bug.

> Trạng thái: **v2.0.0**. Bản TAF 1.x ở nhánh [`release/1.x`](https://github.com/dunglt-iks/ai-kit/tree/release/1.x)
> (sửa lỗi cắt tag `v1.0.x`). Tài liệu thiết kế: [`docs/`](docs/README.md). Dự án mẫu chạy trên CI:
> [`examples/demo`](examples/demo/).

## Quy trình

```
/spec ─► /prototype ─► kit approve ─► /testcase ─► kit approve --testcase ─► /e2e-script ─► /dev ─► /ship
PRD/FSD   HTML tĩnh      người duyệt     TC markdown   người duyệt TC              script        code    PR
(spec-reviewer soát spec + đối chiếu prototype)                                                (tester → reviewer)

CI của dự án (tuỳ chọn, không AI): dựng app → kit e2e → gate (TC + script) → chạy → báo cáo
test fail (máy hoặc CI) → /e2e-triage ở máy → sửa script / ghi bug   ;   bug → /dev #<issue>
```

Chi tiết: [docs/10](docs/10-quy-trinh.md). Quy tắc AI phải theo: [`RULES.md`](RULES.md). Thực hành từng bước: [docs/12](docs/12-user-guide.md).

## Hai lớp quy định

Repo thường đã có hướng dẫn cho AI (CLAUDE.md, AGENTS.md…) về **kỹ thuật**. Kit chỉ mang **quy trình**:

| Lớp | Gồm | Ở đâu |
|---|---|---|
| Kỹ thuật — code thế nào | stack, framework, chia lớp, lint, bảo mật, test đơn vị | file hướng dẫn của repo (`guides`), kit không sửa |
| Quy trình — đi đường nào | spec, mã, duyệt, version, kế hoạch, TC/e2e, truy vết, PR | `.ai-kit/` + `ai-kit.yml` |

`kit init` dò file hướng dẫn sẵn có, chèn một khối nhỏ `ai-kit:start/end` để nối hai lớp. Đụng nhau: code thế nào theo
repo; quy trình theo kit; mâu thuẫn thật thì AI dừng hỏi.

## Áp dụng cho một repo

```bash
git clone --depth 1 -b v2 https://github.com/dunglt-iks/ai-kit .ai-kit && node .ai-kit/cli/bin/kit.mjs init
```

`kit init` tạo `ai-kit.yml`, cài lệnh `/spec … /ship` và agent vào `.claude/`, chèn khối cầu nối, thêm `.gitignore`,
rồi tự kiểm. Sau đó trong Claude Code chạy **`/kit-adopt`**: AI đề xuất giá trị `ai-kit.yml` theo repo và chỉ chỗ hướng
dẫn của repo mâu thuẫn với kit → bạn duyệt → commit.

- **Đồng đội:** không cài gì — lệnh đầu tiên tự clone kit theo `kitRef` trong `ai-kit.yml`.
- **Nâng cấp:** đổi `kitRef` → `kit init`.
- **CI (tuỳ chọn):** thêm một bước `uses: dunglt-iks/ai-kit/actions/e2e@v2` vào workflow của dự án, sau bước dựng app
  ([docs/04](docs/04-ci-workflow.md)). Kit không sửa workflow, không dựng app, không gọi AI trên CI.
- **Đang dùng TAF 1.x:** `kit init` tạo `ai-kit.yml` từ `e2e/taf.config.yml` ([docs/11 §3](docs/11-cau-hinh.md)).

## Cấu trúc repo

| Thư mục | Nội dung |
|---|---|
| [`RULES.md`](RULES.md), [`process/`](process/README.md) | Quy tắc và quy trình từng bước cho AI (spec, prototype, testcase, e2e-script, e2e-triage, dev, ship, adopt; agent spec-reviewer, tester, reviewer) |
| [`claude/`](claude/README.md) | Vỏ lệnh/agent Claude Code mà `kit init` cài vào `.claude/` |
| [`cli/`](cli/README.md) | Lệnh `kit`: init, doctor, context, approve, ready, next-code, e2e + lệnh TAF |
| [`templates/`](templates/README.md) | `ai-kit.yml`, khuôn PRD/FSD/kế hoạch/prototype, mẫu test case |
| [`adapters/`](adapters/README.md) | Spec (`prd-fsd`), tracker (`github`), agent (`claude`, `agents-md`). Dự án viết adapter riêng được |
| [`actions/`](actions/README.md) | Action `e2e`: điểm cắm của kit vào CI GitHub của dự án (không AI) |
| [`prompts/`](prompts/README.md) | Prompt TAF chạy ở máy: sinh TC, sinh script, triage |
| [`docs/`](docs/README.md) | Tài liệu thiết kế |
| [`test/`](test/) | Unit test (`npm test`) |
| [`examples/demo/`](examples/demo/) | Dự án mẫu đã nhúng kit, chạy đủ luồng TAF trên CI |
| [`examples/demo-plain/`](examples/demo-plain/) | Cùng app, chưa nhúng kit — để thực hành ([docs/12](docs/12-user-guide.md)) |

## Nguyên tắc

1. **Kit chỉ giữ cơ chế và quy trình.** Stack, CI/CD, dựng app, tài khoản, dữ liệu test, page object là của dự án; mọi thứ riêng đi qua `ai-kit.yml` hoặc adapter.
2. **AI luôn chạy trong repo dự án**; kit cung cấp quy trình, prompt, CLI, action.
3. **Bước quyết định là code tất định** (cấp mã, trạng thái duyệt, gate, chọn test, ghi bug, chèn khối cầu nối). AI phỏng vấn, viết tài liệu, code, test, review.
4. **Test theo spec, không theo hành vi hiện tại của code.** Ở phần TAF, AI không sửa code ứng dụng.
5. **Người duyệt** spec, prototype, test case bằng `kit approve` (ghi người, ngày), và kế hoạch; AI chỉ đặt nháp, không commit/push khi chưa được xác nhận.
