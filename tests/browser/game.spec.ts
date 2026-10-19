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
  await page.getByRole("button", { name: "CONFIRMAR 1P", exact: true }).click();
  await page.getByRole("button", { name: "CONFIRMAR 2P", exact: true }).click();
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
  await page.getByLabel("Subir imagen", { exact: true }).setInputFiles({
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
  await page.getByRole("button", { name: "CONFIRMAR 1P", exact: true }).click();
  await page.getByRole("button", { name: "CONFIRMAR 2P", exact: true }).click();
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

test("roster completo, filtros y registro de una edición sin reemplazar colección", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Colección", exact: true }).click();
  await page.getByRole("button", { name: /ROSTER WWE/ }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(107);
  await page.getByLabel("Filtrar división del roster").selectOption("women");
  await expect(page.locator(".catalog-card")).toHaveCount(25);
  await page.getByLabel("Buscar en el roster").fill("Rhea");
  await expect(page.locator(".catalog-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Registrar figura de Rhea Ripley",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Luchador", { exact: true })).toHaveValue(
    "Rhea Ripley",
  );
  await page.getByLabel("Edición", { exact: true }).fill("Mi edición Mattel");
  await page.getByLabel("Valor base", { exact: true }).fill("91");
  await page.getByRole("button", { name: "Guardar figura" }).click();
  await page.getByRole("button", { name: /MIS FIGURAS/ }).click();
  await expect(page.locator(".figure-card")).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "Rhea Ripley", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".figure-card").first().locator(".rating"),
  ).toContainText("93");
  await page.reload();
  await page.getByRole("button", { name: "Colección", exact: true }).click();
  await expect(page.locator(".figure-card")).toHaveCount(5);
  await page.getByRole("button", { name: /ROSTER WWE/ }).click();
  await page.getByLabel("Buscar en el roster").fill("Roddy Piper");
  await expect(page.locator(".catalog-card")).toHaveCount(1);
  await page.getByLabel("Buscar en el roster").fill("zzz-no-existe");
  await expect(
    page.getByRole("heading", { name: "No encontramos ese nombre" }),
  ).toBeVisible();
});
test("selección 1P/2P desde roster, confirmación y persistencia de plantilla jugable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "NUEVA LUCHA" }).click();
  await page.getByRole("button", { name: /ROSTER WWE/ }).click();
  await expect(
    page.getByRole("button", { name: "HACER LAS ENTRADAS" }),
  ).toBeDisabled();
  await page.getByLabel("División jugador 1").selectOption("women");
  await page.getByLabel("Buscar jugador 1").fill("Rhea");
  await page
    .getByRole("group", { name: "Luchadores jugador 1", exact: true })
    .getByRole("button", { name: "Rhea Ripley", exact: true })
    .click();
  await page.getByRole("button", { name: "CONFIRMAR 1P", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "HACER LAS ENTRADAS" }),
  ).toBeDisabled();
  await page.getByLabel("Buscar jugador 2").fill("Stone Cold");
  await page
    .getByRole("group", { name: "Luchadores jugador 2", exact: true })
    .getByRole("button", { name: "Stone Cold Steve Austin", exact: true })
    .click();
  await page.getByRole("button", { name: "CONFIRMAR 2P", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "HACER LAS ENTRADAS" }).click();
  await expect(
    page.getByRole("heading", { name: "Rhea Ripley", exact: true }),
  ).toBeVisible();
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("figuremania.v1")!),
  );
  expect(before.figures).toHaveLength(4);
  expect(before.active.fighters[0].figure.base).toBe(80);
  expect(before.active.fighters[0].figure.edition).toBe("Edición por definir");
  await page.getByRole("button", { name: "SIGUIENTE LUCHADOR" }).click();
  await page.getByRole("button", { name: "¡QUE EMPIECE LA LUCHA!" }).click();
  await page.getByRole("button", { name: "LANZAR AMBOS DADOS" }).click();
  const match = await page.evaluate(
    () => JSON.parse(localStorage.getItem("figuremania.v1")!).active,
  );
  await page.reload();
  await page.getByRole("button", { name: /Continuar/ }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("figuremania.v1")!).active,
    ),
  ).toEqual(match);
});
test("navegar roster conserva una partida existente y ajustes anteriores", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "NUEVA LUCHA" }).click();
  await page.getByRole("button", { name: "CONFIRMAR 1P", exact: true }).click();
  await page.getByRole("button", { name: "CONFIRMAR 2P", exact: true }).click();
  await page.getByRole("button", { name: "HACER LAS ENTRADAS" }).click();
  await page.getByRole("button", { name: "SIGUIENTE LUCHADOR" }).click();
  await page.getByRole("button", { name: "¡QUE EMPIECE LA LUCHA!" }).click();
  await page.getByRole("button", { name: "LANZAR AMBOS DADOS" }).click();
  const original = await page.evaluate(() =>
    localStorage.getItem("figuremania.v1"),
  );
  await page.getByRole("button", { name: "Colección", exact: true }).click();
  await page.getByRole("button", { name: /ROSTER WWE/ }).click();
  await page.getByLabel("Buscar en el roster").fill("Finn Balor");
  await expect(
    page.getByRole("heading", { name: "Finn Bálor", exact: true }),
  ).toBeVisible();
  await page.reload();
  expect(
    await page.evaluate(() => localStorage.getItem("figuremania.v1")),
  ).toBe(original);
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(
    page.getByRole("heading", { name: "INTERCAMBIO 01" }),
  ).toBeVisible();
});
test("las flechas recorren la selección y saltan la figura ocupada por el rival", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "NUEVA LUCHA" }).click();
  const group = page.getByRole("group", {
    name: "Luchadores jugador 1",
    exact: true,
  });
  await group.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page
      .getByRole("article", { name: "Selección jugador 1", exact: true })
      .getByRole("heading", { name: "Titán de Acero", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await expect(
    page
      .getByRole("article", { name: "Selección jugador 1", exact: true })
      .getByRole("heading", { name: "Rey Mysterio", exact: true }),
  ).toBeVisible();
});
test("inicio, selección y catálogo no desbordan en móvil pequeño ni escritorio", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "NUEVA LUCHA" }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Colección", exact: true }).click();
    await page.getByRole("button", { name: /ROSTER WWE/ }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
