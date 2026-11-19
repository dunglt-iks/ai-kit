# actions/

| Action | Khi nào | Việc |
|---|---|---|
| [`gate/`](gate/action.yml) | PR mở / cập nhật | `kit gate --pr`: mã feature của PR, spec / test case đã duyệt, phủ đủ, script khớp TC. Comment PR, nhãn chặn. Không chạy test, không cần app |
| [`e2e/`](e2e/action.yml) | Sau deploy dev / staging, hằng đêm, chạy tay | `kit e2e`: chờ app trả lời → chạy test vào `base-url` → báo cáo (step summary, artifact cho `/e2e-triage <run-id>`), tách lỗi dựng dữ liệu, issue theo dõi "E2E `<env>` đang đỏ", đóng bug đã hết. Output `status`: `passed` / `failed` / `gate-failed` / `env-down` / `skipped` |

Cả hai cài kit theo đúng ref của action, không gọi AI, không ghi bug mới, không build hay deploy. Workflow mẫu một file
(PR → gate; deploy xong / hằng đêm → e2e) và bảng input: [docs/04](../docs/04-ci-workflow.md). Repo ai-kit tự kiểm mẫu
bằng [`.github/workflows/sample-e2e.yml`](../.github/workflows/sample-e2e.yml) (dựng `examples/project1` làm môi
trường dev).
