import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,relative,extname,dirname} from 'node:path';
const groups={backend:'apps/api',dashboard:'apps/web',gpu:'agent',database:'db',tools:'scripts',tests:'tests',pythonTests:'tests_py',databaseTests:'tests_db'};
const extensions=new Set(['.js','.py','.sql','.css','.html','.sh','.ps1','.ts']);
const ignored=new Set(['node_modules','.git','vendor','dist','build','__pycache__','.venv']);
export async function audit(root=process.cwd()){
 const counts={};const files=[];
 for(const [group,folder] of Object.entries(groups)){
  counts[group]={files:0,physical:0,nonblank:0};
  async function walk(dir){
   for(const item of await readdir(dir,{withFileTypes:true})){
    if(ignored.has(item.name))continue;
    const path=join(dir,item.name);
    if(item.isDirectory())await walk(path);
    else if(item.isFile()&&extensions.has(extname(path))){
     const source=await readFile(path,'utf8');
     const lines=source.split(/\r?\n/);
     if(lines.at(-1)==='')lines.pop();
     const physical=lines.length,nonblank=lines.filter(x=>x.trim()).length;
     counts[group].files++;counts[group].physical+=physical;counts[group].nonblank+=nonblank;
     files.push({path:relative(root,path),group,physical,nonblank});
    }
   }
  }
  try{await walk(join(root,folder))}catch(e){if(e.code!=='ENOENT')throw e}
 }
 const totals=Object.values(counts).reduce((a,v)=>({physical:a.physical+v.physical,nonblank:a.nonblank+v.nonblank}),{physical:0,nonblank:0});
 return {method:'first-party source only; excludes docs, images, node_modules, vendor and generated assets',counts,totals,files,remainingPhysicalTo50000:Math.max(0,50000-totals.physical)};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const result=await audit();
 console.log(JSON.stringify(result,null,2));
 if(process.env.CODE_AUDIT_OUTPUT){
  await mkdir(dirname(process.env.CODE_AUDIT_OUTPUT),{recursive:true});
  await writeFile(process.env.CODE_AUDIT_OUTPUT,JSON.stringify(result,null,2)+'\n');
 }
}
