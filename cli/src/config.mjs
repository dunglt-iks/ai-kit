// @ts-check
// Đọc ai-kit.yml (hoặc taf.config.yml v1) của dự án và điền giá trị mặc định. Xem docs/11-cau-hinh.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";
import { resolveLabels } from "./labels.mjs";

import { TafError } from "./errors.mjs";

export { TafError };

/**
 * Giá trị mặc định của ai-kit.yml (version 2). Hai lớp:
 * - quy trình (language, project, agents, guides, docs, spec, progress, stack, review): lệnh /spec… đọc qua `kit context`;
 * - TAF (testcases, scripts, run, trigger, gate, tracker): y như taf.config.yml v1.
 * Xem docs/11-cau-hinh.md.
 */
const DEFAULTS = {
  language: "vi", // ngôn ngữ của tài liệu, câu hỏi, báo cáo do AI viết ra
  project: {
    name: null,
    baseBranch: "main",
    remote: "origin",
    prTool: "gh", // gh | none (in mô tả PR để người tự tạo)
  },
  agents: ["claude"], // công cụ AI cần cài vỏ lệnh + khối cầu nối: claude, agents-md (adapters/agent/)
  kitRef: "v2", // phiên bản ai-kit (tag) — vỏ lệnh clone đúng bản này vào .ai-kit/ khi máy chưa có
  guides: [], // lớp kỹ thuật của repo (CLAUDE.md, AGENTS.md…): AI đọc trước khi làm; kit init tự dò
  docs: {
    author: "BA Team", // cột Tác giả trong Change Log
    splitAt: 50000, // FSD vượt ngưỡng (byte) thì tách thành thư mục FSD-<tên>/
  },
  spec: {
    adapter: "prd-fsd", // tên adapter có sẵn trong adapters/spec/, hoặc đường dẫn ./x.mjs của dự án
    roots: ["docs/features"],
    featurePattern: null, // mặc định theo codeDigits: [A-Z]{2,4}-F\d{2,3} (2) / [A-Z]{2,4}-F\d{3,4} (3)
    codeDigits: 2, // số chữ số của F, US, SCR, BR, NFR, CMP (2: DM-F01, 3: DM-F001); vượt hết số thì cấp thêm một chữ số
    normalize: [],
    status: { draft: "Nháp", approved: "Đã duyệt" },
    index: null, // tuỳ chọn: file đăng ký module (PRD tổng)
    smallItem: null, // tuỳ chọn: { pattern: 'KI-\\d{2}', file } — việc nhỏ/bug, không qua duyệt
    plansDir: "docs/plans",
    templates: {}, // ghi đè khuôn: { fsd, prd, plan, prototype } — mặc định lấy trong kit
    wireframeWidth: 76,
    prototype: true, // false: bỏ bước /prototype
  },
  progress: {
    file: null, // tuỳ chọn: bảng tiến độ triển khai theo mã
    values: {
      todo: "Chưa bắt đầu",
      doing: "Đang triển khai",
      done: ["Hoàn thành", "Đã kiểm thử"],
    },
  },
  stack: {
    checks: [], // [{ name, run, cwd? }] — /dev, /ship chạy theo thứ tự
    traceability: { searchPaths: ["src"] }, // nơi grep mã truy vết trong code + test
    env: null, // mô tả ngắn môi trường cần chạy để test e2e ở máy
  },
  review: { checklist: null }, // file checklist riêng của repo, reviewer đọc thêm
  testcases: {
    dir: "e2e/testcases",
    labels: "vi", // vi | en | { base: vi, ...ghi đè }
    personas: null, // tuỳ chọn: file liệt kê tên persona hợp lệ (map YAML hoặc danh sách)
  },
  scripts: {
    dir: "e2e/scripts", // nơi đặt script sinh ra: <dir>/<FEATURE><ext>
    ext: ".spec.mjs",
    guide: null, // hướng dẫn viết test của dự án, Claude đọc khi sinh script
    // Khi sinh script / triage, AI chỉ được ghi vào đây. Test case không nằm trong danh sách: check-paths chỉ chấp nhận
    // TC nháp hoặc TC đã duyệt còn khớp approvedHash — AI không được sửa TC đã duyệt.
    allowedPaths: ["e2e/scripts/**", "e2e/pages/**"],
    forbid: [], // regex cấm xuất hiện trong script sinh ra (vd locator ngoài page object)
    lint: null, // lệnh kiểm của dự án sau khi sinh (vd tsc --noEmit)
  },
  run: {
    // Lệnh chạy test của dự án; {files} = script được chọn, {grep} = mẫu --grep. App do dự án dựng trước (CI của
    // repo, hoặc người bật ở máy); kit truyền địa chỉ qua biến baseUrlEnv. Xem docs/04-ci-workflow.md.
    command: "npx playwright test --reporter=json,list {files}",
    baseUrlEnv: "E2E_BASE_URL",
    smoke: ["e2e/tests/**"], // test luôn chạy kèm ở phạm vi changed (smoke / đường chính) — bắt hồi quy chéo feature
    smokePriority: "P1", // changed: chạy thêm TC có "Ưu tiên" này của các feature khác (null = tắt)
    cwd: ".",
    report: "e2e/test-results/raw/results.json", // JSON report của Playwright (kit đặt PLAYWRIGHT_JSON_OUTPUT_NAME); result.json, triage.json nằm cạnh
    reportsDir: "e2e/test-results/reports", // báo cáo markdown cho người đọc: latest.md + mỗi lần chạy một file
    keepReports: 20, // số báo cáo theo thời gian giữ lại
    history: "e2e/test-results/history.jsonl", // lịch sử kết quả từng lần chạy (kit flaky); CI giữ bằng cache
    keepHistory: 50,
    quarantine: "e2e/quarantine.yml", // test đang cách ly: [{ test, issue, until, reason }] — commit cùng repo
  },
  trigger: {
    codePaths: [],
    statusFile: null, // mặc định = progress.file: dòng feature đổi sang statusDone → PR có feature đó
    statusDone: null, // mặc định = progress.values.done
    skipLabel: "e2e-skip",
    featureMap: {}, // { "<glob file code>": [<mã feature>…] } — PR đổi file khớp thì chạy cả script của các feature này
  },
  gate: {
    blockedLabel: "e2e-blocked",
    requireScript: true,
    allowSelfApproval: true, // false: người viết / sửa TC không được tự duyệt (kit approve từ chối, gate báo)
  },
  tracker: { adapter: "github", labels: ["bug", "e2e"] },
};

/** Khoá lồng nhau được trộn sâu một tầng nữa. */
const NESTED = { spec: ["status", "templates"], progress: ["values"], stack: ["traceability"] };

/** Vị trí file cấu hình, tìm theo thứ tự. Hai file sau là TAF 1.x (version: 1), vẫn đọc được. */
export const CONFIG_FILES = ["ai-kit.yml", "e2e/taf.config.yml", "taf.config.yml"];

/** @param {string} root @returns {string|null} */
export function findConfig(root) {
  for (const f of CONFIG_FILES)
    if (fs.existsSync(path.join(root, f))) return path.join(root, f);
  return null;
}

/** taf.config.yml v1 → dạng v2. v1 không có lớp quy trình; mặc định cũ của v1 được giữ. */
export function fromV1(raw) {
  // TAF 1.x chưa có lớp quy trình: không đòi vỏ lệnh/khối cầu nối cho tới khi chuyển sang ai-kit.yml.
  const out = { agents: [], ...raw, version: 2 };
  const spec = { ...(raw.spec || {}) };
  spec.featurePattern ??= "(?:[A-Z]{2,4}|CORE-C\\d{2})-F\\d{2}";
  if ("approvedValue" in spec) {
    spec.status = { ...(spec.status || {}), approved: spec.approvedValue };
    delete spec.approvedValue;
  }
  out.spec = spec;
  out.trigger = { statusDone: ["Hoàn thành"], ...(raw.trigger || {}) };
  // run.targets.<tên>.test (1.x) → run.command; start/stop là việc của CI dự án
  const targets = raw.run?.targets || {};
  const first = targets.ci || targets[Object.keys(targets)[0]];
  if (first?.test) {
    const { targets: _t, ...run } = raw.run;
    out.run = { ...run, command: first.test, ...(first.cwd ? { cwd: first.cwd } : {}) };
  }
  // Tên cũ (v0.1): scripts.personas → testcases.personas
  if (raw.scripts?.personas && !raw.testcases?.personas)
    out.testcases = { ...(raw.testcases || {}), personas: raw.scripts.personas };
  return out;
}

/**
 * Mẫu regex (chuỗi) cho phần số của mã F / US / SCR / BR…: đúng `codeDigits` chữ số, cho phép thêm một chữ số khi một
 * phạm vi đã dùng hết số (vd 2 → \d{2,3}: DM-BR99 rồi DM-BR100).
 */
export function codeNum(cfg) {
  const d = cfg.spec?.codeDigits || 2;
  return `\\d{${d},${d + 1}}`;
}

/**
 * Trộn cấu hình thô (version 2) với mặc định. Không đọc file — dùng cho test và `kit context`.
 * @param {any} raw @param {string} root @param {string|null} file
 */
export function resolveConfig(raw, root, file = null) {
  /** @type {any} */
  const cfg = { root, file, version: 2 };
  for (const [k, def] of Object.entries(DEFAULTS)) {
    const v = raw[k];
    if (Array.isArray(def) || typeof def !== "object" || def === null) {
      cfg[k] = v ?? def;
      continue;
    }
    cfg[k] = { ...def, ...(v || {}) };
    for (const n of NESTED[k] || [])
      cfg[k][n] = { ...def[n], ...((v && v[n]) || {}) };
  }
  for (const k of Object.keys(raw)) if (!(k in cfg)) cfg[k] = raw[k];
  const d = Number(cfg.spec.codeDigits) || 2;
  if (![2, 3].includes(d)) throw new TafError(`spec.codeDigits phải là 2 hoặc 3 (đang là ${cfg.spec.codeDigits})`);
  cfg.spec.codeDigits = d;
  cfg.spec.featurePattern ||= `[A-Z]{2,4}-F${codeNum(cfg)}`;
  cfg.trigger.statusFile ??= cfg.progress.file;
  cfg.trigger.statusDone ??= cfg.progress.values.done;
  cfg.labels = resolveLabels(cfg.testcases.labels);
  return cfg;
}

/**
 * Mọi đường dẫn trong cấu hình tính từ gốc dự án (`root`), không phải từ thư mục chứa file cấu hình.
 * @param {{ root?: string, config?: string }} [opts]
 */
export function loadConfig(opts = {}) {
  const root = path.resolve(opts.root || process.cwd());
  const file = opts.config ? path.resolve(opts.config) : findConfig(root);
  if (!file || !fs.existsSync(file))
    throw new TafError(
      `Không thấy file cấu hình ${file || CONFIG_FILES.map((f) => path.join(root, f)).join(" hoặc ")}. Chạy: kit init`,
    );
  let raw = YAML.parse(fs.readFileSync(file, "utf8")) || {};
  const sourceVersion = raw.version;
  if (raw.version === 1) raw = fromV1(raw);
  else if (raw.version !== 2)
    throw new TafError(`${file}: chỉ hỗ trợ version: 2 (ai-kit.yml) hoặc 1 (taf.config.yml)`);
  const cfg = resolveConfig(raw, root, file);
  cfg.sourceVersion = sourceVersion;
  return cfg;
}

/**
 * Nạp cấu hình + spec adapter. Mọi lệnh dùng hàm này; cfg.adapter là adapter đã tạo.
 * @param {{ root?: string, config?: string }} [opts]
 */
export async function loadProject(opts = {}) {
  const cfg = loadConfig(opts);
  cfg.adapter = await loadSpecAdapter(cfg);
  return cfg;
}

const BUILTIN = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../adapters",
);

/** Nạp module adapter: tên có sẵn trong adapters/<kind>/ hoặc đường dẫn tương đối gốc dự án. */
export async function importAdapter(cfg, kind, name) {
  const file =
    name.startsWith(".") || name.startsWith("/")
      ? path.resolve(cfg.root, name)
      : path.join(BUILTIN, kind, `${name}.mjs`);
  if (!fs.existsSync(file))
    throw new TafError(`Không thấy ${kind} adapter "${name}" (${file})`);
  return import(pathToFileURL(file).href);
}

async function loadSpecAdapter(cfg) {
  const mod = await importAdapter(cfg, "spec", cfg.spec.adapter);
  if (typeof mod.createSpecAdapter !== "function")
    throw new TafError(
      `Spec adapter "${cfg.spec.adapter}" phải export createSpecAdapter(cfg)`,
    );
  const a = mod.createSpecAdapter(cfg);
  for (const fn of [
    "findFeature",
    "listFeatures",
    "requiredCodes",
    "scopeOf",
    "featureRegex",
    "traceRegex",
  ])
    if (typeof a[fn] !== "function")
      throw new TafError(`Spec adapter "${cfg.spec.adapter}" thiếu ${fn}()`);
  return a;
}

/** Đường dẫn tương đối so với gốc dự án, dùng dấu /. */
export function rel(cfg, abs) {
  return path.relative(cfg.root, abs).split(path.sep).join("/");
}
