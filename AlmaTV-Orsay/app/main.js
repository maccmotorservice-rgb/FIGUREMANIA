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
      animations: false,
      seekStep: 10, appVolume: 70, appMuted: false,
      saverFrame: true,
      city: "Tuxtla Gutiérrez, Chiapas, México",
      links: [],
      media: [],
      youtubeLinks: [], liveFavorites: []
    };
  var prefs = {},
    interval = null,
    toastTimer = null,
    requests = [],
    generation = 0,
    pending = false,
    rendering = false,
    initialized = false,
    focusedNode = null,
    lastRenderedView = null,
    heroIndex = 0,
    sidebarIndex = 0,
    videoFull = false,
    youtubeFull = false,
    youtubeSelection = null,
    youtubeLoaded = "",
    macYoutubeLinks = [],
    macLinksBusy = false,
    macLinksLast = 0,
    macLinksHost = "",
    macLinksState = "Enlaces de la Mac: sin consultar.";
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
      /^(netflix|youtube|prime|disney|apple|max|xbox|browser|more)$/.test(
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
      name: "Conexión",
      detail: "Comunicación entre tu equipo y la TV"
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
  function styleIfChanged(node, key, value) { if(node.style[key]!==value)node.style[key]=value; }
  function attributeIfChanged(node,key,value) { if(node.getAttribute(key)!==value)node.setAttribute(key,value); }
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
    prefs.animations = false;
    prefs.seekStep = [5, 10, 30].indexOf(Number(prefs.seekStep)) !== -1 ? Number(prefs.seekStep) : 10;
    prefs.appVolume = isFinite(Number(prefs.appVolume)) ? clamp(Number(prefs.appVolume),0,100) : 70;
    prefs.appMuted = prefs.appMuted === true;
    if(Object.prototype.toString.call(prefs.liveFavorites)!=="[object Array]")prefs.liveFavorites=[];
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
    if (Object.prototype.toString.call(prefs.youtubeLinks) !== "[object Array]") prefs.youtubeLinks = [];
    prefs.youtubeLinks = prefs.youtubeLinks.slice(0, 20).filter(function (item) {
      return item && (item.provider === "dailymotion" ? /^[A-Za-z0-9]{5,12}$/ : /^[A-Za-z0-9_-]{11}$/).test(item.id) && typeof item.name === "string";
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
    if (youtubeLoaded) updateYoutube();
    else if(AlmaPlayer.snapshot().index>=0)updatePlayer();
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
    el("wallpaper").style.display = saver ? "none" : "block";
    el("wallpaper-shade").style.display = saver ? "none" : "block";
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
    var icons = { "tv-volume": "media", "seek-step": "media", calibrate: "hub", "tv-ip": "hub", "mac-ip": "network", bridge: "network", relay: "apps", motion: "media", "saver-frame": "saver", location: "weather", links: "browser", diagnostic: "network", reset: "settings" };
    var match = /^tool-(\d+)$/.exec(id);
    var icon = match && tools[Number(match[1])] ? tools[Number(match[1])].id : icons[id];
    return (
      '<button type="button" id="' +
      id +
      '" class="' +
      (cls || "card") +
      '" data-focus="' +
      id +
      '">' +
      (icon ? '<span aria-hidden="true" class="card-icon nav-icon icon-' + icon + '"></span>' : "") +
      '<strong>' + esc(title) +
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
    "fullscreen",
    "clock",
    "weather",
    "calendar",
    "timer",
    "settings", "livetv"
  ];
  function nav() {
    var names = [
        "Inicio",
        "Buscar",
        "Aplicaciones",
        "Multimedia",
        "Pantalla completa",
        "Reloj",
        "Clima",
        "Calendario",
        "Temporizador",
        "Ajustes", "TV en vivo"
      ],
      icons = [
        "home",
        "search",
        "apps",
        "media",
        "fullscreen",
        "clock",
        "weather",
        "calendar",
        "timer",
        "settings", "livetv"
      ],
      h = "",
      ids = [];
    for (var i = 0; i < names.length; i++) {
      (function (i) {
        var id = "nav-" + i;
        ids.push(id);
        actions[id] = function () {
          sidebarIndex = i;
          if (navViews[i] === "fullscreen") {
            fullscreenCurrent();
            return;
          }
          go(navViews[i]);
        };
        h +=
          '<button id="' +
          id +
          '" data-focus="' +
          id +
          '" aria-label="' + esc(names[i]) + '" class="nav' +
          ((state.view === navViews[i] || (state.view==="youtube"&&navViews[i]==="media")) ? " active" : "") +
          '"><span class="nav-icon icon-' +
          icons[i] +
          '"></span>' +
          '<span class="nav-label">' + names[i] + '</span></button>';
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
      '" aria-label="' + esc(a.name) + '" title="' + esc(detail) + '" class="card app ' +
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
        : '<span aria-hidden="true" class="app-symbol nav-icon icon-' + (a.id === "browser" ? "browser" : a.id === "livetv" ? "hub" : "apps") + '"></span>') +
      "</span><strong>" +
      esc(a.name) +
      "</strong><small>" +
      esc(detail) +
      "</small></button>"
    );
  }
  function updateHero(index) { heroIndex=index; }
  function homeApps() {
    return apps.concat([{id:"livetv",name:"Alma TV en vivo",detail:"Tus listas, canales y favoritos dentro de Alma TV",logo:"assets/logos/livetv.png"}]);
  }
  function home() {
    var list=homeApps(),h='<section class="home-apps" aria-label="Aplicaciones"><div class="app-carousel"><div class="row app-track">',ids=[];
    for(var i=0;i<list.length;i++){h+=appCard(list[i],i);ids.push("app-"+i);}
    row(ids);
    return h+'</div></div></section><div id="home-player" class="home-photo-mount"></div>';
  }
  function catalog(kind) {
    var list = kind === "apps" ? homeApps() : tools,
      h =
        head(
          kind === "apps" ? "ENTRETENIMIENTO" : "A TU RITMO",
          kind === "apps" ? "Tus aplicaciones" : "Herramientas",
          kind === "apps"
            ? "Elige una aplicación. Algunos servicios requieren un dispositivo compatible."
            : "Funciones locales, sin cuentas ni catálogos simulados."
        ) + (kind==="apps"?'<div class="apps-grid app-track">':'<div class="grid">'),
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
      if (ids.length === (kind==="apps"?4:3)) {
        row(ids);
        ids = [];
      }
    }
    if (ids.length) row(ids);
    if(kind==="apps"){
      h+='</div><div class="library-tools">';ids=[];
      tools.concat([{id:"media",name:"Multimedia"},{id:"settings",name:"Ajustes"},{id:"search",name:"Buscar"}]).forEach(function(t,i){
        h+=button("library-"+t.id,t.name,"",function(){go(t.id);},"card tool tool-"+t.id);ids.push("library-"+t.id);
        if(ids.length===4){row(ids);ids=[];}
      });if(ids.length)row(ids);
    }
    return h + "</div>";
  }
  function playLive(id){
    var index=-1;for(var i=0;i<AlmaLiveTV.length;i++)if(AlmaLiveTV[i].id===id)index=i;
    if(index<0)throw new Error("Canal no disponible");
    closeYoutube();
    AlmaPlayer.pause();
    var channel=AlmaLiveTV[index];AlmaPlayer.setTracks([{name:channel.name,url:channel.url,kind:"video",live:true}]);
    AlmaPlayer.play(0);liveBrowse=false;go("livetv");
  }
  var livePage=0,liveFavoritesOnly=false,liveCategory="",liveBrowse=false;
  function liveDialog(title,buttons){showDialog(title,"Tú decides cómo organizar tus canales.",buttons);el("dialog").className="live-organizer";rows=[];for(var i=0;i<buttons.length;i+=3){var ids=[];for(var j=i;j<Math.min(i+3,buttons.length);j++)ids.push("dialog-"+j);row(ids);}focus();}
  function chooseLiveCategory(channel){
    var buttons=[{label:"Sin categoría",action:function(){closeDialog();AlmaHub.editLive("favorite",channel.id,true,"");}}];
    AlmaHub.liveCategories().forEach(function(category){buttons.push({label:category,action:function(){closeDialog();AlmaHub.editLive("favorite",channel.id,true,category);}});});
    buttons.push({label:"Eliminar canal",action:function(){closeDialog();liveDialog("¿Eliminar "+channel.name+"?",[{label:"Eliminar",action:function(){closeDialog();AlmaHub.editLive("delete-channel",channel.id);notice("Canal eliminado. Puedes restaurarlo desde el control web.");}},{label:"Cancelar",action:closeDialog}]);}});
    buttons.push({label:"Cancelar",action:closeDialog});liveDialog(channel.name,buttons);
  }
  function liveTVView(){
    if(liveBrowse)return liveChannelList();
    var current=AlmaPlayer.snapshot(),h=head("TUS LISTAS Y CANALES","Alma TV en vivo","");
    h+='<div class="live-lobby"><section class="live-preview-panel"><div id="live-preview" aria-label="Vista previa del canal"><span>Selecciona un canal para comenzar</span></div><p id="live-status" role="status">'+esc(current.live?current.title+" · "+(current.error||current.status):"Selecciona una categoría.")+'</p><div class="live-preview-actions">';
    h+=pill("live-full","Pantalla completa",fullscreenCurrent)+pill("live-home","Reproducir en el inicio",liveAtHome)+pill("live-media","Ver reproductor",function(){go("media");})+'</div></section><section class="live-category-grid" aria-label="Categorías">';
    row(["live-full","live-home","live-media"]);
    var categories=[{name:"Todos los canales",symbol:"▦",favorite:false,value:""},{name:"Favoritos",symbol:"★",favorite:true,value:""}];
    AlmaHub.liveCategories().forEach(function(c){categories.push({name:c,symbol:"◈",favorite:true,value:c});});
    categories.push({name:"Sin categoría",symbol:"◇",favorite:true,value:"__none"});
    var ids=[];categories.forEach(function(c,i){h+=button("live-section-"+i,c.name,c.symbol,function(){liveFavoritesOnly=c.favorite;liveCategory=c.value;livePage=0;liveBrowse=true;state.row=1;state.col=0;render();},"card live-category-tile");ids.push("live-section-"+i);if(ids.length===2){row(ids);ids=[];}});if(ids.length)row(ids);
    return h+'</section></div>';
  }
  function liveAtHome(){
    var current=AlmaPlayer.snapshot();
    if(!current.live||current.index<0||current.status==="Detenido"||current.status==="No disponible"){notice("Selecciona y reproduce un canal primero.");return;}
    if(current.status==="Finalizado"){notice("La señal ha finalizado. Reintenta el canal.");return;}
    go("home");
  }
  function liveChannelList(){
    var list=AlmaLiveTV.filter(function(c){return !liveFavoritesOnly||(c.favorite===true&&(!liveCategory||(liveCategory==="__none"?!c.category:c.category===liveCategory)));});
    livePage=Math.min(livePage,Math.max(0,Math.ceil(list.length/12)-1));
    var current=AlmaPlayer.snapshot(),h=head("CANALES · TV EN VIVO",liveFavoritesOnly?"Favoritos"+(liveCategory?" · "+(liveCategory==="__none"?"Sin categoría":liveCategory):""):"TV en vivo","Tus categorías se asignan manualmente. Las señales se reproducen directamente desde internet.");
    h+='<div class="live-controls">'+pill("live-full","Pantalla completa",fullscreenCurrent)+pill("live-home","Reproducir en el inicio",liveAtHome)+pill("live-media","Ver reproductor",function(){go("media");})+pill("live-retry","Reintentar canal",function(){if(current.live)AlmaPlayer.play(current.index);else notice("Elige primero un canal.");})+'</div>';row(["live-full","live-home","live-media","live-retry"]);
    h+='<div class="live-filter">'+pill("live-all","Todos",function(){liveFavoritesOnly=false;liveCategory="";livePage=0;render();})+pill("live-favorites","★ Favoritos",function(){liveFavoritesOnly=true;liveCategory="";livePage=0;render();})+pill("live-category","Categorías",function(){
      var categories=["", "__none"].concat(AlmaHub.liveCategories()),buttons=[];categories.forEach(function(category){buttons.push({label:category==="__none"?"Sin categoría":category||"Todos los favoritos",action:function(){closeDialog();liveFavoritesOnly=true;liveCategory=category;livePage=0;render();}});});buttons.push({label:"Cancelar",action:closeDialog});liveDialog("Categorías de favoritos",buttons);
    })+'</div>';row(["live-all","live-favorites","live-category"]);
    h+='<p id="live-status" role="status">'+esc(current.live?(current.title+" · "+(current.error||current.status)):"Selecciona un canal.")+'</p><div class="live-channels">';
    if(!list.length)h+='<p>No hay canales en esta selección. Añade favoritos o elige Todos.</p>';
    for(var i=livePage*12;i<Math.min(list.length,(livePage+1)*12);i++)(function(c){
      h+=button("live-"+c.id,c.name,(c.favorite?(c.category||"Sin categoría")+" · ":"")+c.region,function(){playLive(c.id);},"card live-channel")+pill("favorite-"+c.id,c.favorite?"★ Favorito":"☆ Favorito",function(){AlmaHub.editLive("favorite",c.id,!c.favorite,c.category||"");})+pill("organize-"+c.id,"Organizar",function(){chooseLiveCategory(c);});
      row(["live-"+c.id,"favorite-"+c.id,"organize-"+c.id]);
    })(list[i]);
    h+='</div>'+pill("live-prev","Página anterior",function(){livePage=Math.max(0,livePage-1);render();})+pill("live-next","Página siguiente",function(){livePage=Math.min(Math.max(0,Math.ceil(list.length/12)-1),livePage+1);render();});row(["live-prev","live-next"]);
    return h+'<p class="hint">Página '+(livePage+1)+' de '+Math.max(1,Math.ceil(list.length/12))+'. Organizar permite asignar categoría o eliminar. Para restaurar canales o crear categorías, usa el control web. Una señal puede estar fuera de horario o no ser compatible.</p>';
  }
  A.refreshLive=function(){if(state.view==="livetv"&&!modal)render();};
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
      ["startup", "Abrir al encender", "Depende de las opciones del firmware Samsung", function(){
        showDialog("Inicio automático", "Alma TV no puede modificar el arranque del televisor. Comprueba si Ajustes de Smart Hub ofrece ejecutar la última aplicación o iniciar aplicaciones automáticamente. Si existe, actívalo y prueba dejando Alma TV como última app. Este widget no puede garantizarlo en tu UN50J5200; no se ha modificado el firmware.",[{label:"Volver",action:closeDialog}]);
      }],
      ["motion", "Interfaz rápida", "Sin animaciones ni transiciones", function () { notice("Las animaciones están desactivadas para dar prioridad a la rapidez."); }],
      ["pair-phone", "Conectar celular", "Control, música, fotos y cola por QR", function () { go("pair-phone"); }],
      ["tv-volume", "Volumen del control remoto", AlmaTVAudio.active() ? "Control nativo activo · pulsa para desactivar" : "Activar control nativo de la TV", toggleTVVolume],
      ["seek-step", "Avanzar y retroceder", prefs.seekStep + " segundos · elegir 5, 10 o 30", cycleSeekStep],
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
        ) + '<div class="settings-brand">alma<span>tv 11.0.1</span></div><div class="grid settings">',
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
  function youtubeFullscreen(enabled) {
    if (enabled) youtubeAudioOnly = false;
    youtubeFull = enabled;
    var host = el("youtube-host");
    host.className = enabled ? "youtube-full" : "";
    host.style.clip = "";
    host.style.left = ""; host.style.top = "";
    host.style.width = ""; host.style.height = "";
    updateYoutube();
  }
  function closeYoutube() {
    AlmaYouTube.close();
    youtubeLoaded = "";
    hubAutoplay = false;
    el("safe").setAttribute("data-youtube", "none");
    if (youtubeFull) youtubeFullscreen(false);
  }
  var youtubeAudioOnly = false, livePending = null, liveBusy = false, liveNext = 0, liveFailures = 0;
  function liveAck(command, status) {
    request("POST", "http://" + prefs.macIp + ":8088/youtube/live/ack", function () {}, {id: command.id, status: status});
  }
  function pollLive() {
    var now = new Date().getTime();
    if (liveBusy || now < liveNext || document.hidden || modal || edit || state.view === "calibrate") return;
    liveBusy = true; liveNext = now + 2000;
    var mac = prefs.macIp, epoch = generation;
    request("GET", "http://" + mac + ":8088/youtube/live", function (code, body) {
      liveBusy = false;
      if (epoch !== generation || mac !== prefs.macIp) return;
      if (code !== 200) { liveFailures++; liveNext = new Date().getTime() + Math.min(30000, 5000 * liveFailures); return; }
      liveFailures = 0;
      try {
        var data = JSON.parse(body), command = data.command;
        if (data.status !== "waiting" || !command || !/^[a-f0-9]{32}$/.test(command.id) || !(command.provider === "dailymotion" ? /^[A-Za-z0-9]{5,12}$/ : /^[A-Za-z0-9_-]{11}$/).test(command.video) || (command.mode !== "audio" && command.mode !== "video")) return;
        var storage = "alma.live.last." + mac;
        if (livePending && livePending.id === command.id) return;
        try { if (localStorage.getItem(storage) === command.id) return; localStorage.setItem(storage, command.id); } catch (ignore) {}
        livePending = {id: command.id, sent: false, confirmed: false};
        openYoutube({id: command.video, provider:command.provider, name: typeof command.name === "string" ? command.name.slice(0,80) : "YouTube en tiempo real"}, command.mode === "audio",true);
        go("home");
        liveAck(livePending, "received");
      } catch (error) {}
    });
  }
  var youtubeLayoutKey = "";
  function cycleSeekStep() {
    var values = [5, 10, 30];
    prefs.seekStep = values[(values.indexOf(prefs.seekStep) + 1) % values.length];
    save(); render();
  }
  function hideYoutubeImage(host) {
    AlmaYouTube.present(false, youtubeAudioOnly || state.view === "saver");
    if (host.style.left !== "-10000px") {
      host.style.left = "-10000px"; host.style.top = "-10000px";
      host.style.clip = "rect(0px,0px,0px,0px)";
      host.style.visibility = "hidden";
    }
    host.style.display = youtubeAudioOnly || state.view === "saver" ? "none" : "block";
    youtubeLayoutKey = "";
    el("safe").setAttribute("data-youtube", "hidden");
  }
  function backdropView(){return state.view!=="media"&&state.view!=="youtube"&&state.view!=="saver"&&!(state.view==="livetv"&&!liveBrowse);}
  function fitPlayerSlot(slot){
    if(slot.id==="live-preview"){var previewWidth=slot.parentNode.clientWidth;slot.style.width=previewWidth+"px";slot.style.height=(previewWidth*9/16)+"px";return;}
    var width=Math.max(240,Math.floor(Math.min(el("view").clientWidth-44,(el("view").clientHeight-210)*16/9)));
    var w=width+"px",h=(width*9/16)+"px";if(slot.style.width!==w)slot.style.width=w;if(slot.style.height!==h)slot.style.height=h;
  }
  function fullscreenCurrent(){if(youtubeLoaded&&!youtubeAudioOnly)youtubeFullscreen(true);else fullscreenVideo(true);}
  function homeBackdrop(active) {
    var value=active?"true":"false",stage=el("stage");
    if(stage.getAttribute("data-home-video")!==value)stage.setAttribute("data-home-video",value);
  }
  function updateYoutube() {
    var value = AlmaYouTube.snapshot(), host = el("youtube-host");
    attributeIfChanged(el("safe"),"data-youtube-mode",youtubeAudioOnly ? "audio" : "video");
    if (hubAutoplay && value.ready) {hubAutoplay=false;if(value.state!==1&&!value.automatic)AlmaYouTube.send("play");}
    if (livePending && !livePending.confirmed) {
      if (value.state === 1) { livePending.confirmed = true; liveAck(livePending, "playing"); }
      else if (value.failed) { livePending.confirmed = true; liveAck(livePending, /ACTIVACION/.test(value.status) ? "blocked" : "error"); }
      else if (value.ready && !livePending.sent) { livePending.sent = true; if(!value.automatic)AlmaYouTube.send("play"); }
    }
    if (youtubeAudioOnly) {
      htmlIfChanged(el("home-media-title"), "");
      htmlIfChanged(el("home-media-state"), "Solo audio · " + esc(value.status));
    }
    if(!youtubeAudioOnly){htmlIfChanged(el("home-media-title"),"");htmlIfChanged(el("home-media-state"),esc(value.status));}
    var slot = el("youtube-slot")||el("live-preview");
    htmlIfChanged(el("youtube-state"), esc(value.status));
    if (value.title) htmlIfChanged(el("youtube-title"), esc(value.title));
    if (!youtubeLoaded) return;
    var backdrop=backdropView()&&!youtubeFull&&!youtubeAudioOnly&&!value.failed&&!value.finished;
    homeBackdrop(backdrop);
    if(state.view==="home")updateHero(heroIndex);
    styleIfChanged(host,"zIndex",backdrop?"0":(youtubeFull?"110":"12"));
    styleIfChanged(host,"pointerEvents",backdrop?"none":"auto");
    // Navigation changes presentation only; never send pause/play or reload.
    if (youtubeAudioOnly || state.view === "saver" || (modal&&!backdrop) || (!youtubeFull&&!backdrop&&!slot)) {
      hideYoutubeImage(host);
      return;
    }
    styleIfChanged(host,"display","block");
    var screenWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
    var screenHeight = window.innerHeight || document.documentElement.clientHeight || 720;
    var width = screenWidth, height = screenHeight, left = 0, top = 0;
    var clipTop = 0, clipBottom = height;
    var layoutKey = [backdrop?"background":state.view, youtubeFull, screenWidth, screenHeight, backdrop?0:el("view").scrollTop, prefs.scale, prefs.x, prefs.y].join(":");
    if (layoutKey === youtubeLayoutKey) { AlmaYouTube.present(true); AlmaYouTube.resize(parseFloat(host.style.width), parseFloat(host.style.height)); return; }
    if (!youtubeFull && !backdrop) {
      fitPlayerSlot(slot);
      var box = slot.getBoundingClientRect(), viewport = el("view").getBoundingClientRect();
      width = box.width; height = width * 9 / 16; left = box.left; top = box.top;
      clipTop = Math.max(0, viewport.top - top, -top);
      clipBottom = Math.min(height, viewport.bottom - top, screenHeight - top);
    }
    if (!isFinite(width) || !isFinite(height) || !isFinite(left) || !isFinite(top) || width <= 0 || height <= 0 || left < 0 || left + width > screenWidth + 2 || clipBottom <= clipTop) {
      hideYoutubeImage(host);
      return;
    }
    var geometry = { left: Math.round(left) + "px", top: Math.round(top) + "px", width: Math.round(width) + "px", height: Math.round(height) + "px" };
    for (var property in geometry) if (Object.prototype.hasOwnProperty.call(geometry, property) && host.style[property] !== geometry[property]) host.style[property] = geometry[property];
    styleIfChanged(host,"clip","rect(" + Math.ceil(clipTop) + "px," + Math.round(width) + "px," + Math.floor(clipBottom) + "px,0px)");
    styleIfChanged(host,"visibility","visible");
    youtubeLayoutKey = layoutKey;
    AlmaYouTube.present(true);
    attributeIfChanged(el("safe"),"data-youtube","large");
    AlmaYouTube.resize(width, height);
  }
  function youtubeList() {
    var h = head("TUS ENLACES", "Videos de YouTube", "Guarda enlaces desde la Mac. Selecciona un video y pulsa Reproducir.");
    h += pill("youtube-list-refresh", "Actualizar enlaces de la Mac", function () { loadMacYoutube(false); }) +
      pill("youtube-list-add", "Pegar enlace", function () { editor("youtubeUrl", "Pega un enlace de YouTube", "", "text"); });
    row(["youtube-list-refresh", "youtube-list-add"]);
    h += '<p id="mac-links-state">' + esc(macLinksState) + '</p><div class="youtube-saved">';
    var items = macYoutubeLinks.concat(prefs.youtubeLinks);
    for (var i = 0; i < items.length; i++) {
      (function (item, index) {
        h += button("youtube-saved-" + index, item.name, "Abrir en el reproductor", function () { openYoutube(item); }, "card media-item") + "<br>";
        row(["youtube-saved-" + index]);
      })(items[i], i);
    }
    if (!items.length) h += '<p>Añade tus enlaces en http://' + esc(prefs.macIp) + ':8088/enlaces o usa Pegar enlace.</p>';
    return h + "</div>";
  }
  function openYoutube(item, audioOnly, autoplay) {
    youtubeAudioOnly = audioOnly === true;
    if (typeof audioOnly === "undefined") livePending = null;
    youtubeSelection = item;
    youtubeSelection.remoteAutoplay=autoplay===true;
    if(AlmaYouTube.reusable(prefs.macIp,item.provider)){youtubeLoaded="";hubAutoplay=false;}
    else closeYoutube();
    AlmaPlayer.pause();
    go("youtube");
  }
  function saveYoutube(url, name) {
    var parsed = AlmaYouTube.parseLink(url), id = parsed && parsed.id;
    if (!id) { notice("Usa un enlace individual de YouTube o Dailymotion. Para archivos, usa un enlace directo MP3 o MP4."); return false; }
    if (prefs.youtubeLinks.length >= 20) { notice("Puedes guardar hasta 20 enlaces."); return false; }
    prefs.youtubeLinks.push({ id: id, provider:parsed.provider, name: name || (parsed.provider === "dailymotion" ? "Dailymotion" : "YouTube") + " · " + id });
    save();
    return true;
  }
  function youtubeView() {
    var h = head((youtubeSelection && youtubeSelection.provider === "dailymotion" ? "DAILYMOTION" : "YOUTUBE") + " INTEGRADO", youtubeSelection ? youtubeSelection.name : "YouTube", "Reproductor oficial · requiere el puente actualizado e internet en la TV.");
    h = h.replace("<h1>", '<h1 id="youtube-title">');
    h+=pill("youtube-full","Pantalla completa",function(){youtubeFullscreen(true);});row(["youtube-full"]);
    h += '<div id="youtube-slot" tabindex="0" role="region" aria-label="Vídeo: Aceptar reproduce o pausa"></div><p id="youtube-state" class="youtube-state"></p><div class="youtube-controls">';
    actions["youtube-slot"] = function () { AlmaYouTube.send("toggle"); };
    row(["youtube-slot"]);
    var controls = [
      ["youtube-play", "Reproducir", function () { AlmaYouTube.send("play"); }],
      ["youtube-pause", "Pausar", function () { AlmaYouTube.send("pause"); }],
      ["youtube-back", "−" + prefs.seekStep + " s", function () { AlmaYouTube.send("back", prefs.seekStep); }],
      ["youtube-forward", "+" + prefs.seekStep + " s", function () { AlmaYouTube.send("forward", prefs.seekStep); }],
      ["youtube-seek-step", "Saltos: " + prefs.seekStep + " s", cycleSeekStep],
      ["youtube-retry", "Reintentar", function () { openYoutube(youtubeSelection); }]
    ], ids = [];
    for (var i = 0; i < controls.length; i++) {
      h += pill(controls[i][0], controls[i][1], controls[i][2]); ids.push(controls[i][0]);
    }
    row(ids);
    var isDM=youtubeSelection && youtubeSelection.provider==="dailymotion";
    h += '</div><div class="youtube-options">' + (isDM?"":pill("youtube-native", "Abrir app de YouTube", function () { launch(apps[1]); })) + pill("youtube-return", "Volver a Multimedia", function () { if (!AlmaYouTube.snapshot().ready) closeYoutube(); go("media"); }) + '</div>';
    row(isDM?["youtube-return"]:["youtube-native", "youtube-return"]);
    return h;
  }
  function youtubeHidden() {
    // Legacy engines can report transient visibility loss for native overlays.
    // Explicit exit, native-app launch and destroy own session teardown.
    if(!document.hidden&&youtubeLoaded){youtubeLayoutKey="";updateYoutube();}
  }
  function mediaClock(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    return pad(Math.floor(seconds / 60)) + ":" + pad(seconds % 60);
  }
  function fullscreenVideo(enabled) {
    var video = el("media-video"), player = AlmaPlayer.snapshot();
    if (enabled && (player.kind !== "video" || player.index < 0)) {
      notice("Primero selecciona un vídeo de la lista.");
      return;
    }
    videoFull = enabled;
    video.className = enabled ? "video-full" : "";
    updatePlayer();
    el("video-help").textContent = "Aceptar: reproducir o pausar · ◀ / ▶: " + prefs.seekStep + " segundos · Volver: reducir";
    el("video-help").style.display = enabled ? "block" : "none";
  }
  var ownVideoGeometryKey="";
  function updatePlayer() {
    if (typeof AlmaPlayer === "undefined") return;
    var player = AlmaPlayer.snapshot();
    htmlIfChanged(el("live-status"),player.live?esc(player.title+" · "+(player.error||player.status)):"Selecciona un canal.");
    if(youtubeLoaded&&!player.playing){
      styleIfChanged(el("media-video"),"visibility","hidden");
      styleIfChanged(el("video-help"),"display","none");
      attributeIfChanged(el("safe"),"data-home-media","youtube");updateYoutube();return;
    }
    el("video-help").style.display=videoFull&&!modal?"block":"none";
    if (player.playing && youtubeLoaded) closeYoutube();
    if (videoFull && (state.view === "saver" || player.kind !== "video" || player.index < 0)) fullscreenVideo(false);
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
      player.native?"Volumen de esta señal: control Samsung":"Volumen: " + Math.round(player.volume * 100) + " %"
    );
    // Keep the active video attached and laid out while browsing other views.
    // Some legacy engines suspend media when display is set to none.
    el("media-video").style.display =
      player.kind === "video" && player.index >= 0 ? "block" : "none";
    var active = player.index >= 0;
    el("safe").setAttribute("data-media-kind",active?player.kind:"none");
    var mediaPane=(state.view==="media"&&el("view").querySelector(".media-stage"))||el("live-preview");
    if(mediaPane&&!youtubeLoaded){if(active&&player.kind==="video")fitPlayerSlot(mediaPane);else{mediaPane.style.width="";mediaPane.style.height="";}}
    if (youtubeLoaded) {
      el("media-video").style.visibility = "hidden";
      el("safe").setAttribute("data-home-media", "youtube");
      updateYoutube();
      return;
    }
    el("safe").setAttribute("data-home-media", active ? player.kind : "none");
    htmlIfChanged(el("home-media-title"), esc(active&&player.kind==="video"?"":(active ? player.title : "Tu música y tus vídeos")));
    htmlIfChanged(el("home-media-state"), esc(active ? (player.error || player.status) : "Selecciona un archivo desde Multimedia."));
    var video=el("media-video"),backdrop=backdropView()&&!videoFull&&active&&player.kind==="video"&&player.status!=="Detenido"&&player.status!=="Finalizado"&&player.status!=="No disponible"&&(!player.native||AlmaNativeLive.isOpen());
    homeBackdrop(backdrop);
    if(state.view==="home")updateHero(heroIndex);
    video.style.zIndex=videoFull?"110":(backdrop?"0":"12");
    if(active && player.kind==="video"){
      var placementKey=[state.view,videoFull,backdrop,window.innerWidth,window.innerHeight,el("view").scrollTop,prefs.scale,prefs.x,prefs.y].join(":");
      if(placementKey!==ownVideoGeometryKey){
      var width=window.innerWidth||1280,height=window.innerHeight||720,left=0,top=0,clipTop=0,clipBottom=height;
      if(!backdrop&&!videoFull&&(state.view==="media"||el("live-preview"))){
        var mediaSlot=el("live-preview")||el("view").querySelector(".media-stage"),box=mediaSlot.getBoundingClientRect(),viewport=el("view").getBoundingClientRect();
        left=box.left;top=box.top;width=box.width;height=box.height;clipTop=Math.max(0,viewport.top-top);clipBottom=Math.min(height,viewport.bottom-top);
      }
      var geometry={left:Math.round(left)+"px",top:Math.round(top)+"px",width:Math.round(width)+"px",height:Math.round(height)+"px",clip:"rect("+Math.ceil(clipTop)+"px,"+Math.round(width)+"px,"+Math.max(0,Math.floor(clipBottom))+"px,0px)"};
      for(var property in geometry)if(Object.prototype.hasOwnProperty.call(geometry,property)&&video.style[property]!==geometry[property])video.style[property]=geometry[property];
        ownVideoGeometryKey=placementKey;
      }
      styleIfChanged(video,"visibility",!player.native&&(backdrop||videoFull||state.view==="media"||!!el("live-preview"))&&(!modal||backdrop)?"visible":"hidden");
      if(player.native){
        var nativeRect={left:parseFloat(video.style.left)||0,top:parseFloat(video.style.top)||0,width:parseFloat(video.style.width)||1280,height:parseFloat(video.style.height)||720};
        var nativeVisible=state.view!=="saver"&&!modal;
        if(state.view==="media"&&!videoFull){var bounds=el("view").getBoundingClientRect();if(nativeRect.top<bounds.top||nativeRect.top+nativeRect.height>bounds.bottom)nativeVisible=false;}
        AlmaNativeLive.layout(nativeRect,nativeVisible,videoFull);
      }
    }
    if (el("media-progress"))
      el("media-progress").style.width =
        (player.duration ? (player.time / player.duration) * 100 : 0) + "%";
  }
  function loadMacYoutube(silent) {
    if (macLinksBusy) return;
    macLinksBusy = true;
    macLinksLast = new Date().getTime();
    macLinksHost = prefs.macIp;
    var gen = generation;
    if (!silent) htmlIfChanged(el("mac-links-state"), "Actualizando enlaces de la Mac…");
    request("GET", "http://" + prefs.macIp + ":8088/youtube/library", function (code, body) {
      macLinksBusy = false;
      if (gen !== generation) return;
      var changed = false, success = false;
      try {
        var data = JSON.parse(body);
        if (code !== 200 || Object.prototype.toString.call(data.items) !== "[object Array]") throw new Error();
        var next = data.items.slice(0, 50).filter(function (item) {
          return item && typeof item.id === "string" && (item.provider === "dailymotion" ? /^[A-Za-z0-9]{5,12}$/ : /^[A-Za-z0-9_-]{11}$/).test(item.id) && typeof item.name === "string" && item.name.length <= 80;
        });
        changed = JSON.stringify(next) !== JSON.stringify(macYoutubeLinks);
        macYoutubeLinks = next;
        success = true;
        macLinksState = "Enlaces de la Mac: " + next.length + ". Pégalos en http://" + prefs.macIp + ":8088/enlaces";
      } catch (e) {
        macLinksState = "No se pudo actualizar la lista de la Mac. Comprueba el puente actualizado. Los enlaces anteriores pueden estar desactualizados.";
      }
      if (changed && (state.view === "media" || state.view === "youtube-list") && !modal) render();
      else htmlIfChanged(el("mac-links-state"), esc(macLinksState));
      if (!silent && !success) notice("No se pudo actualizar la lista. Comprueba el puente de la Mac.");
      if (!silent && success && state.view === "media" && !modal) {
        if (macYoutubeLinks.length) {
          for (var r = 0; r < rows.length; r++) {
            var c = rows[r].indexOf("mac-youtube-0");
            if (c >= 0) { state.row = r; state.col = c; focus(); break; }
          }
        } else notice("Aún no hay enlaces en la Mac. Añádelos en http://" + prefs.macIp + ":8088/enlaces");
      }
    });
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
    if (player.playing && youtubeLoaded) closeYoutube();
    var h="";
    if(youtubeLoaded)h='<section class="online-player">'+youtubeView()+"</section>";
    else{h =
      head(
        "MÚSICA Y VÍDEOS",
        "Tu reproductor · Alma TV 10.3.0",
        "Archivos propios, enlaces directos y YouTube integrado experimental mediante el puente de la Mac."
      ) +
      pill("media-fullscreen","Pantalla completa",function(){fullscreenVideo(true);})+'<div class="media-stage"><div class="media-symbol"><span class="media-eq"><b></b><b></b><b></b></span></div><h2 id="media-title">' +
      esc(player.title) +
      '</h2><p id="media-state">' +
      esc(player.error || player.status) +
      '</p><div class="media-track"><span id="media-progress"></span></div><div id="media-time">' +
      mediaClock(player.time) +
      " / " +
      mediaClock(player.duration) +
      '</div></div><div class="media-controls">';
    row(["media-fullscreen"]);
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
      pill("media-seek-step", "Saltos: " + prefs.seekStep + " s", cycleSeekStep) +
      pill("media-back", "−" + prefs.seekStep + " s", function () {
        AlmaPlayer.seek(-prefs.seekStep);
      }) +
      pill("media-forward", "+" + prefs.seekStep + " s", function () {
        AlmaPlayer.seek(prefs.seekStep);
      }) +
      pill("media-stop", "Detener", AlmaPlayer.stop);
    row([
      "media-prev",
      "media-play",
      "media-next",
      "media-seek-step",
      "media-back",
      "media-forward",
      "media-stop"
    ]);
    h+="</div>";}
    h +=
      '<div class="media-actions">' +
      pill("media-add", "Añadir enlace", function () {
        if (prefs.media.length >= 30) {
          notice("Puedes guardar hasta 30 archivos.");
          return;
        }
        editor("mediaName", "Nombre del archivo", "", "text");
      }) +
      pill("media-mac", "Archivos de la Mac", loadMacMedia) +
      pill("media-mac-links", "Enlaces de la Mac", function () { loadMacYoutube(false); }) +
      pill("media-youtube", "YouTube en línea", function () { editor("youtubeUrl", "Pega un enlace de YouTube", "", "text"); }) +
      pill("media-youtube-test", "Probar YouTube", function () { openYoutube({ id: "M7lc1UVf-VE", name: "Prueba de compatibilidad de YouTube" }); }) +
      pill("media-vol-down", "− Volumen", function () {
        setAppAudio(-10, false);
      }) +
      pill("media-vol-up", "+ Volumen", function () {
        setAppAudio(10, false);
      }) +
      '<span id="media-volume">Volumen: ' +
      Math.round(player.volume * 100) +
      ' %</span></div><div class="media-list">';
    row(["media-add", "media-mac", "media-mac-links", "media-youtube", "media-youtube-test", "media-vol-down", "media-vol-up"]);
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
    for (var y = 0; y < prefs.youtubeLinks.length; y++) {
      (function (y) {
        var item = prefs.youtubeLinks[y];
        h += button("youtube-item-" + y, item.name, (item.provider==="dailymotion"?"Dailymotion integrado · experimental":"YouTube integrado · experimental"), function () { openYoutube(item); }, "card media-item") + pill("youtube-remove-" + y, "Quitar", function () { prefs.youtubeLinks.splice(y, 1); save(); render(); });
        row(["youtube-item-" + y, "youtube-remove-" + y]); h += "<br>";
      })(y);
    }
    h += '<h2 class="mac-links-heading">YouTube · Enlaces de la Mac</h2><p id="mac-links-state" class="mac-links-state">' + esc(macLinksState) + '</p>';
    for (var m = 0; m < macYoutubeLinks.length; m++) {
      (function (m) {
        var item = macYoutubeLinks[m];
        h += button("mac-youtube-" + m, item.name, (item.provider==="dailymotion"?"Guardado desde la Mac · Dailymotion":"Guardado desde la Mac · YouTube"), function () { openYoutube(item); }, "card media-item") + "<br>";
        row(["mac-youtube-" + m]);
      })(m);
    }
    return h + "</div>";
  }
  function render() {
    rendering = true;
    youtubeLayoutKey = "";ownVideoGeometryKey="";
    rows = [];
    actions = {};
    nav();
    var viewChanged = lastRenderedView !== state.view;
    if (viewChanged && state.view === "media") macLinksLast = 0;
    var previousMediaList = state.view === "media" && el("view").querySelector(".media-list");
    var previousMediaScroll = previousMediaList ? previousMediaList.scrollTop : 0;
    var h = "";
    switch (state.view) {
      case "home":
        h = home();
        break;
      case "livetv":
        h = liveTVView();break;
      case "media":
        h = mediaView();
        break;
      case "youtube-list":
        h = youtubeList();
        break;
      case "youtube":
        h = youtubeView();
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
      case "pair-phone":
        h = AlmaHub.pairMarkup();
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
    el("view").className = state.view === "saver" ? "saver-view" : (state.view === "home" ? "home-scroll" : "content-scroll");
    if (viewChanged) el("view").scrollTop = 0;
    el("view").onscroll = function () { if(youtubeLoaded)updateYoutube();else if(state.view==="home"||state.view==="media")updatePlayer(); };
    el("header").style.display = state.view === "saver" ? "none" : "block";
    el("footer").style.display = state.view === "saver" ? "none" : "block";
    el("view").innerHTML =
      '<div class="page-surface' +
      (viewChanged && prefs.animations && state.view !== "saver" && state.view !== "youtube" && !youtubeLoaded
        ? " page-enter"
        : "") +
      '">' +
      h +
      "</div>";
    var surface = el("view").firstChild;

    if (state.view === "media" && el("view").querySelector(".media-list")) el("view").querySelector(".media-list").scrollTop = previousMediaScroll;
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
    if (state.view === "youtube" && youtubeSelection) {
      if (youtubeLoaded !== youtubeSelection.id) {
        youtubeLoaded = youtubeSelection.id;
        AlmaYouTube.open(el("youtube-host"), prefs.macIp, youtubeSelection.id, updateYoutube, youtubeSelection.provider, youtubeSelection.remoteAutoplay);
      }
      updateYoutube();
      setTimeout(function () { if (state.view === "youtube") updateYoutube(); }, 250);
    }
    tick();
    if (viewChanged && state.view === "youtube-list") loadMacYoutube(true);
    if (youtubeLoaded) updateYoutube();
    if (viewChanged && state.view === "home" && youtubeLoaded) {
      for (var homeRow = 0; homeRow < rows.length; homeRow++) if (rows[homeRow][0] === "home-player") { state.row = homeRow; state.col = 0; break; }
    }
    if (!modal) focus();
    el("footer").innerHTML="";
    rendering = false;
    if (youtubeLoaded) updateYoutube();
    if (typeof AlmaHub !== "undefined") AlmaHub.onRender();
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
          if(state.view==="home"&&/^app-\d+$/.test(target.id)){
            var itemIndex=Number(target.id.slice(4)),step=178,start=Math.round(parent.scrollLeft/step);
            if(itemIndex<start)start=itemIndex;
            else if(itemIndex>=start+6)start=itemIndex-5;
            parent.scrollLeft=clamp(start,0,Math.max(0,homeApps().length-6))*step;
            parent=parent.parentNode;continue;
          }
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
      if(modal&&el("dialog").contains(target)){
        var dialogBox=el("dialog"),dialogRect=dialogBox.getBoundingClientRect(),targetRect=target.getBoundingClientRect(),dialogRatio=dialogBox.offsetHeight/dialogRect.height;
        if(targetRect.top<dialogRect.top)dialogBox.scrollTop-=(dialogRect.top-targetRect.top)*dialogRatio+8;
        else if(targetRect.bottom>dialogRect.bottom)dialogBox.scrollTop+=(targetRect.bottom-dialogRect.bottom)*dialogRatio+8;
      }
      if (el("view").contains(target)) {
        var viewport = el("view"), visible = viewport.getBoundingClientRect();
        var bounds = target.getBoundingClientRect();
        var ratio = viewport.offsetHeight / visible.height;
        if (target.id === "hero-cta") viewport.scrollTop = 0;
        else if (bounds.top < visible.top) viewport.scrollTop -= (visible.top - bounds.top) * ratio + 8;
        else if (bounds.bottom > visible.bottom) viewport.scrollTop += (bounds.bottom - visible.bottom) * ratio + 8;
        updatePlayer();
        if (youtubeLoaded) updateYoutube();
      }
    }
  }
  function go(view) {
    if(view==="livetv"&&state.view!=="livetv")liveBrowse=false;
    if(view!==state.view){if(youtubeFull)youtubeFullscreen(false);if(videoFull)fullscreenVideo(false);}
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
    if (youtubeFull) { youtubeFullscreen(false); return; }
    if (videoFull) { fullscreenVideo(false); return; }
    if (modal) {
      closeDialog();
      return;
    }
    if (state.view === "calibrate" && cal) {
      prefs = cal;
      cal = null;
      apply();
    }
    if(state.view==="livetv"&&liveBrowse){liveBrowse=false;state.row=1;state.col=0;render();return;}
    if(state.view==="apps"){state={view:"home",row:1,col:0};render();return;}
    state = stack.length ? stack.pop() : { view: "home", row: 0, col: 0 };
    render();
  }
  function showDialog(title, body, buttons) {
    el("dialog").className="";
    modal = { state: copy(state), rows: rows, actions: actions };
    if (youtubeLoaded) updateYoutube();
    if(!backdropView())el("media-video").style.visibility="hidden";el("video-help").style.display="none";
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
    if (youtubeLoaded) updateYoutube();
    if(!backdropView())el("media-video").style.visibility="hidden";el("video-help").style.display="none";
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
          (edit.field === "mediaUrl" || edit.field === "youtubeUrl") || edit.field === "linkUrl"
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
      edit.field === "linkUrl" || (edit.field === "mediaUrl" || edit.field === "youtubeUrl")
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
    if (f === "youtubeUrl") {
      if (saveYoutube(v, "")) closeDialog();
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
      if (AlmaYouTube.parseUrl(v)) {
        if (saveYoutube(v, mediaName)) closeDialog();
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
    macLinksBusy = false;
    macLinksLast = 0;
    net = { YouTube: "Sin comprobar", Netflix: "Sin comprobar" };
  }
  function request(method, url, callback, body) {
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
      if (body) x.setRequestHeader("Content-Type", "application/json");
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
      x.send(body ? JSON.stringify(body) : (method === "POST" ? "" : null));
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
    if(a.id==="livetv"){go("livetv");return;}
    closeYoutube();
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
    pollLive();
    if ((state.view === "media" || state.view === "youtube-list") && !modal && (macLinksHost !== prefs.macIp || new Date().getTime() - macLinksLast >= 15000)) loadMacYoutube(true);
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
        AlmaHub.connection() ? "Conectado" : "Sin conexión",
        weather.text
      ];
      for (var i = 0; i < vals.length; i++) {
        var t = el("tool-" + i);
        if (t) htmlIfChanged(t.getElementsByTagName("small")[0], esc(vals[i]));
      }
    }
  }
  function exit() {
    closeYoutube();
    AlmaPlayer.pause();
    if (api) {
      try {
        api.sendExitEvent();
        return;
      } catch (e) {}
    }
    notice("Se solicitó salir · el cierre real requiere Samsung Orsay");
  }
  function toggleTVVolume() {
    if (AlmaTVAudio.active()) { AlmaTVAudio.close(); releaseVolumeKeys(); render(); return; }
    var enabled = AlmaTVAudio.init(volumeKeyCodes, notice);
    render();
    notice(enabled ? "Control de volumen de la TV activo. Prueba Vol+, Vol− y Silencio." : "La TV rechazó el control nativo de volumen.");
  }
  var volumeKeyCodes = [7, 11, 27], nativeKeyPlugin = null;
  function releaseVolumeKeys() {
    if (AlmaTVAudio.active()) return;
    try {
      if (typeof Common === "undefined" || !Common.API) return;
      if (typeof Common.API.TVKeyValue === "function") {
        var keys = new Common.API.TVKeyValue();
        volumeKeyCodes = [typeof keys.KEY_VOL_UP === "number" ? keys.KEY_VOL_UP : 7, typeof keys.KEY_VOL_DOWN === "number" ? keys.KEY_VOL_DOWN : 11, typeof keys.KEY_MUTE === "number" ? keys.KEY_MUTE : 27];
      }
      if (!nativeKeyPlugin && typeof Common.API.Plugin === "function") nativeKeyPlugin = new Common.API.Plugin();
      if (!nativeKeyPlugin || typeof nativeKeyPlugin.unregistKey !== "function") return;
      for (var i = 0; i < volumeKeyCodes.length; i++) {
        try { nativeKeyPlugin.unregistKey(volumeKeyCodes[i]); } catch (unavailableKey) {}
      }
    } catch (unavailablePlugin) {}
  }
  function key(code) {
    // Samsung handles its own amplifier and OSD. Do not consume Vol+/Vol-/Mute.
    if (volumeKeyCodes.indexOf(code) !== -1) return AlmaTVAudio.handle(code);

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
    if (youtubeFull) {
      if (k === "back" || k === "exit") youtubeFullscreen(false);
      else if (k === "ok") AlmaYouTube.send("toggle");
      else if (k === "left") AlmaYouTube.send("back", prefs.seekStep);
      else if (k === "right") AlmaYouTube.send("forward", prefs.seekStep);
      else if (k === "home" || k === "settings") { youtubeFullscreen(false);go(k === "home" ? "home" : "settings"); }
      return true;
    }
    if (videoFull) {
      if (k === "back" || k === "exit") fullscreenVideo(false);
      else if (k === "ok") AlmaPlayer.toggle();
      else if (k === "left") AlmaPlayer.seek(-prefs.seekStep);
      else if (k === "right") AlmaPlayer.seek(prefs.seekStep);
      else if (k === "home" || k === "settings") { fullscreenVideo(false); go(k === "home" ? "home" : "settings"); }
      return true;
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
    if(!modal&&state.view==="home"&&state.row>0&&k==="down"){go("apps");return true;}
    if(!modal&&state.row===0){
      if(k==="left"){state.col--;focus();return true;}
      if(k==="right"){state.col++;focus();return true;}
      if(k==="down"){sidebarIndex=state.col;state.row=1;state.col=0;focus();return true;}
    }
    if (k === "ok") {
      var fn = actions[focusedId()];
      if (fn) confirmAction(fn);
      return true;
    }
    if (!modal && state.row === 0) {
      focus();return true;
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
    if(initialized)return;
    initialized=true;
    load();
    apply();
    try {
      api = new Common.API.Widget();
      api.sendReadyEvent();
    } catch (e) {}
    releaseVolumeKeys();
    window.addEventListener("focus", releaseVolumeKeys, false);
    window.onresize = fitScreen;
    document.body.appendChild(el("youtube-host"));
    document.body.appendChild(el("media-video"));
    document.body.appendChild(el("video-help"));
    AlmaYouTube.init();
    document.addEventListener("visibilitychange", youtubeHidden, false);
    AlmaPlayer.init(el("media-audio"), el("media-video"), updatePlayer);
    AlmaPlayer.setLevel(prefs.appVolume/100,prefs.appMuted); AlmaYouTube.level(prefs.appVolume,prefs.appMuted,true);
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
    if(typeof AlmaProfile!=="undefined"&&/^assets\/profile-photo\.(jpg|png)$/.test(AlmaProfile.image)){el("profile-photo").style.backgroundImage="url("+AlmaProfile.image+")";el("profile-photo").className="has-photo";}
    state.row=1;
    render();
    interval = setInterval(tick, 1000);
    if(prefs.liveFavorites.length){prefs.liveFavorites=prefs.liveFavorites.filter(function(id){return !AlmaHub.editLive("favorite",id,true,"");});save();}
    AlmaHub.start();
  };
  A.destroy = function () {
    AlmaHub.stop();
    AlmaTVAudio.close();
    window.onresize = null;
    window.removeEventListener("focus", releaseVolumeKeys, false);
    AlmaYouTube.destroy();
    document.removeEventListener("visibilitychange", youtubeHidden, false);
    AlmaPlayer.destroy();
    clearInterval(interval);
    clearTimeout(toastTimer);
    invalidate();
  };
  var hubAutoplay = false;
  A.hubConfig = function () {return {macIp:prefs.macIp,view:state.view};};
  A.hubNotice = notice;
  A.hubPhoto = function () {closeYoutube();el("media-video").style.visibility="hidden";go("home");};
  A.hubPlay = function(item, keepView) {
    if(item.kind==="youtube"){
      livePending=null;openYoutube({id:item.video,provider:item.provider,name:item.name},item.mode==="audio",true);hubAutoplay=true;go("home");updateYoutube();
    }else{
      closeYoutube();var url="http://"+prefs.macIp+":8088"+item.path;
      if(!/^\/(?:hub\/(?:file|stream)\/|media\/file\/)[A-Za-z0-9]+$/.test(item.path))throw new Error("Dirección de archivo no válida");
      AlmaPlayer.setTracks([{name:item.name,url:url,kind:item.kind==="video"?"video":"audio"}]);AlmaPlayer.play(0);if(!keepView)go("home");
    }
  };
  function setAppAudio(delta, toggleMute) {
    if (toggleMute) prefs.appMuted = !prefs.appMuted;
    else { prefs.appVolume = clamp(prefs.appVolume + delta,0,100); if(delta>0) prefs.appMuted=false; }
    save();
    // Do not touch the inactive hardware decoder when adjusting online audio.
    if(youtubeLoaded){AlmaPlayer.setLevel(prefs.appVolume/100,prefs.appMuted,true);AlmaYouTube.level(prefs.appVolume,prefs.appMuted);}
    else{AlmaPlayer.setLevel(prefs.appVolume/100,prefs.appMuted);AlmaYouTube.level(prefs.appVolume,prefs.appMuted,true);}
  }
  A.hubControl = function(action,seconds,view) {
    var remoteKeys={up:38,down:40,left:37,right:39,ok:13,back:88};
    if(remoteKeys[action]){key(remoteKeys[action]);return;}
    if(action==="navigate"){
      if(["home","search","apps","media","hub","clock","weather","calendar","timer","settings","saver","livetv"].indexOf(view)===-1)throw new Error("Menú no disponible");
      if(view==="hub"){exit();return;}
      if(modal)closeDialog();if(edit){edit=null;}if(youtubeFull)youtubeFullscreen(false);if(videoFull)fullscreenVideo(false);
      sidebarIndex=Math.max(0,navViews.indexOf(view));go(view);return;
    }
    if(action==="live-channel"){playLive(view);return;}
    if(action==="fullscreen"){
      if(youtubeLoaded)youtubeFullscreen(!youtubeFull);
      else if(AlmaPlayer.snapshot().kind==="video"&&AlmaPlayer.snapshot().index>=0)fullscreenVideo(!videoFull);
      else throw new Error("No hay un vídeo abierto para ampliar");return;
    }
    if(action==="home"||action==="media"||action==="saver"){go(action);return;}
    if(!youtubeLoaded&&AlmaPlayer.snapshot().native&&["volume","volume-up","volume-down","mute"].indexOf(action)>=0){notice("Esta señal utiliza el volumen del control Samsung.");return;}
    if(action==="volume"){
      if(typeof seconds!=="number"||!isFinite(seconds)||seconds<0||seconds>100)throw new Error("Volumen no válido");
      prefs.appMuted=false;setAppAudio(Math.round(seconds)-prefs.appVolume,false);return;
    }
    if(action==="volume-up"||action==="volume-down"||action==="mute"){
      setAppAudio(action==="volume-up"?10:action==="volume-down"?-10:0,action==="mute");return;
    }
    if(action==="stop"){hubAutoplay=false;closeYoutube();AlmaPlayer.stop();return;}
    if(youtubeLoaded){if(action==="seek")AlmaYouTube.send(seconds<0?"back":"forward",Math.abs(seconds));else AlmaYouTube.send(action);}
    else if(action==="play")AlmaPlayer.play();else if(action==="pause")AlmaPlayer.pause();else if(action==="toggle")AlmaPlayer.toggle();else if(action==="seek")AlmaPlayer.seek(seconds);
  };
  A.hubRemoteStatus=function(){
    var id=focusedId(),node=id&&el(id),parts=[],children=node?node.children:[],i;
    for(i=0;i<children.length;i++)if(/^(STRONG|SMALL|H2|H3)$/.test(children[i].tagName))parts.push(children[i].textContent);
    return {view:state.view,focus:node?String(parts.length?parts.join(" · "):node.textContent||"").replace(/\s+/g," ").slice(0,160):"",focus_id:id||""};
  };
  A.hubStatus = function(){
    if(youtubeLoaded){var value=AlmaYouTube.snapshot();return {title:value.title||(youtubeSelection&&youtubeSelection.name)||"Vídeo",kind:(youtubeSelection&&youtubeSelection.provider)||"youtube",engine:(youtubeSelection&&youtubeSelection.provider)||"youtube",state:value.failed?"Error":(value.state===1?"Reproduciendo":(value.state===2?"En pausa":"Preparado")),seconds:value.seconds||0,duration:value.duration||0,volume:prefs.appVolume,muted:prefs.appMuted,observed_volume:value.volume,observed_muted:value.muted,finished:value.finished,error:value.failed?value.status:""};}
    var current=AlmaPlayer.snapshot();return {title:current.index>=0?current.title:"Sin reproducción",kind:current.kind,state:current.status,seconds:current.time,duration:current.duration,error:current.error,engine:current.native?"samsung-hls":"html5",volume:prefs.appVolume,muted:prefs.appMuted,observed_volume:current.native?null:Math.round(current.volume*100),observed_muted:current.muted};
  };
  A.key = key;
  A.go = go;
  A.checkNetwork = checkNetwork;
  A.ipValid = privateIp;
  return A;
})();
