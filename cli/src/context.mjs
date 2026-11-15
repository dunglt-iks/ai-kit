// @ts-check
// kit context: in cấu hình đã giải cho AI đọc ở bước 0 của mọi lệnh quy trình (hai lớp quy định).
// kit doctor: kiểm việc nhúng kit vào repo (cấu hình, guides, vỏ lệnh, khối cầu nối…).
// kit next-code: cấp mã kế tiếp (feature, US, SCR, BR, việc nhỏ) — không để AI tự đoán số.
import fs from "node:fs";
import path from "node:path";
import { bridgeBlock, findBlock } from "./bridge.mjs";
import { rel } from "./config.mjs";
import { TafError } from "./errors.mjs";
import { readyFeature } from "./approve.mjs";
import { AGENT_ADAPTERS, KIT, SHELL_MARK } from "./init.mjs";
import { flatScripts } from "./scripts.mjs";
import { loadQuarantine } from "./history.mjs";

/** Đường dẫn kit nhìn từ gốc dự án (thường là .ai-kit). */
export function kitPath(cfg) {
  const mount = path.join(cfg.root, ".ai-kit");
  try {
    if (fs.realpathSync(mount) === fs.realpathSync(KIT)) return ".ai-kit";
  } catch {}
  const r = path.relative(cfg.root, KIT).split(path.sep).join("/");
  return r && !r.startsWith("..") ? r : KIT;
}

/** Khuôn tài liệu: bản dự án ghi đè (spec.templates) hoặc bản của kit. */
export function templatePaths(cfg) {
  const kit = kitPath(cfg);
  const out = {};
  for (const [k, f] of Object.entries({
    fsd: "fsd.md",
    prd: "prd.md",
    plan: "plan.md",
    prototype: "prototype.html",
  }))
    out[k] = cfg.spec.templates[k] || `${kit}/templates/${f}`;
  return out;
}

/** Feature theo scope, kèm trạng thái duyệt spec / prototype và đã sẵn sàng (kit ready) chưa. */
function featureSummary(cfg, scope) {
  const by = {};
  for (const code of cfg.adapter.listFeatures()) {
    const s = cfg.adapter.scopeOf(code);
    if (scope && s !== scope.toUpperCase()) continue;
    const f = cfg.adapter.findFeature(code);
    (by[s] ||= []).push({
      code,
      name: f?.name ?? "",
      status: f?.deprecated ? "DEPRECATED" : (f?.status ?? null),
      approved: !!f?.approved,
      prototype: f?.prototype?.required ? (f.prototype.approved ? "approved" : "draft") : null,
      ready: !f?.deprecated && readyFeature(cfg, code).ok,
      file: f?.file ?? null,
    });
  }
  return by;
}

/** File hướng dẫn mà công cụ AI tự nạp vào ngữ cảnh (không cần đọc lại ở luồng chính). */
async function autoLoaded(cfg) {
  const out = new Set();
  for (const name of cfg.agents) {
    if (!AGENT_ADAPTERS.includes(name)) continue;
    const a = (await import(`../../adapters/agent/${name}.mjs`)).createAgentAdapter();
    for (const f of a.autoLoads || []) out.add(f);
  }
  return out;
}

/** @param {any} cfg @param {{ scope?: string }} [o] */
export async function buildContext(cfg, o = {}) {
  const kit = kitPath(cfg);
  const auto = await autoLoaded(cfg);
  return {
    configFile: cfg.file ? rel(cfg, cfg.file) : null,
    configVersion: cfg.sourceVersion ?? 2,
    kit,
    cli: `node ${kit}/cli/bin/kit.mjs`,
    language: cfg.language,
    layers: {
      technical: {
        guides: cfg.guides,
        autoLoaded: cfg.guides.filter((g) => auto.has(g)),
        reviewChecklist: cfg.review.checklist,
      },
      process: { rules: `${kit}/RULES.md`, process: `${kit}/process/` },
    },
    project: cfg.project,
    docs: cfg.docs,
    spec: {
      adapter: cfg.spec.adapter,
      roots: cfg.spec.roots,
      featurePattern: cfg.spec.featurePattern,
      status: cfg.spec.status,
      index: cfg.spec.index,
      smallItem: cfg.spec.smallItem,
      plansDir: cfg.spec.plansDir,
      templates: templatePaths(cfg),
      wireframeWidth: cfg.spec.wireframeWidth,
      prototype: cfg.spec.prototype,
    },
    progress: cfg.progress,
    stack: cfg.stack,
    taf: {
      testcases: cfg.testcases.dir,
      scripts: cfg.scripts.dir,
      scriptGuide: cfg.scripts.guide,
      run: cfg.run.command,
      baseUrlEnv: cfg.run.baseUrlEnv,
      skipLabel: cfg.trigger.skipLabel,
      blockedLabel: cfg.gate.blockedLabel,
    },
    scope: o.scope ? o.scope.toUpperCase() : null,
    features: featureSummary(cfg, o.scope),
  };
}

const list = (a) => (a && a.length ? a.join(", ") : "—");

export function contextText(c) {
  const L = [];
  L.push(`# ai-kit context — ${c.configFile ?? "(không có file cấu hình)"}${c.configVersion === 1 ? " (TAF 1.x, nên chuyển sang ai-kit.yml: kit init)" : ""}`);
  L.push(`Ngôn ngữ viết tài liệu, câu hỏi, báo cáo: ${c.language}`);
  L.push(`CLI: ${c.cli}`);
  L.push("");
  L.push("## Lớp kỹ thuật — của repo (code thế nào)");
  const auto = new Set(c.layers.technical.autoLoaded);
  L.push(
    `Đọc trước khi viết/sửa code hoặc test: ${list(c.layers.technical.guides.map((g) => (auto.has(g) ? `${g} (công cụ đã tự nạp — luồng chính không cần đọc lại; agent con vẫn đọc)` : g)))}`,
  );
  if (c.layers.technical.reviewChecklist)
    L.push(`Checklist review riêng: ${c.layers.technical.reviewChecklist}`);
  L.push(`Kiểm tra (stack.checks): ${c.stack.checks.length ? "" : "— (không khai: lấy lệnh từ guides, hỏi nếu không rõ)"}`);
  for (const k of c.stack.checks)
    L.push(`  - ${k.name}: ${k.cwd ? `(cd ${k.cwd}) ` : ""}${k.run}`);
  L.push(`Tìm mã truy vết trong: ${list(c.stack.traceability.searchPaths)}`);
  if (c.stack.env) L.push(`Môi trường e2e ở máy: ${c.stack.env}`);
  L.push("");
  L.push("## Lớp quy trình — của ai-kit (spec, tài liệu, e2e đi đường nào)");
  L.push(`Quy tắc: ${c.layers.process.rules}   Quy trình từng bước: ${c.layers.process.process}`);
  L.push(`Spec: adapter ${c.spec.adapter}, thư mục ${list(c.spec.roots)}, mã feature /${c.spec.featurePattern}/`);
  L.push(`Trạng thái spec: nháp = "${c.spec.status.draft}", đã duyệt = "${c.spec.status.approved}"`);
  if (c.spec.index) L.push(`Đăng ký module: ${c.spec.index}`);
  if (c.spec.smallItem)
    L.push(`Việc nhỏ: mã /${c.spec.smallItem.pattern}/ trong ${c.spec.smallItem.file ?? "?"}`);
  L.push(`Tiến độ: ${c.progress.file ?? "—"} (${c.progress.values.todo} / ${c.progress.values.doing} / ${list(c.progress.values.done)})`);
  L.push(`Kế hoạch: ${c.spec.plansDir}/   Wireframe ≤ ${c.spec.wireframeWidth} ký tự   Prototype: ${c.spec.prototype ? "có" : "không dùng"}`);
  L.push(`Khuôn: ${Object.entries(c.spec.templates).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  L.push(`Change Log: tác giả "${c.docs.author}"; FSD > ${c.docs.splitAt} byte thì tách thư mục`);
  L.push(`Git: nhánh gốc ${c.project.baseBranch}, remote ${c.project.remote}, PR qua ${c.project.prTool}`);
  L.push(`TAF: test case ${c.taf.testcases}/, script ${c.taf.scripts}/${c.taf.scriptGuide ? `, hướng dẫn ${c.taf.scriptGuide}` : ""}, chạy \`kit e2e <mã> --base-url <địa chỉ app>\` (lệnh: ${c.taf.run}; địa chỉ → ${c.taf.baseUrlEnv}), nhãn ${c.taf.skipLabel} / ${c.taf.blockedLabel}`);
  L.push("");
  L.push(`## Feature${c.scope ? ` của ${c.scope}` : " hiện có"} — ✓ spec đã duyệt, P/P✓ prototype nháp/đã duyệt, ▶ sẵn sàng (kit ready)`);
  const scopes = Object.keys(c.features).sort();
  if (!scopes.length) L.push("(chưa có)");
  for (const s of scopes)
    L.push(
      `${s}: ${c.features[s]
        .map((f) =>
          f.status === "DEPRECATED"
            ? `${f.code} ✗`
            : `${f.code}${f.approved ? " ✓" : ` (${f.status ?? "?"})`}${f.prototype ? (f.prototype === "approved" ? " P✓" : " P") : ""}${f.ready ? " ▶" : ""}`,
        )
        .join(", ")}`,
    );
  return L.join("\n");
}

/** Số kế tiếp, đủ `codeDigits` chữ số (vượt thì dài thêm, không bao giờ vòng lại). */
const pad = (cfg, n) => String(n).padStart(cfg.spec.codeDigits || 2, "0");

function maxNum(re, texts) {
  let max = 0;
  for (const t of texts) for (const m of t.matchAll(re)) max = Math.max(max, Number(m[1]));
  return max;
}

function specTexts(cfg) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(fs.readFileSync(p, "utf8"));
    }
  };
  for (const r of cfg.spec.roots) walk(path.join(cfg.root, r));
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Mã kế tiếp. Số đã dùng (kể cả DEPRECATED) không bao giờ cấp lại.
 * @param {any} cfg
 * @param {'F'|'US'|'SCR'|'BR'|'small'} type
 * @param {string} [parent] F, BR: mã module (vd DM); US, SCR: mã feature (vd DM-F01)
 */
export function nextCode(cfg, type, parent) {
  if (type === "small") {
    const si = cfg.spec.smallItem;
    if (!si?.pattern) throw new TafError("ai-kit.yml chưa khai spec.smallItem");
    const prefix = si.pattern.replace(/\\d.*$/, "").replace(/\\/g, "");
    const files = si.file ? [path.join(cfg.root, si.file)] : [];
    const texts = files.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, "utf8"));
    texts.push(...specTexts(cfg));
    const width = Number(/\\d\{(\d+)/.exec(si.pattern)?.[1]) || 2; // theo mẫu của dự án, không theo codeDigits
    return `${prefix}${String(maxNum(new RegExp(`(?<![A-Z0-9])${esc(prefix)}(\\d+)`, "g"), texts) + 1).padStart(width, "0")}`;
  }
  if (!parent) throw new TafError(`next-code ${type} cần mã cha`);
  const p = parent.toUpperCase();
  if (type === "F") {
    const texts = [...cfg.adapter.listFeatures().join("\n").split("\n"), ...specTexts(cfg)];
    return `${p}-F${pad(cfg, maxNum(new RegExp(`(?<![A-Z0-9-])${esc(p)}-F(\\d+)`, "g"), texts) + 1)}`;
  }
  if (type === "BR")
    return `${p}-BR${pad(cfg, maxNum(new RegExp(`(?<![A-Z0-9-])${esc(p)}-BR(\\d+)`, "g"), specTexts(cfg)) + 1)}`;
  if (type === "US" || type === "SCR") {
    if (!cfg.adapter.findFeature(p)) throw new TafError(`Không tìm thấy feature ${p}`);
    return `${p}-${type}${pad(cfg, maxNum(new RegExp(`${esc(p)}-${type}(\\d+)`, "g"), specTexts(cfg)) + 1)}`;
  }
  throw new TafError(`Loại mã không hợp lệ: ${type} (F | US | SCR | BR | small)`);
}

/**
 * Kiểm việc nhúng kit. level error làm doctor thoát 1.
 * @returns {Promise<{ level: 'ok'|'warn'|'error', msg: string }[]>}
 */
export async function doctor(cfg) {
  const out = [];
  const ok = (msg) => out.push({ level: "ok", msg });
  const warn = (msg) => out.push({ level: "warn", msg });
  const error = (msg) => out.push({ level: "error", msg });
  const exists = (p) => fs.existsSync(path.join(cfg.root, p));

  if (cfg.sourceVersion === 1)
    warn(`${rel(cfg, cfg.file)} là cấu hình TAF 1.x — chạy kit init để tạo ai-kit.yml`);
  else ok(`cấu hình ${rel(cfg, cfg.file)}`);

  if (!cfg.guides.length)
    warn("guides rỗng: AI không biết quy định kỹ thuật của repo — khai file hướng dẫn (CLAUDE.md, AGENTS.md…)");
  for (const g of cfg.guides) exists(g) ? ok(`guide ${g}`) : error(`guide không tồn tại: ${g}`);
  if (cfg.review.checklist && !exists(cfg.review.checklist))
    error(`review.checklist không tồn tại: ${cfg.review.checklist}`);

  for (const r of cfg.spec.roots)
    exists(r) ? ok(`spec root ${r}`) : warn(`spec root chưa có: ${r} (/spec sẽ tạo)`);
  for (const [k, f] of Object.entries(cfg.spec.templates))
    if (f && !exists(String(f))) error(`spec.templates.${k} không tồn tại: ${f}`);
  for (const [k, f] of [
    ["spec.index", cfg.spec.index],
    ["spec.smallItem.file", cfg.spec.smallItem?.file],
    ["progress.file", cfg.progress.file],
    ["scripts.guide", cfg.scripts.guide],
  ])
    if (f && !exists(f)) warn(`${k} chưa có: ${f}`);
  if (!Array.isArray(cfg.stack.checks)) error("stack.checks phải là danh sách { name, run, cwd? }");
  else {
    for (const c of cfg.stack.checks)
      if (!c?.name || !c?.run) error(`stack.checks: thiếu name/run: ${JSON.stringify(c)}`);
    if (!cfg.stack.checks.length) warn("stack.checks rỗng: /dev, /ship sẽ phải lấy lệnh kiểm từ guides");
  }

  for (const name of cfg.agents) {
    if (!AGENT_ADAPTERS.includes(name)) {
      error(`agents: không có adapter "${name}" (có: ${AGENT_ADAPTERS.join(", ")})`);
      continue;
    }
    const a = (await import(`../../adapters/agent/${name}.mjs`)).createAgentAdapter();
    for (const [src, dst] of a.files) {
      if (!exists(dst)) {
        error(`${name}: thiếu ${dst} — chạy kit init`);
        continue;
      }
      const cur = fs.readFileSync(path.join(cfg.root, dst), "utf8");
      if (!cur.includes(SHELL_MARK))
        warn(`${name}: ${dst} là lệnh riêng của repo, không phải vỏ của kit — bước này sẽ không theo quy trình ai-kit (đổi tên lệnh của repo, hoặc kit init --force)`);
      else if (cur !== fs.readFileSync(path.join(KIT, src), "utf8"))
        warn(`${name}: ${dst} đã cũ — chạy kit init`);
    }
    const f = path.join(cfg.root, a.instructionFile);
    const text = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
    const b = findBlock(text);
    if (!b) error(`${name}: ${a.instructionFile} chưa có khối ai-kit — chạy kit init`);
    else if (text.slice(b.start, b.end) !== bridgeBlock(a.bridgeStyle))
      warn(`${name}: khối ai-kit trong ${a.instructionFile} đã cũ — chạy kit init`);
    else ok(`${name}: vỏ lệnh + khối cầu nối trong ${a.instructionFile}`);
  }

  if (!cfg.run.command) error("run.command trống: kit e2e không biết chạy test bằng lệnh nào");

  try {
    const { entries, problems } = loadQuarantine(cfg);
    problems.forEach((p) => error(`quarantine: ${p}`));
    entries.filter((e) => e.expired).forEach((e) => warn(`quarantine: ${e.test} hết hạn ${e.until} — sửa xong thì gỡ, chưa thì gia hạn kèm lý do`));
  } catch (e) {
    error(e.message);
  }
  const flat = flatScripts(cfg);
  if (flat.length)
    warn(`${flat.length} script nằm phẳng trong ${cfg.scripts.dir}/ — cấu trúc là ${cfg.scripts.dir}/<module>/<MÃ>${cfg.scripts.ext}; chạy kit init --migrate`);

  const gi = exists(".gitignore") ? fs.readFileSync(path.join(cfg.root, ".gitignore"), "utf8") : "";
  if (!gi.split("\n").some((l) => l.trim().replace(/^\//, "").replace(/\/$/, "") === ".ai-kit"))
    warn(".gitignore chưa có /.ai-kit");

  try {
    const n = cfg.adapter.listFeatures().length;
    ok(`spec adapter ${cfg.spec.adapter}: ${n} feature`);
    for (const [code, where] of Object.entries(cfg.adapter.duplicates?.() || {}))
      error(`mã ${code} khai ở nhiều chỗ: ${where.join(", ")}`);
  } catch (e) {
    error(`spec adapter lỗi: ${e.message}`);
  }
  return out;
}
