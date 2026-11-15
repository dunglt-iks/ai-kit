# actions/

| Action | Việc |
|---|---|
| [`e2e/`](e2e/action.yml) | Điểm cắm của ai-kit vào CI GitHub của dự án: cài kit theo ref của action, gọi `kit e2e` với `scope` (none / changed / all / mã), `base-url`, `env`, `grep`, `gate`, `close-fixed`, `fail-on`; comment PR, nhãn chặn, upload kết quả làm artifact (cho `/e2e-triage <run-id>`) |

Dự án gọi `uses: dunglt-iks/ai-kit/actions/e2e@<kitRef>` **sau** bước dựng app của mình (khi chạy test), với
`actions/checkout` có `fetch-depth: 0` (kit đọc commit của PR để lấy mã feature). Action không gọi AI và không ghi bug
mới. Hướng dẫn và đoạn mẫu: [docs/04](../docs/04-ci-workflow.md). Ví dụ chạy thật:
[`.github/workflows/demo-e2e-spec.yml`](../.github/workflows/demo-e2e-spec.yml).
