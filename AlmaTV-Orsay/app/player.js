/* Reproductor ES5. Solo archivos propios o enlaces directos sin DRM. */
var AlmaPlayer = (function () {
  "use strict";
  var audio = null,
    video = null,
    active = null,
    tracks = [],
    index = -1,
    status = "Detenido",
    error = "",
    notify = function () {},
    listeners = [], seekTimer = null, seekTarget = null;
  var activeUrl = "", positions = [], lastHistoryWrite = 0, pendingResume = null, stopped = false;
  var chosenLevel = 0.7, chosenMuted = false, nativeMode=false, liveDeadline=null;
  var historyKey = "alma.media.positions.v1";
  var liveFormats={}, formatKey="alma.live.formats.v1";
  try { liveFormats=JSON.parse(localStorage.getItem(formatKey)||"{}"); if(!liveFormats||typeof liveFormats!=="object"||Object.prototype.toString.call(liveFormats)==="[object Array]")liveFormats={}; } catch(ignoreFormats){liveFormats={};}
  function liveFormat(){var track=tracks[index],key=track&&(track.id||track.url);return track&&track.live&&/^(stretch|zoom)$/.test(liveFormats[key])&&!(nativeMode&&liveFormats[key]==="zoom")?liveFormats[key]:"original";}
  function setLiveFormat(value){
    if(index<0||!tracks[index]||!tracks[index].live||!/^(original|stretch|zoom)$/.test(value))return false;
    if(nativeMode&&value==="zoom")return false;
    liveFormats[tracks[index].id||tracks[index].url]=value;
    try{localStorage.setItem(formatKey,JSON.stringify(liveFormats));}catch(ignoreSaveFormat){}
    change();return true;
  }

  function identity(url) {
    var match = String(url || "").match(/\/(?:media|hub)\/file\/([a-f0-9]{16,24})(?:[?#]|$)/i);
    return match ? "mac:" + match[1].toLowerCase() : String(url || "");
  }
  function loadPositions() {
    try {
      var data = JSON.parse(localStorage.getItem(historyKey) || "[]");
      if (Object.prototype.toString.call(data) === "[object Array]") positions = data.filter(function (entry) {
        return entry && typeof entry.url === "string" && entry.url.length <= 2048 && typeof entry.time === "number" && isFinite(entry.time) && entry.time >= 0 && typeof entry.updated === "number" && isFinite(entry.updated);
      }).slice(0, 100);
    } catch (e) { positions = []; }
  }
  function writePositions() { try { localStorage.setItem(historyKey, JSON.stringify(positions)); } catch (e) {} }
  function savedPosition() {
    if (index < 0 || !tracks[index]) return 0;
    var key = identity(tracks[index].url);
    for (var i = 0; i < positions.length; i++) if (positions[i].url === key) return positions[i].time;
    return 0;
  }
  function savePosition(force, finished) {
    if(index>=0&&tracks[index]&&tracks[index].live)return;
    if (!active || !activeUrl || stopped || pendingResume !== null) return;
    var now = new Date().getTime();
    if (!force && now - lastHistoryWrite < 5000) return;
    var seconds = active.currentTime, duration = active.duration;
    if (typeof seconds !== "number" || !isFinite(seconds) || !isFinite(duration) || duration <= 0) return;
    lastHistoryWrite = now;
    var key = identity(activeUrl);
    positions = positions.filter(function (entry) { return entry.url !== key; });
    if (!finished && seconds >= 0.5 && seconds < duration - Math.min(5, duration * 0.02)) positions.unshift({ url: key, time: seconds, updated: now });
    positions = positions.slice(0, 100);
    writePositions();
  }
  function restorePosition() {
    if (!active || pendingResume === null || !isFinite(active.duration) || active.duration <= 0) return;
    var value = pendingResume;
    if (value >= active.duration - Math.min(5, active.duration * 0.02)) value = 0;
    try { active.currentTime = value; pendingResume = null; }
    catch (e) {} // Retry on canplay on engines that reject seeking during metadata.
  }
  function change() {
    notify();
  }
  function init(a, v, callback) {
    loadPositions();
    audio = a;
    video = v;
    notify = callback || function () {};
    [audio, video].forEach(function (node) {
      function on(name, fn) {
        node.addEventListener(name, fn, false);
        listeners.push([node, name, fn]);
      }
      on("playing", function () {
        if (node === active) {
          clearTimeout(liveDeadline);
          status = "Reproduciendo";
          error = "";
          change();
        }
      });
      on("pause", function () {
        if (node === active && status !== "Detenido" && status !== "No disponible") {
          status = "En pausa";
          savePosition(true);
          change();
        }
      });
      on("waiting", function () {
        if (node === active) {
          status = "Cargando…";
          change();
        }
      });
      on("loadedmetadata", function () { if (node === active) restorePosition(); change(); });
      on("canplay", function () { if (node === active) restorePosition(); });
      on("durationchange", change);
      on("timeupdate", function () { if (node === active) savePosition(false); change(); });
      on("volumechange", change);
      on("ended", function () {
        if (node !== active) return;
        savePosition(true, true);
        if (index + 1 < tracks.length) play(index + 1);
        else {
          status = "Finalizado";
          change();
        }
      });
      on("error", function () {
        if (node === active) {
          status = "No disponible";
          error =
            "No se pudo reproducir. Comprueba el formato, el archivo y la conexión.";
          change();
        }
      });
    });
  }
  function setTracks(list) {
    if(nativeMode){nativeMode=false;AlmaNativeLive.stop();}
    clearTimeout(liveDeadline);
    tracks = list.slice(0, 31);
    if (index >= tracks.length) stop();
    change();
  }
  function snapshot() {
    if(nativeMode){var n=AlmaNativeLive.snapshot();return {tracks:tracks.slice(),index:index,title:tracks[index]?tracks[index].name:"TV en vivo",kind:"video",live:true,native:true,status:n.status,error:n.error,playing:n.playing,time:n.time,duration:0,volume:chosenLevel,muted:chosenMuted};}
    return {
      tracks: tracks.slice(),
      live: index>=0&&tracks[index]&&tracks[index].live===true,
      index: index,
      title:
        index >= 0 && tracks[index]
          ? tracks[index].name
          : "Elige una canción o un video",
      kind: index >= 0 && tracks[index] ? tracks[index].kind : "audio",
      status: status,
      error: error,
      playing: !!active && !active.paused && !active.ended,
      time: active && isFinite(active.currentTime) ? active.currentTime : 0,
      duration: active && isFinite(active.duration) ? active.duration : 0,
      volume: active ? active.volume : chosenLevel, muted: active ? active.muted : chosenMuted
    };
  }
  function cancelSeek() { clearTimeout(seekTimer); seekTarget = null; }
  function play(number) {
    clearTimeout(liveDeadline);cancelSeek();
    if (!tracks.length) {
      status = "Lista vacía";
      change();
      return;
    }
    if (typeof number !== "number") number = index >= 0 ? index : 0;
    number = Math.max(0, Math.min(tracks.length - 1, number));
    if(tracks[number].live&&/\.m3u8(?:[?#]|$)/i.test(tracks[number].url)){
      savePosition(true);if(active){active.pause();active.removeAttribute("src");active.load();}active=null;index=number;activeUrl=tracks[number].url;pendingResume=null;nativeMode=true;
      var opened=AlmaNativeLive.start(activeUrl,change);
      if(opened||!video||!video.canPlayType||( !video.canPlayType("application/vnd.apple.mpegurl")&&!video.canPlayType("application/x-mpegURL")))return;
      // Use HTML5 only when this firmware explicitly declares HLS support.
      nativeMode=false;AlmaNativeLive.stop();index=-1;activeUrl="";
    }
    if(nativeMode){nativeMode=false;AlmaNativeLive.stop();}
    var next = tracks[number].kind === "video" ? video : audio;
    if (
      !next ||
      typeof next.play !== "function" ||
      typeof next.pause !== "function" ||
      typeof next.load !== "function"
    ) {
      status = "No disponible";
      error =
        "El firmware no ofrece este reproductor multimedia. Usa una aplicación compatible o la consola conectada al televisor.";
      change();
      return;
    }
    if (index !== number || active !== next || activeUrl !== tracks[number].url) {
      savePosition(true);
      if (active) active.pause();
      active = next;
      index = number;
      activeUrl = tracks[number].url;
      pendingResume = tracks[number].live ? null : (savedPosition() || null); stopped = false;
      active.src = tracks[number].url;
      try {
        active.volume = chosenLevel; active.muted = chosenMuted;
      } catch (volumeError) {}
      active.load();
    } else if (stopped) {
      pendingResume = tracks[number].live ? null : (savedPosition() || null); stopped = false; restorePosition();
    }
    status = "Cargando…";
    error = "";
    if(tracks[index].live){var loadingUrl=activeUrl;liveDeadline=setTimeout(function(){if(activeUrl!==loadingUrl||status!=="Cargando…")return;status="No disponible";error="La señal HLS no respondió en 60 segundos. Este firmware puede no admitir su formato o TLS; prueba otro canal.";if(active)active.pause();change();},60000);}
    change();
    try {
      var promise = active.play();
      if (promise && typeof promise["catch"] === "function")
        promise["catch"](function (reason) {
          if (reason && reason.name === "AbortError") {
            status = "En pausa";
            change();
            return;
          }
          status = "No disponible";
          error =
            "El televisor no pudo iniciar este archivo. Prueba un MP3 o un MP4 compatible.";
          change();
        });
    } catch (e) {
      status = "No disponible";
      error =
        "Este formato no está disponible en el reproductor del televisor.";
      change();
    }
  }
  function toggle() {
    if(nativeMode){if(AlmaNativeLive.snapshot().playing)pause();else play(index);return;}
    if (active && !active.paused) {
      active.pause();
    } else play();
  }
  function pause() {
    clearTimeout(liveDeadline);
    if(nativeMode){nativeMode=false;status="En pausa";error="";AlmaNativeLive.stop(true);change();return;}
    savePosition(true);
    if (active) active.pause();
  }
  function stop() {
    clearTimeout(liveDeadline);
    if(nativeMode){nativeMode=false;status="Detenido";error="";AlmaNativeLive.stop(false);change();return;}
    savePosition(true);
    stopped = true;
    cancelSeek();
    if (active) {
      active.pause();
      try {
        active.currentTime = 0;
      } catch (e) {}
    }
    status = "Detenido";
    error = "";
    change();
  }
  function restart() {
    if(nativeMode){play(index);return;}
    if (!active || index < 0 || !tracks[index]) return;
    var key = identity(activeUrl);
    positions = positions.filter(function (entry) { return entry.url !== key; }); writePositions();
    pendingResume = null; stopped = false; cancelSeek();
    try { active.currentTime = 0; } catch (e) {}
    play(index);
  }
  function step(delta) {
    if (!tracks.length) return;
    play(
      Math.max(0, Math.min(tracks.length - 1, (index < 0 ? 0 : index) + delta))
    );
  }
  function seek(delta) {
    if(index>=0&&tracks[index]&&tracks[index].live){error="La señal en vivo no admite saltos.";change();return;}
    if (!active || !isFinite(active.duration) || active.duration <= 0) return;
    var node = active;
    seekTarget = Math.max(0, Math.min(active.duration - 0.1, (seekTarget === null ? active.currentTime : seekTarget) + delta));
    clearTimeout(seekTimer);
    seekTimer = setTimeout(function () {
      var target = seekTarget; seekTarget = null;
      if (node !== active) return;
      try { active.currentTime = target; change(); }
      catch (e) { error = "Este archivo no permite adelantar ni retroceder."; change(); }
    }, 180);
  }
  function setLevel(level, muted, passive) {
    chosenLevel = Math.max(0, Math.min(1, Number(level) || 0)); chosenMuted = muted === true;
    if(passive===true)return;
    if(nativeMode){notify();return;}
    try { if (active) { active.volume = chosenLevel; active.muted = chosenMuted; } }
    catch (e) { error = "Este reproductor no permite regular su audio desde la app."; }
    change();
  }
  function volume(delta) { setLevel(chosenLevel + delta, false); }
  function destroy() {
    clearTimeout(liveDeadline);AlmaNativeLive.destroy();
    savePosition(true);
    cancelSeek();
    if (active) active.pause();
    for (var i = 0; i < listeners.length; i++)
      listeners[i][0].removeEventListener(
        listeners[i][1],
        listeners[i][2],
        false
      );
    listeners = [];
  }
  return {
    init: init,
    setTracks: setTracks,
    liveFormat: liveFormat, setLiveFormat: setLiveFormat,
    snapshot: snapshot,
    play: play,
    toggle: toggle,
    pause: pause,
    stop: stop,
    restart: restart,
    step: step,
    seek: seek,
    volume: volume, setLevel: setLevel,
    destroy: destroy
  };
})();
