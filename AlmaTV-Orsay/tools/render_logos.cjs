/* Rasteriza las fuentes vectoriales permitidas a PNG local para Orsay. */
const fs=require('node:fs');const path=require('node:path');const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'../app/assets/logos');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
for(const brand of ['netflix','youtube','prime','disney','apple','max','xbox']){
 let svg=fs.readFileSync(path.join(root,'source',brand+'.svg'),'utf8');
 if(['netflix','youtube','apple','xbox'].includes(brand))svg=svg.replace('<svg ','<svg fill="'+(brand==='netflix'?'#e50914':brand==='youtube'?'#ff0033':'#ffffff')+'" ');
 if(brand==='max')svg=svg.replace(/#002be7/g,'#ffffff');
 if(brand==='prime')svg=svg.replace(/#232f3e|#00a8e1|#d1effa/g,'#ffffff');
 const page=await browser.newPage({viewport:{width:180,height:100},deviceScaleFactor:1});
 await page.setContent('<style>html,body{margin:0;width:180px;height:100px;overflow:hidden;background:transparent}svg{display:block;position:absolute;left:8px;top:8px;width:164px;height:84px}</style>'+svg);
 await page.evaluate(brand=>{const svg=document.querySelector('svg');if(brand==='disney'){const bg=svg.querySelector('path');if(bg)bg.remove();}const b=svg.getBBox();svg.setAttribute('viewBox',`${b.x-1} ${b.y-1} ${b.width+2} ${b.height+2}`);svg.setAttribute('preserveAspectRatio','xMidYMid meet');},brand);
 await page.screenshot({path:path.join(root,brand+'.png'),omitBackground:true});await page.close();
}await browser.close();})();
