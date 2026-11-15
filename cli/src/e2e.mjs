// @ts-check
// kit e2e: điểm cắm của ai-kit vào CI của dự án (và lệnh chạy e2e ở máy). Dự án dựng app trước, rồi gọi:
//   kit e2e none | changed | all | <mã|tên script>…  [--base-url] [--env] [--grep] [--gate|--no-gate]
//                                                    [--close-fixed] [--publish github] [--merge] [--fail-on]
// Thứ tự: chọn feature → gate (TC + script) → chạy run.command → báo cáo (→ comment PR, đóng bug đã hết).
// CI không ghi bug mới: test fail chưa phân loại chỉ được báo; phân loại + ghi bug ở máy (/e2e-triage).
// Xem docs/04-ci-workflow.md.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TafError } from "./config.mjs";
import { fileBugs } from "./bugs.mjs";
import { detect } from "./detect.mjs";
import { gate, GATE_MARKER, gateMarkdown, gateText } from "./gate.mjs";
import { addSummary, prFromEvent, setLabel, setOutput, upsertComment } from "./github.mjs";
import {
  applyTriage,
  buildReport,
  loadResults,
  REPORT_MARKER,
  reportMarkdown,
  reportText,
  resultPath,
  triagePath,
  writeHumanReport,
} from "./report.mjs";
import { appendHistory, applyQuarantine } from "./history.mjs";
import { runTests, scriptFiles, smokeFiles } from "./run.mjs";
import { listScripts } from "./scripts.mjs";
import { parseTestcase, testcasePath } from "./testcase.mjs";

export const SCOPES = ["none", "changed", "all"];
export const FAIL_ON = ["gate", "test", "never"];

/** Đăng lên GitHub (comment, nhãn): lỗi (vd PR từ fork, token chỉ đọc) chỉ cảnh báo, không dừng việc chạy test. */
async function publish(log, what, fn) {
  try {
    await fn();
  } catch (e) {
    log(`⚠ Không ${what} được trên GitHub (${e.message.split("\n")[0]}) — bỏ qua, chạy tiếp`);
  }
}

/** Đăng báo cáo markdown: step summary + comment PR (nếu là sự kiện PR). Lỗi chỉ cảnh báo. */
export async function publishReport(md, log = console.log) {
  addSummary(md);
  if (!process.env.GITHUB_EVENT_NAME?.startsWith("pull_request")) return;
  await publish(log, "comment kết quả", () => upsertComment(prFromEvent().number, REPORT_MARKER, md));
}

const git = (cfg, args) => execFileSync("git", args, { cwd: cfg.root, encoding: "utf8" }).trim();

/** Ngữ cảnh PR: từ sự kiện GitHub (khi publish trong PR), hoặc nhánh hiện tại so với <remote>/<baseBranch>. */
export function prContext(cfg, o = {}) {
  if (o.github && process.env.GITHUB_EVENT_NAME?.startsWith("pull_request")) return prFromEvent();
  const base = o.base || `${cfg.project.remote}/${cfg.project.baseBranch}`;
  let branch = "";
  try {
    branch = git(cfg, ["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {
    /* không phải repo git */
  }
  return { number: null, title: o.title || "", branch, labels: [], base, head: "HEAD" };
}

/** TC đã duyệt có ưu tiên `prio` (vd P1) thuộc feature ngoài `exclude`, và file script chứa chúng. */
export function priorityTests(cfg, exclude, prio) {
  const ids = [];
  const files = [];
  const re = new RegExp(`^${String(prio).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  for (const f of listScripts(cfg)) {
    if (exclude.includes(f) || cfg.adapter.findFeature(f)?.deprecated) continue;
    const tc = testcasePath(cfg, f);
    if (!fs.existsSync(tc)) continue;
    const parsed = parseTestcase(cfg, fs.readFileSync(tc, "utf8"));
    if (parsed.frontmatter?.status !== cfg.labels.approved) continue;
    const mine = parsed.cases.filter((c) => !c.deprecated && c.priority && re.test(c.priority)).map((c) => c.id);
    if (!mine.length) continue;
    ids.push(...mine);
    files.push(...scriptFiles(cfg, [f]));
  }
  return { ids, files };
}

/** "DM-F01", "dm-f01", "DM-F01.spec.mjs", "e2e/scripts/DM-F01.spec.mjs" → "DM-F01". */
export function featureOf(cfg, name) {
  const base = path.basename(name);
  const code = base.endsWith(cfg.scripts.ext) ? base.slice(0, -cfg.scripts.ext.length) : base;
  return code.toUpperCase();
}

/**
 * @param {any} cfg
 * @param {{ scope: string[], baseUrl?: string, env?: string, grep?: string, gate?: boolean, closeFixed?: boolean,
 *   github?: boolean, merge?: boolean, failOn?: string, base?: string, title?: string, log?: (m: string) => void }} o
 * @returns {Promise<{ code: number, features: string[], gate: any, run: any, report: any }>}
 */
export async function e2e(cfg, o) {
  const log = o.log || console.log;
  const failOn = o.failOn || "test";
  if (!FAIL_ON.includes(failOn)) throw new TafError(`--fail-on phải là ${FAIL_ON.join(" | ")}`);
  const scope = o.scope.length ? o.scope : ["changed"];
  const mode = SCOPES.includes(scope[0]) ? scope[0] : "list";
  if (mode !== "list" && scope.length > 1)
    throw new TafError(`"${scope[0]}" không đi kèm mã khác — dùng: none | changed | all | <mã|tên script>…`);

  // 1. Feature trong phạm vi
  let features = [];
  let detectError = null;
  // Chạy trong sự kiện PR thì comment / nhãn đi vào PR, với mọi phạm vi
  let pr = o.github && process.env.GITHUB_EVENT_NAME?.startsWith("pull_request") ? prFromEvent() : null;
  if (mode === "none" || mode === "changed") {
    pr = pr || prContext(cfg, o);
    const d = detect(cfg, pr);
    features = d.features;
    detectError = d.error || null;
    log(`Feature của PR: ${features.join(", ") || "(không có)"}`);
    if (d.unknown?.length) log(`⚠ Mã không có trong spec (bỏ qua): ${d.unknown.join(", ")}`);
  } else if (mode === "all") features = listScripts(cfg);
  else features = [...new Set(scope.map((s) => featureOf(cfg, s)))];

  // 2. Gate
  const doGate = o.gate ?? mode !== "all";
  let g = null;
  if (doGate && (features.length || detectError)) {
    g = features.length ? gate(cfg, features) : { ok: true, results: [] };
    if (detectError) g = { ...g, ok: false, error: detectError };
    log(gateText(g));
    if (detectError) log(`✘ ${detectError}`);
    if (o.github) {
      const md = gateMarkdown(g, cfg.gate.blockedLabel) + (detectError ? `\n✘ ${detectError}\n` : "");
      addSummary(md);
      if (pr?.number) {
        await publish(log, "comment gate", () => upsertComment(pr.number, GATE_MARKER, md));
        await publish(log, "gắn nhãn", () => setLabel(pr.number, cfg.gate.blockedLabel, !g.ok));
      }
    }
  } else if (o.github && pr?.number && doGate) {
    await publish(log, "gỡ nhãn", () => setLabel(pr.number, cfg.gate.blockedLabel, false));
  }

  // 3. Chạy
  let run = null;
  let report = null;
  if (mode !== "none") {
    // Feature [DEPRECATED]: gate bỏ qua, không chạy script của nó
    const live = features.filter((f) => {
      const dep = cfg.adapter.findFeature(f)?.deprecated;
      if (dep) log(`- ${f}: [DEPRECATED] — không chạy script`);
      return !dep;
    });
    let files = mode === "all" ? [] : scriptFiles(cfg, live);
    // changed: luôn kèm bộ smoke (run.smoke) để bắt hồi quy ở feature PR không khai
    if (mode === "changed") {
      const smoke = smokeFiles(cfg).filter((f) => !files.includes(f));
      if (smoke.length) log(`+ smoke (run.smoke): ${smoke.length} file`);
      files = [...files, ...smoke];
    }
    // Lần chạy mới (không --merge): phân loại của lần trước không còn giá trị
    if (!o.merge) fs.rmSync(triagePath(cfg), { force: true });
    run = await runTests(cfg, {
      all: mode === "all",
      files,
      baseUrl: o.baseUrl,
      env: o.env,
      grep: o.grep,
      merge: o.merge,
      shard: o.shard,
      log,
    });
    // changed: lượt hai — TC ưu tiên cao (run.smokePriority, vd P1) của các feature khác, gộp vào kết quả
    if (mode === "changed" && cfg.run.smokePriority && !o.grep) {
      const p1 = priorityTests(cfg, live, cfg.run.smokePriority);
      if (p1.ids.length) {
        log(`+ ${cfg.run.smokePriority} của feature khác: ${p1.ids.length} TC`);
        const r2 = await runTests(cfg, {
          files: p1.files,
          baseUrl: o.baseUrl,
          env: o.env,
          grep: `(${p1.ids.join("|")})\\b`,
          merge: !run.skipped,
          shard: o.shard,
          log,
        });
        run = run.skipped ? r2 : { ...run, code: run.code || r2.code };
      }
    }
    if (run.skipped) log(`Bỏ qua chạy test: ${run.skipped}`);
    else if (!fs.existsSync(run.report))
      throw new TafError(`Lệnh test không ghi JSON report (${run.report}) — mã thoát ${run.code}`);
    else {
      // 4. Báo cáo
      report = buildReport(cfg, {
        results: loadResults(run.report),
        features: mode === "all" ? [] : features,
        env: o.env || "local",
      });
      // TC đã duyệt trong phạm vi mà không có test nào thực sự chạy (thiếu, bị comment, skip / fixme) → tính là fail.
      // Chạy một phần (--grep, --shard) thì bỏ qua kiểm này (shard: kiểm ở bước gộp — kit report --strict).
      if (!o.grep && !o.shard)
        report.unverified = report.features
          .filter((r) => mode === "all" || features.includes(r.feature))
          .filter((r) => r.testcases?.status === cfg.labels.approved && r.testcases.notRun.length)
          .map((r) => ({ feature: r.feature, tcs: r.testcases.notRun }));
      const tp = triagePath(cfg);
      if (o.merge && fs.existsSync(tp)) applyTriage(report, JSON.parse(fs.readFileSync(tp, "utf8")));
      if (!o.merge && !o.grep) appendHistory(cfg, report); // lịch sử chỉ ghi lần chạy đầy đủ, không ghi lần chạy lại một phần
      applyQuarantine(cfg, report);
      for (const p of report.quarantineProblems || []) log(`✘ quarantine: ${p}`);
      for (const q of report.quarantined || []) log(`⊘ đang cách ly: ${q.title} (${q.issue}, tới ${q.until})`);
      for (const x of report.quarantineExpired || []) log(`⚠ cách ly đã hết hạn: ${x}`);
      let issues = {};
      if (o.closeFixed && (o.grep || o.shard))
        log("⚠ Bỏ qua --close-fixed: chạy một phần (--grep / --shard) không đủ căn cứ để đóng issue — đóng ở bước gộp");
      if (o.closeFixed && !o.grep && !o.shard) {
        await publish(log, "đóng issue đã hết", async () => {
          const r = await fileBugs(cfg, report, { closeFixed: true, closeOnly: true, log });
          issues = r.issues;
          report.bugs = r.actions.map((a) => ({ type: a.type, title: a.failure?.title ?? a.key, issue: a.issue?.id ?? null }));
        });
      }
      const out = resultPath(cfg);
      fs.writeFileSync(out, JSON.stringify(report, null, 2));
      log(reportText(report));
      log(`Báo cáo: ${writeHumanReport(cfg, report, reportMarkdown(report, { issues, root: cfg.root }))}`);
      if (o.github) {
        const md = reportMarkdown(report, { issues });
        addSummary(md);
        if (pr?.number) await publish(log, "comment kết quả", () => upsertComment(pr.number, REPORT_MARKER, md));
      }
    }
  }

  const gateFail = g ? !g.ok : false;
  // Lệnh test thoát khác 0 mà không test nào fail (vd globalSetup lỗi, app chưa bật) vẫn là đỏ.
  const testFail =
    !!run &&
    !run.skipped &&
    ((run.code !== 0 && !(report?.totals.quarantined && !report.totals.failed)) ||
      (report?.totals.failed ?? 0) > 0 ||
      (report?.unverified?.length ?? 0) > 0 ||
      (report?.quarantineProblems?.length ?? 0) > 0);
  for (const u of report?.unverified || [])
    log(`✘ ${u.feature}: TC đã duyệt chưa có test thực sự chạy (thiếu, bị comment hoặc skip): ${u.tcs.join(", ")}`);
  if (run && !run.skipped && run.code !== 0 && report && !report.totals.tests)
    log(`✘ Lệnh test thoát mã ${run.code} mà không có test nào chạy — app đã dựng chưa (${o.baseUrl || "chưa truyền --base-url"}), globalSetup có lỗi?`);
  if (o.github) {
    setOutput("features", features);
    setOutput("gate", g ? String(g.ok) : "skipped");
    setOutput("failed", String(report?.totals.failed ?? 0));
  }
  const code =
    failOn === "never" ? 0 : gateFail || (failOn === "test" && testFail) ? 1 : 0;
  return { code, features, gate: g, run, report };
}
