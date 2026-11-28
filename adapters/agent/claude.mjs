// @ts-check
// Agent adapter "claude": Claude Code. Lệnh /kit:spec…, agent con và hook chặn AI tự duyệt nằm trong plugin `kit`
// (thư mục plugin/ của repo kit, marketplace ở .claude-plugin/marketplace.json). kit init ghi vào .claude/settings.json
// của dự án: khai marketplace ghim đúng tag của gói ai-kit đã cài, bật plugin, luật deny; và khối cầu nối vào CLAUDE.md.

export const MARKETPLACE = "ai-kit";
export const PLUGIN = "kit";

/**
 * Luật deny cho AI: duyệt là việc của người (RULES.md). Vẫn chặn khi plugin chưa cài; dạng luật không bắt được mọi cách
 * gọi (vd `npx -y kit approve`) — hook PreToolUse của plugin (plugin/hooks/guard.mjs) bắt phần còn lại.
 */
export const DENY = ["Bash(kit approve *)", "Bash(npx kit approve *)", "Bash(npx --no kit approve *)"];

/**
 * @returns {{ name: string, instructionFile: string, autoLoads: string[], commandPrefix: string, settingsFile: string,
 *   settings: (o: { repo: string, ref: string }) => any }}
 */
export function createAgentAdapter() {
  return {
    name: "claude",
    instructionFile: "CLAUDE.md",
    autoLoads: ["CLAUDE.md", "CLAUDE.local.md"], // Claude Code tự nạp vào ngữ cảnh
    commandPrefix: `/${PLUGIN}:`,
    settingsFile: ".claude/settings.json",
    settings: ({ repo, ref }) => ({
      extraKnownMarketplaces: { [MARKETPLACE]: { source: { source: "github", repo, ref } } },
      enabledPlugins: { [`${PLUGIN}@${MARKETPLACE}`]: true },
      permissions: { deny: DENY },
    }),
  };
}
