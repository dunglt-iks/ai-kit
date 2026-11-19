// Lõi TAF không phụ thuộc định dạng spec của app-base: dự án tự viết spec adapter, TC tiếng Anh,
// lệnh chạy test tuỳ ý.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadProject } from "../src/config.mjs";
import { gateFeature } from "../src/gate.mjs";
import { e2e, gatePr } from "../src/e2e.mjs";
import { fillFiles, runTests, scriptFiles } from "../src/run.mjs";
import { approvalHash, lintTestcase } from "../src/testcase.mjs";
/** Mô phỏng người duyệt: ghi approvedHash khớp nội dung (như kit approve --testcase). */
function approved(text) {
  const t = text.replace(/^approvedHash:.*\n/m, "");
  if (!/^status: (Approved|Đã duyệt)$/m.test(t)) return t;
  return t.replace(/\n---\n/, `\napprovedHash: "${approvalHash(t)}"\n---\n`);
}


/** Dự án giả: spec là file JSON, mã feature dạng SHOP-12, nhánh SHOP-12.1, màn hình SHOP-12/S1. */
function makeProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taf-core-"));
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), c);
  }
  return dir;
}

const ADAPTER = `
import fs from "node:fs";
import path from "node:path";
export function createSpecAdapter(cfg) {
  const specs = JSON.parse(fs.readFileSync(path.join(cfg.root, "spec.json"), "utf8"));
  return {
    findFeature: (code) => specs[code] ? { code, name: specs[code].name, file: "spec.json", line: 1,
      deprecated: false, approved: specs[code].approved, status: specs[code].approved ? "ok" : "draft",
      statusFile: "spec.json", hash: "h-" + code, stories: [], screens: [], cases: specs[code].cases } : null,
    listFeatures: () => Object.keys(specs),
    requiredCodes: (f) => f.cases,
    scopeOf: (code) => code.split("-")[0],
    featureRegex: () => /(?<![A-Z0-9])(SHOP-\\d+)(?![0-9.])/g,
    traceRegex: () => /(?<![A-Z0-9])(SHOP-\\d+(?:\\.\\d+|\\/S\\d+)?)(?![0-9])/g,
  };
}`;

const TC = approved(`---
feature: SHOP-12
spec: spec.json
specHash: "h-SHOP-12"
status: Approved
reviewer: qa
persona: buyer
---

## TC-SHOP-12-001 · Checkout
- Trace: SHOP-12.1, SHOP-12/S1

| # | Step | Expected result |
|---|---|---|
| 1 | Pay | Paid |

## Out of e2e scope

| Code | Reason | Covered by |
|---|---|---|
| SHOP-12.2 | API only | unit test |
`);

function shopProject(extra = {}) {
  return makeProject({
    "ai-kit.yml": `version: 2
spec: { adapter: ./taf/adapter.mjs }
testcases: { dir: tc, labels: en, personas: personas.yml }
scripts: { dir: e2e/gen, ext: .spec.js }
run:
  report: out/results.json
  cwd: e2e
  command: echo test $TAF_ENV $APP_URL {files} {grep} >> ../trace.txt && echo '{"suites":[],"stats":{}}' > "$PLAYWRIGHT_JSON_OUTPUT_NAME"
  baseUrlEnv: APP_URL
`,
    "taf/adapter.mjs": ADAPTER,
    "spec.json": JSON.stringify({
      "SHOP-12": {
        name: "Checkout",
        approved: true,
        cases: ["SHOP-12.1", "SHOP-12.2", "SHOP-12/S1"],
      },
    }),
    "personas.yml": "- buyer\n- admin\n",
    "tc/SHOP/SHOP-12.md": TC,
    "e2e/gen/SHOP/SHOP-12.spec.js": "// x\n",
    ...extra,
  });
}

test("adapter của dự án + nhãn tiếng Anh: lint và gate chạy không cần prd-fsd", async () => {
  const cfg = await loadProject({ root: shopProject() });
  const tc = path.join(cfg.root, "tc/SHOP/SHOP-12.md");
  const { issues, parsed } = lintTestcase(cfg, tc);
  assert.deepEqual(issues, []);
  assert.deepEqual(parsed.cases[0].traces, ["SHOP-12.1", "SHOP-12/S1"]);
  cfg.gate.requireScript = false; // test này chỉ xét TC; script xem test plan-gen / check-script
  const r = gateFeature(cfg, "SHOP-12");
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.coverage, { required: 3, covered: 3, missing: [] });

  fs.writeFileSync(
    tc,
    TC.replace("status: Approved", "status: Nháp").replace(
      "persona: buyer",
      "persona: ghost",
    ),
  );
  const msgs = lintTestcase(cfg, tc)
    .issues.map((i) => i.msg)
    .join("\n");
  assert.match(msgs, /"status" phải là Draft hoặc Approved/);
  assert.match(msgs, /Persona "ghost" không có trong personas.yml/);
});

test("adapter sai: báo thiếu hàm, không thấy file", async () => {
  const dir = shopProject({
    "taf/adapter.mjs":
      "export function createSpecAdapter() { return { findFeature() {} }; }",
  });
  await assert.rejects(loadProject({ root: dir }), /thiếu listFeatures\(\)/);
  fs.writeFileSync(
    path.join(dir, "ai-kit.yml"),
    "version: 2\nspec: { adapter: ./khong-co.mjs }\n",
  );
  await assert.rejects(loadProject({ root: dir }), /Không thấy spec adapter/);
});

test("runTests: lệnh của dự án chạy với {files}, {grep}, địa chỉ app, nhãn môi trường; bỏ qua khi không có script", async () => {
  const dir = shopProject();
  const cfg = await loadProject({ root: dir });
  const files = scriptFiles(cfg, ["SHOP-12", "SHOP-99"]);
  const r = await runTests(cfg, { files, baseUrl: "http://app:8080", env: "pr", grep: "TC-SHOP-12-001", log: () => {} });
  assert.equal(r.code, 0);
  assert.deepEqual(r.files, ["gen/SHOP/SHOP-12.spec.js"]);
  assert.equal(
    fs.readFileSync(path.join(dir, "trace.txt"), "utf8"),
    "test pr http://app:8080 gen/SHOP/SHOP-12.spec.js --grep TC-SHOP-12-001\n",
  );
  assert.ok(fs.existsSync(path.join(dir, "out/results.json")));
  assert.match((await runTests(cfg, { files: [], log: () => {} })).skipped, /không có script/);
});

test("kit e2e: danh sách → gate + chạy + báo cáo; all → không gate; kit gate --pr → chỉ gate feature của PR; fail-on", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = shopProject();
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
  g("init", "-q", "-b", "main");
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
  g("checkout", "-qb", "feat/shop-12");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "feat(SHOP-12): x");
  const cfg = await loadProject({ root: dir });
  const log = () => {};

  // script "// x" chưa có @taf-source → gate đỏ (requireScript), vẫn chạy test và ghi báo cáo
  let r = await e2e(cfg, { scope: ["shop-12.spec.js"], env: "pr", log });
  assert.deepEqual(r.features, ["SHOP-12"]);
  assert.equal(r.gate.ok, false);
  assert.equal(r.code, 1);
  assert.ok(r.report);
  assert.ok(fs.existsSync(path.join(dir, "out/result.json")));
  // báo cáo cho người đọc: latest.md + một file theo lần chạy
  const reports = fs.readdirSync(path.join(dir, "e2e/test-results/reports"));
  assert.ok(reports.includes("latest.md"));
  assert.ok(reports.some((f) => /^\d{4}-\d{2}-\d{2}-\d{4}-pr\.md$/.test(f)), reports.join());
  assert.equal((await e2e(cfg, { scope: ["SHOP-12"], failOn: "never", log })).code, 0);

  r = await e2e(cfg, { scope: ["all"], log });
  assert.equal(r.gate, null);
  assert.equal(r.code, 0);

  r = await gatePr(cfg, { base: "main", log });
  assert.deepEqual(r.features, ["SHOP-12"]);
  assert.equal(r.gate.ok, false);
  assert.equal(r.code, 1);
  // phạm vi none đã bỏ — báo dùng kit gate --pr
  await assert.rejects(e2e(cfg, { scope: ["none"], log }), /kit gate --pr/);
  // --track cần tên môi trường
  await assert.rejects(e2e(cfg, { scope: ["all"], track: true, log }), /--track cần --env/);

  await assert.rejects(e2e(cfg, { scope: ["all", "SHOP-12"], log }), /không đi kèm mã khác/);
});

test("fillFiles: quote đường dẫn, không có {files} thì nối cuối", () => {
  assert.equal(
    fillFiles("pw test {files} --x", ["a b.ts", "c'd.ts"]),
    `pw test 'a b.ts' 'c'\\''d.ts' --x`,
  );
  assert.equal(fillFiles("pw test", ["a.ts"]), "pw test 'a.ts'");
  assert.equal(fillFiles("pw test {files}", []), "pw test");
  assert.equal(fillFiles("pw test {files} {grep}", ["a.ts"], "TC-1"), "pw test 'a.ts' --grep 'TC-1'");
});

test("plan-gen / check-script / rehash: script theo TC đã duyệt, phát hiện lệch và lỗi", async () => {
  const { planGen, checkScript, rehash } = await import("../src/scripts.mjs");
  const dir = shopProject({
    "ai-kit.yml": `version: 2
spec: { adapter: ./taf/adapter.mjs }
testcases: { dir: tc, labels: en }
scripts: { dir: e2e/gen, ext: .spec.js, forbid: ['page\\.locator\\('] }
`,
    "e2e/gen/SHOP/SHOP-12.spec.js": `import { test } from "../../fx.js";
test("TC-SHOP-12-001 Checkout", async ({ page }) => { await expect(page).toHaveTitle("x"); });
`,
  });
  const cfg = await loadProject({ root: dir });
  assert.deepEqual(
    planGen(cfg, ["SHOP-12", "SHOP-99"]).map((p) => [p.feature, p.action]),
    [
      ["SHOP-12", "update"],
      ["SHOP-99", "skip"],
    ],
  );
  assert.match(checkScript(cfg, "SHOP-12").errors.join("\n"), /thiếu dòng \/\/ @taf-source/);

  const header = rehash(cfg, "SHOP-12");
  assert.match(header, /^\/\/ @taf-source tc\/SHOP\/SHOP-12.md sha256:[0-9a-f]{16}$/);
  assert.deepEqual(checkScript(cfg, "SHOP-12").errors, []);
  assert.equal(planGen(cfg, ["SHOP-12"])[0].action, "ok");

  // TC đổi: thêm TC-002, đánh DEPRECATED TC-001 → script lệch, thiếu test, test thừa
  const tc = path.join(dir, "tc/SHOP/SHOP-12.md");
  // (người review sửa TC rồi duyệt lại)
  fs.writeFileSync(
    tc,
    approved(fs
      .readFileSync(tc, "utf8")
      .replace("## TC-SHOP-12-001 · Checkout", "## TC-SHOP-12-001 · Checkout [DEPRECATED]")
      .replace(
        "## Out of e2e scope",
        "## TC-SHOP-12-002 · Pay again\n- Trace: SHOP-12.1, SHOP-12/S1\n\n| # | Step | Expected result |\n|---|---|---|\n| 1 | a | b |\n\n## Out of e2e scope",
      )),
  );
  const sp = path.join(dir, "e2e/gen/SHOP/SHOP-12.spec.js");
  fs.appendFileSync(sp, 'test.only("TC-SHOP-12-007 x", async ({ page }) => { page.locator("a"); });\n');
  const errs = checkScript(cfg, "SHOP-12").errors.join("\n");
  assert.match(errs, /@taf-source lệch/);
  assert.match(errs, /TC-SHOP-12-001 đã DEPRECATED/);
  assert.match(errs, /TC-SHOP-12-007 không có trong test case/);
  assert.match(errs, /không được dùng test.only/);
  assert.match(errs, /thiếu test cho: TC-SHOP-12-002/);
  assert.match(errs, /mẫu bị cấm/);
  assert.equal(planGen(cfg, ["SHOP-12"])[0].action, "update");

  fs.writeFileSync(tc, fs.readFileSync(tc, "utf8").replace("status: Approved", "status: Draft"));
  assert.equal(planGen(cfg, ["SHOP-12"])[0].action, "skip");
});

test("check-paths: file ngoài allowedPaths và ngoài thư mục dự án đều bị bắt", async () => {
  const { checkPaths } = await import("../src/scripts.mjs");
  const { execFileSync } = await import("node:child_process");
  const top = fs.mkdtempSync(path.join(os.tmpdir(), "taf-paths-"));
  const proj = path.join(top, "app");
  const files = {
    "taf.config.yml": `version: 1
spec: { adapter: ./taf/adapter.mjs }
scripts: { allowedPaths: ['e2e/gen/**', 'tc/**'] }
`,
    "taf/adapter.mjs": ADAPTER,
    "spec.json": "{}",
    "src/app.js": "1\n",
  };
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(proj, p)), { recursive: true });
    fs.writeFileSync(path.join(proj, p), c);
  }
  const g = (...a) => execFileSync("git", a, { cwd: top, encoding: "utf8" });
  g("init", "-q");
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  const cfg = await loadProject({ root: proj });
  fs.mkdirSync(path.join(proj, "e2e/gen"), { recursive: true });
  fs.writeFileSync(path.join(proj, "e2e/gen/A.spec.js"), "x");
  assert.deepEqual(checkPaths(cfg).outside, []);
  fs.writeFileSync(path.join(proj, "src/app.js"), "2\n");
  fs.writeFileSync(path.join(top, "README.md"), "ngoài dự án");
  assert.deepEqual(checkPaths(cfg).outside, ["../README.md", "src/app.js"]);
});

test("check-paths --triage: fixture (run.setupPaths) bị sửa là lỗi; không --triage thì được", async () => {
  const { checkPaths } = await import("../src/scripts.mjs");
  const { execFileSync } = await import("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taf-triage-"));
  fs.writeFileSync(path.join(dir, "ai-kit.yml"), "version: 2\n");
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
  g("init", "-q");
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  const cfg = await loadProject({ root: dir });
  for (const f of ["e2e/scripts/XX/XX-F01.spec.mjs", "e2e/support/fixtures.ts"]) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), "x");
  }
  const plain = checkPaths(cfg);
  assert.deepEqual(plain.outside, []);
  assert.deepEqual(plain.setup, []);
  const t = checkPaths(cfg, undefined, { triage: true });
  assert.deepEqual(t.outside, []);
  assert.deepEqual(t.setup, ["e2e/support/fixtures.ts"]);
});

test("cấu hình: ai-kit.yml trước, vẫn đọc e2e/taf.config.yml và taf.config.yml (1.x); mặc định đặt mọi thứ dưới e2e/", async () => {
  const { loadConfig } = await import("../src/config.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taf-cfg-"));
  fs.writeFileSync(path.join(dir, "taf.config.yml"), "version: 1\ntestcases: { dir: old }\n");
  assert.equal(loadConfig({ root: dir }).testcases.dir, "old");
  fs.mkdirSync(path.join(dir, "e2e"));
  fs.writeFileSync(path.join(dir, "e2e/taf.config.yml"), "version: 1\n");
  const cfg = loadConfig({ root: dir });
  assert.equal(cfg.file, path.join(dir, "e2e/taf.config.yml"));
  assert.equal(cfg.root, dir); // đường dẫn vẫn tính từ gốc dự án
  assert.equal(cfg.testcases.dir, "e2e/testcases");
  assert.equal(cfg.scripts.dir, "e2e/scripts");
  assert.equal(cfg.scripts.ext, ".spec.mjs");
  assert.deepEqual(cfg.scripts.allowedPaths, ["e2e/scripts/**", "e2e/pages/**", "e2e/support/**"]);
  assert.equal(cfg.run.report, "e2e/test-results/raw/results.json");
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "taf-cfg-"));
  assert.throws(() => loadConfig({ root: empty }), /ai-kit\.yml/);
  fs.writeFileSync(path.join(dir, "ai-kit.yml"), "version: 2\ntestcases: { dir: tc2 }\n");
  assert.equal(loadConfig({ root: dir }).testcases.dir, "tc2");
});

test("migrateScripts: script phẳng → <dir>/<module>/, sửa import tương đối; writeHumanReport giữ keepReports file", async () => {
  const { migrateScripts, flatScripts, listScripts } = await import("../src/scripts.mjs");
  const { writeHumanReport } = await import("../src/report.mjs");
  const dir = shopProject({
    "e2e/gen/SHOP-12.spec.js": `import { test } from "../support/fx.js";\nimport { P } from "./pages/p.js";\n`,
  });
  fs.rmSync(path.join(dir, "e2e/gen/SHOP"), { recursive: true });
  const cfg = await loadProject({ root: dir });
  assert.equal(flatScripts(cfg).length, 1);
  assert.deepEqual(listScripts(cfg), []);
  assert.deepEqual(migrateScripts(cfg, { dryRun: true }), [{ from: "e2e/gen/SHOP-12.spec.js", to: "e2e/gen/SHOP/SHOP-12.spec.js" }]);
  assert.equal(flatScripts(cfg).length, 1); // dry-run không dời
  migrateScripts(cfg);
  assert.deepEqual(flatScripts(cfg), []);
  assert.deepEqual(listScripts(cfg), ["SHOP-12"]);
  assert.equal(
    fs.readFileSync(path.join(dir, "e2e/gen/SHOP/SHOP-12.spec.js"), "utf8"),
    `import { test } from "../../support/fx.js";\nimport { P } from "../pages/p.js";\n`,
  );

  cfg.run.keepReports = 2;
  for (const h of [1, 2, 3])
    writeHumanReport(cfg, { env: "ci", createdAt: new Date(2026, 10, 15, h, 0).toISOString() }, `# lần ${h}\n`);
  const rd = path.join(dir, "e2e/test-results/reports");
  assert.deepEqual(fs.readdirSync(rd).sort(), ["2026-11-15-0200-ci.md", "2026-11-15-0300-ci.md", "latest.md"]);
  assert.equal(fs.readFileSync(path.join(rd, "latest.md"), "utf8"), "# lần 3\n");
});

test("R1 — TC đã duyệt bị sửa: lint / gate / plan-gen báo, check-paths chặn; rehash không lách được; duyệt không làm script lệch", async () => {
  const { planGen, rehash, checkPaths } = await import("../src/scripts.mjs");
  const { execFileSync } = await import("node:child_process");
  const dir = shopProject();
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
  g("init", "-q");
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  const cfg = await loadProject({ root: dir });
  const tc = path.join(dir, "tc/SHOP/SHOP-12.md");
  rehash(cfg, "SHOP-12");
  assert.equal(planGen(cfg, ["SHOP-12"])[0].action, "ok"); // hash script khớp TC đã duyệt
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "rehash");

  // AI sửa kết quả mong đợi của TC đã duyệt, rồi rehash để script "khớp"
  fs.writeFileSync(tc, fs.readFileSync(tc, "utf8").replace("| 1 | Pay | Paid |", "| 1 | Pay | Refunded |"));
  rehash(cfg, "SHOP-12");
  assert.match(lintTestcase(cfg, tc).issues.map((i) => i.msg).join(), /sửa sau khi duyệt/);
  cfg.gate.requireScript = false;
  assert.match(gateFeature(cfg, "SHOP-12").problems.join(), /sửa sau khi duyệt/);
  assert.equal(planGen(cfg, ["SHOP-12"])[0].action, "skip");
  cfg.scripts.allowedPaths = ["e2e/gen/**"];
  assert.deepEqual(checkPaths(cfg).outside, ["tc/SHOP/SHOP-12.md"]);
});

test("R2 — test bị comment không được tính; TC đã duyệt không có test thực sự chạy → kit e2e đỏ (trừ khi --grep)", async () => {
  const { checkScript, rehash, stripComments } = await import("../src/scripts.mjs");
  assert.equal(stripComments('a("//x"); // c\n/* t(\n1) */b').length, 'a("//x"); // c\n/* t(\n1) */b'.length);
  assert.equal(stripComments('a("//x"); // c\n/* t(\n1) */b').replace(/ +/g, " "), 'a("//x"); \n \n b');
  const dir = shopProject({
    "e2e/gen/SHOP/SHOP-12.spec.js": '/* test("TC-SHOP-12-001 Checkout", async () => {}); */\n// test("TC-SHOP-12-001 x", () => {});\n',
  });
  const cfg = await loadProject({ root: dir });
  rehash(cfg, "SHOP-12");
  assert.match(checkScript(cfg, "SHOP-12").errors.join(), /thiếu test cho: TC-SHOP-12-001/);

  // lệnh test không chạy test nào (vd mọi test bị skip): TC đã duyệt không được kiểm → đỏ
  const r = await e2e(cfg, { scope: ["SHOP-12"], gate: false, log: () => {} });
  assert.deepEqual(r.report.unverified, [{ feature: "SHOP-12", tcs: ["TC-SHOP-12-001"] }]);
  assert.equal(r.code, 1);
  const partial = await e2e(cfg, { scope: ["SHOP-12"], gate: false, grep: "TC-SHOP-12-009", log: () => {} });
  assert.equal(partial.report.unverified, undefined);
  assert.equal(partial.code, 0);
});

test("🟡3 — đăng lên GitHub lỗi (token chỉ đọc / mạng) chỉ cảnh báo, test vẫn chạy; lệnh test không nhận GITHUB_TOKEN", async () => {
  const { childEnv } = await import("../src/run.mjs");
  const dir = shopProject();
  const cfg = await loadProject({ root: dir });
  const ev = path.join(dir, "event.json");
  fs.writeFileSync(ev, JSON.stringify({ pull_request: { number: 5, title: "feat(SHOP-12): x", head: { ref: "b", sha: "HEAD" }, base: { sha: "HEAD" }, labels: [] } }));
  const saved = { ...process.env };
  Object.assign(process.env, {
    GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: ev, GITHUB_TOKEN: "t0k3n",
    GITHUB_REPOSITORY: "o/r", GITHUB_API_URL: "http://127.0.0.1:9",
  });
  try {
    assert.equal(childEnv({ A: "1" }).GITHUB_TOKEN, undefined);
    assert.equal(childEnv({ A: "1" }).A, "1");
    const out = [];
    const r = await e2e(cfg, { scope: ["SHOP-12"], github: true, failOn: "never", log: (m) => out.push(m) });
    assert.ok(r.run && !r.run.skipped, "test vẫn chạy");
    assert.match(out.join("\n"), /⚠ Không comment gate được trên GitHub/);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("đợt 2 — feature chỉ kiểm ngoài e2e không bị chặn; --merge giữ kết quả cũ khi chạy lại lỗi; lỗi git báo rõ cách sửa", async () => {
  const { planGen } = await import("../src/scripts.mjs");
  const onlyOut = approved(TC.replace(/## TC-SHOP-12-001[\s\S]*?(?=## Out of e2e scope)/, "").replace(
    "| SHOP-12.2 | API only | unit test |",
    "| SHOP-12.1 | API only | unit test |\n| SHOP-12.2 | API only | unit test |\n| SHOP-12/S1 | no UI | manual |",
  ));
  const dir = shopProject({ "tc/SHOP/SHOP-12.md": onlyOut });
  fs.rmSync(path.join(dir, "e2e/gen/SHOP"), { recursive: true });
  const cfg = await loadProject({ root: dir });
  const lint = lintTestcase(cfg, path.join(dir, "tc/SHOP/SHOP-12.md")).issues;
  assert.deepEqual(lint.filter((i) => i.level === "error"), []);
  assert.match(lint.map((i) => i.msg).join(), /Không có TC e2e/);
  assert.deepEqual(gateFeature(cfg, "SHOP-12").problems, []); // không đòi script
  assert.equal(planGen(cfg, ["SHOP-12"])[0].action, "skip");

  // --merge: lần chạy lại không ghi report → giữ nguyên report cũ
  const report = path.join(dir, "out/results.json");
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(report, '{"suites":[{"title":"old"}],"stats":{}}');
  cfg.run.command = "exit 3";
  const r = await runTests(cfg, { all: true, merge: true, log: () => {} });
  assert.equal(r.kept, true);
  assert.notEqual(r.code, 0);
  assert.match(fs.readFileSync(report, "utf8"), /"old"/);

  // không phải repo git / thiếu nhánh gốc → TafError có hướng dẫn, không phải stack trace
  await assert.rejects(e2e(cfg, { scope: ["changed"], log: () => {} }), /fetch-depth: 0/);
  await assert.rejects(gatePr(cfg, { log: () => {} }), /fetch-depth: 0/);
});

test("check-script — assertion: không expect → lỗi; chỉ assertion yếu / toContainText → cảnh báo; test.fail không link issue → lỗi; số expect giảm so với HEAD → cảnh báo", async () => {
  const { checkScript, rehash } = await import("../src/scripts.mjs");
  const { execFileSync } = await import("node:child_process");
  const strong = 'test("TC-SHOP-12-001 Checkout", async ({ page }) => {\n  await expect(page.getByTestId("total")).toHaveText("45.000");\n  await expect(page.getByTestId("vat")).toHaveText("4.500");\n});\n';
  const dir = shopProject({ "e2e/gen/SHOP/SHOP-12.spec.js": strong });
  const cfg = await loadProject({ root: dir });
  rehash(cfg, "SHOP-12");
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
  g("init", "-q");
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  assert.deepEqual(checkScript(cfg, "SHOP-12"), { file: "e2e/gen/SHOP/SHOP-12.spec.js", errors: [], warnings: [] });

  const sp = path.join(dir, "e2e/gen/SHOP/SHOP-12.spec.js");
  const head = fs.readFileSync(sp, "utf8").split("\n")[0];
  const put = (body) => fs.writeFileSync(sp, `${head}\n${body}`);
  // nới assertion như agent review đã thử: toHaveText("45.000") → toContainText("0"), bỏ một expect
  put('test("TC-SHOP-12-001 Checkout", async ({ page }) => {\n  await expect(page.getByTestId("total")).toContainText("0");\n});\n');
  let r = checkScript(cfg, "SHOP-12");
  assert.deepEqual(r.errors, []);
  const w = r.warnings.join("\n");
  assert.match(w, /chỉ có assertion yếu/);
  assert.match(w, /dòng 3: toContainText/);
  assert.match(w, /số expect giảm 2 → 1 so với HEAD/);

  put('test("TC-SHOP-12-001 Checkout", async ({ page }) => {\n  test.fail(true, "lỗi đã biết");\n  await expect(page.getByTestId("total")).toHaveText("45.000");\n});\n');
  assert.match(checkScript(cfg, "SHOP-12").errors.join(), /test\.fail phải kèm link issue/);
  put('test("TC-SHOP-12-001 Checkout", async ({ page }) => {\n  test.fail(true, "Lỗi app đã biết: https://github.com/o/r/issues/12");\n  await expect(page.getByTestId("total")).toHaveText("45.000");\n});\n');
  assert.deepEqual(checkScript(cfg, "SHOP-12").errors, []);

  put('test("TC-SHOP-12-001 Checkout", async ({ page }) => {\n  await page.goto("/");\n});\n');
  assert.match(checkScript(cfg, "SHOP-12").errors.join(), /TC-SHOP-12-001: không có expect nào/);
});

test("kit e2e changed: chạy script của feature trong PR + bộ smoke (run.smoke); danh sách mã thì không kèm smoke", async () => {
  const { execFileSync } = await import("node:child_process");
  const dir = shopProject({ "e2e/tests/smoke.spec.js": "// smoke\n", "e2e/tests/data.json": "{}" });
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("add", ".");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
  g("checkout", "-qb", "feat/shop-12");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "feat(SHOP-12): x");
  const cfg = await loadProject({ root: dir });
  cfg.run.smoke = ["e2e/tests/**/*.spec.js"];
  await e2e(cfg, { scope: ["changed"], base: "main", gate: false, failOn: "never", log: () => {} });
  assert.match(fs.readFileSync(path.join(dir, "trace.txt"), "utf8"), /gen\/SHOP\/SHOP-12\.spec\.js'? '?tests\/smoke\.spec\.js/);
  fs.rmSync(path.join(dir, "trace.txt"));
  await e2e(cfg, { scope: ["SHOP-12"], gate: false, failOn: "never", log: () => {} });
  assert.doesNotMatch(fs.readFileSync(path.join(dir, "trace.txt"), "utf8"), /smoke/);
});

test("TC tầng (e2e | api): lint nhận api, từ chối unit (đưa ra ngoài phạm vi); check-script cảnh báo TC api mở trình duyệt", async () => {
  const { checkScript, rehash } = await import("../src/scripts.mjs");
  const tcApi = approved(TC.replace("- Trace: SHOP-12.1, SHOP-12/S1", "- Trace: SHOP-12.1, SHOP-12/S1\n- Layer: api"));
  const dir = shopProject({
    "tc/SHOP/SHOP-12.md": tcApi,
    "e2e/gen/SHOP/SHOP-12.spec.js": 'test("TC-SHOP-12-001 Checkout", async ({ page }) => {\n  await page.goto("/");\n  await expect(page.getByTestId("t")).toHaveText("1");\n});\n',
  });
  const cfg = await loadProject({ root: dir });
  const tc = path.join(dir, "tc/SHOP/SHOP-12.md");
  assert.deepEqual(lintTestcase(cfg, tc).issues.filter((i) => i.level === "error"), []);
  rehash(cfg, "SHOP-12");
  assert.match(checkScript(cfg, "SHOP-12").warnings.join(), /tầng api nhưng test dùng `page`/);
  fs.writeFileSync(path.join(dir, "e2e/gen/SHOP/SHOP-12.spec.js"), fs.readFileSync(path.join(dir, "e2e/gen/SHOP/SHOP-12.spec.js"), "utf8").replace(/test\([\s\S]*$/, 'test("TC-SHOP-12-001 Checkout", async ({ request }) => {\n  const r = await request.post("/api/pay");\n  expect(r.status()).toBe(201);\n});\n'));
  assert.deepEqual(checkScript(cfg, "SHOP-12").warnings, []);
  fs.writeFileSync(tc, approved(tcApi.replace("- Layer: api", "- Layer: unit")));
  assert.match(lintTestcase(cfg, tc).issues.map((i) => i.msg).join(), /tầng unit không viết thành TC/);
});

test("đợt B — P1 của feature khác (priorityTests), --shard truyền cho lệnh test, kit report gộp nhiều --results + --strict", async () => {
  const { priorityTests } = await import("../src/e2e.mjs");
  const { execFileSync } = await import("node:child_process");
  const dir = shopProject({ "tc/SHOP/SHOP-12.md": approved(TC.replace("- Trace: SHOP-12.1, SHOP-12/S1", "- Trace: SHOP-12.1, SHOP-12/S1\n- Priority: P1")) });
  const cfg = await loadProject({ root: dir });
  assert.deepEqual(priorityTests(cfg, [], "P1"), { ids: ["TC-SHOP-12-001"], files: [path.join(dir, "e2e/gen/SHOP/SHOP-12.spec.js")] });
  assert.deepEqual(priorityTests(cfg, ["SHOP-12"], "P1").ids, []); // feature trong phạm vi PR: đã chạy đủ
  assert.deepEqual(priorityTests(cfg, [], "P2").ids, []);

  cfg.run.command = cfg.run.command.replace("{grep}", "{grep} {shard}"); // lệnh ghép: đặt chỗ {shard}
  await runTests(cfg, { files: scriptFiles(cfg, ["SHOP-12"]), shard: "2/3", log: () => {} });
  assert.match(fs.readFileSync(path.join(dir, "trace.txt"), "utf8"), /--shard=2\/3/);
  await assert.rejects(runTests(cfg, { files: scriptFiles(cfg, ["SHOP-12"]), shard: "2", log: () => {} }), /i\/n/);

  const res = (title, status) => ({ stats: {}, suites: [{ title: "s", specs: [{ title, file: "s.js", line: 1, tests: [{ status, annotations: [], results: [{ status: status === "expected" ? "passed" : "failed" }] }] }] }] });
  fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify(res("TC-SHOP-12-001 Checkout", "expected")));
  fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify(res("smoke x", "expected")));
  const kit = (...a) => execFileSync("node", [path.join(path.dirname(fileURLToPath(import.meta.url)), "../bin/kit.mjs"), ...a], { cwd: dir, encoding: "utf8" });
  const out = kit("report", "--results", "a.json", "--results", "b.json", "--strict");
  assert.match(out, /2\/2 pass/);
  assert.ok(fs.existsSync(path.join(dir, "out/results.json"))); // bản gộp ghi vào run.report
  fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify(res("smoke x", "unexpected")));
  assert.throws(() => kit("report", "--results", "a.json", "--results", "b.json", "--strict"), (e) => e.status === 1);
});

test("lịch sử + kit flaky + quarantine: test đang cách ly fail không làm đỏ, không thành bug; hết hạn / thiếu issue thì báo", async () => {
  const { flakyStats, readHistory } = await import("../src/history.mjs");
  const { planBugs } = await import("../src/bugs.mjs");
  const { reportMarkdown } = await import("../src/report.mjs");
  const dir = shopProject();
  const res = (status) => ({ stats: {}, suites: [{ title: "s", specs: [{ title: "TC-SHOP-12-001 Checkout", file: "s.js", line: 1, tests: [{ status, annotations: [], results: [{ status: status === "expected" ? "passed" : "failed", error: { message: "Error: x" } }] }] }] }] });
  fs.writeFileSync(path.join(dir, "pass.json"), JSON.stringify(res("expected")));
  fs.writeFileSync(path.join(dir, "fail.json"), JSON.stringify(res("unexpected")));
  const cfg = await loadProject({ root: dir });
  cfg.run.history = "out/history.jsonl";
  const run = async (which, extra = {}) => {
    cfg.run.command = `cp ../${which}.json "$PLAYWRIGHT_JSON_OUTPUT_NAME"; [ ${which} = pass ]`;
    return e2e(cfg, { scope: ["all"], log: () => {}, ...extra });
  };
  assert.equal((await run("pass")).code, 0);
  assert.equal((await run("fail")).code, 1);
  await run("pass");
  assert.equal(readHistory(cfg).length, 3);
  const [s] = flakyStats(cfg);
  assert.deepEqual([s.test, s.runs, s.passed, s.failed, s.unstable], ["TC-SHOP-12-001 Checkout", 3, 2, 1, true]);

  // cách ly còn hạn: fail không làm đỏ, không thành bug
  fs.writeFileSync(path.join(dir, "e2e/quarantine.yml"), "- test: TC-SHOP-12-001\n  issue: https://github.com/o/r/issues/9\n  until: 2999-01-01\n  reason: chập chờn khi tải\n");
  let r = await run("fail");
  assert.equal(r.code, 0);
  assert.equal(r.report.totals.failed, 0);
  assert.equal(r.report.quarantined[0].issue, "https://github.com/o/r/issues/9");
  assert.deepEqual(planBugs(r.report, []).actions, []);
  assert.match(reportMarkdown(r.report), /### Cách ly \(quarantine\)/);
  // hết hạn → fail như thường
  fs.writeFileSync(path.join(dir, "e2e/quarantine.yml"), "- test: TC-SHOP-12-001\n  issue: '#9'\n  until: 2000-01-01\n");
  r = await run("fail");
  assert.equal(r.code, 1);
  assert.match(r.report.quarantineExpired[0], /hết hạn 2000-01-01/);
  // thiếu issue → lỗi cấu hình, đỏ
  fs.writeFileSync(path.join(dir, "e2e/quarantine.yml"), "- test: TC-SHOP-12-001\n  until: 2999-01-01\n");
  r = await run("pass");
  assert.equal(r.code, 1);
  assert.match(r.report.quarantineProblems[0], /thiếu "issue"/);
});

test("check-script: script gọi API ghi trực tiếp → lỗi (dựng dữ liệu qua fixture); TC tầng api thì được", async () => {
  const { checkScript, rehash } = await import("../src/scripts.mjs");
  const dir = shopProject({
    "e2e/gen/SHOP/SHOP-12.spec.js": `import { test, expect } from "../../fx.js";
test("TC-SHOP-12-001 Checkout", async ({ page, request }) => {
  await request.post("/api/orders", { data: {} });
  await expect(page).toHaveTitle("x");
});
`,
  });
  const cfg = await loadProject({ root: dir });
  rehash(cfg, "SHOP-12");
  assert.match(checkScript(cfg, "SHOP-12").errors.join("\n"), /TC-SHOP-12-001 gọi API ghi trực tiếp \(request.post\) — dựng \/ dọn dữ liệu qua fixture/);
  // TC tầng api: kiểm chính API đó → được gọi trực tiếp
  const tc = path.join(dir, "tc/SHOP/SHOP-12.md");
  fs.writeFileSync(tc, approved(fs.readFileSync(tc, "utf8").replace("- Trace: SHOP-12.1, SHOP-12/S1", "- Trace: SHOP-12.1, SHOP-12/S1\n- Layer: api")));
  rehash(cfg, "SHOP-12");
  assert.doesNotMatch(checkScript(cfg, "SHOP-12").errors.join("\n"), /gọi API ghi/);
});
