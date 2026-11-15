// @ts-check
// Agent adapter "claude": Claude Code. Cài vỏ lệnh /spec… vào .claude/commands/, agent con vào
// .claude/agents/, khối cầu nối vào CLAUDE.md. Vỏ chỉ trỏ tới .ai-kit/process/, nên đổi phiên bản
// kit là đổi quy trình, không cần cài lại.

/** @returns {{ name: string, files: string[][], instructionFile: string, autoLoads: string[], bridgeStyle: 'commands'|'files' }} */
export function createAgentAdapter() {
  const cmds = ["spec", "prototype", "testcase", "e2e-script", "e2e-triage", "dev", "ship", "kit-adopt"];
  return {
    name: "claude",
    files: [
      ...cmds.map((c) => [`claude/commands/${c}.md`, `.claude/commands/${c}.md`]),
      ...["spec-reviewer", "tester", "reviewer"].map((a) => [`claude/agents/${a}.md`, `.claude/agents/${a}.md`]),
    ],
    instructionFile: "CLAUDE.md",
    autoLoads: ["CLAUDE.md", "CLAUDE.local.md"], // Claude Code tự nạp vào ngữ cảnh
    bridgeStyle: "commands",
  };
}
