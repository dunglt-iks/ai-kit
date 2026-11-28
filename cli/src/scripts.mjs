// @ts-check
// Script sinh từ TC: chọn feature cần sinh (plan-gen), kiểm script khớp TC (check-script),
// kiểm Claude chỉ ghi vào chỗ được phép (check-paths), cập nhật hash sau khi sửa tay (rehash).
// Xem docs/03-script-generation.md.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { rel, TafError } from "./config.mjs";
import { matchesAny } from "./detect.mjs";
import { scopeOf } from "./codes.mjs";
import { approvalHash, lintTestcase, parseTestcase, testcasePath } from "./testcase.mjs";

const SOURCE = /@taf-source\s+(\S+)\s+sha256:([0-9a-f]+)/;
const TEST_TITLE =
  /\btest(?:\.(only|skip|fixme|fail))?\(\s*[`'"](TC-[A-Za-z0-9-]+?-\d{3})\b/g;

/**
 * Thay comment JS (// … và /* … *\/) bằng khoảng trắng, giữ nguyên xuống dòng (số dòng không đổi) và nội dung chuỗi
 * ('…', "…", `…`). Dùng trước khi dò test, để test bị comment không được tính.
 */
export function stripComments(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += n ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
    } else if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") (out += " "), i++;
    } else if (c === "/" && n === "*") {
      out += "  ";
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) (out += src[i] === "\n" ? "\n" : " "), i++;
      out += i < src.length ? "  " : "";
      i += 2;
    } else {
      if (c === "'" || c === '"' || c === "`") quote = c;
      out += c;
      i++;
    }
  }
  return out;
}

/** Hash nội dung TC (bỏ khoảng trắng cuối dòng). Đổi TC → đổi hash → sinh lại script. */
export function tcHash(text) {
  // Cùng cách băm với approvedHash: bỏ các dòng do việc duyệt ghi, nên duyệt TC không làm script "lệch".
  return approvalHash(text);
}

export function scriptPath(cfg, feature) {
  if (!cfg.scripts.dir)
    throw new TafError("ai-kit.yml chưa khai scripts.dir");
  return path.join(cfg.root, cfg.scripts.dir, scopeOf(cfg, feature), `${feature}${cfg.scripts.ext}`);
}

/** Dòng đầu script phải có: // @taf-source <TC> sha256:<hash> */
export function sourceHeader(cfg, feature) {
  const tc = testcasePath(cfg, feature);
  return `// @taf-source ${rel(cfg, tc)} sha256:${tcHash(fs.readFileSync(tc, "utf8"))}`;
}

export function readSource(text) {
  const m = SOURCE.exec(text);
  return m ? { tc: m[1], hash: m[2] } : null;
}

/**
 * Feature nào cần sinh (lại) script: TC đã duyệt, không lỗi lint, và script chưa có hoặc
 * @taf-source lệch hash TC.
 * @returns {{ feature: string, action: 'new'|'update'|'ok'|'skip', reason: string }[]}
 */
export function planGen(cfg, features) {
  return features.map((feature) => {
    const tc = testcasePath(cfg, feature);
    if (!fs.existsSync(tc))
      return { feature, action: "skip", reason: "chưa có test case" };
    const { parsed, issues } = lintTestcase(cfg, tc);
    if (issues.some((i) => i.level === "error"))
      return { feature, action: "skip", reason: "test case còn lỗi lint" };
    if (parsed.frontmatter?.status !== cfg.labels.approved)
      return { feature, action: "skip", reason: "test case chưa duyệt" };
    if (!parsed.cases.some((c) => !c.deprecated))
      return { feature, action: "skip", reason: "không có TC e2e (mọi mã ngoài phạm vi e2e)" };
    const sp = scriptPath(cfg, feature);
    if (!fs.existsSync(sp))
      return { feature, action: "new", reason: "chưa có script" };
    const src = readSource(fs.readFileSync(sp, "utf8"));
    const hash = tcHash(fs.readFileSync(tc, "utf8"));
    if (!src || src.hash !== hash)
      return {
        feature,
        action: "update",
        reason: `test case đã đổi (${src?.hash ?? "không có @taf-source"} → ${hash})`,
      };
    return { feature, action: "ok", reason: "script khớp test case" };
  });
}

const WEAK = /^(toBeVisible|toContainText|toBeTruthy|toBeDefined|toBeAttached|toBeInViewport)$/;

/**
 * Thống kê assertion trong mã script (đã bỏ comment): theo từng mã TC (khối từ test(...) tới test kế), các lời gọi
 * test.fail(...) và vị trí toContainText.
 */
export function assertionStats(code) {
  const marks = [...code.matchAll(TEST_TITLE)].map((m) => ({ index: m.index, id: m[2] }));
  const byTc = {};
  marks.forEach((m, k) => {
    const block = code.slice(m.index, marks[k + 1]?.index ?? code.length);
    // expect(…), expect.soft(…) và expect.poll(…) (chờ tới khi đúng — Playwright), kể cả `expect\n  .poll(…)` xuống dòng.
    const calls = [...block.matchAll(/\bexpect(?:\s*\.(?:soft|poll))?\([\s\S]*?\)\s*(?:\.not)?\s*\.(\w+)\(/g)].map((x) => x[1]);
    const st = (byTc[m.id] ||= { expects: 0, weak: 0, usesPage: false });
    if (/\{\s*[^}]*\bpage\b[^}]*\}\s*\)\s*=>|\bpage\./.test(block)) st.usesPage = true;
    st.expects += calls.length;
    st.weak += calls.filter((c) => WEAK.test(c)).length;
  });
  const fails = [];
  for (const m of code.matchAll(/\btest\.fail\(/g)) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < code.length; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")" && --depth === 0) break;
    }
    fails.push({ index: m.index, args: code.slice(m.index, Math.min(i + 1, m.index + 600)) });
  }
  const contains = [...code.matchAll(/\.toContainText\(/g)].map((m) => m.index);
  return { byTc, fails, contains };
}

const API_WRITE = /\b(?:request|apiRequest|api)\s*\.\s*(post|put|patch|delete)\s*\(/g;

/**
 * Lời gọi API ghi (request.post / put / patch / delete) trong mã script (đã bỏ comment), kèm mã TC của khối test chứa
 * nó (null = ngoài mọi test: beforeEach, beforeAll, hàm phụ đầu file).
 * @returns {{ index: number, method: string, tc: string | null }[]}
 */
export function apiWrites(code) {
  const marks = [...code.matchAll(TEST_TITLE)].map((m) => ({ index: m.index, id: m[2] }));
  return [...code.matchAll(API_WRITE)].map((m) => {
    const owner = marks.filter((k) => k.index <= m.index).pop();
    return { index: m.index, method: m[1], tc: owner ? owner.id : null };
  });
}

/** Nội dung file ở commit `base` (null nếu chưa có / không phải repo git). */
function committed(cfg, abs, base) {
  try {
    const top = git(cfg.root, ["rev-parse", "--show-toplevel"]).trim();
    const relTop = path.relative(top, fs.realpathSync(abs)).split(path.sep).join("/");
    return execFileSync("git", ["show", `${base}:${relTop}`], { cwd: top, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

/**
 * Kiểm một script: @taf-source khớp TC, mỗi TC (không DEPRECATED) có test, không có test cho
 * TC lạ hoặc DEPRECATED, không có test.only, không chứa mẫu bị cấm (scripts.forbid).
 * @returns {{ file: string, errors: string[], warnings: string[] }}
 */
export function checkScript(cfg, feature, o = {}) {
  const sp = scriptPath(cfg, feature);
  const file = rel(cfg, sp);
  const errors = [];
  const warnings = [];
  if (!fs.existsSync(sp))
    return { file, errors: ["không có script"], warnings };
  const text = fs.readFileSync(sp, "utf8");
  const tcAbs = testcasePath(cfg, feature);
  if (!fs.existsSync(tcAbs))
    return {
      file,
      errors: [`không có test case ${rel(cfg, tcAbs)}`],
      warnings,
    };
  const tcText = fs.readFileSync(tcAbs, "utf8");
  const src = readSource(text);
  if (!src) errors.push("thiếu dòng // @taf-source <TC> sha256:<hash>");
  else {
    if (src.tc !== rel(cfg, tcAbs))
      errors.push(`@taf-source trỏ ${src.tc}, phải là ${rel(cfg, tcAbs)}`);
    if (src.hash !== tcHash(tcText))
      errors.push(
        `@taf-source lệch: test case đã đổi sau khi sinh script (${src.hash} ≠ ${tcHash(tcText)}) — sinh lại (/kit:e2e-script) hoặc \`kit rehash\``,
      );
  }
  const { cases } = parseTestcase(cfg, tcText);
  const active = new Set(cases.filter((c) => !c.deprecated).map((c) => c.id));
  const deprecated = new Set(
    cases.filter((c) => c.deprecated).map((c) => c.id),
  );
  const found = new Set();
  const code = stripComments(text);
  const line = (i) => text.slice(0, i).split("\n").length;
  for (const m of code.matchAll(TEST_TITLE)) {
    const [, mod, id] = m;
    const ln = line(m.index);
    if (mod === "only") errors.push(`dòng ${ln}: không được dùng test.only`);
    if (mod === "skip" || mod === "fixme")
      warnings.push(`dòng ${ln}: ${id} bị test.${mod}`);
    if (deprecated.has(id))
      errors.push(`dòng ${ln}: ${id} đã DEPRECATED, xoá test này`);
    else if (!active.has(id))
      errors.push(`dòng ${ln}: ${id} không có trong test case`);
    found.add(id);
  }
  const missing = [...active].filter((id) => !found.has(id));
  if (missing.length) errors.push(`thiếu test cho: ${missing.join(", ")}`);
  const q = assertionStats(code);
  // test.fail (lỗi đã biết) phải dẫn issue — không thì một test đang bắt bug có thể bị "tắt" lặng lẽ
  for (const f of q.fails)
    if (!/\/issues\/\d+|#\d+/.test(f.args))
      errors.push(`dòng ${line(f.index)}: test.fail phải kèm link issue (vd test.fail(true, "Lỗi app đã biết: <url issue>"))`);
  for (const [id, st] of Object.entries(q.byTc)) {
    if (!active.has(id)) continue;
    if (!st.expects) errors.push(`${id}: không có expect nào — test không kiểm gì`);
    else if (st.expects === st.weak)
      warnings.push(`${id}: chỉ có assertion yếu (toBeVisible / toContainText…) — kiểm đúng giá trị TC ghi (toHaveText, toHaveValue…)`);
  }
  // TC tầng api: kiểm qua `request` (nhanh, ổn định), không mở trình duyệt
  for (const c of cases.filter((x) => !x.deprecated && x.layer === "api"))
    if (q.byTc[c.id]?.usesPage)
      warnings.push(`${c.id}: tầng api nhưng test dùng \`page\` — kiểm qua fixture \`request\`, không mở trình duyệt`);
  // Dữ liệu test dựng qua fixture của dự án (run.setupPaths, scripts.guide), không gọi API ghi thẳng trong script:
  // API đổi chỉ sửa một chỗ, lỗi dựng dữ liệu được tách khỏi lỗi feature. TC tầng api (kiểm chính API đó) thì được.
  const apiTc = new Set(cases.filter((c) => !c.deprecated && c.layer === "api").map((c) => c.id));
  const allApi = active.size > 0 && [...active].every((id) => apiTc.has(id));
  for (const w of apiWrites(code)) {
    if (w.tc ? apiTc.has(w.tc) : allApi) continue;
    errors.push(
      `dòng ${line(w.index)}: ${w.tc ? `${w.tc} ` : ""}gọi API ghi trực tiếp (request.${w.method}) — dựng / dọn dữ liệu qua fixture của dự án (${(cfg.run.setupPaths || []).join(", ") || "e2e/support"}); chỉ TC tầng api mới gọi API trực tiếp`,
    );
  }
  for (const i of q.contains) warnings.push(`dòng ${line(i)}: toContainText — nên toHaveText trên đúng ô / phần tử (khớp chính xác giá trị TC)`);
  // Số expect giảm so với bản đã commit: dấu hiệu test bị nới — người review xem kỹ
  const before = committed(cfg, sp, o.base || "HEAD");
  if (before != null) {
    const old = assertionStats(stripComments(before)).byTc;
    for (const [id, st] of Object.entries(old)) {
      const now = q.byTc[id]?.expects ?? 0;
      if (active.has(id) && now < st.expects)
        warnings.push(`${id}: số expect giảm ${st.expects} → ${now} so với ${o.base || "HEAD"} — kiểm tra test có bị nới không`);
    }
  }
  const lines = code.split("\n"); // đã bỏ comment
  for (const pattern of cfg.scripts.forbid || []) {
    const re = new RegExp(pattern);
    lines.forEach((l, i) => {
      if (re.test(l))
        errors.push(`dòng ${i + 1}: chứa mẫu bị cấm /${pattern}/`);
    });
  }
  return { file, errors, warnings };
}

/** Ghi lại hash @taf-source theo TC hiện tại (sau khi người sửa tay script hoặc TC). */
export function rehash(cfg, feature) {
  const sp = scriptPath(cfg, feature);
  if (!fs.existsSync(sp)) throw new TafError(`Không có ${rel(cfg, sp)}`);
  const text = fs.readFileSync(sp, "utf8");
  const header = sourceHeader(cfg, feature);
  const next = SOURCE.test(text)
    ? text.replace(/\/\/\s*@taf-source.*/, header)
    : `${header}\n${text}`;
  fs.writeFileSync(sp, next);
  return header;
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/**
 * File đã đổi (so với `base`, mặc định HEAD) kể cả file mới chưa track, đường dẫn tương đối gốc
 * dự án. File nằm ngoài gốc dự án mang tiền tố "../".
 */
export function changedFiles(cfg, base = "HEAD") {
  const top = git(cfg.root, ["rev-parse", "--show-toplevel"]).trim();
  const list = [
    ...git(top, ["diff", "--name-only", base]).split("\n"),
    ...git(top, ["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ].filter(Boolean);
  return [...new Set(list)]
    .map((f) =>
      path.relative(fs.realpathSync(cfg.root), path.join(top, f)).split(path.sep).join("/"),
    )
    .sort();
}

/** File đã đổi mà không nằm trong scripts.allowedPaths. */
/**
 * File đã đổi phải nằm trong scripts.allowedPaths. `triage`: thêm `setup` = file fixture (run.setupPaths) bị đổi —
 * /kit:e2e-triage không tự sửa fixture (dễ "nới fixture cho test xanh", che lỗi app); người đồng ý thì kiểm lại không --triage.
 * @param {any} cfg
 * @param {string} [base]
 * @param {{ triage?: boolean }} [o]
 */
export function checkPaths(cfg, base, o = {}) {
  const files = changedFiles(cfg, base);
  const tcDir = `${cfg.testcases.dir.replace(/\/$/, "")}/`;
  /** File TC đổi: chấp nhận khi là nháp, hoặc đã duyệt mà approvedHash còn khớp (người vừa duyệt, chưa commit). */
  const tcOk = (f) => {
    if (!f.startsWith(tcDir) || !f.endsWith(".md")) return false;
    const abs = path.join(cfg.root, f);
    if (!fs.existsSync(abs)) return false;
    return !lintTestcase(cfg, abs).issues.some((i) => /approvedHash/.test(i.msg));
  };
  return {
    files,
    outside: files.filter(
      (f) => f.startsWith("../") || (!matchesAny(f, cfg.scripts.allowedPaths) && !tcOk(f)),
    ),
    setup: o.triage ? files.filter((f) => matchesAny(f, cfg.run.setupPaths || [])) : [],
  };
}

/** Mọi feature đang có script trong scripts.dir (<dir>/<module>/<MÃ><ext>). */
export function listScripts(cfg) {
  if (!cfg.scripts.dir) return [];
  const dir = path.join(cfg.root, cfg.scripts.dir);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(dir, e.name)))
      if (f.endsWith(cfg.scripts.ext)) out.push(f.slice(0, -cfg.scripts.ext.length));
  }
  return out.sort();
}
