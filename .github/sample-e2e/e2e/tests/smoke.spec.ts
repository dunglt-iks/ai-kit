// Smoke cho CI của kit (lớp phủ, không thuộc project1): đăng nhập qua giao diện vào trang chủ.
import { test, expect } from "../support/fixtures";

test("smoke: đăng nhập bằng tài khoản mới tạo, vào trang chủ", async ({ page, fx }) => {
  const u = await fx.user({ name: "Smoke CI" });
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(u.username);
  await page.getByLabel("Mật khẩu").fill(u.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: "Xin chào Smoke CI" })).toBeVisible();
});
