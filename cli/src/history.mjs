// @ts-check
// Lịch sử kết quả và cách ly (quarantine) test chập chờn — tất định, không để AI đoán "flaky".
// - run.history (jsonl): mỗi lần chạy một dòng { at, env, commit, tests: { <tên test>: p|f|y|k|s } }, giữ run.keepHistory dòng.
//   Trên CI, giữ file giữa các lần chạy bằng cache (action e2e làm sẵn).
// - kit flaky: tỷ lệ pass / fail / flaky của từng test qua N lần gần nhất.
// - run.quarantine (yaml): [{ test, issue, until, reason }] — test (tên hoặc mã TC) đang cách ly: fail thì báo riêng,
//   không làm đỏ lần chạy, không ghi bug; quá `until` thì hết cách ly. Thiếu issue / until → lỗi cấu hình.
// Xem docs/07-bug-reporting.md.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { TafError } from "./errors.mjs";

const CODE = { passed: "p", failed: "f", flaky: "y", known: "k", skipped: "s" };
const NAME = { p: "passed", f: "failed", y: "flaky", k: "known", s: "skipped" };

/** Ghi một dòng lịch sử cho báo cáo vừa dựng (bỏ qua nếu run.history rỗng). */
export function appendHistory(cfg, report) {
  if (!cfg.run.history) return null;
  const file = path.join(cfg.root, cfg.run.history);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tests = Object.fromEntries((report.tests || []).map((t) => [t.title, CODE[t.outcome] || "f"]));
  const line = JSON.stringify({ at: report.createdAt, env: report.env, commit: report.commit, tests });
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean) : [];
  const keep = Math.max(1, Number(cfg.run.keepHistory) || 50);
  fs.writeFileSync(file, `${[...old, line].slice(-keep).join("\n")}\n`);
  return file;
}

/** Đọc lịch sử (mới nhất cuối). */
export function readHistory(cfg) {
  const file = cfg.run.history && path.join(cfg.root, cfg.run.history);
  if (!file || !fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Thống kê theo test qua `last` lần chạy gần nhất (lọc env nếu có). unstable = vừa có pass vừa có fail / flaky.
 * @returns {{ test: string, runs: number, passed: number, failed: number, flaky: number, unstable: boolean, rate: number }[]}
 */
export function flakyStats(cfg, { last = 20, env } = {}) {
  const runs = readHistory(cfg)
    .filter((r) => !env || r.env === env)
    .slice(-last);
  const by = new Map();
  for (const r of runs)
    for (const [t, c] of Object.entries(r.tests || {})) {
      const s = by.get(t) || { test: t, runs: 0, passed: 0, failed: 0, flaky: 0 };
      s.runs++;
      if (c === "p") s.passed++;
      else if (c === "f") s.failed++;
      else if (c === "y") s.flaky++;
      by.set(t, s);
    }
  return [...by.values()]
    .map((s) => ({
      ...s,
      unstable: s.flaky > 0 || (s.failed > 0 && s.passed > 0),
      rate: s.runs ? (s.failed + s.flaky) / s.runs : 0,
    }))
    .sort((a, b) => b.rate - a.rate || a.test.localeCompare(b.test));
}

export { NAME as OUTCOME_NAMES };

/** Đọc + kiểm danh sách quarantine. @returns {{ entries: any[], problems: string[] }} */
export function loadQuarantine(cfg, today = new Date().toISOString().slice(0, 10)) {
  const file = cfg.run.quarantine && path.join(cfg.root, cfg.run.quarantine);
  if (!file || !fs.existsSync(file)) return { entries: [], problems: [] };
  const raw = YAML.parse(fs.readFileSync(file, "utf8")) || [];
  if (!Array.isArray(raw)) throw new TafError(`${cfg.run.quarantine} phải là danh sách [{ test, issue, until, reason }]`);
  const problems = [];
  const entries = [];
  for (const [i, e] of raw.entries()) {
    const where = `${cfg.run.quarantine} #${i + 1}`;
    if (!e?.test) problems.push(`${where}: thiếu "test" (tên test hoặc mã TC)`);
    else if (!e.issue || !/\/issues\/\d+|#\d+/.test(String(e.issue))) problems.push(`${where} (${e.test}): thiếu "issue" (link / #số)`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.until || ""))) problems.push(`${where} (${e.test}): thiếu "until" (YYYY-MM-DD)`);
    else entries.push({ ...e, test: String(e.test), until: String(e.until), expired: String(e.until) < today });
  }
  return { entries, problems };
}

/**
 * Tách lỗi của test đang cách ly (còn hạn) khỏi `failures` sang `quarantined`; trừ khỏi tổng fail.
 * Mục hết hạn được liệt kê ở `quarantineExpired` (test fail lại như thường).
 */
export function applyQuarantine(cfg, report, today) {
  const { entries, problems } = loadQuarantine(cfg, today);
  report.quarantineProblems = problems;
  if (!entries.length) return report;
  const match = (f, e) => f.title === e.test || f.title.startsWith(`${e.test} `) || f.tc === e.test;
  const active = entries.filter((e) => !e.expired);
  report.quarantineExpired = entries.filter((e) => e.expired).map((e) => `${e.test} (hết hạn ${e.until}, ${e.issue})`);
  const keep = [];
  report.quarantined = [];
  for (const f of report.failures) {
    const e = active.find((x) => match(f, x));
    if (e) report.quarantined.push({ title: f.title, tc: f.tc, issue: e.issue, until: e.until, reason: e.reason || "" });
    else keep.push(f);
  }
  const n = report.failures.length - keep.length;
  report.failures = keep;
  report.totals.failed -= n;
  report.totals.quarantined = n;
  for (const q of report.quarantined) {
    const row = report.features.find((r) => q.tc && q.tc.startsWith(`TC-${r.feature}-`));
    if (row && row.generated.failed > 0) row.generated.failed--;
  }
  return report;
}
