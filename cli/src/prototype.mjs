// @ts-check
// Đối chiếu tất định spec ↔ prototype: mỗi màn hình (SCR) của feature có <section id="<mã viết thường>">, mỗi
// thành phần đánh số có data-ref="<mã SCR>-<số>", không có màn hình / thành phần lạ. Phần cần đọc hiểu (nhãn,
// quy tắc hiển thị, luồng đi được) do agent spec-reviewer soát. Xem docs/10-quy-trinh.md §3.1.
import fs from "node:fs";
import path from "node:path";
import { TafError } from "./config.mjs";

/** Phiên bản ở bảng đầu FSD: dòng dữ liệu đầu tiên dưới header có cột "Phiên bản". */
function fsdVersion(text) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /^\|\s*Phiên bản\s*\|/.test(l));
  if (i < 0 || !lines[i + 2]) return null;
  const m = /^\|\s*([\d.]+)\s*\|/.exec(lines[i + 2]);
  return m ? m[1] : null;
}

/**
 * @returns {{ code: string, file: string|null, skipped?: string, errors: string[], warnings: string[] }}
 */
export function checkPrototype(cfg, code) {
  const f = cfg.adapter.findFeature(code);
  if (!f) throw new TafError(`Không tìm thấy spec của ${code}`);
  const errors = [];
  const warnings = [];
  const screens = (f.screens || []).filter((s) => !s.deprecated);
  const file = f.prototype?.file ?? null;
  if (!screens.length) return { code, file, skipped: "feature không có màn hình", errors, warnings };
  if (!file && !f.prototype?.required)
    return { code, file, skipped: "chưa có prototype, PRD không theo dõi (không có cột Prototype hoặc ô là —)", errors, warnings };
  if (!file) {
    errors.push("chưa có file prototype — chạy `/prototype`");
    return { code, file, errors, warnings };
  }
  const html = fs.readFileSync(path.join(cfg.root, file), "utf8");
  const ids = new Set([...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1].toLowerCase()));
  const refs = new Set([...html.matchAll(/\bdata-ref="([^"]+)"/g)].map((m) => m[1].toUpperCase()));

  const known = new Set();
  for (const s of screens) {
    if (!ids.has(s.code.toLowerCase()))
      errors.push(`${s.code}: không có <section id="${s.code.toLowerCase()}">`);
    if (!s.elements) continue; // adapter không đọc được bảng thành phần → bỏ qua phần này
    if (!s.elements.length) warnings.push(`${s.code}: spec không có bảng thành phần (| # | Thành phần | …)`);
    const missing = s.elements.filter((n) => !refs.has(`${s.code}-${n}`));
    if (missing.length)
      errors.push(`${s.code}: thiếu data-ref cho thành phần ${missing.join(", ")}`);
    s.elements.forEach((n) => known.add(`${s.code}-${n}`));
  }
  const codes = new Set(screens.map((s) => s.code));
  const deprecated = new Set((f.screens || []).filter((s) => s.deprecated).map((s) => s.code));
  const scrRe = new RegExp(`^(${code.replace(/-/g, "\\-")}-SCR\\d+)(?:-(\\d+))?$`, "i");
  for (const id of ids) {
    const m = scrRe.exec(id);
    if (!m || m[2]) continue;
    const c = m[1].toUpperCase();
    if (deprecated.has(c)) warnings.push(`${c}: màn hình đã [DEPRECATED] trong spec nhưng prototype còn`);
    else if (!codes.has(c)) errors.push(`${c}: prototype có màn hình mà spec không có`);
  }
  for (const r of refs) {
    const m = scrRe.exec(r);
    if (!m) continue;
    if (deprecated.has(m[1])) continue;
    if (!codes.has(m[1])) errors.push(`data-ref ${r}: màn hình không có trong spec`);
    else if (!m[2]) errors.push(`data-ref ${r}: thiếu số thành phần (<mã SCR>-<số>)`);
    else if (!known.has(r) && screens.find((s) => s.code === m[1])?.elements)
      errors.push(`data-ref ${r}: thành phần không có trong bảng thành phần của spec`);
  }
  const ver = fsdVersion(fs.readFileSync(path.join(cfg.root, f.file), "utf8"));
  const bar = /Spec:[^<]*?\bv(\d+(?:\.\d+)*)/.exec(html);
  if (ver && bar && bar[1] !== ver)
    warnings.push(`thanh PROTOTYPE ghi spec v${bar[1]}, FSD hiện là v${ver}`);
  return { code, file, errors, warnings };
}
