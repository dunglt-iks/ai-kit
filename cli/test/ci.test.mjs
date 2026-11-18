// Điểm cắm CI: chờ app, issue theo dõi môi trường, lỗi dựng dữ liệu, luật gọi API trong script, workflow mẫu
// trong docs khớp input của action.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { loadProject } from "../src/config.mjs";
import { e2e } from "../src/e2e.mjs";
import { buildReport, reportMarkdown } from "../src/report.mjs";
import { apiWrites } from "../src/scripts.mjs";
import { planTrack, trackLabel, trackMarker } from "../src/track.mjs";
import { waitForApp } from "../src/wait.mjs";

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Server tạm trả mã `status`; trả { url, close }. */
async function server(status) {
  const s = http.createServer((_, res) => res.writeHead(status).end("x"));
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const { port } = /** @type {any} */ (s.address());
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => s.close(r)) };
}

/** Một cổng chắc chắn đang đóng. */
async function closedUrl() {
  const s = await server(200);
  await s.close();
  return s.url;
}

test("waitForApp: mã < 500 là lên (kể cả 401 / 404); 5xx hoặc không kết nối được là không lên", async () => {
  for (const code of [200, 302, 401, 404]) {
    const s = await server(code);
    const r = await waitForApp(s.url);
    await s.close();
    assert.equal(r.ok, true, String(code));
    assert.equal(r.status, code);
  }
  const s = await server(503);
  const r = await waitForApp(s.url, { timeoutSec: 0 });
  await s.close();
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
  const down = await waitForApp(await closedUrl(), { timeoutSec: 1, intervalMs: 200 });
  assert.equal(down.ok, false);
  assert.ok(down.error);
  assert.ok(down.waitedMs >= 800, String(down.waitedMs));
});

async function runProject(command) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-ci-"));
  fs.cpSync(path.join(KIT, "cli/test/fixtures/repo-v1"), dir, { recursive: true });
  const cfg = await loadProject({ root: dir });
  cfg.run.command = command;
  return cfg;
}

test("kit e2e: app không lên → env-down, không chạy lệnh test, thoát 1 (never → 0); --no-wait bỏ kiểm", async () => {
  const cfg = await runProject(`echo ran > ran.txt; echo '{"suites":[],"stats":{}}' > "$PLAYWRIGHT_JSON_OUTPUT_NAME"`);
  const url = await closedUrl();
  const log = () => {};
  let r = await e2e(cfg, { scope: ["all"], baseUrl: url, log });
  assert.equal(r.status, "env-down");
  assert.equal(r.code, 1);
  assert.equal(r.run, null);
  assert.ok(!fs.existsSync(path.join(cfg.root, "ran.txt")));
  assert.equal((await e2e(cfg, { scope: ["all"], baseUrl: url, failOn: "never", log })).code, 0);
  r = await e2e(cfg, { scope: ["all"], baseUrl: url, wait: false, log });
  assert.equal(r.status, "passed");
  assert.ok(fs.existsSync(path.join(cfg.root, "ran.txt")));
  // app lên: chạy bình thường
  const s = await server(200);
  r = await e2e(cfg, { scope: ["all"], baseUrl: s.url, log });
  await s.close();
  assert.equal(r.status, "passed");
});

test("lỗi dựng dữ liệu: test fail mà lỗi nằm trong run.setupPaths → setup, báo cáo tách mục riêng", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-setup-"));
  fs.cpSync(path.join(KIT, "cli/test/fixtures/repo-v1"), dir, { recursive: true });
  const cfg = await loadProject({ root: dir });
  const failed = (title, file) => ({
    title,
    file: "XX/XX-F01.spec.ts",
    line: 3,
    tests: [
      {
        projectName: "chromium",
        status: "unexpected",
        results: [{ status: "failed", error: { message: "Error: boom", location: { file, line: 21, column: 3 } } }],
      },
    ],
  });
  const results = {
    stats: {},
    suites: [
      {
        title: "x",
        specs: [
          failed("TC-XX-F01-001 a", path.join(dir, "e2e/support/fixtures.ts")),
          failed("TC-XX-F01-002 b", path.join(dir, "e2e/scripts/XX/XX-F01.spec.ts")),
        ],
      },
    ],
  };
  const r = buildReport(cfg, { results, env: "dev" });
  assert.equal(r.totals.failed, 2);
  assert.equal(r.totals.setup, 1);
  assert.deepEqual(
    r.failures.map((f) => [f.tc, !!f.setup]),
    [
      ["TC-XX-F01-001", true],
      ["TC-XX-F01-002", false],
    ],
  );
  const md = reportMarkdown(r);
  assert.match(md, /2 test fail \(1 lỗi dựng dữ liệu\)/);
  assert.match(md, /### Lỗi dựng dữ liệu \(fixture\)[\s\S]*TC-XX-F01-001 a/);
  assert.match(md, /### Test fail[\s\S]*TC-XX-F01-002 b[\s\S]*### Lỗi dựng dữ liệu/);
  cfg.run.setupPaths = [];
  assert.equal(buildReport(cfg, { results }).totals.setup, 0);
});

test("issue theo dõi: đỏ → mở; đỏ tiếp → cập nhật + comment fail mới / đã hết; xanh → đóng; xanh không issue → không làm gì", async () => {
  const cfg = await loadProject({ root: path.join(KIT, "cli/test/fixtures/repo-v1") });
  assert.equal(trackLabel(cfg, "dev"), "e2e:dev");
  const report = (titles, setup = []) => ({
    createdAt: "2026-11-18T01:00:00Z",
    totals: { tests: 5, passed: 5 - titles.length, failed: titles.length },
    failures: titles.map((t, i) => ({ title: t, tc: `TC-A-F01-00${i + 1}`, step: "Bước 2", setup: setup.includes(t) })),
  });
  const base = { env: "dev", commit: "abcdef1234", run: "https://gh/run/1", runId: "1" };

  const c = planTrack({ ...base, red: true, report: report(["A", "B"], ["B"]), open: null });
  assert.equal(c.type, "create");
  assert.equal(c.title, "🔴 E2E `dev` đang đỏ");
  assert.ok(c.body.startsWith(trackMarker("dev")));
  assert.match(c.body, /### Test fail \(1\)[\s\S]*\| A \|/);
  assert.match(c.body, /### Lỗi dựng dữ liệu \(1\)[\s\S]*\| B \|/);
  assert.match(c.body, /\/e2e-triage 1/);
  assert.match(c.body, /Đỏ từ:\*\* commit `abcdef1`/);

  const open = { id: 7, body: c.body };
  const u = planTrack({ ...base, commit: "1234567999", red: true, report: report(["B", "C"]), open });
  assert.equal(u.type, "update");
  assert.match(u.comment, /Vẫn đỏ ở commit `1234567`/);
  assert.match(u.comment, /Mới fail \(1\):\*\*\n- C/);
  assert.match(u.comment, /Đã hết \(1\):\*\*\n- A/);
  assert.match(u.body, /Đỏ từ:\*\* commit `abcdef1`/); // giữ mốc bắt đầu đỏ
  const same = planTrack({ ...base, red: true, report: report(["B", "C"]), open: { id: 7, body: u.body } });
  assert.match(same.comment, /không đổi so với lần trước/);

  const x = planTrack({ ...base, red: false, report: report([]), open });
  assert.equal(x.type, "close");
  assert.match(x.comment, /Xanh lại ở commit `abcdef1`/);
  assert.equal(planTrack({ ...base, red: false, report: report([]), open: null }).type, "none");
  // đỏ vì không test nào chạy (globalSetup lỗi)
  const n = planTrack({ ...base, red: true, report: report([]), note: "Lệnh test thoát mã 1 mà không có test nào chạy", open: null });
  assert.match(n.body, /✘ Lệnh test thoát mã 1/);
});

test("apiWrites: lời gọi API ghi trong script, gắn với TC chứa nó; ngoài test → null", () => {
  const code = `
test.beforeEach(async ({ request }) => { await request.post("/api/x"); });
test("TC-A-F01-001 a", async ({ request, page }) => {
  await request.get("/api/ok");
  await page.request.delete("/api/y");
});
test("TC-A-F01-002 b", async ({ request }) => { await request.put("/api/z", {}); });
`;
  assert.deepEqual(
    apiWrites(code).map((w) => [w.method, w.tc]),
    [
      ["post", null],
      ["delete", "TC-A-F01-001"],
      ["put", "TC-A-F01-002"],
    ],
  );
});

test("workflow mẫu trong docs 04: mọi action dùng có thật, mọi input khai trong action.yml", () => {
  const doc = fs.readFileSync(path.join(KIT, "docs/04-ci-workflow.md"), "utf8");
  const blocks = [...doc.matchAll(/```yaml\n([\s\S]*?)```/g)].map((m) => m[1]);
  let checked = 0;
  for (const b of blocks) {
    const y = YAML.parse(b);
    for (const job of Object.values(y?.jobs || {}))
      for (const step of /** @type {any} */ (job).steps || []) {
        const m = /^dunglt-iks\/ai-kit\/actions\/([\w-]+)@/.exec(step?.uses || "");
        if (!m) continue;
        const file = path.join(KIT, "actions", m[1], "action.yml");
        assert.ok(fs.existsSync(file), `không có actions/${m[1]}`);
        const inputs = Object.keys(YAML.parse(fs.readFileSync(file, "utf8")).inputs || {});
        for (const k of Object.keys(step.with || {})) assert.ok(inputs.includes(k), `actions/${m[1]} không có input ${k}`);
        checked++;
      }
  }
  assert.ok(checked >= 2, `chỉ thấy ${checked} bước dùng action của kit trong docs 04`);
});
