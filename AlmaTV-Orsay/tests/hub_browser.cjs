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
def playlist_open(url,headers=None,allow_redirect=False,allow_custom_port=False,timeout=12):
 if url not in ('https://lists.example.org/test.m3u','https://lists.example.org/segunda.m3u'): return _original_open(url,headers,allow_redirect,allow_custom_port,timeout)
 data=('#EXTM3U\\n'+''.join('#EXTINF:-1 tvg-id="Fixture%d.mx",Canal importado %d\\nhttps://streams.example.org/%d.m3u8\\n'%(i,i,i) for i in range(40))).encode()
 if url.endswith('segunda.m3u'): data=b'#EXTM3U\\n#EXTINF:-1 tvg-country="US",Segunda lista uno\\nhttps://streams.example.org/second-one.m3u8\\n#EXTINF:-1 tvg-country="US",Segunda lista dos\\nhttps://streams.example.org/second-two.m3u8\\n'
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
 await p.waitForFunction(()=>AlmaPlayer.snapshot().playing);assert.equal(await p.locator('#safe').getAttribute('data-view'),'home');await panel.getByRole('tab',{name:'Control',exact:true}).click();await panel.locator('#mode-remote').click();await panel.getByRole('button',{name:'Pausar',exact:true}).click();await p.waitForFunction(()=>AlmaPlayer.snapshot().status==='En pausa');await panel.getByRole('button',{name:'Reproducir',exact:true}).click();await p.waitForFunction(()=>AlmaPlayer.snapshot().playing);
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
 const c=await browser.newContext();t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');await panel.locator('#mode-remote').click();await action({action:'control',command:'live-channel',view:'capital21'});await p.waitForFunction(()=>AlmaPlayer.snapshot().native===true);await panel.waitForFunction(()=>document.getElementById('volume-slider').disabled);await panel.locator('#online-url').fill('https://youtu.be/M7lc1UVf-VE');await panel.locator('#online-play').click();await p.waitForFunction(()=>AlmaYouTube.snapshot().state===1);const frame=p.frame({url:/youtube\/player/});assert.equal(await frame.evaluate(()=>youtubeOptions.playerVars.autoplay),0);assert.equal(await frame.evaluate(()=>youtubePlays),1);
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
 await p.waitForFunction(()=>!!localStorage.getItem('alma.live.catalog'));
 await p.evaluate(url=>{AlmaLiveTV[0].url=url;},url);
 await p.route(url,r=>r.fulfill({contentType:'video/mp4',body:fs.readFileSync(path.join(ROOT,'tests/fixtures/video-prueba.mp4'))}));
 const c=await browser.newContext();t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');
 await panel.locator('#tabs [data-tab="tv-guide"]').click();await panel.locator('#guide-channels .guide-channel').first().getByRole('button',{name:'Ver en TV',exact:true}).click();
 await p.waitForFunction(()=>AlmaPlayer.snapshot().playing&&AlmaPlayer.snapshot().live);await p.locator('#media-video').evaluate(n=>n.loop=true);
 assert.equal(await p.locator('#media-video').getAttribute('src'),url);assert.equal(await p.locator('#safe').getAttribute('data-view'),'livetv');
});

test('Importar M3U desde el celular sincroniza catálogo, pagina y conserva canales sin puente (señales simuladas)',{timeout:30000},async t=>{
 const p=await tv(t),c=await browser.newContext({viewport:{width:390,height:844}});t.after(()=>c.close());const panel=await c.newPage();const errors=[];panel.on('pageerror',e=>errors.push(e.message));await panel.goto(base+'/control');await panel.locator('#tabs [data-tab="live-tv"]').click();await panel.locator('#iptv-url').fill('https://lists.example.org/test.m3u');await panel.locator('#iptv-import').click();await panel.waitForFunction(()=>document.getElementById('iptv-info').textContent.includes('40 canales'));
 await p.waitForFunction(()=>AlmaLiveTV.length===44);await p.evaluate(()=>Alma.go('livetv'));if(await p.locator('#live-section-0').count())await p.locator('#live-section-0').click();assert.equal(await p.locator('.live-channel').count(),12);assert.equal(await panel.locator('#live-channels .item').count(),30);
 await panel.locator('#live-next').click();assert.equal(await panel.locator('#live-channels .item').count(),14);
 await p.evaluate(()=>Alma.hubControl('right'));await p.locator('#live-next').click();assert.equal(await p.locator('.live-channel').count(),12);
 // Selecting an entry beyond the old 31-track limit must select that exact channel.
 await p.evaluate(()=>{window.importedIndex=AlmaLiveTV[40].id;window.importedName=AlmaLiveTV[40].name;Alma.hubControl('live-channel',0,importedIndex);});assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().title),await p.evaluate(()=>importedName));
 await panel.locator('#live-search').fill('importado 39');assert.equal(await panel.locator('#live-channels .item').count(),1);
 await panel.screenshot({path:'/tmp/alma-iptv-phone.png',fullPage:true});
 await p.evaluate(()=>{AlmaLiveTV=AlmaLiveTV.slice(0,4);Alma.go('livetv');});if(await p.locator('#live-section-0').count())await p.locator('#live-section-0').click();assert.equal(await p.locator('.live-channel').count(),4);
 await p.route('http://192.168.1.30:8088/**',r=>r.abort());await p.reload();await p.evaluate(()=>Alma.go('livetv'));if(await p.locator('#live-section-0').count())await p.locator('#live-section-0').click();assert.equal(await p.evaluate(()=>AlmaLiveTV.length),44);
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
 await p.evaluate(()=>Alma.go('livetv'));if(await p.locator('#live-section-0').count())await p.locator('#live-section-0').click();await p.locator('#favorite-capital21').click();await panel.waitForFunction(()=>document.querySelectorAll('#live-channels .item').length===0);
 await panel.locator('#live-mode').selectOption('all');await panel.locator('#live-category-filter').selectOption('');panel.on('dialog',d=>d.accept());await channel.getByRole('button',{name:'Eliminar canal',exact:true}).click();await p.waitForFunction(()=>!AlmaLiveTV.some(c=>c.id==='capital21'));
 await panel.getByText('Canales eliminados',{exact:true}).click();await panel.locator('#live-deleted').getByRole('button',{name:'Restaurar canal',exact:true}).click();await p.waitForFunction(()=>AlmaLiveTV.some(c=>c.id==='capital21'));
 // A request replay must not undo absolute favorite assignment or surface an error.
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('alma.live.edits')||'[]').length),0);
 await panel.screenshot({path:'/tmp/alma103-favorites-phone.png',fullPage:true});
});

test('Guía permite marcar favoritos, asignar categorías, navegar y reproducir sin salir de ella',{timeout:25000},async t=>{
 const p=await tv(t),context=await browser.newContext({viewport:{width:1280,height:900}});t.after(()=>context.close());for(const data of [{action:'import',url:'https://lists.example.org/test.m3u'},{action:'publish',country:'mx',search:''}]){const response=await context.request.post(base+'/hub/iptv',{headers:{Origin:base,'X-Alma-Token':'owner'},data});assert.equal(response.status(),200);}
 const panel=await context.newPage(),errors=[];panel.on('pageerror',e=>errors.push(e.message));await panel.goto(base+'/control');await panel.locator('#tabs [data-tab="tv-guide"]').click();await panel.locator('[data-guide-channel]').first().waitFor();
 assert.equal(await panel.locator('#guide-channels .guide-channel').count(),20);await panel.locator('#guide-next').click();await panel.waitForFunction(()=>document.getElementById('guide-page').textContent==='2 / 3');assert.equal(await panel.locator('#guide-channels .guide-channel').count(),20);await panel.locator('#guide-next').click();await panel.waitForFunction(()=>document.getElementById('guide-page').textContent==='3 / 3');assert.equal(await panel.locator('#guide-channels .guide-channel').count(),4);assert.equal(await panel.locator('#guide-next').isDisabled(),true);await panel.locator('#guide-previous').click();
 assert.equal(await panel.locator('#iptv-form').isVisible(),false);assert.equal(await panel.locator('#guide-channels').isVisible(),true);await panel.waitForFunction(()=>document.querySelectorAll('#guide-channels .guide-channel').length===20);assert.equal(await panel.locator('#tv-guide select').count(),21);assert.equal(await panel.locator('#tv-guide').getByRole('button',{name:'Eliminar canal',exact:true}).count(),0);
 await p.evaluate(()=>{HTMLObjectElement.prototype.Open=function(){return 1;};HTMLObjectElement.prototype.Close=function(){return 1;};HTMLObjectElement.prototype.Execute=function(command){if(command==='GetSource')return 18;if(command==='StartPlayback')this.OnEvent(7,0);return 1;};});
 const before=await (await fetch(base+'/hub/state')).json();await panel.waitForFunction(()=>document.getElementById('guide-page').textContent==='2 / 3');await panel.locator('#guide-previous').click();await panel.waitForFunction(()=>document.getElementById('guide-page').textContent==='1 / 3');
 const favorite=panel.locator('[data-guide-channel="capital21"]');await favorite.getByRole('button',{name:'☆ Favorito',exact:true}).click();await favorite.getByRole('button',{name:'★ Favorito',exact:true}).waitFor();await favorite.getByRole('combobox').selectOption('Deportes');await p.waitForFunction(()=>AlmaLiveTV.some(c=>c.id==='capital21'&&c.category==='Deportes'));
 await panel.locator('#guide-categories [data-category="category:Deportes"]').click();await panel.waitForFunction(()=>document.querySelectorAll('#guide-channels .guide-channel').length===1);
 assert.match(await panel.locator('#guide-channels').innerText(),/Capital 21/);assert.match(await panel.locator('#guide-category-title').innerText(),/Deportes/);await panel.locator('#guide-channels').getByRole('button',{name:'Ver en TV',exact:true}).click();await p.waitForFunction(()=>AlmaPlayer.snapshot().playing&&AlmaPlayer.snapshot().title==='Capital 21');
 await panel.waitForFunction(()=>document.querySelector('[data-guide-channel="capital21"]').getAttribute('data-playing')==='true');await panel.screenshot({path:'/tmp/alma-guide-desktop.png',fullPage:true});
 await panel.setViewportSize({width:390,height:844});await panel.screenshot({path:'/tmp/alma-guide-phone.png',fullPage:true});assert.equal(await panel.locator('#guide-categories [aria-pressed="true"]').evaluate(n=>{const b=n.getBoundingClientRect(),v=n.parentNode.getBoundingClientRect();return b.left>=v.left-1&&b.right<=v.right+1;}),true);assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,JSON.stringify(await panel.evaluate(()=>Array.from(document.querySelectorAll('body *')).map(n=>({tag:n.tagName,id:n.id,class:n.className,right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width})).filter(n=>n.right>window.innerWidth+1))));
 const playing=await p.evaluate(()=>AlmaPlayer.snapshot().title);
 await panel.locator('[data-guide-channel="capital21"]').getByRole('combobox').selectOption('Noticias');await panel.waitForFunction(()=>document.querySelectorAll('#guide-channels .guide-channel').length===0);await p.waitForFunction(()=>AlmaLiveTV.some(c=>c.id==='capital21'&&c.category==='Noticias'));assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().playing),true);
 await panel.locator('#guide-categories [data-category="category:Noticias"]').click();await panel.locator('[data-guide-channel="capital21"]').getByRole('button',{name:'★ Favorito',exact:true}).click();await panel.waitForFunction(()=>document.querySelectorAll('#guide-channels .guide-channel').length===0);await p.waitForFunction(()=>AlmaLiveTV.some(c=>c.id==='capital21'&&!c.favorite));assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().playing),true);
 await panel.locator('#guide-categories [data-category="all"]').click();await panel.locator('#guide-search').fill('No existe este canal');await panel.waitForFunction(()=>document.getElementById('guide-channels').textContent.includes('No hay canales'));assert.equal(await panel.locator('#guide-channels .guide-channel').count(),0);assert.match(await panel.locator('#guide-channels').innerText(),/No hay canales/);assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().title),playing);
 await panel.locator('#tabs [data-tab="live-tv"]').click();assert.equal(await panel.locator('#iptv-form').isVisible(),true);assert.equal(await panel.locator('#guide-channels').isVisible(),false);assert.equal(await panel.locator('#live-channels').getByRole('button',{name:'Ver canal',exact:true}).count(),0);
 await panel.locator('#tab-live-tv').focus();await panel.keyboard.press('ArrowLeft');assert.equal(await panel.locator('#tv-guide').isVisible(),true);await panel.keyboard.press('ArrowRight');assert.equal(await panel.locator('#live-tv').isVisible(),true);
 await panel.locator('#live-search').fill('Once');assert.equal(await panel.locator('#live-channels .item').count(),1);await panel.screenshot({path:'/tmp/alma-guide-import-search-phone.png',fullPage:true});
 const after=await (await fetch(base+'/hub/state')).json();assert.deepEqual(after.iptv.sources,before.iptv.sources);assert.deepEqual(errors,[]);
});

test('Selector de listas muestra todas por defecto, filtra sin publicar ni parar video y reproduce fuera del catálogo de TV',{timeout:30000},async t=>{
 const p=await tv(t),context=await browser.newContext({viewport:{width:390,height:844}});t.after(()=>context.close());
 for(const data of [{action:'import',url:'https://lists.example.org/test.m3u'},{action:'import',url:'https://lists.example.org/segunda.m3u'},{action:'publish',country:'mx',search:'importado 39'}]){const r=await context.request.post(base+'/hub/iptv',{headers:{Origin:base,'X-Alma-Token':'owner'},data});assert.equal(r.status(),200);}
 const before=await (await fetch(base+'/hub/state')).json(),panel=await context.newPage(),errors=[];panel.on('pageerror',e=>errors.push(e.message));await panel.goto(base+'/control');await panel.locator('#tabs [data-tab="tv-guide"]').click();await panel.locator('[data-guide-channel]').first().waitFor();assert.equal(await panel.locator('#guide-list').inputValue(),'all');assert.equal(await panel.locator('#guide-count').innerText(),'46 canales');
 const firstList=await panel.locator('#guide-list option').filter({hasText:'test.m3u'}).getAttribute('value'),secondList=await panel.locator('#guide-list option').filter({hasText:'segunda.m3u'}).getAttribute('value');
 await panel.locator('#guide-list').selectOption(secondList);await panel.waitForFunction(()=>document.getElementById('guide-count').textContent==='2 canales');assert.equal(await panel.locator('#guide-channels .guide-channel').count(),2);assert.match(await panel.locator('#guide-channels').innerText(),/Segunda lista/);assert.doesNotMatch(await panel.locator('#guide-channels').innerText(),/Capital 21|importado/);
 const selectedId=await panel.locator('#guide-channels .guide-channel').first().getAttribute('data-guide-channel');assert.equal(before.live_tv.some(c=>c.id===selectedId),false);
 await p.evaluate(()=>{window.guideStarts=0;HTMLObjectElement.prototype.Open=function(){return 1;};HTMLObjectElement.prototype.Close=function(){return 1;};HTMLObjectElement.prototype.Execute=function(command){if(command==='GetSource')return 18;if(command==='StartPlayback'){guideStarts++;this.OnEvent(7,0);}return 1;};});
 await panel.locator('#guide-channels .guide-channel').first().getByRole('button',{name:'Ver en TV',exact:true}).click();await p.waitForFunction(id=>AlmaLiveTV.some(c=>c.id===id)&&AlmaPlayer.snapshot().playing,selectedId);assert.match(await p.evaluate(()=>AlmaPlayer.snapshot().title),/Segunda lista/);
 await panel.locator('#guide-list').selectOption(firstList);await panel.waitForFunction(()=>document.getElementById('guide-count').textContent==='40 canales');assert.equal(await p.evaluate(()=>guideStarts),1);assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().playing),true);const after=await (await fetch(base+'/hub/state')).json();assert.equal(after.iptv.country,before.iptv.country);assert.equal(after.iptv.search,before.iptv.search);
 await panel.locator('#guide-list').selectOption(secondList);await panel.waitForFunction(()=>document.getElementById('guide-count').textContent==='2 canales');await panel.locator('#guide-channels .guide-channel').first().getByRole('combobox').selectOption('Streaming');await panel.locator('#guide-categories [data-category="category:Streaming"]').click();await panel.waitForFunction(()=>document.getElementById('guide-count').textContent==='1 canal');
 await panel.waitForFunction(()=>document.getElementById('guide-now').textContent.includes('Segunda lista')&&document.getElementById('guide-now').textContent.includes('Reproduciendo'));await panel.screenshot({path:'/tmp/alma-guide-listas-celular.png',fullPage:true});assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.equal(await p.evaluate(()=>guideStarts),1);
 await panel.setViewportSize({width:1280,height:900});await panel.screenshot({path:'/tmp/alma-guide-listas-laptop.png',fullPage:true});await panel.reload();await panel.locator('#tabs [data-tab="tv-guide"]').click();await panel.locator('[data-guide-channel]').first().waitFor();assert.equal(await panel.locator('#guide-list').inputValue(),'all');assert.deepEqual(errors,[]);
});

test('Desactivar una lista oculta sus canales normales y conserva favorito, categoría y reproducción',{timeout:25000},async t=>{
 const p=await tv(t),context=await browser.newContext({viewport:{width:390,height:844}});t.after(()=>context.close());
 for(const data of [{action:'import',url:'https://lists.example.org/test.m3u'},{action:'publish',country:'',search:''}]){
  const r=await context.request.post(base+'/hub/iptv',{headers:{Origin:base,'X-Alma-Token':'owner'},data});assert.equal(r.status(),200);
 }
 await p.waitForFunction(()=>AlmaLiveTV.some(c=>c.name==='Canal importado 39'));
 const ident=await p.evaluate(()=>AlmaLiveTV.find(c=>c.name==='Canal importado 39').id);
 const favorite=await context.request.post(base+'/hub/iptv',{headers:{Origin:base,'X-Alma-Token':'owner'},data:{action:'favorite',id:ident,enabled:true,category:'Noticias'}});assert.equal(favorite.status(),200);
 await p.evaluate(()=>{HTMLObjectElement.prototype.Open=function(){return 1;};HTMLObjectElement.prototype.Close=function(){return 1;};HTMLObjectElement.prototype.Execute=function(command){if(command==='GetSource')return 18;if(command==='StartPlayback')this.OnEvent(7,0);return 1;};});
 await p.evaluate(id=>Alma.hubControl('live-channel',0,id),ident);await p.waitForFunction(()=>AlmaPlayer.snapshot().playing);
 const panel=await context.newPage();await panel.goto(base+'/control');await panel.locator('#tabs [data-tab="live-tv"]').click();
 const source=panel.locator('#iptv-sources .item').filter({hasText:'lists.example.org/test.m3u'});
 await source.getByRole('button',{name:'Desactivar lista',exact:true}).click();await source.getByRole('button',{name:'Activar lista',exact:true}).waitFor();
 await p.waitForFunction(id=>AlmaLiveTV.some(c=>c.id===id&&c.favorite&&c.category==='Noticias')&&!AlmaLiveTV.some(c=>c.name==='Canal importado 0'),ident);
 assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().playing),true);
 await panel.locator('#tabs [data-tab="tv-guide"]').click();await panel.locator('#guide-search').fill('Canal importado');
 await panel.waitForFunction(()=>document.querySelectorAll('#guide-channels .guide-channel').length===1);
 assert.match(await panel.locator('#guide-channels').innerText(),/Canal importado 39/);
 await panel.locator('#tabs [data-tab="live-tv"]').click();await source.getByRole('button',{name:'Activar lista',exact:true}).click();await source.getByRole('button',{name:'Desactivar lista',exact:true}).waitFor();
 await p.waitForFunction(()=>AlmaLiveTV.some(c=>c.name==='Canal importado 0'));
 assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().playing),true);
});

test('Panel experimental envía audio adicional sin reemplazar el video principal',{timeout:20000},async t=>{
 const p=await tv(t);await p.route('https://www.youtube.com/iframe_api',r=>r.fulfill({contentType:'application/javascript',body:`window.YT={Player:function(id,options){var node=document.getElementById(id),f=document.createElement('iframe');node.parentNode.replaceChild(f,node);var state=-1,muted=false,volume=70;this.getPlayerState=function(){return state;};this.getCurrentTime=function(){return 1;};this.getVideoData=function(){return {title:'Prueba dual'};};this.setVolume=function(v){volume=v;};this.getVolume=function(){return volume;};this.mute=function(){muted=true;};this.unMute=function(){muted=false;};this.isMuted=function(){return muted;};this.setSize=function(){};this.loadVideoById=this.playVideo=function(){state=1;options.events.onStateChange({data:1});};this.pauseVideo=function(){state=2;options.events.onStateChange({data:2});};setTimeout(function(){options.events.onReady();},10);}};window.onYouTubeIframeAPIReady();`}));
 const c=await browser.newContext();t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');
 await panel.locator('#online-url').fill('https://youtu.be/M7lc1UVf-VE');await panel.locator('#online-play').click();await p.waitForFunction(()=>AlmaYouTube.snapshot().state===1);
 const before=await(await fetch(base+'/hub/state')).json();const original=await p.locator('#youtube-frame').getAttribute('src');
 await panel.locator('#online-mode').selectOption('background');await panel.locator('#online-url').fill('https://youtu.be/dQw4w9WgXcQ');await panel.locator('#online-play').click();
 await p.waitForFunction(()=>AlmaBackgroundAudio.snapshot().state===1);assert.equal(await p.locator('#youtube-frame').getAttribute('src'),original);
 assert.equal(await p.evaluate(()=>AlmaYouTube.snapshot().muted),true);
 const after=await(await fetch(base+'/hub/state')).json();assert.equal(after.current.play_id,before.current.play_id);
 await panel.locator('[data-command="background-pause"]').click();await p.waitForFunction(()=>AlmaBackgroundAudio.snapshot().state===2);assert.equal(await p.evaluate(()=>AlmaYouTube.snapshot().state),1);
 await panel.locator('[data-command="background-play"]').click();await p.waitForFunction(()=>AlmaBackgroundAudio.snapshot().state===1);
 await panel.locator('[data-command="background-stop"]').click();await p.waitForFunction(()=>!AlmaBackgroundAudio.snapshot().active);await p.waitForFunction(()=>AlmaYouTube.snapshot().muted===false);
 assert.equal(await p.evaluate(()=>AlmaYouTube.snapshot().state),1);
});

test('Guía web reproduce directamente en Inicio y vuelve al fondo sin reiniciar el canal',{timeout:20000},async t=>{
 const p=await tv(t),c=await browser.newContext({viewport:{width:390,height:844}});t.after(()=>c.close());
 await p.evaluate(()=>{HTMLObjectElement.prototype.Open=function(){return 1;};HTMLObjectElement.prototype.Close=function(){return 1;};HTMLObjectElement.prototype.Execute=function(command){if(command==='GetSource')return 18;if(command==='StartPlayback')this.OnEvent(7,0);return 1;};});
 const panel=await c.newPage();await panel.goto(base+'/control');await panel.locator('#tabs [data-tab="tv-guide"]').click();
 await panel.locator('[data-guide-channel="capital21"]').getByRole('button',{name:'Reproducir en Inicio',exact:true}).click();
 await p.waitForFunction(()=>AlmaPlayer.snapshot().playing&&document.getElementById('safe').getAttribute('data-view')==='home');
 assert.equal(await p.locator('#stage').getAttribute('data-home-video'),'true');
 const before=await p.evaluate(()=>AlmaPlayer.snapshot().title);
 await p.evaluate(()=>Alma.hubControl('fullscreen'));assert.equal(await p.locator('#stage').evaluate(n=>getComputedStyle(n).visibility),'hidden');
 await panel.locator('#tabs [data-tab="control"]').click();await panel.locator('[data-command="play-home"]').click();
 await p.waitForFunction(()=>getComputedStyle(document.getElementById('stage')).visibility!=='hidden');
 await p.evaluate(()=>Alma.go('livetv'));
 await panel.locator('#tabs [data-tab="control"]').click();await panel.locator('[data-command="play-home"]').click();
 await p.waitForFunction(()=>document.getElementById('safe').getAttribute('data-view')==='home');
 assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().title),before);assert.equal(await p.evaluate(()=>AlmaPlayer.snapshot().playing),true);
 assert.equal(await panel.locator('[data-command="background-play"]').count(),1);assert.equal(await panel.locator('[data-command="background-pause"]').count(),1);
 assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});

test('Volumen web admite bajar y subir con change sin input y no captura las teclas Samsung',{timeout:20000},async t=>{
 const p=await tv(t),c=await browser.newContext();t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');
 await panel.getByRole('tab',{name:'Biblioteca',exact:true}).click();await panel.locator('#sources .item').filter({hasText:'video-prueba'}).getByRole('button',{name:'Reproducir ahora',exact:true}).click();await p.waitForFunction(()=>AlmaPlayer.snapshot().playing);
 await panel.getByRole('tab',{name:'Control',exact:true}).click();
 for(const level of [20,85,0,100]){
  await panel.locator('#volume-slider').evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('change',{bubbles:true}));},level);
  await p.waitForFunction(v=>Math.abs(AlmaPlayer.snapshot().volume-v/100)<.001,level);
 }
 assert.deepEqual(await p.evaluate(()=>[7,11,27].map(code=>Alma.key(code))),[false,false,false]);assert.equal(await p.evaluate(()=>AlmaTVAudio.active()),false);
});

test('Laptop carga MP3 y el panel alterna música y sonido del fondo sin reemplazarlo',{timeout:25000},async t=>{
 const p=await tv(t);await dailymotionFixture(p);
 await action({action:'play',youtube:'https://dai.ly/x84sh87',name:'Mi fondo'});await p.waitForFunction(()=>AlmaYouTube.snapshot().state===1);
 const src=await p.locator('#youtube-frame').getAttribute('src'),frame=p.frame({url:/dailymotion\/player/});
 const original=(await(await fetch(base+'/hub/state')).json()).current.play_id;
 const c=await browser.newContext();t.after(()=>c.close());const panel=await c.newPage();await panel.goto(base+'/control');
 await panel.getByRole('tab',{name:'Biblioteca',exact:true}).click();
 await panel.locator('#upload').setInputFiles({name:'musica-laptop.mp3',mimeType:'audio/mpeg',buffer:fs.readFileSync(path.join(ROOT,'app/assets/media/prueba-sonido.mp3'))});
 await panel.locator('#sources .item').filter({hasText:'musica-laptop'}).getByRole('button',{name:'Reproducir música sobre el fondo',exact:true}).click();
 await p.waitForFunction(()=>AlmaMusic.snapshot().playing&&document.getElementById('background-music').readyState>=2);await frame.waitForFunction(()=>dmMuted);
 await panel.getByRole('tab',{name:'Control',exact:true}).click();await panel.locator('#music-mute').click();
 await frame.waitForFunction(()=>!dmMuted);assert.equal(await p.evaluate(()=>document.getElementById('background-music').muted),true);
 await panel.waitForFunction(()=>document.getElementById('music-mute').getAttribute('aria-pressed')==='true');await panel.locator('#music-mute').click();await frame.waitForFunction(()=>dmMuted);
 await panel.locator('[data-command="music-pause"]').click();await frame.waitForFunction(()=>!dmMuted);
 await panel.locator('[data-command="music-play"]').click();await p.waitForFunction(()=>AlmaMusic.snapshot().playing);await frame.waitForFunction(()=>dmMuted);
 await panel.locator('[data-command="music-stop"]').click();await p.waitForFunction(()=>!AlmaMusic.snapshot().active);await frame.waitForFunction(()=>!dmMuted);
 assert.equal(await p.locator('#youtube-frame').getAttribute('src'),src);assert.equal((await(await fetch(base+'/hub/state')).json()).current.play_id,original);
});

test('Vista TV de laptop reproduce los menús reales y permite pulsar apps sin consumir video',{timeout:35000},async t=>{
 const p=await tv(t),c=await browser.newContext({viewport:{width:1440,height:1000}});t.after(()=>c.close());const panel=await c.newPage();await action({action:'control',command:'stop'});await p.waitForFunction(()=>!document.getElementById('youtube-frame'));await panel.goto(base+'/control');
 await panel.waitForFunction(()=>document.getElementById('touch-status').textContent==='Interfaz sincronizada con tu TV');
 const touch=()=>panel.frame({url:'about:srcdoc'});
 await panel.waitForFunction(()=>document.getElementById('touch-frame').contentDocument&&document.getElementById('touch-frame').contentDocument.getElementById('nav-2'));
 await touch().locator('#nav-2').click();await p.waitForFunction(()=>Alma.hubConfig().view==='apps');
 await panel.waitForFunction(()=>document.getElementById('touch-frame').contentDocument.getElementById('safe')&&document.getElementById('touch-frame').contentDocument.getElementById('safe').getAttribute('data-view')==='apps');
 assert.equal(await touch().locator('.apps-grid .app').count(),await p.locator('.apps-grid .app').count());
 const clock=await p.locator('.apps-grid .app img').count();assert.ok(clock>0);
 await touch().getByRole('button',{name:'Reloj',exact:true}).click();await p.waitForFunction(()=>Alma.hubConfig().view==='clock');
 await panel.waitForFunction(()=>document.getElementById('touch-frame').contentDocument.getElementById('safe')&&document.getElementById('touch-frame').contentDocument.getElementById('safe').getAttribute('data-view')==='clock');
 await panel.locator('[data-top-command="home"]').click();await p.waitForFunction(()=>Alma.hubConfig().view==='home');
 await panel.waitForFunction(()=>document.getElementById('touch-frame').contentDocument.getElementById('safe')&&document.getElementById('touch-frame').contentDocument.getElementById('safe').getAttribute('data-view')==='home');
 await touch().locator('#nav-1').click();await p.waitForFunction(()=>Alma.hubConfig().view==='search');
 await panel.waitForFunction(()=>document.getElementById('touch-frame').contentDocument.getElementById('search-edit'));
 await touch().locator('#search-edit').click();await panel.waitForFunction(()=>document.getElementById('touch-frame').contentDocument.getElementById('key-0-0'));
 await touch().locator('#key-0-0').click();await p.waitForFunction(()=>document.getElementById('editor-value').value==='a');
 await panel.waitForFunction(()=>document.getElementById('touch-frame').contentDocument.getElementById('editor-value')&&document.getElementById('touch-frame').contentDocument.getElementById('editor-value').value==='a');
 await touch().locator('#edit-cancel').click();await p.waitForFunction(()=>document.getElementById('dialog').style.display==='none');await panel.locator('[data-top-command="home"]').click();await p.waitForFunction(()=>Alma.hubConfig().view==='home');
 await panel.waitForFunction(()=>document.getElementById('touch-frame').contentDocument.getElementById('safe')&&document.getElementById('touch-frame').contentDocument.getElementById('safe').getAttribute('data-view')==='home');
 assert.equal(await panel.locator('#touch-preview').getAttribute('src'),null);
 await panel.locator('#message').evaluate(n=>n.dataset.visible='false');await panel.screenshot({path:'/tmp/alma1118-control-laptop.png',fullPage:true});
 await panel.locator('#mode-remote').click();assert.equal(await panel.locator('#remote-panel').isVisible(),true);
 for(const width of [390,320]){
  await panel.setViewportSize({width,height:844});
  for(const tab of ['library','queue','tv-guide','devices','control']){
   await panel.locator('#tab-'+tab).click();assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+tab+' '+width);
   const visible=await panel.locator('#tabs button').evaluateAll(ns=>{var clip=document.getElementById('tabs'),b=clip.getBoundingClientRect(),left=b.left+clip.clientLeft,right=left+clip.clientWidth;return ns.map(n=>n.getBoundingClientRect()).filter(r=>r.right>left+1&&r.left<right-1).map(r=>r.left>=left-1&&r.right<=right+1);});assert.equal(visible.length,5);assert.ok(visible.every(Boolean));
  }
 }
 await panel.setViewportSize({width:390,height:844});await panel.locator('#tab-control').click();await panel.locator('#message').evaluate(n=>n.dataset.visible='false');await panel.screenshot({path:'/tmp/alma1118-control-telefono.png',fullPage:true});
});

test('Vista previa de YouTube se activa aparte, queda silenciada y no cambia la sesión de la TV',{timeout:20000},async t=>{
 const p=await tv(t);await p.route('https://www.youtube.com/iframe_api',r=>r.fulfill({contentType:'application/javascript',body:`window.YT={Player:function(id,o){var n=document.getElementById(id),f=document.createElement('iframe');n.parentNode.replaceChild(f,n);var s=-1;this.getPlayerState=function(){return s;};this.getCurrentTime=function(){return 42;};this.getVideoData=function(){return {title:'Fondo'};};this.setVolume=function(){};this.getVolume=function(){return 70;};this.mute=function(){};this.unMute=function(){};this.isMuted=function(){return false;};this.setSize=function(){};this.playVideo=function(){s=1;o.events.onStateChange({data:1});};this.pauseVideo=function(){s=2;o.events.onStateChange({data:2});};setTimeout(function(){o.events.onReady();},0);}};window.onYouTubeIframeAPIReady();`}));
 await action({action:'play',youtube:'https://youtu.be/M7lc1UVf-VE'});await p.waitForFunction(()=>AlmaYouTube.snapshot().state===1);const src=await p.locator('#youtube-frame').getAttribute('src');
 const c=await browser.newContext({viewport:{width:1440,height:900}});t.after(()=>c.close());const panel=await c.newPage();await panel.route('https://www.youtube.com/embed/**',r=>r.fulfill({contentType:'text/html',body:'<body>Vista previa simulada</body>'}));await panel.route('https://www.youtube.com/iframe_api',r=>r.fulfill({contentType:'application/javascript',body:`window.YT={Player:function(){window.previewSeek=0;window.previewMuted=false;this.mute=function(){previewMuted=true;};this.getCurrentTime=function(){return previewSeek;};this.seekTo=function(v){previewSeek=v;};this.playVideo=function(){};this.pauseVideo=function(){};this.loadVideoById=function(){};var options=arguments[1];setTimeout(function(){options.events.onReady();},0);}};window.onYouTubeIframeAPIReady();`}));await panel.goto(base+'/control');
 await panel.waitForFunction(()=>document.getElementById('touch-status').textContent==='Interfaz sincronizada con tu TV');assert.equal(await panel.locator('#touch-preview').isVisible(),false);
 await p.waitForFunction(()=>AlmaYouTube.snapshot().seconds===42);await panel.waitForFunction(()=>document.getElementById('touch-status').textContent==='Interfaz sincronizada con tu TV');
 await panel.locator('#touch-video').click();await panel.waitForFunction(()=>document.getElementById('touch-preview').src.includes('M7lc1UVf-VE'));
 const url=new URL(await panel.locator('#touch-preview').getAttribute('src'));assert.equal(url.searchParams.get('mute'),'1');assert.ok(Number(url.searchParams.get('start'))>=0);await panel.waitForFunction(()=>window.previewSeek===42&&window.previewMuted===true);
 assert.equal(await p.locator('#youtube-frame').getAttribute('src'),src);assert.equal(await p.evaluate(()=>AlmaYouTube.snapshot().state),1);
 await panel.locator('#mode-remote').click();assert.equal(await panel.locator('#touch-preview').isVisible(),false);assert.equal(await p.locator('#youtube-frame').getAttribute('src'),src);
});
