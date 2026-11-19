// Conservative grouping: same canonical URL or exactly normalized title only.
export function urlHost(value) {
  const canonical = canonicalUrl(value)
  const match = canonical && /^https:\/\/([^/]+)/.exec(canonical)
  return match ? match[1].replace(/^www\./,'').toLowerCase() : ''
}
export function canonicalUrl(value) {
  // Use the same conservative parser on every platform. Some Android WeChat
  // runtimes expose URL but omit searchParams; feature presence is not enough.
  try {
    if(typeof value!=='string'||/[\s\\\u0000-\u001f]/u.test(value))return null;
    const match=/^https:\/\/([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i.exec(value);
    if(!match)return null;
    const [,host,port,path,query]=match;
    if(host.includes('..')||(port&&(+port<1||+port>65535))||(path&&!path.startsWith('/'))||/(?:^|\/)\.{1,2}(?:\/|$)/.test(path))return null;
    const parts=(query||'').split('&').filter(Boolean).filter(p=>! /^(utm_|ref$|source$)/i.test(decodeURIComponent(p.split('=')[0].replace(/\+/g,' '))));
    const address='https://'+host.toLowerCase()+(port&&+port!==443?':'+Number(port):'')+(path||'/')+(parts.length?'?'+parts.join('&'):'');
    const anchor=host.toLowerCase()==='ai.google.dev'&&path==='/gemini-api/docs/changelog'?value.match(/#(\d{2}-\d{2}-\d{4})$/)?.[1]:host.toLowerCase()==='api-docs.deepseek.com'&&path==='/updates'?value.match(/#(date-\d{4}-\d{2}-\d{2})$/)?.[1]:null;
    return address.replace(/\/$/,'')+(anchor?'#'+anchor:'');
  } catch { return null; }
}
