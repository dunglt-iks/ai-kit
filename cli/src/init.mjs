// @ts-check
// kit init: nhúng / cập nhật ai-kit trong repo dự án — chạy lại được, kể cả sau khi đổi kitRef.
// - ai-kit.yml (tạo từ mẫu, hoặc chuyển từ e2e/taf.config.yml của TAF 1.x); không bao giờ ghi đè.
// - Dò file hướng dẫn AI sẵn có của repo → `guides`; không sửa nội dung các file đó.
// - Theo `agents`: vỏ lệnh/agent của kit (luôn làm mới file có dấu ai-kit:shell) và khối cầu nối trong file
//   hướng dẫn chính (CLAUDE.md, AGENTS.md). Lệnh trùng tên của repo (không có dấu) giữ nguyên, trừ --force.
// - .gitignore. Không đụng .github/ — CI là của dự án (điểm cắm: kit e2e, docs/04).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { bridgeBlock, upsertBlock } from "./bridge.mjs";
import { findConfig, fromV1 } from "./config.mjs";
import { TafError } from "./errors.mjs";

export const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

export const AGENT_ADAPTERS = ["claude", "agents-md"];

/** Dấu trong vỏ lệnh/agent của kit. File không có dấu là của repo: kit không ghi đè (trừ --force). */
export const SHELL_MARK = "<!-- ai-kit:shell";

const IGNORE = ["/.ai-kit", "/e2e/test-results/"];

/** File hướng dẫn AI đã có trong repo. */
export function detectGuides(root) {
  return GUIDE_CANDIDATES.filter((f) => fs.existsSync(path.join(root, f)));
}

/** Công cụ AI cần cài: luôn có claude; thêm agents-md khi repo đã có file cho công cụ khác. */
export function detectAgents(guides) {
  return guides.some((g) => g !== "CLAUDE.md") ? ["claude", "agents-md"] : ["claude"];
}

/** Nội dung ai-kit.yml mới: mẫu của kit, điền agents + guides dò được. */
export function newConfigText(root) {
  const guides = detectGuides(root);
  const yamlList = (a) => `[${a.join(", ")}]`;
  return fs
    .readFileSync(path.join(KIT, "templates/ai-kit.yml"), "utf8")
    .replace(/^agents: \[claude\]/m, `agents: ${yamlList(detectAgents(guides))}`)
    .replace(/^guides: \[\]/m, `guides: ${yamlList(guides)}`);
}

/** ai-kit.yml chuyển từ taf.config.yml v1: giữ mọi khoá TAF, thêm agents + guides. */
export function convertV1Text(root, v1File) {
  const raw = YAML.parse(fs.readFileSync(v1File, "utf8")) || {};
  const v2 = fromV1(raw);
  const guides = detectGuides(root);
  const { version, agents, ...rest } = v2;
  const out = { version: 2, kitRef: "v2", agents: detectAgents(guides), guides, ...rest };
  return `# ai-kit.yml — chuyển từ ${path.relative(root, v1File)} (TAF 1.x) bởi kit init.
# Kiểm lại rồi xoá file cũ. Lớp quy trình (spec.status, progress, stack…) dùng mặc định:
# xem .ai-kit/templates/ai-kit.yml và .ai-kit/docs/11-cau-hinh.md.
${YAML.stringify(out)}`;
}

async function loadAgent(name) {
  if (!AGENT_ADAPTERS.includes(name))
    throw new TafError(`Không có agent adapter "${name}" (có: ${AGENT_ADAPTERS.join(", ")})`);
  const mod = await import(`../../adapters/agent/${name}.mjs`);
  return mod.createAgentAdapter();
}

/**
 * @param {string} root thư mục dự án
 * @param {{ force?: boolean, dryRun?: boolean }} [o] force: thay cả lệnh trùng tên của repo
 * @returns {Promise<{ file: string, action: 'create'|'overwrite'|'keep'|'update', note?: string }[]>}
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

  // 1. Cấu hình
  const existing = findConfig(root);
  let cfgText;
  if (!existing) {
    cfgText = newConfigText(root);
    out.push({ file: "ai-kit.yml", action: "create" });
    write("ai-kit.yml", cfgText);
  } else if (path.basename(existing) !== "ai-kit.yml") {
    cfgText = convertV1Text(root, existing);
    out.push({
      file: "ai-kit.yml",
      action: "create",
      note: `chuyển từ ${path.relative(root, existing)} — kiểm lại rồi xoá file cũ`,
    });
    write("ai-kit.yml", cfgText);
  } else {
    cfgText = fs.readFileSync(existing, "utf8");
    out.push({ file: "ai-kit.yml", action: "keep" });
  }
  const raw = YAML.parse(cfgText) || {};
  const agentNames = raw.agents ?? ["claude"];

  // 3. Phần của kit theo từng công cụ AI: vỏ lệnh/agent + khối cầu nối
  const bridged = new Set();
  for (const name of agentNames) {
    const a = await loadAgent(name);
    for (const [src, dst] of a.files) {
      const text = fs.readFileSync(path.join(KIT, src), "utf8");
      const to = path.join(root, dst);
      const exists = fs.existsSync(to);
      const cur = exists ? fs.readFileSync(to, "utf8") : null;
      const ours = cur !== null && cur.includes(SHELL_MARK);
      let action;
      if (cur === null) action = "create";
      else if (cur === text) action = "keep";
      else action = o.force || ours ? "overwrite" : "keep";
      out.push({
        file: dst,
        action,
        note:
          action === "keep" && cur !== text
            ? "lệnh riêng của repo (không có dấu ai-kit:shell) — giữ nguyên; --force để thay"
            : undefined,
      });
      if (action === "create" || action === "overwrite") write(dst, text);
    }
    if (bridged.has(a.instructionFile)) continue;
    bridged.add(a.instructionFile);
    const file = path.join(root, a.instructionFile);
    const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const r = upsertBlock(before, bridgeBlock(a.bridgeStyle));
    out.push({
      file: a.instructionFile,
      action: r.action,
      note: r.action === "keep" ? undefined : "khối ai-kit:start/end",
    });
    if (r.action !== "keep") write(a.instructionFile, r.text);
  }

  // 4. .gitignore
  const gi = path.join(root, ".gitignore");
  const current = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
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
