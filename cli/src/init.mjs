// @ts-check
// kit init: nhúng / cập nhật ai-kit trong repo dự án — chạy lại được, kể cả sau khi nâng gói ai-kit.
// - ai-kit.yml (tạo từ mẫu); không bao giờ ghi đè.
// - Dò file hướng dẫn AI sẵn có của repo → `guides`; không sửa nội dung các file đó.
// - Theo `agents`: cấu hình công cụ AI (claude: .claude/settings.json — marketplace + plugin `kit` theo khoá `plugin`,
//   luật deny) và khối cầu nối trong file hướng dẫn chính (CLAUDE.md).
// - Dọn phần của ai-kit 2.x: vỏ lệnh/agent có dấu ai-kit:shell, khối ai-kit trong AGENTS.md (adapter agents-md đã bỏ).
// - .gitignore. Không đụng .github/ — CI là của dự án (điểm cắm: kit gate, kit e2e, docs/04).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { bridgeBlock, findBlock, upsertBlock } from "./bridge.mjs";
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

/**
 * Cách kit init ghi plugin vào settings (khoá `plugin` trong ai-kit.yml):
 * - pin: khai marketplace ghim tag của gói ai-kit đang cài + bật plugin (mặc định);
 * - keep: marketplace repo đã khai thì giữ nguyên (thử plugin từ fork / nhánh) — chưa có thì như pin;
 * - managed: tổ chức quản lý plugin (managed settings / claude.ai) — không ghi marketplace, không bật plugin; chỉ deny.
 */
export const PLUGIN_MODES = ["pin", "keep", "managed"];

/** Phần của ai-kit 2.x còn sót (đã thay bằng plugin, bỏ adapter agents-md). */
export const V2 = {
  shellMark: "<!-- ai-kit:shell", // dấu trong vỏ lệnh/agent 2.x
  shellDirs: [".claude/commands", ".claude/agents"],
  agents: ["agents-md"],
  bridgeFiles: ["AGENTS.md"], // file 2.x có khối ai-kit mà 3.x không còn quản lý
};

/** Vỏ lệnh/agent 2.x còn trong repo (đường dẫn tương đối gốc). File không có dấu là của repo — không đụng. */
export function v2Shells(root) {
  const out = [];
  for (const d of V2.shellDirs) {
    const dir = path.join(root, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const abs = path.join(dir, f);
      if (fs.statSync(abs).isFile() && fs.readFileSync(abs, "utf8").includes(V2.shellMark)) out.push(`${d}/${f}`);
    }
  }
  return out;
}

/** @param {any} raw cấu hình thô @returns {'pin'|'keep'|'managed'} */
export function pluginMode(raw) {
  const m = raw?.plugin ?? "pin";
  if (!PLUGIN_MODES.includes(m)) throw new TafError(`plugin: "${m}" không hợp lệ (có: ${PLUGIN_MODES.join(", ")})`);
  return m;
}

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
 * mode (xem PLUGIN_MODES): keep — marketplace repo đã khai thì giữ; managed — không ghi marketplace, không bật plugin.
 * @param {string} current @param {any} ours @param {'pin'|'keep'|'managed'} [mode]
 * @returns {{ text: string, action: 'create'|'update'|'keep' }}
 */
export function mergeSettings(current, ours, mode = "pin") {
  let cur = {};
  if (current) {
    try {
      cur = JSON.parse(current);
    } catch (e) {
      throw new TafError(`settings không phải JSON hợp lệ (${e.message}) — sửa rồi chạy lại kit init`);
    }
  }
  const next = structuredClone(cur);
  if (mode !== "managed") {
    const known = cur.extraKnownMarketplaces || {};
    const mk = mode === "keep" ? Object.fromEntries(Object.entries(ours.extraKnownMarketplaces).filter(([k]) => !known[k])) : ours.extraKnownMarketplaces;
    next.extraKnownMarketplaces = { ...known, ...mk };
    next.enabledPlugins = { ...ours.enabledPlugins, ...(cur.enabledPlugins || {}) };
  }
  const deny = cur.permissions?.deny || [];
  next.permissions = { ...(cur.permissions || {}), deny: [...deny, ...ours.permissions.deny.filter((r) => !deny.includes(r))] };
  const text = `${JSON.stringify(next, null, 2)}\n`;
  if (!current) return { text, action: "create" };
  return JSON.stringify(next) === JSON.stringify(cur) ? { text: current, action: "keep" } : { text, action: "update" };
}

/**
 * @param {string} root thư mục dự án
 * @param {{ dryRun?: boolean }} [o]
 * @returns {Promise<{ file: string, action: 'create'|'keep'|'update'|'remove', note?: string }[]>}
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
  const remove = (rel) => {
    if (!o.dryRun) fs.rmSync(path.join(root, rel));
  };

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
  const mode = pluginMode(raw);
  const legacy = (raw.agents ?? []).filter((n) => V2.agents.includes(n));
  if (legacy.length) out[0].note = `agents: ${legacy.join(", ")} bỏ từ ai-kit 3 — bỏ qua; xoá khỏi ai-kit.yml`;
  let agentNames = (raw.agents ?? ["claude"]).filter((n) => !V2.agents.includes(n));
  if (legacy.length && !agentNames.length) agentNames = ["claude"];

  // 2. Dọn phần của ai-kit 2.x: vỏ lệnh/agent có dấu (lệnh nay ở plugin, tên /kit:*), khối ai-kit trong AGENTS.md
  for (const f of v2Shells(root)) {
    out.push({ file: f, action: "remove", note: "vỏ ai-kit 2.x — thay bằng plugin kit" });
    remove(f);
  }
  for (const f of V2.bridgeFiles) {
    const text = read(f);
    const b = text && findBlock(text);
    if (!b) continue;
    const rest = `${text.slice(0, b.start).replace(/\n+$/, "")}${text.slice(b.end).replace(/^\n+/, "\n\n")}`;
    if (rest.trim()) {
      out.push({ file: f, action: "update", note: "gỡ khối ai-kit 2.x (adapter agents-md đã bỏ)" });
      write(f, `${rest.replace(/\n*$/, "")}\n`);
    } else {
      out.push({ file: f, action: "remove", note: "chỉ có khối ai-kit 2.x (adapter agents-md đã bỏ)" });
      remove(f);
    }
  }

  // 3. Phần của kit theo từng công cụ AI: settings (plugin, deny) + khối cầu nối
  const bridged = new Set();
  for (const name of agentNames) {
    const a = await loadAgent(name);
    const s = mergeSettings(read(a.settingsFile), a.settings(kitRelease()), mode);
    const what = mode === "managed" ? "deny (plugin do tổ chức quản lý)" : mode === "keep" ? "plugin, deny (giữ marketplace đã khai)" : `plugin ${kitRelease().ref}, deny`;
    out.push({ file: a.settingsFile, action: s.action, note: s.action === "keep" ? undefined : what });
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

  // 4. .gitignore
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
