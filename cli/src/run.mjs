// @ts-check
// Chạy lệnh test của dự án (run.command) cho các script được chọn, vào app dự án đã dựng sẵn (địa chỉ qua
// run.baseUrlEnv). Dựng / tắt app, dữ liệu, đăng nhập… là việc của dự án. Xem docs/04-ci-workflow.md.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TafError } from "./config.mjs";
import { globToRegex } from "./detect.mjs";
import { scriptPath } from "./scripts.mjs";

/** File script của các feature (scripts.dir/<module>/<FEATURE><ext>) đang có trên đĩa, tuyệt đối. */
export function scriptFiles(cfg, features) {
  if (!cfg.scripts.dir) return [];
  return features.map((f) => scriptPath(cfg, f)).filter((f) => fs.existsSync(f));
}

/** File khớp run.smoke (glob tương đối gốc dự án), tuyệt đối. Chỉ duyệt từ phần cố định đầu mỗi glob. */
export function smokeFiles(cfg) {
  const out = new Set();
  for (const glob of cfg.run.smoke || []) {
    const fixed = glob.split("/").filter((_, i, a) => !a.slice(0, i + 1).some((p) => /[*?[{]/.test(p))).join("/");
    const re = globToRegex(glob);
    const walk = (d) => {
      if (!fs.existsSync(d)) return;
      if (fs.statSync(d).isFile()) {
        const r = path.relative(cfg.root, d).split(path.sep).join("/");
        if (re.test(r)) out.add(d);
        return;
      }
      for (const e of fs.readdirSync(d)) if (e !== "node_modules") walk(path.join(d, e));
    };
    walk(path.join(cfg.root, fixed));
  }
  return [...out].sort();
}

const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * Thay {files} bằng danh sách file (đã quote), {grep} bằng `--grep '<mẫu>'`; không có chỗ đặt thì nối vào cuối.
 * @param {string} command @param {string[]} files @param {string} [grep]
 */
export function fillFiles(command, files, grep) {
  const list = files.map(quote).join(" ");
  const g = grep ? `--grep ${quote(grep)}` : "";
  let out = command.includes("{files}") ? command.replaceAll("{files}", list) : list ? `${command} ${list}` : command;
  out = out.includes("{grep}") ? out.replaceAll("{grep}", g) : g ? `${out} ${g}` : out;
  return out.replace(/\s+$/, "");
}

/**
 * Môi trường cho lệnh của dự án: không truyền token GitHub của kit (quyền ghi issue / PR) cho code test của PR.
 * Dự án cần token thì tự đặt biến khác trong workflow.
 */
export function childEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  return env;
}

/** Chạy lệnh bằng bash, kế thừa stdout/stderr. Trả mã thoát. */
export function sh(command, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", command], {
      cwd,
      stdio: "inherit",
      env: childEnv(env),
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(127));
  });
}

/**
 * Gộp JSON report mới vào report cũ: spec cùng (file, title) lấy kết quả mới, spec mới thêm
 * vào, thống kê tính lại. Dùng khi chạy lại một phần (triage) mà vẫn giữ kết quả phần còn lại.
 */
export function mergeResults(oldJson, newJson) {
  const fresh = new Map();
  const walk = (suite, fn) => {
    (suite.specs || []).forEach((sp) => fn(sp, suite));
    (suite.suites || []).forEach((s) => walk(s, fn));
  };
  for (const s of newJson.suites || [])
    walk(s, (sp) => fresh.set(`${sp.file}\u0000${sp.title}`, sp));
  const merged = structuredClone(oldJson);
  const used = new Set();
  for (const s of merged.suites || [])
    walk(s, (sp) => {
      const k = `${sp.file}\u0000${sp.title}`;
      if (fresh.has(k)) {
        sp.tests = fresh.get(k).tests;
        sp.ok = fresh.get(k).ok;
        used.add(k);
      }
    });
  for (const s of newJson.suites || []) {
    const extra = structuredClone(s);
    let any = false;
    const prune = (suite) => {
      suite.specs = (suite.specs || []).filter(
        (sp) => !used.has(`${sp.file}\u0000${sp.title}`),
      );
      suite.suites = (suite.suites || []).map(prune).filter(
        (x) => x.specs.length || x.suites.length,
      );
      if (suite.specs.length) any = true;
      return suite;
    };
    prune(extra);
    if (any) merged.suites.push(extra);
  }
  const stats = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  for (const s of merged.suites)
    walk(s, (sp) =>
      (sp.tests || []).forEach((t) => {
        if (t.status in stats) stats[t.status]++;
      }),
    );
  merged.stats = { ...(oldJson.stats || {}), ...stats };
  return merged;
}

/**
 * Chạy run.command cho các file script (rỗng + all = mọi test của lệnh). Ghi JSON report vào run.report.
 * @param {any} cfg
 * @param {{ files?: string[], all?: boolean, baseUrl?: string, env?: string, grep?: string, merge?: boolean, shard?: string,
 *   log?: (m: string) => void }} o files: đường dẫn tuyệt đối
 * @returns {Promise<{ code: number, skipped?: string, report: string, files: string[] }>}
 */
export async function runTests(cfg, o) {
  const log = o.log || console.log;
  if (!cfg.run.command) throw new TafError("ai-kit.yml chưa khai run.command");
  const cwd = path.join(cfg.root, cfg.run.cwd || ".");
  const report = path.join(cfg.root, cfg.run.report);
  if (!o.all && !(o.files || []).length)
    return { code: 0, skipped: "không có script nào để chạy", report, files: [] };
  fs.mkdirSync(path.dirname(report), { recursive: true });
  const previous =
    o.merge && fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, "utf8")) : null;
  fs.rmSync(report, { force: true });
  const files = o.all ? [] : (o.files || []).map((f) => path.relative(cwd, f));
  const env = {
    TAF_ENV: o.env || "local",
    TAF_ROOT: cfg.root,
    PLAYWRIGHT_JSON_OUTPUT_NAME: report,
    ...(o.baseUrl ? { [cfg.run.baseUrlEnv]: o.baseUrl } : {}),
  };
  let cmd = fillFiles(cfg.run.command, files, o.grep);
  if (o.shard) {
    if (!/^\d+\/\d+$/.test(o.shard)) throw new TafError(`--shard phải dạng i/n (vd 2/4), nhận "${o.shard}"`);
    cmd = cmd.includes("{shard}") ? cmd.replaceAll("{shard}", `--shard=${o.shard}`) : `${cmd} --shard=${o.shard}`;
  } else cmd = cmd.replaceAll("{shard}", "");
  log(`$ ${o.baseUrl ? `${cfg.run.baseUrlEnv}=${o.baseUrl} ` : ""}${cmd}`);
  const code = await sh(cmd, { cwd, env });
  // Chạy lại không ra report (app tắt, globalSetup lỗi): giữ nguyên kết quả cũ, không để mất
  if (previous && !fs.existsSync(report)) {
    fs.writeFileSync(report, JSON.stringify(previous, null, 2));
    log("⚠ Lần chạy lại không ghi JSON report — giữ nguyên kết quả trước đó");
    return { code: code || 1, report, files, kept: true };
  }
  if (previous && fs.existsSync(report))
    fs.writeFileSync(
      report,
      JSON.stringify(mergeResults(previous, JSON.parse(fs.readFileSync(report, "utf8"))), null, 2),
    );
  return { code, report, files };
}
