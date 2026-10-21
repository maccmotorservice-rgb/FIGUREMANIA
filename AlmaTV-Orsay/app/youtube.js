/* Integración oficial de YouTube. ES5; no extrae ni descarga vídeos. */
var AlmaYouTube = (function () {
  "use strict";
  var frame = null, host = null, base = "", token = "", timer = null;
  var changed = function () {}, value = { status: "Sin vídeo", ready: false, state: -1, title: "" };
  function parseUrl(input) {
    var text = String(input || "").replace(/^\s+|\s+$/g, ""), a = document.createElement("a"), id = "";
    if (!/^https?:\/\//i.test(text)) return "";
    a.href = text;
    var name = a.hostname.toLowerCase(), path = a.pathname.replace(/^\//, ""), match;
    if (name === "youtu.be") id = path.split("/")[0];
    else if (/^(www\.|m\.|music\.)?youtube\.com$/.test(name) || name === "www.youtube-nocookie.com" || name === "youtube-nocookie.com") {
      if (path === "watch") {
        match = a.search.match(/[?&]v=([^&]*)/);
        try { id = match ? decodeURIComponent(match[1]) : ""; } catch (e) { return ""; }
      } else if (/^(shorts|live|embed)\//.test(path)) id = path.split("/")[1];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  }
  function snapshot() { return { status: value.status, ready: value.ready, state: value.state, title: value.title }; }
  function send(command) {
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(JSON.stringify({ channel: "alma-youtube", token: token, command: command }), base);
  }
  function resize(width, height) {
    if (!frame || !frame.contentWindow) return;
    width = Math.round(width); height = Math.round(height);
    frame.width = width; frame.height = height;
    frame.style.width = width + "px"; frame.style.height = height + "px";
    frame.contentWindow.postMessage(JSON.stringify({ channel: "alma-youtube", token: token, command: "resize", width: width, height: height }), base);
  }
  function receive(event) {
    if (!frame || event.source !== frame.contentWindow || event.origin !== base) return;
    var data;
    try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch (e) { return; }
    if (!data || data.channel !== "alma-youtube" || data.token !== token) return;
    if (data.type === "ready") { value.ready = true; clearTimeout(timer); }
    if (data.type === "error") { value.ready = false; clearTimeout(timer); }
    if (typeof data.state === "number") value.state = data.state;
    if (typeof data.title === "string") value.title = data.title.slice(0, 160);
    if (typeof data.status === "string") value.status = data.status.slice(0, 300);
    changed();
  }
  function close() {
    clearTimeout(timer);
    if (frame) { send("pause"); frame.src = "about:blank"; host.innerHTML = ""; }
    frame = null;
    if (host) host.style.display = "none";
    value = { status: "Sin vídeo", ready: false, state: -1, title: "" };
  }
  function open(node, mac, id, callback) {
    close();
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    host = node; base = "http://" + mac + ":8088"; changed = callback;
    token = "";
    for (var i = 0; i < 32; i++) token += Math.floor(Math.random() * 16).toString(16);
    var origin = window.location.protocol === "file:" ? "null" : window.location.protocol + "//" + window.location.host;
    frame = document.createElement("iframe");
    frame.id = "youtube-frame"; frame.title = "Reproductor oficial de YouTube";
    frame.setAttribute("allow", "autoplay; encrypted-media; fullscreen");
    frame.setAttribute("allowfullscreen", "allowfullscreen");
    frame.setAttribute("referrerpolicy", "origin");
    frame.setAttribute("frameborder", "0");
    value.status = "Conectando con el puente y el reproductor oficial de YouTube…";
    frame.src = base + "/youtube/player?video=" + id + "&token=" + token + "&parent=" + encodeURIComponent(origin);
    host.style.display = "block"; host.appendChild(frame);
    timer = setTimeout(function () {
      value.status = "YouTube no respondió. Comprueba el puente actualizado y la conexión. El navegador de la TV puede ser incompatible.";
      changed();
    }, 25000);
    changed();
  }
  function init() { window.addEventListener("message", receive, false); }
  function destroy() { close(); window.removeEventListener("message", receive, false); }
  return { init: init, destroy: destroy, parseUrl: parseUrl, open: open, close: close, send: send, resize: resize, snapshot: snapshot };
})();
