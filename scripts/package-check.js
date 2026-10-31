import {stat,readFile} from 'node:fs/promises';
const required=['apps/api/server.js','apps/web/index.html','apps/web/style.css','apps/web/app.js','apps/api/indicators.js','docs/images/intelligence-dashboard.svg','docs/images/government-dashboard.svg','scripts/start-windows.ps1','scripts/start-unix.sh','docs/QUICKSTART.md','package.json'];
for(const path of required){const s=await stat(path);if(!s.isFile()||!s.size)throw Error('Missing package asset: '+path)}
const html=await readFile('apps/web/index.html','utf8');
for(const id of ['overview-markets','overview-headlines','overview-market-count','dashboard-refresh'])if(!html.includes('id="'+id+'"'))throw Error('Missing real dashboard element: '+id);
console.log('Application package contents and dashboard layout verified.');
