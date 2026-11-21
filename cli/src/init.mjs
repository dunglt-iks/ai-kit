// @ts-check
// kit init: nhúng / cập nhật ai-kit trong repo dự án — chạy lại được, kể cả sau khi nâng gói ai-kit.
// - ai-kit.yml (tạo từ mẫu); không bao giờ ghi đè.
// - Dò file hướng dẫn AI sẵn có của repo → `guides`; không sửa nội dung các file đó.
// - Theo `agents`: cấu hình công cụ AI (claude: .claude/settings.json — marketplace ghim tag của gói ai-kit đang cài,
//   bật plugin `kit`, luật deny) và khối cầu nối trong file hướng dẫn chính (CLAUDE.md).
// - .gitignore. Không đụng .github/ — CI là của dự án (điểm cắm: kit gate, kit e2e, docs/04).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { bridgeBlock, upsertBlock } from "./bridge.mjs";
import { findConfig } from "./config.mjs";
import { TafError } from "./errors.mjs";

export const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** package.json của kit: phiên bản (→ tag plugin) và repo GitHub (→ marketplace). */
export const PKG = JSON.parse(fs.readFileSync(path.join(KIT, "package.json"), "utf8"));

/** Tag và repo của bản kit đang chạy — plugin được ghim đúng bản này để quy trình khớp CLI. */
export function kitRelease() {
  const repo = String(PKG.repository?.url || PKG.repository || "").replace(/^github:|\.git$/g, "").replace(/^.*github\.com\//, "");
  return { repo, ref: `v${PKG.version}`, version: PKG.version };
}

/** File hướng dẫn AI hay gặp (file hoặc thư mục). Thứ tự = thứ tự ghi vào `guides`. */
export const GUIDE_CANDIDATES = [
  "CLAUDE.md",
  "AGENTS.md",
  "GEMINI.md",
  ".github/copilot-instructions.md",
  ".cursorrules",
  ".cursor/rules",
  ".windsurfrules",
  ".clinerules",
  ".agent/rules",
];

export const AGENT_ADAPTERS = ["claude"];

const IGNORE = ["/e2e/test-results/"];

/** File hướng dẫn AI đã có trong repo. */
export function detectGuides(root) {
  return GUIDE_CANDIDATES.filter((f) => fs.existsSync(path.join(root, f)));
}

/** Nội dung ai-kit.yml mới: mẫu của kit, điền guides dò được. */
export function newConfigText(root) {
  const guides = detectGuides(root);
  return fs
    .readFileSync(path.join(KIT, "templates/ai-kit.yml"), "utf8")
    .replace(/^guides: \[\]/m, `guides: [${guides.join(", ")}]`);
}

export async function loadAgent(name) {
  if (!AGENT_ADAPTERS.includes(name))
    throw new TafError(`Không có agent adapter "${name}" (có: ${AGENT_ADAPTERS.join(", ")})`);
  const mod = await import(`../../adapters/agent/${name}.mjs`);
  return mod.createAgentAdapter();
}

/**
 * Trộn phần của kit vào settings của công cụ AI: mục marketplace của kit lấy theo kit (đổi tag khi nâng kit), plugin chỉ
 * bật khi repo chưa đặt (tôn trọng `false`), luật deny thêm cái còn thiếu. Phần khác của repo giữ nguyên.
 * @returns {{ text: string, action: 'create'|'update'|'keep' }}
 */
export function mergeSettings(current, ours) {
  let cur = {};
  if (current) {
    try {
      cur = JSON.parse(current);
    } catch (e) {
      throw new TafError(`settings không phải JSON hợp lệ (${e.message}) — sửa rồi chạy lại kit init`);
    }
  }
  const next = structuredClone(cur);
  next.extraKnownMarketplaces = { ...(cur.extraKnownMarketplaces || {}), ...ours.extraKnownMarketplaces };
  next.enabledPlugins = { ...ours.enabledPlugins, ...(cur.enabledPlugins || {}) };
  const deny = cur.permissions?.deny || [];
  next.permissions = { ...(cur.permissions || {}), deny: [...deny, ...ours.permissions.deny.filter((r) => !deny.includes(r))] };
  const text = `${JSON.stringify(next, null, 2)}\n`;
  if (!current) return { text, action: "create" };
  return JSON.stringify(next) === JSON.stringify(cur) ? { text: current, action: "keep" } : { text, action: "update" };
}

/**
 * @param {string} root thư mục dự án
 * @param {{ dryRun?: boolean }} [o]
 * @returns {Promise<{ file: string, action: 'create'|'keep'|'update', note?: string }[]>}
 */
export async function initProject(root, o = {}) {
  /** @type {{ file: string, action: any, note?: string }[]} */
  const out = [];
  const write = (rel, text) => {
    if (o.dryRun) return;
    const to = path.join(root, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, text);
  };
  const read = (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : "");

  // 1. Cấu hình
  const existing = findConfig(root);
  let cfgText;
  if (!existing) {
    cfgText = newConfigText(root);
    out.push({ file: "ai-kit.yml", action: "create" });
    write("ai-kit.yml", cfgText);
  } else {
    cfgText = fs.readFileSync(existing, "utf8");
    out.push({ file: "ai-kit.yml", action: "keep" });
  }
  const raw = YAML.parse(cfgText) || {};
  const agentNames = raw.agents ?? ["claude"];

  // 2. Phần của kit theo từng công cụ AI: settings (plugin, deny) + khối cầu nối
  const bridged = new Set();
  for (const name of agentNames) {
    const a = await loadAgent(name);
    const s = mergeSettings(read(a.settingsFile), a.settings(kitRelease()));
    out.push({ file: a.settingsFile, action: s.action, note: s.action === "keep" ? undefined : `plugin ${kitRelease().ref}, deny` });
    if (s.action !== "keep") write(a.settingsFile, s.text);
    if (bridged.has(a.instructionFile)) continue;
    bridged.add(a.instructionFile);
    const r = upsertBlock(read(a.instructionFile), bridgeBlock(a.commandPrefix));
    out.push({
      file: a.instructionFile,
      action: r.action,
      note: r.action === "keep" ? undefined : "khối ai-kit:start/end",
    });
    if (r.action !== "keep") write(a.instructionFile, r.text);
  }

  // 3. .gitignore
  const current = read(".gitignore");
  const norm = (l) => l.trim().replace(/^\//, "").replace(/\/$/, "");
  const lines = current.split("\n").map(norm);
  const missing = IGNORE.filter((l) => !lines.includes(norm(l)));
  if (missing.length) {
    out.push({ file: ".gitignore", action: "update" });
    write(
      ".gitignore",
      `${current}${current && !current.endsWith("\n") ? "\n" : ""}# ai-kit\n${missing.join("\n")}\n`,
    );
  }
  return out;
}
