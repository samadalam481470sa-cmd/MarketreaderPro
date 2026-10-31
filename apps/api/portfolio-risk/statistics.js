import { PortfolioRiskError } from './validation.js';
export function dailyReturns(assets) {
  const n=assets[0].prices.length;
  const out=assets.map(asset=>{
    const values=[];
    for(let i=1;i<n;i++){
      const previous=asset.prices[i-1],current=asset.prices[i];
      const change=current/previous-1;
      if(!Number.isFinite(change))throw new PortfolioRiskError('Nonfinite price return');
      values.push(change);
    }
    return values;
  });
  return out;
}
export function arithmeticMean(values) {
  return values.reduce((a,b)=>a+b,0)/values.length;
}
export function sampleVariance(values) {
  if(values.length<2)return null;
  const mean=arithmeticMean(values);
  return values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1);
}
export function covarianceMatrix(returns) {
  const count=returns.length;
  if(!count||returns.some(x=>x.length!==returns[0].length||x.length<2))
    throw new PortfolioRiskError('Insufficient aligned returns for covariance');
  const means=returns.map(arithmeticMean);
  const n=returns[0].length;
  const matrix=Array.from({length:count},()=>Array(count).fill(0));
  for(let i=0;i<count;i++){
    for(let j=i;j<count;j++){
      let cov=0;
      for(let t=0;t<n;t++)cov+=(returns[i][t]-means[i])*(returns[j][t]-means[j]);
      cov/=(n-1);
      matrix[i][j]=cov;
      matrix[j][i]=cov;
    }
  }
  return {matrix,means};
}
export function shrinkCovariance(matrix,intensity=0.15) {
  if(typeof intensity!=='number'||intensity<0||intensity>1)
    throw new PortfolioRiskError('Invalid covariance shrinkage');
  return matrix.map((row,i)=>row.map((value,j)=>i===j?value:value*(1-intensity)));
}
export function correlations(covariance) {
  return covariance.map((row,i)=>row.map((entry,j)=>{
    const left=covariance[i][i],right=covariance[j][j];
    if(i===j)return left>0?1:null;
    if(left<=1e-18||right<=1e-18)return null;
    return Math.max(-1,Math.min(1,entry/Math.sqrt(left*right)));
  }));
}
export function portfolioVolatility(covariance,weights,periodsPerYear=252) {
  const terms=weights.map((weight,i)=>
    weights.reduce((sum,w,j)=>sum+weight*w*covariance[i][j],0));
  const variance=Math.max(0,terms.reduce((a,b)=>a+b,0));
  return {variance,dailyVolatility:Math.sqrt(variance),
    annualizedVolatility:Math.sqrt(variance*periodsPerYear),
    marginalVarianceContributions:terms};
}
export function riskContributions(covariance,weights) {
  const p=portfolioVolatility(covariance,weights);
  const contributions=weights.map((weight,i)=>{
    const covarianceWithPortfolio=weights.reduce((sum,w,j)=>sum+w*covariance[i][j],0);
    const varianceContribution=weight*covarianceWithPortfolio;
    return {weight,varianceContribution,
      fractionOfTotalVariance:p.variance>1e-18?varianceContribution/p.variance:null};
  });
  return contributions;
}
export function diversificationRatio(covariance,weights) {
  const stds=covariance.map((row,i)=>Math.sqrt(Math.max(0,row[i])));
  const numerator=stds.reduce((sum,s,i)=>sum+weights[i]*s,0);
  const denominator=portfolioVolatility(covariance,weights).dailyVolatility;
  return denominator>1e-12?numerator/denominator:null;
}
export function quantile(sortedValues,fraction) {
  if(!Array.isArray(sortedValues)||!sortedValues.length)
    throw new PortfolioRiskError('Cannot calculate quantile of empty series');
  const index=(sortedValues.length-1)*fraction;
  const a=Math.floor(index),b=Math.ceil(index);
  return sortedValues[a]+(sortedValues[b]-sortedValues[a])*(index-a);
}
export function histogram(values,bins=20) {
  if(!Array.isArray(values)||values.length<2||!Number.isInteger(bins)||bins<2||bins>50)
    throw new PortfolioRiskError('Histogram requires values and bounded bins');
  const minimum=Math.min(...values),maximum=Math.max(...values);
  if(maximum===minimum)return [{from:minimum,to:maximum,count:values.length}];
  const step=(maximum-minimum)/bins;
  const counts=Array(bins).fill(0);
  for(const value of values)counts[Math.min(bins-1,Math.max(0,Math.floor((value-minimum)/step)))]++;
  return counts.map((count,i)=>({from:minimum+i*step,to:minimum+(i+1)*step,count}));
}
