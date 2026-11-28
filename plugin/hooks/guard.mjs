// Hook PreToolUse (Bash) của plugin kit: AI không được chạy `kit approve` — duyệt spec / prototype / test case là việc
// của người (RULES.md). Bắt cả cách gọi mà luật deny trong settings bỏ sót (npx -y, npm exec, node …/kit.mjs, đường dẫn
// tới bin). Chặn: thoát 2, lý do in ra stderr cho AI đọc. Không đọc được đầu vào thì cho qua (không chặn nhầm).
import { pathToFileURL } from "node:url";

const APPROVE = /(?:^|[;&|(\n]|\bnpx|\bexec|\bnode)\s*(?:-\S+\s+)*(?:\S*\/)?kit(?:\.mjs)?\s+approve\b/;

export function blocked(command) {
  return APPROVE.test(String(command || ""));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = "";
  process.stdin.on("data", (d) => (input += d));
  process.stdin.on("end", () => {
    let command = "";
    try {
      command = JSON.parse(input).tool_input?.command;
    } catch {
      process.exit(0);
    }
    if (!blocked(command)) process.exit(0);
    process.stderr.write(
      "ai-kit: `kit approve` là việc của người duyệt, AI không được chạy (RULES.md — duyệt). " +
        "Dừng lại và nhờ người dùng tự chạy lệnh này trên terminal của họ.\n",
    );
    process.exit(2);
  });
}
