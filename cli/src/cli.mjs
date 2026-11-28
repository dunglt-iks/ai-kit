// @ts-check
// Phần chính của CLI kit (gọi từ cli/bin/kit.mjs sau khi kiểm thư viện). Chạy với cwd là gốc repo dự án.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadProject, rel, TafError } from "./config.mjs";
import { gate, gateMarkdown, gateText } from "./gate.mjs";
import { fileBugs } from "./bugs.mjs";
import { initProject, kitRelease } from "./init.mjs";
import { buildContext, contextText, doctor, nextCode } from "./context.mjs";
import { approve, readyFeature } from "./approve.mjs";
import { e2e, gatePr, publishReport } from "./e2e.mjs";
import { appendHistory, applyQuarantine, flakyStats, readHistory } from "./history.mjs";
import { mergeResults } from "./run.mjs";
import {
  applyTriage,
  buildReport,
  loadResults,
  reportMarkdown,
  reportText,
  resultPath,
  triagePath,
  writeHumanReport,
} from "./report.mjs";
import { checkPrototype } from "./prototype.mjs";
import { sh } from "./run.mjs";
import {
  checkPaths,
  checkScript,
  listScripts,
  planGen,
  rehash,
} from "./scripts.mjs";
import {
  lintTestcase,
  loadPersonaNames,
  testcasePath,
} from "./testcase.mjs";

const HELP = `kit <lệnh> [tuỳ chọn]

Nhúng kit, quy trình:
  init                 Nhúng / cập nhật ai-kit trong dự án (cwd hoặc --root), chạy lại được (cả sau khi nâng gói ai-kit):
       [--dry-run]     ai-kit.yml (dò guides), .claude/settings.json (plugin kit theo khoá plugin, deny kit approve), khối
                       cầu nối, .gitignore; gỡ phần của ai-kit 2.x (vỏ ai-kit:shell, khối trong AGENTS.md); rồi tự
                       kiểm (như doctor). Không đụng .github/
  doctor               Kiểm việc nhúng: cấu hình, guides, settings của công cụ AI, khối cầu nối, spec adapter
  context              In cấu hình đã giải (hai lớp quy định) cho AI đọc ở bước 0  [--json] [--scope <module>]
  approve <mã…>        Người duyệt spec (ghi "<đã duyệt> (người, ngày)" vào cột Spec của PRD)
       [--prototype]   Duyệt prototype (cột Prototype + dấu hash màn hình vào PROTOTYPE-*.html)
       [--testcase]    Duyệt test case (status + reviewer trong file TC)
       [--by <tên>]    Mặc định git config user.name
  check-prototype <mã…> Đối chiếu spec ↔ prototype: mỗi SCR có <section id>, mỗi thành phần đánh số có data-ref,
       [--json]        không có màn hình / thành phần lạ. Thoát 1 nếu lệch
  ready <mã…>          Đủ điều kiện viết test case / code chưa: spec + prototype đã duyệt, prototype còn khớp,
       [--json]        mã không trùng. Thoát 1 nếu chưa
  next-code <mã cha>   Mã kế tiếp, không tái dùng số: --type F (mặc định, cha = module, vd DM)
       [--type F|US|SCR|BR|small]   US/SCR: cha = feature (DM-F01); BR: cha = module; small: không cần cha

Điểm cắm CI (và chạy ở máy):
  gate --pr            Kiểm tuân thủ của PR, không chạy test, không cần app: mã feature của PR (PR sửa code mà không
                       khai mã → đỏ), spec / test case đã duyệt, phủ đủ, script khớp TC  [--publish github] [--base] [--title]
  e2e <phạm vi>        Chạy e2e vào app dự án đã dựng. changed: script các feature của nhánh / PR (+ smoke, P1) · all:
                       mọi test · <mã|tên script>…: chỉ các script này. (Gate) → chờ app → chạy run.command → báo cáo
       [--base-url <url>]      địa chỉ app → biến run.baseUrlEnv
       [--env <tên>]           nhãn môi trường trong báo cáo / issue (mặc định local)
       [--grep <mẫu>]          chỉ chạy test có tên khớp
       [--gate | --no-gate]    mặc định: gate trừ phạm vi all
       [--wait <giây>]         chờ app trả lời (mã HTTP < 500) tối đa ngần này; mặc định 0 = thử một lần. --no-wait: bỏ
       [--wait-url <url>]      địa chỉ để chờ (mặc định --base-url)
       [--track]               issue theo dõi "E2E <env> đang đỏ": mở / cập nhật / đóng theo kết quả (cần --env)
       [--close-fixed]         đóng issue có test đã pass lại
       [--publish github]      comment PR, nhãn chặn, step summary
       [--merge]               gộp vào kết quả cũ (chạy lại một phần)
       [--shard i/n]           chạy phần i trong n (song song nhiều máy) → gộp bằng kit report --results a.json b.json
       [--fail-on gate|test|never]   mặc định test
       [--base <ref>] [--title <s>]  ngữ cảnh PR khi chạy ở máy (mặc định <remote>/<baseBranch>, HEAD)

TAF (test case, script, báo cáo, bug):
  spec <mã>            In cấu trúc spec của feature: trạng thái, hash, US/nhánh/SCR cần phủ
       --json          In JSON (dùng cho prompt /kit:testcase)
       --hash          Chỉ in specHash
  lint-tc [file…]      Kiểm cú pháp TC (mặc định: mọi file trong testcases.dir)
  gate <mã…>           Kiểm TC: có, đã duyệt, phủ đủ, không lỗi thời; script có và khớp TC (gate.requireScript)
       [--md <file>]   Ghi báo cáo markdown  [--publish github]: comment PR + nhãn chặn
  plan-gen <mã…>       Feature nào cần sinh (lại) script: TC đã duyệt, script chưa có hoặc lệch hash  [--json]
  check-script [mã…]   Script khớp TC: @taf-source, đủ test cho mỗi TC, không mẫu cấm (mặc định: mọi script)
  check-paths          File đã đổi (so với --base, mặc định HEAD) phải nằm trong scripts.allowedPaths
       [--base <ref>]  [--triage]: fixture (run.setupPaths) bị đổi cũng là lỗi — /kit:e2e-triage hỏi người trước
  lint-script          Chạy lệnh scripts.lint của dự án
  rehash <mã>          Ghi lại hash @taf-source sau khi sửa tay script hoặc TC
  report [mã…]         Đọc JSON report (run.report) → kết quả theo feature (kèm triage.json nếu có), ghi
                       result.json + báo cáo markdown (run.reportsDir/latest.md)
       [--env <tên>] [--results <file>…] [--md <file>] [--json]   nhiều --results: gộp (vd các shard)
       [--strict]      thoát 1 khi có test fail hoặc TC đã duyệt không có test chạy (bước gộp shard)
       [--publish github]  comment PR + step summary
       [--file-bugs]   Ghi bug app (test đã phân loại trong triage.json) vào tracker theo fingerprint
       [--close-fixed] [--dry-run]
  file-bugs            = report --file-bugs (không in bảng)
  flaky                Test fail / chập chờn qua lịch sử (run.history): tỷ lệ theo test  [--last N] [--env <tên>] [--json]
                       — căn cứ để phân loại flaky và đưa vào cách ly (run.quarantine)

Tuỳ chọn chung: --root <thư mục dự án> (mặc định cwd), --config <file> (mặc định ai-kit.yml)`;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    root: { type: "string" },
    config: { type: "string" },
    json: { type: "boolean" },
    hash: { type: "boolean" },
    md: { type: "string" },
    base: { type: "string" },
    title: { type: "string" },
    "base-url": { type: "string" },
    env: { type: "string" },
    grep: { type: "string" },
    gate: { type: "boolean" },
    "no-gate": { type: "boolean" },
    publish: { type: "string" },
    "fail-on": { type: "string" },
    pr: { type: "boolean" },
    wait: { type: "string" },
    "no-wait": { type: "boolean" },
    "wait-url": { type: "string" },
    track: { type: "boolean" },
    shard: { type: "string" },
    merge: { type: "boolean" },
    results: { type: "string", multiple: true },
    strict: { type: "boolean" },
    last: { type: "string" },
    "file-bugs": { type: "boolean" },
    "close-fixed": { type: "boolean" },
    triage: { type: "boolean" },
    "dry-run": { type: "boolean" },
    type: { type: "string" },
    scope: { type: "string" },
    prototype: { type: "boolean" },
    testcase: { type: "boolean" },
    by: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

const [cmd, ...args] = positionals;

function listTestcases(cfg) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md") && e.name !== "README.md") out.push(p);
    }
  };
  walk(path.join(cfg.root, cfg.testcases.dir));
  return out.sort();
}

async function main() {
  if (!cmd || opt.help) {
    console.log(HELP);
    return 0;
  }
  if (cmd === "init") {
    const root = path.resolve(opt.root || process.cwd());
    const res = await initProject(root, { dryRun: opt["dry-run"] });
    for (const r of res)
      console.log(
        `${{ create: "+", keep: "=", update: "~", remove: "-" }[r.action]} ${r.file}${r.note ? ` (${r.note})` : ""}`,
      );
    if (opt["dry-run"]) {
      console.log("\n(--dry-run: chưa ghi gì)");
      return 0;
    }
    console.log("\nKiểm tra:");
    const checks = await doctor(await loadProject({ root }));
    for (const r of checks.filter((x) => x.level !== "ok"))
      console.log(`${r.level === "error" ? "✘" : "⚠"} ${r.msg}`);
    const errors = checks.filter((r) => r.level === "error").length;
    console.log(errors ? `${errors} lỗi — sửa rồi chạy lại kit init` : "✓ kit đã nhúng đúng");
    const { repo, ref } = kitRelease();
    console.log(`
Tiếp theo:
  1. Cài plugin kit cho Claude Code (mỗi người, một lần mỗi bản clone; mở Claude Code ở repo và chấp nhận tin cậy thư
     mục trước để marketplace ai-kit được khai):  claude plugin install kit@ai-kit --scope project
  2. Trong Claude Code chạy /kit:adopt — AI đề xuất giá trị ai-kit.yml theo repo, chỉ chỗ hướng dẫn của repo mâu thuẫn
     với kit; duyệt rồi commit ai-kit.yml, .claude/settings.json, CLAUDE.md, .gitignore, package.json + lockfile.
  3. CI (tuỳ repo): PR → "uses: ${repo}/actions/gate@${ref}"; sau deploy / hằng đêm → "uses: ${repo}/actions/e2e@${ref}"
     — workflow mẫu: docs/04-ci-workflow.md của ai-kit.`);
    return errors ? 1 : 0;
  }

  const cfg = await loadProject({ root: opt.root, config: opt.config });
  const adapter = cfg.adapter;

  if (cmd === "approve") {
    if (!args.length) throw new TafError("approve cần mã feature");
    for (const code of args.map((a) => a.toUpperCase())) {
      const what = opt.testcase ? "testcase" : opt.prototype ? "prototype" : "spec";
      const r = approve(cfg, code, { what, by: opt.by });
      console.log(`✓ ${code} ${what}: ${r.value} → ${r.file}${r.stamped ? ` (dấu màn hình → ${r.stamped})` : ""}`);
      if (r.warning) console.log(`  ⚠ ${r.warning}`);
    }
    return 0;
  }

  if (cmd === "ready") {
    if (!args.length) throw new TafError("ready cần mã feature");
    const res = args.map((a) => readyFeature(cfg, a.toUpperCase()));
    if (opt.json) console.log(JSON.stringify(res, null, 2));
    else
      for (const r of res) {
        console.log(`${r.ok ? "✓" : "✘"} ${r.code}${r.ok ? ": sẵn sàng viết test case và code" : ""}`);
        r.problems.forEach((x) => console.log(`    ✘ ${x}`));
        r.notes.forEach((x) => console.log(`    · ${x}`));
      }
    return res.every((r) => r.ok) ? 0 : 1;
  }

  if (cmd === "check-prototype") {
    if (!args.length) throw new TafError("check-prototype cần mã feature");
    const res = args.map((a) => checkPrototype(cfg, a.toUpperCase()));
    if (opt.json) console.log(JSON.stringify(res, null, 2));
    else
      for (const r of res) {
        const head = r.skipped ? `- ${r.code}: bỏ qua (${r.skipped})` : `${r.errors.length ? "✘" : "✓"} ${r.code}${r.file ? ` ↔ ${r.file}` : ""}`;
        console.log(head);
        r.errors.forEach((x) => console.log(`    ✘ ${x}`));
        r.warnings.forEach((x) => console.log(`    ⚠ ${x}`));
      }
    return res.some((r) => r.errors.length) ? 1 : 0;
  }

  if (cmd === "context") {
    const c = await buildContext(cfg, { scope: opt.scope });
    console.log(opt.json ? JSON.stringify(c, null, 2) : contextText(c));
    return 0;
  }

  if (cmd === "doctor") {
    const res = await doctor(cfg);
    for (const r of res)
      console.log(`${{ ok: "✓", warn: "⚠", error: "✘" }[r.level]} ${r.msg}`);
    const errors = res.filter((r) => r.level === "error").length;
    const warns = res.filter((r) => r.level === "warn").length;
    console.log(`${errors} lỗi, ${warns} cảnh báo`);
    return errors ? 1 : 0;
  }

  if (cmd === "next-code") {
    const type = /** @type {any} */ (opt.type || "F");
    console.log(nextCode(cfg, type === "small" ? "small" : type.toUpperCase(), args[0]));
    return 0;
  }

  if (cmd === "spec") {
    const f = args[0] && adapter.findFeature(args[0].toUpperCase());
    if (!f)
      throw new TafError(`Không tìm thấy feature ${args[0] ?? "(thiếu mã)"}`);
    if (opt.hash) return console.log(f.hash), 0;
    const { text, ...rest } = f;
    const required = adapter.requiredCodes(f);
    if (opt.json)
      return (
        console.log(
          JSON.stringify(
            {
              ...rest,
              required,
              testcaseFile: rel(cfg, testcasePath(cfg, f.code)),
              labels: cfg.labels,
              personas: loadPersonaNames(cfg),
            },
            null,
            2,
          ),
        ),
        0
      );
    console.log(`${f.code} — ${f.name}${f.deprecated ? " [DEPRECATED]" : ""}`);
    console.log(`  spec:      ${f.file}:${f.line}`);
    console.log(
      `  trạng thái: ${f.status ?? "?"} → ${f.approved ? "đã duyệt" : "CHƯA duyệt"}${f.statusFile ? ` (${f.statusFile})` : ""}`,
    );
    console.log(`  specHash:  ${f.hash}`);
    console.log(`  test case: ${rel(cfg, testcasePath(cfg, f.code))}`);
    console.log(`  phải phủ (${required.length}): ${required.join(", ") || "—"}`);
    return 0;
  }

  if (cmd === "lint-tc") {
    const files = args.length
      ? args.map((a) => path.resolve(a))
      : listTestcases(cfg);
    let errors = 0;
    for (const f of files) {
      const { issues } = lintTestcase(cfg, f);
      for (const i of issues) {
        if (i.level === "error") errors++;
        console.log(
          `${rel(cfg, f)}:${i.line} ${i.level === "error" ? "✘" : "⚠"} ${i.msg}`,
        );
      }
    }
    console.log(`${files.length} file, ${errors} lỗi`);
    return errors ? 1 : 0;
  }

  if (cmd === "gate") {
    const codes = args.map((a) => a.toUpperCase());
    if (opt.publish && opt.publish !== "github") throw new TafError("--publish chỉ hỗ trợ github");
    if (opt.pr || opt.publish) {
      const r = await gatePr(cfg, { codes, github: opt.publish === "github", base: opt.base, title: opt.title });
      if (opt.md) fs.writeFileSync(opt.md, gateMarkdown(r.gate, cfg.gate.blockedLabel));
      return r.code;
    }
    if (!codes.length) throw new TafError("gate cần mã feature, hoặc --pr để lấy mã từ PR / nhánh hiện tại");
    const report = gate(cfg, codes);
    console.log(gateText(report));
    if (opt.md) fs.writeFileSync(opt.md, gateMarkdown(report, cfg.gate.blockedLabel));
    return report.ok ? 0 : 1;
  }

  if (cmd === "e2e") {
    if (opt.publish && opt.publish !== "github") throw new TafError("--publish chỉ hỗ trợ github");
    const r = await e2e(cfg, {
      scope: args,
      baseUrl: opt["base-url"],
      env: opt.env,
      grep: opt.grep,
      gate: opt["no-gate"] ? false : opt.gate ? true : undefined,
      closeFixed: opt["close-fixed"],
      github: opt.publish === "github",
      merge: opt.merge,
      failOn: opt["fail-on"],
      shard: opt.shard,
      base: opt.base,
      title: opt.title,
      wait: opt["no-wait"] ? false : opt.wait != null ? Number(opt.wait) : undefined,
      waitUrl: opt["wait-url"],
      track: opt.track,
    });
    return r.code;
  }

  const featureArgs = () => args.map((a) => a.toUpperCase());

  if (cmd === "plan-gen") {
    const plan = planGen(cfg, featureArgs());
    if (opt.json) console.log(JSON.stringify(plan, null, 2));
    else
      for (const p of plan)
        console.log(
          `${{ new: "+", update: "~", ok: "✓", skip: "-" }[p.action]} ${p.feature}: ${p.reason}`,
        );
    return 0;
  }

  if (cmd === "check-script") {
    const list = args.length ? featureArgs() : listScripts(cfg);
    let errors = 0;
    for (const f of list) {
      const r = checkScript(cfg, f);
      errors += r.errors.length;
      console.log(`${r.errors.length ? "✘" : "✓"} ${r.file}`);
      r.errors.forEach((e) => console.log(`    ✘ ${e}`));
      r.warnings.forEach((w) => console.log(`    ⚠ ${w}`));
    }
    console.log(`${list.length} script, ${errors} lỗi`);
    return errors ? 1 : 0;
  }

  if (cmd === "check-paths") {
    const r = checkPaths(cfg, opt.base, { triage: opt.triage });
    for (const f of r.files)
      console.log(`${r.outside.includes(f) || r.setup.includes(f) ? "✘" : "✓"} ${f}`);
    if (r.outside.length)
      console.error(
        `✘ ${r.outside.length} file nằm ngoài scripts.allowedPaths — không được commit`,
      );
    if (r.setup.length)
      console.error(
        `✘ ${r.setup.length} file fixture (run.setupPaths) bị sửa khi triage — dừng, hỏi người dùng: nêu lý do, chứng minh ` +
          `không che lỗi app. Người đồng ý thì kiểm lại bằng kit check-paths (không --triage)`,
      );
    if (r.outside.length || r.setup.length) return 1;
    console.log(`${r.files.length} file, đều trong scripts.allowedPaths`);
    return 0;
  }

  if (cmd === "lint-script") {
    if (!cfg.scripts.lint) return console.log("scripts.lint chưa khai"), 0;
    console.log(`$ ${cfg.scripts.lint}`);
    return sh(cfg.scripts.lint, { cwd: cfg.root, env: {} });
  }

  if (cmd === "rehash") {
    if (!args[0]) throw new TafError("rehash cần mã feature");
    console.log(rehash(cfg, args[0].toUpperCase()));
    return 0;
  }

  if (cmd === "flaky") {
    const stats = flakyStats(cfg, { last: Number(opt.last) || 20, env: opt.env });
    const bad = stats.filter((s) => s.unstable || s.failed);
    if (opt.json) console.log(JSON.stringify(bad, null, 2));
    else if (!stats.length) console.log(`Chưa có lịch sử (${cfg.run.history}) — chạy kit e2e vài lần (CI: action e2e tự giữ bằng cache)`);
    else {
      console.log(`${readHistory(cfg).length} lần chạy trong lịch sử; xét ${Number(opt.last) || 20} lần gần nhất${opt.env ? `, env ${opt.env}` : ""}`);
      for (const s of bad)
        console.log(`${s.unstable ? "~" : "✘"} ${(s.rate * 100).toFixed(0).padStart(3)}%  ${s.passed}✓ ${s.failed}✘ ${s.flaky}~ /${s.runs}  ${s.test}`);
      if (!bad.length) console.log("✓ Không có test fail hay chập chờn");
    }
    return 0;
  }

  if (cmd === "report" || cmd === "file-bugs") {
    // Nhiều --results (vd các shard): gộp thành một, ghi vào run.report để triage / file-bugs dùng tiếp
    const inputs = (opt.results || []).map((f) => path.resolve(f));
    let results = loadResults(inputs[0] || path.join(cfg.root, cfg.run.report));
    for (const f of inputs.slice(1)) results = mergeResults(results, loadResults(f));
    if (inputs.length > 1) {
      const dst = path.join(cfg.root, cfg.run.report);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, JSON.stringify(results, null, 2));
    }
    const report = buildReport(cfg, {
      results,
      features: featureArgs(),
      env: opt.env,
    });
    const tp = triagePath(cfg);
    if (fs.existsSync(tp))
      applyTriage(report, JSON.parse(fs.readFileSync(tp, "utf8")));
    if (inputs.length) appendHistory(cfg, report); // kết quả đưa vào từ ngoài (vd gộp shard) là một lần chạy mới
    applyQuarantine(cfg, report);
    let issues = {};
    if (cmd === "file-bugs" || opt["file-bugs"]) {
      const r = await fileBugs(cfg, report, {
        closeFixed: opt["close-fixed"],
        dryRun: opt["dry-run"],
      });
      issues = r.issues;
      report.bugs = r.actions.map((a) => ({
        type: a.type,
        title: a.failure?.title ?? a.key,
        issue: a.issue?.id ?? issues[a.failure?.fingerprint] ?? null,
      }));
    }
    const out = resultPath(cfg);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    if (cmd === "file-bugs") return 0;
    // --strict (bước gộp của chạy chia shard): TC đã duyệt không có test thực sự chạy → đỏ, như kit e2e
    if (opt.strict)
      report.unverified = report.features
        .filter((r) => r.testcases?.status === cfg.labels.approved && r.testcases.notRun.length)
        .map((r) => ({ feature: r.feature, tcs: r.testcases.notRun }));
    const md = reportMarkdown(report, { issues, root: cfg.root });
    if (opt.md) fs.writeFileSync(opt.md, md);
    const human = writeHumanReport(cfg, report, md);
    if (opt.publish === "github") await publishReport(md);
    if (opt.json) console.log(JSON.stringify(report, null, 2));
    else console.log(`${reportText(report)}\nBáo cáo: ${human}`);
    for (const u of report.unverified || [])
      console.log(`✘ ${u.feature}: TC đã duyệt chưa có test thực sự chạy: ${u.tcs.join(", ")}`);
    return opt.strict && (report.totals.failed > 0 || report.unverified.length) ? 1 : 0;
  }

  throw new TafError(`Không có lệnh "${cmd}". Gõ kit --help`);
}

main().then(
  (code) => process.exit(code ?? 0),
  (e) => {
    console.error(e instanceof TafError ? `kit: ${e.message}` : e);
    process.exit(2);
  },
);
