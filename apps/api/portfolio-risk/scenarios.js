export function scenarioResults(assets,scenarios) {
  const weights=Object.fromEntries(assets.map(a=>[a.symbol,a.weight]));
  const largest=assets.reduce((a,b)=>a.weight>b.weight?a:b);
  const baseline=[
    {name:'Uniform -10% hypothetical shock',shocks:Object.fromEntries(assets.map(a=>[a.symbol,-.10]))},
    {name:'Uniform -25% hypothetical shock',shocks:Object.fromEntries(assets.map(a=>[a.symbol,-.25]))},
    {name:'Largest-weight asset -30% shock',shocks:{[largest.symbol]:-.30}}
  ];
  return [...baseline,...scenarios].map(s=>{
    const contribution=assets.map(a=>({
      symbol:a.symbol,weight:a.weight,
      assumedShock:s.shocks[a.symbol]??0,
      portfolioImpact:a.weight*(s.shocks[a.symbol]??0)
    }));
    const returnFraction=contribution.reduce((sum,x)=>sum+x.portfolioImpact,0);
    return {name:s.name,assumedPortfolioReturn:returnFraction,
      assumedPortfolioLoss:Math.max(0,-returnFraction),contributions:contribution,
      hypothetical:true};
  });
}
