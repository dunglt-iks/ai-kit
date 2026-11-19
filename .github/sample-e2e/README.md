# Lớp phủ cho `examples/project1` trên CI của kit

Workflow `.github/workflows/sample-e2e.yml` chép thư mục này đè lên `examples/project1` (bản trên máy CI, không commit)
để kiểm workflow mẫu ở [docs/04](../../docs/04-ci-workflow.md): `actions/gate`, `actions/e2e` khi môi trường không
lên, rồi khi project1 đã dựng (đóng vai môi trường dev). Không phải hướng dẫn nhúng kit — cấu hình thật do `kit init` +
`/kit-adopt` tạo.
