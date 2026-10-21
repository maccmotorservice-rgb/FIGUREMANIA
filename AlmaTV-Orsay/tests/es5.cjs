const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
function check(directory) {
  for (const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    const file = path.join(directory,entry.name);
    if (entry.isDirectory()) check(file);
    else if (file.endsWith('.js')) acorn.parse(fs.readFileSync(file,'utf8'),{ecmaVersion:5});
  }
}
check(path.join(__dirname,'../app'));
const template = fs.readFileSync(path.join(__dirname,'../youtube_player.html'),'utf8');
for (const script of template.matchAll(/<script>([\s\S]*?)<\/script>/g)) acorn.parse(script[1],{ecmaVersion:5});
console.log('Todos los JS de la aplicación parseados estrictamente como ECMAScript 5');
