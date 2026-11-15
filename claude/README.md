# claude/

Vỏ lệnh và agent Claude Code mà `kit init` cài vào `.claude/` của repo dự án (adapter `claude`,
[`adapters/agent/claude.mjs`](../adapters/agent/claude.mjs)). Mỗi vỏ chỉ kiểm `.ai-kit/` có chưa rồi trỏ tới
`.ai-kit/process/<việc>.md`, và mang dấu `<!-- ai-kit:shell … -->` để `kit init` biết đó là file của kit (làm mới mỗi lần chạy).

| File | Cài tới | Quy trình |
|---|---|---|
| `commands/spec.md` | `.claude/commands/spec.md` | [`process/spec.md`](../process/spec.md) |
| `commands/prototype.md` | `.claude/commands/prototype.md` | [`process/prototype.md`](../process/prototype.md) |
| `commands/dev.md` | `.claude/commands/dev.md` | [`process/dev.md`](../process/dev.md) |
| `commands/testcase.md` | `.claude/commands/testcase.md` | [`process/testcase.md`](../process/testcase.md) |
| `commands/e2e-script.md` | `.claude/commands/e2e-script.md` | [`process/e2e-script.md`](../process/e2e-script.md) |
| `commands/e2e-triage.md` | `.claude/commands/e2e-triage.md` | [`process/e2e-triage.md`](../process/e2e-triage.md) |
| `commands/ship.md` | `.claude/commands/ship.md` | [`process/ship.md`](../process/ship.md) |
| `commands/kit-adopt.md` | `.claude/commands/kit-adopt.md` | [`process/adopt.md`](../process/adopt.md) |
| `agents/spec-reviewer.md` | `.claude/agents/spec-reviewer.md` | [`process/agents/spec-reviewer.md`](../process/agents/spec-reviewer.md) |
| `agents/tester.md` | `.claude/agents/tester.md` | [`process/agents/tester.md`](../process/agents/tester.md) |
| `agents/reviewer.md` | `.claude/agents/reviewer.md` | [`process/agents/reviewer.md`](../process/agents/reviewer.md) |

Repo đã có lệnh cùng tên (không có dấu): `kit init` giữ nguyên (trừ `--force`), `doctor` cảnh báo. Xem [docs/10 §2](../docs/10-quy-trinh.md).
