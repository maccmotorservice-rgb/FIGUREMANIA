/* Copyright 2015 Samsung Electronics Co., Ltd.
 * Adapted for Alma TV (2026). Apache-2.0; assets/SAMSUNG-APACHE-2.0.txt.
 * Native calls documented by Samsung TOAST's Orsay tvaudiocontrolProxy.js.
 */
var AlmaTVAudio = (function () {
  "use strict";
  var audio = null, common = null, active = false, openedAudio = false, openedCommon = false;
  var keys = [], registered = [], update = function () {};
  function resultOK(value) { return value === true || (typeof value === "number" && isFinite(value) && value >= 0); }
  function close() {
    if (openedCommon) {
      for (var i = 0; i < keys.length; i++) { try { common.Execute("UnregisterKey", keys[i]); } catch (e) {} }
      try { common.Close(); } catch (e) {}
    }
    if (openedAudio) { try { audio.Close(); } catch (e) {} }
    active = false; openedAudio = false; openedCommon = false; registered = [];
  }
  function release(codes) {
    if (active) return;
    var object = document.getElementById("alma-keys-plugin");
    if (!object || typeof object.Open !== "function" || typeof object.Execute !== "function") return;
    try {
      if (object.Open("AppCommon", "1.000", "AppCommon") === 1) {
        for (var i = 0; i < codes.length; i++) { try { object.Execute("UnregisterKey", codes[i]); } catch (e) {} }
        try { object.Close(); } catch (e) {}
      }
    } catch (e) {}
  }
  function init(codes, callback) {
    if (active) return true;
    update = callback || function () {}; keys = codes.slice(0, 3);
    audio = document.getElementById("alma-audio-plugin");
    common = document.getElementById("alma-keys-plugin");
    if (!audio || !common || typeof audio.Open !== "function" || typeof audio.Execute !== "function" || typeof common.Open !== "function" || typeof common.Execute !== "function") return false;
    try {
      try { audio.Close(); common.Close(); } catch (notOpen) {}
      if (audio.Open("Audio", "1.000", "Audio") !== 1) return false;
      openedAudio = true;
      var level = audio.Execute("GetVolume");
      if (typeof level !== "number" || level < 0 || level > 100 || !isFinite(level)) { close(); return false; }
      if (common.Open("AppCommon", "1.000", "AppCommon") !== 1) { close(); return false; }
      openedCommon = true;
      for (var i = 0; i < keys.length; i++) {
        registered.push(keys[i]);
        if (!(common.Execute("RegisterKey", keys[i]) > 0)) { close(); return false; }
      }
      active = true; return true;
    } catch (e) { close(); return false; }
  }
  function handle(code) {
    var index = keys.indexOf(code);
    if (!active || index < 0) return false;
    try {
      if (index === 2) {
        var current = audio.Execute("GetUserMute");
        if (current !== 0 && current !== 1) throw new Error("mute unavailable");
        if (!resultOK(audio.Execute("SetUserMute", current ? 0 : 1))) throw new Error("mute rejected");
        var muted = audio.Execute("GetUserMute");
        if (muted === 0 || muted === 1) update(muted ? "Silencio activado en la TV" : "Silencio desactivado en la TV");
      } else {
        if (!resultOK(audio.Execute("SetUserMute", 0))) throw new Error("unmute rejected");
        // The native API applies one TV volume step and its OSD: 0 up, 1 down.
        if (!resultOK(audio.Execute("SetVolumeWithKey", index === 0 ? 0 : 1))) throw new Error("volume rejected");
        var level = audio.Execute("GetVolume");
        if (typeof level === "number" && isFinite(level) && level >= 0 && level <= 100) update("Volumen de la TV: " + level);
      }
      return true;
    } catch (e) { close(); update("La TV rechazó el control nativo de volumen."); return false; }
  }
  return { init: init, release: release, handle: handle, close: close, active: function () { return active; } };
})();
