/* Alma TV Orsay: ES5, no libraries, no remote assets. */
var Alma = (function () {
  "use strict";
  var A = {},
    api = null,
    rows = [],
    actions = {},
    stack = [],
    modal = null;
  var state = { view: "home", row: 0, col: 0 },
    defaults = {
      tvIp: "192.168.1.249",
      macIp: "192.168.1.30",
      bridge: false,
      relay: false,
      scale: 90,
      x: 0,
      y: 0,
      animations: true,
      saverFrame: true,
      city: "Tuxtla Gutiérrez, Chiapas, México",
      links: [],
      media: []
    };
  var prefs = {},
    interval = null,
    toastTimer = null,
    requests = [],
    generation = 0,
    pending = false,
    focusedNode = null,
    lastRenderedView = null,
    heroIndex = 0,
    sidebarIndex = 0;
  var net = { YouTube: "Sin comprobar", Netflix: "Sin comprobar" },
    query = "",
    edit = null,
    cal = null;
  var month = new Date(),
    timer = {
      duration: 600000,
      left: 600000,
      end: 0,
      running: false,
      finished: false
    };
  var weather = {
    text: "Sin datos",
    detail: "Configura una ciudad y el puente local opcional.",
    icon: "cloud",
    observed: "",
    updated: 0
  };
  var apps = [
    {
      id: "netflix",
      name: "Netflix",
      detail: "Aplicación del televisor",
      dial: "Netflix",
      mark: "N"
    },
    {
      id: "youtube",
      name: "YouTube",
      detail: "Aplicación del televisor",
      dial: "YouTube",
      mark: "▶"
    },
    {
      id: "prime",
      name: "Prime Video",
      detail: "Sin app nativa en tu TV",
      mark: "prime video"
    },
    {
      id: "disney",
      name: "Disney+",
      detail: "Sin soporte nativo en este modelo",
      mark: "Disney+"
    },
    {
      id: "apple",
      name: "Apple TV",
      detail: "Sin integración nativa confirmada",
      mark: "tv"
    },
    {
      id: "max",
      name: "Max",
      detail: "Sin integración nativa confirmada",
      mark: "max"
    },
    {
      id: "xbox",
      name: "Xbox",
      detail: "Consola conectada a HDMI 2",
      mark: "Xbox"
    },
    {
      id: "browser",
      name: "Navegador",
      detail: "Navegador original Samsung",
      mark: "◎"
    },
    {
      id: "more",
      name: "Más aplicaciones",
      detail: "Ver aplicaciones compatibles",
      mark: "▦"
    }
  ];
  for (var brandIndex = 0; brandIndex < apps.length; brandIndex++) {
    if (
      /^(netflix|youtube|prime|disney|apple|max|xbox)$/.test(
        apps[brandIndex].id
      )
    )
      apps[brandIndex].logo = "assets/logos/" + apps[brandIndex].id + ".png";
  }
  var tools = [
    { id: "clock", name: "Reloj", detail: "Hora y fecha del dispositivo" },
    {
      id: "timer",
      name: "Temporizador",
      detail: "Iniciar, pausar y reiniciar"
    },
    { id: "calendar", name: "Calendario", detail: "Explorar meses" },
    { id: "saver", name: "Salvapantallas", detail: "Reloj en movimiento" },
    {
      id: "network",
      name: "Diagnóstico",
      detail: "Conexión de las aplicaciones"
    },
    { id: "weather", name: "Clima", detail: "Datos reales · puente opcional" }
  ];
  function el(id) {
    return document.getElementById(id);
  }
  function htmlIfChanged(node, value) {
    if (node && node._almaHTML !== value) {
      node.innerHTML = value;
      node._almaHTML = value;
    }
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function copy(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }
  function pad(n) {
    return ("0" + n).slice(-2);
  }
  function time() {
    var d = new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function date() {
    var d = new Date();
    return (
      [
        "domingo",
        "lunes",
        "martes",
        "miércoles",
        "jueves",
        "viernes",
        "sábado"
      ][d.getDay()] +
      ", " +
      d.getDate() +
      " de " +
      [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre"
      ][d.getMonth()]
    );
  }
  function ip(s) {
    var p = String(s).split("."),
      i;
    if (p.length !== 4) return false;
    for (i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(p[i]) || Number(p[i]) > 255) return false;
    }
    return true;
  }
  function privateIp(s) {
    if (!ip(s)) return false;
    var p = s.split(".");
    return (
      p[0] === "10" ||
      (p[0] === "192" && p[1] === "168") ||
      (p[0] === "172" && Number(p[1]) >= 16 && Number(p[1]) <= 31)
    );
  }
  function validUrl(s) {
    return /^https?:\/\/[^\s<>"']+$/i.test(s) && s.length < 1000;
  }
  function load() {
    prefs = copy(defaults);
    try {
      var p = JSON.parse(localStorage.getItem("alma.orsay.v7") || "null"),
        k;
      if (p) {
        for (k in defaults) {
          if (defaults.hasOwnProperty(k) && p.hasOwnProperty(k))
            prefs[k] = p[k];
        }
      }
    } catch (e) {}
    if (!privateIp(prefs.tvIp)) prefs.tvIp = defaults.tvIp;
    if (!privateIp(prefs.macIp)) prefs.macIp = defaults.macIp;
    prefs.scale = clamp(Number(prefs.scale) || 90, 76, 100);
    prefs.x = clamp(Number(prefs.x) || 0, -40, 40);
    prefs.y = clamp(Number(prefs.y) || 0, -30, 30);
    prefs.city = String(prefs.city || "").slice(0, 80);
    prefs.bridge = prefs.bridge === true;
    prefs.relay = prefs.relay === true;
    prefs.animations = prefs.animations !== false;
    prefs.saverFrame = prefs.saverFrame !== false;
    if (Object.prototype.toString.call(prefs.links) !== "[object Array]")
      prefs.links = [];
    prefs.links = prefs.links.slice(0, 12).filter(function (l) {
      return l && validUrl(l.url) && typeof l.name === "string";
    });
    if (Object.prototype.toString.call(prefs.media) !== "[object Array]")
      prefs.media = [];
    prefs.media = prefs.media.slice(0, 30).filter(function (t) {
      return (
        t &&
        typeof t.name === "string" &&
        validUrl(t.url) &&
        (t.kind === "audio" || t.kind === "video")
      );
    });
  }
  function mediaTracks() {
    return [
      {
        name: "Prueba de sonido · composición original",
        url: "assets/media/prueba-sonido.mp3",
        kind: "audio"
      }
    ].concat(prefs.media || []);
  }
  function save() {
    try {
      localStorage.setItem("alma.orsay.v7", JSON.stringify(prefs));
      return true;
    } catch (e) {
      notice(
        "No se pudieron guardar los ajustes. Revisa el espacio disponible."
      );
      return false;
    }
  }
  function apply() {
    var v =
      "translate(" +
      prefs.x +
      "px," +
      prefs.y +
      "px) scale(" +
      prefs.scale / 100 +
      ")";
    el("safe").style.webkitTransform = v;
    el("safe").style.transform = v;
    el("safe").className = prefs.animations ? "" : "reduced";
    fitScreen();
  }
  function fitScreen() {
    var width =
      window.innerWidth || document.documentElement.clientWidth || 1280;
    var height =
      window.innerHeight || document.documentElement.clientHeight || 720;
    var transform = "scale(" + width / 1280 + "," + height / 720 + ")";
    el("stage").style.webkitTransform = transform;
    el("stage").style.transform = transform;
  }
  function syncBackgrounds() {
    var saver = state.view === "saver",
      media =
        typeof AlmaMedia !== "undefined" &&
        /^assets\/salvapantallas\.(jpg|png)$/.test(AlmaMedia.saver);
    el("stage").setAttribute("data-view", state.view);
    el("stage").setAttribute(
      "data-saver-frame",
      prefs.saverFrame ? "true" : "false"
    );
    el("wallpaper").style.display = state.view === "home" ? "block" : "none";
    el("wallpaper-shade").style.display =
      state.view === "home" ? "block" : "none";
    el("saver-wallpaper").style.display =
      saver && !prefs.saverFrame ? "block" : "none";
    if (media) {
      el("wallpaper").style.backgroundImage = "url(" + AlmaMedia.saver + ")";
      el("saver-wallpaper").style.backgroundImage =
        "url(" + AlmaMedia.saver + ")";
    }
  }
  var confirmSequence = 0;
  function confirmAction(fn) {
    var node = el(focusedId());
    if (node) {
      node.className = node.className.replace(/\s*press-[ab]\b/g, "");
      node.className += " press-" + (confirmSequence++ % 2 ? "a" : "b");
    }
    fn();
  }
  function notice(s) {
    el("toast").innerHTML = esc(s);
    el("toast").style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el("toast").style.display = "none";
    }, 4500);
  }
  function button(id, title, small, fn, cls) {
    actions[id] = fn;
    return (
      '<button type="button" id="' +
      id +
      '" class="' +
      (cls || "card") +
      '" data-focus="' +
      id +
      '"><strong>' +
      esc(title) +
      "</strong>" +
      (small ? "<small>" + esc(small) + "</small>" : "") +
      "</button>"
    );
  }
  function pill(id, label, fn) {
    actions[id] = fn;
    return (
      '<button type="button" id="' +
      id +
      '" class="pill" data-focus="' +
      id +
      '">' +
      esc(label) +
      "</button>"
    );
  }
  function row(ids) {
    rows.push(ids);
  }
  function head(label, title, desc) {
    return (
      '<div class="page-head"><div class="eyebrow">' +
      esc(label) +
      "</div><h1>" +
      esc(title) +
      "</h1><p>" +
      esc(desc) +
      "</p></div>"
    );
  }
  var navViews = [
    "home",
    "search",
    "apps",
    "media",
    "hub",
    "clock",
    "weather",
    "calendar",
    "timer",
    "settings"
  ];
  function nav() {
    var names = [
        "Inicio",
        "Buscar",
        "Aplicaciones",
        "Multimedia",
        "Smart Hub",
        "Reloj",
        "Clima",
        "Calendario",
        "Temporizador",
        "Ajustes"
      ],
      icons = [
        "home",
        "search",
        "apps",
        "apps",
        "hub",
        "clock",
        "weather",
        "calendar",
        "timer",
        "settings"
      ],
      h = "",
      ids = [];
    for (var i = 0; i < names.length; i++) {
      (function (i) {
        var id = "nav-" + i;
        ids.push(id);
        actions[id] = function () {
          sidebarIndex = i;
          if (navViews[i] === "hub") {
            exit();
            return;
          }
          go(navViews[i]);
        };
        h +=
          '<button id="' +
          id +
          '" data-focus="' +
          id +
          '" class="nav' +
          (state.view === navViews[i] ? " active" : "") +
          '"><span class="nav-icon icon-' +
          icons[i] +
          '"></span>' +
          names[i] +
          "</button>";
      })(i);
    }
    el("nav").innerHTML = h;
    row(ids);
  }
  function appCard(a, i, large) {
    var id = "app-" + i;
    actions[id] = function () {
      launch(a);
    };
    var detail =
      a.dial && net[a.dial] !== "Sin comprobar" ? net[a.dial] : a.detail;
    return (
      '<button type="button" id="' +
      id +
      '" data-focus="' +
      id +
      '" class="card app ' +
      a.id +
      '">' +
      (/^(prime|disney|apple|max)$/.test(a.id)
        ? '<span class="app-note">' +
          (/^(prime|disney)$/.test(a.id) ? "No compatible" : "Sin comprobar") +
          "</span>"
        : a.id === "xbox"
          ? '<span class="app-note">HDMI 2</span>'
          : "") +
      '<span class="app-mark">' +
      (a.logo
        ? '<img class="brand-logo" src="' + a.logo + '" alt="">'
        : esc(a.mark)) +
      "</span><strong>" +
      esc(a.name) +
      "</strong><small>" +
      esc(detail) +
      "</small></button>"
    );
  }
  function updateHero(index) {
    heroIndex = index;
    var messages = [
        [
          "NETFLIX",
          "Ve WWE Raw on Netflix",
          "Disfruta de WWE Raw desde la aplicación de Netflix.",
          "Abrir Netflix"
        ],
        [
          "YOUTUBE",
          "¡Bienvenido, IWC!",
          "Continúa viendo tus videos favoritos.",
          "Abrir YouTube"
        ],
        [
          "PRIME VIDEO",
          "La Última Palabra",
          "Disfrútalo solo por Fox con tu suscripción.",
          "Ver opciones de Prime Video"
        ],
        [
          "DISNEY+",
          "Un mundo de historias",
          "Descubre aventuras, personajes y mundos en Disney+.",
          "Ver opciones de Disney+"
        ],
        [
          "APPLE TV",
          "Historias que te acompañan",
          "Consulta las opciones de Apple TV en un dispositivo compatible.",
          "Ver opciones de Apple TV"
        ],
        [
          "MAX",
          "Grandes historias, a tu manera",
          "Descubre las opciones de Max en un dispositivo compatible.",
          "Ver opciones de Max"
        ],
        [
          "XBOX · HDMI 2",
          "Tu próxima partida empieza aquí",
          "Enciende tu consola y elige tu próxima aventura.",
          "Cambiar a HDMI 2"
        ],
        [
          "NAVEGADOR",
          "Tus sitios favoritos, más cerca",
          "Abre el navegador del televisor.",
          "Abrir el navegador"
        ],
        [
          "APLICACIONES",
          "Más formas de disfrutar",
          "Revisa los accesos y la compatibilidad de tus aplicaciones.",
          "Ver aplicaciones"
        ]
      ],
      message = messages[index] || messages[0];
    htmlIfChanged(el("hero-label"), esc(message[0]));
    htmlIfChanged(el("hero-title"), esc(message[1]));
    htmlIfChanged(el("hero-copy"), esc(message[2]));
    htmlIfChanged(el("hero-cta"), esc(message[3]));
    actions["hero-cta"] = function () {
      launch(apps[heroIndex]);
    };
  }
  function home() {
    var h =
      '<section class="hero"><div class="eyebrow" id="hero-label"></div><h1 id="hero-title"></h1><p id="hero-copy"></p>' +
      pill("hero-cta", "Abrir Netflix", function () {
        launch(apps[heroIndex]);
      }) +
      '<span class="hero-credit">Mensajes personalizados · disponibilidad según el servicio</span></section>';
    row(["hero-cta"]);
    h +=
      '<section class="home-apps"><h2 class="section-title">Aplicaciones <span>Pulsa Aceptar para abrir</span></h2><div class="app-carousel"><div class="row app-track">';
    var ids = [],
      i;
    for (i = 0; i < apps.length; i++) {
      h += appCard(apps[i], i);
      ids.push("app-" + i);
    }
    row(ids);
    h +=
      '</div></div></section><section class="home-links"><h2 class="section-title">Tus accesos guardados</h2><div class="row">';
    ids = [];
    if (prefs.links.length) {
      for (i = 0; i < Math.min(4, prefs.links.length); i++) {
        (function (i) {
          h += button(
            "home-link-" + i,
            prefs.links[i].name,
            "Abrir en el navegador Samsung",
            function () {
              browser(prefs.links[i].url);
            },
            "card saved-link"
          );
          ids.push("home-link-" + i);
        })(i);
      }
    } else {
      h += button(
        "save-link",
        "Añadir un acceso personal",
        "Guarda tus sitios favoritos",
        function () {
          go("links");
        },
        "card saved-link"
      );
      ids.push("save-link");
      h +=
        '<p class="local-note">Guarda aquí tus sitios favoritos para encontrarlos fácilmente.</p>';
    }
    row(ids);
    h +=
      '</div></section><section class="home-tools"><h2 class="section-title">Herramientas</h2><div class="row">';
    ids = [];
    var order = [0, 5, 2, 4, 1, 3],
      symbols = ["◷", "◴", "▤", "▧", "⌁", "☁"];
    for (i = 0; i < order.length; i++) {
      (function (index) {
        var t = tools[index],
          v = [
            time(),
            timerText(),
            date().split(",")[0],
            "Abrir",
            net.YouTube.indexOf("Disponible") === 0
              ? "Televisor conectado"
              : "Sin comprobar",
            weather.text
          ][index];
        h += button(
          "tool-" + index,
          t.name,
          v,
          function () {
            go(t.id);
          },
          "card tool tool-" + t.id
        );
        ids.push("tool-" + index);
      })(order[i]);
    }
    row(ids);
    return h + "</div></section>";
  }
  function catalog(kind) {
    var list = kind === "apps" ? apps : tools,
      h =
        head(
          kind === "apps" ? "ENTRETENIMIENTO" : "A TU RITMO",
          kind === "apps" ? "Tus aplicaciones" : "Herramientas",
          kind === "apps"
            ? "Elige una aplicación. Algunos servicios requieren un dispositivo compatible."
            : "Funciones locales, sin cuentas ni catálogos simulados."
        ) + '<div class="grid">',
      ids = [],
      i;
    for (i = 0; i < list.length; i++) {
      (function (i) {
        var t = list[i];
        h +=
          kind === "apps"
            ? appCard(t, i, true)
            : button("tool-" + i, t.name, t.detail, function () {
                go(t.id);
              });
        ids.push((kind === "apps" ? "app-" : "tool-") + i);
      })(i);
      if (ids.length === 3) {
        row(ids);
        ids = [];
      }
    }
    if (ids.length) row(ids);
    return h + "</div>";
  }
  function settings() {
    var items = [
      [
        "calibrate",
        "Pantalla",
        "Zona segura, escala y posición",
        function () {
          cal = copy(prefs);
          go("calibrate");
        }
      ],
      [
        "tv-ip",
        "IP del televisor",
        prefs.tvIp,
        function () {
          editor("tvIp", "Dirección IP del televisor", prefs.tvIp, "ip");
        }
      ],
      [
        "mac-ip",
        "IP de la Mac",
        prefs.macIp,
        function () {
          editor("macIp", "Dirección IP de la Mac", prefs.macIp, "ip");
        }
      ],
      [
        "bridge",
        "Puente local",
        prefs.bridge ? "Activado · puerto 8088" : "Desactivado · opcional",
        function () {
          prefs.bridge = !prefs.bridge;
          weather = {
            text: "Sin datos",
            detail: "Actualiza para consultar el puente configurado."
          };
          save();
          invalidate();
          render();
        }
      ],
      [
        "relay",
        "Conexión de aplicaciones",
        prefs.relay
          ? "Mac · requiere permitir lanzamientos"
          : "Directo desde la TV",
        function () {
          prefs.relay = !prefs.relay;
          save();
          invalidate();
          render();
        }
      ],
      [
        "motion",
        "Animaciones",
        prefs.animations ? "Activadas" : "Reducidas",
        function () {
          prefs.animations = !prefs.animations;
          save();
          apply();
          render();
        }
      ],
      [
        "saver-frame",
        "Marco del salvapantallas",
        prefs.saverFrame
          ? "Blanco · solo en el salvapantallas"
          : "Sin marco · imagen a pantalla completa",
        function () {
          prefs.saverFrame = !prefs.saverFrame;
          save();
          render();
        }
      ],
      [
        "location",
        "Ciudad del clima",
        prefs.city || "Sin configurar",
        function () {
          editor("city", "Ciudad y país", prefs.city, "text");
        }
      ],
      [
        "links",
        "Mis enlaces",
        prefs.links.length + " guardados · búsqueda local",
        function () {
          go("links");
        }
      ],
      [
        "diagnostic",
        "Comprobar conexión",
        "Comprobar Netflix y YouTube",
        function () {
          go("network");
        }
      ],
      [
        "reset",
        "Restaurar Alma TV",
        "Solo preferencias de esta aplicación",
        reset
      ]
    ];
    var h =
        head(
          "PREFERENCIAS",
          "A tu medida",
          "Los ajustes no cambian Smart Hub, las aplicaciones de Samsung ni el firmware."
        ) + '<div class="grid settings">',
      ids = [];
    for (var i = 0; i < items.length; i++) {
      h += button(items[i][0], items[i][1], items[i][2], items[i][3]);
      ids.push(items[i][0]);
      if (ids.length === 3) {
        row(ids);
        ids = [];
      }
    }
    if (ids.length) row(ids);
    return h + "</div>";
  }
  function timerLeft() {
    return timer.running
      ? Math.max(0, timer.end - new Date().getTime())
      : timer.left;
  }
  function timerText() {
    var sec = Math.ceil(timerLeft() / 1000);
    return pad(Math.floor(sec / 60)) + ":" + pad(sec % 60);
  }
  function toggleTimer() {
    if (timer.running) {
      timer.left = timerLeft();
      timer.running = false;
    } else {
      if (timer.left <= 0) timer.left = timer.duration;
      timer.end = new Date().getTime() + timer.left;
      timer.running = true;
      timer.finished = false;
    }
    render();
  }
  function resetTimer() {
    timer.running = false;
    timer.left = timer.duration;
    timer.finished = false;
    render();
  }
  function adjustTimer(d) {
    timer.running = false;
    timer.duration = clamp(timer.duration + d * 60000, 60000, 120 * 60000);
    timer.left = timer.duration;
    timer.finished = false;
    render();
  }
  function timerView() {
    var h =
      head(
        "TIEMPO PARA TI",
        "Temporizador",
        "Continúa mientras navegas en Alma TV. No continúa si sales de la aplicación."
      ) +
      '<div class="panel"><div class="countdown" id="countdown">' +
      timerText() +
      '</div><div class="muted" id="timer-state">' +
      (timer.running
        ? "En marcha"
        : timer.finished
          ? "Tiempo terminado"
          : "En pausa") +
      '</div><div class="actions">' +
      pill("minus", "− 1 minuto", function () {
        adjustTimer(-1);
      }) +
      pill("start", timer.running ? "Pausar" : "Iniciar", toggleTimer) +
      pill("plus", "+ 1 minuto", function () {
        adjustTimer(1);
      }) +
      pill("reset-timer", "Reiniciar", resetTimer) +
      "</div></div>";
    row(["minus", "start", "plus", "reset-timer"]);
    return h;
  }
  function calendarView() {
    var y = month.getFullYear(),
      m = month.getMonth(),
      start = (new Date(y, m, 1).getDay() + 6) % 7,
      days = new Date(y, m + 1, 0).getDate(),
      now = new Date(),
      names = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre"
      ];
    var h =
      head(
        "CALENDARIO",
        names[m] + " " + y,
        "Explora los meses con los controles inferiores."
      ) + '<div class="panel"><table class="calendar"><thead><tr>';
    var week = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
      i;
    for (i = 0; i < 7; i++) h += "<th>" + week[i] + "</th>";
    h += "</tr></thead><tbody>";
    for (i = 0; i < 42; i++) {
      if (i % 7 === 0) h += "<tr>";
      var n = i - start + 1;
      h +=
        "<td" +
        (n === now.getDate() && m === now.getMonth() && y === now.getFullYear()
          ? ' class="today"'
          : "") +
        ">" +
        (n > 0 && n <= days ? n : "") +
        "</td>";
      if (i % 7 === 6) h += "</tr>";
    }
    h +=
      '</tbody></table><div class="actions">' +
      pill("prev-month", "← Mes anterior", function () {
        month = new Date(y, m - 1, 1);
        render();
      }) +
      pill("today", "Hoy", function () {
        month = new Date();
        render();
      }) +
      pill("next-month", "Mes siguiente →", function () {
        month = new Date(y, m + 1, 1);
        render();
      }) +
      "</div></div>";
    row(["prev-month", "today", "next-month"]);
    return h;
  }
  function networkView() {
    var h =
      head(
        "DIAGNÓSTICO LOCAL",
        "Conexión con tu TV",
        "El estado DIAL no demuestra acceso a internet ni conexión Wi-Fi del sistema."
      ) +
      '<div class="panel"><div class="diagnostic">TV: ' +
      esc(prefs.tvIp) +
      ' · puerto 8080<br>YouTube: <span id="dial-youtube">' +
      esc(net.YouTube) +
      '</span><br>Netflix: <span id="dial-netflix">' +
      esc(net.Netflix) +
      "</span><br>Ruta: " +
      (prefs.relay
        ? "puente Mac " + esc(prefs.macIp) + ":8088"
        : "directa desde la aplicación") +
      '</div><p class="muted">HTTP 0 puede indicar CORS, red bloqueada o TV inaccesible. No se interpreta como falta de internet.</p><div class="actions">' +
      pill("check-network", "Comprobar ahora", checkNetwork) +
      pill("edit-tv", "Cambiar IP de TV", function () {
        editor("tvIp", "Dirección IP del televisor", prefs.tvIp, "ip");
      }) +
      "</div></div>";
    row(["check-network", "edit-tv"]);
    return h;
  }
  function calibration() {
    var h =
      '<div class="calibration">' +
      head(
        "PANTALLA",
        "Encuentra tus bordes",
        "Este marco, los modales y todas las vistas comparten la misma transformación."
      ) +
      '<p class="muted">Arriba/abajo: elegir ajuste · Izq/der: cambiar · Aceptar: presets.<br>Verde: guardar · Volver: cancelar · Amarillo: ajustes</p><button class="pill" id="cal-adjust" data-focus="cal-adjust"><span class="cal-value" id="cal-value"></span></button><p class="help">Escala entre 76–100 %. 90 % inicial protege del overscan.<br>Los presets reservan 3 %, 5 % u 8 % por cada borde.</p>' +
      pill("safe3", "3 %", function () {
        prefs.scale = 94;
        apply();
        updateCal();
      }) +
      " " +
      pill("safe5", "5 %", function () {
        prefs.scale = 90;
        apply();
        updateCal();
      }) +
      " " +
      pill("safe8", "8 %", function () {
        prefs.scale = 84;
        apply();
        updateCal();
      }) +
      " " +
      pill("save-cal", "Guardar", saveCalibration) +
      "</div>";
    row(["cal-adjust"]);
    row(["safe3", "safe5", "safe8", "save-cal"]);
    return h;
  }
  var calAxis = 0;
  function updateCal() {
    if (el("cal-value"))
      el("cal-value").innerHTML = [
        "Escala: " + prefs.scale + " %",
        "Posición X: " + prefs.x + " px",
        "Posición Y: " + prefs.y + " px"
      ][calAxis];
  }
  function saveCalibration() {
    if (save()) {
      cal = null;
      back();
      notice("Calibración guardada");
    }
  }
  function weatherView() {
    var h =
      head(
        "CLIMA",
        prefs.city || "Tu ciudad",
        "Open-Meteo · datos reales a través del puente opcional en tu Mac."
      ) +
      '<div class="panel"><h2 id="weather-value">' +
      esc(weather.text) +
      '</h2><p id="weather-detail" class="muted">' +
      esc(weather.detail) +
      '</p><p class="muted">La Mac debe permanecer encendida. No se consulta tu ubicación automáticamente.</p><div class="actions">' +
      pill("refresh-weather", "Actualizar", getWeather) +
      pill("city-weather", "Configurar ciudad", function () {
        editor("city", "Ciudad y país", prefs.city, "text");
      }) +
      "</div></div>";
    row(["refresh-weather", "city-weather"]);
    return h;
  }
  function allEntries() {
    var l = [],
      i;
    for (i = 0; i < apps.length; i++)
      (function (a) {
        l.push({
          name: a.name,
          type: "Aplicación",
          open: function () {
            launch(a);
          }
        });
      })(apps[i]);
    for (i = 0; i < tools.length; i++)
      (function (t) {
        l.push({
          name: t.name,
          type: "Herramienta",
          open: function () {
            go(t.id);
          }
        });
      })(tools[i]);
    for (i = 0; i < prefs.links.length; i++)
      (function (link) {
        l.push({
          name: link.name,
          type: "Enlace personal",
          open: function () {
            browser(link.url);
          }
        });
      })(prefs.links[i]);
    l.push({
      name: "Reproductor multimedia",
      type: "Música y videos",
      open: function () {
        go("media");
      }
    });
    return l;
  }
  function normalize(s) {
    var from = "áéíóúüñ",
      to = "aeiouun",
      t = String(s).toLowerCase(),
      i;
    for (i = 0; i < from.length; i++)
      t = t.split(from.charAt(i)).join(to.charAt(i));
    return t;
  }
  function search() {
    var h =
      head(
        "SOLO LO TUYO",
        "Encuentra tu próximo paso",
        "Busca aplicaciones, herramientas y enlaces guardados."
      ) +
      '<div class="search-layout">' +
      pill("search-edit", query || "Escribir búsqueda…", function () {
        editor("query", "Buscar en Alma TV", query, "text");
      });
    row(["search-edit"]);
    h += '<div class="results">';
    var entries = allEntries(),
      ids = [],
      n = 0;
    for (var i = 0; i < entries.length; i++) {
      if (
        !query ||
        normalize(entries[i].name).indexOf(normalize(query)) !== -1
      ) {
        (function (e, n) {
          h += button("result-" + n, e.name, e.type, e.open);
          ids.push("result-" + n);
        })(entries[i], n++);
        if (ids.length === 4) {
          row(ids);
          ids = [];
        }
      }
    }
    if (ids.length) row(ids);
    if (!n)
      h += '<div class="empty">Sin resultados para «' + esc(query) + "».</div>";
    return h + "</div></div>";
  }
  function linksView() {
    var h =
      head(
        "CONTENIDO LOCAL",
        "Mis enlaces",
        "Hasta 12 enlaces propios. Se abren en el navegador Samsung, cuya compatibilidad puede ser limitada."
      ) +
      pill("add-link", "Añadir enlace", function () {
        if (prefs.links.length >= 12) {
          notice("Límite de 12 enlaces");
          return;
        }
        editor("linkName", "Nombre del enlace", "", "text");
      });
    row(["add-link"]);
    h += '<div class="grid results">';
    for (var i = 0; i < prefs.links.length; i++) {
      (function (i) {
        h += button(
          "link-" + i,
          prefs.links[i].name,
          "Abrir enlace",
          function () {
            browser(prefs.links[i].url);
          }
        );
        h += pill("remove-" + i, "Eliminar", function () {
          prefs.links.splice(i, 1);
          save();
          render();
        });
        row(["link-" + i, "remove-" + i]);
      })(i);
    }
    return h + "</div>";
  }
  function mediaClock(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    return pad(Math.floor(seconds / 60)) + ":" + pad(seconds % 60);
  }
  function updatePlayer() {
    if (typeof AlmaPlayer === "undefined") return;
    var player = AlmaPlayer.snapshot();
    var playing = player.playing ? "true" : "false";
    if (el("safe").getAttribute("data-playing") !== playing)
      el("safe").setAttribute("data-playing", playing);
    htmlIfChanged(el("media-title"), esc(player.title));
    htmlIfChanged(el("media-state"), esc(player.error || player.status));
    htmlIfChanged(
      el("media-time"),
      mediaClock(player.time) + " / " + mediaClock(player.duration)
    );
    htmlIfChanged(el("media-play"), player.playing ? "Pausar" : "Reproducir");
    htmlIfChanged(
      el("media-volume"),
      "Volumen: " + Math.round(player.volume * 100) + " %"
    );
    if (state.view !== "media" && player.kind === "video" && player.playing)
      AlmaPlayer.pause();
    el("media-video").style.display =
      state.view === "media" && player.kind === "video" && player.index >= 0
        ? "block"
        : "none";
    if (el("media-progress"))
      el("media-progress").style.width =
        (player.duration ? (player.time / player.duration) * 100 : 0) + "%";
  }
  function loadMacMedia() {
    var base = "http://" + prefs.macIp + ":8088";
    request("GET", base + "/media/library", function (code, body) {
      try {
        var data = JSON.parse(body);
        if (code !== 200 || !data.enabled || !data.items) throw new Error();
        var retained = prefs.media.filter(function (t) {
            return t.url.indexOf("/media/file/") === -1;
          }),
          added = [];
        for (
          var i = 0;
          i < data.items.length && retained.length + added.length < 30;
          i++
        ) {
          var file = data.items[i];
          if (/^[a-f0-9]{16}$/.test(file.id))
            added.push({
              name: String(file.name).slice(0, 80),
              url: base + "/media/file/" + file.id,
              kind: file.kind === "video" ? "video" : "audio"
            });
        }
        prefs.media = retained.concat(added);
        save();
        AlmaPlayer.setTracks(mediaTracks());
        render();
        notice(
          added.length
            ? "Archivos de la Mac añadidos a tu lista."
            : "La carpeta de la Mac no contiene archivos compatibles."
        );
      } catch (e) {
        notice(
          "No se pudo leer la carpeta de la Mac. Inicia el puente con --media-dir y comprueba su dirección IP."
        );
      }
    });
  }
  function mediaView() {
    var player = AlmaPlayer.snapshot();
    var h =
      head(
        "MÚSICA Y VÍDEOS",
        "Tu reproductor",
        "Archivos propios o enlaces directos. YouTube se abre en su aplicación; no se reproduce el catálogo de Spotify."
      ) +
      '<div class="media-stage"><div class="media-symbol"><span class="media-eq"><b></b><b></b><b></b></span></div><h2 id="media-title">' +
      esc(player.title) +
      '</h2><p id="media-state">' +
      esc(player.error || player.status) +
      '</p><div class="media-track"><span id="media-progress"></span></div><div id="media-time">' +
      mediaClock(player.time) +
      " / " +
      mediaClock(player.duration) +
      '</div></div><div class="media-controls">';
    h +=
      pill("media-prev", "Anterior", function () {
        AlmaPlayer.step(-1);
      }) +
      pill(
        "media-play",
        player.playing ? "Pausar" : "Reproducir",
        AlmaPlayer.toggle
      ) +
      pill("media-next", "Siguiente", function () {
        AlmaPlayer.step(1);
      }) +
      pill("media-back", "−10 s", function () {
        AlmaPlayer.seek(-10);
      }) +
      pill("media-forward", "+10 s", function () {
        AlmaPlayer.seek(10);
      }) +
      pill("media-stop", "Detener", AlmaPlayer.stop);
    row([
      "media-prev",
      "media-play",
      "media-next",
      "media-back",
      "media-forward",
      "media-stop"
    ]);
    h +=
      '</div><div class="media-actions">' +
      pill("media-add", "Añadir enlace", function () {
        if (prefs.media.length >= 30) {
          notice("Puedes guardar hasta 30 archivos.");
          return;
        }
        editor("mediaName", "Nombre del archivo", "", "text");
      }) +
      pill("media-mac", "Archivos de la Mac", loadMacMedia) +
      pill("media-vol-down", "− Volumen", function () {
        AlmaPlayer.volume(-0.1);
      }) +
      pill("media-vol-up", "+ Volumen", function () {
        AlmaPlayer.volume(0.1);
      }) +
      '<span id="media-volume">Volumen: ' +
      Math.round(player.volume * 100) +
      ' %</span></div><div class="media-list">';
    row(["media-add", "media-mac", "media-vol-down", "media-vol-up"]);
    for (var i = 0; i < player.tracks.length; i++)
      (function (i) {
        h += button(
          "media-item-" + i,
          player.tracks[i].name,
          player.tracks[i].kind === "video" ? "Vídeo" : "Audio",
          function () {
            AlmaPlayer.play(i);
          },
          "card media-item"
        );
        var ids = ["media-item-" + i];
        if (i > 0) {
          h += pill("media-remove-" + i, "Quitar", function () {
            AlmaPlayer.stop();
            prefs.media.splice(i - 1, 1);
            save();
            AlmaPlayer.setTracks(mediaTracks());
            render();
          });
          ids.push("media-remove-" + i);
        }
        row(ids);
        h += "<br>";
      })(i);
    return h + "</div>";
  }
  function render() {
    rows = [];
    actions = {};
    nav();
    var viewChanged = lastRenderedView !== state.view;
    var h = "";
    switch (state.view) {
      case "home":
        h = home();
        break;
      case "media":
        h = mediaView();
        break;
      case "apps":
        h = catalog("apps");
        break;
      case "tools":
        h = catalog("tools");
        break;
      case "settings":
        h = settings();
        break;
      case "timer":
        h = timerView();
        break;
      case "calendar":
        h = calendarView();
        break;
      case "network":
        h = networkView();
        break;
      case "weather":
        h = weatherView();
        break;
      case "calibrate":
        h = calibration();
        break;
      case "search":
        h = search();
        break;
      case "links":
        h = linksView();
        break;
      case "clock":
        h =
          head("AHORA", "Un momento para ti", "Hora y fecha del televisor") +
          '<div class="big-clock" id="live-clock">' +
          time() +
          '</div><div class="date">' +
          date() +
          "</div>";
        break;
      case "saver":
        h =
          '<div class="saver" id="saver-scene"><div id="saver-clock" class="saver-clock"></div></div>';
        break;
    }
    el("safe").setAttribute("data-view", state.view);
    syncBackgrounds();
    el("view").className = state.view === "saver" ? "saver-view" : "";
    el("header").style.display = state.view === "saver" ? "none" : "block";
    el("footer").style.display = state.view === "saver" ? "none" : "block";
    el("view").innerHTML =
      '<div class="page-surface' +
      (viewChanged && prefs.animations && state.view !== "saver"
        ? " page-enter"
        : "") +
      '">' +
      h +
      "</div>";
    lastRenderedView = state.view;
    if (
      state.view === "saver" &&
      typeof AlmaMedia !== "undefined" &&
      /^assets\/salvapantallas\.(jpg|png)$/.test(AlmaMedia.saver)
    ) {
      el("saver-scene").style.backgroundImage = prefs.saverFrame
        ? "url(" + AlmaMedia.saver + ")"
        : "none";
      el("saver-scene").className =
        "saver" + (prefs.saverFrame ? " framed" : "");
    }
    if (state.view === "home") updateHero(heroIndex);
    updateCal();
    updatePlayer();
    tick();
    if (!modal) focus();
  }
  function focusedId() {
    return rows[state.row] && rows[state.row][state.col];
  }
  function focus() {
    state.row = clamp(state.row, 0, rows.length - 1);
    state.col = clamp(state.col, 0, rows[state.row].length - 1);
    var target = el(focusedId());
    if (target === focusedNode) return;
    if (focusedNode)
      focusedNode.className = focusedNode.className.replace(
        /\s*(focus|press-a|press-b)\b/g,
        ""
      );
    if (target) {
      target.className += " focus";
      focusedNode = target;
      if (state.view === "home" && /^app-\d+$/.test(target.id))
        updateHero(Number(target.id.slice(4)));
      if (!api && !edit && target.focus) target.focus();
      var parent = target.parentNode;
      while (parent && parent !== el("view")) {
        if (parent.className && /app-carousel/.test(parent.className)) {
          var left = target.offsetLeft;
          if (left < parent.scrollLeft)
            parent.scrollLeft = Math.max(0, left - 4);
          else if (
            left + target.offsetWidth >
            parent.scrollLeft + parent.clientWidth
          )
            parent.scrollLeft =
              left + target.offsetWidth - parent.clientWidth + 4;
        }

        if (
          parent.className &&
          /(grid|search-layout|media-list)/.test(parent.className)
        ) {
          var top = target.offsetTop - parent.offsetTop;
          if (top < parent.scrollTop) parent.scrollTop = top - 5;
          else if (
            top + target.offsetHeight >
            parent.scrollTop + parent.clientHeight
          )
            parent.scrollTop =
              top + target.offsetHeight - parent.clientHeight + 8;
        }
        parent = parent.parentNode;
      }
    }
  }
  function go(view) {
    if (state.view === view) {
      state.row = 1;
      state.col = 0;
      render();
      return;
    }
    stack.push(copy(state));
    if (stack.length > 20) stack.shift();
    state = { view: view, row: 1, col: 0 };
    render();
    if (view === "saver" && prefs.bridge && prefs.city) getWeather(true);
  }
  function back() {
    if (modal) {
      closeDialog();
      return;
    }
    if (state.view === "calibrate" && cal) {
      prefs = cal;
      cal = null;
      apply();
    }
    state = stack.length ? stack.pop() : { view: "home", row: 0, col: 0 };
    render();
  }
  function showDialog(title, body, buttons) {
    modal = { state: copy(state), rows: rows, actions: actions };
    rows = [];
    actions = {};
    state = { view: state.view, row: 0, col: 0 };
    var h =
        "<h2>" +
        esc(title) +
        "</h2><p>" +
        esc(body) +
        '</p><div class="actions">',
      ids = [];
    for (var i = 0; i < buttons.length; i++) {
      h += pill("dialog-" + i, buttons[i].label, buttons[i].action);
      ids.push("dialog-" + i);
    }
    row(ids);
    el("dialog").innerHTML = h + "</div>";
    el("dialog").style.display = "block";
    focus();
  }
  function closeDialog() {
    if (!modal) return;
    state = modal.state;
    rows = modal.rows;
    actions = modal.actions;
    modal = null;
    edit = null;
    el("dialog").style.display = "none";
    render();
  }
  function reset() {
    showDialog(
      "Restaurar Alma TV",
      "Se borrarán solo la calibración, IP, ciudad y enlaces de Alma TV. Las aplicaciones y los datos de Smart Hub se conservan.",
      [
        { label: "Cancelar", action: closeDialog },
        {
          label: "Restaurar preferencias",
          action: function () {
            prefs = copy(defaults);
            AlmaPlayer.stop();
            AlmaPlayer.setTracks(mediaTracks());
            save();
            invalidate();
            apply();
            closeDialog();
            notice("Preferencias de Alma TV restauradas");
          }
        }
      ]
    );
  }
  function editor(field, title, value, type) {
    edit = { field: field, value: String(value), type: type, title: title };
    modal = { state: copy(state), rows: rows, actions: actions };
    state = { view: state.view, row: 0, col: 0 };
    drawEditor();
  }
  function drawEditor() {
    rows = [];
    actions = {};
    var h =
        "<h2>" +
        esc(edit.title) +
        '</h2><input class="field" id="editor-value" type="text" autocomplete="off" value="' +
        esc(edit.value) +
        '"><div class="keyboard">',
      chars =
        edit.type === "ip"
          ? ["1234567890."]
          : [
              "ABCDEFGHIJKLM",
              "NOPQRSTUVWXYZ",
              "ÑÁÉÍÓÚÜ",
              "0123456789.:/-",
              "?&_=%,+#@"
            ],
      i,
      j,
      ids;
    for (i = 0; i < chars.length; i++) {
      ids = [];
      for (j = 0; j < chars[i].length; j++) {
        (function (c, i, j) {
          var id = "key-" + i + "-" + j;
          actions[id] = function () {
            append(c.toLowerCase());
          };
          h +=
            '<button id="' +
            id +
            '" data-focus="' +
            id +
            '" class="key">' +
            esc(c) +
            "</button>";
          ids.push(id);
        })(chars[i].charAt(j), i, j);
      }
      row(ids);
      h += "<br>";
    }
    h += "</div>";
    ids = [];
    [
      [
        "space",
        "Espacio",
        function () {
          append(" ");
        }
      ],
      [
        "delete",
        "Borrar",
        function () {
          edit.value = edit.value.slice(0, -1);
          updateEdit();
        }
      ],
      ["done", "Guardar", finishEdit],
      ["cancel", "Cancelar", closeDialog]
    ].forEach(function (b) {
      if (edit.type === "ip" && b[0] === "space") return;
      h += pill("edit-" + b[0], b[1], b[2]) + " ";
      ids.push("edit-" + b[0]);
    });
    row(ids);
    h +=
      '<p class="help">Flechas y Aceptar para escribir · teclado físico opcional · Volver cancela</p>';
    el("dialog").innerHTML = h;
    el("dialog").style.display = "block";
    el("editor-value").oninput = function () {
      if (edit)
        edit.value = this.value.slice(
          0,
          edit.field === "mediaUrl" || edit.field === "linkUrl"
            ? 1000
            : edit.type === "ip"
              ? 15
              : 80
        );
    };
    el("editor-value").focus();
    focus();
  }
  function updateEdit() {
    el("editor-value").value = edit.value;
  }
  function append(s) {
    var max =
      edit.field === "linkUrl" || edit.field === "mediaUrl"
        ? 1000
        : edit.type === "ip"
          ? 15
          : 80;
    if (edit.value.length < max) {
      edit.value += s;
      updateEdit();
    }
  }
  var linkName = "",
    mediaName = "";
  function finishEdit() {
    var f = edit.field,
      v = edit.value.replace(/^\s+|\s+$/g, "");
    if ((f === "tvIp" || f === "macIp") && !privateIp(v)) {
      notice("Usa una dirección IPv4 privada válida");
      return;
    }
    if (f === "mediaName") {
      if (!v) {
        notice("Escribe un nombre para el archivo.");
        return;
      }
      mediaName = v;
      closeDialog();
      editor(
        "mediaUrl",
        "Enlace directo al archivo de audio o video",
        "",
        "text"
      );
      return;
    }
    if (f === "mediaUrl") {
      if (!validUrl(v)) {
        notice("Introduce una dirección http:// o https:// válida.");
        return;
      }
      if (/youtube\.com|youtu\.be|spotify\.com/i.test(v)) {
        notice(
          "Usa un enlace directo a un archivo MP3 o MP4. Los enlaces de YouTube y Spotify no son archivos reproducibles."
        );
        return;
      }
      prefs.media.push({
        name: mediaName,
        url: v,
        kind: /\.(mp4|m4v|webm)([?#]|$)/i.test(v) ? "video" : "audio"
      });
      save();
      AlmaPlayer.setTracks(mediaTracks());
      closeDialog();
      return;
    }
    if (f === "linkName") {
      if (!v) {
        notice("Escribe un nombre");
        return;
      }
      linkName = v;
      closeDialog();
      editor("linkUrl", "URL completa http:// o https://", "", "text");
      return;
    }
    if (f === "linkUrl") {
      if (!validUrl(v)) {
        notice("Escribe una URL http:// o https:// válida");
        return;
      }
      prefs.links.push({ name: linkName, url: v });
      save();
      closeDialog();
      return;
    }
    if (f === "query") {
      query = v;
      closeDialog();
      return;
    }
    prefs[f] = v;
    save();
    if (f === "tvIp" || f === "macIp" || f === "city") {
      invalidate();
    }
    if (f === "city")
      weather = {
        text: "Sin datos",
        detail: "Actualiza para consultar la ciudad configurada."
      };
    closeDialog();
  }
  function invalidate() {
    generation++;
    for (var i = 0; i < requests.length; i++) {
      try {
        requests[i].abort();
      } catch (e) {}
    }
    requests = [];
    pending = false;
    weatherPending = false;
    net = { YouTube: "Sin comprobar", Netflix: "Sin comprobar" };
  }
  function request(method, url, callback) {
    var x = new XMLHttpRequest(),
      done = false,
      t = null;
    function finish(status, text) {
      if (done) return;
      done = true;
      clearTimeout(t);
      var i = requests.indexOf(x);
      if (i !== -1) requests.splice(i, 1);
      callback(status, text);
    }
    try {
      x.open(method, url, true);
      x.onreadystatechange = function () {
        if (x.readyState === 4) finish(x.status, x.responseText);
      };
      x.onerror = function () {
        finish(0, "");
      };
      t = setTimeout(function () {
        finish(0, "");
        try {
          x.abort();
        } catch (e) {}
      }, 6000);
      requests.push(x);
      x.send(method === "POST" ? "" : null);
    } catch (e) {
      finish(0, "");
    }
    return x;
  }
  function endpoint(name) {
    return prefs.relay
      ? "http://" +
          prefs.macIp +
          ":8088/dial/" +
          name +
          "?tv=" +
          encodeURIComponent(prefs.tvIp)
      : "http://" + prefs.tvIp + ":8080/ws/app/" + name;
  }
  function statusText(code, body) {
    if (code === 200) {
      var m = body.match(/<(?:\w+:)?state[^>]*>([^<]+)</i);
      return m ? "Disponible · " + m[1] : "Disponible · HTTP 200";
    }
    return code ? "No disponible · HTTP " + code : "Sin respuesta · red o CORS";
  }
  function updateNetwork() {
    htmlIfChanged(
      el("network"),
      net.YouTube.indexOf("Disponible") === 0 ||
        net.Netflix.indexOf("Disponible") === 0
        ? "Televisor conectado"
        : "Conexión sin comprobar"
    );
    htmlIfChanged(el("dial-youtube"), esc(net.YouTube));
    htmlIfChanged(el("dial-netflix"), esc(net.Netflix));
  }
  function checkNetwork() {
    var gen = generation;
    ["YouTube", "Netflix"].forEach(function (name) {
      net[name] = "Comprobando…";
      request("GET", endpoint(name), function (code, body) {
        if (gen !== generation) return;
        net[name] = statusText(code, body);
        updateNetwork();
        if (state.view === "apps" && !modal) render();
      });
    });
    updateNetwork();
  }
  function launch(a) {
    if (a.dial) {
      if (pending) {
        notice("Solicitud en curso…");
        return;
      }
      pending = true;
      AlmaPlayer.pause();
      var gen = generation;
      notice("Abriendo " + a.name + "…");
      request("POST", endpoint(a.dial), function (code) {
        if (gen !== generation) return;
        pending = false;
        if (code === 200 || code === 201 || code === 204)
          notice(
            "DIAL aceptó la solicitud de " + a.name + ". Comprueba la TV."
          );
        else
          notice(
            "No se pudo abrir " +
              a.name +
              " · " +
              (code ? "HTTP " + code : "sin respuesta, red o CORS") +
              ". Revisa Diagnóstico."
          );
      });
    } else if (a.id === "xbox") {
      openXbox();
    } else if (a.id === "browser") {
      browser("https://example.com");
    } else if (a.id === "more") {
      go("apps");
    } else {
      showDialog(
        a.name +
          (/^(prime|disney)$/.test(a.id)
            ? " · sin soporte nativo"
            : " · integración sin verificar"),
        "No hay una aplicación compatible confirmada para este televisor Orsay. Un acceso en Alma TV no añade el reproductor ni el DRM que requiere el servicio. Puedes utilizar un dispositivo HDMI compatible con su app oficial.",
        [
          { label: "Volver", action: closeDialog },
          {
            label: "Xbox · HDMI 2",
            action: function () {
              closeDialog();
              openXbox();
            }
          }
        ]
      );
    }
  }
  var hdmiPending = false;
  function openXbox() {
    var tvWindow =
      typeof webapis !== "undefined" && webapis.tv && webapis.tv.window;
    if (
      !tvWindow ||
      typeof tvWindow.getAvailableSources !== "function" ||
      typeof tvWindow.setSource !== "function"
    ) {
      showDialog(
        "Xbox · HDMI 2",
        "Este firmware no expone la selección de entradas a Alma TV. Enciende la consola y elige HDMI 2 con el botón SOURCE del control Samsung. La entrada actual no se ha cambiado.",
        [{ label: "Volver", action: closeDialog }]
      );
      return;
    }
    if (hdmiPending) return;
    hdmiPending = true;
    var done = false,
      deadline = setTimeout(function () {
        fail("La API no respondió. Usa SOURCE → HDMI 2.");
      }, 6000);
    function fail(message) {
      if (done) return;
      done = true;
      hdmiPending = false;
      clearTimeout(deadline);
      notice(message);
    }
    function sourcesAvailable(sources) {
      if (done) return;
      if (typeof sources === "string") {
        try {
          sources = JSON.parse(sources);
        } catch (e) {
          fail("No se pudo interpretar la lista de entradas.");
          return;
        }
      }
      if (sources && sources.sources) sources = sources.sources;
      if (Object.prototype.toString.call(sources) !== "[object Array]") {
        fail("La lista de entradas no es compatible. Usa SOURCE → HDMI 2.");
        return;
      }
      var selected = null;
      for (var i = 0; i < sources.length; i++) {
        var source = sources[i],
          type = String(source.type || "").toUpperCase(),
          name = String(source.name || source.id || "")
            .toUpperCase()
            .replace(/\s/g, "");
        if (
          (type === "HDMI" && Number(source.number) === 2) ||
          name === "HDMI2"
        ) {
          selected = source;
          break;
        }
      }
      if (!selected) {
        fail("HDMI 2 no aparece entre las entradas disponibles.");
        return;
      }
      try {
        AlmaPlayer.pause();
        tvWindow.setSource(
          selected,
          function () {
            if (done) return;
            done = true;
            hdmiPending = false;
            clearTimeout(deadline);
            notice("La TV aceptó HDMI 2. La consola debe estar encendida.");
          },
          function () {
            fail("No se pudo seleccionar HDMI 2. Usa SOURCE en el control.");
          }
        );
      } catch (error) {
        fail("El firmware rechazó el cambio a HDMI 2.");
      }
    }
    try {
      tvWindow.getAvailableSources(sourcesAvailable, function () {
        fail("No se pudo consultar las entradas de la TV.");
      });
    } catch (error) {
      fail("La API de entradas no está disponible en este firmware.");
    }
  }
  function browser(url) {
    try {
      if (api && typeof api.runWebBrowser === "function") {
        api.runWebBrowser(url, "");
      } else notice("Navegador Samsung no disponible en esta previsualización");
    } catch (e) {
      notice("No se pudo abrir el navegador Samsung");
    }
  }
  var weatherPending = false;
  function getWeather(silent) {
    if (weatherPending) return;
    if (!prefs.city) {
      notice("Configura ciudad y país primero");
      return;
    }
    if (!prefs.bridge) {
      weather = {
        text: "Sin datos",
        detail:
          "Activa el puente local en Ajustes e inicia puente.py en la Mac."
      };
      render();
      return;
    }
    weatherPending = true;
    weather = {
      text: "Consultando…",
      detail: "Open-Meteo vía Mac · sin ubicación automática"
    };
    if (!silent) render();
    var gen = generation;
    request(
      "GET",
      "http://" +
        prefs.macIp +
        ":8088/weather?city=" +
        encodeURIComponent(prefs.city),
      function (code, body) {
        weatherPending = false;
        if (gen !== generation) return;
        try {
          var w = JSON.parse(body);
          if (
            code !== 200 ||
            typeof w.temperature !== "number" ||
            !w.observed_at
          )
            throw new Error();
          weather = {
            text: w.temperature + " °C · " + w.city,
            detail:
              "Observación: " +
              w.observed_at +
              " · " +
              w.description +
              " · Open-Meteo (CC BY 4.0)",
            icon: weatherIcon(w.code, w.is_day),
            observed: w.observed_at,
            updated: new Date().getTime()
          };
        } catch (e) {
          weather = {
            text: "Sin datos",
            detail:
              "Puente o proveedor no disponible. No se muestra una temperatura guardada como actual."
          };
        }
        if (state.view === "weather" && !modal) render();
      }
    );
  }
  function weatherIcon(code, day) {
    if (typeof code !== "number") return "cloud";
    if (code === 0 || code === 1) return day === 0 ? "moon" : "sun";
    if (code >= 95) return "storm";
    if (code >= 51 && code <= 82) return "rain";
    return "cloud";
  }
  function saverMarkup() {
    var icon = weather.icon || "cloud",
      w = weather.text || "Sin datos";
    return (
      '<div class="saver-time">' +
      time() +
      '</div><div class="saver-date">' +
      esc(date() + " de " + new Date().getFullYear()) +
      '</div><div class="saver-location">' +
      esc(prefs.city || "Ubicación no configurada") +
      '</div><div class="saver-weather"><img src="assets/weather/' +
      icon +
      '.png" alt=""><div>' +
      esc(w) +
      "<small>" +
      (weather.observed
        ? "Open-Meteo · " + esc(weather.observed)
        : "No hay datos meteorológicos actualizados") +
      "</small></div></div>"
    );
  }
  function tick() {
    htmlIfChanged(el("time"), time());
    updateNetwork();
    if (timer.running && timerLeft() <= 0) {
      timer.running = false;
      timer.left = 0;
      timer.finished = true;
      notice("Temporizador terminado");
      if (state.view === "timer" && !modal) {
        render();
        return;
      }
    }
    htmlIfChanged(el("countdown"), timerText());
    htmlIfChanged(el("live-clock"), time());
    if (el("saver-clock")) {
      var d = new Date(),
        s = Math.floor(d.getTime() / 15000);
      htmlIfChanged(el("saver-clock"), saverMarkup());
      if (el("saver-clock")._almaSlot !== s) {
        el("saver-clock").style.left = 80 + (s % 5) * 145 + "px";
        el("saver-clock").style.top = 55 + (s % 4) * 90 + "px";
        el("saver-clock")._almaSlot = s;
      }
      if (
        prefs.bridge &&
        prefs.city &&
        !weatherPending &&
        (!weather.updated || d.getTime() - weather.updated > 600000) &&
        d.getSeconds() === 0
      )
        getWeather(true);
    }
    if (state.view === "home" && !modal) {
      var vals = [
        time(),
        timerText(),
        date().split(",")[0],
        "Iniciar",
        net.YouTube.indexOf("Disponible") === 0
          ? "Televisor conectado"
          : "Sin comprobar",
        weather.text
      ];
      for (var i = 0; i < vals.length; i++) {
        var t = el("tool-" + i);
        if (t) htmlIfChanged(t.getElementsByTagName("small")[0], esc(vals[i]));
      }
    }
  }
  function exit() {
    AlmaPlayer.pause();
    if (api) {
      try {
        api.sendExitEvent();
        return;
      } catch (e) {}
    }
    notice("Se solicitó salir · el cierre real requiere Samsung Orsay");
  }
  function key(code) {
    var map = {
        4: "left",
        37: "left",
        5: "right",
        39: "right",
        29460: "up",
        38: "up",
        29461: "down",
        40: "down",
        29443: "ok",
        13: "ok",
        88: "back",
        8: "back",
        10009: "back",
        45: "exit",
        27: "exit",
        20: "home",
        21: "settings"
      },
      k = map[code];
    if (!k) {
      if (edit && code === 32) {
        append(" ");
        return true;
      }
      return false;
    }
    if (k === "exit") {
      exit();
      return true;
    }
    if (k === "back") {
      back();
      return true;
    }
    if (k === "home") {
      if (state.view === "calibrate" && !modal) {
        saveCalibration();
        return true;
      }
      if (modal) closeDialog();
      if (cal) {
        prefs = cal;
        cal = null;
        apply();
      }
      go("home");
      return true;
    }
    if (k === "settings") {
      if (modal) closeDialog();
      if (cal) {
        prefs = cal;
        cal = null;
        apply();
      }
      go("settings");
      return true;
    }
    if (state.view === "saver" && !modal) {
      back();
      return true;
    }
    if (state.view === "calibrate" && !modal && state.row === 1) {
      if (k === "up") {
        calAxis = (calAxis + 2) % 3;
      } else if (k === "down") {
        calAxis = (calAxis + 1) % 3;
      } else if (k === "left" || k === "right") {
        var d = k === "left" ? -1 : 1;
        if (calAxis === 0) prefs.scale = clamp(prefs.scale + d, 76, 100);
        else if (calAxis === 1) prefs.x = clamp(prefs.x + d * 2, -40, 40);
        else prefs.y = clamp(prefs.y + d * 2, -30, 30);
        apply();
      } else if (k === "ok") {
        state.row = 2;
        state.col = 0;
        focus();
      }
      updateCal();
      return true;
    }
    if (k === "ok") {
      var fn = actions[focusedId()];
      if (fn) confirmAction(fn);
      return true;
    }
    if (!modal && state.row === 0) {
      if (k === "up") state.col--;
      if (k === "down") state.col++;
      if (k === "right" && rows.length > 1) {
        sidebarIndex = state.col;
        state.row = 1;
        state.col = 0;
      }
      focus();
      return true;
    }
    if (!modal && k === "left" && state.col === 0) {
      state.row = 0;
      state.col = sidebarIndex;
      focus();
      return true;
    }
    if (!modal && k === "up" && state.row === 1) {
      state.row = 0;
      state.col = sidebarIndex;
      focus();
      return true;
    }
    if (k === "left") state.col--;
    if (k === "right") state.col++;
    if (k === "up") state.row--;
    if (k === "down") state.row++;
    focus();
    return true;
  }
  A.init = function () {
    load();
    apply();
    try {
      api = new Common.API.Widget();
      api.sendReadyEvent();
    } catch (e) {}
    window.onresize = fitScreen;
    AlmaPlayer.init(el("media-audio"), el("media-video"), updatePlayer);
    AlmaPlayer.setTracks(mediaTracks());
    document.onkeydown = function (e) {
      e = e || window.event;
      var used;
      if (edit && e.key && e.key.length === 1 && e.keyCode !== 32) {
        used = false;
      } else if (edit && e.keyCode === 8) {
        edit.value = edit.value.slice(0, -1);
        updateEdit();
        used = true;
      } else used = key(e.keyCode || e.which);
      if (used) {
        try {
          if (api && typeof api.blockNavigation === "function")
            api.blockNavigation(e);
        } catch (ignore) {}
        if (e.preventDefault) e.preventDefault();
        e.returnValue = false;
        return false;
      }
    };
    document.onkeypress = function (e) {
      e = e || window.event;
      if (edit && !e.ctrlKey && !e.metaKey) {
        var c = e.charCode || e.which;
        if (c >= 32 && c <= 65535) {
          if (c !== 32) append(String.fromCharCode(c));
          if (e.preventDefault) e.preventDefault();
          return false;
        }
      }
    };
    document.onclick = function (e) {
      e = e || window.event;
      var t = e.target || e.srcElement;
      while (t && t !== document) {
        var id = t.getAttribute && t.getAttribute("data-focus");
        if (id) {
          for (var i = 0; i < rows.length; i++) {
            var j = rows[i].indexOf(id);
            if (j !== -1) {
              state.row = i;
              state.col = j;
              focus();
              if (actions[id]) confirmAction(actions[id]);
              if (edit && el("editor-value")) el("editor-value").focus();
              return;
            }
          }
        }
        t = t.parentNode;
      }
    };
    if (
      typeof AlmaMedia !== "undefined" &&
      /^assets\/salvapantallas\.(jpg|png)$/.test(AlmaMedia.saver)
    ) {
      el("wallpaper").style.backgroundImage = "url(" + AlmaMedia.saver + ")";
    }
    render();
    interval = setInterval(tick, 1000);
  };
  A.destroy = function () {
    window.onresize = null;
    AlmaPlayer.destroy();
    clearInterval(interval);
    clearTimeout(toastTimer);
    invalidate();
  };
  A.key = key;
  A.go = go;
  A.checkNetwork = checkNetwork;
  A.ipValid = privateIp;
  return A;
})();
