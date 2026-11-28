// ai-kit 3.x: cấu hình v2, nhúng kit vào repo đã có hướng dẫn AI (settings + plugin), context, doctor, next-code, và lint
// chống đưa thứ riêng của một dự án vào phần quy trình của kit (CLAUDE.md quy tắc 1).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { bridgeBlock, upsertBlock } from "../src/bridge.mjs";
import { loadConfig, loadProject } from "../src/config.mjs";
import { buildContext, contextText, doctor, nextCode } from "../src/context.mjs";
import { initProject } from "../src/init.mjs";

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_V2 = path.join(KIT, "cli/test/fixtures/repo-v2"); // dữ liệu cho test: cấu hình, spec, TC, settings của một dự án đã nhúng kit

function tmp(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-"));
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), c);
  }
  return dir;
}

test("cấu hình v2: mặc định hai lớp, trộn sâu status/values, trigger lấy từ progress", () => {
  const dir = tmp({
    "ai-kit.yml": `version: 2
language: en
spec: { status: { approved: Approved } }
progress: { file: docs/status.md, values: { done: [Done] } }
stack: { checks: [{ name: unit, run: npm test }] }
`,
  });
  const cfg = loadConfig({ root: dir });
  assert.equal(cfg.language, "en");
  assert.deepEqual(cfg.spec.status, { draft: "Nháp", approved: "Approved" });
  assert.equal(cfg.progress.values.todo, "Chưa bắt đầu");
  assert.equal(cfg.trigger.statusFile, "docs/status.md");
  assert.deepEqual(cfg.trigger.statusDone, ["Done"]);
  assert.equal(cfg.project.baseBranch, "main");
  assert.deepEqual(cfg.agents, ["claude"]);
  assert.equal(cfg.testcases.dir, "e2e/testcases");
});

test("khối cầu nối: chèn cuối file, thay đúng phần trong dấu, giữ nguyên phần còn lại", () => {
  const block = bridgeBlock("/kit:");
  const repo = "# Quy định repo\n\nDùng Go 1.23.\n";
  const a = upsertBlock(repo, block);
  assert.equal(a.action, "update");
  assert.ok(a.text.startsWith(repo));
  assert.equal(upsertBlock(a.text, block).action, "keep");
  const old = a.text.replace("## ai-kit", "## ai-kit (cũ)") + "\n## Phần sau của repo\n";
  const b = upsertBlock(old, block);
  assert.equal(b.text, `${a.text}\n## Phần sau của repo\n`);
  assert.equal(upsertBlock("", block).action, "create");
  assert.match(block, /`\/kit:dev`/);
  assert.match(block, /npx --no kit context/);
  assert.doesNotMatch(block, /\.ai-kit\//);
});

test("kit init vào repo đã có CLAUDE.md, AGENTS.md, settings riêng: dò guides, trộn settings, không đụng nội dung của repo", async () => {
  const { kitRelease } = await import("../src/init.mjs");
  const { DENY } = await import("../../adapters/agent/claude.mjs");
  const claude = "# CLAUDE.md\n\nStack: Go + Vue. Lớp: api → logic → dao.\n";
  const agents = "# AGENTS.md\nChạy make lint trước khi commit.";
  const mine = { permissions: { allow: ["Bash(make lint)"], deny: ["Bash(rm -rf *)"] }, enabledPlugins: { "x@y": true }, model: "opus" };
  const dir = tmp({
    "CLAUDE.md": claude,
    "AGENTS.md": agents,
    ".cursor/rules/x.mdc": "rule",
    ".claude/settings.json": JSON.stringify(mine),
    ".gitignore": "node_modules\n",
    "package.json": JSON.stringify({ devDependencies: { "ai-kit": "github:dunglt-iks/ai-kit#v3.0.0" } }),
  });
  const res = await initProject(dir);
  const act = Object.fromEntries(res.map((r) => [r.file, r.action]));
  assert.equal(act["ai-kit.yml"], "create");
  assert.equal(act[".claude/settings.json"], "update");
  assert.equal(act["CLAUDE.md"], "update");
  assert.equal(act[".gitignore"], "update");
  assert.equal(act["AGENTS.md"], undefined); // chỉ đọc làm guides, không chèn khối
  // CI là của dự án: init không đụng .github/; không còn vỏ lệnh trong .claude/commands
  assert.ok(!res.some((r) => r.file.startsWith(".github/") || r.file.startsWith("e2e/")));
  assert.ok(!fs.existsSync(path.join(dir, ".claude/commands")));

  const cfg = YAML.parse(fs.readFileSync(path.join(dir, "ai-kit.yml"), "utf8"));
  assert.deepEqual(cfg.guides, ["CLAUDE.md", "AGENTS.md", ".cursor/rules"]);
  assert.deepEqual(cfg.agents, ["claude"]);
  assert.equal(cfg.kitRef, undefined);
  const settings = JSON.parse(fs.readFileSync(path.join(dir, ".claude/settings.json"), "utf8"));
  const { repo, ref } = kitRelease();
  assert.equal(repo, "dunglt-iks/ai-kit");
  assert.equal(ref, `v${JSON.parse(fs.readFileSync(path.join(KIT, "package.json"), "utf8")).version}`);
  assert.deepEqual(settings.extraKnownMarketplaces["ai-kit"], { source: { source: "github", repo, ref } });
  assert.deepEqual(settings.enabledPlugins, { "kit@ai-kit": true, "x@y": true });
  assert.deepEqual(settings.permissions, { allow: ["Bash(make lint)"], deny: ["Bash(rm -rf *)", ...DENY] });
  assert.equal(settings.model, "opus");
  assert.ok(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8").startsWith(claude));
  assert.equal(fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"), agents);
  assert.equal(fs.readFileSync(path.join(dir, ".gitignore"), "utf8"), "node_modules\n# ai-kit\n/e2e/test-results/\n");

  // chạy lại: không nhân đôi khối, không đổi gì
  const again = await initProject(dir);
  assert.ok(again.every((r) => r.action === "keep"), JSON.stringify(again.filter((r) => r.action !== "keep")));
  assert.equal(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8").split("ai-kit:start").length, 2);
  let d = await doctor(await loadProject({ root: dir }));
  assert.ok(!d.some((r) => r.level === "error"), JSON.stringify(d.filter((r) => r.level === "error")));
  assert.ok(!d.some((r) => /settings\.json|devDependencies/.test(r.msg) && r.level !== "ok"));

  // nâng gói kit (ref cũ trong settings): doctor nhắc, kit init đổi ref; repo tắt plugin → giữ false, doctor cảnh báo
  settings.extraKnownMarketplaces["ai-kit"].source.ref = "v0.0.1";
  settings.enabledPlugins["kit@ai-kit"] = false;
  fs.writeFileSync(path.join(dir, ".claude/settings.json"), JSON.stringify(settings));
  d = await doctor(await loadProject({ root: dir }));
  assert.ok(d.some((r) => r.level === "warn" && /chưa khớp ai-kit/.test(r.msg)));
  assert.ok(d.some((r) => r.level === "warn" && /tắt plugin kit@ai-kit/.test(r.msg)));
  assert.equal((await initProject(dir)).find((r) => r.file === ".claude/settings.json").action, "update");
  const after = JSON.parse(fs.readFileSync(path.join(dir, ".claude/settings.json"), "utf8"));
  assert.equal(after.extraKnownMarketplaces["ai-kit"].source.ref, ref);
  assert.equal(after.enabledPlugins["kit@ai-kit"], false);

  // settings hỏng: báo rõ, không ghi đè
  fs.writeFileSync(path.join(dir, ".claude/settings.json"), "{ hỏng");
  await assert.rejects(initProject(dir), /settings không phải JSON hợp lệ/);
  assert.equal(fs.readFileSync(path.join(dir, ".claude/settings.json"), "utf8"), "{ hỏng");
});

test("kit init --dry-run không ghi; ai-kit.yml có sẵn với kitRef (bản 2.x) → doctor nhắc xoá", async () => {
  const dir = tmp({});
  const res = await initProject(dir, { dryRun: true });
  assert.deepEqual(res.map((r) => r.file), ["ai-kit.yml", ".claude/settings.json", "CLAUDE.md", ".gitignore"]);
  assert.deepEqual(fs.readdirSync(dir), []);
  fs.writeFileSync(path.join(dir, "ai-kit.yml"), "version: 2\nkitRef: v2\n");
  await initProject(dir);
  const d = await doctor(await loadProject({ root: dir }));
  assert.ok(d.some((r) => r.level === "warn" && /kitRef không còn dùng/.test(r.msg)));
  assert.ok(d.some((r) => r.level === "warn" && /devDependencies/.test(r.msg)));
});

test("nâng từ ai-kit 2.x: kit init gỡ vỏ lệnh có dấu, khối trong AGENTS.md, bỏ qua agents-md; giữ lệnh riêng của repo", async () => {
  const v2Block = () => "<!-- ai-kit:start — v2 -->\n## ai-kit\nđọc `.ai-kit/process/dev.md`\n<!-- ai-kit:end -->"; // khối cầu nối kiểu 2.x
  const shell = "---\ndescription: vỏ\n---\n<!-- ai-kit:shell — vỏ do kit init quản lý -->\nĐọc `.ai-kit/process/spec.md`\n";
  const mine = "---\ndescription: lệnh deploy riêng của repo\n---\nmake deploy\n";
  const agentsMd = "# AGENTS.md\nChạy make lint trước khi commit.\n";
  const dir = tmp({
    "ai-kit.yml": "version: 2\nkitRef: v2\nagents: [claude, agents-md]\nguides: [CLAUDE.md, AGENTS.md]\n",
    "CLAUDE.md": `# Repo\n\n${v2Block()}\n`,
    "AGENTS.md": `${agentsMd}\n${v2Block()}\n`,
    ".claude/commands/spec.md": shell,
    ".claude/commands/kit-adopt.md": shell,
    ".claude/commands/deploy.md": mine,
    ".claude/agents/tester.md": shell,
    ".ai-kit/RULES.md": "bản 2.x",
    "package.json": JSON.stringify({ devDependencies: { "ai-kit": "github:x/ai-kit#v3.0.0" } }),
  });
  let d = await doctor(await loadProject({ root: dir }));
  const warns = d.filter((r) => r.level === "warn").map((r) => r.msg).join("\n");
  for (const re of [/spec\.md là vỏ lệnh ai-kit 2\.x/, /tester\.md là vỏ lệnh ai-kit 2\.x/, /AGENTS\.md còn khối ai-kit 2\.x/, /\.ai-kit\/ là bản kit 2\.x/, /"agents-md" bỏ từ ai-kit 3/, /kitRef/])
    assert.match(warns, re);
  assert.ok(!d.some((r) => r.level === "error" && /agents-md/.test(r.msg)), "agents-md chỉ cảnh báo, không chặn");

  const res = await initProject(dir);
  const act = (f) => res.filter((r) => r.file === f).map((r) => r.action);
  assert.deepEqual(act(".claude/commands/spec.md"), ["remove"]);
  assert.deepEqual(act(".claude/commands/kit-adopt.md"), ["remove"]);
  assert.deepEqual(act(".claude/agents/tester.md"), ["remove"]);
  assert.deepEqual(act("AGENTS.md"), ["update"]);
  assert.ok(res.some((r) => r.file === "ai-kit.yml" && /agents-md bỏ từ ai-kit 3/.test(r.note || "")));
  assert.ok(!fs.existsSync(path.join(dir, ".claude/commands/spec.md")));
  assert.equal(fs.readFileSync(path.join(dir, ".claude/commands/deploy.md"), "utf8"), mine); // không có dấu: của repo
  assert.equal(fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8"), agentsMd);
  const claude = fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
  assert.equal(claude.split("ai-kit:start").length, 2);
  assert.match(claude, /`\/kit:dev`/);
  assert.doesNotMatch(claude, /\.ai-kit\//);

  d = await doctor(await loadProject({ root: dir }));
  assert.ok(!d.some((r) => /vỏ lệnh ai-kit 2|AGENTS\.md còn khối/.test(r.msg)));
  assert.ok(d.some((r) => /\.ai-kit\/ là bản kit 2\.x/.test(r.msg)), "thư mục .ai-kit/ người tự xoá");
  assert.ok((await initProject(dir)).every((r) => r.action === "keep"), "chạy lại: không đổi gì");

  // AGENTS.md chỉ có khối của kit (do kit 2.x tạo) → gỡ cả file
  const only = tmp({ "ai-kit.yml": "version: 2\nagents: [agents-md]\n", "AGENTS.md": `${v2Block()}\n` });
  const r2 = await initProject(only);
  assert.deepEqual(r2.filter((r) => r.file === "AGENTS.md").map((r) => r.action), ["remove"]);
  assert.ok(!fs.existsSync(path.join(only, "AGENTS.md")));
  assert.ok(fs.existsSync(path.join(only, ".claude/settings.json")), "chỉ còn agents-md → vẫn nối claude");
});

test("khoá plugin: keep giữ marketplace đã khai (thử fork / nhánh), managed chỉ ghi deny", async () => {
  const { kitRelease } = await import("../src/init.mjs");
  const { DENY } = await import("../../adapters/agent/claude.mjs");
  const fork = { source: { source: "github", repo: "someone/ai-kit", ref: "feat/x" } };
  const pkg = JSON.stringify({ devDependencies: { "ai-kit": "github:x/ai-kit#v3.0.0" } });
  const read = (d) => JSON.parse(fs.readFileSync(path.join(d, ".claude/settings.json"), "utf8"));

  // pin (mặc định): marketplace của fork bị đưa về tag của gói
  const pin = tmp({ "ai-kit.yml": "version: 2\n", "package.json": pkg, ".claude/settings.json": JSON.stringify({ extraKnownMarketplaces: { "ai-kit": fork } }) });
  await initProject(pin);
  assert.equal(read(pin).extraKnownMarketplaces["ai-kit"].source.ref, kitRelease().ref);

  // keep: giữ fork; chạy lại không đổi; doctor nhắc đang dùng marketplace khác bản gói, không đòi kit init
  const keep = tmp({ "ai-kit.yml": "version: 2\nplugin: keep\n", "package.json": pkg, ".claude/settings.json": JSON.stringify({ extraKnownMarketplaces: { "ai-kit": fork } }) });
  await initProject(keep);
  assert.deepEqual(read(keep).extraKnownMarketplaces["ai-kit"], fork);
  assert.equal(read(keep).enabledPlugins["kit@ai-kit"], true);
  assert.ok((await initProject(keep)).every((r) => r.action === "keep"));
  let d = await doctor(await loadProject({ root: keep }));
  assert.ok(d.some((r) => r.level === "warn" && /plugin: keep — marketplace ai-kit lấy từ someone\/ai-kit@feat\/x/.test(r.msg)));
  assert.ok(!d.some((r) => /chưa khớp ai-kit/.test(r.msg)));
  // keep mà chưa khai marketplace → như pin
  const keepNew = tmp({ "ai-kit.yml": "version: 2\nplugin: keep\n" });
  await initProject(keepNew);
  assert.equal(read(keepNew).extraKnownMarketplaces["ai-kit"].source.ref, kitRelease().ref);

  // managed: tổ chức bật plugin — chỉ deny; doctor không đòi marketplace / plugin
  const managed = tmp({ "ai-kit.yml": "version: 2\nplugin: managed\n", "package.json": pkg });
  await initProject(managed);
  assert.deepEqual(read(managed), { permissions: { deny: DENY } });
  d = await doctor(await loadProject({ root: managed }));
  assert.ok(!d.some((r) => r.level !== "ok" && /settings\.json/.test(r.msg)), JSON.stringify(d.filter((r) => /settings/.test(r.msg))));

  // giá trị sai: init từ chối, doctor báo lỗi
  const bad = tmp({ "ai-kit.yml": "version: 2\nplugin: auto\n" });
  await assert.rejects(initProject(bad), /plugin: "auto" không hợp lệ/);
});

test("context + next-code trên dự án mẫu: mã kế tiếp không tái dùng số", async () => {
  const cfg = await loadProject({ root: REPO_V2 });
  const c = await buildContext(cfg);
  assert.deepEqual(c.layers.technical.guides, ["CLAUDE.md", "e2e/README.md"]);
  assert.deepEqual(c.features.DM.map((f) => f.code), ["DM-F01", "DM-F02"]);
  assert.match(contextText(c), /Lớp kỹ thuật[\s\S]*Lớp quy trình/);
  assert.equal(nextCode(cfg, "F", "dm"), "DM-F03");
  assert.equal(nextCode(cfg, "US", "DM-F01"), "DM-F01-US03");
  assert.match(nextCode(cfg, "SCR", "DM-F02"), /^DM-F02-SCR\d{2}$/);
  assert.equal(nextCode(cfg, "F", "ZZ"), "ZZ-F01");
  assert.throws(() => nextCode(cfg, "US", "DM-F99"), /DM-F99/);
  assert.throws(() => nextCode(cfg, "small"), /smallItem/);

  const dir = tmp({
    "ai-kit.yml": "version: 2\nspec: { smallItem: { pattern: 'TASK-\\d{2}', file: status.md } }\n",
    "status.md": "| TASK-03 | x |\n| TASK-07 [DEPRECATED] | y |\n",
  });
  assert.equal(nextCode(await loadProject({ root: dir }), "small"), "TASK-08");
});

test("CLI kit: context --json, doctor, spec, next-code trên dự án mẫu", () => {
  const run = (bin, args) =>
    execFileSync("node", [path.join(KIT, "cli/bin", bin), ...args], { cwd: REPO_V2, encoding: "utf8" });
  assert.equal(JSON.parse(run("kit.mjs", ["context", "--json"])).language, "vi");
  assert.match(run("kit.mjs", ["doctor"]), /0 lỗi/);
  assert.match(run("kit.mjs", ["spec", "DM-F01"]), /DM-F01/);
  assert.match(run("kit.mjs", ["next-code", "DM", "--type", "BR"]), /^DM-BR\d{2}\n$/);
});

// ── Phần quy trình của kit phải trung tính (CLAUDE.md quy tắc 1) ──────────────

const PROCESS_DIRS = ["process", "plugin", "prompts", "adapters/agent", "templates"];
const PROCESS_FILES = ["RULES.md"];
const BANNED = [
  /HotGo/i,
  /Sales Tools/i,
  /app-base/,
  /CORE-C\d/,
  /\bKI-\d/,
  /GoFrame|gf gen|gofmt|casbin|Pinia|Vitest|pnpm/,
  /:80(90|01)\b/,
  /docs\/guide-en|web\/src|deploy\/db/,
  /Claude (Sonnet|Opus|Haiku) \d/,
];

function walk(rel) {
  const abs = path.join(KIT, rel);
  if (fs.statSync(abs).isFile()) return [rel];
  return fs.readdirSync(abs).flatMap((f) => walk(path.join(rel, f)));
}

test("quy trình, plugin, khuôn không chứa thứ riêng của một dự án", () => {
  const files = [...PROCESS_DIRS.flatMap(walk), ...PROCESS_FILES];
  const hits = [];
  for (const f of files) {
    if (f === "templates/ai-kit.yml") continue; // mẫu cấu hình: có featurePattern ví dụ
    fs.readFileSync(path.join(KIT, f), "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const re of BANNED) if (re.test(line)) hits.push(`${f}:${i + 1}: ${re} — ${line.trim()}`);
      });
  }
  assert.deepEqual(hits, []);
});

test("plugin kit: manifest khớp phiên bản gói, skill / agent trỏ tới quy trình có thật, mỗi bước cầu nối có skill", () => {
  const read = (f) => fs.readFileSync(path.join(KIT, f), "utf8");
  const fm = (f) => {
    const m = /^---\n([\s\S]*?)\n---\n/.exec(read(f));
    assert.ok(m, `${f}: thiếu frontmatter`);
    return YAML.parse(m[1]);
  };
  const pkg = JSON.parse(read("package.json"));
  const plugin = JSON.parse(read("plugin/.claude-plugin/plugin.json"));
  const market = JSON.parse(read(".claude-plugin/marketplace.json"));
  assert.equal(plugin.name, "kit");
  assert.equal(plugin.version, pkg.version, "plugin.json và package.json phải cùng phiên bản (một tag)");
  assert.equal(market.name, "ai-kit");
  assert.deepEqual(market.plugins.map((p) => [p.name, p.source]), [["kit", "./plugin"]]);
  // gói npm không mang plugin / ví dụ / test; plugin không cần gói npm
  for (const f of ["process/", "prompts/", "templates/", "RULES.md", "cli/src/"]) assert.ok(pkg.files.includes(f), f);
  assert.ok(!pkg.files.some((f) => /^(plugin|examples|cli\/test)/.test(f)));

  const skills = fs.readdirSync(path.join(KIT, "plugin/skills")).sort();
  const steps = [...bridgeBlock("/kit:").matchAll(/`\/kit:([\w-]+)`/g)].map((m) => m[1]).sort();
  assert.deepEqual(skills, steps);
  const targets = (f) => [...read(f).matchAll(/`<kit>\/(process\/[^`]+\.md)`/g)].map((m) => m[1]);
  for (const s of skills) {
    const f = `plugin/skills/${s}/SKILL.md`;
    const meta = fm(f);
    assert.equal(meta.name, s);
    assert.ok(meta.description, `${f}: thiếu description`);
    assert.equal(meta["disable-model-invocation"], true, `${f}: lệnh quy trình do người gọi`);
    assert.equal(targets(f).length, 1, `${f}: phải trỏ tới đúng một file quy trình`);
    assert.ok(fs.existsSync(path.join(KIT, targets(f)[0])), `${f}: ${targets(f)[0]} không tồn tại`);
  }
  for (const a of fs.readdirSync(path.join(KIT, "plugin/agents"))) {
    const f = `plugin/agents/${a}`;
    const meta = fm(f);
    assert.equal(`${meta.name}.md`, a);
    assert.ok(meta.description && meta.tools, `${f}: thiếu description / tools`);
    assert.ok(fs.existsSync(path.join(KIT, targets(f)[0])), `${f}: không trỏ tới file quy trình có thật`);
  }
  const hook = JSON.parse(read("plugin/hooks/hooks.json")).hooks.PreToolUse[0];
  assert.equal(hook.matcher, "Bash");
  assert.deepEqual(hook.hooks[0].args, ["${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"]);

  // /kit:spec tự gọi spec-reviewer trước khi bàn giao; /kit:e2e-script, /kit:e2e-triage dùng prompt TAF
  assert.match(read("process/spec.md"), /subagent `spec-reviewer`/);
  assert.match(read("process/e2e-script.md"), /prompts\/script\.md/);
  assert.match(read("process/e2e-triage.md"), /prompts\/triage\.md/);
  for (const f of walk("process").filter((f) => !f.endsWith("README.md")))
    assert.match(read(f), /kit context/, `${f}: thiếu bước 0 (kit context)`);
  for (const f of [...walk("process"), ...walk("prompts"), ...walk("plugin"), "RULES.md"])
    assert.doesNotMatch(read(f), /\.ai-kit\/|kitRef/, `${f}: còn đường dẫn .ai-kit/ của bản 2.x`);
});

test("hook chặn AI chạy kit approve: mọi cách gọi lệnh; không chặn nhầm lệnh khác hay chuỗi nhắc tới nó", async () => {
  const { blocked } = await import("../../plugin/hooks/guard.mjs");
  for (const c of [
    "npx kit approve DM-F01",
    "npx --no kit approve DM-F01 --testcase",
    "cd web && npx -y kit approve DM-F01",
    "npm exec kit approve DM-F01",
    "node node_modules/ai-kit/cli/bin/kit.mjs approve DM-F01",
    "./node_modules/.bin/kit approve DM-F01 --prototype",
    "kit approve DM-F01",
  ])
    assert.ok(blocked(c), c);
  for (const c of ["npx kit ready DM-F01", "grep -rn 'kit approve' docs", "echo kit approve", 'git commit -m "docs: kit approve"', ""])
    assert.ok(!blocked(c), c);
  const run = (input) => {
    try {
      execFileSync("node", [path.join(KIT, "plugin/hooks/guard.mjs")], { input, stdio: ["pipe", "pipe", "pipe"] });
      return 0;
    } catch (e) {
      return e.status;
    }
  };
  assert.equal(run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "npx kit approve DM-F01" } })), 2);
  assert.equal(run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "npx kit ready DM-F01" } })), 0);
  assert.equal(run("không phải JSON"), 0);
});

// ── Duyệt bằng code, điều kiện sẵn sàng, trùng mã ─────────────────────────────

async function demoCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-demo-"));
  for (const f of ["ai-kit.yml", "CLAUDE.md", "docs", "e2e/README.md"])
    fs.cpSync(path.join(REPO_V2, f), path.join(dir, f), { recursive: true });
  return dir;
}

test("kit approve + ready: spec nháp → duyệt (ghi người, ngày); prototype theo dõi bằng cột + dấu hash màn hình", async () => {
  const { approve, readyFeature } = await import("../src/approve.mjs");
  const dir = await demoCopy();
  const prd = path.join(dir, "docs/features/addon/DM-demo/PRD-demo.md");
  const fsd = path.join(dir, "docs/features/addon/DM-demo/FSD-demo.md");
  fs.writeFileSync(prd, fs.readFileSync(prd, "utf8").replace("| DM-F02 | Tạo đơn hàng | Form tạo đơn, tính thành tiền có chiết khấu | Đã duyệt |", "| DM-F02 | Tạo đơn hàng | Form tạo đơn, tính thành tiền có chiết khấu | Nháp |"));
  let cfg = await loadProject({ root: dir });
  assert.match(readyFeature(cfg, "DM-F02").problems.join(), /Spec chưa duyệt/);

  // duyệt spec: ô Spec có người + ngày, vẫn được coi là đã duyệt (cả gate của TAF)
  const r = approve(cfg, "dm-f02".toUpperCase(), { by: "qa", date: "2026-11-15" });
  assert.equal(r.value, "Đã duyệt (qa, 2026-11-15)");
  assert.match(fs.readFileSync(prd, "utf8"), /\| DM-F02 \|.*\| Đã duyệt \(qa, 2026-11-15\) \|/);
  cfg = await loadProject({ root: dir });
  assert.ok(cfg.adapter.findFeature("DM-F02").approved);
  assert.ok(readyFeature(cfg, "DM-F02").ok); // chưa có cột Prototype → không theo dõi prototype

  // có giao diện + cột Prototype → phải có prototype đã duyệt
  assert.throws(() => approve(cfg, "DM-F02", { prototype: true, by: "qa" }), /Chưa có prototype/);
  cfg.adapter.setStatus("DM-F02", "Prototype", "Nháp"); // /kit:prototype đặt nháp — thêm cột cho cả bảng
  assert.match(fs.readFileSync(prd, "utf8"), /\| Code \| Tên \| Mô tả ngắn \| Spec \| Prototype \|/);
  assert.match(fs.readFileSync(prd, "utf8"), /\| DM-F01 \|.*\| Đã duyệt \| — \|/);
  cfg = await loadProject({ root: dir });
  assert.ok(readyFeature(cfg, "DM-F01").ok); // ô — = không cần
  assert.match(readyFeature(cfg, "DM-F02").problems.join(), /Chưa có prototype/);
  fs.writeFileSync(path.join(dir, "docs/features/addon/DM-demo/PROTOTYPE-demo.html"), "<!doctype html><title>p</title>\n");
  cfg = await loadProject({ root: dir });
  assert.match(readyFeature(cfg, "DM-F02").problems.join(), /Prototype chưa duyệt/);
  const p = approve(cfg, "DM-F02", { prototype: true, by: "ux", date: "2026-11-15" });
  assert.ok(p.stamped);
  assert.match(fs.readFileSync(path.join(dir, p.stamped), "utf8"), /^<!-- ai-kit:prototype DM-F02=[0-9a-f]{16} -->/);
  cfg = await loadProject({ root: dir });
  assert.deepEqual(readyFeature(cfg, "DM-F02").problems, []);

  // đổi màn hình trong spec → prototype không còn khớp; đổi luồng thì không ảnh hưởng prototype
  const text = fs.readFileSync(fsd, "utf8");
  const scr = text.indexOf("#### DM-F02-SCR01");
  fs.writeFileSync(fsd, text.slice(0, scr) + text.slice(scr).replace("\n", "\nThêm một dòng mô tả màn hình.\n"));
  cfg = await loadProject({ root: dir });
  assert.match(readyFeature(cfg, "DM-F02").problems.join(), /Màn hình trong spec đã đổi/);
  approve(cfg, "DM-F02", { prototype: true, by: "ux" });
  cfg = await loadProject({ root: dir });
  assert.ok(readyFeature(cfg, "DM-F02").ok);

  // context: lọc module, đánh dấu
  const c = await buildContext(cfg, { scope: "dm" });
  assert.deepEqual(c.features.DM.find((f) => f.code === "DM-F02"), {
    code: "DM-F02", name: c.features.DM[1].name, status: c.features.DM[1].status,
    approved: true, prototype: "approved", ready: true, file: "docs/features/addon/DM-demo/FSD-demo.md",
  });
  assert.deepEqual(c.layers.technical.autoLoaded, ["CLAUDE.md"]);
  assert.deepEqual((await buildContext(cfg, { scope: "ZZ" })).features, {});
});

test("mã feature khai trùng (hai nhánh cùng cấp DM-F03): ready, gate, doctor đều báo", async () => {
  const { readyFeature } = await import("../src/approve.mjs");
  const { gateFeature } = await import("../src/gate.mjs");
  const dir = await demoCopy();
  const fsd = path.join(dir, "docs/features/addon/DM-demo/FSD-demo.md");
  fs.appendFileSync(fsd, "\n## 9. DM-F01 — Bản trùng từ nhánh khác\n");
  const cfg = await loadProject({ root: dir });
  assert.match(readyFeature(cfg, "DM-F01").problems.join(), /khai ở nhiều chỗ/);
  assert.match(gateFeature(cfg, "DM-F01").problems.join(), /khai ở nhiều chỗ/);
  assert.ok((await doctor(cfg)).some((r) => r.level === "error" && /DM-F01 khai ở nhiều chỗ/.test(r.msg)));
});

test("kit check-prototype: SCR ↔ <section id>, thành phần ↔ data-ref, không thừa, phiên bản spec", async () => {
  const { checkPrototype } = await import("../src/prototype.mjs");
  const dir = await demoCopy();
  const mod = path.join(dir, "docs/features/addon/DM-demo");
  let cfg = await loadProject({ root: dir });
  assert.match(checkPrototype(cfg, "DM-F01").skipped, /chưa có prototype/);
  // spec cũ đánh số ①…④ vẫn đọc được
  assert.deepEqual(cfg.adapter.findFeature("DM-F01").screens[0].elements, [1, 2, 3, 4]);

  const sec = (id, refs) => `<section class="screen" id="${id}">${refs.map((r) => `<b data-ref="${r}">x</b>`).join("")}</section>`;
  const write = (body) => fs.writeFileSync(path.join(mod, "PROTOTYPE-demo.html"), `<div class="proto-bar">Spec: FSD-demo.md v1.0</div>${body}`);
  const f1 = ["DM-F01-SCR01-1", "DM-F01-SCR01-2", "DM-F01-SCR01-3", "DM-F01-SCR01-4"];
  write(sec("dm-f01-scr01", f1));
  cfg = await loadProject({ root: dir });
  let r = checkPrototype(cfg, "DM-F01");
  assert.deepEqual(r.errors, []);
  assert.equal(r.file, "docs/features/addon/DM-demo/PROTOTYPE-demo.html");

  write(sec("dm-f01-scr01", [...f1.slice(1), "DM-F01-SCR01-9", "DM-F01-SCR01"]) + sec("dm-f01-scr07", []));
  cfg = await loadProject({ root: dir });
  const all = checkPrototype(cfg, "DM-F01").errors.join("\n");
  assert.match(all, /DM-F01-SCR01: thiếu data-ref cho thành phần 1/);
  assert.match(all, /DM-F01-SCR01-9: thành phần không có trong bảng/);
  assert.match(all, /DM-F01-SCR01: thiếu số thành phần/);
  assert.match(all, /DM-F01-SCR07: prototype có màn hình mà spec không có/);
  // một file cho cả module: thiếu section của DM-F02 không làm DM-F01 lỗi, nhưng DM-F02 thì có
  assert.match(checkPrototype(cfg, "DM-F02").errors.join(), /không có <section id="dm-f02-scr01">/);
});



test("kit approve --testcase: ghi status + reviewer; từ chối TC lỗi thời hoặc còn lỗi", async () => {
  const { approve } = await import("../src/approve.mjs");
  const { gateFeature } = await import("../src/gate.mjs");
  const dir = await demoCopy();
  fs.cpSync(path.join(REPO_V2, "e2e/testcases"), path.join(dir, "e2e/testcases"), { recursive: true });
  fs.cpSync(path.join(REPO_V2, "e2e/testdata"), path.join(dir, "e2e/testdata"), { recursive: true });
  const tc = path.join(dir, "e2e/testcases/DM/DM-F01.md");
  const orig = fs.readFileSync(tc, "utf8");
  fs.writeFileSync(tc, orig.replace("status: Đã duyệt", "status: Nháp").replace("reviewer: taf-demo", 'reviewer: ""'));
  const cfg = await loadProject({ root: dir });
  cfg.gate.requireScript = false;
  assert.match(gateFeature(cfg, "DM-F01").problems.join(), /kit approve DM-F01 --testcase/);

  const r = approve(cfg, "DM-F01", { what: "testcase", by: "qa" });
  assert.equal(r.file, "e2e/testcases/DM/DM-F01.md");
  const text = fs.readFileSync(tc, "utf8");
  assert.match(text, /^status: Đã duyệt$/m);
  assert.match(text, /^reviewer: "qa"$/m);
  assert.equal(text.slice(text.indexOf("\n---")), orig.slice(orig.indexOf("\n---"))); // thân TC giữ nguyên
  assert.deepEqual(gateFeature(cfg, "DM-F01").problems, []);

  fs.writeFileSync(tc, text.replace(/specHash: "\w+"/, 'specHash: "0000000000000000"'));
  assert.throws(() => approve(cfg, "DM-F01", { what: "testcase" }), /lỗi thời/);
  fs.rmSync(tc);
  assert.throws(() => approve(cfg, "DM-F01", { what: "testcase" }), /Chưa có test case/);
});

test("BR dùng chung: feature dẫn tới BR khai ở feature / PRD khác → BR đổi thì specHash đổi (TC lỗi thời)", async () => {
  const dir = await demoCopy();
  const fsd = path.join(dir, "docs/features/addon/DM-demo/FSD-demo.md");
  const orig = fs.readFileSync(fsd, "utf8");
  // DM-F01 dẫn tới DM-BR01 (khai trong phần DM-F02)
  fs.writeFileSync(fsd, orig.replace("Kích hoạt từ: DM-F01-SCR01.", "Kích hoạt từ: DM-F01-SCR01. Số tiền theo DM-BR01."));
  const h1 = (await loadProject({ root: dir })).adapter.findFeature("DM-F01").hash;
  fs.writeFileSync(fsd, fs.readFileSync(fsd, "utf8").replace("làm tròn đến đồng", "làm tròn đến trăm đồng"));
  const h2 = (await loadProject({ root: dir })).adapter.findFeature("DM-F01").hash;
  assert.notEqual(h1, h2);
  // feature không dẫn tới BR thì hash không đổi theo BR
  fs.writeFileSync(fsd, orig);
  const a = (await loadProject({ root: dir })).adapter.findFeature("DM-F01").hash;
  fs.writeFileSync(fsd, orig.replace("làm tròn đến đồng", "làm tròn đến trăm đồng"));
  assert.equal((await loadProject({ root: dir })).adapter.findFeature("DM-F01").hash, a);
});

test("next-code: vượt 99 cấp tiếp 100 và kit nhận ra mã 3 chữ số, không cấp trùng; codeDigits: 3 dùng 3 chữ số từ đầu", async () => {
  const dir = await demoCopy();
  const fsd = path.join(dir, "docs/features/addon/DM-demo/FSD-demo.md");
  fs.appendFileSync(fsd, "\n## 9. DM-F99 — X\n\n### Luồng nghiệp vụ\n\n#### DM-F99-US99\n\n**A**\n\n**DM-BR99 — r**: x\n");
  let cfg = await loadProject({ root: dir });
  assert.equal(nextCode(cfg, "F", "DM"), "DM-F100");
  assert.equal(nextCode(cfg, "US", "DM-F99"), "DM-F99-US100");
  assert.equal(nextCode(cfg, "BR", "DM"), "DM-BR100");

  // đã dùng F100 / US100 / BR100 → kit đọc được, mã kế tiếp không trùng
  fs.appendFileSync(fsd, "\n## 10. DM-F100 — Y\n\n### Luồng nghiệp vụ\n\n#### DM-F100-US01\n\n**B**\n\nTheo DM-BR100.\n\n**DM-BR100 — r**: y\n");
  cfg = await loadProject({ root: dir });
  assert.ok(cfg.adapter.findFeature("DM-F100"), "adapter nhận ra DM-F100");
  assert.deepEqual(cfg.adapter.findFeature("DM-F100").stories.map((s) => s.code), ["DM-F100-US01"]);
  assert.equal(cfg.adapter.scopeOf("DM-F100"), "DM");
  assert.equal(nextCode(cfg, "F", "DM"), "DM-F101");
  assert.equal(nextCode(cfg, "BR", "DM"), "DM-BR101");
  assert.equal(nextCode(cfg, "US", "DM-F100"), "DM-F100-US02");

  // codeDigits: 3
  const d3 = tmp({
    "ai-kit.yml": "version: 2\nspec: { codeDigits: 3 }\n",
    "docs/features/x/DM-x/PRD-x.md": "# PRD\n",
    "docs/features/x/DM-x/FSD-x.md": "# FSD\n\n## 1. DM-F001 — A\n\n### Luồng nghiệp vụ\n\n#### DM-F001-US001\n\n**A**\n",
  });
  cfg = await loadProject({ root: d3 });
  assert.equal(cfg.spec.featurePattern, "[A-Z]{2,4}-F\\d{3,4}");
  assert.deepEqual(cfg.adapter.listFeatures(), ["DM-F001"]);
  assert.equal(nextCode(cfg, "F", "DM"), "DM-F002");
  assert.equal(nextCode(cfg, "US", "DM-F001"), "DM-F001-US002");
  assert.equal(nextCode(cfg, "BR", "DM"), "DM-BR001");
  assert.throws(() => loadConfig({ root: tmp({ "ai-kit.yml": "version: 2\nspec: { codeDigits: 4 }\n" }) }), /codeDigits phải là 2 hoặc 3/);
});

test("tự duyệt test case: cảnh báo; gate.allowSelfApproval: false → approve từ chối, gate báo", async () => {
  const { approve } = await import("../src/approve.mjs");
  const { gateFeature } = await import("../src/gate.mjs");
  const dir = await demoCopy();
  fs.cpSync(path.join(REPO_V2, "e2e/testcases"), path.join(dir, "e2e/testcases"), { recursive: true });
  fs.cpSync(path.join(REPO_V2, "e2e/testdata"), path.join(dir, "e2e/testdata"), { recursive: true });
  const g = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8" });
  g("init", "-q");
  g("add", ".");
  g("-c", "user.email=w@t", "-c", "user.name=writer", "commit", "-qm", "TC");
  let cfg = await loadProject({ root: dir });
  assert.match(approve(cfg, "DM-F01", { what: "testcase", by: "writer" }).warning, /cũng là người viết/);
  assert.equal(approve(cfg, "DM-F01", { what: "testcase", by: "qa" }).warning, undefined);

  cfg.gate.allowSelfApproval = false;
  cfg.gate.requireScript = false;
  assert.throws(() => approve(cfg, "DM-F02", { what: "testcase", by: "writer" }), /cần người khác duyệt/);
  approve({ ...cfg, gate: { ...cfg.gate, allowSelfApproval: true } }, "DM-F02", { what: "testcase", by: "writer" });
  assert.match(gateFeature(cfg, "DM-F02").problems.join(), /tự duyệt/);
  assert.deepEqual(gateFeature(cfg, "DM-F01").problems, []); // qa duyệt
});
