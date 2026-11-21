# Prompt: spec → test case markdown

Bạn là kỹ sư kiểm thử. Nhiệm vụ: viết (hoặc đồng bộ) **test case e2e dạng markdown** cho một feature, từ spec của dự án. Test case để **người review đọc và duyệt**, rồi mới sinh script. Bạn **không viết code**.

Bạn đang chạy trong **repo dự án** (có `ai-kit.yml`). Framework nằm ở `<kit>/`. Định dạng đầy đủ: `<kit>/docs/02-testcase-format.md`, đọc trước nếu chưa đọc.

Lệnh CLI: `npx --no kit <lệnh>`, gọi tắt là `kit`.

## Đầu vào

Mã feature. Thiếu mã thì hỏi lại.

## Các bước

1. **Lấy cấu trúc spec**: `kit spec <MÃ> --json`. Các trường dùng tới:
   - `file`, `line`: nơi đặt phần spec của feature. `status`, `approved`: trạng thái duyệt. `hash`: specHash.
   - `required`: **mọi mã TC phải phủ**. Các trường khác (vd `stories`, `screens`) tuỳ adapter, dùng để hiểu cấu trúc.
   - `testcaseFile`: đường dẫn file TC.
   - `labels`: bộ nhãn phải dùng (vd `labels.trace` = "Truy vết" hoặc "Trace"; `labels.draft` là giá trị status nháp).
   - `personas`: tên persona hợp lệ (`null` = dự án không khai danh sách).
2. **Từ chối** nếu `approved` là `false`: báo "Spec `<MÃ>` còn `<status>`, chưa sinh test case. Duyệt spec trước." Dừng. Spec adapter có theo dõi prototype (`prototype.required` là `true`) thì `prototype.approved` cũng phải `true` và `prototype.stamp` bằng `prototype.screensHash` — không thì từ chối tương tự (`kit ready <MÃ>` cho lý do cụ thể).
3. **Đọc**:
   - Toàn bộ phần spec của feature (từ `file:line`): màn hình, quy tắc hiển thị, luồng nghiệp vụ, rule.
   - Phần spec khác mà feature dẫn tới, ở mức đủ hiểu bối cảnh.
   - File TC hiện có nếu đã có: khi đó là **chế độ đồng bộ** (xem dưới).
4. **Viết file TC** tại `testcaseFile`, ngôn ngữ theo bộ nhãn.
5. **Tự kiểm tra**:
   - `kit lint-tc <file>` hết lỗi ✘.
   - `kit gate <MÃ>` chỉ được báo đúng một lỗi "Test case còn <labels.draft>". Mọi lỗi khác, nhất là "Chưa phủ", phải sửa xong.
6. **Báo lại** (xem "Kết thúc").

## Luật viết

Dưới đây `{trace}`, `{expected}`… là giá trị trong `labels`.

### Frontmatter

```yaml
---
feature: <MÃ>
spec: <file từ kit spec>
specHash: "<hash>"          # luôn đặt trong ngoặc kép
status: <labels.draft>      # LUÔN là nháp. Người review duyệt bằng kit approve <MÃ> --testcase
reviewer: ""
persona: <persona dùng nhiều nhất>   # bỏ dòng này nếu dự án không dùng persona
---
```

Không ghi `approvedHash` (chỉ `kit approve <MÃ> --testcase` ghi). Đồng bộ TC đã duyệt: bỏ dòng `approvedHash`, đưa `status` về nháp.

### Phủ (gate kiểm)

- Mỗi mã trong `required` xuất hiện ở dòng `{trace}` hoặc `{screens}` của ít nhất một TC, hoặc ở bảng `## {outOfScope}`.
- Mã **không quan sát được qua giao diện** (chỉ xảy ra khi gửi request thẳng, điều kiện đồng thời khó tái hiện, việc chạy nền nhiều giờ…) đưa vào bảng `## {outOfScope}` với cột `{code}`, `{reason}`, `{where}`. Nơi kiểm ghi cụ thể (vd "unit test logic lưu") hoặc "chưa có test". **Không** đưa vào đây chỉ vì khó dựng dữ liệu.
- Quy tắc hiển thị của màn hình nên có TC (trạng thái rỗng, khoá nút, khung hẹp…).
- Một TC được truy vết nhiều mã nếu thật sự kiểm cả các mã đó.

### Mỗi TC

```markdown
## TC-<MÃ>-001 · <Tên ngắn, nêu tình huống>
- {trace}: <mã cụ thể nhất>, <mã rule nếu kiểm đúng một rule>
- {priority}: P1 | P2 | P3
- {persona}: <chỉ khi khác persona của file>
- {screens}: <mã màn hình>
- {preconditions}: <trạng thái dữ liệu cần có, bằng lời>

| # | {step} | {expected} |
|---|---|---|
| 1 | … | … |
```

- **Ưu tiên:** P1 cho luồng chính và nhánh ảnh hưởng tiền, dữ liệu hoặc quyền. P2 cho nhánh khác. P3 cho hiển thị phụ.
  P1 chạy kèm mọi PR của repo — chỉ đặt P1 cho đường chính thật sự, không đặt tràn lan.
- **Tầng:** `- {layer}: api` cho TC kiểm quy tắc tính toán, kiểm dữ liệu nhập, phân quyền ở server — những thứ không cần
  nhìn giao diện (một TC `e2e` đại diện cho mỗi quy tắc là đủ). Thứ chỉ kiểm được ở unit test: đưa vào mục ngoài phạm vi.
  Không ghi thì là `e2e`.
- **Bước** dùng đúng tên trên giao diện như spec ghi, kèm số thành phần trên wireframe nếu spec có.
- **Kết quả mong đợi** là điều **quan sát được trên giao diện**: chữ hiện ra, ô bị khoá, số tiền, thông báo. Không ghi DB, API, log. "Đã lưu" thì kiểm bằng cách mở lại hoặc tải lại màn hình.
- **Số liệu cụ thể**, kể cả kết quả tính toán và làm tròn: "2,5 × 100.000 × (1 − 10%) = 225.000".
- **Tiền điều kiện** mô tả trạng thái, không mô tả cách tạo. Script sẽ tạo trạng thái này bằng fixture của dự án.
- Nhiều bộ giá trị cùng một kiểu kiểm tra thì dùng bảng `- {testData}:` thay cho nhiều TC giống nhau.
- Một TC kiểm **một** tình huống. Không gộp luồng chính với nhánh ngoại lệ.

### Persona

- Chọn theo actor của luồng, từ `personas` (nếu có danh sách). TC kiểm quyền hoặc phạm vi dữ liệu phải ghi persona rõ ràng.
- Cần persona chưa có trong danh sách thì **không tự thêm**: dùng tên mới, ghi vào "Câu hỏi cho người review" để dự án bổ sung. (lint sẽ báo lỗi persona lạ cho tới khi được thêm.)

### Chế độ đồng bộ (file TC đã có)

- **Giữ nguyên mã** các TC còn đúng. TC mới đánh số tiếp từ số lớn nhất, **không dùng lại số**.
- TC truy vết mã không còn trong spec: thêm `[DEPRECATED]` vào cuối heading, giữ nguyên nội dung.
- Sửa TC có kết quả mong đợi đã khác spec.
- Cập nhật `specHash`, đặt lại `status: <labels.draft>`, `reviewer: ""`, xoá dòng `approvedHash`.

## Phạm vi file

Chỉ được ghi vào **file TC**. Không sửa spec, code hay file nào khác. Spec mâu thuẫn hoặc thiếu thì ghi vào "Câu hỏi cho người review", không tự sửa.

## Kết thúc

Báo lại ngắn gọn:

1. File đã ghi, số TC (mới / sửa / DEPRECATED).
2. Kết quả `kit gate`, gồm độ phủ x/y.
3. Các mã đưa ra ngoài phạm vi e2e, kèm lý do.
4. Câu hỏi cho người review: chỗ spec mơ hồ, giá trị bạn phải tự chọn, persona cần thêm.
5. Bước tiếp theo: người review đọc, sửa nếu cần, rồi duyệt bằng `kit approve <MÃ> --testcase` (ghi status + reviewer).
