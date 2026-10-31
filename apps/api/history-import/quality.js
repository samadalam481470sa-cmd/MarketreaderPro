/**
 * Quality evaluation is descriptive, not authentication of an external vendor.
 * Rows are sourced from a user-licensed, operator-provided CSV.
 */
function round(value){return Math.round(value*1000000)/1000000}
function isoDays(a,b){return (Date.parse(b)-Date.parse(a))/86400000}
export function assessHistoryQuality(assets){
 const dates=assets[0].prices.map(p=>p.date.slice(0,10));
 const minDate=dates[0],maxDate=dates.at(-1);
 const gaps=[];
 for(let i=1;i<dates.length;i++){
  const days=isoDays(dates[i-1],dates[i]);
  if(!Number.isFinite(days)||days<=0)throw Error('Invalid chronological dates');
  if(days>4)gaps.push({previous:dates[i-1],next:dates[i],gapCalendarDays:days});
 }
 const assetReport=assets.map(asset=>{
  const values=asset.prices.map(p=>p.close);
  const returns=values.slice(1).map((v,i)=>v/values[i]-1);
  const unusuallyLarge=returns.map((v,i)=>({date:dates[i+1],change:v}))
   .filter(x=>Math.abs(x.change)>=0.30).slice(0,20);
  const zeroChange=returns.filter(x=>Math.abs(x)<=1e-12).length;
  return {
   symbol:asset.symbol,
   minimumClose:Math.min(...values),
   maximumClose:Math.max(...values),
   unchangedFraction:round(returns.length?zeroChange/returns.length:0),
   unusuallyLargeDailyChanges:unusuallyLarge,
   largeMoveThreshold:0.30
  };
 });
 const findings=[];
 if(gaps.length)findings.push('Calendar gaps exist; holidays/weekends may explain some of them.');
 if(assetReport.some(x=>x.unusuallyLargeDailyChanges.length))
  findings.push('Daily changes above 30% need confirmation for splits, bad ticks, or legitimate market moves.');
 if(assetReport.some(x=>x.unchangedFraction>0.5))
  findings.push('High unchanged-price proportion; check the series frequency and stale data.');
 const ageDays=isoDays(maxDate,new Date().toISOString().slice(0,10));
 if(ageDays>30)findings.push('Historical series ends more than 30 calendar days ago.');
 return {
  status:findings.length?'review':'validated-format',
  note:'Format validation does not verify prices, copyright clearance, corporate actions or publisher authenticity.',
  sampleDates:{start:minDate,end:maxDate,calendarSpan:round(isoDays(minDate,maxDate))},
  assets:assetReport,
  calendarGaps:gaps.slice(0,40),
  totalCalendarGaps:gaps.length,
  warnings:findings
 };
}
