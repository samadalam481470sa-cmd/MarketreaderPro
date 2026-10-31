import {parseCsvRows} from './csv.js';
const validSymbol=s=>/^[A-Z0-9._-]{1,20}$/.test(s);
function number(value,row,symbol) {
  if(typeof value!=='string'||!value.trim())throw Error('Missing '+symbol+' closing price at CSV row '+row);
  const x=Number(value.trim());
  if(!Number.isFinite(x)||x<=0||x>1e9)throw Error('Invalid '+symbol+' closing price at row '+row);
  return x;
}
export function parsePortfolioCsv(content) {
  const [head,...rows]=parseCsvRows(content);
  if(head.length<3||head.length>13)throw Error('CSV must have date and 2–12 symbol columns');
  const headers=head.map(x=>x.trim().toUpperCase());
  if(!['DATE','TIME'].includes(headers[0]))throw Error('First CSV header must be date');
  const symbols=headers.slice(1);
  if(new Set(symbols).size!==symbols.length||symbols.some(x=>!validSymbol(x)))
    throw Error('Asset symbol headers must be unique and uppercase letters/numbers/dots');
  if(rows.length<35||rows.length>500)throw Error('Use 35–500 historical daily close records');
  const series=symbols.map(symbol=>({symbol,prices:[]}));
  for(const [index,row] of rows.entries()){
    if(row.length!==head.length)throw Error('Wrong column count on row '+(index+2));
    const date=row[0]?.trim();
    if(!date)throw Error('Missing date on row '+(index+2));
    for(let i=0;i<series.length;i++)series[i].prices.push({date,close:number(row[i+1],symbols[i],index+2)});
  }
  return series;
}
export function applyWeights(assets,text='') {
  if(!text.trim())return assets.map(a=>({...a,weight:1/assets.length}));
  const parsed=new Map();
  for(const part of text.split(',')){
    const pieces=part.split(':');
    if(pieces.length!==2)throw Error('Weights must look like AAPL:0.6,SPY:0.4');
    const key=pieces[0].trim().toUpperCase(),value=Number(pieces[1].trim());
    if(!key||parsed.has(key)||!Number.isFinite(value)||value<=0||value>1)
      throw Error('Invalid or duplicated weight '+key);
    parsed.set(key,value);
  }
  if(parsed.size!==assets.length||assets.some(a=>!parsed.has(a.symbol)))
    throw Error('Specify a positive weight for every CSV symbol');
  const sum=[...parsed.values()].reduce((a,b)=>a+b,0);
  if(Math.abs(sum-1)>1e-6)throw Error('Portfolio weights must add up to 1.0');
  return assets.map(a=>({...a,weight:parsed.get(a.symbol)}));
}
