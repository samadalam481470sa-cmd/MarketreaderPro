export const COVERAGE_TARGETS=Object.freeze({
 officialMacroFeeds:2,gdeltTopics:4,predictionExchanges:2,
 secCiks:'operator-configured',congressHouse:'official links only',congressSenate:'official links only',
 equities:'no full-universe licensed feed',foreignExchange:'no live quotes',commodities:'news only'
});
export function coverageSummary({newsStatus={},markets={},sec={},errors={}}={}){
 const sources=[
  ...Object.entries(newsStatus).map(([name,value])=>({name:(name==='federal-reserve'||name==='bls'?'official-':'gdelt-')+name,...value})),
  ...Object.entries(markets).map(([name,value])=>({name:'market-'+name,...value})),
  ...Object.entries(sec).map(([name,value])=>({name:'sec-'+name,...value}))
 ];
 return {scope:'bounded public-source discovery; NOT exhaustive market or politician tracking',targets:COVERAGE_TARGETS,sources,
  failures:Object.keys(errors).length,partial:Object.keys(errors).length>0};
}
