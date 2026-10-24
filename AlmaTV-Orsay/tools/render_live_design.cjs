/* Exporta las adaptaciones de referencia y símbolos originales de categorías. */
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..');
const shapes={
 all:'<rect x="4" y="6" width="24" height="18" rx="3"/><path d="m11 2 5 4 5-4M11 28h10"/>',
 favorites:'<path d="m16 3 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#252b30" stroke="none"/>',
 sports:'<circle cx="16" cy="16" r="13"/><path d="M3 16h26M16 3v26M7 6c12 5 12 15 0 20M25 6c-12 5-12 15 0 20"/>',
 entertainment:'<path d="M3 12h26v16H3zM3 5l24-4 2 7-24 4zM8 4l5 6M18 2l5 6"/><path d="m13 17 8 4-8 4z" fill="#252b30" stroke="none"/>',
 movies:'<circle cx="15" cy="15" r="12"/><circle cx="15" cy="8" r="2"/><circle cx="8" cy="14" r="2"/><circle cx="21" cy="14" r="2"/><circle cx="11" cy="21" r="2"/><circle cx="20" cy="21" r="2"/><path d="M20 26h9v4"/>',
 series:'<path d="M4 4h6v24H4zm9 0h6v24h-6zm9 1 6-1 4 24-6 1zM4 9h6m3 0h6m4 1 6-1M4 23h6m3 0h6"/>',
 documentaries:'<circle cx="15" cy="15" r="12"/><ellipse cx="15" cy="15" rx="5" ry="12"/><path d="M3 15h24M6 8h18M6 22h13M23 21h7v9h-7zM25 23h3m-3 3h3"/>',
 news:'<rect x="4" y="4" width="21" height="24" rx="1"/><path d="M25 9h4v20H7M8 9h13M8 14h6v6H8zm10 0h3m-3 4h3M8 24h13"/>',
 streaming:'<rect x="3" y="6" width="26" height="21" rx="3"/><path d="m12 11 10 5-10 6z"/>',
 folder:'<path d="M3 9h11l3 4h12v15H3zM3 9V5h11l3 4h12v4"/>'
};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const name of ['livetv','browser','weather','calendar']){
  const data=fs.readFileSync(path.join(root,'docs/design/iconos',name+'-referencia-adaptada.png')).toString('base64');
  const page=await browser.newPage({viewport:{width:180,height:100},deviceScaleFactor:1});
  await page.setContent('<style>html,body{margin:0;width:180px;height:100px;overflow:hidden}img{display:block;width:180px;height:100px;object-fit:cover}</style><img src="data:image/png;base64,'+data+'">');await page.locator('img').evaluate(n=>n.decode());
  await page.screenshot({path:path.join(root,'app/assets/logos',name+'.png')});await page.close();
 }
 for(const [name,drawing] of Object.entries(shapes)){
  const page=await browser.newPage({viewport:{width:64,height:64},deviceScaleFactor:1});await page.setContent('<style>html,body{margin:0;background:transparent}svg{width:64px;height:64px}</style><svg viewBox="0 0 34 34" fill="none" stroke="#252b30" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+drawing+'</svg>');await page.screenshot({path:path.join(root,'app/assets/icons','live-'+name+'.png'),omitBackground:true});await page.close();
 }await browser.close();})();
