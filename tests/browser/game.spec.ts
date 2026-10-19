import { test, expect } from "@playwright/test";
test("flujo móvil, colección, entradas, combate, recarga e historial", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /TUS FIGURAS/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Colección", exact: true }).click();
  await page
    .getByRole("button", { name: "Añadir figura", exact: true })
    .click();
  await page.getByLabel("Luchador", { exact: true }).fill("Prueba del Ring");
  await page.getByLabel("Edición", { exact: true }).fill("Edición de prueba");
  await page.getByRole("button", { name: "Guardar figura" }).click();
  await expect(
    page.getByRole("heading", { name: "Prueba del Ring" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Arena", exact: true }).click();
  await page.getByRole("button", { name: "NUEVA LUCHA" }).click();
  await page.locator(".figure-card").nth(0).click();
  await page.locator(".figure-card").nth(1).click();
  await page.getByRole("button", { name: "HACER LAS ENTRADAS" }).click();
  await page.getByRole("button", { name: "SIGUIENTE LUCHADOR" }).click();
  await page.getByRole("button", { name: "¡QUE EMPIECE LA LUCHA!" }).click();
  await page.getByRole("button", { name: "LANZAR AMBOS DADOS" }).click();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("figuremania.v1")!).active,
  );
  await page.reload();
  await page.getByRole("button", { name: /Continuar/ }).click();
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("figuremania.v1")!).active,
  );
  expect(after).toEqual(before);
  for (let i = 0; i < 700; i++) {
    const state = await page.evaluate(
      () => JSON.parse(localStorage.getItem("figuremania.v1")!).active,
    );
    if (state.phase === "finished") break;
    if (state.phase === "roll")
      await page.getByRole("button", { name: "LANZAR AMBOS DADOS" }).click();
    else if (state.phase === "choose")
      await page.locator(".move-card").first().click();
    else if (state.phase === "defend")
      await page.getByRole("button", { name: "Recibir el ataque" }).click();
    else if (state.phase === "pin")
      await page.getByRole("button", { name: "¡A LA CUENTA!" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "¡TENEMOS GANADOR!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Historial", exact: true }).click();
  await page.locator(".history-row").first().click();
  await expect(page.getByLabel("Registro de acciones")).toContainText(
    "gana por cuenta de tres",
  );
});
test("escritorio y reglas muestran costes y probabilidades", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".figure-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Reglas", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Remate", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("25% de éxito.", { exact: false })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("imagen local, edición y guardado sobreviven una recarga", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Colección", exact: true }).click();
  await page.locator(".figure-card").first().click();
  await page
    .getByLabel("Subir imagen", { exact: true })
    .setInputFiles({
      name: "figura.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFuoAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page.getByLabel("Bono rareza", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Guardar figura" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Colección", exact: true }).click();
  await expect(
    page.locator(".figure-card").first().locator("img"),
  ).toBeVisible();
  await expect(
    page.locator(".figure-card").first().locator(".rating"),
  ).toContainText("96");
});
test("doble clic no resuelve dos veces una tirada o una carta", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "NUEVA LUCHA" }).click();
  await page.locator(".figure-card").nth(0).click();
  await page.locator(".figure-card").nth(1).click();
  await page.getByRole("button", { name: "HACER LAS ENTRADAS" }).click();
  await page.getByRole("button", { name: "SIGUIENTE LUCHADOR" }).click();
  await page.getByRole("button", { name: "¡QUE EMPIECE LA LUCHA!" }).click();
  await page.getByRole("button", { name: "LANZAR AMBOS DADOS" }).dblclick();
  const m = await page.evaluate(
    () => JSON.parse(localStorage.getItem("figuremania.v1")!).active,
  );
  expect(m.revision).toBe(1);
  expect(
    m.events.filter((e: { kind: string }) => e.kind === "roll"),
  ).toHaveLength(1);
});
