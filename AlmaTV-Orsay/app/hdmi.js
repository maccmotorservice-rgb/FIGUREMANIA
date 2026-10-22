/* Copyright 2015 Samsung Electronics Co., Ltd.
 * Adapted in 2026 for Alma TV: native Orsay HDMI window and lifecycle.
 * Licensed under the Apache License, Version 2.0. See assets/SAMSUNG-APACHE-2.0.txt.
 * API sequence researched in Samsung TOAST:
 * Samsung/cordova-plugin-toast src/sectv-orsay/tvwindowProxy.js (Apache-2.0).
 * No captured frames or simulated signal. */
var AlmaHDMI = (function () {
  "use strict";
  var plugin = null, manager = null, opened = false, touched = false;
  var active = false, previous = null, lastRect = "", timer = null, generation = 0;
  var changed = function () {}, status = "HDMI 2 sin abrir", confirmed = false;
  function available() {
    var object = document.getElementById("alma-window-plugin");
    if (object && !object.getAttribute("classid")) object.setAttribute("classid", object.getAttribute("data-native-classid"));
    var api = typeof webapis !== "undefined" && webapis.tv && webapis.tv.window;
    return !!(object && typeof object.Open === "function" && typeof object.Execute === "function" && typeof object.Close === "function" && api && typeof api.getSource === "function" && typeof api.setRect === "function" && typeof api.show === "function" && typeof api.hide === "function");
  }
  function sourceCode(source) {
    var types = ["TV", "AV", "SVIDEO", "COMP", "PC", "HDMI", "SCART", "DVI", "MEDIA"];
    if (!source) return null;
    var type = typeof source.type === "number" ? types[source.type] : String(source.type).toUpperCase();
    var bases = { AV: 15, SVIDEO: 19, COMP: 23, PC: 27, HDMI: 31, SCART: 35, DVI: 39 };
    if (type === "TV") return 0;
    if (type === "MEDIA") return 43;
    var number = Number(source.number);
    if (bases[type] !== undefined && number >= 1 && number <= 4 && Math.floor(number) === number) return bases[type] + number - 1;
    return null;
  }
  function snapshot() { return { active: active, confirmed: confirmed, status: status }; }
  function stop(silent) {
    generation++; clearTimeout(timer);
    var completed = true;
    if (opened) {
      // Restore the exact source read before this preview, then hide and close.
      if (touched && previous !== null) { try { if (plugin.Execute("SetSource", previous) === -1) completed = false; } catch (e) { completed = false; } }
      if (touched && manager) { try { if (!manager.hide(0)) completed = false; } catch (e) { completed = false; } }
      try { plugin.Close(); } catch (e) { completed = false; }
    }
    opened = false; touched = false; active = false; confirmed = false;
    previous = null; lastRect = "";
    if (!silent) { status = completed ? "Vista HDMI cerrada" : "La TV rechazó el cierre de HDMI. Usa SOURCE si la imagen permanece."; changed(); }
    return completed;
  }
  function fail(message) { stop(true); status = message; changed(); return false; }
  function validRect(rect) {
    var width = window.innerWidth || document.documentElement.clientWidth || 1280;
    var height = window.innerHeight || document.documentElement.clientHeight || 720;
    return rect && isFinite(rect.left) && isFinite(rect.top) && isFinite(rect.width) && isFinite(rect.height) && rect.left >= 0 && rect.top >= 0 && rect.width > 0 && rect.height > 0 && rect.left + rect.width <= width + 1 && rect.top + rect.height <= height + 1;
  }
  function resize(rect) {
    if (!active) return false;
    if (!validRect(rect)) return fail("HDMI: área de imagen inválida. Se cerró la ventana.");
    var normalized = { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
    var key = JSON.stringify(normalized);
    if (key === lastRect) return true;
    try {
      if (!manager.setRect(normalized, 0)) return fail("El firmware rechazó el tamaño de la ventana HDMI.");
      lastRect = key;
      return true;
    } catch (e) { return fail("No se pudo ajustar la ventana nativa HDMI."); }
  }
  function open(rect, callback) {
    stop(true); changed = callback || function () {};
    if (!available()) return fail("Este firmware no expone la ventana HDMI de Orsay.");
    plugin = document.getElementById("alma-window-plugin"); manager = webapis.tv.window;
    try {
      try { plugin.Close(); } catch (notOpenYet) {}
      if (plugin.Open("Window", "1.000", "Window") !== 1) return fail("El firmware no permitió abrir el módulo Window.");
      opened = true;
      previous = sourceCode(manager.getSource(0));
      if (previous === null) return fail("No se pudo leer la fuente original. No se cambió la entrada.");
      touched = true;
      // 32 is HDMI2 in Samsung's documented Orsay source table, not an index guess.
      var result = plugin.Execute("SetSource", 32);
      if (!(result === true || (typeof result === "number" && isFinite(result) && result >= 0))) return fail("El firmware rechazó seleccionar HDMI 2.");
      active = true;
      if (!resize(rect)) return false;
      plugin.Execute("SetPreviousSource");
      var windowObject = document.getElementById("_plugin_Window");
      if (windowObject) windowObject.style.position = "fixed";
      if (!manager.show(0)) return fail("El firmware rechazó mostrar la ventana HDMI.");
      status = "Ventana abierta. Comprobando que la fuente sea HDMI 2…";
      changed();
      var current = generation, tries = 0;
      function verify() {
        if (current !== generation || !active) return;
        try {
          if (sourceCode(manager.getSource(0)) === 32) {
            confirmed = true;
            status = "La TV confirma HDMI 2. Enciende la consola si no aparece imagen.";
            changed(); return;
          }
        } catch (e) {}
        if (++tries < 3) timer = setTimeout(verify, 400);
        else fail("La TV no confirmó HDMI 2. Se intentó restaurar la fuente anterior.");
      }
      timer = setTimeout(verify, 200);
      return true;
    } catch (e) { return fail("La API nativa de HDMI falló. Se cerró la prueba."); }
  }
  return { available: available, snapshot: snapshot, open: open, resize: resize, stop: stop };
})();
