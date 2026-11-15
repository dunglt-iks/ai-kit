// @taf-source e2e/testcases/DM/DM-F01.md sha256:e5188935457fd2bd
import { test, expect, persona } from "../../support/fixtures.mjs";
import { OrderListPage } from "../../pages/DM/OrderListPage.mjs";

test.use({ storageState: persona("sale") });

test("TC-DM-F01-001 Sale thấy đơn của mình, không thấy đơn của sale khác", async ({
  page,
  fx,
}) => {
  const k1 = fx.uniq("K1");
  const k2 = fx.uniq("K2");
  const mine = await fx.order({
    customer: k1,
    qty: 2,
    price: 50000,
    discount: 0,
  });
  await fx.order({ customer: k2 }, { as: "sale-2" });
  const list = new OrderListPage(page);
  await list.open();

  await test.step("Bước 1: tìm K1 → có dòng đơn của K1, thành tiền 100.000", async () => {
    await list.searchFor(k1);
    await expect(list.row(mine.id)).toBeVisible();
    await expect(list.totalOf(mine.id)).toHaveText("100.000");
  });
  await test.step("Bước 2: tìm K2 (đơn của sale khác) → Không tìm thấy đơn phù hợp", async () => {
    await list.searchFor(k2);
    await expect(list.empty).toHaveText("Không tìm thấy đơn phù hợp");
  });
});

test("TC-DM-F01-002 Tìm theo khách hàng không phân biệt hoa thường", async ({
  page,
  fx,
}) => {
  const x = fx.uniq("X");
  const alpha = await fx.order({ customer: `${x} Alpha` });
  const beta = await fx.order({ customer: `${x} Beta` });
  const list = new OrderListPage(page);
  await list.open();

  await list.searchFor(`${x} alpha`.toLowerCase());
  await expect(list.rows()).toHaveCount(1);
  await expect(list.row(alpha.id)).toBeVisible();
  await expect(list.row(beta.id)).toHaveCount(0);
});

test("TC-DM-F01-003 Tìm không ra", async ({ page, fx }) => {
  const list = new OrderListPage(page);
  await list.open();

  await list.searchFor(fx.uniq("không khớp"));
  await expect(list.table).toBeHidden();
  await expect(list.empty).toHaveText("Không tìm thấy đơn phù hợp");
});

test.describe(() => {
  test.use({ storageState: persona("manager") });

  test("TC-DM-F01-004 Quản lý thấy đơn của sale, có cột Người tạo và Thao tác", async ({
    page,
    fx,
  }) => {
    const k = fx.uniq("K");
    const o = await fx.order({ customer: k }, { as: "sale" });
    const list = new OrderListPage(page);
    await list.open();

    await test.step("Bước 1: mở Đơn hàng → có cột Người tạo, Thao tác", async () => {
      await expect(list.ownerHeader).toBeVisible();
      await expect(list.actionHeader).toBeVisible();
    });
    await test.step("Bước 2: tìm K → dòng của K, người tạo sale, có nút Xoá", async () => {
      await list.searchFor(k);
      await expect(list.row(o.id)).toBeVisible();
      await expect(list.cell(o.id, "sale")).toHaveCount(1);
      await expect(list.deleteButton(o.id)).toBeVisible();
    });
  });

  test("TC-DM-F01-006 Quản lý xoá đơn", async ({ page, fx }) => {
    const k = fx.uniq("K");
    const o = await fx.order({ customer: k }, { as: "sale" });
    const list = new OrderListPage(page);
    await list.open();

    await test.step("Bước 1: tìm K, bấm Xoá → hộp xác nhận Xoá đơn #M?", async () => {
      await list.searchFor(k);
      await list.deleteButton(o.id).click();
      await expect(list.confirmDialog).toBeVisible();
      await expect(list.confirmTitle).toHaveText(`Xoá đơn #${o.id}?`);
    });
    await test.step("Bước 2: bấm Xoá → hộp đóng, thông báo Đã xoá đơn #M, không còn đơn", async () => {
      await list.confirmDelete();
      await expect(list.confirmDialog).toBeHidden();
      await expect(list.toast).toHaveText(`Đã xoá đơn #${o.id}`);
      await expect(list.empty).toHaveText("Không tìm thấy đơn phù hợp");
    });
  });

  test("TC-DM-F01-007 Huỷ xoá đơn", async ({ page, fx }) => {
    const k = fx.uniq("K");
    const o = await fx.order({ customer: k }, { as: "sale" });
    const list = new OrderListPage(page);
    await list.open();

    await list.searchFor(k);
    await list.deleteButton(o.id).click();
    await list.cancelDelete();
    await expect(list.confirmDialog).toBeHidden();
    await expect(list.row(o.id)).toBeVisible();
  });
});

test("TC-DM-F01-005 Sale không thấy cột Người tạo, Thao tác và nút Xoá", async ({
  page,
  fx,
}) => {
  const k = fx.uniq("K");
  const o = await fx.order({ customer: k });
  const list = new OrderListPage(page);
  await list.open();

  await list.searchFor(k);
  await expect(list.row(o.id)).toBeVisible();
  await expect(list.ownerHeader).toBeHidden();
  await expect(list.actionHeader).toBeHidden();
  await expect(list.deleteButton(o.id)).toHaveCount(0);
});

test("TC-DM-F01-008 Đơn mới nhất ở trên, số tiền định dạng vi-VN", async ({
  page,
  fx,
}) => {
  const x = fx.uniq("X");
  const first = await fx.order({
    customer: `${x} 1`,
    qty: 1,
    price: 1000,
    discount: 0,
  });
  const second = await fx.order({
    customer: `${x} 2`,
    qty: 1,
    price: 1234567,
    discount: 10,
  });
  const list = new OrderListPage(page);
  await list.open();

  await list.searchFor(x);
  await expect(list.rows()).toHaveCount(2);
  await expect(list.rows().nth(0)).toHaveAttribute(
    "data-testid",
    `order-row-${second.id}`,
  );
  await expect(list.cell(second.id, "10%")).toBeVisible();
  await expect(list.totalOf(second.id)).toHaveText("1.111.110");
  await expect(list.rows().nth(1)).toHaveAttribute(
    "data-testid",
    `order-row-${first.id}`,
  );
  await expect(list.totalOf(first.id)).toHaveText("1.000");
});
