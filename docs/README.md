# ai-kit — quy trình spec → ship và Test Automation Framework (TAF)

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản | 3.2 |
| Trạng thái | Chuẩn bị phát hành v3.0.0 (chưa gắn tag) |
| Cập nhật lần cuối | 2026-11-28 |
| Áp dụng đầu tiên | `app-base` (ví dụ trong tài liệu) — áp dụng 3.x ở PR riêng |

> **Ví dụ trong tài liệu:** một số lấy từ `app-base` (mã spec `DL-F05`, `CORE-C10`…), là dự án áp dụng đầu tiên — chỉ là ví dụ. Dự án mẫu chạy được ngay trong repo này là [`examples/project1`](../examples/project1/) (BE Go + FE Next.js, chưa nhúng kit).

## Change Log

| Phiên bản | Ngày | Mô tả thay đổi | Tác giả |
|---|---|---|---|
| 3.2 | 2026-11-28 | Nâng từ 2.x: `kit init` gỡ vỏ lệnh / agent có dấu `ai-kit:shell` và khối ai-kit trong `AGENTS.md`, bỏ qua `agents-md` (doctor nhắc xoá; trước đó `kit init` lỗi); doctor báo `.ai-kit/` còn sót. Khoá `plugin` (`pin` · `keep` · `managed`): giữ marketplace đã khai để thử plugin từ fork / nhánh, hoặc để tổ chức bật plugin — kit chỉ ghi deny. Gộp ai-kit 2.0.1 (`expect.poll`). Sửa 11, 14 (thêm C6, C7). | BA Team |
| 3.1 | 2026-11-23 | Thêm 14 — hướng dẫn dùng gói `ai-kit` + plugin `kit` cho hai trường hợp: tích hợp vào dự án đang có (soát `/kit:adopt`, áp dụng dần cho tài liệu và test cũ, `trigger.codePaths` lúc mới áp dụng) và dự án mới (spec trước, dựng khung, guides, khung e2e); phần dùng chung: một vòng feature, đồng đội, nâng cấp (cập nhật plugin), CI, sự cố hay gặp. | BA Team |
| 3.0 | 2026-11-21 | ai-kit 3.0.0 — đổi cách phân phối, không giữ tương thích 2.x (chưa có dự án dùng). Kit là **gói npm** cài từ git tag (`devDependencies`, lockfile ghim commit; `files` chỉ mang CLI, quy trình, prompt, khuôn, docs) + **plugin Claude Code `kit`** (`plugin/`, marketplace `.claude-plugin/`): skill `/kit:spec` … `/kit:adopt` (tên lệnh đổi từ `/spec`…), agent, hook `PreToolUse` chặn AI chạy `kit approve`. Plugin mỏng, trỏ tới `process/` của gói đã cài (`<kit>` = dòng `Kit` của `kit context`). `kit init` ghi `.claude/settings.json` (marketplace ghim tag của gói, bật plugin, deny) thay cho vỏ lệnh; doctor báo plugin lệch tag / bị tắt, thiếu gói trong devDependencies. Bỏ `.ai-kit/`, `kitRef`, `setup.sh`, dấu `ai-kit:shell`, `--force`; bỏ adapter `agents-md` (giữ lớp adapter cho công cụ khác sau này); bỏ đọc `taf.config.yml` 1.x, `kit init --migrate`, nhánh `release/1.x`. Node ≥ 22 (`npm test` chạy được trên Node 22+). Workflow mẫu: `persist-credentials: false`, cảnh báo `pull_request_target`, ghim `@v3.0.0`. Sửa 01, 04, 08, 10, 11, 12; D1, D17, D18, D23, D24 viết lại, thêm D27. | BA Team |
| 2.2 | 2026-11-26 | ai-kit 2.0.1: `check-script` đếm cả `expect.poll(…)` (kể cả `expect` xuống dòng rồi `.poll`) là assertion — trước đó test chỉ dùng `expect.poll` bị báo "không có expect nào" và gate đỏ (phát hiện khi áp vào app-base). | BA Team |
| 2.1 | 2026-11-18 | Phát hành cùng ai-kit 2.0.0 (tag `v2.0.0`, `v2`). Hai điểm cắm CI: PR → `kit gate --pr` / `actions/gate` (tuân thủ, không chạy test); sau deploy / hằng đêm → `kit e2e` / `actions/e2e` (mặc định `all`, `env: dev`). Bỏ phạm vi `none`. `kit e2e` chờ app trả lời trước khi chạy (`--wait`, mã < 500, app không cần endpoint health), hết giờ → `env-down`, không chạy, không tính test fail; output `status`. Issue theo dõi môi trường (`--track`, `tracker.trackLabel`): mở / cập nhật / đóng. Lỗi dựng dữ liệu tách khỏi lỗi feature (`run.setupPaths`). `check-script` chặn script gọi API ghi trực tiếp (trừ TC tầng `api`); `e2e/support/**` vào `scripts.allowedPaths` mặc định (fixture mới, người duyệt). Workflow mẫu một file (04 §4), repo kit tự kiểm bằng `sample-e2e.yml` + unit test đối chiếu input. Nguyên tắc dựng dữ liệu: API công khai của app trước, API test sau (06). Sửa 03, 04, 05, 06, 07, 11; D12 viết lại, thêm D25–D26 `kit check-paths --triage`: triage không tự sửa fixture (03, 07). `examples/project1` có CI riêng (`ci.yml`, `deploy-dev.yml` + `compose.dev.yml`, runner tự host); 12 Phần C: thực hành thêm `ai-kit.yml` sau khi nhúng kit, đối chiếu đề xuất của `/kit-adopt`. | BA Team |
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

Kit nằm ở repo riêng [`dunglt-iks/ai-kit`](https://github.com/dunglt-iks/ai-kit). Dự án cài gói `ai-kit` từ git tag
(devDependencies) và plugin Claude Code `kit` cùng tag ([10 §2](10-quy-trinh.md)), cấu hình qua một file `ai-kit.yml`
([11](11-cau-hinh.md)), cắm vào CI của mình bằng `kit gate` / `kit e2e` ([04](04-ci-workflow.md)).

```
Spec (qua spec adapter)
  │ /kit:testcase <mã> (ở máy)                               ← Claude sinh, người review duyệt
  ▼
Test case markdown (testcases.dir)
  │ /kit:e2e-script <mã> (ở máy)                             ← Claude sinh, chạy thử
  ▼
Script Playwright (scripts.dir)                          ← push, mở PR
  │ CI của dự án dựng app, rồi gọi kit e2e (không AI)
  ▼
mã feature của PR → gate (TC + script) → chạy run.command vào app → báo cáo
  │ test fail (máy hoặc CI)
  ▼
/kit:e2e-triage (ở máy) → sửa script / bug app → issue → /kit:dev #<issue>
```

## Quyết định đã chốt

| # | Nội dung |
|---|---|
| D1 | Kit ở **repo riêng** `ai-kit`. Dự án thêm gói `ai-kit` (devDependencies), `ai-kit.yml`, thư mục `e2e/` (TC, script, page object), plugin `kit` cho Claude Code; cắm vào CI của mình bằng `kit e2e` nếu muốn. |
| D2 | **Claude luôn chạy trong repo ứng dụng.** Kit chỉ cung cấp quy trình, prompt, CLI và action, không chứa code của dự án. |
| D3 | Script Playwright do AI sinh từ test case, **ở máy** (`/kit:e2e-script`), **chỉ sinh lại khi test case đổi**. |
| D4 | Test case sinh bằng lệnh **`/kit:testcase` ở máy**; người duyệt bằng `kit approve <mã> --testcase`. |
| D5 | Nhận diện tính năng của PR qua **mã feature trong tiêu đề, nhánh hoặc tiêu đề commit**, và (tuỳ chọn) qua **dòng của status file đổi sang trạng thái xong**. |
| D6 | PR có tính năng mới mà thiếu test case đã duyệt (hoặc script khớp TC) thì **chặn mềm**: check đỏ, comment, nhãn `e2e-blocked`. Lý do: repo private gói Free không có branch protection. |
| D7 | Bug ghi vào **GitHub Issues**, kèm comment tổng hợp trên PR. |
| D8 | **CI không gọi AI.** Test case, script, phân loại test fail làm ở máy (`/kit:testcase`, `/kit:e2e-script`, `/kit:e2e-triage`) trước khi push. Trên CI kit chỉ gate, chạy, báo cáo, đóng bug đã hết; test fail chưa phân loại không thành bug, bug ghi từ máy sau khi người dùng đồng ý. Lý do: thấy và sửa mọi thứ AI làm trước khi lên GitHub, không có commit của bot, không tốn hạn mức AI trên CI. |
| D9 | Script dùng **page object và fixture của dự án**, theo hướng dẫn viết test của dự án (`scripts.guide`). Locator chỉ nằm trong page object. |
| D10 | **TAF không lo app, môi trường, tài khoản, vai trò, persona, dữ liệu test.** CI của dự án dựng / tắt app; bộ khung test của dự án (`globalSetup`, fixture) lo dữ liệu nền, persona, dựng / dọn dữ liệu từng test — script AI sinh chỉ gọi fixture. Kit chọn test, chạy vào địa chỉ app, gom kết quả theo mã, gate, báo cáo, bug ([05 §1](05-environments.md)). |
| D11 | **Claude không được sửa bất kỳ file code nào của ứng dụng** khi làm test case / script / triage, kể cả thêm `data-testid`. Chỉ ghi vào TC và thư mục test được phép, có cưỡng chế bằng kiểm tra diff ([03 §5](03-script-generation.md)). |
| D12 | **Kit không sở hữu CI/CD.** Kit cung cấp hai điểm cắm: `kit gate --pr` / `actions/gate` cho PR (tuân thủ, không cần app) và `kit e2e` / `actions/e2e` chạy vào địa chỉ app dự án đã deploy (sau deploy, hằng đêm). Build, deploy là workflow của dự án; kit không chép, không sửa workflow, chỉ đưa workflow mẫu trong docs ([04](04-ci-workflow.md)). PR chỉ gate vì code của PR chưa có trên dev; bù bằng `kit e2e changed` ở máy (`/kit:ship`). Required check là cài đặt của repo, kit không quản lý. |
| D13 | Mọi thứ riêng của dự án đi qua **điểm cắm** trong `ai-kit.yml`: spec adapter, bộ nhãn TC, hướng dẫn viết test, lệnh chạy test, tracker adapter ([01 §2](01-architecture.md)). |
| D14 | Hoàn thiện kit trên **dự án mẫu trong repo này** (nay `examples/project1`; unit test dùng dự án giả ở `cli/test/fixtures/`), rồi mới áp dụng vào app-base. |
| D15 | **Hai lớp quy định:** kỹ thuật là của repo (`guides`), quy trình là của kit. Kit không viết đè hướng dẫn của repo, chỉ chèn một khối có đánh dấu. Mâu thuẫn thì AI dừng hỏi ([10 §1](10-quy-trinh.md)). |
| D16 | Quy trình viết **trung tính** (không stack, không mã hay đường dẫn của một dự án), test chặn chuỗi riêng dự án. Prompt tiếng Việt; ngôn ngữ đầu ra theo `language`. |
| D17 | Lệnh AI là **plugin Claude Code `kit`** (skill `/kit:*`, agent, hook), mỏng: trỏ tới `<kit>/process/` của gói ai-kit đã cài — quy trình luôn đúng bản lockfile của dự án. `kit init` ghi marketplace ghim tag của gói + bật plugin vào `.claude/settings.json`; doctor báo khi lệch. Lệnh do người gọi (`disable-model-invocation`). Phiên cloud không nạp plugin của repo (chỉ plugin do tổ chức quản lý). |
| D18 | **Một file cấu hình** `ai-kit.yml` (version 2) cho cả quy trình và TAF; phiên bản kit không nằm trong đó mà ở devDependencies. Đổi định dạng không tương thích → tăng phiên bản chính. |
| D19 | Mô hình spec mặc định là **PRD/FSD** (adapter `prd-fsd`), đường dẫn, mẫu mã, chữ trạng thái cấu hình được. Cấp mã bằng `kit next-code`. |
| D20 | **Người duyệt bằng lệnh** `kit approve` (spec, prototype, test case), lệnh ghi người + ngày; AI chỉ được đặt nháp. `/kit:testcase`, `/kit:e2e-script`, `/kit:dev` chỉ chạy khi `kit ready` qua (spec + prototype đã duyệt, prototype còn khớp màn hình). |
| D21 | **Test case trước code:** spec + prototype duyệt → `/kit:testcase` → `/kit:e2e-script` → `/kit:dev`. Lệnh code `/kit:dev` nhận cả việc nhỏ và issue bug. |
| D22 | **Đối chiếu spec ↔ prototype** chia hai: phần tất định là lệnh `kit check-prototype` (mỗi `SCR` có `<section id>`, mỗi thành phần đánh số có `data-ref`, không thừa); phần cần đọc hiểu (nhãn, quy tắc hiển thị, luồng bấm được, không tự thêm nghiệp vụ) giao agent `spec-reviewer`, vì cùng thời điểm (trước khi duyệt) và cùng đầu vào. `/kit:prototype` chạy cả hai sau mỗi lần dựng. |
| D23 | **Nhúng kit:** `npm install -D github:dunglt-iks/ai-kit#<tag>` + `kit init` (chạy lại được, tự kiểm, không đụng `.github/`) + `claude plugin install kit@ai-kit --scope project`, rồi `/kit:adopt`. Đồng đội: `npm install` + cài plugin một lần; nâng cấp = đổi tag gói rồi `kit init`. Git tag, không registry: không cần tài khoản npm; `package.json` vẫn viết sẵn để publish sau. |
| D24 | **Cấu trúc `e2e/` theo module:** `testcases/<MOD>/`, `scripts/<MOD>/`, `pages/<MOD>/` (+ `common/`), `tests/` (viết tay), `support/` (khung test), `testdata/`; mọi thứ sinh ra trong `test-results/` (`reports/` markdown cho người đọc, `playwright/`, `.auth/`, `raw/` JSON). `<MOD>` = mã module. `ai-kit.yml`, `playwright.config.mjs` ở gốc repo. Kit bắt buộc phần nó đọc / ghi (TC, script, kết quả); phần còn lại là khuyến nghị. ([01 §3.1](01-architecture.md)). |
| D25 | **Kết quả e2e trên môi trường dùng chung, không AI:** kit chờ app (gọi thẳng địa chỉ app, không đòi endpoint health) và báo "môi trường không lên" thay vì test fail giả; mỗi môi trường một **issue theo dõi** tự mở / cập nhật / đóng — không phải bug, bug vẫn ghi từ máy sau triage ([04 §5](04-ci-workflow.md)). |
| D26 | **Dữ liệu test dựng qua fixture**, ưu tiên API công khai của app, API riêng cho test khi không có; script không gọi API ghi trực tiếp (`check-script` chặn, trừ TC tầng `api`). Lỗi xảy ra trong fixture là **lỗi dựng dữ liệu** — tất định theo vị trí lỗi (`run.setupPaths`), không kết luận feature hỏng ([06](06-test-data.md)). AI viết fixture mới khi sinh script (người duyệt cùng script); khi triage thì không tự sửa — `check-paths --triage` chặn, người quyết. |
| D27 | **AI không chạy `kit approve`, chặn bằng kỹ thuật:** luật deny trong `.claude/settings.json` + hook `PreToolUse` của plugin (bắt cả `npx -y`, `npm exec`, `node …/kit.mjs`). Chỉ chặn lệnh — trạng thái duyệt vẫn là chữ trong file; dự án cần bảo đảm người duyệt thì dùng CODEOWNERS cho thư mục spec / TC ([10 §2](10-quy-trinh.md)). |

## Mục lục

| File | Nội dung |
|---|---|
| [01-architecture.md](01-architecture.md) | Kiến trúc, phân chia repo, phần TAF của `ai-kit.yml` |
| [02-testcase-format.md](02-testcase-format.md) | Định dạng test case markdown, quy tắc phủ, quy trình duyệt |
| [03-script-generation.md](03-script-generation.md) | Sinh script ở máy (`/kit:e2e-script`): khi nào sinh, luật của script, phạm vi file AI được ghi |
| [04-ci-workflow.md](04-ci-workflow.md) | Cắm kit vào CI: `kit gate --pr`, `kit e2e`, action `gate` và `e2e`, workflow mẫu một file, issue theo dõi môi trường, người / AI / CI làm gì |
| [05-environments.md](05-environments.md) | Phạm vi TAF ba tầng (CI dự án / khung test dự án / kit); môi trường, persona |
| [06-test-data.md](06-test-data.md) | Test data: dựng bằng gì (API công khai → API test), ai viết fixture, lỗi dựng dữ liệu |
| [07-bug-reporting.md](07-bug-reporting.md) | Triage, ghi bug, báo cáo |
| [08-roadmap.md](08-roadmap.md) | Lộ trình, rủi ro, điểm còn mở |
| [09-playwright-primer.md](09-playwright-primer.md) | Playwright cho người mới |
| [10-quy-trinh.md](10-quy-trinh.md) | Quy trình spec → ship, hai lớp quy định, khối cầu nối, áp dụng vào repo |
| [11-cau-hinh.md](11-cau-hinh.md) | `ai-kit.yml` (lớp quy trình), chuyển từ 1.x, lệnh `kit` |
| [12-user-guide.md](12-user-guide.md) | Hướng dẫn sử dụng: nhúng kit vào `examples/project1` (Go + Next.js) và làm chức năng quên mật khẩu / đăng ký theo quy trình |
| [13-tai-lieu-spec.md](13-tai-lieu-spec.md) | Tổ chức tài liệu spec cho người viết: cây thư mục, mã, PRD, FSD, ví dụ hoàn chỉnh, vòng đời, lỗi hay gặp |
| [14-huong-dan-plugin.md](14-huong-dan-plugin.md) | Hướng dẫn dùng ai-kit (gói + plugin `kit`): tích hợp vào dự án đang có, dự án mới, đồng đội, nâng cấp, sự cố hay gặp |

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
