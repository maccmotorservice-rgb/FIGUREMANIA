/* Música local independiente del video de fondo. ES5, sin plugins nativos. */
var AlmaMusic = (function () {
  "use strict";
  var node=null,title="",state="Detenida",error="",warning="",muted=false,level=0.7,masterMuted=false,changed=function(){},timer=null;
  function snapshot(){return {active:!!node,title:title,state:state,error:error,warning:warning,muted:muted,playing:!!node&&state==="Reproduciendo"&&!node.paused&&!node.ended&&!error,seconds:node?node.currentTime||0:0,volume:Math.round(level*100)};}
  function audible(){var s=snapshot();return s.playing&&!muted&&!masterMuted&&level>0;}
  function update(){
    if(node){
      try{node.volume=level;warning="";}catch(volumeError){warning="El navegador no permite ajustar el volumen del MP3. Usa el volumen de la TV.";}
      try{node.muted=muted||masterMuted;}catch(muteError){state="No disponible";error="El navegador no permite silenciar el MP3 de forma independiente.";node.pause();changed();return false;}
    }
    changed();return true;
  }
  function stop(){clearTimeout(timer);var old=node;node=null;state="Detenida";error="";warning="";title="";muted=false;if(old){old.pause();old.removeAttribute("src");old.load();if(old.parentNode)old.parentNode.removeChild(old);}changed();}
  function play(){
    if(!node)throw new Error("Primero elige música de tu biblioteca.");
    if(!node.paused&&!node.ended&&state==="Reproduciendo"&&!error){changed();return;}
    var current=node;error="";if(!update())return;state="Cargando";changed();
    function failed(){if(node!==current)return;clearTimeout(timer);state="No disponible";error="No se pudo reproducir la música. Comprueba el archivo y la conexión con la Mac.";current.pause();changed();}
    clearTimeout(timer);timer=setTimeout(function(){if(node!==current||snapshot().playing)return;state="No disponible";error="El audio no inició en 15 segundos (readyState "+current.readyState+", red "+current.networkState+"). El MP3 sí puede funcionar solo; no se confirmó junto al video.";current.pause();changed();},15000);
    try{var result=current.play();if(result&&typeof result.catch==="function")result.catch(failed);}catch(e){failed();}
  }
  function open(url,name){
    stop();title=String(name||"Música");node=document.createElement("audio");node.id="background-music";node.preload="none";node.src=url;document.body.appendChild(node);
    var current=node;
    function on(event,callback){current.addEventListener(event,function(){if(node===current){callback();changed();}},false);}
    on("playing",function(){clearTimeout(timer);state="Reproduciendo";error="";});on("pause",function(){clearTimeout(timer);if(!error)state="En pausa";});
    on("ended",function(){clearTimeout(timer);state="Finalizada";});on("error",function(){clearTimeout(timer);state="No disponible";error="No se pudo reproducir la música. Comprueba el archivo y la conexión con la Mac.";current.pause();});
    if(!update())return;
    try{current.load();}catch(loadError){state="No disponible";error="El navegador no pudo cargar la música.";changed();return;}
    play();
  }
  return {init:function(callback){changed=callback;},open:open,play:play,pause:function(){clearTimeout(timer);if(node){node.pause();if(!error)state="En pausa";changed();}},stop:stop,
    toggleMute:function(){if(!node)throw new Error("Primero elige música de tu biblioteca.");muted=!muted;update();},
    setLevel:function(amount,isMuted){level=Math.max(0,Math.min(1,Number(amount)||0));masterMuted=isMuted===true;update();},snapshot:snapshot,audible:audible};
})();
