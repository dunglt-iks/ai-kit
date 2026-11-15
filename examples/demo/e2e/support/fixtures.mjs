// Phần của dự án: test dùng chung. Script sinh ra import { test, expect, persona } từ đây.
//   fx.order({...})                  tạo đơn qua API bằng phiên của persona hiện tại, tự xoá sau test
//   fx.order({...}, { as: "sale-2" }) tạo đơn bằng phiên của persona khác, tự xoá sau test
//   fx.track(id)                      đăng ký xoá sau test một đơn tạo qua giao diện (id lấy từ form.saveCreated())
//   fx.uniq("Khách")                  tên duy nhất "E2E Khách 3k9x…"
// Dọn lỗi không làm test fail nhưng được ghi vào kết quả (annotation "cleanup") để thấy môi trường đang bẩn dần.
import { test as base, expect } from "@playwright/test";
import { persona } from "./personas.mjs";

export { expect, persona };

export const test = base.extend({
  fx: async ({ page, browser }, use, testInfo) => {
    const created = []; // { id, request } — xoá bằng đúng phiên đã tạo
    const contexts = [];
    const fx = {
      uniq: (label = "") =>
        `E2E ${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.replace(/\s+/g, " "),
      /** Tạo đơn qua API. Mặc định: SL 1, đơn giá 100000, CK 0. `as`: persona khác persona của test. */
      async order(o = {}, { as } = {}) {
        let request = page.request;
        if (as) {
          const ctx = await browser.newContext({ storageState: persona(as), baseURL: testInfo.project.use.baseURL });
          contexts.push(ctx);
          request = ctx.request;
        }
        const data = { product: "Sản phẩm E2E", qty: 1, price: 100000, discount: 0, ...o };
        data.customer ??= fx.uniq("Khách");
        const res = await request.post("/api/orders", { data });
        expect(res.status(), await res.text()).toBe(201);
        const rec = await res.json();
        created.push({ id: rec.id, request });
        return rec;
      },
      /** Đơn tạo qua giao diện: đăng ký để xoá sau test. */
      track(id) {
        if (id != null) created.push({ id, request: page.request });
      },
    };
    await use(fx);
    for (const { id, request } of created.reverse()) {
      const res = await request.delete(`/api/test/orders/${id}`).catch((e) => ({ ok: () => false, status: () => e.message }));
      if (!res.ok())
        testInfo.annotations.push({ type: "cleanup", description: `Không xoá được đơn #${id} (${res.status()})` });
    }
    for (const ctx of contexts) await ctx.close();
  },
});
