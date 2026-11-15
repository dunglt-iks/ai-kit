// @ts-check
// kit report / kit e2e: đọc JSON report của Playwright → kết quả theo feature (phủ spec, TC, pass/fail),
// danh sách lỗi có fingerprint, result.json, báo cáo markdown (reportsDir), comment PR. Xem docs/07-bug-reporting.md.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { extractFeatures, extractTraces } from "./codes.mjs";
import { rel, TafError } from "./config.mjs";
import { gateFeature } from "./gate.mjs";
import { parseTestcase, testcasePath } from "./testcase.mjs";

export const REPORT_MARKER = "<!-- taf:report -->";
const ANSI = /\u001b\[[0-9;]*m/g;
const TC_ID = /^(TC-(.+?)-\d{3})(?!\d)/;

/** Bỏ màu, giữ phần đầu thông báo lỗi (trước "Call log"). */
export function cleanError(msg) {
  return String(msg || "")
    .replace(ANSI, "")
    .split(/\n\s*Call log:/)[0]
    .trim();
}

/**
 * Chữ ký lỗi để chống trùng bug: các dòng đầu (Error/Locator/Expected), bỏ phần thay đổi
 * giữa các lần chạy (giá trị Received, mã đơn #12, thời gian, id ngẫu nhiên).
 */
export function errorSignature(msg) {
  return cleanError(msg)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^(Error|Locator|Expected)\b/.test(l))
    .map((l) => (l.startsWith("Locator") ? l.replace(/\d+/g, "N") : l))
    .join(" | ")
    .replace(/#\d+/g, "#N")
    .replace(/\b\d+ms\b/g, "Nms")
    .replace(/\b[0-9a-f]{12,}\b/gi, "H")
    .replace(/E2E [^"'\s]*\s?[a-z0-9]{6,}/g, "E2E …");
}

export function fingerprint(key, msg) {
  return crypto
    .createHash("sha1")
    .update(`${key}|${errorSignature(msg)}`)
    .digest("hex")
    .slice(0, 12);
}

/**
 * Danh sách test phẳng từ JSON report của Playwright.
 * @returns {{ title: string, fullTitle: string, file: string, line: number, project: string,
 *   outcome: 'passed'|'failed'|'flaky'|'skipped', error: string, attachments: {name: string, path?: string}[] }[]}
 */
export function flattenResults(json) {
  const out = [];
  const walk = (suite, parents) => {
    for (const spec of suite.specs || [])
      for (const t of spec.tests || []) {
        // Lỗi đã biết: test.fail() (expectedStatus "failed"). Fail đúng như dự kiến → "known";
        // lại pass → "failed" kèm knownFixed (app có thể đã sửa — gỡ dấu lỗi đã biết).
        const expectFail = t.expectedStatus === "failed";
        const note =
          (t.annotations || []).find((a) => a.type === "fail")?.description || "";
        const outcome = expectFail
          ? t.status === "expected"
            ? "known"
            : t.status === "skipped"
              ? "skipped"
              : "failed"
          : {
              expected: "passed",
              unexpected: "failed",
              flaky: "flaky",
              skipped: "skipped",
            }[t.status] || "failed";
        const knownFixed = expectFail && outcome === "failed";
        // annotation "cleanup" do fixture của dự án ghi khi dọn dữ liệu test lỗi
        const cleanup = [...(t.annotations || []), ...(t.results || []).flatMap((r) => r.annotations || [])]
          .filter((a) => a.type === "cleanup")
          .map((a) => a.description || "");
        const failed = (t.results || []).filter(
          (r) => r.status !== "passed" && r.status !== "skipped",
        );
        const last = failed[failed.length - 1];
        out.push({
          title: spec.title,
          fullTitle: [...parents, spec.title].filter(Boolean).join(" › "),
          file: spec.file,
          line: spec.line,
          project: t.projectName,
          outcome,
          error: knownFixed
            ? `Test đánh dấu lỗi đã biết nhưng đã pass — app có thể đã sửa, gỡ dấu lỗi đã biết${note ? ` (${note})` : ""}`
            : last
              ? cleanError(last.error?.message || last.errors?.[0]?.message)
              : "",
          note,
          knownFixed,
          cleanup: [...new Set(cleanup)],
          // bước (test.step) đang chạy khi fail — script đặt tên bước theo bước của TC
          step: (last?.steps || []).find((x) => x.error)?.title || null,
          attachments: (last?.attachments || []).map((a) => ({
            name: a.name,
            path: a.path,
          })),
        });
      }
    for (const s of suite.suites || []) walk(s, [...parents, s.title]);
  };
  for (const s of json.suites || []) walk(s, []);
  return out;
}

export function loadResults(file) {
  if (!fs.existsSync(file))
    throw new TafError(`Không thấy JSON report ${file} — chạy kit e2e trước`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * @param {any} cfg
 * @param {{ results: any, features?: string[], env?: string }} o
 */
export function buildReport(cfg, o) {
  const tests = flattenResults(o.results).map((t) => {
    const m = TC_ID.exec(t.title);
    const tc = m ? m[1] : null;
    const feature = m ? m[2] : extractFeatures(cfg, t.title)[0] || null;
    return {
      ...t,
      tc,
      feature,
      generated: Boolean(m),
      traces: m ? [] : extractTraces(cfg, t.title),
      fingerprint:
        t.outcome === "failed" ? fingerprint(tc || t.title, t.error) : null,
    };
  });
  const features = [
    ...new Set([
      ...(o.features || []),
      ...tests.map((t) => t.feature).filter(Boolean),
    ]),
  ].sort();
  const rows = features.map((code) => {
    const mine = tests.filter((t) => t.feature === code);
    const gen = mine.filter((t) => t.generated);
    const other = mine.filter((t) => !t.generated);
    const count = (list, o) => list.filter((t) => t.outcome === o).length;
    const feature = cfg.adapter.findFeature(code);
    const tcFile = testcasePath(cfg, code);
    let tcs = null;
    let coverage = null;
    if (fs.existsSync(tcFile)) {
      const parsed = parseTestcase(cfg, fs.readFileSync(tcFile, "utf8"));
      const active = parsed.cases.filter((c) => !c.deprecated).map((c) => c.id);
      // TC có test **thực sự chạy**: test bị skip / fixme không tính
      const run = new Set(gen.filter((t) => t.outcome !== "skipped").map((t) => t.tc));
      tcs = {
        total: active.length,
        withTest: active.filter((id) => run.has(id)).length,
        notRun: active.filter((id) => !run.has(id)),
        status: parsed.frontmatter?.status ?? null,
      };
    }
    if (feature) coverage = gateFeature(cfg, code).coverage || null;
    return {
      feature: code,
      name: feature?.name ?? null,
      coverage,
      testcases: tcs,
      generated: {
        total: gen.length,
        passed: count(gen, "passed"),
        failed: count(gen, "failed"),
        flaky: count(gen, "flaky"),
        skipped: count(gen, "skipped"),
        known: count(gen, "known"),
      },
      other: {
        total: other.length,
        passed: count(other, "passed"),
        failed: count(other, "failed"),
      },
    };
  });
  const s = o.results.stats || {};
  return {
    version: 1,
    env: o.env || process.env.TAF_ENV || null,
    commit: process.env.GITHUB_SHA || null,
    run: process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
    createdAt: new Date().toISOString(),
    totals: {
      tests: tests.length,
      passed: tests.filter((t) => t.outcome === "passed").length,
      failed: tests.filter((t) => t.outcome === "failed").length,
      flaky: tests.filter((t) => t.outcome === "flaky").length,
      skipped: tests.filter((t) => t.outcome === "skipped").length,
      known: tests.filter((t) => t.outcome === "known").length,
      durationMs: Math.round(s.duration || 0),
    },
    features: rows,
    cleanup: tests.flatMap((t) => t.cleanup.map((c) => `${t.title}: ${c}`)),
    failures: tests
      .filter((t) => t.outcome === "failed")
      .map(
        ({
          title,
          file,
          line,
          tc,
          feature,
          error,
          fingerprint: fp,
          attachments,
          knownFixed,
          step,
        }) => ({
          step,
          title,
          file,
          line,
          tc,
          feature,
          error,
          fingerprint: fp,
          attachments,
          ...(knownFixed ? { knownFixed: true } : {}),
        }),
      ),
    known: tests
      .filter((t) => t.outcome === "known")
      .map(({ title, file, line, tc, feature, note }) => ({ title, file, line, tc, feature, note })),
    flaky: tests.filter((t) => t.outcome === "flaky").map((t) => t.title),
    tests: tests.map(({ title, file, line, tc, feature, outcome }) => ({
      title,
      file,
      line,
      tc,
      feature,
      outcome,
    })),
  };
}

/** Gắn kết quả triage (triage.json cạnh run.report, do AI ghi) vào từng lỗi. */
export function applyTriage(report, triage) {
  const byTitle = new Map((triage || []).map((t) => [t.test, t]));
  for (const f of report.failures) {
    const t = byTitle.get(f.title);
    // Mục triage chỉ áp cho đúng lỗi đã phân loại: có fingerprint thì phải khớp (test fail lại vì lý do khác → chưa phân loại)
    const ok = t && (!t.fingerprint || t.fingerprint === f.fingerprint);
    f.triage = ok ? { class: t.class, summary: t.summary || "" } : null;
  }
  return report;
}

const pct = (a, b) => (b ? `${a}/${b}` : "—");

export function reportMarkdown(report, extra = {}) {
  const t = report.totals;
  const known = t.known ? ` · ${t.known} lỗi đã biết` : "";
  const head =
    t.failed > 0 || report.unverified?.length
      ? `## E2E-TAF · ✘ ${t.failed} test fail${report.unverified?.length ? ` · ${report.unverified.length} feature có TC chưa chạy` : ""} · ${t.passed}/${t.tests} pass${known}`
      : `## E2E-TAF · ✓ ${t.passed}/${t.tests} pass${known}`;
  const lines = [REPORT_MARKER, head, ""];
  if (report.env)
    lines.push(
      `Môi trường: \`${report.env}\`${report.run ? ` · [run](${report.run})` : ""}`,
      "",
    );
  lines.push(
    "| Feature | Phủ spec | TC có test | Script (pass/fail/flaky/đã biết) | Test khác |",
    "|---|---|---|---|---|",
  );
  for (const r of report.features) {
    const g = r.generated;
    const st = g.total
      ? `${g.passed}/${g.failed}/${g.flaky}/${g.known || 0}${g.failed ? " ✘" : " ✓"}`
      : "—";
    const o = r.other.total
      ? `${r.other.passed}/${r.other.total}${r.other.failed ? " ✘" : ""}`
      : "—";
    lines.push(
      `| ${r.feature}${r.name ? ` ${r.name}` : ""} | ${r.coverage ? pct(r.coverage.covered, r.coverage.required) : "—"} | ${r.testcases ? pct(r.testcases.withTest, r.testcases.total) : "chưa có TC"} | ${st} | ${o} |`,
    );
  }
  if (report.failures.length) {
    lines.push("", "### Test fail", "");
    if (report.failures.some((f) => !f.triage))
      lines.push(
        "> Chưa phân loại: chạy `/e2e-triage` ở máy (tải kết quả lần chạy này về) để phân loại, sửa script hoặc ghi bug.",
        "",
      );
    for (const f of report.failures) {
      const cls = f.triage
        ? ` — **${f.triage.class}**${f.triage.summary ? `: ${f.triage.summary}` : ""}`
        : "";
      const issue = extra.issues?.[f.fingerprint]
        ? ` · #${extra.issues[f.fingerprint]}`
        : "";
      // Báo cáo ở máy (extra.root): kèm đường dẫn trace / ảnh để mở ngay; comment PR thì không (đường dẫn của máy CI)
      const files = extra.root
        ? (f.attachments || [])
            .filter((x) => x.path)
            .map((x) => `${x.name}: \`${path.relative(extra.root, x.path)}\``)
        : [];
      const att = files.length ? `\n\n${files.map((x) => `- ${x}`).join("\n")}` : "";
      lines.push(
        `<details><summary>${f.title}${f.step ? ` — ✘ ${f.step}` : ""}${cls}${issue}</summary>\n\n\`${f.file}:${f.line}\`${f.tc ? ` · ${f.tc}` : ""}${att}\n\n\`\`\`\n${f.error.split("\n").slice(0, 8).join("\n")}\n\`\`\`\n</details>`,
      );
    }
  }
  const tcWrong = report.failures.filter((f) => f.triage?.class === "tc-wrong");
  if (tcWrong.length) {
    lines.push(
      "",
      "### Test case cần xem lại (`tc-wrong`)",
      "",
      "Test fail vì test case mâu thuẫn với spec hiện tại — không phải bug app, không ghi issue. Người review xem lại:",
      "`/testcase <mã>` (đồng bộ TC theo spec) → `kit approve <mã> --testcase` → `/e2e-script <mã>` → `kit e2e <mã>`.",
      "",
      "| TC | Test | Vì sao |",
      "|---|---|---|",
      ...tcWrong.map((f) => `| ${f.tc || "—"} | ${f.title.replace(/\|/g, "\\|")} | ${(f.triage.summary || "").replace(/\|/g, "\\|")} |`),
    );
  }
  if (report.known?.length) {
    lines.push(
      "",
      "### Lỗi đã biết",
      "",
      "Test kiểm đúng TC, fail đúng như dự kiến vì lỗi app đang chờ sửa (`test.fail`). Không tính là pass hay fail.",
      "",
    );
    for (const k of report.known)
      lines.push(`- ${k.title}${k.note ? ` — ${linkify(k.note)}` : ""}`);
  }
  if (report.flaky.length)
    lines.push(
      "",
      `⚠ Flaky (pass ở lần chạy lại): ${report.flaky.join("; ")}`,
    );
  if (report.quarantined?.length || report.quarantineExpired?.length || report.quarantineProblems?.length)
    lines.push(
      "",
      "### Cách ly (quarantine)",
      "",
      ...(report.quarantined || []).map((q) => `- ⊘ ${q.title} — fail, đang cách ly tới ${q.until} (${linkify(q.issue)})${q.reason ? `: ${q.reason}` : ""}`),
      ...(report.quarantineExpired || []).map((x) => `- ⚠ hết hạn cách ly, tính như test thường: ${x}`),
      ...(report.quarantineProblems || []).map((x) => `- ✘ ${x}`),
    );
  if (report.cleanup?.length)
    lines.push(
      "",
      `### ⚠ Dọn dữ liệu test lỗi (${report.cleanup.length})`,
      "",
      "Dữ liệu test còn sót lại trên môi trường — chạy lâu sẽ bẩn dần, test đếm / trạng thái rỗng dễ chập chờn. Xem fixture dọn dữ liệu của dự án.",
      "",
      ...report.cleanup.slice(0, 20).map((c) => `- ${c}`),
    );
  if (report.unverified?.length)
    lines.push(
      "",
      "### ✘ TC đã duyệt chưa có test thực sự chạy (tính là fail)",
      "",
      ...report.unverified.map((u) => `- ${u.feature}: ${u.tcs.join(", ")} — script thiếu test, test bị comment hoặc skip → \`/e2e-script ${u.feature}\``),
    );
  else {
    const notRun = report.features.flatMap((r) => r.testcases?.notRun || []);
    if (notRun.length) lines.push("", `TC chưa có test chạy: ${notRun.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

/** Link issue GitHub dạng ngắn #N trong comment. */
function linkify(s) {
  return s.replace(/https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/(\d+)/g, (u, n) => `[#${n}](${u})`);
}

export function reportText(report) {
  const t = report.totals;
  const out = [
    `${t.passed}/${t.tests} pass, ${t.failed} fail, ${t.flaky} flaky, ${t.skipped} skip${t.known ? `, ${t.known} lỗi đã biết` : ""}`,
  ];
  for (const r of report.features) {
    const g = r.generated;
    out.push(
      `  ${r.feature}: phủ spec ${r.coverage ? pct(r.coverage.covered, r.coverage.required) : "—"}, TC có test ${r.testcases ? pct(r.testcases.withTest, r.testcases.total) : "—"}, script ${g.passed}✓ ${g.failed}✘ ${g.flaky}~${g.known ? ` ${g.known}⊘` : ""}, test khác ${r.other.passed}/${r.other.total}`,
    );
  }
  for (const k of report.known || [])
    out.push(`  ⊘ ${k.title}${k.note ? ` — ${k.note}` : ""}`);
  if (report.cleanup?.length) out.push(`  ⚠ dọn dữ liệu test lỗi: ${report.cleanup.length} (xem báo cáo)`);
  for (const q of report.quarantined || []) out.push(`  ⊘ đang cách ly (fail không tính): ${q.title} — ${q.issue}`);
  for (const f of report.failures.filter((x) => x.triage?.class === "tc-wrong"))
    out.push(`  ✎ TC cần xem lại: ${f.tc || f.title} — ${f.triage.summary || "mâu thuẫn spec"} → /testcase ${f.feature || "<mã>"}`);
  for (const f of report.failures)
    out.push(
      `  ✘ ${f.title} [${f.fingerprint}]${f.triage ? ` — ${f.triage.class}` : ""}${f.step ? `\n      ở: ${f.step}` : ""}\n      ${f.error.split("\n")[0]}`,
    );
  return out.join("\n");
}

export function resultPath(cfg) {
  return path.join(
    path.dirname(path.join(cfg.root, cfg.run.report)),
    "result.json",
  );
}

/**
 * Ghi báo cáo markdown cho người đọc: <reportsDir>/latest.md + <YYYY-MM-DD-HHmm>-<env>.md, giữ run.keepReports file
 * theo thời gian gần nhất. Trả đường dẫn latest.md (tương đối gốc dự án).
 */
export function writeHumanReport(cfg, report, md) {
  const dir = path.join(cfg.root, cfg.run.reportsDir);
  fs.mkdirSync(dir, { recursive: true });
  const d = new Date(report.createdAt || Date.now());
  const p2 = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
  const name = `${stamp}-${String(report.env || "local").replace(/[^\w.-]+/g, "_")}.md`;
  fs.writeFileSync(path.join(dir, name), md);
  fs.writeFileSync(path.join(dir, "latest.md"), md);
  const keep = Math.max(1, Number(cfg.run.keepReports) || 20);
  const old = fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-\d{4}-.+\.md$/.test(f))
    .sort()
    .reverse()
    .slice(keep);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return rel(cfg, path.join(dir, "latest.md"));
}

export function triagePath(cfg) {
  return path.join(
    path.dirname(path.join(cfg.root, cfg.run.report)),
    "triage.json",
  );
}

export { rel };
