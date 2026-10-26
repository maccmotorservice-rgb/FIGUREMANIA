/* Samsung Orsay HLS adapter. API sequence documented by Samsung TOAST:
 * https://github.com/Samsung/cordova-plugin-toast/tree/master/src/sectv-orsay
 * Open lazily only after a live channel is selected; never at app startup.
 */
var AlmaNativeLive = (function(){
  "use strict";
  var player=null,source=null,previousSource=null,changed=function(){},deadline=null,epoch=0,rectKey="",videoRatio=16/9;
  var value={status:"Detenido",error:"",playing:false,time:0};
  var audioTracks=[],audioSelected=-1,audioSource="",audioStatus="Reproduce un canal para consultar su audio.";
  function language(value){
    var code=String(value||"").toLowerCase();
    if(/^\d+$/.test(code)){var n=Number(code);code=String.fromCharCode((n>>16)&255,(n>>8)&255,n&255);}
    var names={spa:"Español",es:"Español",eng:"Inglés",en:"Inglés",por:"Portugués",pt:"Portugués",fre:"Francés",fra:"Francés",fr:"Francés",ger:"Alemán",deu:"Alemán",ita:"Italiano",jpn:"Japonés"};
    return names[code]||(/^[a-z]{2,3}$/.test(code)&&code!=="und"?code.toUpperCase():"");
  }
  function refreshAudio(announce){
    audioTracks=[];if(!player){audioStatus="Reproduce un canal para consultar su audio.";return;}
    var count=0;
    try{var raw=player.Execute("GetTotalNumOfStream",1);if(typeof raw!=="boolean"&&raw!==null&&raw!==""&&Number(raw)>0&&Number(raw)<=16&&Math.floor(Number(raw))===Number(raw))count=Number(raw);}catch(ignoreCount){}
    for(var i=0;i<(count||16);i++){
      var label="";
      try{var value=player.Execute("GetStreamLanguageInfo",1,i);if(value===-1||value==="-1"||value===null||typeof value==="boolean") {if(!count)break;}else label=language(value);}catch(ignoreLanguage){if(!count)break;}
      if(!count&&!label)break;
      audioTracks.push({id:i,label:(label||"Audio")+" · pista "+(i+1)});
    }
    if(audioSelected>=audioTracks.length)audioSelected=-1;
    audioStatus=audioTracks.length>1?"Elige una pista. Solo se reproducirá una a la vez.":(audioTracks.length===1?"La TV expone una sola pista de audio.":"Esta señal o el firmware no exponen pistas seleccionables.");
    if(announce)changed();
  }
  function audioInfo(){return {source:audioSource,tracks:audioTracks.slice(),selected:audioSelected,status:audioStatus};}
  function selectAudio(index,token){
    if(!player||token!==audioSource||typeof index!=="number"||Math.floor(index)!==index||index<0||index>=audioTracks.length)throw new Error("Las pistas cambiaron. Actualiza el audio del canal.");
    try{var result=player.Execute("SetStreamID",1,index);if(result!==1&&result!==true&&result!=="1")throw new Error("rechazado");}
    catch(error){audioStatus="Samsung no aceptó cambiar la pista; el canal sigue reproduciéndose.";changed();throw new Error(audioStatus);}
    audioSelected=index;audioStatus="Pista seleccionada: "+audioTracks[index].label;changed();
  }
  function mode(enabled,full){var text=enabled?("native-live"+(full?" native-live-full":"")):"";if(document.documentElement.className!==text)document.documentElement.className=text;}
  function cover(hidden){var node=document.getElementById("alma-live-cover");if(!node){node=document.createElement("div");node.id="alma-live-cover";node.style.cssText="position:fixed;left:0;top:0;width:100%;height:100%;background:#101114;z-index:1;pointer-events:none";document.body.appendChild(node);}var display=hidden?"block":"none";if(node.style.display!==display)node.style.display=display;}
  function object(name){
    var id="alma-live-"+name.toLowerCase(),node=document.getElementById(id);
    if(!node){node=document.createElement("object");node.id=id;node.setAttribute("classid","clsid:SAMSUNG-INFOLINK-SEF");node.setAttribute("tabindex","-1");node.style.cssText="position:absolute;left:0;top:0;width:0;height:0;display:block;pointer-events:none;z-index:0";document.body.appendChild(node);}
    if(typeof node.Open!=="function"||typeof node.Execute!=="function"||typeof node.Close!=="function")throw new Error("El firmware no expone el reproductor Samsung HLS.");
    var result=node.Open(name,"1.000",name);
    if(result!==1&&result!==true){try{node.Close();}catch(ignore){}throw new Error("Samsung rechazó abrir "+name+".");}
    return node;
  }
  function release(restore){
    audioTracks=[];audioSelected=-1;audioSource="";audioStatus="Reproduce un canal para consultar su audio.";
    epoch++;clearTimeout(deadline);deadline=null;rectKey="";
    if(player){try{player.OnEvent=function(){};player.Execute("Stop");}catch(ignoreStop){}try{player.style.width="0px";player.style.height="0px";player.Close();}catch(ignoreClose){}player=null;}
    if(source){try{if(restore&&previousSource!==null&&previousSource!==43&&Number(source.Execute("GetSource"))===43)source.Execute("SetSource",previousSource);}catch(ignoreSource){}try{source.Close();}catch(ignoreWindowClose){}source=null;}
    previousSource=null;mode(false);var mask=document.getElementById("alma-live-cover");if(mask)mask.style.display="none";
  }
  function fail(message){release(true);value={status:"No disponible",error:message,playing:false,time:0};changed();}
  function arm(){clearTimeout(deadline);deadline=setTimeout(function(){fail("Samsung HLS no inició la señal en 60 segundos. Puede ser red, TLS, formato o señal fuera de servicio. Prueba otro canal.");},60000);}
  function start(url,callback){
    release(true);audioSource=String(new Date().getTime())+"-"+epoch;audioStatus="Esperando las pistas del canal…";videoRatio=16/9;changed=callback||function(){};value={status:"Cargando señal con Samsung HLS…",error:"",playing:false,time:0};
    if(!/^https?:\/\/[^\s|]+\.m3u8(?:[?#][^\s|]*)?$/i.test(url)){fail("Dirección HLS no válida.");return false;}
    try{
      source=object("Window");
      var old=source.Execute("GetSource"),parsed=Number(old);
      if(old!==null&&old!==""&&typeof old!=="boolean"&&isFinite(parsed)&&parsed>=0)previousSource=parsed;
      if(parsed!==43){var switched=source.Execute("SetSource",43);if(switched===0||switched===false||switched<0)throw new Error("Samsung no permitió activar su fuente multimedia.");}
      player=object("Player");var generation=epoch;
      player.OnEvent=function(type,data){
        if(generation!==epoch||!player)return;
        type=Number(type);
        if(type>=1&&type<=6){var reasons={1:"No se pudo conectar con la emisora.",2:"La señal rechazó la conexión.",3:"La emisora no encontró esta señal.",4:"Se perdió la conexión de red.",5:"La red no entrega datos a tiempo.",6:"El televisor no pudo decodificar la señal."};fail(reasons[type]+" (Samsung HLS "+type+")");return;}
        if(type===9){try{var size=String(player.Execute("GetVideoResolution")).split("|"),w=Number(size[0]),h=Number(size[1]);if(w>0&&h>0&&isFinite(w/h)){videoRatio=w/h;rectKey="";}}catch(ignoreSize){}}
        if(type===9||type===7)refreshAudio(false);
        if(type===7||(type===14&&Number(data)>0)){clearTimeout(deadline);deadline=null;value.playing=true;value.status="Reproduciendo · Samsung HLS";value.error="";if(type===14)value.time=Number(data)/1000;}
        else if(type===11){value.status="Cargando señal con Samsung HLS…";arm();}
        else if(type===13)value.status="Cargando señal · "+Math.max(0,Math.min(100,Number(data)||0))+" %";
        else if(type===8){fail("La emisora terminó la transmisión. Selecciona Reintentar para volver a conectar.");return;}
        changed();
      };
      mode(true);arm();
      var initialized=player.Execute("InitPlayer",url+"|COMPONENT=HLS|");
      if(initialized===0||initialized===false||initialized<0)throw new Error("Samsung rechazó preparar la señal HLS.");
      var started=player.Execute("StartPlayback",0);
      if(started===0||started===false||started<0)throw new Error("Samsung rechazó iniciar la señal HLS.");
      changed();return true;
    }catch(error){fail(String(error.message||error));return false;}
  }
  function layout(rect,visible,full,format){
    if(!player)return;
    // Native video is below the HTML plane. Opaque screensaver/dialog paint hides
    // it without pausing audio or repeatedly changing the native surface.
    mode(true,full);cover(!visible);if(!visible)return;
    var height=window.innerHeight||720,key=[rect.left,rect.top,rect.width,rect.height,height,videoRatio,format].join(":");if(key===rectKey)return;
    var left=Math.max(0,Math.round(rect.left)),top=Math.max(0,Math.round(rect.top)),width=Math.round(rect.width),h=Math.round(rect.height);
    if(!isFinite(left)||!isFinite(top)||!isFinite(width)||!isFinite(h)||width<1||h<1)return;
    if(format!=="stretch"&&width/h>videoRatio){var fittedWidth=Math.round(h*videoRatio);left+=Math.round((width-fittedWidth)/2);width=fittedWidth;}
    else if(format!=="stretch"){var fittedHeight=Math.round(width/videoRatio);top+=Math.round((h-fittedHeight)/2);h=fittedHeight;}
    try{rectKey=key;player.style.left=left+"px";player.style.top=top+"px";player.style.width=width+"px";player.style.height=h+"px";player.Execute("SetDisplayArea",left,top,width,h,height);}catch(error){fail("Samsung no pudo colocar la imagen del canal.");}
  }
  function stop(paused){release(true);value={status:paused?"En pausa":"Detenido",error:"",playing:false,time:0};changed();}
  return {audioInfo:audioInfo,selectAudio:selectAudio,refreshAudio:refreshAudio,start:start,layout:layout,stop:stop,isOpen:function(){return !!player;},snapshot:function(){return {status:value.status,error:value.error,playing:value.playing,time:value.time};},destroy:function(){release(true);}};
})();
