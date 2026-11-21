// @ts-check
// Issue theo dõi theo môi trường (kit e2e --track): mỗi môi trường tối đa một issue đang mở "🔴 E2E <env> đang đỏ".
// Lần chạy đỏ: chưa có issue → mở; đã có → sửa thân (danh sách fail hiện tại) + comment (fail mới / đã hết).
// Lần chạy xanh: comment rồi đóng. Không phải ghi bug: bug từng lỗi do người phân loại (/kit:e2e-triage) rồi ghi riêng.
// Tất định, không gọi AI. Xem docs/07-bug-reporting.md.
import { commentIssue, createIssue, ensureLabel, findOpenIssue, updateIssue } from "./github.mjs";

const FAILS = /<!--\s*ai-kit:fails=(\S*)\s*-->/;
const SINCE = /<!--\s*ai-kit:since=(\S*)\s*-->/;

export const trackMarker = (env) => `<!-- ai-kit:track env=${env} -->`;
export const trackLabel = (cfg, env) => String(cfg.tracker.trackLabel || "e2e:{env}").replaceAll("{env}", env);

const short = (sha) => (sha ? String(sha).slice(0, 7) : "?");
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const enc = (list) => list.map(encodeURIComponent).join(",");
const dec = (s) => (s ? s.split(",").filter(Boolean).map(decodeURIComponent) : []);

/** Khoá các thứ đang làm đỏ lần chạy: tên test fail, TC đã duyệt chưa có test chạy, lỗi chung (không test nào chạy). */
export function redKeys(report, note) {
  return [
    ...(report?.failures || []).map((f) => f.title),
    ...(report?.unverified || []).flatMap((u) => u.tcs.map((tc) => `${tc} (chưa có test chạy)`)),
    ...(report?.quarantineProblems || []).map((p) => `quarantine: ${p}`),
    ...(note ? [note] : []),
  ];
}

/**
 * Thân issue: danh sách đỏ hiện tại + việc cần làm.
 * @param {{ env: string, report: any, note?: string, commit?: string, run?: string, runId?: string, since: string }} c
 */
export function trackBody(c) {
  const r = c.report;
  const t = r?.totals;
  const lines = [
    trackMarker(c.env),
    `**Môi trường:** \`${c.env}\` · **Đỏ từ:** ${c.since}`,
    `**Lần chạy gần nhất:** commit \`${short(c.commit)}\`${c.run ? ` · [run](${c.run})` : ""}${t ? ` — ${t.failed} fail, ${t.passed}/${t.tests} pass` : ""}`,
    "",
  ];
  if (c.note) lines.push(`✘ ${c.note}`, "");
  const product = (r?.failures || []).filter((f) => !f.setup);
  const setup = (r?.failures || []).filter((f) => f.setup);
  const table = (list) => [
    "| TC | Test | Bước fail |",
    "|---|---|---|",
    ...list.map((f) => `| ${f.tc || "—"} | ${cell(f.title)} | ${cell(f.step || "—")} |`),
  ];
  if (product.length) lines.push(`### Test fail (${product.length})`, "", ...table(product), "");
  if (setup.length)
    lines.push(
      `### Lỗi dựng dữ liệu (${setup.length}) — feature chưa được kiểm`,
      "",
      "Lỗi ở fixture / dữ liệu / môi trường, không kết luận feature hỏng.",
      "",
      ...table(setup),
      "",
    );
  if (r?.unverified?.length)
    lines.push(
      "### TC đã duyệt chưa có test chạy",
      "",
      ...r.unverified.map((u) => `- ${u.feature}: ${u.tcs.join(", ")}`),
      "",
    );
  lines.push(
    "### Việc cần làm",
    "",
    `1. Ở máy: \`/kit:e2e-triage${c.runId ? ` ${c.runId}` : ""}\` — tải kết quả lần chạy, phân loại, sửa script; bug app thì ghi issue riêng (nhắc lại issue này).`,
    "2. Lỗi dựng dữ liệu: sửa fixture hoặc cấu hình môi trường, không sửa test cho khớp.",
    "",
    "_Issue do ai-kit tự mở, cập nhật và đóng khi môi trường xanh lại — không sửa tay phần trên._",
    "",
    `<!-- ai-kit:since=${encodeURIComponent(c.since)} -->`,
    `<!-- ai-kit:fails=${enc(redKeys(r, c.note))} -->`,
  );
  return lines.join("\n");
}

/**
 * Lập việc (không gọi GitHub).
 * @param {{ env: string, red: boolean, report: any, note?: string, open: { id: any, body: string } | null,
 *   commit?: string, run?: string, runId?: string, at?: string }} o
 * @returns {{ type: 'create'|'update'|'close'|'none', title?: string, body?: string, comment?: string }}
 */
export function planTrack(o) {
  const where = `commit \`${short(o.commit)}\`${o.run ? ` ([run](${o.run}))` : ""}`;
  if (!o.red)
    return o.open
      ? { type: "close", comment: `✓ Xanh lại ở ${where}. Tự đóng.` }
      : { type: "none" };
  const keys = redKeys(o.report, o.note);
  const prevSince = o.open && SINCE.exec(o.open.body)?.[1];
  const since = prevSince ? decodeURIComponent(prevSince) : `commit \`${short(o.commit)}\`${o.run ? ` ([run](${o.run}))` : ""} · ${(o.at || new Date().toISOString()).slice(0, 10)}`;
  const body = trackBody({ ...o, since });
  if (!o.open) return { type: "create", title: `🔴 E2E \`${o.env}\` đang đỏ`, body };
  const before = new Set(dec(FAILS.exec(o.open.body)?.[1]));
  const now = new Set(keys);
  const added = keys.filter((k) => !before.has(k));
  const gone = [...before].filter((k) => !now.has(k));
  const comment = [
    `Vẫn đỏ ở ${where}${added.length || gone.length ? "" : " — không đổi so với lần trước"}.`,
    ...(added.length ? ["", `**Mới fail (${added.length}):**`, ...added.map((k) => `- ${k}`)] : []),
    ...(gone.length ? ["", `**Đã hết (${gone.length}):**`, ...gone.map((k) => `- ${k}`)] : []),
  ].join("\n");
  return { type: "update", body, comment };
}

/**
 * Đồng bộ issue theo dõi của môi trường `env` trên GitHub.
 * @param {any} cfg
 * @param {{ env: string, red: boolean, report: any, note?: string, commit?: string, log?: (m: string) => void }} o
 */
export async function syncTrack(cfg, o) {
  const log = o.log || console.log;
  const label = trackLabel(cfg, o.env);
  const open = await findOpenIssue(label, trackMarker(o.env));
  const runId = process.env.GITHUB_RUN_ID;
  const run = runId ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}` : undefined;
  const plan = planTrack({ ...o, open, run, runId, at: o.report?.createdAt });
  if (plan.type === "create") {
    await ensureLabel(label);
    const i = await createIssue({ title: plan.title, body: plan.body, labels: [label] });
    log(`🔴 Mở issue theo dõi #${i.id} (${label})`);
  } else if (plan.type === "update" && open) {
    await updateIssue(open.id, { body: plan.body });
    await commentIssue(open.id, plan.comment);
    log(`🔴 Cập nhật issue theo dõi #${open.id}`);
  } else if (plan.type === "close" && open) {
    await commentIssue(open.id, plan.comment);
    await updateIssue(open.id, { state: "closed", state_reason: "completed" });
    log(`✓ Đóng issue theo dõi #${open.id} — ${o.env} xanh lại`);
  }
  return plan;
}
