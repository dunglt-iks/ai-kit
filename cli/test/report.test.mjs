import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { planBugs } from "../src/bugs.mjs";
import { loadProject } from "../src/config.mjs";
import {
  applyTriage,
  buildReport,
  errorSignature,
  fingerprint,
  flattenResults,
  reportMarkdown,
  reportText,
} from "../src/report.mjs";
import { mergeResults } from "../src/run.mjs";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "repo-taf",
);

async function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taf-rep-"));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return loadProject({ root: dir });
}

const err = (expected, received, id = 12) =>
  `Error: \u001b[2mexpect(\u001b[22mlocator).toHaveText(expected) failed\n\nLocator:  getByTestId('total-${id}')\nExpected: "${expected}"\nReceived: "${received}"\nTimeout:  5000ms\n\nCall log:\n  - waiting`;

const spec = (title, status, message, file = "generated/XX-F01.spec.mjs") => ({
  title,
  file,
  line: 3,
  tests: [
    {
      projectName: "chromium",
      status,
      results:
        status === "expected"
          ? [{ status: "passed" }]
          : status === "flaky"
            ? [{ status: "failed", error: { message } }, { status: "passed" }]
            : [
                {
                  status: "failed",
                  error: { message },
                  attachments: [{ name: "screenshot", path: "/tmp/a.png" }],
                },
              ],
    },
  ],
});

const RESULTS = {
  stats: { duration: 1234 },
  suites: [
    {
      title: "generated/XX-F01.spec.mjs",
      specs: [
        spec("TC-XX-F01-001 Tạo đơn", "expected"),
        spec("TC-XX-F01-002 Tổng tiền", "unexpected", err("45.000", "50.000")),
      ],
      suites: [
        {
          title: "manager",
          specs: [spec("TC-XX-F01-003 Quyền", "flaky", "x")],
        },
      ],
    },
    {
      title: "smoke.spec.mjs",
      specs: [
        spec("smoke XX-F01-SCR01: mở được", "expected", null, "smoke.spec.mjs"),
      ],
    },
  ],
};

test("flattenResults: test lồng trong describe, outcome, lỗi bỏ màu và call log", () => {
  const t = flattenResults(RESULTS);
  assert.deepEqual(
    t.map((x) => [x.title, x.outcome]),
    [
      ["TC-XX-F01-001 Tạo đơn", "passed"],
      ["TC-XX-F01-002 Tổng tiền", "failed"],
      ["TC-XX-F01-003 Quyền", "flaky"],
      ["smoke XX-F01-SCR01: mở được", "passed"],
    ],
  );
  assert.equal(
    t[2].fullTitle,
    "manager › TC-XX-F01-003 Quyền",
  );
  assert.doesNotMatch(t[1].error, /\u001b|Call log/);
  assert.match(t[1].error, /Expected: "45.000"/);
});

test("fingerprint: không đổi theo giá trị thực tế / mã bản ghi, đổi theo giá trị mong đợi", () => {
  const a = fingerprint("TC-1", err("45.000", "50.000", 12));
  assert.equal(a, fingerprint("TC-1", err("45.000", "51.000", 99)));
  assert.notEqual(a, fingerprint("TC-1", err("6.000", "12.000")));
  assert.notEqual(a, fingerprint("TC-2", err("45.000", "50.000")));
  assert.match(
    errorSignature(err("1", "2")),
    /^Error: expect\(locator\).*\| Locator: .*\| Expected: "1"$/,
  );
});

test("buildReport: theo feature — phủ spec, TC có test, script và test khác", async () => {
  const cfg = await project();
  const r = buildReport(cfg, {
    results: RESULTS,
    features: ["XX-F01", "XX-F03"],
    env: "ci",
  });
  assert.deepEqual(r.totals, {
    tests: 4,
    passed: 2,
    failed: 1,
    setup: 0,
    flaky: 1,
    skipped: 0,
    known: 0,
    durationMs: 1234,
  });
  const f1 = r.features.find((f) => f.feature === "XX-F01");
  assert.deepEqual(f1.generated, {
    total: 3,
    passed: 1,
    failed: 1,
    flaky: 1,
    skipped: 0,
    known: 0,
  });
  assert.deepEqual(f1.other, { total: 1, passed: 1, failed: 0 });
  assert.equal(f1.testcases.total, 3); // TC-003 DEPRECATED
  assert.equal(f1.testcases.withTest, 2);
  assert.deepEqual(f1.testcases.notRun, ["TC-XX-F01-004"]);
  assert.equal(f1.coverage.required, 5);
  const f3 = r.features.find((f) => f.feature === "XX-F03");
  assert.equal(f3.testcases, null);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].tc, "TC-XX-F01-002");
  assert.equal(r.failures[0].feature, "XX-F01");

  applyTriage(r, [
    {
      test: "TC-XX-F01-002 Tổng tiền",
      class: "app-bug",
      summary: "bỏ chiết khấu",
    },
  ]);
  const md = reportMarkdown(r, { issues: { [r.failures[0].fingerprint]: 7 } });
  assert.match(
    md,
    /^<!-- taf:report -->\n## E2E-TAF · ✘ 1 test fail · 2\/4 pass/,
  );
  assert.match(
    md,
    /\| XX-F01 Đơn hàng \| 5\/5 \| 2\/3 \| 1\/1\/1\/0 ✘ \| 1\/1 \|/,
  );
  assert.match(
    md,
    /TC-XX-F01-002 Tổng tiền — \*\*app-bug\*\*: bỏ chiết khấu · #7/,
  );
  assert.match(md, /Flaky.*TC-XX-F01-003/);
  assert.match(md, /TC chưa có test chạy: TC-XX-F01-004/);
});

test("planBugs: chỉ test đã phân loại thành bug; gặp lại / mở lại / bỏ qua not_planned / đóng khi đã pass; closeOnly", async () => {
  const cfg = await project();
  const r = buildReport(cfg, { results: RESULTS });
  const fp = r.failures[0].fingerprint;
  const body = (f, tc) => `x\n<!-- taf:fp=${f} -->\n<!-- taf:tc=${tc} -->`;

  // chưa phân loại (CI) → không ghi bug
  assert.deepEqual(planBugs(r, []).unclassified, ["TC-XX-F01-002 Tổng tiền"]);
  assert.deepEqual(planBugs(r, []).actions, []);
  applyTriage(r, [{ test: "TC-XX-F01-002 Tổng tiền", class: "script-bug" }]);
  assert.deepEqual(planBugs(r, []).actions, []);
  applyTriage(r, [{ test: "TC-XX-F01-002 Tổng tiền", class: "app-bug" }]);
  assert.equal(planBugs(r, []).actions[0].type, "create");

  const kinds = (existing, o) =>
    planBugs(r, existing, o).actions.map((a) => [a.type, a.issue?.id]);
  assert.deepEqual(
    kinds([{ id: 1, state: "open", body: body(fp, "TC-XX-F01-002") }]),
    [["seen", 1]],
  );
  assert.deepEqual(
    kinds([
      {
        id: 1,
        state: "closed",
        reason: "completed",
        body: body(fp, "TC-XX-F01-002"),
      },
      {
        id: 5,
        state: "closed",
        reason: "not_planned",
        body: body(fp, "TC-XX-F01-002"),
      },
    ]),
    [["reopen", 1]],
  );
  assert.deepEqual(
    kinds([
      { id: 5, state: "closed", reason: "not_planned", body: body(fp, "x") },
    ]),
    [["ignored", 5]],
  );
  assert.deepEqual(
    kinds(
      [
        { id: 2, state: "open", body: body("aaaa", "TC-XX-F01-001") }, // TC đã pass → đóng
        { id: 3, state: "open", body: body("bbbb", "TC-XX-F01-002") }, // TC vẫn fail → giữ
        { id: 4, state: "open", body: body("cccc", "TC-XX-F09-001") }, // không chạy lần này → giữ
      ],
      { closeFixed: true },
    ),
    [
      ["create", undefined],
      ["close", 2],
    ],
  );
  // CI chạy hồi quy: chỉ đóng, không tạo / mở lại
  assert.deepEqual(
    kinds([{ id: 2, state: "open", body: body("aaaa", "TC-XX-F01-001") }], { closeFixed: true, closeOnly: true }),
    [["close", 2]],
  );
});

test("mergeResults: chạy lại một phần thay kết quả cũ, giữ phần còn lại, tính lại thống kê", () => {
  const rerun = {
    stats: { duration: 9 },
    suites: [
      {
        title: "generated/XX-F01.spec.mjs",
        specs: [
          spec("TC-XX-F01-002 Tổng tiền", "expected"),
          spec("TC-XX-F01-009 Mới", "expected"),
        ],
      },
    ],
  };
  const m = mergeResults(RESULTS, rerun);
  const t = flattenResults(m);
  assert.deepEqual(
    t.map((x) => [x.title, x.outcome]),
    [
      ["TC-XX-F01-001 Tạo đơn", "passed"],
      ["TC-XX-F01-002 Tổng tiền", "passed"],
      ["TC-XX-F01-003 Quyền", "flaky"],
      ["smoke XX-F01-SCR01: mở được", "passed"],
      ["TC-XX-F01-009 Mới", "passed"],
    ],
  );
  assert.deepEqual(
    { e: m.stats.expected, u: m.stats.unexpected, f: m.stats.flaky },
    { e: 4, u: 0, f: 1 },
  );
});

test("lỗi đã biết (test.fail): tách khỏi pass/fail; lại pass thì báo fail nhưng không ghi bug", async () => {
  const cfg = await project();
  const known = (title, status, resultStatus, note) => ({
    title,
    file: "generated/XX-F01.spec.mjs",
    line: 9,
    tests: [
      {
        projectName: "chromium",
        expectedStatus: "failed",
        status,
        annotations: [{ type: "fail", description: note }],
        results: [{ status: resultStatus, error: { message: "Error: x" } }],
      },
    ],
  });
  const results = {
    stats: {},
    suites: [
      {
        title: "generated/XX-F01.spec.mjs",
        specs: [
          spec("TC-XX-F01-001 Tạo đơn", "expected"),
          known("TC-XX-F01-002 Tổng tiền", "expected", "failed", "Lỗi app đã biết: https://github.com/o/r/issues/41"),
          known("TC-XX-F01-003 Quyền", "unexpected", "passed", "Lỗi app đã biết: https://github.com/o/r/issues/42"),
        ],
      },
    ],
  };
  const r = buildReport(cfg, { results, features: ["XX-F01"] });
  assert.deepEqual(
    { passed: r.totals.passed, failed: r.totals.failed, known: r.totals.known },
    { passed: 1, failed: 1, known: 1 },
  );
  assert.equal(r.known[0].tc, "TC-XX-F01-002");
  assert.match(r.known[0].note, /issues\/41/);
  assert.equal(r.failures[0].tc, "TC-XX-F01-003");
  assert.equal(r.failures[0].knownFixed, true);
  assert.match(r.failures[0].error, /đã pass — app có thể đã sửa/);
  const md = reportMarkdown(r);
  assert.match(md, /1 lỗi đã biết/);
  assert.match(md, /### Lỗi đã biết/);
  assert.match(md, /\[#41\]\(https:\/\/github\.com\/o\/r\/issues\/41\)/);
  assert.match(reportText(r), /1 lỗi đã biết/);
  // knownFixed không thành bug kể cả khi phân loại app-bug; TC còn lỗi đã biết không bị coi là đã pass
  applyTriage(r, r.failures.map((f) => ({ test: f.title, class: "app-bug" })));
  const { actions } = planBugs(r, [], { closeFixed: true });
  assert.equal(actions.length, 0);
});

test("R3 — nhiều test cùng fingerprint → một issue liệt kê đủ; close-fixed chỉ đóng khi chính các test đã fail đều pass lại", () => {
  const fail = (title, fp = "aaaa") => ({ title, tc: "TC-XX-F01-003", fingerprint: fp, error: "Expected 45", file: "s.js", line: 1, triage: { class: "app-bug" } });
  const report = {
    failures: [fail("TC-XX-F01-003 x [1]"), fail("TC-XX-F01-003 x [2]")],
    tests: [],
    known: [],
  };
  const { actions } = planBugs(report, []);
  assert.deepEqual(actions.map((a) => a.type), ["create"]);
  assert.deepEqual(actions[0].failure.group, ["TC-XX-F01-003 x [1]", "TC-XX-F01-003 x [2]"]);

  const body = `<!-- taf:fp=aaaa -->\n<!-- taf:tc=TC-XX-F01-003 -->\n<!-- taf:tests=${["TC-XX-F01-003 x [2]"].map(encodeURIComponent).join(",")} -->`;
  const issue = [{ id: 7, state: "open", body }];
  const run = (outcomes) => ({
    failures: [],
    known: [],
    tests: Object.entries(outcomes).map(([title, outcome]) => ({ title, tc: "TC-XX-F01-003", outcome })),
  });
  const close = (r) => planBugs(r, issue, { closeFixed: true }).actions.map((a) => `${a.type} #${a.issue.id}`);
  // dòng đã fail [2] bị skip / không chạy → không đóng, dù dòng [1] pass
  assert.deepEqual(close(run({ "TC-XX-F01-003 x [1]": "passed", "TC-XX-F01-003 x [2]": "skipped" })), []);
  assert.deepEqual(close(run({ "TC-XX-F01-003 x [1]": "passed" })), []);
  assert.deepEqual(close(run({ "TC-XX-F01-003 x [1]": "passed", "TC-XX-F01-003 x [2]": "passed" })), ["close #7"]);
  // issue cũ chỉ có mã TC: cần mọi test của TC pass
  const old = [{ id: 8, state: "open", body: "<!-- taf:fp=bbbb -->\n<!-- taf:tc=TC-XX-F01-003 -->" }];
  assert.deepEqual(planBugs(run({ "TC-XX-F01-003 x [1]": "passed", "TC-XX-F01-003 x [2]": "skipped" }), old, { closeFixed: true }).actions, []);
});

test("triage chỉ áp cho đúng lỗi đã phân loại: fingerprint khác (test fail lại vì lý do khác) → chưa phân loại", async () => {
  const report = { failures: [{ title: "T1", fingerprint: "new1" }, { title: "T2", fingerprint: "fp2" }] };
  applyTriage(report, [
    { test: "T1", fingerprint: "old1", class: "app-bug" },
    { test: "T2", fingerprint: "fp2", class: "script-bug" },
  ]);
  assert.equal(report.failures[0].triage, null);
  assert.equal(report.failures[1].triage.class, "script-bug");
});

test("báo cáo có mục 'Test case cần xem lại' cho lỗi phân loại tc-wrong; tc-wrong không thành bug", async () => {
  const cfg = await project();
  const r = buildReport(cfg, { results: RESULTS, features: ["XX-F01"] });
  applyTriage(r, [{ test: "TC-XX-F01-002 Tổng tiền", class: "tc-wrong", summary: "TC ghi 100, spec DM-BR01 nay là 90" }]);
  const md = reportMarkdown(r);
  assert.match(md, /### Test case cần xem lại/);
  assert.match(md, /\| TC-XX-F01-002 \| TC-XX-F01-002 Tổng tiền \| TC ghi 100, spec DM-BR01 nay là 90 \|/);
  assert.match(md, /kit approve <mã> --testcase/);
  assert.match(reportText(r), /✎ TC cần xem lại: TC-XX-F01-002/);
  assert.deepEqual(planBugs(r, []).actions, []);
});

test("báo cáo nêu dữ liệu test dọn lỗi (annotation cleanup của fixture)", async () => {
  const cfg = await project();
  const results = {
    stats: {},
    suites: [{ title: "s.js", specs: [{ title: "TC-XX-F01-001 a", file: "s.js", line: 1, tests: [{ status: "expected", annotations: [], results: [{ status: "passed", annotations: [{ type: "cleanup", description: "Không xoá được đơn #7 (404)" }] }] }] }] }],
  };
  const r = buildReport(cfg, { results, features: ["XX-F01"] });
  assert.deepEqual(r.cleanup, ["TC-XX-F01-001 a: Không xoá được đơn #7 (404)"]);
  assert.match(reportMarkdown(r), /### ⚠ Dọn dữ liệu test lỗi \(1\)/);
  assert.match(reportText(r), /dọn dữ liệu test lỗi: 1/);
});
