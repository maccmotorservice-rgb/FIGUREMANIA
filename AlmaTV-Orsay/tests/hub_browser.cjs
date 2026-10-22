const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');let browser,bridge,preview,base,tmp;
before(async()=>{
  tmp=fs.mkdtempSync(path.join(os.tmpdir(),'alma-hub-ui-'));
  const script=`from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
from puente import Handler
from hub import Hub
import hub_http,io
# Import fixture: only this public test URL is intercepted, no LAN or external calls.
_original_open=hub_http.public_open
def playlist_open(url,headers=None,allow_redirect=False):
 if url!='https://lists.example.org/test.m3u': return _original_open(url,headers,allow_redirect)
 data=('#EXTM3U\\n'+''.join('#EXTINF:-1 tvg-id="Fixture%d.mx",Canal importado %d\\nhttps://streams.example.org/%d.m3u8\\n'%(i,i,i) for i in range(40))).encode()
 response=io.BytesIO(data);response.status=200;response.getheader=lambda n,d=None:d
 return io.BytesIO(),response
hub_http.public_open=playlist_open
from youtube_library import Library,Realtime
s=ThreadingHTTPServer(('127.0.0.1',0),Handler)
s.tv='127.0.0.1';s.admin_token='owner';s.origins=['null','http://127.0.0.1:8766'];s.allow_launch=False
s.media_dir=Path('tests/fixtures').resolve();s.hub=Hub(Path(sys.argv[1])/'hub',s.tv);s.youtube_library=Library(Path(sys.argv[1])/'links.json');s.realtime=Realtime()
print(s.server_port,flush=True);s.serve_forever()`;
  bridge=spawn('python3',['-u','-c',script,tmp],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
  let output='';base=await new Promise((resolve,reject)=>{bridge.stdout.on('data',b=>{output+=b;if(/^\d+\n/.test(output))resolve('http://127.0.0.1:'+output.split('\n')[0]);});bridge.on('exit',code=>reject(new Error('Bridge exit '+code)));});
  preview=spawn('python3',['preview.py','--port','8766','--bind','127.0.0.1','--directory','.preview/app'],{cwd:ROOT,stdio:'ignore'});
  for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:8766');break;}catch(e){await new Promise(r=>setTimeout(r,50));}}
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
});
after(async()=>{if(browser)await browser.close();if(bridge)bridge.kill();if(preview)preview.kill();if(tmp)fs.rmSync(tmp,{recursive:true,force:true});});
async function action(body){const r=await fetch(base+'/hub/action',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Alma-Token':'owner'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
async function tv(t){const c=await browser.newContext({viewport:{width:1280,height:720}});t.after(()=>c.close());const p=await c.newPage();await p.route('**/$MANAGER_WIDGET/**',r=>r.fulfill({contentType:'application/javascript',body:''}));await p.route('http://192.168.1.249:8080/**',r=>r.fulfill({body:'<state>running</state>'}));await p.route('http://192.168.1.30:8088/**',async r=>{const u=new URL(r.request().url());if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}});try{const response=await fetch(base+u.pathname+u.search,{method:r.request().method(),headers:{Origin:'http://127.0.0.1:8766',...(r.request().postData()?{'Content-Type':'application/json'}:{})},body:r.request().postData()||undefined});const headers=Object.fromEntries(response.headers);delete headers['content-length'];headers['access-control-allow-origin']='*';return r.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});}catch(e){return r.fulfill({status:502,body:'{}'});}});await p.goto('http://127.0.0.1:8766');return p;}

test('Centro de control real reproduce MP4 de la biblioteca y controla pausa, continuación y cola',{timeout:25000},async t=>{
 const p=await tv(t),c=await browser.newContext();t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');await panel.getByRole('tab',{name:'Biblioteca',exact:true}).click();await panel.locator('#sources .item').filter({hasText:'video-prueba'}).getByRole('button',{name:'Reproducir ahora',exact:true}).click();
 await p.waitForFunction(()=>AlmaPlayer.snapshot().playing);assert.equal(await p.locator('#safe').getAttribute('data-view'),'home');await panel.getByRole('tab',{name:'Control',exact:true}).click();await panel.getByRole('button',{name:'Pausar',exact:true}).click();await p.waitForFunction(()=>AlmaPlayer.snapshot().status==='En pausa');await panel.getByRole('button',{name:'Reproducir',exact:true}).click();await p.waitForFunction(()=>AlmaPlayer.snapshot().playing);
 await panel.screenshot({path:'/tmp/alma10-control-mac.png',fullPage:true});await panel.locator('[data-command="volume-down"]').click();await p.waitForFunction(()=>Math.abs(AlmaPlayer.snapshot().volume-0.6)<0.001);assert.equal(await p.evaluate(()=>AlmaTVAudio.active()),false);
 await panel.locator('[data-command="mute"]').click();await p.waitForFunction(()=>AlmaPlayer.snapshot().muted);await panel.locator('[data-command="volume-up"]').click();await p.waitForFunction(()=>!AlmaPlayer.snapshot().muted&&Math.abs(AlmaPlayer.snapshot().volume-0.7)<0.001);
 let volumeRequests=0;panel.on('request',r=>{if(r.url().endsWith('/hub/action')&&r.postDataJSON()?.command==='volume')volumeRequests++;});
 await panel.setViewportSize({width:390,height:844});
 await panel.locator('#volume-slider').evaluate(n=>{for(let i=0;i<=27;i++){n.value=i;n.dispatchEvent(new Event('input',{bubbles:true}));}n.dispatchEvent(new Event('change',{bubbles:true}));});
 await p.waitForFunction(()=>Math.abs(AlmaPlayer.snapshot().volume-.27)<.001&&!AlmaPlayer.snapshot().muted);
 assert.equal(await panel.locator('#volume-value').innerText(),'27 %');assert.equal(volumeRequests,1);
 await panel.screenshot({path:'/tmp/alma-volume-phone.png',fullPage:true});

 await panel.locator('#volume-slider').focus();await panel.keyboard.press('End');await p.waitForFunction(()=>AlmaPlayer.snapshot().volume===1);
 await panel.keyboard.press('Home');await p.waitForFunction(()=>AlmaPlayer.snapshot().volume===0);
 await panel.getByRole('tab',{name:'Biblioteca',exact:true}).click();await panel.locator('#sources .item').filter({hasText:'video-prueba'}).getByRole('button',{name:'Añadir a la cola',exact:true}).click();await panel.getByRole('tab',{name:'Cola',exact:true}).click();await panel.locator('#queue-list .item').first().waitFor();assert.ok((await panel.locator('#queue-list').innerText()).includes('video-prueba'));
});

test('Fotos, tarjeta, escena y QR se muestran en TV usando el puente real',{timeout:25000},async t=>{
 const p=await tv(t);const raw=fs.readFileSync(path.join(ROOT,'app/assets/salvapantallas.png'));
 const upload=await fetch(base+'/hub/upload',{method:'POST',headers:{Origin:base,'X-Alma-Token':'owner','X-Alma-Filename':'foto.png','Content-Type':'application/octet-stream'},body:raw});assert.equal(upload.status,200);const photo=(await upload.json()).item;
 await action({action:'play',source:photo.id});await p.waitForFunction(()=>document.getElementById('safe').getAttribute('data-hub-photo')==='true');assert.match(await p.locator('#home-player').evaluate(n=>n.style.backgroundImage),/hub\/file/);
 const state=await action({action:'source',kind:'card',name:'Menú <b>seguro</b>',body:'Comida $100\nSin ejecución de HTML'});const card=state.sources.find(s=>s.kind==='card');const scenes=await action({action:'scene',name:'Menú y foto',items:[card.id,photo.id],interval:5});await action({action:'play-scene',id:scenes.scenes[0].id});await p.waitForFunction(()=>document.getElementById('hub-card'));assert.ok((await p.locator('#hub-card h2').innerText()).includes('<b>seguro</b>'));assert.equal(await p.locator('#hub-card b').count(),0);assert.equal(await p.locator('#safe').getAttribute('data-view'),'saver');
 await p.evaluate(()=>Alma.go('pair-phone'));await p.waitForFunction(()=>/^\d{6}$/.test(document.getElementById('hub-pair-code').textContent));assert.ok(await p.locator('#hub-pair-qr img').getAttribute('src'));
});

test('Invitado vinculado ve cola y no controles de propietario; el servidor rechaza cambiar reproducción',{timeout:15000},async t=>{
 const state=await (await fetch(base+'/hub/state')).json();const c=await browser.newContext();t.after(()=>c.close());const response=await c.request.post(base+'/hub/pair',{headers:{Origin:base},data:{pin:state.guest_pin}});assert.equal(response.status(),200);const panel=await c.newPage();await panel.goto(base+'/control');assert.ok(!(await panel.locator('#online-play').isVisible()));await panel.locator('#online-url').fill('https://youtu.be/M7lc1UVf-VE');await panel.locator('#online-queue').click();await panel.waitForFunction(()=>document.getElementById('message').textContent.indexOf('recibida')>=0);const config=await panel.evaluate(()=>JSON.parse(document.documentElement.innerHTML.match(/var config=(\{[^;]+\}),state=/)[1]));const bad=await c.request.post(base+'/hub/action',{headers:{Origin:base,'X-Alma-Token':config.token},data:{action:'control',command:'stop'}});assert.equal(bad.status(),403);
});

test('Dailymotion usa SDK, confirma reproducción y permite pausa y saltos sin extraer vídeo (SDK simulado)',{timeout:20000},async t=>{
 const p=await tv(t);await dailymotionFixture(p);
 await action({action:'play',youtube:'https://dai.ly/x84sh87',name:'Dailymotion prueba'});await p.waitForFunction(()=>AlmaYouTube.snapshot().state===1);assert.match(await p.locator('#youtube-frame').getAttribute('src'),/provider=dailymotion/);await action({action:'control',command:'pause'});await p.waitForFunction(()=>AlmaYouTube.snapshot().state===2);await action({action:'control',command:'play'});await p.waitForFunction(()=>AlmaYouTube.snapshot().state===1);const frame=p.frame({url:/dailymotion\/player/});assert.ok(await frame.evaluate(()=>dmPlays>=2));assert.equal(await frame.evaluate(()=>dmOptions.params.autoplay),true);assert.equal(await frame.evaluate(()=>dmLoaded.params.autoplay),true);await action({action:"control",command:"volume-down"});await frame.waitForFunction(()=>Math.abs(window.dmVolume-0.6)<0.001);await action({action:"control",command:"mute"});await frame.waitForFunction(()=>window.dmMuted===true);
});

 test('Celular abre menús, mueve foco, acepta y vuelve con órdenes rápidas sin perderlas',{timeout:25000},async t=>{
 const p=await tv(t),c=await browser.newContext({viewport:{width:390,height:844},isMobile:true});t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');
 await panel.locator('#tv-menu [data-view="apps"]').click();await p.waitForFunction(()=>document.getElementById('safe').getAttribute('data-view')==='apps');
 await panel.waitForFunction(()=>document.querySelector('#tv-menu [aria-current="page"]').getAttribute('data-view')==='apps');
 assert.ok(await panel.locator('#tv-menu img').evaluateAll(nodes=>nodes.every(n=>n.complete&&n.naturalWidth>0)));
 await panel.locator('#tv-menu [data-view="settings"]').click();await p.waitForFunction(()=>document.getElementById('safe').getAttribute('data-view')==='settings');await panel.locator('[data-command="back"]').click();await p.waitForFunction(()=>document.getElementById('safe').getAttribute('data-view')==='apps');
 await panel.locator('#tv-menu [data-view="home"]').click();await p.waitForFunction(()=>document.getElementById('safe').getAttribute('data-view')==='home');
 await panel.locator('[data-command="left"]').click();await panel.locator('[data-command="down"]').click();await panel.locator('[data-command="down"]').click();await panel.locator('[data-command="ok"]').click();await p.waitForFunction(()=>document.getElementById('safe').getAttribute('data-view')==='apps');
 assert.match(await panel.locator('body').evaluate(n=>getComputedStyle(n).backgroundImage),/hub\/background/);assert.ok(await panel.locator('#remote-focus').innerText());assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await panel.screenshot({path:'/tmp/alma10-control-celular.png',fullPage:true});
 });
 test('YouTube Reproducir ahora arranca desde el panel con puente real y no se repite al navegar (API simulada)',{timeout:20000},async t=>{
 const p=await tv(t);await p.evaluate(()=>{HTMLObjectElement.prototype.Open=function(){return 1;};HTMLObjectElement.prototype.Close=function(){return 1;};HTMLObjectElement.prototype.Execute=function(command){if(command==='GetSource')return 18;if(command==='StartPlayback')this.OnEvent(7,0);return 1;};});await p.route('https://www.youtube.com/iframe_api',r=>r.fulfill({contentType:'application/javascript',body:`window.YT={Player:function(id,options){var node=document.getElementById(id),iframe=document.createElement('iframe');node.parentNode.replaceChild(iframe,node);var state=-1;window.youtubeOptions=options;window.youtubePlays=0;window.youtubeVideos=[];this.getPlayerState=function(){return state;};this.getCurrentTime=function(){return 1;};this.getVideoData=function(){return {title:'YouTube prueba'};};window.youtubeVolume=70;this.setVolume=function(v){youtubeVolume=v;};this.getVolume=function(){return youtubeVolume;};this.unMute=function(){};this.setSize=function(){};this.loadVideoById=this.playVideo=function(id){youtubeVideos.push(id);youtubePlays++;state=1;options.events.onStateChange({data:1});};this.pauseVideo=function(){state=2;options.events.onStateChange({data:2});};setTimeout(function(){options.events.onReady();},10);}};window.onYouTubeIframeAPIReady();`}));
 const c=await browser.newContext();t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');await action({action:'control',command:'live-channel',view:'capital21'});await p.waitForFunction(()=>AlmaPlayer.snapshot().native===true);await panel.waitForFunction(()=>document.getElementById('volume-slider').disabled);await panel.locator('#online-url').fill('https://youtu.be/M7lc1UVf-VE');await panel.locator('#online-play').click();await p.waitForFunction(()=>AlmaYouTube.snapshot().state===1);const frame=p.frame({url:/youtube\/player/});assert.equal(await frame.evaluate(()=>youtubeOptions.playerVars.autoplay),0);assert.equal(await frame.evaluate(()=>youtubePlays),1);
 await panel.waitForFunction(()=>!document.getElementById('volume-slider').disabled);
 for(const volume of [25,80]){await panel.locator('#volume-slider').evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));},volume);await frame.waitForFunction(v=>youtubeVolume===v,volume);}
 await p.locator('#youtube-frame').evaluate(n=>n.dataset.almaSession='same');
 for(const [i,id] of ['dQw4w9WgXcQ','dQw4w9WgXcQ'].entries()){await panel.locator('#online-url').fill('https://youtu.be/'+id);await panel.locator('#online-play').click();await frame.waitForFunction(count=>youtubePlays===count,i+2);assert.equal(await frame.evaluate(()=>youtubeVideos[youtubeVideos.length-1]),id);assert.equal(await p.locator('#youtube-frame').getAttribute('data-alma-session'),'same');}
 await panel.locator('#tv-menu [data-view="apps"]').click();await p.waitForFunction(()=>document.getElementById('safe').getAttribute('data-view')==='apps');assert.equal(await frame.evaluate(()=>youtubePlays),3);
 await p.evaluate(()=>{window.webapis={tv:{window:{getAvailableSources:ok=>ok([{type:'HDMI',number:2,id:'HDMI2'}]),setSource:(source,ok)=>ok()}}};});
 await p.locator('#app-6').click();assert.equal(await p.locator('#youtube-frame').count(),0);await p.evaluate(()=>Alma.go('home'));
 await panel.locator('#online-url').fill('https://youtu.be/M7lc1UVf-VE');await panel.locator('#online-play').click();await p.waitForFunction(()=>AlmaYouTube.snapshot().state===1);
 const returned=p.frame({url:/youtube\/player/});assert.equal(await returned.evaluate(()=>youtubePlays),1);assert.equal(await p.locator('#stage').getAttribute('data-home-video'),'true');

 });

async function dailymotionFixture(p){await p.route('https://api.dmcdn.net/all.js',r=>r.fulfill({contentType:'application/javascript',body:`window.DM={player:function(node,options){var f=document.createElement('iframe');f.id='dm-official';node.parentNode.replaceChild(f,node);var handlers={};f.addEventListener=function(n,fn){handlers[n]=fn;};f.title='Dailymotion';window.dmOptions=options;f.currentTime=0;f.duration=120;var loaded=false;f.load=function(id,params){window.dmLoaded={id:id,params:params};setTimeout(function(){loaded=true;handlers.loadedmetadata();if(params.autoplay)f.play();},25);};f.setVolume=function(v){window.dmVolume=v;};f.setMuted=function(v){window.dmMuted=v;};f.play=function(){if(!loaded)return;window.dmPlays=(window.dmPlays||0)+1;handlers.playing();};f.pause=function(){handlers.pause();};f.seek=function(n){f.currentTime=n;if(handlers.timeupdate)handlers.timeupdate({time:n});};setTimeout(function(){handlers.apiready();},10);return f;}};if(window.dmAsyncInit)window.dmAsyncInit();`}));}

 test('Dailymotion inicia desde En tiempo real del panel anterior, sin pulsar en la TV (SDK simulado)',{timeout:20000},async t=>{
 const p=await tv(t);await dailymotionFixture(p);const c=await browser.newContext();t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/enlaces');await panel.locator('#live-url').fill('https://dai.ly/x84sh87');await panel.locator('#live-play').click();await p.waitForFunction(()=>AlmaYouTube.snapshot().state===1);const frame=p.frame({url:/dailymotion\/player/});assert.equal(await frame.evaluate(()=>dmOptions.params.autoplay),true);assert.equal(await frame.evaluate(()=>dmLoaded.params.autoplay),true);await p.evaluate(()=>Alma.go('apps'));assert.equal(await p.evaluate(()=>AlmaYouTube.snapshot().state),1);
 });

test('El panel manda un canal público y la TV recibe el vídeo sin usar el puente como transporte',{timeout:20000},async t=>{
 const p=await tv(t),url='https://video.cdmx.gob.mx/alma-prueba.mp4';
 await p.evaluate(url=>{AlmaLiveTV[0].url=url;},url);
 await p.route(url,r=>r.fulfill({contentType:'video/mp4',body:fs.readFileSync(path.join(ROOT,'tests/fixtures/video-prueba.mp4'))}));
 const c=await browser.newContext();t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');
 await panel.locator('#tabs [data-tab="tv-guide"]').click();await panel.locator('#guide-channels .guide-channel').first().getByRole('button',{name:'Ver en TV',exact:true}).click();
 await p.waitForFunction(()=>AlmaPlayer.snapshot().playing&&AlmaPlayer.snapshot().live);await p.locator('#media-video').evaluate(n=>n.loop=true);
 assert.equal(await p.locator('#media-video').getAttribute('src'),url);assert.equal(await p.locator('#safe').getAttribute('data-view'),'livetv');
});

test('Importar M3U desde el celular sincroniza catálogo, pagina y conserva canales sin puente (señales simuladas)',{timeout:30000},async t=>{
 const p=await tv(t),c=await browser.newContext({viewport:{width:390,height:844}});t.after(()=>c.close());const panel=await c.newPage();const errors=[];panel.on('pageerror',e=>errors.push(e.message));await panel.goto(base+'/control');await panel.locator('#tabs [data-tab="live-tv"]').click();await panel.locator('#iptv-url').fill('https://lists.example.org/test.m3u');await panel.locator('#iptv-import').click();await panel.waitForFunction(()=>document.getElementById('iptv-info').textContent.includes('40 canales'));
 await p.waitForFunction(()=>AlmaLiveTV.length===44);await p.evaluate(()=>Alma.go('livetv'));assert.equal(await p.locator('.live-channel').count(),12);assert.equal(await panel.locator('#live-channels .item').count(),30);
 await panel.locator('#live-next').click();assert.equal(await panel.locator('#live-channels .item').count(),14);
 await p.evaluate(()=>Alma.hubControl('right'));await p.locator('#live-next').click();assert.equal(await p.locator('.live-channel').count(),12);
 // Selecting an entry beyond the old 31-track limit must select that exact channel.
 await p.evaluate(()=>{window.importedIndex=AlmaLiveTV[40].id;window.importedName=AlmaLiveTV[40].name;Alma.hubControl('live-channel',0,importedIndex);});assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().title),await p.evaluate(()=>importedName));
 await panel.locator('#live-search').fill('importado 39');assert.equal(await panel.locator('#live-channels .item').count(),1);
 await panel.screenshot({path:'/tmp/alma-iptv-phone.png',fullPage:true});
 await p.evaluate(()=>{AlmaLiveTV=AlmaLiveTV.slice(0,4);Alma.go('livetv');});assert.equal(await p.locator('.live-channel').count(),4);
 await p.route('http://192.168.1.30:8088/**',r=>r.abort());await p.reload();await p.evaluate(()=>Alma.go('livetv'));assert.equal(await p.evaluate(()=>AlmaLiveTV.length),44);
 await panel.locator('#iptv-search').fill('importado 39');await panel.locator('#iptv-filter button').click();await panel.waitForFunction(()=>document.getElementById('iptv-info').textContent.includes('1 canales'));
 await panel.locator('#iptv-sources').getByRole('button',{name:'Actualizar lista',exact:true}).click();await panel.waitForFunction(()=>!document.getElementById('iptv-import').disabled);assert.equal(await panel.locator('#iptv-sources .item').count(),1);
 const rejected=await c.request.post(base+'/hub/iptv',{headers:{Origin:base,'X-Alma-Token':'wrong'},data:{action:'remove',url:'https://lists.example.org/test.m3u'}});assert.equal(rejected.status(),403);assert.deepEqual(errors,[]);
});

test('Favoritos y categorías del celular se sincronizan, eliminar sobrevive refrescar y cambios de TV llegan a web',{timeout:30000},async t=>{
 const p=await tv(t),c=await browser.newContext({viewport:{width:390,height:844}});t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');await panel.locator('#tabs [data-tab="live-tv"]').click();
 const channel=panel.locator('[data-channel="capital21"]');await channel.getByRole('button',{name:'☆ Favorito',exact:true}).click();await channel.getByRole('button',{name:'★ Favorito',exact:true}).waitFor();await channel.getByRole('combobox').selectOption('Noticias');
 await p.waitForFunction(()=>AlmaLiveTV.some(c=>c.id==='capital21'&&c.category==='Noticias'));await panel.locator('#live-mode').selectOption('favorites');await panel.locator('#live-category-filter').selectOption('Noticias');assert.equal(await panel.locator('#live-channels .item').count(),1);
 await panel.locator('#live-new-category').fill('Mis canales');await panel.locator('#live-category-form button').click();await panel.locator('#live-category-filter option[value="Mis canales"]').waitFor({state:'attached'});await channel.getByRole('combobox').selectOption('Mis canales');
 await p.waitForFunction(()=>AlmaLiveTV.some(c=>c.id==='capital21'&&c.category==='Mis canales'));await panel.locator('#live-category-filter').selectOption('Mis canales');await channel.waitFor();await panel.screenshot({path:'/tmp/alma103-favorites-assigned-phone.png',fullPage:true});
 await p.evaluate(()=>Alma.go('livetv'));await p.locator('#favorite-capital21').click();await panel.waitForFunction(()=>document.querySelectorAll('#live-channels .item').length===0);
 await panel.locator('#live-mode').selectOption('all');await panel.locator('#live-category-filter').selectOption('');panel.on('dialog',d=>d.accept());await channel.getByRole('button',{name:'Eliminar canal',exact:true}).click();await p.waitForFunction(()=>!AlmaLiveTV.some(c=>c.id==='capital21'));
 await panel.getByText('Canales eliminados',{exact:true}).click();await panel.locator('#live-deleted').getByRole('button',{name:'Restaurar canal',exact:true}).click();await p.waitForFunction(()=>AlmaLiveTV.some(c=>c.id==='capital21'));
 // A request replay must not undo absolute favorite assignment or surface an error.
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('alma.live.edits')||'[]').length),0);
 await panel.screenshot({path:'/tmp/alma103-favorites-phone.png',fullPage:true});
});

test('Guía separa navegación de importación, filtra categorías y manda el canal a la TV sin editarlo',{timeout:25000},async t=>{
 const p=await tv(t),context=await browser.newContext({viewport:{width:1280,height:900}});t.after(()=>context.close());for(const data of [{action:'import',url:'https://lists.example.org/test.m3u'},{action:'publish',country:'mx',search:''}]){const response=await context.request.post(base+'/hub/iptv',{headers:{Origin:base,'X-Alma-Token':'owner'},data});assert.equal(response.status(),200);}
 const panel=await context.newPage(),errors=[];panel.on('pageerror',e=>errors.push(e.message));await panel.goto(base+'/control');await panel.locator('#tabs [data-tab="tv-guide"]').click();
 assert.equal(await panel.locator('#guide-channels .guide-channel').count(),20);await panel.locator('#guide-next').click();assert.equal(await panel.locator('#guide-channels .guide-channel').count(),20);await panel.locator('#guide-next').click();assert.equal(await panel.locator('#guide-channels .guide-channel').count(),4);assert.equal(await panel.locator('#guide-next').isDisabled(),true);await panel.locator('#guide-previous').click();
 assert.equal(await panel.locator('#iptv-form').isVisible(),false);assert.equal(await panel.locator('#guide-channels').isVisible(),true);assert.equal(await panel.locator('#tv-guide select').count(),0);assert.equal(await panel.locator('#tv-guide').getByRole('button',{name:'Eliminar canal',exact:true}).count(),0);
 await p.evaluate(()=>{HTMLObjectElement.prototype.Open=function(){return 1;};HTMLObjectElement.prototype.Close=function(){return 1;};HTMLObjectElement.prototype.Execute=function(command){if(command==='GetSource')return 18;if(command==='StartPlayback')this.OnEvent(7,0);return 1;};});
 const before=await (await fetch(base+'/hub/state')).json();const mark=await fetch(base+'/hub/iptv',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Alma-Token':'owner'},body:JSON.stringify({action:'favorite',id:'capital21',enabled:true,category:'Deportes'})});assert.equal(mark.status,200);
 await panel.locator('#guide-categories [data-category="category:Deportes"]').click();await panel.waitForFunction(()=>document.querySelectorAll('#guide-channels .guide-channel').length===1);
 assert.match(await panel.locator('#guide-channels').innerText(),/Capital 21/);assert.match(await panel.locator('#guide-category-title').innerText(),/Deportes/);await panel.locator('#guide-channels').getByRole('button',{name:'Ver en TV',exact:true}).click();await p.waitForFunction(()=>AlmaPlayer.snapshot().playing&&AlmaPlayer.snapshot().title==='Capital 21');
 await panel.waitForFunction(()=>document.querySelector('[data-guide-channel="capital21"]').getAttribute('data-playing')==='true');await panel.screenshot({path:'/tmp/alma-guide-desktop.png',fullPage:true});
 await panel.setViewportSize({width:390,height:844});await panel.screenshot({path:'/tmp/alma-guide-phone.png',fullPage:true});assert.equal(await panel.locator('#guide-categories [aria-pressed="true"]').evaluate(n=>{const b=n.getBoundingClientRect(),v=n.parentNode.getBoundingClientRect();return b.left>=v.left-1&&b.right<=v.right+1;}),true);assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,JSON.stringify(await panel.evaluate(()=>Array.from(document.querySelectorAll('body *')).map(n=>({tag:n.tagName,id:n.id,class:n.className,right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width})).filter(n=>n.right>window.innerWidth+1))));
 const playing=await p.evaluate(()=>AlmaPlayer.snapshot().title);await panel.locator('#guide-search').fill('No existe este canal');assert.equal(await panel.locator('#guide-channels .guide-channel').count(),0);assert.match(await panel.locator('#guide-channels').innerText(),/No hay canales/);assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().title),playing);
 await panel.locator('#tabs [data-tab="live-tv"]').click();assert.equal(await panel.locator('#iptv-form').isVisible(),true);assert.equal(await panel.locator('#guide-channels').isVisible(),false);assert.equal(await panel.locator('#live-channels').getByRole('button',{name:'Ver canal',exact:true}).count(),0);
 await panel.locator('#tab-live-tv').focus();await panel.keyboard.press('ArrowLeft');assert.equal(await panel.locator('#tv-guide').isVisible(),true);await panel.keyboard.press('ArrowRight');assert.equal(await panel.locator('#live-tv').isVisible(),true);
 await panel.locator('#live-search').fill('Once');assert.equal(await panel.locator('#live-channels .item').count(),1);await panel.screenshot({path:'/tmp/alma-guide-import-search-phone.png',fullPage:true});
 const after=await (await fetch(base+'/hub/state')).json();assert.deepEqual(after.iptv.sources,before.iptv.sources);assert.deepEqual(errors,[]);
});
