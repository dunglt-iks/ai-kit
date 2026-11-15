// @ts-check
// Spec adapter "prd-fsd": đọc spec dạng PRD + FSD (định dạng của app-base, xem .claude/templates/fsd.md ở đó).
//
// - Feature: heading cấp 1–3 trong file FSD (FSD-*.md hoặc file trong thư mục FSD-*/), dạng
//   "## 7. DL-F05 — Tên". Phần của feature kéo tới heading kế tiếp cùng cấp hoặc cao hơn.
// - Màn hình: heading "#### DL-F05-SCR01". Luồng: heading "#### DL-F05-US01"; nhánh là dòng
//   "- **A1 — …**" / "- **E1 — …**" trong phần của luồng đó.
// - Trạng thái duyệt: cột "Spec" (và "Prototype" nếu có) của bảng Feature Summary trong PRD-*.md cùng thư mục
//   module. Ô đã duyệt = giá trị spec.status.approved, có thể kèm "(người, ngày)" do `kit approve` ghi.
// - Prototype: PROTOTYPE-*.html trong thư mục module; `kit approve --prototype` ghi dấu
//   `<!-- ai-kit:prototype <MÃ>=<hash màn hình> -->` để biết màn hình trong spec có đổi sau khi duyệt không.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { rel } from "../../cli/src/config.mjs";

const HEADING = /^(#{1,6})\s+(.*)$/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function isFsdFile(relPath) {
  return /(^|\/)FSD-[^/]+(\.md$|\/)/.test(relPath);
}

/** Hash của phần spec: bỏ khoảng trắng cuối dòng và dòng trống đầu/cuối. */
export function hashText(text) {
  const norm = text
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
  return crypto.createHash("sha256").update(norm).digest("hex").slice(0, 16);
}

function sectionEnd(lines, start, level) {
  for (let i = start + 1; i < lines.length; i++) {
    const m = HEADING.exec(lines[i]);
    if (m && m[1].length <= level) return i;
  }
  return lines.length;
}

/** Phần mở đầu của feature: từ heading tới heading con đầu tiên (tối đa 10 dòng). */
function introOf(lines, start) {
  const out = [lines[start]];
  for (let i = start + 1; i < Math.min(lines.length, start + 10); i++) {
    if (HEADING.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

/** Số thành phần trong bảng "| # | Thành phần | …" của một màn hình (chữ số; ①… của spec cũ cũng nhận). */
function screenElements(block) {
  const out = [];
  let inTable = false;
  for (const l of block) {
    if (/^\s*\|\s*#\s*\|/.test(l)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!/^\s*\|/.test(l)) {
      inTable = false;
      continue;
    }
    const cell = l.split("|")[1].trim();
    const n = /^\d+$/.test(cell) ? Number(cell) : CIRCLED.indexOf(cell) + 1;
    if (n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

function parseFeatureSection(code, lines, start, end, num) {
  const screens = [];
  const stories = [];
  const escaped = code.replace(/[-]/g, "\\-");
  const scrRe = new RegExp(`^(#{2,6})\\s+(${escaped}-SCR${num})\\b(.*)$`);
  const usRe = new RegExp(`^(#{2,6})\\s+(${escaped}-US${num})\\b(.*)$`);
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    const scr = scrRe.exec(line);
    if (scr) {
      const e = Math.min(sectionEnd(lines, i, scr[1].length), end);
      const head = lines.slice(i, Math.min(e, i + 4)).join("\n");
      screens.push({
        code: scr[2],
        deprecated: /\[DEPRECATED\]/.test(head),
        elements: screenElements(lines.slice(i, e)),
        text: lines.slice(i, e).join("\n"),
      });
      continue;
    }
    const us = usRe.exec(line);
    if (!us) continue;
    const e = Math.min(sectionEnd(lines, i, us[1].length), end);
    const block = lines.slice(i, e);
    // Tên luồng: dòng không rỗng đầu tiên sau heading (thường là "**Tên**").
    const titleLine = block.slice(1).find((l) => l.trim() !== "");
    const branches = [];
    for (const l of block) {
      const b = /^\s*-\s+\*\*([AE]\d+)\b/.exec(l);
      if (b && !branches.includes(`${us[2]}-${b[1]}`))
        branches.push(`${us[2]}-${b[1]}`);
    }
    stories.push({
      code: us[2],
      title:
        titleLine && !/^[-|>#]/.test(titleLine.trim())
          ? titleLine.replace(/\*\*/g, "").trim()
          : us[3].replace(/^[\s—-]+/, ""),
      line: i + 1,
      deprecated: /\[DEPRECATED\]/.test(block.slice(0, 4).join("\n")),
      branches,
    });
  }
  return { screens, stories };
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim().replace(/\*\*/g, ""));
}

/** Ô trạng thái có phải "đã duyệt" không: đúng giá trị, hoặc giá trị + " (người, ngày)". */
export function isApprovedCell(cell, approved) {
  if (!cell) return false;
  return cell === approved || cell.startsWith(`${approved} (`);
}

/** Ô "không cần" (feature không có giao diện). */
const NOT_NEEDED = new Set(["—", "-", "–", "n/a", "N/A", ""]);

function moduleDir(fsdAbs) {
  let dir = path.dirname(fsdAbs);
  if (/^FSD-/.test(path.basename(dir))) dir = path.dirname(dir);
  return dir;
}

const RULE_REF = /(?<![A-Z0-9-])([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-BR\d+)(?![0-9])/g;

/**
 * Định nghĩa các quy tắc BR mà đoạn spec dẫn tới nhưng khai ở chỗ khác trong module (bảng quy tắc của PRD, dòng in
 * đậm hay heading của feature khác): dòng bảng `| <mã> | …`, dòng bắt đầu `**<mã>` hoặc heading chứa mã kèm thân
 * tới heading kế. Ghép vào hash của feature, để BR dùng chung đổi thì TC của mọi feature dẫn tới nó thành lỗi thời.
 */
function externalRules(fsdAbs, text) {
  const codes = [...new Set([...text.matchAll(RULE_REF)].map((m) => m[1]))].sort();
  if (!codes.length) return "";
  const files = walk(moduleDir(fsdAbs)).filter((f) => !/^PROTOTYPE-/.test(path.basename(f)));
  const out = [];
  for (const code of codes) {
    const esc = code.replace(/-/g, "\\-");
    const row = new RegExp(`^\\s*\\|\\s*${esc}\\s*\\|`);
    const bold = new RegExp(`^\\s*(?:[-*]\\s+)?\\*\\*${esc}\\b`);
    const head = new RegExp(`^(#{2,6})\\s+.*\\b${esc}\\b`);
    for (const f of files) {
      const lines = fs.readFileSync(f, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        let def = null;
        if (row.test(lines[i]) || bold.test(lines[i])) def = lines[i].trimEnd();
        else {
          const h = head.exec(lines[i]);
          if (h) {
            let e = i + 1;
            while (e < lines.length && !(/^#{1,6}\s/.test(lines[e]) && lines[e].match(/^#+/)[0].length <= h[1].length)) e++;
            def = lines.slice(i, e).map((l) => l.trimEnd()).join("\n").trim();
          }
        }
        if (def && !text.includes(def)) out.push(def);
      }
    }
  }
  return out.join("\n");
}

function findPrd(fsdAbs) {
  const dir = moduleDir(fsdAbs);
  const prd = fs.existsSync(dir)
    ? fs.readdirSync(dir).find((f) => /^PRD-.+\.md$/.test(f))
    : null;
  return prd ? path.join(dir, prd) : null;
}

/**
 * Tìm ô của mã trong bảng Feature Summary (dòng đầu là "Code"/"Mã", có cột "Spec").
 * @returns {{ lines: string[], row: number, cols: Record<string, number>, cells: string[] } | null}
 */
function findRow(prdAbs, code) {
  const lines = fs.readFileSync(prdAbs, "utf8").split("\n");
  let cols = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) {
      cols = null;
      continue;
    }
    const cells = splitRow(line);
    if (!cols) {
      if (/^(Code|Mã)$/.test(cells[0]) && cells.includes("Spec")) {
        cols = {};
        cells.forEach((c, k) => (cols[c] = k));
      } else cols = {};
      continue;
    }
    if (!("Spec" in cols)) continue;
    if (cells[0] === code) return { lines, row: i, cols, cells };
  }
  return null;
}

/** Đọc cột "Spec", "Prototype" của dòng mã feature trong PRD-*.md ở thư mục module. */
function readStatus(fsdAbs, code) {
  const prdAbs = findPrd(fsdAbs);
  if (!prdAbs) return { status: null, prototype: undefined, prd: null };
  const r = findRow(prdAbs, code);
  if (!r) return { status: null, prototype: undefined, prd: prdAbs };
  return {
    status: r.cells[r.cols.Spec] || null,
    prototype: "Prototype" in r.cols ? (r.cells[r.cols.Prototype] ?? "") : undefined,
    prd: prdAbs,
  };
}

const STAMP = /<!-- ai-kit:prototype ([^>]*?)-->/;

function prototypeFile(fsdAbs) {
  const dir = moduleDir(fsdAbs);
  const f = fs.existsSync(dir)
    ? fs.readdirSync(dir).find((x) => /^PROTOTYPE-.+\.html$/.test(x))
    : null;
  return f ? path.join(dir, f) : null;
}

function readStamps(htmlAbs) {
  const m = htmlAbs && fs.existsSync(htmlAbs) ? STAMP.exec(fs.readFileSync(htmlAbs, "utf8")) : null;
  const out = {};
  if (m) for (const kv of m[1].trim().split(/\s+/)) {
    const [k, v] = kv.split("=");
    if (k && v) out[k] = v;
  }
  return out;
}

export function createSpecAdapter(cfg) {
  // Phần số của US / SCR / BR: codeDigits chữ số, cho phép thêm một chữ số khi vượt (xem config.codeNum)
  const d = cfg.spec.codeDigits || 2;
  const num = `\\d{${d},${d + 1}}`;
  /** @type {Map<string, any>} */
  let index = null;
  /** @type {Map<string, string[]>} mã feature khai ở nhiều chỗ */
  let dupes = null;

  function build() {
    index = new Map();
    dupes = new Map();
    const featHead = new RegExp(
      `^(#{1,3})\\s+.*?(?<![A-Z0-9-])(${cfg.spec.featurePattern})\\s+[—–-]\\s+(.+)$`,
    );
    for (const root of cfg.spec.roots) {
      for (const abs of walk(path.join(cfg.root, root))) {
        const r = rel(cfg, abs);
        if (!isFsdFile(r)) continue;
        const lines = fs.readFileSync(abs, "utf8").split("\n");
        lines.forEach((line, i) => {
          const m = featHead.exec(line);
          if (!m || /-(US|SCR)\d+/.test(line)) return;
          const code = m[2];
          if (index.has(code)) {
            const first = index.get(code);
            const list = dupes.get(code) || [`${first.file}:${first.line}`];
            list.push(`${r}:${i + 1}`);
            dupes.set(code, list);
            return;
          }
          const end = sectionEnd(lines, i, m[1].length);
          const text = lines.slice(i, end).join("\n");
          index.set(code, {
            code,
            name: m[3].trim(),
            abs,
            file: r,
            line: i + 1,
            start: i,
            end,
            lines,
            text,
          });
        });
      }
    }
  }

  function findFeature(code) {
    if (!index) build();
    const raw = index.get(code);
    if (!raw) return null;
    if (!raw.parsed) {
      const { screens, stories } = parseFeatureSection(
        code,
        raw.lines,
        raw.start,
        raw.end,
        num,
      );
      const { status, prototype, prd } = readStatus(raw.abs, code);
      const approvedValue = cfg.spec.status.approved;
      const ui = screens.filter((x) => !x.deprecated);
      const screensHash = ui.length ? hashText(ui.map((x) => x.text).join("\n")) : null;
      const protoAbs = prototypeFile(raw.abs);
      const protoRequired =
        cfg.spec.prototype !== false && !!screensHash && prototype !== undefined && !NOT_NEEDED.has(prototype);
      const rulesExt = externalRules(raw.abs, raw.text);
      raw.parsed = {
        code,
        name: raw.name,
        file: raw.file,
        line: raw.line,
        deprecated: /\[DEPRECATED\]/.test(introOf(raw.lines, raw.start)),
        status,
        approved: isApprovedCell(status, approvedValue),
        statusFile: prd ? rel(cfg, prd) : null,
        prototype: {
          required: protoRequired,
          status: prototype ?? null,
          approved: isApprovedCell(prototype, approvedValue),
          file: protoAbs ? rel(cfg, protoAbs) : null,
          screensHash,
          stamp: readStamps(protoAbs)[code] ?? null,
        },
        duplicates: dupes.get(code) || [],
        hash: hashText(rulesExt ? `${raw.text}\n${rulesExt}` : raw.text),
        screens: screens.map(({ text, ...x }) => x),
        stories,
        text: raw.text,
      };
    }
    return raw.parsed;
  }

  function listFeatures() {
    if (!index) build();
    return [...index.keys()].sort();
  }

  const f = cfg.spec.featurePattern;
  const scopePattern = cfg.spec.scopePattern || f.replace(/-F\\d\{2\}$/, "");

  /**
   * Ghi trạng thái vào ô Spec / Prototype của PRD (dùng cho `kit approve`). Thiếu cột Prototype thì thêm cột.
   * @param {string} code @param {'Spec'|'Prototype'} column @param {string} value
   */
  function setStatus(code, column, value) {
    const f = findFeature(code);
    if (!f) throw new Error(`Không tìm thấy feature ${code}`);
    const prdAbs = findPrd(path.join(cfg.root, f.file));
    if (!prdAbs) throw new Error(`Không thấy PRD-*.md cùng thư mục module của ${f.file}`);
    const r = findRow(prdAbs, code);
    if (!r) throw new Error(`${rel(cfg, prdAbs)}: không có dòng ${code} trong bảng Feature Summary (cột Code/Mã, Spec)`);
    let { lines, cols } = r;
    if (!(column in cols)) {
      // thêm cột vào cả bảng: tiêu đề, dòng phân cách, mọi dòng
      let top = r.row;
      while (top > 0 && lines[top - 1].trim().startsWith("|")) top--;
      for (let i = top; i < lines.length && lines[i].trim().startsWith("|"); i++) {
        const extra = i === top ? column : i === top + 1 ? "---" : "—";
        lines[i] = lines[i].replace(/\|\s*$/, `| ${extra} |`);
      }
      cols = { ...cols, [column]: Object.keys(cols).length };
    }
    const parts = lines[r.row].split("|");
    // parts[0] là phần trước dấu | đầu tiên
    parts[cols[column] + 1] = ` ${value} `;
    lines[r.row] = parts.join("|");
    fs.writeFileSync(prdAbs, lines.join("\n"));
    index = null;
    return rel(cfg, prdAbs);
  }

  /** Ghi dấu hash màn hình của feature vào file prototype. */
  function stampPrototype(code) {
    const f = findFeature(code);
    const abs = f?.prototype.file && path.join(cfg.root, f.prototype.file);
    if (!abs || !fs.existsSync(abs)) throw new Error(`Chưa có PROTOTYPE-*.html trong thư mục module của ${code}`);
    const text = fs.readFileSync(abs, "utf8");
    const stamps = { ...readStamps(abs), [code]: f.prototype.screensHash };
    const line = `<!-- ai-kit:prototype ${Object.entries(stamps)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")} -->`;
    fs.writeFileSync(abs, STAMP.test(text) ? text.replace(STAMP, line) : `${line}\n${text}`);
    index = null;
    return f.prototype.file;
  }

  return {
    findFeature,
    listFeatures,
    setStatus,
    stampPrototype,
    duplicates: () => {
      if (!index) build();
      return Object.fromEntries(dupes);
    },
    requiredCodes,
    /** DL-F05 → DL, CORE-C10-F01 → CORE-C10 */
    scopeOf: (code) => code.replace(/-F\d+$/, ""),
    featureRegex: () => new RegExp(`(?<![A-Z0-9])(${f})(?![0-9])`, "g"),
    /** feature, -USnn, -SCRnn, -USnn-A#/E#, hoặc <scope>-BRnn */
    traceRegex: () =>
      new RegExp(
        `(?<![A-Z0-9])((?:${f})(?:-(?:US|SCR)${num}(?:-[AE]\\d+)?)?|(?:${scopePattern})-BR${num})(?![0-9])`,
        "g",
      ),
  };
}

/** Các mã một feature bắt buộc phải có test case phủ (bỏ phần DEPRECATED). */
export function requiredCodes(feature) {
  const out = [];
  for (const s of feature.stories) {
    if (s.deprecated) continue;
    out.push(s.code, ...s.branches);
  }
  for (const s of feature.screens) if (!s.deprecated) out.push(s.code);
  return out;
}
