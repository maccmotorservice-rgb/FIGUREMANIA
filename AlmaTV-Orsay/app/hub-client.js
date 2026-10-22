/* Alma TV local controller. ES5; no native modules opened here. */
var AlmaHub = (function () {
  "use strict";
  var next=0,busy=false,failures=0,active=null,ended="",pins={pin:"",guest_pin:""},slide=null,slideIndex=0,lastSlide=0,seen=[],lastAck="",lastError="",seenFor="",timer=null,running=false,pollDelay=2000;
  function base(){return "http://"+Alma.hubConfig().macIp+":8088";}
  function request(body,callback){var x=new XMLHttpRequest();x.open("POST",base()+"/hub/tv",true);x.timeout=6000;x.setRequestHeader("Content-Type","application/json");x.onload=function(){try{callback(x.status===200?JSON.parse(x.responseText):null);}catch(e){callback(null);}};x.onerror=x.ontimeout=function(){callback(null);};x.send(JSON.stringify(body));}
  function show(item){
    var view=Alma.hubConfig().view,node=document.getElementById(view==="saver"?"saver-scene":"home-player");
    if(!node||!item)return;
    var signature=[item.id,item.kind,item.path,item.name,item.body].join("|");
    if(node._hubSignature===signature)return;node._hubSignature=signature;
    document.getElementById("safe").setAttribute("data-hub-photo","true");
    node.style.backgroundImage=item.kind==="photo"?"url("+base()+item.path+")":"none";node.style.backgroundSize="contain";node.style.backgroundPosition="center";node.style.backgroundRepeat="no-repeat";
    var card=document.getElementById("hub-card");if(card&&card.parentNode!==node){card.parentNode.removeChild(card);card=null;}
    if(item.kind==="card"){
      if(!card){card=document.createElement("div");card.id="hub-card";var title=document.createElement("h2"),text=document.createElement("p");card.appendChild(title);card.appendChild(text);node.appendChild(card);}
      card.firstChild.textContent=item.name;card.lastChild.textContent=item.body||"";
    }else if(card)card.parentNode.removeChild(card);
  }
  function clear(){slide=null;var safe=document.getElementById("safe");safe.removeAttribute("data-hub-photo");var card=document.getElementById("hub-card");if(card)card.parentNode.removeChild(card);var node=document.getElementById("home-player");if(node)node.style.backgroundImage="";}
  function execute(command){
    lastAck=command.id;
    if(seen.indexOf(command.id)>=0)return;
    seen.push(command.id);seen=seen.slice(-100);
    try{localStorage.setItem("alma.hub.seen."+base(),JSON.stringify(seen));}catch(ignore){}
    lastError="";
    try{
      if(command.kind==="item"){
        clear();active=command.item;ended="";
        if(active.kind==="photo"||active.kind==="card"){slide={items:[active],interval:86400};slideIndex=0;lastSlide=new Date().getTime();Alma.hubPhoto();show(active);}
        else Alma.hubPlay(active);
      }else if(command.kind==="control"){
        if(command.action==="stop")clear();
        Alma.hubControl(command.action,command.seconds,command.view);
      }else if(command.kind==="scene"){
        clear();active=null;slide=command.scene;slideIndex=0;lastSlide=new Date().getTime();
        if(slide.music)Alma.hubPlay(slide.music);
        Alma.go("saver");show(slide.items[0]);
      }
    }catch(error){lastError=String(error.message||error);Alma.hubNotice("No se pudo ejecutar: "+lastError);}
    lastAck=command.id;
  }
  function tick(){
    if(seenFor!==base()){seenFor=base();try{var saved=JSON.parse(localStorage.getItem("alma.hub.seen."+base())||"[]");seen=Object.prototype.toString.call(saved)==="[object Array]"?saved.slice(-100):[];}catch(ignore){seen=[];}}
    var now=new Date().getTime();
    if(slide&&slide.items.length&&now-lastSlide>=slide.interval*1000){slideIndex=(slideIndex+1)%slide.items.length;lastSlide=now;show(slide.items[slideIndex]);}
    if(busy||now<next||document.hidden)return;
    next=now+pollDelay;busy=true;
    var status=Alma.hubStatus();if(slide&&slide.music&&status.state==="Finalizado")Alma.hubPlay(slide.music,true);if(lastError)status.error=lastError;var remote=Alma.hubRemoteStatus();status.view=remote.view;status.focus=remote.focus;status.focus_id=remote.focus_id;var event={telemetry:status};
    if(lastAck)event.ack=lastAck;
    if(active&&active.kind!=="photo"&&active.kind!=="card"&&ended!==active.play_id&&((status.kind==="youtube"||status.kind==="dailymotion")?status.finished:status.state==="Finalizado")) {event.ended=active.play_id;ended=active.play_id;}
    request(event,function(data){busy=false;if(!data){failures++;next=new Date().getTime()+Math.min(30000,failures*5000);return;}failures=0;pollDelay=data.poll_ms===250?250:2000;next=new Date().getTime()+pollDelay;pins.pin=data.pin||"";pins.guest_pin=data.guest_pin||"";var commands=data.commands||[];if(commands.length){execute(commands[0]);next=0;}onRender();});
  }
  function onRender(){
    if(slide&&slide.items.length)show(slide.items[slideIndex]);
    var pin=document.getElementById("hub-pair-code");if(pin&&pin.textContent!==(pins.pin||"Esperando al puente…"))pin.textContent=pins.pin||"Esperando al puente…";
    var guest=document.getElementById("hub-guest-code");if(guest&&guest.textContent!==(pins.guest_pin||""))guest.textContent=pins.guest_pin||"";
    var qr=document.getElementById("hub-pair-qr");if(qr&&!qr.firstChild&&typeof qrcode==="function"){var code=qrcode(0,"M");code.addData(base()+"/control");code.make();qr.innerHTML=code.createImgTag(4,8);}
  }
  function pairMarkup(){return '<h1>Conectar celular</h1><p>Escanea el QR y escribe este código:</p><div id="hub-pair-qr"></div><h2 id="hub-pair-code"></h2><p>Invitados, solo cola: <strong id="hub-guest-code"></strong></p><p>'+base()+'/control</p>';}
  function pump(){if(!running)return;tick();timer=setTimeout(pump,busy?250:Math.max(250,Math.min(2000,next-new Date().getTime())));}
  function start(){if(running)return;running=true;next=0;pump();}
  function stop(){running=false;clearTimeout(timer);}
  return {start:start,stop:stop,tick:tick,onRender:onRender,pairMarkup:pairMarkup,clear:clear};
})();
