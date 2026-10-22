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
      if (!html.includes('name="alma-build" content="9.1.1"'))
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
    window.nativeVolumeKeys = [];
    window.Common = {
      API: {
        TVKeyValue: function () { this.KEY_VOL_UP=7; this.KEY_VOL_DOWN=11; this.KEY_MUTE=27; },
        Plugin: function () { this.unregistKey = code => nativeVolumeKeys.push(code); },
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
  await page.route("http://192.168.1.30:8088/youtube/diagnostic", r => r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,report:null})}));
  await page.route("http://192.168.1.30:8088/youtube/library", r => r.fulfill({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify({items:[]})}));
  await page.route("http://192.168.1.30:8088/hub/**",r=>r.fulfill({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST"},body:JSON.stringify({commands:[],pin:"",guest_pin:""})}));
  await page.route("http://192.168.1.30:8088/youtube/live",r=>r.fulfill({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify({command:null,status:"idle"})}));
  await page.goto("http://127.0.0.1:8765");
});
test("Inicio compacto, vistas distintas y navegación real por códigos Samsung", async () => {
  assert.match(await page.locator(".brand").innerText(), /9\.1\.1/);
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
  assert.equal(await page.locator("#hero-title").isVisible(), true);
  await key(29461);
  await key(29461);
  assert.equal(await page.evaluate(() => document.querySelector(".focus").id), "home-player");
  assert.ok(await page.locator("#view").evaluate(n => n.scrollTop) > 0);
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
      await key(29461);
      await key(29461);
      assert.equal(await page.evaluate(() => document.querySelector(".focus").id), "home-player");
      assert.ok(await page.locator("#view").evaluate(n => n.scrollTop) > 0);
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

test("Iconos locales en navegación, herramientas y ajustes; logos originales en las apps", async () => {
  for (const view of ["home", "tools", "settings", "apps"]) {
    await go(view);
    const images = await page.locator(".nav-icon").evaluateAll(nodes => nodes.map(n => getComputedStyle(n).backgroundImage));
    assert.ok(images.length >= 10);
    assert.ok(images.every(src => /assets\/icons\/.*\.png/.test(src)));
    const loaded = await page.evaluate(async urls => Promise.all(urls.map(src => new Promise(resolve => {
      const img = new Image(); img.onload = () => resolve(img.naturalWidth > 0); img.onerror = () => resolve(false);
      img.src = src.slice(5, -2);
    }))), images);
    assert.ok(loaded.every(Boolean));
    if (view === "tools") assert.equal(await page.locator("#view .card-icon").count(), 6);
    if (view === "settings") assert.ok(await page.locator("#view .card-icon").count() >= 10);
    if (view === "apps") {
      assert.equal(await page.locator("#view .brand-logo").count(), 7);
      assert.ok(await page.locator("#view .brand-logo").evaluateAll(nodes => nodes.every(n => n.complete && n.naturalWidth > 0)));
    }
  }
  assert.deepEqual(errors, []);
});

async function officialYouTubeFixture(code = 0, behavior = "normal") {
  const referers = [];
  await page.route("http://192.168.1.30:8088/youtube/player?**", async r => {
    const url = new URL(r.request().url());
    const config = {video:url.searchParams.get("video"),token:url.searchParams.get("token"),parent:url.searchParams.get("parent"),autoplay:url.searchParams.get("autoplay")==="1"};
    const html = fs.readFileSync(path.join(ROOT,"youtube_player.html"),"utf8").replace("__ALMA_YT_CONFIG__", JSON.stringify(config));
    await r.fulfill({status:200,contentType:"text/html; charset=utf-8",headers:{"Referrer-Policy":"origin"},body:html});
  });
  await page.route("https://www.youtube.com/embed/**", r => {
    referers.push(r.request().headers().referer);
    return r.fulfill({status:200,contentType:"text/html; charset=utf-8",body:'<html lang="es"><head><meta charset="utf-8"></head><body style="background:#182d3b;color:white;font:24px Arial;text-align:center;padding:70px">API de YouTube simulada para pruebas.<br>No es una reproducción real de YouTube.</body></html>'});
  });
  await page.route("https://www.youtube.com/iframe_api", r => r.fulfill({status:200,contentType:"application/javascript",body:`
    window.YT={Player:function(id,options){
      var iframe=document.createElement('iframe');iframe.src='https://www.youtube.com/embed/'+options.videoId;
      var node=document.getElementById(id);node.parentNode.replaceChild(iframe,node);
      var state=-1,time=20;window.testYoutube={play:0,pause:0,seek:0,load:0,size:null,sizeCount:0,options:options};
      this.getPlayerState=function(){return state;}; this.getCurrentTime=function(){return time;};
      this.setVolume=function(v){if(state!==1)testYoutube.earlyAudio=true;testYoutube.volume=v;};this.getVolume=function(){return testYoutube.volume;};this.mute=function(){testYoutube.muted=true;};this.unMute=function(){if(state!==1)testYoutube.earlyAudio=true;testYoutube.muted=false;};this.isMuted=function(){return testYoutube.muted;};
      this.getVideoData=function(){return {title:'Vídeo de prueba · API simulada'};};
      this.setSize=function(w,h){window.testYoutube.sizeCount++;window.testYoutube.size=[w,h];};
      this.playVideo=function(){window.testYoutube.play++;window.testYoutube.activation=navigator.userActivation ? navigator.userActivation.isActive : null;${code ? `options.events.onError({data:${code}});` : behavior === "stalled" ? "" : behavior === "blocked" ? "options.events.onAutoplayBlocked();" : "state=1;options.events.onStateChange({data:1});"}};
      ${behavior === "explicit" ? 'this.loadVideoById=function(id){window.testYoutube.load++;window.testYoutube.loadedId=id;state=1;options.events.onStateChange({data:1});};' : ''}
      this.pauseVideo=function(){window.testYoutube.pause++;state=2;options.events.onStateChange({data:2});};
      this.seekTo=function(value){window.testYoutube.seek++;window.testYoutube.lastSeek=value;time=value;};
      setTimeout(function(){options.events.onReady();},0);
    }};window.onYouTubeIframeAPIReady();
  `}));
  return referers;
}
async function savedYouTube() {
  await go("media");
  await click("media-youtube");
  await editor("https://youtu.be/M7lc1UVf-VE");
  await click("youtube-item-0");
  await page.waitForFunction(() => AlmaYouTube.snapshot().ready);
}

test("YouTube acepta enlaces individuales y rechaza dominios falsos, listas e IDs inválidos", async () => {
  const results = await page.evaluate(() => [
    "https://www.youtube.com/watch?v=M7lc1UVf-VE&list=ABC",
    "https://youtu.be/M7lc1UVf-VE?t=10",
    "https://m.youtube.com/shorts/M7lc1UVf-VE",
    "https://www.youtube.com/live/M7lc1UVf-VE",
    "https://www.youtube.com/embed/M7lc1UVf-VE",
    "https://www.youtube.com/playlist?list=123",
    "https://youtube.com.evil.example/watch?v=M7lc1UVf-VE",
    "https://youtube.com@evil.example/watch?v=M7lc1UVf-VE",
    "https://youtu.be/123", "javascript:alert(1)"
  ].map(AlmaYouTube.parseUrl));
  assert.deepEqual(results.slice(0,5), Array(5).fill("M7lc1UVf-VE"));
  assert.deepEqual(results.slice(5), Array(5).fill(""));
});

test("YouTube integrado: enlace guardado, controles y pantalla completa sin recargar (API simulada)", async () => {
  const referers = await officialYouTubeFixture();
  await savedYouTube();
  const frame = page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  assert.ok(frame);
  assert.match(await page.locator("#youtube-state").innerText(), /listo/);
  assert.ok(await page.locator("#youtube-host").evaluate(n => n.getBoundingClientRect().height) >= 250);
  await click("youtube-play");
  await page.waitForFunction(() => AlmaYouTube.snapshot().state === 1);
  assert.equal(await frame.evaluate(() => testYoutube.play), 1);
  await click("youtube-pause");
  await page.waitForFunction(() => AlmaYouTube.snapshot().state === 2);
  await click("youtube-forward");
  await frame.waitForFunction(() => testYoutube.seek === 1);
  assert.equal(await frame.evaluate(() => testYoutube.seek), 1);
  await page.locator("#youtube-frame").evaluate(n => { n.dataset.testIdentity = "same-frame"; });
  await click("youtube-full");
  assert.equal(await page.locator("#youtube-host").evaluate(n => n.getBoundingClientRect().width),1280);
  await key(88);
  assert.equal(await page.locator("#youtube-frame").getAttribute("data-test-identity"),"same-frame");
  assert.equal(await frame.evaluate(() => testYoutube.play),1);
  await shot("26-youtube-integrado-api-simulada");
  assert.deepEqual(referers,["http://192.168.1.30:8088/"]);
  assert.equal(await frame.evaluate(() => testYoutube.options.playerVars.origin),"http://192.168.1.30:8088");
  await click("youtube-play");
  await page.waitForFunction(() => AlmaYouTube.snapshot().state === 1);
  await go("home");
  assert.equal(await page.locator("#youtube-frame").getAttribute("data-test-identity"),"same-frame");
  await page.locator("#home-player").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => AlmaYouTube.snapshot().state === 1);
  const box = await page.locator("#youtube-host").boundingBox();
  assert.ok(Math.abs(box.width / box.height - 16 / 9) < 0.02);
  assert.equal(await page.locator("#safe").getAttribute("data-home-media"),"youtube");
  await go("apps");
  assert.equal(await page.locator("#youtube-frame").getAttribute("data-test-identity"),"same-frame");
  await page.waitForFunction(() => AlmaYouTube.snapshot().state===1);
  await go("saver");
  assert.equal(await page.locator("#youtube-frame").count(),1);
  await page.waitForFunction(() => AlmaYouTube.snapshot().state===1);
  assert.equal(await page.locator("#youtube-host").evaluate(n=>getComputedStyle(n).visibility),"hidden");
  await page.reload();
  await go("media");
  assert.equal(await page.locator("#youtube-item-0").count(),1);
  assert.deepEqual(errors,[]);
});

for (const [code, expected] of [[5,/navegador/],[101,/propietario/],[153,/origen/]]) {
  test("YouTube muestra el error " + code + " sin fingir reproducción (API simulada)", async () => {
    await officialYouTubeFixture(code);
    await savedYouTube();
    await click("youtube-play");
    await page.waitForFunction(() => !AlmaYouTube.snapshot().ready);
    assert.match(await page.locator("#youtube-state").innerText(), expected);
    assert.equal(await page.evaluate(() => AlmaYouTube.snapshot().state),-1);
    await click("youtube-native");
    assert.equal(await page.locator("#youtube-frame").count(),0);
    assert.match(commands[0].url,/YouTube$/);
    assert.deepEqual(errors,[]);
  });
}

test("YouTube no acepta estados falsos y el puente ausente da un error con salida", async () => {
  await page.route("http://192.168.1.30:8088/youtube/player?**", r => r.fulfill({status:404,body:"Puente antiguo"}));
  await go("media");
  await click("media-youtube");
  await editor("https://youtu.be/M7lc1UVf-VE");
  await click("youtube-item-0");
  await page.evaluate(() => {
    const frame = document.getElementById("youtube-frame");
    const token = new URL(frame.src).searchParams.get("token");
    for (const options of [
      {origin:"http://192.168.1.30:8088",source:window,token},
      {origin:"https://evil.example",source:frame.contentWindow,token},
      {origin:"http://192.168.1.30:8088",source:frame.contentWindow,token:"fake"}
    ]) window.dispatchEvent(new MessageEvent("message", {origin:options.origin,source:options.source,data:JSON.stringify({channel:"alma-youtube",token:options.token,type:"ready",status:"Falso"})}));
  });
  assert.equal(await page.evaluate(() => AlmaYouTube.snapshot().ready),false);
  await page.clock.runFor(26000);
  assert.match(await page.locator("#youtube-state").innerText(),/no respondió/);
  await click("youtube-return");
  assert.equal(await page.locator("#youtube-frame").count(),0);
  assert.ok(await page.locator("#media-play").isVisible());
  assert.deepEqual(errors,[]);
});

test("Abrir YouTube integrado pausa el archivo propio y conserva YouTube en Inicio", async () => {
  await officialYouTubeFixture();
  await go("media"); await click("media-play");
  await savedYouTube();
  assert.equal(await page.locator("#media-audio").evaluate(n => n.paused),true);
  await click("youtube-play");
  await page.waitForFunction(() => AlmaYouTube.snapshot().state === 1);
  await key(20);
  assert.equal(await page.locator("#youtube-frame").count(),1);
  assert.equal(await page.locator("#media-audio").evaluate(n => n.paused),true);
  assert.deepEqual(errors,[]);
});


test("Probar YouTube abre la prueba oficial sin escribir enlaces (API simulada)", async () => {
  await officialYouTubeFixture();
  await go("media");
  await click("media-youtube-test");
  await page.waitForFunction(() => AlmaYouTube.snapshot().ready);
  assert.match(await page.locator("#youtube-frame").getAttribute("src"),/video=M7lc1UVf-VE/);
  await key(20);
  assert.equal(await page.locator("#youtube-frame").count(),1);
  assert.deepEqual(errors,[]);
});

test("Pegar enlaces en el panel real de la Mac los actualiza en TV sin reinstalar", async (t) => {
  const os = require("node:os");
  const {spawn} = require("node:child_process");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),"alma-panel-"));
  const filename = path.join(directory,"youtube-links.json");
  const script = `import sys,secrets
from pathlib import Path
from http.server import ThreadingHTTPServer
from puente import Handler
from youtube_library import Library
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
server.origins=['null','http://127.0.0.1:8765']
server.youtube_library=Library(Path(sys.argv[1]))
server.admin_token=secrets.token_urlsafe(32)
server.allow_launch=False
server.tv='192.168.1.249'
print(server.server_port,flush=True)
server.serve_forever()
`;
  const process = spawn("python3",["-u","-c",script,filename],{cwd:ROOT,stdio:["ignore","pipe","pipe"]});
  t.after(() => { process.kill(); fs.rmSync(directory,{recursive:true,force:true}); });
  const port = await new Promise((resolve,reject) => {
    process.once("error",reject);
    process.stdout.once("data",chunk => resolve(Number(chunk.toString().split("\n")[0])));
    process.once("exit",code => reject(new Error("Servidor del panel terminó: " + code)));
  });
  assert.ok(port > 0);
  const base = "http://127.0.0.1:" + port;
  await page.route("http://192.168.1.30:8088/youtube/library",async route => {
    const response = await fetch(base + "/youtube/library");
    await route.fulfill({status:response.status,headers:{"Access-Control-Allow-Origin":"http://127.0.0.1:8765"},contentType:"application/json",body:await response.text()});
  });
  const laptop = await browser.newContext({viewport:{width:1280,height:1000}});
  t.after(() => laptop.close());
  const panel = await laptop.newPage();
  const panelErrors = [];
  panel.on("pageerror",e => panelErrors.push(e.message));
  await panel.goto(base + "/enlaces");
  await panel.locator("#urls").fill("https://youtu.be/M7lc1UVf-VE");
  await panel.locator("#name").fill("Mi concierto en línea");
  await panel.locator("#save").click();
  await panel.waitForFunction(() => document.getElementById("status").textContent.indexOf("Guardado.") === 0);
  await go("media");
  await page.locator("#mac-youtube-0").waitFor();
  assert.match(await page.locator("#mac-youtube-0").innerText(),/Mi concierto en línea/);
  assert.equal(JSON.parse(fs.readFileSync(filename,"utf8")).items[0].name,"Mi concierto en línea");
  await panel.screenshot({path:path.join(ROOT,"docs/capturas/27-panel-enlaces-mac.png"),fullPage:true});
  await click("media-mac-links");
  await page.waitForFunction(() => document.getElementById("mac-youtube-0").className.indexOf("focus") >= 0);
  await shot("28-lista-mac-sin-reinstalar");
  await panel.locator(".remove").click();
  await panel.waitForFunction(() => document.querySelectorAll(".item").length === 0);
  await click("media-mac-links");
  await page.waitForFunction(() => !document.getElementById("mac-youtube-0"));
  await panel.locator("#urls").fill("https://youtu.be/M7lc1UVf-VE");
  await panel.locator("#name").fill('<img src=x onerror="alert(1)">');
  await panel.locator("#save").click();
  await panel.waitForFunction(() => document.querySelectorAll(".item").length === 1);
  await page.clock.runFor(16000);
  await page.locator("#mac-youtube-0").waitFor();
  assert.match(await page.locator("#mac-youtube-0 strong").innerText(),/<img src=x/);
  assert.equal(await page.locator("#mac-youtube-0 img").count(),0);
  assert.equal(await panel.locator(".item img").count(),0);
  await panel.reload();
  await panel.waitForFunction(() => document.querySelectorAll(".item").length === 1);
  const diagnostic = await fetch(base + "/youtube/diagnostic",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({token:"a".repeat(32),source:"alma-tv",phase:"timeout",status:"YT-INICIO · Prueba",state:-1,seconds:0,width:900,height:300})});
  assert.equal(diagnostic.status,200);
  await panel.locator("#player-refresh").click();
  await panel.waitForFunction(() => document.getElementById("player-status").textContent.indexOf("YT-INICIO") >= 0);
  await officialYouTubeFixture();
  await click("mac-youtube-0");
  await page.waitForFunction(() => AlmaYouTube.snapshot().ready);
  await go("home");
  assert.equal(await page.locator("#youtube-frame").count(),1);
  assert.deepEqual(panelErrors,[]);
  assert.deepEqual(errors,[]);
});

test("YouTube confirma la orden y carga explícitamente un vídeo sin iniciar (API simulada)", async () => {
  await officialYouTubeFixture(0,"explicit");
  await savedYouTube();
  const frame = page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  await click("youtube-play");
  await page.waitForFunction(() => AlmaYouTube.snapshot().state === 1);
  assert.equal(await frame.evaluate(() => testYoutube.load),1);
  assert.equal(await frame.evaluate(() => testYoutube.play),0);
  assert.equal(await frame.evaluate(() => testYoutube.loadedId),"M7lc1UVf-VE");
  const size=await frame.evaluate(() => testYoutube.size);
  assert.ok(size[0]>=350 && size[1]>=200);
  assert.ok(Math.abs(size[0]/size[1]-16/9)<0.02);
  assert.deepEqual(errors,[]);
});

test("YouTube listo pero sin iniciar muestra diagnóstico tras 12 segundos (API simulada)", async () => {
  await officialYouTubeFixture(0,"stalled");
  await savedYouTube();
  await click("youtube-play");
  await page.waitForFunction(() => AlmaYouTube.snapshot().status.indexOf("Orden Reproducir recibida") >= 0);
  await page.clock.runFor(13000);
  await page.waitForFunction(() => AlmaYouTube.snapshot().status.indexOf("YT-INICIO") >= 0);
  assert.equal(await page.evaluate(() => AlmaYouTube.snapshot().state),-1);
  assert.deepEqual(errors,[]);
});

test("El bloqueo de activación se identifica sin anunciar reproducción (API simulada)", async () => {
  await officialYouTubeFixture(0,"blocked");
  await savedYouTube();
  await click("youtube-play");
  await page.waitForFunction(() => AlmaYouTube.snapshot().status.indexOf("YT-ACTIVACION") >= 0);
  assert.equal(await page.evaluate(() => AlmaYouTube.snapshot().state),-1);
  assert.deepEqual(errors,[]);
});

test("Orígenes file antiguos solo controlan con ventana padre y sesión correctas (API simulada)", async () => {
  await officialYouTubeFixture();
  const token="b".repeat(32);
  await page.route("http://192.168.1.30:8088/youtube/legacy",r => r.fulfill({status:200,contentType:"text/html; charset=utf-8",body:fs.readFileSync(path.join(ROOT,"youtube_player.html"),"utf8").replace("__ALMA_YT_CONFIG__",JSON.stringify({video:"M7lc1UVf-VE",token,parent:"null",standalone:false}))}));
  await page.evaluate(() => {const f=document.createElement("iframe");f.id="legacy-test";f.src="http://192.168.1.30:8088/youtube/legacy";document.body.appendChild(f);});
  await page.waitForFunction(() => document.getElementById("legacy-test"));
  const frame=await page.locator("#legacy-test").contentFrame();
  await frame.locator("iframe").waitFor();
  const child=page.frame({url:"http://192.168.1.30:8088/youtube/legacy"});
  await child.waitForFunction(() => typeof testYoutube !== "undefined");
  await page.waitForTimeout(30);
  for (const origin of ["file://","file:///",""]) {
    await child.evaluate(({origin,token}) => window.dispatchEvent(new MessageEvent("message",{origin,source:window.parent,data:JSON.stringify({channel:"alma-youtube",token,command:"play"})})),{origin,token});
  }
  assert.equal(await child.evaluate(() => testYoutube.play),3);
  await child.evaluate(({token}) => {
    window.dispatchEvent(new MessageEvent("message",{origin:"https://evil.example",source:window.parent,data:JSON.stringify({channel:"alma-youtube",token,command:"play"})}));
    window.dispatchEvent(new MessageEvent("message",{origin:"file://",source:window,data:JSON.stringify({channel:"alma-youtube",token,command:"play"})}));
    window.dispatchEvent(new MessageEvent("message",{origin:"file://",source:window.parent,data:JSON.stringify({channel:"alma-youtube",token:"wrong",command:"play"})}));
  },{token});
  assert.equal(await child.evaluate(() => testYoutube.play),3);
  assert.deepEqual(errors,[]);
});

test("La prueba directa permite pulsación real sin el widget intermedio (API simulada)", async () => {
  await officialYouTubeFixture();
  await page.route("http://192.168.1.30:8088/youtube/prueba",r => r.fulfill({status:200,contentType:"text/html; charset=utf-8",body:fs.readFileSync(path.join(ROOT,"youtube_player.html"),"utf8").replace("__ALMA_YT_CONFIG__",JSON.stringify({video:"M7lc1UVf-VE",token:"c".repeat(32),parent:"http://192.168.1.30:8088",standalone:true}))}));
  await page.goto("http://192.168.1.30:8088/youtube/prueba");
  await page.waitForFunction(() => document.getElementById("status").textContent.indexOf("listo") >= 0);
  await page.locator("#direct-play").click();
  await page.waitForFunction(() => document.getElementById("status").textContent.indexOf("Reproduciendo") >= 0);
  assert.equal(await page.evaluate(() => testYoutube.activation),true);
  await page.locator("#direct-pause").click();
  assert.match(await page.locator("#status").innerText(),/En pausa/);
  assert.deepEqual(errors,[]);
});


test("YouTube conserva una sola área y continúa al navegar, sin ventana flotante (API simulada)", async () => {
  await officialYouTubeFixture();
  await savedYouTube();
  await page.locator(".page-surface").evaluate(n => n.classList.remove("page-enter"));
  await page.locator("#youtube-slot").scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const frame = page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  await page.locator("#youtube-frame").evaluate(n => { n.dataset.identity="persistent-85"; });
  const large = await page.locator("#youtube-host").boundingBox();
  assert.ok(large.width >= 700 && large.height >= 390, JSON.stringify(large));
  assert.ok(Math.abs(large.width/large.height-16/9)<0.02);
  const outer = await page.locator("#youtube-frame").evaluate(n => [Number(n.width),Number(n.height)]);
  const inner = await frame.locator("#surface iframe").evaluate(n => [Number(n.width),Number(n.height)]);
  assert.ok(outer[0]>=700 && inner[0]>=700);
  assert.ok(Math.abs(inner[0]/inner[1]-16/9)<0.02);
  await click("youtube-play");
  await page.waitForFunction(() => AlmaYouTube.snapshot().state===1);
  for (const view of ["home","apps","settings","media","home"]) {
    await go(view);
    assert.equal(await page.locator("#youtube-frame").getAttribute("data-identity"),"persistent-85");
    await page.waitForFunction(expected => AlmaYouTube.snapshot().state===expected, 1);
    if (view!=="home") {
      assert.equal(await page.locator("#safe").getAttribute("data-youtube"),"hidden");
      assert.equal(await page.locator("#youtube-host").evaluate(n=>getComputedStyle(n).visibility),"hidden");
    }
  }
  await page.locator("#view").evaluate(n => { n.scrollTop=0; n.dispatchEvent(new Event("scroll")); });
  const crop=await page.locator("#youtube-host").evaluate(n=>({clip:n.style.clip,height:n.getBoundingClientRect().height}));
  assert.match(crop.clip,/^rect\(/);
  assert.ok(Number(crop.clip.match(/[\d.]+/g)[2])<crop.height);
  await page.waitForFunction(() => AlmaYouTube.snapshot().state===1);
  await page.locator("#home-player").scrollIntoViewIfNeeded();
  await page.locator("#view").evaluate(n => n.dispatchEvent(new Event("scroll")));
  assert.equal(await page.locator("#safe").getAttribute("data-youtube"),"large");
  assert.equal(await frame.evaluate(() => testYoutube.pause),0);
  await page.evaluate(() => Alma.go("youtube"));
  await click("youtube-full");
  await page.waitForFunction(() => document.getElementById("youtube-frame").width==="1280");
  assert.deepEqual(await frame.locator("#surface iframe").evaluate(n => [n.width,n.height]),["1280","720"]);
  await key(20);
  assert.equal(await page.locator("#youtube-host").getAttribute("class"),"");
  assert.equal(await page.locator("#youtube-frame").getAttribute("data-identity"),"persistent-85");
  assert.deepEqual(errors,[]);
});

test("Inicio permite elegir los enlaces de YouTube de la Mac sin pasar por Multimedia (API simulada)", async () => {
  await page.route("http://192.168.1.30:8088/youtube/library", r => r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({items:[{id:"M7lc1UVf-VE",name:"Mi video desde Inicio"}]})}));
  await officialYouTubeFixture();
  await click("home-youtube");
  await page.locator("#youtube-saved-0").waitFor();
  assert.match(await page.locator("#youtube-saved-0").innerText(),/Mi video desde Inicio/);
  await click("youtube-saved-0");
  await page.waitForFunction(() => AlmaYouTube.snapshot().ready);
  await click("youtube-play");
  await page.waitForFunction(() => AlmaYouTube.snapshot().state===1);
  await key(20);
  assert.equal(await page.locator("#safe").getAttribute("data-view"),"home");
  assert.equal(await page.locator("#youtube-frame").count(),1);
  assert.deepEqual(errors,[]);
});


test("YouTube queda dentro de En reproducción sin ancestros escalados ni reajustes repetidos, incluso a Full HD (API simulada)", async () => {
  await officialYouTubeFixture();
  await savedYouTube();
  await click("youtube-play");
  await page.waitForFunction(() => AlmaYouTube.snapshot().state===1);
  const child = page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  const identity = await page.locator("#youtube-frame").evaluate(n => { n.dataset.identity="unscaled"; return n.src; });
  for (const resolution of [{width:1280,height:720},{width:1920,height:1080}]) {
    await page.setViewportSize(resolution);
    await go("home");
    await page.locator(".page-surface").evaluate(n => n.classList.remove("page-enter"));
    await page.locator("#home-player").scrollIntoViewIfNeeded();
    await page.locator("#view").evaluate(n => n.dispatchEvent(new Event("scroll")));
    await page.waitForFunction(() => document.getElementById("safe").getAttribute("data-youtube")==="large");
    const geometry = await page.evaluate(() => {
      const host=document.getElementById("youtube-host"), slot=document.getElementById("home-player");
      const ancestors=[];for(let node=host.parentElement;node;node=node.parentElement) ancestors.push(getComputedStyle(node).transform);
      return {host:host.getBoundingClientRect().toJSON(),slot:slot.getBoundingClientRect().toJSON(),parent:host.parentElement.tagName,ancestors};
    });
    assert.equal(geometry.parent,"BODY");
    assert.ok(geometry.ancestors.every(t=>t==="none"));
    assert.ok(Math.abs(geometry.host.x-geometry.slot.x)<=2,JSON.stringify(geometry));
    assert.ok(Math.abs(geometry.host.y-geometry.slot.y)<=2,JSON.stringify(geometry));
    assert.ok(Math.abs(geometry.host.width-geometry.slot.width)<=2,JSON.stringify(geometry));
    assert.ok(Math.abs(geometry.host.height-geometry.slot.height)<=2,JSON.stringify(geometry));
    assert.equal(await page.locator("#youtube-frame").getAttribute("src"),identity);
    // Let the resize messages from viewport/navigation settle before measuring.
    await page.waitForTimeout(200);
    const before=await child.evaluate(()=>testYoutube.sizeCount);
    await page.evaluate(() => {for(let i=0;i<50;i++) document.querySelector(".page-surface").dispatchEvent(new Event("animationend"));});
    await page.waitForTimeout(100);
    assert.equal(await child.evaluate(()=>testYoutube.sizeCount),before);
    assert.equal(await page.evaluate(()=>AlmaYouTube.snapshot().state),1);
  }
  assert.deepEqual(errors,[]);
});


test("Volumen del control remoto se libera a Samsung y no se bloquea ni cierra Alma TV (API Samsung simulada)", async () => {
  assert.deepEqual(await page.evaluate(()=>nativeVolumeKeys),[7,11,27]);
  for (const view of ["home","apps","media","settings"]) {
    await go(view);
    const events=await page.evaluate(()=>[7,11,27].map(code=>{
      const event=new KeyboardEvent("keydown",{keyCode:code,which:code,bubbles:true,cancelable:true});
      document.dispatchEvent(event);
      return event.defaultPrevented;
    }));
    assert.deepEqual(events,[false,false,false]);
  }
  await officialYouTubeFixture();
  await savedYouTube();
  await click("youtube-full");
  assert.deepEqual(await page.evaluate(()=>[7,11,27].map(code=>Alma.key(code))),[false,false,false]);
  assert.ok(!(await page.evaluate(()=>platformCalls)).includes("exit"));
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  assert.deepEqual((await page.evaluate(()=>nativeVolumeKeys)).slice(-3),[7,11,27]);
  assert.deepEqual(errors,[]);
});

test("Salvapantallas conserva YouTube solo con audio, sin pausa ni recarga, y recupera la imagen al volver (API simulada)", async () => {
  await officialYouTubeFixture(); await savedYouTube();
  await click("youtube-play");
  await page.waitForFunction(()=>AlmaYouTube.snapshot().state===1);
  const child=page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  const src=await page.locator("#youtube-frame").getAttribute("src");
  const before=await child.evaluate(()=>testYoutube.pause);
  await go("saver");
  assert.equal(await page.locator("#youtube-frame").getAttribute("src"),src);
  assert.equal(await page.locator("#youtube-host").evaluate(n=>getComputedStyle(n).visibility),"hidden");
  assert.equal(await page.evaluate(()=>AlmaYouTube.snapshot().state),1);
  await page.clock.runFor(16000);
  assert.equal(await child.evaluate(()=>testYoutube.pause),before);
  assert.ok(await page.locator("#saver-clock").isVisible());
  await key(88);
  await page.waitForFunction(()=>document.getElementById("youtube-host").style.visibility==="visible");
  assert.equal(await page.locator("#youtube-frame").getAttribute("src"),src);
  assert.equal(await page.evaluate(()=>AlmaYouTube.snapshot().state),1);
  assert.deepEqual(errors,[]);
});


test("Inicio no duplica el título de YouTube; scroll conserva sesión y limita la capa al contenido (API simulada)",async()=>{
  await officialYouTubeFixture();await savedYouTube();await click("youtube-play");
  await page.waitForFunction(()=>AlmaYouTube.snapshot().state===1);
  const child=page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  const pauses=await child.evaluate(()=>testYoutube.pause);
  const src=await page.locator("#youtube-frame").getAttribute("src");
  await go("home");
  assert.equal(await page.locator("#home-player .home-audio").evaluate(n=>getComputedStyle(n).display),"none");
  await page.locator("#view").evaluate(n=>{n.scrollTop-=60;n.dispatchEvent(new Event("scroll"));});
  assert.match(await page.locator("#youtube-host").evaluate(n=>n.style.clip),/^rect\(/);
  await go("apps");await go("home");await go("saver");await key(88);
  assert.equal(await child.evaluate(()=>testYoutube.pause),pauses);
  assert.equal(await page.locator("#youtube-frame").getAttribute("src"),src);
  assert.equal(await page.evaluate(()=>AlmaYouTube.snapshot().state),1);
  assert.deepEqual(errors,[]);
});

test("Saltos de 5, 10 o 30 segundos se guardan y agrupan pulsaciones rápidas de YouTube (API simulada)", async () => {
  await officialYouTubeFixture();
  await savedYouTube();
  assert.match(await page.locator("#youtube-seek-step").innerText(),/10 s/);
  await click("youtube-seek-step");
  assert.match(await page.locator("#youtube-forward").innerText(),/30 s/);
  await click("youtube-full");
  await page.evaluate(()=>{Alma.key(5);Alma.key(5);Alma.key(5);});
  const frame=page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  await frame.waitForFunction(()=>testYoutube.seek===1);
  assert.equal(await frame.evaluate(()=>testYoutube.lastSeek),110);
  await key(88); await click("youtube-seek-step");
  assert.match(await page.locator("#youtube-back").innerText(),/5 s/);
  await click("youtube-back");
  await frame.waitForFunction(()=>testYoutube.seek===2);
  assert.equal(await frame.evaluate(()=>testYoutube.lastSeek),105);
  await page.reload(); await go("settings");
  assert.match(await page.locator("#seek-step").innerText(),/5 segundos/);
  assert.deepEqual(errors,[]);
});

test("Saltos configurables en archivos reales y una sola búsqueda por ráfaga", async () => {
  await go("media"); await click("media-play");
  await page.waitForFunction(()=>document.getElementById("media-audio").currentTime>0.2);
  await click("media-play");
  await click("media-seek-step"); await click("media-seek-step");
  assert.match(await page.locator("#media-forward").innerText(),/5 s/);
  await click("media-forward");
  await page.waitForFunction(()=>document.getElementById("media-audio").currentTime>5);
  await page.evaluate(()=>{AlmaPlayer.seek(-5);AlmaPlayer.seek(5);AlmaPlayer.seek(-5);});
  await page.waitForFunction(()=>document.getElementById("media-audio").currentTime<1);
  assert.deepEqual(errors,[]);
});




test("Salvapantallas retira ambas superficies fuera de pantalla, conserva audio y restaura sin recarga (API simulada)", async()=>{
  await officialYouTubeFixture();await savedYouTube();await click("youtube-play");
  await page.waitForFunction(()=>AlmaYouTube.snapshot().state===1);
  const child=page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  const src=await page.locator("#youtube-frame").getAttribute("src");
  const pauses=await child.evaluate(()=>testYoutube.pause);
  await go("saver");
  await child.waitForFunction(()=>document.getElementById("surface").style.left==="-10000px",null,{polling:50});
  assert.equal(await page.locator("#youtube-host").evaluate(n=>n.style.left),"-10000px");
  await page.clock.runFor(16000);
  assert.equal(await child.evaluate(()=>testYoutube.pause),pauses);
  assert.equal(await page.evaluate(()=>AlmaYouTube.snapshot().state),1);
  await key(88);
  await child.waitForFunction(()=>document.getElementById("surface").style.left==="0px");
  assert.equal(await page.locator("#youtube-frame").getAttribute("src"),src);
  assert.deepEqual(errors,[]);
});

test("YouTube reutiliza la geometría ante estados repetidos sin lecturas de layout (API simulada)",async()=>{
  await officialYouTubeFixture();await savedYouTube();await click("youtube-play");
  await page.waitForFunction(()=>AlmaYouTube.snapshot().state===1);
  const reads=await page.evaluate(()=>{
    const slot=document.getElementById("youtube-slot"),original=slot.getBoundingClientRect;
    let count=0;slot.getBoundingClientRect=function(){count++;return original.call(this);};
    const frame=document.getElementById("youtube-frame"),token=new URL(frame.src).searchParams.get("token");
    for(let i=0;i<50;i++) window.dispatchEvent(new MessageEvent("message",{source:frame.contentWindow,origin:"http://192.168.1.30:8088",data:JSON.stringify({channel:"alma-youtube",token,type:"state",state:1,status:"Reproduciendo en YouTube"})}));
    return count;
  });
  assert.equal(reads,0);assert.deepEqual(errors,[]);
});

async function nativeAudioFixture(mode="normal") {
  await page.evaluate(mode=>{
    window.audioCalls=[]; window.tvLevel=20; window.tvMuted=0;
    for(const id of ["alma-audio-plugin","alma-keys-plugin"]) {const n=document.createElement("object");n.id=id;document.body.appendChild(n);}
    const audio=document.getElementById("alma-audio-plugin"), common=document.getElementById("alma-keys-plugin");
    audio.Open=(...args)=>{audioCalls.push(["OpenAudio",...args]);return mode==="open" ? 0 : 1;};
    audio.Close=()=>{audioCalls.push(["CloseAudio"]);return 1;};
    common.Open=()=>1; common.Close=()=>1;
    common.Execute=(command,code)=>{audioCalls.push([command,code]);return mode==="register" && command==="RegisterKey" ? -1 : 1;};
    audio.Execute=(command,value)=>{
      audioCalls.push([command,value]);
      if(command==="GetVolume") return mode==="read" ? -1 : tvLevel;
      if(command==="GetUserMute") return tvMuted;
      if(command==="SetUserMute") {tvMuted=value;return 1;}
      if(command==="SetVolumeWithKey") {if(mode==="write") return -1; tvLevel=Math.max(0,Math.min(100,tvLevel+(value===0 ? 1 : -1)));return 1;}
      return -1;
    };
    Alma.go("settings");document.getElementById("tv-volume").click();
  },mode);
}

test("Volumen físico utiliza Audio nativo, cambia un paso real por tecla y Silencio sin salir (API Samsung simulada)", async () => {
  await nativeAudioFixture();
  assert.equal(await page.evaluate(()=>AlmaTVAudio.active()),true);
  assert.deepEqual((await page.evaluate(()=>audioCalls)).filter(c=>c[0]==="RegisterKey").map(c=>c[1]),[7,11,27]);
  assert.equal(await key(7),true);
  assert.equal(await page.evaluate(()=>tvLevel),21);
  assert.match(await page.locator("#toast").innerText(),/Volumen de la TV: 21/);
  await key(11); assert.equal(await page.evaluate(()=>tvLevel),20);
  await key(27); assert.equal(await page.evaluate(()=>tvMuted),1);
  await key(27); assert.equal(await page.evaluate(()=>tvMuted),0);
  assert.ok(!(await page.evaluate(()=>platformCalls)).includes("exit"));
  assert.deepEqual((await page.evaluate(()=>audioCalls)).filter(c=>c[0]==="SetVolumeWithKey").map(c=>c[1]),[0,1]);
  await page.evaluate(()=>AlmaTVAudio.close());
  assert.deepEqual((await page.evaluate(()=>audioCalls)).filter(c=>c[0]==="UnregisterKey").map(c=>c[1]),[7,11,27]);
  assert.deepEqual(errors,[]);
});
for(const mode of ["open","read","register","write"]) {
  test("Audio nativo rechaza fallo "+mode+" y devuelve las teclas al sistema (API simulada)",async()=>{
    await nativeAudioFixture(mode);
    if(mode==="write") await key(7);
    assert.equal(await page.evaluate(()=>AlmaTVAudio.active()),false);
    assert.equal(await page.evaluate(()=>tvLevel),20);
    assert.equal(await key(7),false);
    assert.ok(!(await page.evaluate(()=>platformCalls)).includes("exit"));
    assert.deepEqual(errors,[]);
  });
}



test("Arranque, foco y teclas previas a activación no instancian ni abren Audio nativo",async()=>{
  await page.addInitScript(()=>{
    window.nativeOpens=0;
    HTMLObjectElement.prototype.Open=function(){nativeOpens++;throw new Error("No disponible");};
    HTMLObjectElement.prototype.Execute=function(){return -1;};
    HTMLObjectElement.prototype.Close=function(){return 1;};
  });
  await page.reload();await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await key(7);await key(11);await key(27);
  assert.equal(await page.evaluate(()=>nativeOpens),0);
  assert.equal(await page.locator("#alma-audio-plugin").count(),0);
  assert.equal(await page.locator("#alma-keys-plugin").count(),0);
  await go("settings");await click("tv-volume");
  assert.equal(await page.evaluate(()=>nativeOpens),1);
  assert.equal(await page.evaluate(()=>AlmaTVAudio.active()),false);
  assert.ok(await page.locator("#tv-volume").isVisible());
  assert.deepEqual(errors,[]);
});

test("Salvapantallas desmonta el dibujo de ambos iframes sin destruir sesión ni pausar audio (API simulada)",async()=>{
  await officialYouTubeFixture();await savedYouTube();await click("youtube-play");
  await page.waitForFunction(()=>AlmaYouTube.snapshot().state===1);
  const child=page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  const identity=await page.locator("#youtube-frame").getAttribute("src");
  const pauses=await child.evaluate(()=>testYoutube.pause);
  await go("saver");
  await child.waitForFunction(()=>document.getElementById("surface").style.display==="none",null,{polling:50});
  assert.equal(await page.locator("#youtube-host").evaluate(n=>getComputedStyle(n).display),"none");
  assert.equal(await child.locator("#surface iframe").evaluate(n=>getComputedStyle(n).display),"none");
  await page.clock.runFor(16000);
  assert.equal(await child.evaluate(()=>testYoutube.pause),pauses);
  assert.equal(await page.evaluate(()=>AlmaYouTube.snapshot().state),1);
  await key(88);
  await child.waitForFunction(()=>document.getElementById("surface").style.display==="block",null,{polling:50});
  assert.equal(await page.locator("#youtube-frame").getAttribute("src"),identity);
  assert.deepEqual(errors,[]);
});


for(const mode of ["video","audio"]) test("Panel de Mac envía Reproducir ahora a Inicio una sola vez: "+mode+" (API simulada)",{timeout:20000},async(t)=>{
  await officialYouTubeFixture();let command=null,status="idle",acks=[];
  await page.route("http://192.168.1.30:8088/youtube/live",r=>r.fulfill({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify({command,status})}));
  await page.route("http://192.168.1.30:8088/youtube/live/ack",r=>{
    if(r.request().method()==="POST"){const data=r.request().postDataJSON();acks.push(data);status=data.status;}
    return r.fulfill({status:200,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST"},body:"{}"});
  });
  const laptop=await browser.newContext();t.after(()=>laptop.close());
  const mac=await laptop.newPage();
  await mac.route("http://192.168.1.30:8088/**",r=>{
    const routePath=new URL(r.request().url()).pathname;
    if(routePath==="/enlaces")return r.fulfill({contentType:"text/html",body:fs.readFileSync(path.join(ROOT,"link_panel.html"),"utf8").replace("__ALMA_PANEL_TOKEN__",JSON.stringify("test-token"))});
    if(routePath==="/youtube/live" && r.request().method()==="POST"){
      const body=r.request().postDataJSON();assert.equal(body.mode,mode);assert.equal(r.request().headers()["x-alma-token"],"test-token");
      command={id:"a".repeat(32),video:"M7lc1UVf-VE",name:"Desde la Mac",mode};status="waiting";
    }
    return r.fulfill({contentType:"application/json",body:JSON.stringify(routePath==="/youtube/live" ? {command,status} : {items:[],report:null})});
  });
  await mac.goto("http://192.168.1.30:8088/enlaces");
  await mac.locator("#live-url").fill("https://youtu.be/M7lc1UVf-VE");await mac.locator("#live-mode").selectOption(mode);await mac.locator("#live-play").click();
  for(let retry=0;retry<10;retry++) {
    await page.clock.runFor(1000);await page.waitForTimeout(100);
    if(await page.evaluate(()=>AlmaYouTube.snapshot().state===1))break;
  }
  assert.equal(await page.evaluate(()=>AlmaYouTube.snapshot().state),1,JSON.stringify(await page.evaluate(()=>AlmaYouTube.snapshot())));
  assert.equal(await page.locator("#safe").getAttribute("data-view"),"home");
  assert.equal(await page.locator("#safe").getAttribute("data-youtube-mode"),mode);
  const child=page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  assert.equal(await child.evaluate(()=>testYoutube.play),1);
  assert.equal(await child.evaluate(()=>testYoutube.options.playerVars.autoplay),0);
  await page.waitForTimeout(100);assert.ok(acks.some(a=>a.status==="received"));assert.ok(acks.some(a=>a.status==="playing"));
  if(mode==="audio")assert.equal(await page.locator("#youtube-host").evaluate(n=>getComputedStyle(n).display),"none");
  else assert.equal(await page.locator("#youtube-host").evaluate(n=>getComputedStyle(n).visibility),"visible");
  await page.clock.runFor(6000);assert.equal(await child.evaluate(()=>testYoutube.play),1);
  await page.reload();await page.clock.runFor(2100);assert.equal(await page.locator("#youtube-frame").count(),0);
  await mac.close();assert.deepEqual(errors,[]);
});


test("En tiempo real informa bloqueo de autoplay sin anunciar reproducción ni reintentar (API simulada)",{timeout:15000},async()=>{
  await officialYouTubeFixture(0,"blocked");
  const command={id:"b".repeat(32),video:"M7lc1UVf-VE",name:"Solo audio",mode:"audio"};const acks=[];
  await page.route("http://192.168.1.30:8088/youtube/live",r=>r.fulfill({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify({command,status:acks.length ? "received" : "waiting"})}));
  await page.route("http://192.168.1.30:8088/youtube/live/ack",r=>{
    if(r.request().method()==="POST")acks.push(r.request().postDataJSON().status);
    return r.fulfill({status:200,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST"},body:"{}"});
  });
  for(let retry=0;retry<10;retry++){await page.clock.runFor(1000);await page.waitForTimeout(100);if(acks.includes("blocked"))break;}
  assert.ok(acks.includes("blocked"));assert.ok(!acks.includes("playing"));
  const child=page.frame({url:/192\.168\.1\.30:8088\/youtube\/player/});
  await page.clock.runFor(5000);assert.equal(await child.evaluate(()=>testYoutube.play),1);
  assert.deepEqual(errors,[]);
});

 test("El volumen de Alma TV regula YouTube sin módulo Samsung y se guarda entre aperturas (API simulada)",async()=>{
 await officialYouTubeFixture();await savedYouTube();await click("youtube-play");const frame=page.frame({url:/youtube\/player/});await frame.waitForFunction(()=>testYoutube.volume===70);
 await page.evaluate(()=>Alma.hubControl("pause"));await page.waitForFunction(()=>AlmaYouTube.snapshot().state===2);await page.evaluate(()=>Alma.hubControl("volume-down"));await page.evaluate(()=>Alma.hubControl("play"));await frame.waitForFunction(()=>testYoutube.volume===60);
 await page.evaluate(()=>Alma.hubControl("mute"));await frame.waitForFunction(()=>testYoutube.muted===true);
 assert.equal(await page.evaluate(()=>AlmaTVAudio.active()),false);
 await page.reload();await go("media");await click("youtube-item-0");await page.waitForFunction(()=>AlmaYouTube.snapshot().ready);await click("youtube-play");const reopened=page.frame({url:/youtube\/player/});await reopened.waitForFunction(()=>testYoutube.volume===60&&testYoutube.muted===true);
 await page.evaluate(()=>Alma.hubControl("volume-up"));await reopened.waitForFunction(()=>testYoutube.volume===70&&testYoutube.muted===false);
 });

 test("Reproducir ahora mantiene arranque 8.7: play antes de volumen o unMute y autoplay nativo desactivado (API simulada)",async()=>{
 await officialYouTubeFixture();await page.evaluate(()=>Alma.hubPlay({kind:"youtube",video:"M7lc1UVf-VE",provider:"youtube",name:"Recuperación",mode:"video"}));await page.waitForFunction(()=>AlmaYouTube.snapshot().state===1);const child=page.frame({url:/youtube\/player/});assert.equal(await child.evaluate(()=>testYoutube.options.playerVars.autoplay),0);assert.equal(await child.evaluate(()=>!!testYoutube.earlyAudio),false);assert.equal(await child.evaluate(()=>testYoutube.play),1);await child.waitForFunction(()=>testYoutube.volume===70);
 });
