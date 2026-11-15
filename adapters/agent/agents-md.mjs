// @ts-check
// Agent adapter "agents-md": công cụ đọc AGENTS.md (Codex, Antigravity, Cursor, Copilot…). Không có
// lệnh /x riêng — khối cầu nối trong AGENTS.md liệt kê việc nào đọc file quy trình nào.

/** @returns {{ name: string, files: string[][], instructionFile: string, autoLoads: string[], bridgeStyle: 'commands'|'files' }} */
export function createAgentAdapter() {
  return {
    name: "agents-md",
    files: [],
    instructionFile: "AGENTS.md",
    autoLoads: ["AGENTS.md"], // công cụ đọc AGENTS.md tự nạp nó
    bridgeStyle: "files",
  };
}
