import {validatePortfolio,validateStressScenarios} from './validation.js';
import {dailyReturns,covarianceMatrix,shrinkCovariance,correlations,
  portfolioVolatility,riskContributions,diversificationRatio} from './statistics.js';
import {historicalRisk} from './historical.js';
import {scenarioResults} from './scenarios.js';
export function analyzePortfolio(payload) {
  const portfolio=validatePortfolio(payload);
  const shocks=validateStressScenarios(payload.scenarios,portfolio.assets);
  const returns=dailyReturns(portfolio.assets);
  const sampleCovariance=covarianceMatrix(returns);
  const covariance=shrinkCovariance(sampleCovariance.matrix,0.15);
  const volatility=portfolioVolatility(covariance,portfolio.weights,portfolio.periodsPerYear);
  const historical=historicalRisk(returns,portfolio.dates,portfolio);
  const contributions=riskContributions(covariance,portfolio.weights).map((row,i)=>({
    symbol:portfolio.assets[i].symbol,...row,
    annualizedIndividualVolatility:Math.sqrt(covariance[i][i]*portfolio.periodsPerYear)
  }));
  const effectiveNumberOfAssets=1/portfolio.weights.reduce((sum,w)=>sum+w*w,0);
  return {
    mode:'historical-user-data-only',
    period: {first:portfolio.dates[0],last:portfolio.dates.at(-1),observations:portfolio.dates.length},
    symbols:portfolio.assets.map(a=>a.symbol),
    weights:portfolio.weights,
    exposure:{
      concentrationIndex:1/effectiveNumberOfAssets,
      effectiveNumberOfAssets,
      numberOfAssets:portfolio.assets.length,
      largestHolding:contributions.reduce((largest,c)=>c.weight>largest.weight?c:largest)
    },
    returns:{
      means:sampleCovariance.means,
      covariance,
      correlation:correlations(sampleCovariance.matrix),
      covarianceShrinkage:0.15,
      shrinkageMethod:'fixed 15% off-diagonal shrinkage, not an estimated optimal factor model',
      annualizedPortfolioVolatility:volatility.annualizedVolatility,
      diversificationRatio:diversificationRatio(covariance,portfolio.weights),
      varianceContributions:contributions
    },
    historical:{
      ...historical,
      returns:undefined,
      path: {
        ...historical.path,
        curve:historical.path.curve.length<=150?
          historical.path.curve:historical.path.curve.filter((_,i)=>i%Math.ceil(historical.path.curve.length/150)===0 ||i===historical.path.curve.length-1)
      }
    },
    stressScenarios:scenarioResults(portfolio.assets,shocks),
    disclaimers:[
      'Prices and labels are user-provided and have not been independently verified.',
      'Returns assume daily rebalancing to fixed target weights without trading fees, taxes, dividends or corporate actions unless reflected in the source prices.',
      'Historical VaR/CVaR are descriptive empirical loss statistics and not validated forward probabilities.',
      'Covariance and correlations can change abruptly during crises; a small sample is not reliable financial advice.'
    ]
  };
}
