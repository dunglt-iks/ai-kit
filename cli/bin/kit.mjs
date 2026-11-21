#!/usr/bin/env node
// kit — CLI của ai-kit (quy trình + TAF). Chạy với cwd là gốc repo dự án (nơi có ai-kit.yml).
// Lớp này chỉ kiểm thư viện của kit đã cài chưa (thiếu thì báo lệnh cần chạy, thay cho lỗi gốc của Node),
// rồi nạp phần chính ở cli/src/cli.mjs.
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
try {
  await import("yaml");
} catch (e) {
  if (e?.code !== "ERR_MODULE_NOT_FOUND") throw e;
  console.error(
    `kit: thiếu thư viện của kit (yaml) ở ${KIT}.\n` +
      "  Gói ai-kit cài qua npm (devDependencies) thì chạy lại npm install ở dự án; bản clone repo kit thì npm ci trong đó.",
  );
  process.exit(2);
}
await import("../src/cli.mjs");
