// Keep public diagnostics useful without persisting raw URLs, headers or secrets.
export function sourceFailure(error) {
 const message=String(error?.message||'')
 const status=Number(error?.status)||Number(message.match(/^HTTP (\d{3})$/)?.[1])
 const code=status?`HTTP_${status}`:/^[A-Z][A-Z0-9_]{2,80}$/.test(message)?message:
  ['TimeoutError','AbortError'].includes(error?.name)?'REQUEST_TIMEOUT':'SOURCE_UNAVAILABLE'
 const reason=code==='HTTP_429'?'来源限流，保留缓存；本轮不立即重试':
  code==='HTTP_403'?'来源拒绝访问，保留缓存':
  code==='HTTP_404'?'来源地址不存在，需核对采集地址':
  code==='REQUEST_TIMEOUT'?'请求超时，保留缓存':
  code==='AA_VERSION_UNVERIFIED'?'AA 当前指数版本缺少独立来源证据，保留原快照':
  code==='AA_DETAILS_UNVERIFIED'?'AA 前三配置详情未核实，保留原快照，需检查详情采集':
  code==='AA_IDENTITY_MISMATCH'?'AA 模型配置或指数版本不一致，保留原快照，需检查来源适配':
  code==='COLLECTOR_OUTPUT_INVALID'?'采集结果未通过校验，已丢弃新结果并保留原快照':
  code==='LICENSE_NOTICE_MISSING'?'未找到摘要转载所需的许可声明，本轮未更新；维护者需核对来源格式与许可，必要时改为仅收录标题和链接':
  /DATES_MISSING|HEADINGS_MISSING|STRUCTURE_CHANGED/.test(code)?'来源页面结构或日期格式不符合解析规则，需检查适配器':
  code.startsWith('HTTP_')?'来源返回 HTTP 错误，保留缓存':'来源采集或校验异常，保留有效期内缓存'
 return {errorCode:code,lastError:reason,...(Number.isInteger(error?.attempts)?{attempts:error.attempts}:{})}
}

// Process errors need their stderr to distinguish a schema change from a network
// outage. Only fixed codes/reasons leave the collector; never publish stderr.
export function collectorFailure(error) {
 const raw=String(error?.stderr||error?.message||'')
 const code=/未发现周榜|目录校验失败|用量字段异常/.test(raw)?'OPENROUTER_STRUCTURE_CHANGED':
  /未确认当前发布版本|未发现官方应用脚本|CSV 缺少|CSV 列数|分类字段异常|分项不完整/.test(raw)?'LIVEBENCH_STRUCTURE_CHANGED':
  /AA_VERSION_UNVERIFIED/.test(raw)?'AA_VERSION_UNVERIFIED':
  /前三配置.*未核实/.test(raw)?'AA_DETAILS_UNVERIFIED':
  /配置身份不一致|详情与榜单的指数版本不一致|配置得分不一致/.test(raw)?'AA_IDENTITY_MISMATCH':
  /字段已变化|榜单身份或版本无法确认|覆盖校验失败|详情模型列表缺失/.test(raw)?'AA_STRUCTURE_CHANGED':
  /collector output failed validation|综合榜数据校验失败/.test(raw)?'COLLECTOR_OUTPUT_INVALID':
  raw.match(/\bHTTP[ _](\d{3})\b/)?.[1]?`HTTP_${raw.match(/\bHTTP[ _](\d{3})\b/)[1]}`:
  /TimeoutError|AbortError|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|timed? ?out|请求超时/i.test(raw)?'REQUEST_TIMEOUT':'SOURCE_UNAVAILABLE'
 const retryAfterAt=raw.match(/RETRY_AFTER=(\d{4}-\d\d-\d\dT[\d:.]+Z)/)?.[1]
 return {...sourceFailure(Error(code)),...(retryAfterAt&&Number.isFinite(Date.parse(retryAfterAt))?{retryAfterAt}:{})}
}
