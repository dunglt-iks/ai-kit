# ai-kit — quy trình spec → ship và Test Automation Framework (TAF)

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản | 2.0 |
| Trạng thái | Phát hành v2.0.0 (bản 1.x: nhánh `release/1.x`) |
| Cập nhật lần cuối | 2026-11-15 |
| Áp dụng đầu tiên | `app-base` (ví dụ trong tài liệu) — chuyển sang 2.x ở PR riêng |

> **Ví dụ trong tài liệu:** một số lấy từ `app-base` (mã spec `DL-F05`, `CORE-C10`…), là dự án áp dụng đầu tiên — chỉ là ví dụ. Dự án mẫu chạy được ngay trong repo này là [`examples/project1`](../examples/project1/) (BE Go + FE Next.js, chưa nhúng kit).

## Change Log

| Phiên bản | Ngày | Mô tả thay đổi | Tác giả |
|---|---|---|---|
| 2.0 | 2026-11-15 | ai-kit 2.0.0. Lớp quy trình: `RULES.md`, `process/`, lệnh `/spec /prototype /testcase /e2e-script /e2e-triage /dev /ship /kit-adopt`, agent spec-reviewer (soát spec + đối chiếu prototype, `kit check-prototype`), tester, reviewer; khuôn PRD/FSD/kế hoạch/prototype; hai lớp quy định + khối cầu nối (10). Cấu hình `ai-kit.yml` v2 (`kitRef`, `run.command`), `kit init` chuyển từ `taf.config.yml` v1 (11). Nhúng hai bước: `kit init` (chạy lại được, tự kiểm) + `/kit-adopt`; vỏ lệnh tự clone kit. Duyệt bằng `kit approve` (spec, prototype, test case) + cổng `kit ready`; test case trước code; phát hiện mã trùng. CI là của dự án: điểm cắm `kit e2e` + action `actions/e2e` (04); CI không gọi AI, phân loại và ghi bug ở máy (`/e2e-triage`, 07); phạm vi TAF ba tầng (05). Cấu trúc `e2e/` theo module, báo cáo markdown cho người đọc (`test-results/reports/`), `kit init --migrate` (01 §3.1). Truy vết chặt: duyệt TC ghi `approvedHash`, TC đã duyệt bị sửa bị bắt (lint, gate, plan-gen, check-paths); test bị comment / skip không tính; issue gom theo fingerprint, `--close-fixed` theo đúng test đã fail; triage gắn fingerprint; mục "Test case cần xem lại" (02, 03, 07). BR dùng chung đổi → TC lỗi thời; feature chỉ kiểm ngoài e2e không bị chặn; action không chèn input vào script, không đưa `.auth/` lên artifact, không truyền token cho lệnh test (02, 04). Số chữ số của mã cấu hình được (`spec.codeDigits`: 2 hoặc 3); hết số thì `next-code` cấp thêm một chữ số, không còn cấp trùng (11, 13). Chất lượng e2e: `check-script` bắt test không có `expect`, `test.fail` không link issue, cảnh báo assertion yếu và số `expect` giảm; `changed` chạy kèm smoke (`run.smoke`); báo cáo nêu bước fail (`test.step`) và dữ liệu test dọn lỗi; demo dọn cả dữ liệu tạo qua giao diện (03, 04, 06, 07). Cột "Tầng" (e2e | api) trong TC; `changed` chạy thêm TC P1 của feature khác và feature kéo theo bởi `trigger.featureMap`; `--shard` + `kit report --results … --strict`; lịch sử kết quả, `kit flaky`, cách ly có hạn (`run.quarantine`); cảnh báo / chặn người viết tự duyệt TC (02, 04, 07, 11). Hướng dẫn sử dụng (12), tổ chức tài liệu spec (13), dự án mẫu `examples/project1` (BE Go + FE Next.js, chưa nhúng kit; CI của kit chỉ chạy unit test và setup.sh). Quyết định D1, D3, D4, D6, D8, D10–D14 viết lại; thêm D15–D24 | BA Team |
| 1.3 | 2026-11-08 | v1.0.0: sinh script (03), chạy theo target, báo cáo theo feature, bug theo fingerprint (07), workflow mẫu + `taf init`, dự án mẫu `examples/demo` | BA Team |
| 1.2 | 2026-11-08 | Ranh giới mới: TAF chỉ giữ cơ chế (D10 sửa, thêm D12–D14). Spec adapter nạp theo cấu hình, bộ nhãn TC `vi`/`en`, `run.targets` + `taf run`; bỏ thư viện `lib/`; 01, 04, 05, 06 viết lại | BA Team |
| 1.1 | 2026-11-08 | P0: detect chỉ đọc tiêu đề commit, nhãn `e2e-skip`; specHash đặt trong ngoặc kép | BA Team |
| 1.0 | 2026-11-08 | Khởi tạo tài liệu | BA Team |

---

## Mục tiêu

Bộ công cụ nhúng vào repo bất kỳ, gồm hai phần:

1. **Quy trình** làm phần mềm cùng AI: **spec → prototype → dev → test → ship**, với tài liệu spec có mã truy vết,
   duyệt theo từng mã, kế hoạch, review ([10](10-quy-trinh.md)).
2. **TAF** — tự động hoá chuỗi **spec → test case → test script → chạy → ghi bug → báo cáo** (01–07).

Kit nằm ở repo riêng [`dunglt-iks/ai-kit`](https://github.com/dunglt-iks/ai-kit), dự án gắn vào `.ai-kit/` theo tag
(`kitRef`), cấu hình qua một file `ai-kit.yml` ([11](11-cau-hinh.md)), cắm vào CI của mình bằng `kit e2e` ([04](04-ci-workflow.md)).

```
Spec (qua spec adapter)
  │ /testcase <mã> (ở máy)                               ← Claude sinh, người review duyệt
  ▼
Test case markdown (testcases.dir)
  │ /e2e-script <mã> (ở máy)                             ← Claude sinh, chạy thử
  ▼
Script Playwright (scripts.dir)                          ← push, mở PR
  │ CI của dự án dựng app, rồi gọi kit e2e (không AI)
  ▼
mã feature của PR → gate (TC + script) → chạy run.command vào app → báo cáo
  │ test fail (máy hoặc CI)
  ▼
/e2e-triage (ở máy) → sửa script / bug app → issue → /dev #<issue>
```

## Quyết định đã chốt

| # | Nội dung |
|---|---|
| D1 | Kit ở **repo riêng** `ai-kit`. Dự án thêm `ai-kit.yml`, thư mục `e2e/` (TC, script, page object), vỏ lệnh AI; cắm vào CI của mình bằng `kit e2e` nếu muốn. |
| D2 | **Claude luôn chạy trong repo ứng dụng.** Kit chỉ cung cấp quy trình, prompt, CLI và action, không chứa code của dự án. |
| D3 | Script Playwright do AI sinh từ test case, **ở máy** (`/e2e-script`), **chỉ sinh lại khi test case đổi**. |
| D4 | Test case sinh bằng lệnh **`/testcase` ở máy**; người duyệt bằng `kit approve <mã> --testcase`. |
| D5 | Nhận diện tính năng của PR qua **mã feature trong tiêu đề, nhánh hoặc tiêu đề commit**, và (tuỳ chọn) qua **dòng của status file đổi sang trạng thái xong**. |
| D6 | PR có tính năng mới mà thiếu test case đã duyệt (hoặc script khớp TC) thì **chặn mềm**: check đỏ, comment, nhãn `e2e-blocked`. Lý do: repo private gói Free không có branch protection. |
| D7 | Bug ghi vào **GitHub Issues**, kèm comment tổng hợp trên PR. |
| D8 | **CI không gọi AI.** Test case, script, phân loại test fail làm ở máy (`/testcase`, `/e2e-script`, `/e2e-triage`) trước khi push. Trên CI kit chỉ gate, chạy, báo cáo, đóng bug đã hết; test fail chưa phân loại không thành bug, bug ghi từ máy sau khi người dùng đồng ý. Lý do: thấy và sửa mọi thứ AI làm trước khi lên GitHub, không có commit của bot, không tốn hạn mức AI trên CI. |
| D9 | Script dùng **page object và fixture của dự án**, theo hướng dẫn viết test của dự án (`scripts.guide`). Locator chỉ nằm trong page object. |
| D10 | **TAF không lo app, môi trường, tài khoản, vai trò, persona, dữ liệu test.** CI của dự án dựng / tắt app; bộ khung test của dự án (`globalSetup`, fixture) lo dữ liệu nền, persona, dựng / dọn dữ liệu từng test — script AI sinh chỉ gọi fixture. Kit chọn test, chạy vào địa chỉ app, gom kết quả theo mã, gate, báo cáo, bug ([05 §1](05-environments.md)). |
| D11 | **Claude không được sửa bất kỳ file code nào của ứng dụng** khi làm test case / script / triage, kể cả thêm `data-testid`. Chỉ ghi vào TC và thư mục test được phép, có cưỡng chế bằng kiểm tra diff ([03 §5](03-script-generation.md)). |
| D12 | **Kit không sở hữu CI/CD.** Kit cung cấp một điểm cắm: lệnh `kit e2e` (phạm vi `none` / `changed` / `all` / mã, `--base-url`, `--env`…) và action `actions/e2e` bọc lệnh đó. Dự án gọi sau bước dựng app của mình; kit không chép, không sửa workflow, không deploy ([04](04-ci-workflow.md)). |
| D13 | Mọi thứ riêng của dự án đi qua **điểm cắm** trong `ai-kit.yml`: spec adapter, bộ nhãn TC, hướng dẫn viết test, lệnh chạy test, tracker adapter ([01 §2](01-architecture.md)). |
| D14 | Hoàn thiện kit trên **dự án mẫu trong repo này** (nay `examples/project1`; unit test dùng dữ liệu ở `test/fixtures/demo`), rồi mới áp dụng vào app-base. |
| D15 | **Hai lớp quy định:** kỹ thuật là của repo (`guides`), quy trình là của kit. Kit không viết đè hướng dẫn của repo, chỉ chèn một khối có đánh dấu. Mâu thuẫn thì AI dừng hỏi ([10 §1](10-quy-trinh.md)). |
| D16 | Quy trình viết **trung tính** (không stack, không mã hay đường dẫn của một dự án), test chặn chuỗi riêng dự án. Prompt tiếng Việt; ngôn ngữ đầu ra theo `language`. |
| D17 | Lệnh AI cài vào dự án là **vỏ lệnh** trỏ tới `.ai-kit/process/` — đổi phiên bản kit là đổi quy trình. Vỏ có dấu `ai-kit:shell`; lệnh riêng của repo không bị ghi đè. Máy chưa có kit thì vỏ tự clone theo `kitRef`. |
| D18 | **Một file cấu hình** `ai-kit.yml` (version 2) cho cả quy trình và TAF; `kit init` chuyển được từ `taf.config.yml` v1. Đổi định dạng không tương thích → tăng phiên bản chính. |
| D19 | Mô hình spec mặc định là **PRD/FSD** (adapter `prd-fsd`), đường dẫn, mẫu mã, chữ trạng thái cấu hình được. Cấp mã bằng `kit next-code`. |
| D20 | **Người duyệt bằng lệnh** `kit approve` (spec, prototype, test case), lệnh ghi người + ngày; AI chỉ được đặt nháp. `/testcase`, `/e2e-script`, `/dev` chỉ chạy khi `kit ready` qua (spec + prototype đã duyệt, prototype còn khớp màn hình). |
| D21 | **Test case trước code:** spec + prototype duyệt → `/testcase` → `/e2e-script` → `/dev`. Lệnh code `/dev` nhận cả việc nhỏ và issue bug. |
| D22 | **Đối chiếu spec ↔ prototype** chia hai: phần tất định là lệnh `kit check-prototype` (mỗi `SCR` có `<section id>`, mỗi thành phần đánh số có `data-ref`, không thừa); phần cần đọc hiểu (nhãn, quy tắc hiển thị, luồng bấm được, không tự thêm nghiệp vụ) giao agent `spec-reviewer`, vì cùng thời điểm (trước khi duyệt) và cùng đầu vào. `/prototype` chạy cả hai sau mỗi lần dựng. |
| D23 | **Nhúng kit hai bước:** clone kit + `kit init` (chạy lại được, tự kiểm, không đụng `.github/`), rồi `/kit-adopt`. Đồng đội không cài gì; nâng cấp = đổi `kitRef` rồi `kit init`. |
| D24 | **Cấu trúc `e2e/` theo module:** `testcases/<MOD>/`, `scripts/<MOD>/`, `pages/<MOD>/` (+ `common/`), `tests/` (viết tay), `support/` (khung test), `testdata/`; mọi thứ sinh ra trong `test-results/` (`reports/` markdown cho người đọc, `playwright/`, `.auth/`, `raw/` JSON). `<MOD>` = mã module. `ai-kit.yml`, `playwright.config.mjs` ở gốc repo. Kit bắt buộc phần nó đọc / ghi (TC, script, kết quả); phần còn lại là khuyến nghị. Script phẳng kiểu cũ → `kit init --migrate` ([01 §3.1](01-architecture.md)). |

## Mục lục

| File | Nội dung |
|---|---|
| [01-architecture.md](01-architecture.md) | Kiến trúc, phân chia repo, phần TAF của `ai-kit.yml` |
| [02-testcase-format.md](02-testcase-format.md) | Định dạng test case markdown, quy tắc phủ, quy trình duyệt |
| [03-script-generation.md](03-script-generation.md) | Sinh script ở máy (`/e2e-script`): khi nào sinh, luật của script, phạm vi file AI được ghi |
| [04-ci-workflow.md](04-ci-workflow.md) | Cắm kit vào CI: `kit e2e`, action `e2e`, đoạn mẫu, người / AI / CI làm gì |
| [05-environments.md](05-environments.md) | Phạm vi TAF ba tầng (CI dự án / khung test dự án / kit); môi trường, persona |
| [06-test-data.md](06-test-data.md) | Test data: nguyên tắc cho fixture của dự án |
| [07-bug-reporting.md](07-bug-reporting.md) | Triage, ghi bug, báo cáo |
| [08-roadmap.md](08-roadmap.md) | Lộ trình, rủi ro, điểm còn mở |
| [09-playwright-primer.md](09-playwright-primer.md) | Playwright cho người mới |
| [10-quy-trinh.md](10-quy-trinh.md) | Quy trình spec → ship, hai lớp quy định, khối cầu nối, áp dụng vào repo |
| [11-cau-hinh.md](11-cau-hinh.md) | `ai-kit.yml` (lớp quy trình), chuyển từ 1.x, lệnh `kit` |
| [12-user-guide.md](12-user-guide.md) | Hướng dẫn sử dụng: nhúng kit vào `examples/project1` (Go + Next.js) và làm chức năng quên mật khẩu / đăng ký theo quy trình |
| [13-tai-lieu-spec.md](13-tai-lieu-spec.md) | Tổ chức tài liệu spec cho người viết: cây thư mục, mã, PRD, FSD, ví dụ hoàn chỉnh, vòng đời, lỗi hay gặp |

## Thuật ngữ

| Từ | Nghĩa |
|---|---|
| TC | Test case markdown, mã `TC-<FEATURE>-###` |
| Script | File Playwright sinh từ TC, mặc định `e2e/scripts/<MOD>/<MÃ>.spec.mjs` |
| Page object | Class bọc locator và thao tác của **một màn hình** (`SCR`) |
| Persona | Vai trò test có tên (`sale`, `sales-manager`…) |
| Gate | Bước kiểm tra TC đủ điều kiện trước khi chạy |
| Triage | Phân loại lỗi: bug ứng dụng / lỗi script / môi trường / flaky |
| Guides | File hướng dẫn AI của repo (CLAUDE.md, AGENTS.md…) — lớp kỹ thuật |
| Khối cầu nối | Đoạn `ai-kit:start/end` kit chèn vào file hướng dẫn của repo |
| Module | Nhóm chức năng có mã 2–4 chữ hoa (`DM`), một thư mục PRD + FSD |
