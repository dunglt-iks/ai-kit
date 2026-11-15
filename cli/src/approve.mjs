// @ts-check
// kit approve: người duyệt spec / prototype / test case của một feature — ghi bằng code, kèm người và ngày.
// kit ready: feature đã đủ điều kiện để viết test case và code chưa (spec + prototype đã duyệt, prototype
// còn khớp màn hình trong spec, mã không bị khai trùng). Xem docs/10-quy-trinh.md §3.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { rel } from "./config.mjs";
import { TafError } from "./errors.mjs";
import { approvalHash, lintTestcase, testcasePath } from "./testcase.mjs";

/** Tên người duyệt: --by, rồi git config user.name, rồi biến USER. */
export function approverName(cfg, by) {
  if (by) return by;
  try {
    const n = execFileSync("git", ["config", "user.name"], { cwd: cfg.root, encoding: "utf8" }).trim();
    if (n) return n;
  } catch {}
  return process.env.USER || "?";
}

function adapterFeature(cfg, code) {
  const f = cfg.adapter.findFeature(code);
  if (!f) throw new TafError(`Không tìm thấy feature ${code}`);
  return f;
}

/**
 * Điều kiện để chạy /testcase, /e2e-script, /dev cho một feature.
 * @returns {{ code: string, ok: boolean, problems: string[], notes: string[] }}
 */
export function readyFeature(cfg, code) {
  const problems = [];
  const notes = [];
  const f = cfg.adapter.findFeature(code);
  if (!f) return { code, ok: false, problems: [`Không tìm thấy feature ${code}`], notes };
  if (f.deprecated) return { code, ok: false, problems: ["Feature [DEPRECATED]"], notes };
  if (f.duplicates?.length)
    problems.push(`Mã ${code} khai ở nhiều chỗ: ${f.duplicates.join(", ")} — đổi mã (kit next-code) rồi duyệt lại`);
  if (!f.approved)
    problems.push(
      `Spec chưa duyệt (Spec: ${f.status ?? "không rõ"} trong ${f.statusFile ?? "PRD"}) — xem spec rồi: kit approve ${code}`,
    );
  const p = f.prototype;
  if (!p) notes.push("Spec adapter không theo dõi prototype");
  else if (!p.required)
    notes.push(
      p.screensHash
        ? cfg.spec.prototype === false
          ? "Dự án không dùng prototype (spec.prototype: false)"
          : "Không theo dõi prototype cho feature này (PRD không có cột Prototype, hoặc ô ghi —)"
        : "Feature không có màn hình — không cần prototype",
    );
  else if (!p.file) problems.push(`Chưa có prototype — chạy /prototype ${f.file} ${code}`);
  else if (!p.approved)
    problems.push(`Prototype chưa duyệt (Prototype: ${p.status || "trống"}) — xem ${p.file} rồi: kit approve ${code} --prototype`);
  else if (p.stamp !== p.screensHash)
    problems.push(
      p.stamp
        ? `Màn hình trong spec đã đổi sau khi duyệt prototype — cập nhật ${p.file} (/prototype) rồi: kit approve ${code} --prototype`
        : `Prototype đã duyệt nhưng chưa có dấu ai-kit:prototype — chạy lại: kit approve ${code} --prototype`,
    );
  return { code, ok: problems.length === 0, problems, notes };
}

/**
 * Người đã viết / sửa file TC: tác giả các commit đụng file, cộng người dùng hiện tại nếu file đang có thay đổi chưa
 * commit (vừa chạy /testcase). Không phải repo git → [].
 */
export function testcaseAuthors(cfg, abs) {
  const run = (args) => execFileSync("git", args, { cwd: cfg.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  try {
    const out = new Set(run(["log", "--format=%an", "--", abs]).split("\n").filter(Boolean));
    if (run(["status", "--porcelain", "--", abs])) out.add(approverName(cfg));
    return [...out];
  } catch {
    return [];
  }
}

/** Duyệt test case: TC không lỗi, không lỗi thời → status đã duyệt + reviewer trong frontmatter. */
function approveTestcase(cfg, f, by) {
  const abs = testcasePath(cfg, f.code);
  const file = rel(cfg, abs);
  if (!fs.existsSync(abs)) throw new TafError(`Chưa có test case ${file} — chạy /testcase ${f.code}`);
  const { parsed, issues } = lintTestcase(cfg, abs);
  // lỗi do chính việc duyệt gây ra (thiếu / lệch approvedHash, chưa reviewer) không chặn việc duyệt lại
  const errs = issues.filter((i) => i.level === "error" && !/approvedHash|phải có "reviewer"/.test(i.msg));
  if (errs.length)
    throw new TafError(`${file} còn ${errs.length} lỗi (kit lint-tc) — sửa trước khi duyệt:\n  ${errs.map((i) => `${i.line}: ${i.msg}`).join("\n  ")}`);
  const fm = parsed.frontmatter || {};
  if (!fm.specHash)
    throw new TafError(`${file} chưa có specHash — /testcase ${f.code} ghi specHash của spec hiện tại trước`);
  if (fm.specHash !== f.hash)
    throw new TafError(`${file} lỗi thời: spec đã đổi sau khi viết TC — /testcase ${f.code} để đồng bộ trước`);
  const text = fs.readFileSync(abs, "utf8");
  const end = text.indexOf("\n---", 3);
  const head = text.slice(0, end);
  const set = (h, key, val) =>
    new RegExp(`^${key}:.*$`, "m").test(h) ? h.replace(new RegExp(`^${key}:.*$`, "m"), `${key}: ${val}`) : `${h}\n${key}: ${val}`;
  const name = approverName(cfg, by);
  const self = testcaseAuthors(cfg, abs).includes(name);
  if (self && cfg.gate.allowSelfApproval === false)
    throw new TafError(`${name} đã viết / sửa ${file} — cần người khác duyệt (gate.allowSelfApproval: false)`);
  let next = set(set(head, "status", cfg.labels.approved), "reviewer", JSON.stringify(name)) + text.slice(end);
  next = next.replace(/^approvedHash:.*\n?/m, "");
  const h = approvalHash(next);
  const fmEnd = next.indexOf("\n---", 3);
  next = `${next.slice(0, fmEnd)}\napprovedHash: "${h}"${next.slice(fmEnd)}`;
  fs.writeFileSync(abs, next);
  return {
    file,
    value: `${cfg.labels.approved} (${name})`,
    warning: self ? `${name} cũng là người viết / sửa test case này — nên để người khác duyệt (oracle độc lập)` : undefined,
  };
}

/**
 * Duyệt spec (mặc định), prototype hoặc test case của feature.
 * @param {{ what?: 'spec'|'prototype'|'testcase', prototype?: boolean, by?: string, date?: string }} [o]
 * @returns {{ file: string, value: string, stamped?: string }}
 */
export function approve(cfg, code, o = {}) {
  const a = cfg.adapter;
  const what = o.what || (o.prototype ? "prototype" : "spec");
  if (what === "testcase") return approveTestcase(cfg, adapterFeature(cfg, code), o.by);
  if (typeof a.setStatus !== "function")
    throw new TafError(`Spec adapter "${cfg.spec.adapter}" không hỗ trợ kit approve — duyệt theo cách của adapter`);
  const f = adapterFeature(cfg, code);
  if (f.deprecated) throw new TafError(`${code} đã [DEPRECATED]`);
  if (f.duplicates?.length)
    throw new TafError(`Mã ${code} khai ở nhiều chỗ: ${f.duplicates.join(", ")} — sửa trước khi duyệt`);
  const value = `${cfg.spec.status.approved} (${approverName(cfg, o.by)}, ${o.date || new Date().toISOString().slice(0, 10)})`;
  if (what === "spec") return { file: a.setStatus(code, "Spec", value), value };
  if (cfg.spec.prototype === false) throw new TafError("Dự án không dùng prototype (spec.prototype: false)");
  if (!f.prototype?.screensHash) throw new TafError(`${code} không có màn hình — không cần duyệt prototype`);
  if (!f.prototype.file) throw new TafError(`Chưa có prototype — chạy /prototype ${f.file} ${code}`);
  const stamped = a.stampPrototype(code);
  return { file: a.setStatus(code, "Prototype", value), value, stamped };
}
