import {execFileSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n'),problems=[]
for(const file of files){
 if(/(?:^|\/)(?:\.env[^/]*|\.operations|\.cache|node_modules|admin|pages|components|composables|static)(?:\/|$)|\.(?:vue|pem|key)$|project\.private|feishu-base\.json|(?:^|\/)state\//.test(file))problems.push(file+': disallowed file')
 if(!/\.(?:mjs|js|json|md|yml|toml|gitignore)$/.test(file)&&file!=='.gitignore')continue
 const text=await readFile(file,'utf8')
 if(/-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[a-f0-9-]{20,}/.test(text))problems.push(file+': possible credential')
}
if(problems.length)throw Error(problems.join('\n'))
console.log(`Public boundary verified: ${files.length} tracked files; app UI, private state and literal credentials excluded`)
