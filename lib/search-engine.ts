import {runAgentSearch,isCategoryBrowse,type AgentSearchRequest,type AgentSearchResponse} from './agent-search';

export type SearchRequest=AgentSearchRequest;
export type SearchResponse=AgentSearchResponse;
export {isCategoryBrowse};

/** Buyer search always goes through the nearby-business agent orchestrator. */
export async function runSearch(input:SearchRequest,emit?:(r:SearchResponse)=>void):Promise<SearchResponse>{
  return runAgentSearch(input,emit);
}
