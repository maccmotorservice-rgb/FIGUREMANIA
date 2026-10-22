/* Integración oficial de YouTube. ES5; no extrae ni descarga vídeos. */
var AlmaYouTube = (function () {
  "use strict";
  var frame = null, host = null, base = "", token = "", timer = null, lastWidth = 0, lastHeight = 0, presented = null, audioApplied = true, activeProvider="", selectedVideo="", pendingVideo="";
  var chosenLevel=70, chosenMuted=false, endReports=0;
  function level(amount, muted, passive) {
    chosenLevel=Math.max(0,Math.min(100,Number(amount)||0));chosenMuted=muted===true;
    if(passive===true)return;
    if(frame && frame.contentWindow && value.ready && value.state===1) frame.contentWindow.postMessage(JSON.stringify({channel:"alma-youtube",token:token,command:"volume",level:chosenLevel,muted:chosenMuted}),base);
    else audioApplied=false;
  }
  var changed = function () {}, value = { status: "Sin vídeo", ready: false, state: -1, title: "", failed: false };
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
  function parseLink(input) {
    var id=parseUrl(input);if(id)return {id:id,provider:"youtube"};
    var anchor=document.createElement("a");anchor.href=String(input||"");
    if (!/^https?:$/.test(anchor.protocol) || anchor.username || anchor.password || (anchor.port && anchor.port!=="80" && anchor.port!=="443")) return null;
    var parts=anchor.pathname.replace(/^\//,"").split("/"),host=anchor.hostname.toLowerCase();
    id=host==="dai.ly" ? parts[0] : (/^(www\.|m\.)?dailymotion\.com$/.test(host) && parts[0]==="video" ? parts[1] : "");
    id=String(id||"").split("_")[0];return /^[A-Za-z0-9]{5,12}$/.test(id) ? {id:id,provider:"dailymotion"} : null;
  }
  function snapshot() { return { status: value.status, ready: value.ready, state: value.state, title: value.title, failed: value.failed, seconds:value.seconds||0, duration:value.duration||0,finished:value.finished===true,volume:value.volume,muted:value.muted }; }
  function present(visible, remove) {
    remove = remove === true;
    var presentationKey = visible + ":" + remove;
    if (!frame || !frame.contentWindow || presented === presentationKey) return;
    presented = presentationKey;
    frame.contentWindow.postMessage(JSON.stringify({ channel: "alma-youtube", token: token, command: "presentation", visible: visible, remove: remove }), base);
  }
  function reusable(mac,provider){return !!frame && value.ready && !value.failed && base==="http://"+mac+":8088" && activeProvider===(provider==="dailymotion"?"dailymotion":"youtube");}
  function send(command, seconds) {
    if (!frame || !frame.contentWindow) return;
    var video="";if(command==="play" && pendingVideo){command="load";video=pendingVideo;pendingVideo="";}
    frame.contentWindow.postMessage(JSON.stringify({ channel: "alma-youtube", token: token, command: command, video:video, seconds: [5, 10, 30].indexOf(seconds) !== -1 ? seconds : 10 }), base);
  }
  function resize(width, height) {
    if (!frame || !frame.contentWindow) return;
    width = Math.round(width); height = Math.round(height);
    if (width === lastWidth && height === lastHeight) return;
    if (!isFinite(width) || !isFinite(height) || width < 200 || height < 200 || width > 4096 || height > 2160) return;
    lastWidth = width; lastHeight = height;
    frame.width = width; frame.height = height;
    frame.style.width = width + "px"; frame.style.height = height + "px";
    frame.contentWindow.postMessage(JSON.stringify({ channel: "alma-youtube", token: token, command: "resize", width: width, height: height }), base);
  }
  function receive(event) {
    if (!frame || event.source !== frame.contentWindow || event.origin !== base) return;
    var data;
    try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch (e) { return; }
    if(data && typeof data.video==="string" && data.video!==selectedVideo)return;
    if (!data || data.channel !== "alma-youtube" || data.token !== token) return;
    if (data.type === "ready") { lastWidth = 0; lastHeight = 0; presented = null; value.ready = true; clearTimeout(timer); }
    if (data.type === "error") { value.failed = true; value.ready = false; clearTimeout(timer); }
    if(typeof data.volume==="number" && isFinite(data.volume)) value.volume=Math.max(0,Math.min(100,data.volume));
    if(typeof data.muted==="boolean") value.muted=data.muted;
    if (typeof data.seconds === "number" && isFinite(data.seconds)) value.seconds=data.seconds;
    if (typeof data.duration === "number" && isFinite(data.duration)) value.duration=data.duration;
    if (typeof data.state === "number") {
      value.state = data.state;
      if(data.state===0){
        if(data.type==="progress")endReports++;
        value.finished=endReports>=2||(value.duration>0&&value.seconds>=Math.max(value.duration-2,value.duration*0.9));
      }else{endReports=0;value.finished=false;}
      if(data.state===1){value.failed=false;}
    }
    if (typeof data.title === "string") value.title = data.title.slice(0, 160);
    if (typeof data.status === "string") value.status = data.status.slice(0, 300);
    if (typeof data.status === "string" && /(?:YT|DM)-(?:ACTIVACION|INICIO|ORDEN)/.test(data.status)) value.failed = true;
    if(value.state===1 && !audioApplied){audioApplied=true;level(chosenLevel,chosenMuted);}
    changed();
  }
  function close() {
    clearTimeout(timer);
    if (frame) { send("pause"); frame.src = "about:blank"; host.innerHTML = ""; }
    frame = null; activeProvider="";selectedVideo="";pendingVideo="";audioApplied=true; endReports=0; lastWidth = 0; lastHeight = 0; presented = null;
    if (host) host.style.display = "none";
    value = { status: "Sin vídeo", ready: false, state: -1, title: "", failed: false };
  }
  function open(node, mac, id, callback, provider, autoplay) {
    provider = provider === "dailymotion" ? "dailymotion" : "youtube";
    if (!(provider === "dailymotion" ? /^[A-Za-z0-9]{5,12}$/ : /^[A-Za-z0-9_-]{11}$/).test(id)) return;
    if(reusable(mac,provider)){
      if(autoplay!==true)send("pause");
      changed=callback;selectedVideo=id;pendingVideo=id;endReports=0;
      value={status:"Vídeo preparado. Pulsa Reproducir.",ready:true,state:-1,title:"",failed:false,seconds:0,duration:0};
      changed();return;
    }
    close();activeProvider=provider;selectedVideo=id;
    host = node; base = "http://" + mac + ":8088"; changed = callback;
    token = "";
    for (var i = 0; i < 32; i++) token += Math.floor(Math.random() * 16).toString(16);
    var origin = window.location.protocol === "file:" ? "null" : window.location.protocol + "//" + window.location.host;
    frame = document.createElement("iframe");
    frame.id = "youtube-frame"; frame.title = "Reproductor oficial de "+(provider==="dailymotion"?"Dailymotion":"YouTube");
    frame.setAttribute("allow", "autoplay; encrypted-media; fullscreen");
    frame.setAttribute("allowfullscreen", "allowfullscreen");
    frame.setAttribute("referrerpolicy", "origin");
    frame.setAttribute("frameborder", "0");
    value.status = "Conectando con el puente y el reproductor oficial de "+(provider==="dailymotion"?"Dailymotion":"YouTube")+"…";
    frame.src = base + (provider==="dailymotion"?"/dailymotion/player?video=":"/youtube/player?video=") + id + "&provider=" + provider + "&autoplay="+(provider==="dailymotion" && autoplay===true?"1":"0")+"&token=" + token + "&parent=" + encodeURIComponent(origin);
    host.style.display = "block"; host.appendChild(frame);
    timer = setTimeout(function () {
      value.failed = true;
      value.status = (provider==="dailymotion"?"Dailymotion":"YouTube")+" no respondió. Comprueba el puente actualizado y la conexión. El navegador de la TV puede ser incompatible.";
      changed();
    }, 25000);
    changed();
  }
  function init() { window.addEventListener("message", receive, false); }
  function destroy() { close(); window.removeEventListener("message", receive, false); }
  return { reusable:reusable, level: level, init: init, destroy: destroy, parseUrl: parseUrl, parseLink: parseLink, open: open, close: close, send: send, present: present, resize: resize, snapshot: snapshot };
})();
