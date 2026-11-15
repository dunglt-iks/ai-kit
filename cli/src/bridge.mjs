// @ts-check
// Khối cầu nối: đoạn ngắn kit chèn vào file hướng dẫn AI của repo (CLAUDE.md, AGENTS.md…), nằm giữa
// hai dấu ai-kit:start / ai-kit:end. Kit chỉ sửa phần trong dấu; phần còn lại là của repo.
// Xem docs/10-quy-trinh.md §2.

export const START = "<!-- ai-kit:start";
export const END = "<!-- ai-kit:end -->";

const STEPS = [
  ["spec", "làm rõ yêu cầu, ghi vào tài liệu spec (trạng thái nháp)"],
  ["prototype", "dựng HTML tĩnh từ wireframe trong spec"],
  ["testcase", "sinh/đồng bộ test case e2e từ spec + prototype đã duyệt"],
  ["e2e-script", "sinh/cập nhật script e2e từ test case đã duyệt, chạy thử"],
  ["e2e-triage", "phân loại test e2e fail (ở máy hoặc lần chạy CI), sửa script, ghi bug app"],
  ["dev", "kế hoạch → code → test → review theo spec đã duyệt; sửa bug từ issue"],
  ["ship", "kiểm tra cuối, mở PR, theo dõi CI"],
  ["kit-adopt", "đề xuất cấu hình ai-kit.yml khi mới nhúng kit"],
];

/**
 * Nội dung khối cầu nối.
 * @param {'commands'|'files'} style commands: công cụ có lệnh /x (Claude Code); files: công cụ chỉ đọc file hướng dẫn
 */
export function bridgeBlock(style) {
  const steps =
    style === "commands"
      ? STEPS.map(([n, d]) => `- \`/${n}\` — ${d}`)
      : STEPS.map(
          ([n, d]) =>
            `- ${d}: đọc \`.ai-kit/process/${n === "kit-adopt" ? "adopt" : n}.md\` và làm đúng theo`,
        );
  return `${START} — do \`kit init\` quản lý; sửa ngoài khối này -->
## ai-kit — quy trình spec → prototype → dev → test → ship

Repo dùng ai-kit (gắn ở \`.ai-kit/\`, cấu hình \`ai-kit.yml\`). Có hai lớp quy định:

- **Kỹ thuật** — stack, framework, cấu trúc code, lint, bảo mật, test đơn vị: theo hướng dẫn của
  repo (phần ngoài khối này và các file trong \`guides\` của \`ai-kit.yml\`).
- **Quy trình** — tài liệu spec, mã yêu cầu, trạng thái duyệt, version, kế hoạch, test case/e2e,
  truy vết, PR: theo \`.ai-kit/RULES.md\` và \`ai-kit.yml\`.

Khi hai lớp đụng nhau: *code thế nào* theo repo; *spec, quy trình, e2e đi đường nào* theo ai-kit.
Mâu thuẫn thật thì dừng và hỏi người dùng, không tự chọn.

Trước mọi việc thuộc quy trình, chạy \`node .ai-kit/cli/bin/kit.mjs context\`. Chưa có \`.ai-kit/\` thì
gắn kit theo \`kitRef\` trong \`ai-kit.yml\`: \`git clone --depth 1 -b <kitRef> https://github.com/dunglt-iks/ai-kit .ai-kit\`
rồi \`npm ci --prefix .ai-kit --omit=dev\`. Duyệt spec / prototype / test case là việc của người, bằng
\`kit approve <mã>\` (thêm \`--prototype\` / \`--testcase\`) — AI không tự đặt trạng thái đã duyệt.

${steps.join("\n")}
${style === "commands" ? "" : "\nCác bước gọi agent con (spec-reviewer, tester, reviewer): công cụ không có agent con thì tự đọc\n`.ai-kit/process/agents/<tên>.md` và làm như một người ngoài chưa thấy phần việc vừa làm.\n"}${END}`;
}

/** Vị trí khối trong văn bản, hoặc null. */
export function findBlock(text) {
  const s = text.indexOf(START);
  if (s < 0) return null;
  const e = text.indexOf(END, s);
  if (e < 0) return null;
  return { start: s, end: e + END.length };
}

/**
 * Chèn hoặc thay khối. Phần ngoài khối giữ nguyên từng byte; khối mới đặt cuối file.
 * @returns {{ text: string, action: 'create'|'update'|'keep' }}
 */
export function upsertBlock(text, block) {
  const b = findBlock(text);
  if (b) {
    if (text.slice(b.start, b.end) === block) return { text, action: "keep" };
    return {
      text: text.slice(0, b.start) + block + text.slice(b.end),
      action: "update",
    };
  }
  if (!text) return { text: `${block}\n`, action: "create" };
  const sep = text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n";
  return { text: `${text}${sep}${block}\n`, action: "update" };
}
