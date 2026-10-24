/* Música local independiente del video de fondo. ES5, sin plugins nativos. */
var AlmaMusic = (function () {
  "use strict";
  var node=null,title="",state="Detenida",error="",muted=false,level=0.7,masterMuted=false,changed=function(){};
  function snapshot(){return {active:!!node,title:title,state:state,error:error,muted:muted,playing:!!node&&state==="Reproduciendo"&&!node.paused&&!node.ended&&!error,seconds:node?node.currentTime||0:0,volume:Math.round(level*100)};}
  function audible(){var s=snapshot();return s.playing&&!muted&&!masterMuted&&level>0;}
  function update(){if(node){node.volume=level;node.muted=muted||masterMuted;}changed();}
  function stop(){var old=node;node=null;state="Detenida";error="";title="";muted=false;if(old){old.pause();old.removeAttribute("src");old.load();if(old.parentNode)old.parentNode.removeChild(old);}changed();}
  function play(){
    if(!node)throw new Error("Primero elige música de tu biblioteca.");
    if(!node.paused&&!node.ended&&state==="Reproduciendo"&&!error){changed();return;}
    var current=node;error="";state="Cargando";changed();
    function failed(){if(node!==current)return;state="No disponible";error="No se pudo reproducir la música. Comprueba el archivo y la conexión con la Mac.";current.pause();changed();}
    try{var result=current.play();if(result&&typeof result.catch==="function")result.catch(failed);}catch(e){failed();}
  }
  function open(url,name){
    stop();title=String(name||"Música");node=document.createElement("audio");node.id="background-music";node.preload="none";node.src=url;document.body.appendChild(node);
    var current=node;
    function on(event,callback){current.addEventListener(event,function(){if(node===current){callback();changed();}},false);}
    on("playing",function(){state="Reproduciendo";error="";});on("pause",function(){if(!error)state="En pausa";});
    on("ended",function(){state="Finalizada";});on("error",function(){state="No disponible";error="No se pudo reproducir la música. Comprueba el archivo y la conexión con la Mac.";current.pause();});
    update();play();
  }
  return {init:function(callback){changed=callback;},open:open,play:play,pause:function(){if(node)node.pause();},stop:stop,
    toggleMute:function(){if(!node)throw new Error("Primero elige música de tu biblioteca.");muted=!muted;update();},
    setLevel:function(amount,isMuted){level=Math.max(0,Math.min(1,Number(amount)||0));masterMuted=isMuted===true;update();},snapshot:snapshot,audible:audible};
})();
