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
  function change() {
    notify();
  }
  function init(a, v, callback) {
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
          status = "Reproduciendo";
          error = "";
          change();
        }
      });
      on("pause", function () {
        if (node === active && status !== "Detenido") {
          status = "En pausa";
          change();
        }
      });
      on("waiting", function () {
        if (node === active) {
          status = "Cargando…";
          change();
        }
      });
      on("loadedmetadata", change);
      on("durationchange", change);
      on("timeupdate", change);
      on("volumechange", change);
      on("ended", function () {
        if (node !== active) return;
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
    tracks = list.slice(0, 31);
    if (index >= tracks.length) stop();
    change();
  }
  function snapshot() {
    return {
      tracks: tracks.slice(),
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
      volume: active ? active.volume : 0.7
    };
  }
  function cancelSeek() { clearTimeout(seekTimer); seekTarget = null; }
  function play(number) {
    cancelSeek();
    if (!tracks.length) {
      status = "Lista vacía";
      change();
      return;
    }
    if (typeof number !== "number") number = index >= 0 ? index : 0;
    number = Math.max(0, Math.min(tracks.length - 1, number));
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
    if (index !== number || active !== next) {
      if (active) active.pause();
      active = next;
      index = number;
      active.src = tracks[number].url;
      try {
        active.volume = 0.7;
      } catch (volumeError) {}
      active.load();
    }
    status = "Cargando…";
    error = "";
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
    if (active && !active.paused) {
      active.pause();
    } else play();
  }
  function pause() {
    if (active) active.pause();
  }
  function stop() {
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
  function step(delta) {
    if (!tracks.length) return;
    play(
      Math.max(0, Math.min(tracks.length - 1, (index < 0 ? 0 : index) + delta))
    );
  }
  function seek(delta) {
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
  function volume(delta) {
    if (!active) return;
    try {
      active.volume = Math.max(0, Math.min(1, active.volume + delta));
      change();
    } catch (e) {
      error = "Ajusta el volumen con el control del televisor.";
      change();
    }
  }
  function destroy() {
    cancelSeek();
    if (active) active.pause();
    for (var i = 0; i < listeners.length; i++)
      listeners[i][0].removeEventListener(
        listeners[i][1],
        listeners[i][2],
        false
      );
    listeners = [], seekTimer = null, seekTarget = null;
  }
  return {
    init: init,
    setTracks: setTracks,
    snapshot: snapshot,
    play: play,
    toggle: toggle,
    pause: pause,
    stop: stop,
    step: step,
    seek: seek,
    volume: volume,
    destroy: destroy
  };
})();
