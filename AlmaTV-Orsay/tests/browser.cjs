const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const ROOT = path.resolve(__dirname, "..");
let browser, context, page, commands, errors, previewProcess;
const key = (code) => page.evaluate((c) => Alma.key(c), code);
const go = (view) => page.evaluate((v) => Alma.go(v), view);
const click = (id) => page.locator("#" + id).click();
const shot = async (name) => {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map((im) => im.decode().catch(() => {}))
    );
  });
  return page.screenshot({
    path: path.join(ROOT, "docs/capturas", name + ".png"),
    animations: "disabled"
  });
};
async function editor(value) {
  await page.evaluate((v) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 8 }));
  }, "");
  // Type through the application's real keyboard handlers, clearing existing text.
  for (let i = 0; i < 100; i++)
    await page.evaluate(() =>
      document.onkeydown({ keyCode: 8, preventDefault() {} })
    );
  await page.keyboard.type(value);
  await click("edit-done");
}
before(async () => {
  async function available() {
    try {
      const response = await fetch("http://127.0.0.1:8765");
      const html = await response.text();
      if (!html.includes('name="alma-build" content="8.0.0"'))
        throw new Error("Puerto 8765 ocupado por otro proyecto");
      return true;
    } catch (error) {
      if (error.message.includes("ocupado")) throw error;
      return false;
    }
  }
  if (!(await available())) {
    previewProcess = require("node:child_process").spawn(
      "python3",
      [
        "preview.py",
        "--port",
        "8765",
        "--bind",
        "127.0.0.1",
        "--directory",
        ".preview/app"
      ],
      { cwd: ROOT, stdio: "ignore" }
    );
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (await available()) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(ready, "No se pudo iniciar el servidor de pruebas");
  }
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"]
  });
});
after(async () => {
  if (browser) await browser.close();
  if (previewProcess) previewProcess.kill();
});
beforeEach(async (t) => {
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  t.after(async () => context.close());
  commands = [];
  errors = [];
  await context.addInitScript(() => {
    window.platformCalls = [];
    window.Common = {
      API: {
        Widget: function () {
          this.sendReadyEvent = () => platformCalls.push("ready");
          this.sendExitEvent = () => platformCalls.push("exit");
          this.runWebBrowser = (url) => platformCalls.push(url);
        }
      }
    };
  });
  page = await context.newPage();
  await page.clock.install();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/$MANAGER_WIDGET/**", (r) =>
    r.fulfill({ status: 200, body: "", contentType: "application/javascript" })
  );
  await page.route("http://192.168.1.249:8080/**", async (r) => {
    commands.push({ method: r.request().method(), url: r.request().url() });
    await r.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "<service><state>running</state></service>"
    });
  });
  await page.goto("http://127.0.0.1:8765");
});
test("Inicio compacto, vistas distintas y navegación real por códigos Samsung", async () => {
  assert.deepEqual(await page.evaluate(() => platformCalls), ["ready"]);
  await shot("01-inicio");
  await key(29461);
  await key(29461);
  await key(29443);
  assert.match(await page.locator("#view").innerText(), /Tus aplicaciones/);
  await shot("02-apps");
  await key(88);
  assert.ok(await page.locator(".hero").isVisible());
  await go("tools");
  await shot("03-herramientas");
  assert.equal(await page.locator(".grid .card").count(), 6);
  await key(29461);
  assert.equal(await page.locator(".focus").getAttribute("id"), "tool-3");
  await key(29460);
  assert.equal(await page.locator(".focus").getAttribute("id"), "tool-0");
  await key(29443);
  assert.ok(await page.locator("#live-clock").isVisible());
  await shot("06-reloj");
  await key(88);
  assert.equal(await page.locator(".focus").getAttribute("id"), "tool-0");
  await key(21);
  await shot("05-ajustes");
  assert.match(await page.locator("#view").innerText(), /A tu medida/);
  await key(20);
  assert.ok(await page.locator(".hero").isVisible());
  await key(45);
  assert.ok((await page.evaluate(() => platformCalls)).includes("exit"));
  assert.deepEqual(errors, []);
});
test("Una pulsación inicia cada DIAL; doble pulsación en curso no duplica POST", async () => {
  await page.route("http://192.168.1.249:8080/**", async (r) => {
    commands.push({ method: r.request().method(), url: r.request().url() });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await r.fulfill({
      status: 201,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: ""
    });
  });
  await go("apps");
  await key(29443);
  await key(29443);
  await page.waitForTimeout(250);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].method, "POST");
  assert.match(commands[0].url, /\/Netflix$/);
  await key(5);
  await key(29443);
  await page.waitForTimeout(250);
  assert.equal(commands.length, 2);
  assert.match(commands[1].url, /\/YouTube$/);
  await key(5);
  await key(29443);
  assert.match(await page.locator("#dialog").innerText(), /sin soporte nativo/);
  assert.equal(commands.length, 2);
  await shot("13-prime-por-probar");
  await key(88);
  await click("app-7");
  assert.ok(
    (await page.evaluate(() => platformCalls)).includes("https://example.com")
  );
  assert.deepEqual(errors, []);
});
test("Temporizador inicia, pausa, continúa, reinicia y termina", async () => {
  await go("timer");
  await shot("07-temporizador");
  for (let i = 0; i < 9; i++) await click("minus");
  assert.equal(await page.locator("#countdown").innerText(), "01:00");
  await click("start");
  await page.waitForTimeout(2100);
  await click("start");
  const paused = await page.locator("#countdown").innerText();
  assert.notEqual(paused, "01:00");
  await page.waitForTimeout(1100);
  assert.equal(await page.locator("#countdown").innerText(), paused);
  await click("start");
  await click("reset-timer");
  assert.equal(await page.locator("#countdown").innerText(), "01:00");
  await click("start");
  await page.clock.fastForward(61000);
  assert.equal(await page.locator("#countdown").innerText(), "00:00");
  assert.match(await page.locator("#toast").innerText(), /terminado/);
  assert.deepEqual(errors, []);
});
test("Calendario navegable y salvapantallas con reloj móvil", async () => {
  await go("calendar");
  const current = await page.locator(".page-head h1").innerText();
  await shot("08-calendario");
  await click("next-month");
  assert.notEqual(await page.locator(".page-head h1").innerText(), current);
  await click("today");
  assert.equal(await page.locator(".page-head h1").innerText(), current);
  await go("saver");
  const imageSize = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        var im = new Image();
        im.onload = () => resolve([im.naturalWidth, im.naturalHeight]);
        im.onerror = reject;
        im.src = AlmaMedia.saver;
      })
  );
  assert.deepEqual(imageSize, [1672, 941]);
  assert.match(
    await page.locator("#saver-scene").getAttribute("style"),
    /salvapantallas.png/
  );
  assert.equal(await page.locator("#header").isVisible(), false);
  await shot("09-salvapantallas");
  const position = await page.locator("#saver-clock").getAttribute("style");
  await page.clock.fastForward(16000);
  assert.notEqual(
    await page.locator("#saver-clock").getAttribute("style"),
    position
  );
  await key(37);
  assert.ok(await page.locator(".calendar").isVisible());
  assert.deepEqual(errors, []);
});
test("Búsqueda local, sin resultados, enlaces persistidos y tratamiento seguro del texto", async () => {
  await go("search");
  await shot("04-busqueda");
  await click("search-edit");
  await editor("netflix");
  assert.equal(await page.locator(".results .card").count(), 1);
  assert.match(await page.locator(".results").innerText(), /Netflix/);
  await click("search-edit");
  await editor("noexiste");
  assert.match(await page.locator(".results").innerText(), /Sin resultados/);
  await go("links");
  await click("add-link");
  await editor("Mi enlace");
  await editor("https://example.org/");
  assert.match(await page.locator("#view").innerText(), /Mi enlace/);
  await page.reload();
  await go("links");
  assert.match(await page.locator("#view").innerText(), /Mi enlace/);
  await shot("14-enlaces");
  await click("link-0");
  assert.ok(
    (await page.evaluate(() => platformCalls)).includes("https://example.org/")
  );
  await click("remove-0");
  assert.equal(await page.locator('[id^="link-"]').count(), 0);
  assert.deepEqual(errors, []);
});
test("IP válida, cancelación de editor, ajustes persistidos y restauración limitada", async () => {
  await go("settings");
  await click("tv-ip");
  await shot("16-editor-ip");
  await editor("999.168.1.1");
  assert.ok(await page.locator("#dialog").isVisible());
  assert.match(await page.locator("#toast").innerText(), /válida/);
  await key(88);
  await click("tv-ip");
  await editor("192.168.1.250");
  await page.reload();
  await go("settings");
  assert.match(await page.locator("#tv-ip").innerText(), /192.168.1.250/);
  await click("reset");
  await shot("15-restauracion");
  await click("dialog-0");
  assert.match(await page.locator("#tv-ip").innerText(), /192.168.1.250/);
  await click("reset");
  await click("dialog-1");
  assert.match(await page.locator("#tv-ip").innerText(), /192.168.1.249/);
  assert.deepEqual(errors, []);
});
test("Calibración global 3 %, 5 %, 8 %, guardado, cancelación y geometría segura", async () => {
  for (const [percent, scale] of [
    [3, 94],
    [5, 90],
    [8, 84]
  ]) {
    await go("settings");
    await click("calibrate");
    await key(13);
    await click("safe" + percent);
    await click("save-cal");
    await page.reload();
    assert.match(
      await page.locator("#safe").getAttribute("style"),
      new RegExp("scale\\(" + scale / 100 + "\\)")
    );
    await go("home");
    await shot("overscan-" + percent);
    const rect = await page.locator("#safe").boundingBox();
    assert.ok(rect.x >= (1280 * percent) / 100 - 1);
    assert.ok(rect.y >= (720 * percent) / 100 - 1);
    for (const view of [
      "home",
      "apps",
      "tools",
      "settings",
      "search",
      "timer",
      "clock",
      "calendar",
      "network",
      "weather"
    ]) {
      await go(view);
      await page.waitForTimeout(240);
      const limit = await page.locator("#view").boundingBox();
      const boxes = await page
        .locator("#view .card,#view .pill,#view h1,#view .panel")
        .evaluateAll((nodes) =>
          nodes
            .filter((n) => !n.closest(".app-carousel"))
            .map((n) => {
              const r = n.getBoundingClientRect();
              return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
            })
        );
      for (const r of boxes) {
        assert.ok(
          r.x >= rect.x - 1 && r.right <= rect.x + rect.width + 1,
          view + " horizontal bounds"
        );
      }
      for (const r of await page
        .locator("#view .panel")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getBoundingClientRect().bottom)
        )) {
        assert.ok(
          r <= limit.y + limit.height + 1,
          view + " panel vertical bounds"
        );
      }
    }
  }
  await go("settings");
  await click("calibrate");
  await key(39);
  await key(88);
  assert.match(
    await page.locator("#safe").getAttribute("style"),
    /scale\(0.84\)/
  );
  await click("calibrate");
  await shot("12-calibracion");
  assert.deepEqual(errors, []);
});
test("Diagnóstico obtiene ambos estados y fallos de red no se presentan como éxito", async () => {
  await go("network");
  await click("check-network");
  await page.waitForTimeout(100);
  assert.match(await page.locator("#dial-youtube").innerText(), /Disponible/);
  assert.match(await page.locator("#dial-netflix").innerText(), /Disponible/);
  assert.equal(commands.filter((c) => c.method === "GET").length, 2);
  await shot("10-diagnostico-respuesta-de-prueba");
  await page.route("http://192.168.1.249:8080/**", (r) => r.abort());
  await click("check-network");
  await page.waitForTimeout(100);
  assert.match(
    await page.locator("#dial-youtube").innerText(),
    /Sin respuesta/
  );
  await go("apps");
  await click("app-0");
  await page.waitForTimeout(100);
  assert.match(await page.locator("#toast").innerText(), /No se pudo abrir/);
  assert.deepEqual(errors, []);
});
test("Clima exige puente y usa solo datos del proveedor, degrada a Sin datos", async () => {
  await go("weather");
  await shot("11-clima-sin-datos");
  await click("refresh-weather");
  assert.equal(await page.locator("#weather-value").innerText(), "Sin datos");
  await go("settings");
  await click("bridge");
  await go("weather");
  await page.route("http://192.168.1.30:8088/weather?**", (r) =>
    r.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        temperature: 24.5,
        city: "Ubicación de prueba",
        observed_at: "2026-10-21T12:00",
        description: "Respuesta de prueba"
      })
    })
  );
  await click("refresh-weather");
  await page.waitForTimeout(100);
  assert.match(await page.locator("#weather-value").innerText(), /24.5/);
  assert.match(await page.locator("#weather-detail").innerText(), /Open-Meteo/);
  await go("settings");
  await click("bridge");
  await go("weather");
  assert.equal(await page.locator("#weather-value").innerText(), "Sin datos");
  await go("settings");
  await click("bridge");
  await go("weather");
  await page.route("http://192.168.1.30:8088/weather?**", (r) => r.abort());
  await click("refresh-weather");
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#weather-value").innerText(), "Sin datos");
  assert.deepEqual(errors, []);
});
test("Foco único y alcanzable tras recorridos largos por todas las vistas", async () => {
  for (const view of [
    "home",
    "apps",
    "tools",
    "settings",
    "search",
    "timer",
    "calendar",
    "network",
    "weather",
    "links"
  ]) {
    await go(view);
    for (const k of [
      40, 40, 39, 39, 39, 39, 39, 38, 37, 37, 38, 38, 38, 40, 40
    ]) {
      await key(k);
      assert.equal(await page.locator(".focus").count(), 1);
    }
  }
  assert.deepEqual(errors, []);
});

test("Búsqueda desplaza el foco a enlaces fuera del área visible", async () => {
  await page.evaluate(() => {
    var p = JSON.parse(localStorage.getItem("alma.orsay.v7") || "{}");
    p.links = [];
    for (var i = 0; i < 12; i++)
      p.links.push({ name: "Personal " + i, url: "https://example.org/" + i });
    localStorage.setItem("alma.orsay.v7", JSON.stringify(p));
  });
  await page.reload();
  await go("search");
  for (let i = 0; i < 10; i++) await key(40);
  const focused = await page.locator(".focus").boundingBox();
  const container = await page.locator(".search-layout").boundingBox();
  assert.ok(
    focused.y >= container.y &&
      focused.y + focused.height <= container.y + container.height + 1
  );
  assert.deepEqual(errors, []);
});

test("Xbox selecciona solo el descriptor HDMI 2 real y degrada si falta la API", async () => {
  await go("apps");
  await click("app-6");
  assert.match(await page.locator("#dialog").innerText(), /SOURCE/);
  await key(88);
  await page.evaluate(() => {
    window.sourceCalls = [];
    window.webapis = {
      tv: {
        window: {
          getAvailableSources: function (ok) {
            ok([
              { type: "HDMI", number: 1, id: "one" },
              { type: "AV", number: 2, id: "av2" },
              { type: "HDMI", number: 2, id: "hdmi-two" }
            ]);
          },
          setSource: function (source, ok) {
            sourceCalls.push(source);
            ok();
          }
        }
      }
    };
  });
  await click("app-6");
  assert.deepEqual(await page.evaluate(() => sourceCalls), [
    { type: "HDMI", number: 2, id: "hdmi-two" }
  ]);
  assert.match(await page.locator("#toast").innerText(), /aceptó HDMI 2/);
  await page.evaluate(() => {
    webapis.tv.window.getAvailableSources = function (ok) {
      ok([{ type: "HDMI", number: 1 }]);
    };
  });
  await click("app-6");
  assert.match(await page.locator("#toast").innerText(), /no aparece/);
  assert.equal(await page.evaluate(() => sourceCalls.length), 1);
  assert.deepEqual(errors, []);
});
test("Reposo no repinta textos sin cambios y el foco no reconstruye las tarjetas", async () => {
  await page.clock.setFixedTime(new Date("2026-10-21T12:20:10Z"));
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    window.mutations = 0;
    window.viewReplacements = 0;
    new MutationObserver((records) => {
      mutations += records.length;
      for (const r of records) {
        if (
          r.type === "childList" &&
          r.target === document.getElementById("view")
        )
          viewReplacements++;
      }
    }).observe(document.getElementById("safe"), {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  });
  await page.clock.runFor(3000);
  assert.equal(await page.evaluate(() => mutations), 0);
  await key(39);
  await key(40);
  for (let i = 0; i < 30; i++) await key(i % 2 ? 37 : 39);
  assert.equal(await page.evaluate(() => viewReplacements), 0);
  assert.equal(await page.locator(".focus").count(), 1);
  assert.deepEqual(errors, []);
});
test("Salvapantallas ordenado con fecha, ciudad, clima real e icono, sin recuadro negro", async () => {
  await go("saver");
  assert.match(await page.locator(".saver-location").innerText(), /Tuxtla/);
  assert.match(await page.locator(".saver-date").innerText(), /2026/);
  assert.equal(await page.locator(".saver-weather img").count(), 1);
  assert.equal(
    await page
      .locator("#saver-clock")
      .evaluate((n) => getComputedStyle(n).backgroundColor),
    "rgba(0, 0, 0, 0)"
  );
  assert.match(await page.locator(".saver-weather").innerText(), /Sin datos/);
  const first = await page.locator("#saver-clock").getAttribute("style");
  await page.clock.fastForward(16000);
  assert.notEqual(
    await page.locator("#saver-clock").getAttribute("style"),
    first
  );
  await go("settings");
  await click("bridge");
  await page.route("http://192.168.1.30:8088/weather?**", (r) =>
    r.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        temperature: 24.5,
        city: "Tuxtla (respuesta de prueba)",
        observed_at: "2026-10-21T12:00",
        description: "Despejado (prueba)",
        code: 0,
        is_day: 1
      })
    })
  );
  await go("saver");
  await page.waitForTimeout(100);
  await page.clock.runFor(1100);
  assert.match(await page.locator(".saver-weather").innerText(), /24.5/);
  assert.match(
    await page.locator(".saver-weather img").getAttribute("src"),
    /sun.png/
  );
  await shot("17-salvapantallas-clima-respuesta-de-prueba");
  assert.deepEqual(errors, []);
});

test("El puente del clima no desvía ni rompe los lanzamientos DIAL directos", async () => {
  await go("settings");
  await click("bridge");
  await go("apps");
  await click("app-0");
  await page.waitForTimeout(100);
  assert.equal(commands.length, 1);
  assert.match(commands[0].url, /192\.168\.1\.249:8080\/ws\/app\/Netflix$/);
  assert.equal(commands[0].method, "POST");
  assert.deepEqual(errors, []);
});

test("El tema cubre la pantalla completa y el contenido mantiene la calibración", async () => {
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 960, height: 540 },
    { width: 1280, height: 720 }
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(100);
    const stage = await page.locator("#stage").boundingBox(),
      background = await page.locator("#wallpaper").boundingBox();
    assert.ok(
      Math.abs(stage.width - size.width) < 1 &&
        Math.abs(stage.height - size.height) < 1
    );
    assert.ok(
      Math.abs(background.width - size.width) < 1 &&
        Math.abs(background.height - size.height) < 1
    );
    const safe = await page.locator("#safe").boundingBox();
    assert.ok(safe.width < stage.width && safe.height < stage.height);
  }
  assert.deepEqual(errors, []);
});
test("El marco blanco se configura solo para el salvapantallas y persiste", async () => {
  await go("saver");
  assert.equal(await page.locator("#saver-wallpaper").isVisible(), false);
  await go("settings");
  await click("saver-frame");
  await go("saver");
  assert.equal(await page.locator("#saver-wallpaper").isVisible(), true);
  await shot("18-salvapantallas-sin-marco");
  const rect = await page.locator("#saver-wallpaper").boundingBox();
  assert.equal(Math.round(rect.width), 1280);
  assert.equal(Math.round(rect.height), 720);
  await page.reload();
  await go("saver");
  assert.equal(await page.locator("#saver-wallpaper").isVisible(), true);
  await go("home");
  assert.equal(await page.locator("#wallpaper").isVisible(), true);
  await go("settings");
  await click("saver-frame");
  await go("saver");
  assert.equal(await page.locator("#saver-wallpaper").isVisible(), false);
  await shot("19-salvapantallas-con-marco");
  assert.deepEqual(errors, []);
});
test("Las páginas y selecciones se animan; movimiento reducido las desactiva", async () => {
  await go("apps");
  assert.equal(await page.locator(".page-enter").count(), 1);
  assert.equal(
    await page
      .locator(".page-enter")
      .evaluate((n) => getComputedStyle(n).animationName),
    "alma-page-in"
  );
  await key(39);
  assert.equal(
    await page
      .locator(".focus")
      .evaluate((n) => getComputedStyle(n).animationName),
    "alma-focus-in"
  );
  for (let i = 0; i < 25; i++) await key(i % 2 ? 37 : 39);
  assert.equal(await page.locator(".focus").count(), 1);
  await go("settings");
  await click("motion");
  await go("apps");
  assert.equal(
    await page
      .locator(".focus")
      .evaluate((n) => getComputedStyle(n).animationName),
    "none"
  );
  assert.equal(await page.locator(".page-enter").count(), 0);
  assert.deepEqual(errors, []);
});
test("Español con tildes y ñ, incluso al escribir desde el teclado", async () => {
  await go("settings");
  await click("location");
  await editor("Peña, Chiapas, México");
  assert.match(
    await page.locator("#location").innerText(),
    /Peña, Chiapas, México/
  );
  await go("saver");
  assert.match(
    await page.locator(".saver-location").innerText(),
    /Peña, Chiapas, México/
  );
  await go("settings");
  await click("location");
  assert.match(await page.locator(".keyboard").innerText(), /Ñ/);
  await key(88);
  await go("home");
  await page.evaluate(() => Alma.key(39));
  await key(40);
  await key(39);
  assert.match(
    await page.locator("#hero-copy").innerText(),
    /Continúa viendo tus videos favoritos/
  );
  assert.doesNotMatch(await page.locator("body").innerText(), /Ã|Â|�/);
  assert.deepEqual(errors, []);
});
test("Carrusel grande, encabezados personalizados y colores de marca en todas las vistas", async () => {
  await key(39);
  await key(40);
  assert.match(
    await page.locator("#hero-title").innerText(),
    /WWE Raw on Netflix/
  );
  await key(39);
  assert.match(
    await page.locator("#hero-title").innerText(),
    /Bienvenido, IWC/
  );
  await key(39);
  assert.equal(
    await page.locator("#hero-title").innerText(),
    "La Última Palabra"
  );
  assert.match(
    await page.locator("#hero-copy").innerText(),
    /Disfrútalo solo por Fox con tu suscripción/
  );
  for (let i = 0; i < 6; i++) await key(39);
  await page.waitForTimeout(300);
  assert.ok(
    (await page.locator(".app-carousel").evaluate((n) => n.scrollLeft)) > 0
  );
  const focused = await page.locator(".focus").boundingBox(),
    container = await page.locator(".app-carousel").boundingBox();
  assert.ok(
    focused.x >= container.x - 1 &&
      focused.x + focused.width <= container.x + container.width + 1
  );
  await shot("20-carrusel-desplazado");
  await go("apps");
  for (const id of ["app-0", "app-2", "app-3", "app-4", "app-5", "app-6"]) {
    const color = await page
      .locator("#" + id)
      .evaluate((n) => getComputedStyle(n).backgroundColor);
    assert.notEqual(color, "rgb(251, 253, 253)");
    assert.notEqual(color, "rgb(255, 255, 255)");
  }
  assert.deepEqual(errors, []);
});
test("El reproductor decodifica audio real, permite pausa, salto y reproducción entre vistas", async () => {
  await go("media");
  await click("media-play");
  await page.waitForFunction(
    () => document.getElementById("media-audio").currentTime > 0.2,
    {},
    { timeout: 5000 }
  );
  assert.equal(
    await page.locator("#media-audio").evaluate((n) => n.paused),
    false
  );
  await click("media-play");
  const paused = await page
    .locator("#media-audio")
    .evaluate((n) => n.currentTime);
  await page.waitForTimeout(300);
  assert.ok(
    Math.abs(
      (await page.locator("#media-audio").evaluate((n) => n.currentTime)) -
        paused
    ) < 0.1
  );
  await click("media-forward");
  await page.waitForFunction(
    () => document.getElementById("media-audio").currentTime > 8,
    {},
    { timeout: 5000 }
  );
  await click("media-stop");
  assert.ok(
    (await page.locator("#media-audio").evaluate((n) => n.currentTime)) < 0.1
  );
  await click("media-play");
  await go("home");
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator("#media-audio").evaluate((n) => n.paused),
    false
  );
  assert.equal(await page.locator("#home-player button").count(), 0);
  assert.match(await page.locator("#home-media-title").innerText(), /Prueba de sonido/);
  assert.equal(await page.locator(".home-links").count(), 0);
  await shot("25-alma8-musica-en-inicio");
  await go("media");
  await shot("21-reproductor-audio");
  await click("media-stop");
  assert.deepEqual(errors, []);
});
test("Lista multimedia editable, rechazo de enlaces de plataformas y persistencia", async () => {
  await go("media");
  await click("media-add");
  await editor("Mi canción");
  await editor("https://www.youtube.com/watch?v=123");
  assert.ok(await page.locator("#dialog").isVisible());
  assert.match(await page.locator("#toast").innerText(), /enlace directo/);
  await key(88);
  await click("media-add");
  await editor("Mi canción");
  await editor("http://127.0.0.1:8765/assets/media/prueba-sonido.mp3");
  assert.match(await page.locator(".media-list").innerText(), /Mi canción/);
  await page.reload();
  await go("media");
  assert.match(await page.locator(".media-list").innerText(), /Mi canción/);
  await click("media-item-1");
  await page.waitForFunction(
    () => document.getElementById("media-audio").currentTime > 0.1
  );
  assert.equal(await page.locator("#media-title").innerText(), "Mi canción");
  await click("media-stop");
  await click("media-remove-1");
  assert.doesNotMatch(
    await page.locator(".media-list").innerText(),
    /Mi canción/
  );
  assert.deepEqual(errors, []);
});

test("El reproductor reproduce video MP4 real con sus controles", async () => {
  await page.route("http://127.0.0.1:8765/video-prueba.mp4", (r) =>
    r.fulfill({
      status: 200,
      contentType: "video/mp4",
      body: fs.readFileSync(path.join(ROOT, "tests/fixtures/video-prueba.mp4"))
    })
  );
  await go("media");
  await click("media-add");
  await editor("Video de prueba");
  await editor("http://127.0.0.1:8765/video-prueba.mp4");
  await page.locator("#media-video").evaluate(n => { n.loop = true; });
  await click("media-item-1");
  await page.waitForFunction(
    () => document.getElementById("media-video").currentTime > 0.1,
    {},
    { timeout: 5000 }
  );
  assert.equal(await page.locator("#media-video").isVisible(), true);
  assert.ok(await page.locator("#media-video").evaluate(n => n.getBoundingClientRect().height) >= 230);
  await click("media-fullscreen");
  await shot("23-alma8-pantalla-completa");
  assert.equal(await page.locator("#media-video").evaluate(n => n.getBoundingClientRect().width), 1280);
  await key(88);
  assert.equal(await page.locator("#media-video").evaluate(n => n.className), "");
  for (const view of ["home", "apps"]) {
    await go(view);
    const time = await page.locator("#media-video").evaluate(n => n.currentTime);
    await page.waitForTimeout(180);
    assert.equal(await page.locator("#media-video").evaluate(n => n.paused), false);
    assert.ok(await page.locator("#media-video").evaluate(n => n.currentTime) > time);
    assert.equal(await page.locator("#media-video").isVisible(), view === "home");
    if (view === "home") {
      assert.equal(await page.locator("#home-player button").count(), 0);
      assert.ok(await page.locator("#media-video").evaluate(n => n.getBoundingClientRect().width) > 800);
      assert.ok(await page.locator("#media-video").evaluate(n => n.getBoundingClientRect().height) > 280);
      await shot("24-alma8-video-en-inicio");
    }
  }
  await go("media");
  await click("media-play");
  assert.equal(
    await page.locator("#media-video").evaluate((n) => n.paused),
    true
  );
  await shot("22-reproductor-video-respuesta-de-prueba");
  await click("media-stop");
  assert.deepEqual(errors, []);
});

test("Abrir una aplicación nativa pausa el audio propio", async () => {
  await go("media");
  await click("media-play");
  await page.waitForFunction(
    () => document.getElementById("media-audio").currentTime > 0.1
  );
  await go("apps");
  await click("app-1");
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator("#media-audio").evaluate((n) => n.paused),
    true
  );
  assert.match(commands[0].url, /YouTube$/);
  assert.deepEqual(errors, []);
});

test("Un firmware sin reproducción HTML5 muestra una alternativa sin bloquear la interfaz", async () => {
  await page
    .locator("#media-audio")
    .evaluate((n) =>
      Object.defineProperty(n, "play", { value: undefined, configurable: true })
    );
  await go("media");
  await click("media-play");
  assert.match(
    await page.locator("#media-state").innerText(),
    /firmware no ofrece/
  );
  await go("home");
  assert.ok(await page.locator("#hero-title").isVisible());
  assert.deepEqual(errors, []);
});
