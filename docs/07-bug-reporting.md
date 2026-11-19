# 07 — Triage, ghi bug, báo cáo

## 1. Luồng sau khi chạy

```
CI: kit e2e (JSON report, artifact) → bảng theo feature, step summary, issue theo dõi môi trường (--track),
        đóng bug đã hết (--close-fixed). Test fail chưa phân loại: không ghi bug, nhắc /e2e-triage <run-id>
Máy: /e2e-triage [run-id CI]
  └─ lấy report (ở máy, hoặc gh run download từ CI) → Claude triage (prompts/triage.md) → triage.json
       └─ lỗi script: sửa, chạy lại (kit e2e <mã> --merge), tối đa 2 vòng — chỉ khi truy cập được app từ máy
  └─ kit report → người dùng xem → đồng ý → kit file-bugs → bug app → issue theo fingerprint
```

CI không gọi AI (D8). `kit e2e` trên CI chỉ báo cáo và (`--close-fixed`) đóng bug có TC đã pass; test fail chưa phân
loại không thành bug — tránh bug giả do lỗi môi trường / chập chờn. Chỉ test đã phân loại `app-bug` trong
`triage.json` mới thành bug.
Phân loại và ghi bug làm ở máy bằng `/e2e-triage` ([`process/e2e-triage.md`](../process/e2e-triage.md)): kết quả CI
tải về bằng `gh run download`, chép `results.json` vào `run.report` (mặc định `e2e/test-results/raw/results.json`); tracker `github` ở máy cần
`GITHUB_TOKEN=$(gh auth token)` và `GITHUB_REPOSITORY=<owner>/<repo>`.

## 2. Triage

| Loại | Dấu hiệu | Hành động |
|---|---|---|
| `app-bug` | App khác kết quả mong đợi của TC, TC đúng spec | Ghi issue |
| `script-bug` | Locator sai, thiếu chờ, dựng dữ liệu sai | Sửa script / page object, chạy lại; người dùng commit bản sửa |
| `env` | App không lên, mạng, môi trường bẩn; **lỗi dựng dữ liệu** do môi trường (API test chưa bật, persona chưa có trên môi trường) | Không ghi bug; báo người lo môi trường |
| `flaky` | Lúc pass lúc fail | Không ghi bug; báo cáo liệt kê test flaky (Playwright retry) |
| `tc-wrong` | TC mâu thuẫn spec | Không ghi bug. Báo cáo có mục **Test case cần xem lại** (mã TC, vì sao, bước làm: `/testcase` → `kit approve --testcase` → `/e2e-script` → `kit e2e`). AI không tự sửa TC |

Nguyên tắc: **triage không sửa code ứng dụng, không sửa script cho khớp app sai.**

**Lỗi dựng dữ liệu.** Test fail mà vị trí lỗi (Playwright ghi trong JSON report) nằm trong `run.setupPaths` (mặc định
`e2e/support/**` — fixture, dựng dữ liệu) được kit đánh dấu **lỗi dựng dữ liệu**, tất định, trước khi AI phân loại:
báo cáo tách thành mục riêng, issue theo dõi môi trường cũng vậy. Feature đang test chưa được kiểm, nên không kết luận
`app-bug` cho feature đó. Thường là `env` (môi trường thiếu cấu hình) hoặc `script-bug` (fixture sai); API dựng dữ liệu
của app trả sai thì lỗi thuộc chính API đó — có TC tầng `api` của nó thì ghi bug theo TC ấy. Triage **không tự sửa
fixture**: `kit check-paths --triage` bắt file `run.setupPaths` bị đổi; AI dừng, nêu lý do, người đồng ý mới sửa ([03 §5](03-script-generation.md)).

`triage.json` (cạnh `run.report`): `[{ "test": "<tên test>", "fingerprint": "<của lỗi đó>", "class": "app-bug",
"summary": "…", "fixed": false }]` — `fixed`: script đã sửa và chạy lại pass. Mục có `fingerprint` chỉ áp cho đúng lỗi đó
(test fail lại vì lý do khác → chưa phân loại). `kit e2e` không `--merge` xoá `triage.json` cũ khi bắt đầu chạy.

## 2b. Lịch sử, test chập chờn, cách ly

- **Lịch sử:** mỗi lần `kit e2e` đầy đủ (không `--merge` / `--grep`) ghi một dòng vào `run.history` (mặc định
  `e2e/test-results/history.jsonl`, giữ `run.keepHistory` = 50 lần). Trên CI, action `e2e` giữ file bằng cache.
- **`kit flaky [--last N] [--env dev]`:** tỷ lệ pass / fail / flaky của từng test qua N lần gần nhất; "chập chờn" = có cả
  pass lẫn fail / flaky. `/e2e-triage` dựa vào đây để phân loại `flaky`, không tự đoán.
- **Cách ly** (`run.quarantine`, mặc định `e2e/quarantine.yml`, commit cùng repo):

  ```yaml
  - test: TC-DM-F01-004          # tên test hoặc mã TC
    issue: https://github.com/o/r/issues/31
    until: 2026-12-31            # hết hạn thì tự hết cách ly
    reason: chập chờn khi tải danh sách lớn
  ```

  Test đang cách ly mà fail: báo ở mục **Cách ly** của báo cáo, không làm đỏ lần chạy, không ghi bug. Hết hạn: tính như
  test thường, `kit doctor` cảnh báo. Thiếu `issue` / `until`: lỗi cấu hình, lần chạy đỏ.

## 3. Bug và vòng đời

- **Fingerprint** = mã TC (hoặc tên test nếu không có mã) + chữ ký lỗi: các dòng `Error`, `Locator`, `Expected` của thông báo, bỏ giá trị thực tế, số trong locator, mã `#N`, thời gian. Cùng lỗi ở lần chạy sau → cùng fingerprint.
- Issue: tiêu đề `[e2e] <tên test>`, nhãn `tracker.labels` + `feature:<MÃ>`, thân có test, TC, file:dòng, môi trường (`--env`), commit, link run (artifact có trace và ảnh), thông báo lỗi, phân tích của triage, và marker ẩn `taf:fp`, `taf:tc`, `taf:tests` (tên các test đã fail).
- Nhiều test cùng fingerprint trong một lần chạy (các dòng của test theo bảng dữ liệu, cùng TC trên nhiều trình duyệt)
  → **một** issue, thân liệt kê đủ các test.

| Tình huống | Hành động |
|---|---|
| Chưa có issue cùng fingerprint | Tạo |
| Có issue đang mở | Comment "vẫn lỗi ở …" |
| Có issue đã đóng (đã sửa) | Mở lại, comment lỗi |
| Chỉ có issue người đóng dạng *not planned* | Bỏ qua: tôn trọng quyết định "không phải bug / không sửa" |
| `--close-fixed`: issue đang mở mà **chính các test đã fail** (marker `taf:tests`) đều chạy lại và pass lần này — test không chạy, bị skip hay là lỗi đã biết thì giữ; chạy một phần (`--grep`) thì không đóng gì | Comment rồi đóng |

Nhiều issue cùng fingerprint: chọn đang mở, rồi đã đóng *completed* mới nhất. `file-bugs --dry-run` không có
`GITHUB_TOKEN` thì không tra được issue đã có — kế hoạch in ra là "tạo" cho mọi lỗi, kèm cảnh báo.

Lưu ý: bộ lọc nhãn của GitHub cập nhật chậm vài giây sau khi tạo issue. Hai lần `file-bugs` cách nhau dưới khoảng đó có thể tạo trùng; trong CI các lần chạy cách nhau nhiều phút nên không gặp.

`--close-fixed` nên bật ở run hồi quy trên nhánh phát triển (sau CD, hằng đêm), không bật ở PR (nhánh PR chưa phải code chung).

**Issue theo dõi môi trường** (`kit e2e --track`, action `e2e` bật sẵn khi không phải sự kiện PR) khác issue bug: mỗi
môi trường tối đa một issue đang mở "🔴 E2E `<env>` đang đỏ", nhãn `tracker.trackLabel` (mặc định `e2e:{env}`), tự mở /
cập nhật / đóng theo từng lần chạy đầy đủ — xem [04 §5](04-ci-workflow.md). Bug từng lỗi vẫn ghi theo fingerprint như
trên, sau khi người phân loại.

## 4. Báo cáo

`kit report` (comment PR chỉ một, sửa lại mỗi lần chạy):

```markdown
## E2E-TAF · ✘ 2 test fail · 22/24 pass

| Feature | Phủ spec | TC có test | Script (pass/fail/flaky/đã biết) | Test khác |
|---|---|---|---|---|
| DM-F01 Danh sách đơn hàng | 7/7 | 8/8 | 8/0/0/0 ✓ | 2/2 |
| DM-F02 Tạo đơn hàng | 7/7 | 8/8 | 12/2/0/0 ✘ | — |

### Test fail
▸ TC-DM-F02-002 Tạo đơn có chiết khấu — app-bug: SL 10 × 5.000, CK 10% ra 50.000 … · #1
```

| Cột | Nghĩa |
|---|---|
| Phủ spec | Mã bắt buộc (adapter) / mã TC đã phủ |
| TC có test | TC không DEPRECATED có ít nhất một test chạy lần này |
| Script | Test sinh từ TC (tên bắt đầu bằng mã TC). "Đã biết" = lỗi đã biết, xem dưới |
| Test khác | Test viết tay của dự án có mã feature trong tên (vd `smoke DM-F01-SCR01: …`) |

### Lỗi đã biết

Test kiểm đúng TC nhưng fail vì app làm khác TC/spec, mà chưa sửa ngay: **không sửa test cho khớp app**. Dự án ghi issue, đánh dấu test bằng `test.fail(true, "Lỗi app đã biết: <link issue>")` (cách đặt do hướng dẫn của dự án quy định, vd danh sách `KNOWN_BUGS` đầu script).

| Kết quả | `kit report` | Ghi bug |
|---|---|---|
| Test fail đúng như dự kiến | Mục **Lỗi đã biết** riêng, kèm link issue; không tính pass, không tính fail; job không đỏ | Không (đã có issue). TC còn lỗi đã biết thì `--close-fixed` không coi là đã pass |
| Test lại **pass** (app có thể đã sửa) | Tính là **fail**: "Test đánh dấu lỗi đã biết nhưng đã pass — gỡ dấu"; job đỏ để nhắc gỡ | Không |

Mỗi lần `kit e2e` / `kit report` ghi hai thứ:

- **Cho người đọc:** `run.reportsDir/latest.md` (mặc định `e2e/test-results/reports/`) và một bản theo lần chạy
  `<YYYY-MM-DD-HHmm>-<env>.md` (giữ `run.keepReports` bản gần nhất, mặc định 20). Nội dung như comment PR: bảng theo
  feature, test fail kèm mã TC, **bước fail** (tên `test.step`), mục **lỗi dựng dữ liệu** riêng, lỗi rút gọn, đường dẫn ảnh / trace để mở ngay, loại
  lỗi sau `/e2e-triage`, dữ liệu test dọn lỗi (annotation `cleanup`). Trên CI nằm trong artifact.
- **Cho máy:** `result.json` cạnh `run.report` (mặc định `e2e/test-results/raw/`): tổng, theo feature, danh sách lỗi
  (fingerprint, triage), lỗi đã biết (`known`), test flaky, từng test, bug đã ghi.

## 5. Tracker adapter

`tracker.adapter: github` (có sẵn) dùng GitHub Issues của repo đang chạy (`GITHUB_REPOSITORY`, `GITHUB_TOKEN`). Adapter khác (Jira…) export `createTracker(cfg)` trả:

| Hàm | Việc |
|---|---|
| `list({ labels })` | Mọi issue có các nhãn, cả đóng: `{ id, title, state: 'open'\|'closed', reason?, body }` |
| `create({ title, body, labels })` | Tạo, trả `{ id, url }` |
| `comment(id, body)`, `reopen(id)`, `close(id)` | |

Marker `taf:fp` / `taf:tc` phải được giữ trong `body`.
