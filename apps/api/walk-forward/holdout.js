/**
 * Pre-declared holdout protocol:
 * use all eligible folds EXCEPT the last to choose one allocation method.
 * The last fold is then disclosed only once as an independent evaluation
 * in the report. Repeated inspection still risks adaptive overfitting.
 */
export function evaluateHoldout(folds,methods) {
 if(folds.length<2)return {
  status:'insufficient-folds',
  selectedMethod:null,
  rationale:'At least two non-overlapping test folds are needed to separate selection from final holdout.',
  selectionFolds:0,holdoutFold:null
 };
 const selection=folds.slice(0,-1),untouched=folds.at(-1);
 const rankings=methods.map(method=>{
  const values=selection.map(f=>f.evaluations[method]);
  const mean=x=>values.reduce((a,v)=>a+v[x],0)/values.length;
  return {
   method,
   trainingSelectionMeanReturn:mean('totalReturn'),
   trainingSelectionMeanExcessReturn:values.reduce((a,v)=>
    a+v.totalReturn-v.passiveReturn,0)/values.length,
   trainingSelectionWinFraction:values.filter(v=>v.totalReturn>v.passiveReturn).length/values.length,
   trainingSelectionMeanDrawdown:mean('maxDrawdown')
  };
 }).sort((a,b)=>b.trainingSelectionMeanExcessReturn-a.trainingSelectionMeanExcessReturn||
  a.trainingSelectionMeanDrawdown-b.trainingSelectionMeanDrawdown||a.method.localeCompare(b.method));
 const selected=rankings[0].method;
 const final=untouched.evaluations[selected];
 return {
  status:'evaluated',
  protocol:'Choose a single method from earlier out-of-sample folds using average excess total return over passive, then evaluate once on the final untouched fold.',
  selectedMethod:selected,
  selectionFolds:selection.length,
  selectedOnLatestTrainingEnd:selection.at(-1).trainEnd,
  holdoutFold:untouched.fold,
  holdoutStart:untouched.firstTestObservation,
  holdoutEnd:untouched.testEnd,
  rankingBeforeHoldout:rankings,
  finalHoldout:{
   totalReturn:final.totalReturn,
   passiveReturn:final.passiveReturn,
   excessReturn:final.totalReturn-final.passiveReturn,
   maxDrawdown:final.maxDrawdown,
   feesAndSlippage:final.transactionDrag,
   outperformedPassive:final.totalReturn>final.passiveReturn
  },
  warnings:[
   'The final holdout is only independent if no algorithm, threshold or asset universe was selected using its results.',
   'This is a simulation with user-provided historical prices, not a realized trading track record.',
   'A single holdout fold cannot establish statistical significance or future profitability.'
  ]
 };
}
export function stabilityDiagnostics(folds,methods){
 const results={};
 for(const method of methods){
  const observations=folds.map(f=>f.evaluations[method]);
  const excess=observations.map(x=>x.totalReturn-x.passiveReturn);
  const ordered=[...excess].sort((a,b)=>a-b);
  const average=excess.reduce((a,b)=>a+b,0)/excess.length;
  const variance=excess.reduce((sum,x)=>sum+(x-average)**2,0)/excess.length;
  let wins=0,losses=0,winStreak=0,lossStreak=0,maxWins=0,maxLosses=0;
  for(const value of excess){
   if(value>0){wins++;winStreak++;lossStreak=0}
   else if(value<0){losses++;lossStreak++;winStreak=0}
   else{winStreak=0;lossStreak=0}
   maxWins=Math.max(maxWins,winStreak);maxLosses=Math.max(maxLosses,lossStreak);
  }
  results[method]={
   meanExcessReturn:average,
   excessReturnStdDev:Math.sqrt(variance),
   bestExcessReturn:ordered.at(-1),
   worstExcessReturn:ordered[0],
   positiveExcessFoldCount:wins,
   negativeExcessFoldCount:losses,
   maximumConsecutiveOutperformance:maxWins,
   maximumConsecutiveUnderperformance:maxLosses,
   sampleFoldCount:excess.length
  };
 }
 return {
  methods:results,
  interpretation:'Small nonoverlapping fold samples are descriptive, not statistically independent markets or proof of a robust edge.'
 };
}
