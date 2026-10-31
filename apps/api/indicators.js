// MIT-licensed technicalindicators by Anand Anand (github.com/anandanand84/technicalindicators).
// Used as a third-party dependency; this file contains MarketreaderPro integration logic.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {SMA,EMA,RSI}=require('technicalindicators');
const fail=message=>Object.assign(Error(message),{status:422});
export function technicalAnalysis({values,period=14}={}){
 if(!Array.isArray(values)||values.length<2||values.length>2000||!values.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1))throw fail('Provide 2–2000 normalized probability observations between 0 and 1');
 if(!Number.isInteger(period)||period<2||period>200)throw fail('Period must be 2–200');
 const data={observations:values.length,period,source:'normalized historical market probabilities',disclaimer:'Retrospective technical indicators are descriptive. They are not price forecasts or trading advice.'};
 if(values.length<period)return {...data,status:'insufficient-history',minimum:period,sma:null,ema:null,rsi:null};
 const sma=SMA.calculate({period,values}),ema=EMA.calculate({period,values});
 const rsi=values.length>=period+1?RSI.calculate({period,values}):[];
 return {...data,status:'calculated',sma:sma.at(-1)??null,ema:ema.at(-1)??null,rsi:rsi.at(-1)??null};
}
