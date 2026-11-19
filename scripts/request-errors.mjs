export function httpResponseError(response,now=Date.now()){
 const raw=response.headers?.get?.('retry-after')
 const parsed=raw&&/^\d+$/.test(raw)?now+Number(raw)*1000:Date.parse(raw||'')
 const retryAfterAt=Number.isFinite(parsed)&&parsed>now?new Date(parsed).toISOString():null
 return Object.assign(Error(`HTTP ${response.status}${retryAfterAt?' RETRY_AFTER='+retryAfterAt:''}`),{status:response.status,...(retryAfterAt?{retryAfterAt}:{})})
}
