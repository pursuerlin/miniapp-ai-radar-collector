export const COLLECTION_TASKS=['catalog','intelligence','aa','livebench','media','research']
export const COLLECTION_PROFILES={all:COLLECTION_TASKS,news:['intelligence'],approved:['intelligence'],catalog:['catalog'],aa:['aa'],livebench:['livebench'],media:['media'],research:['research'],evaluation:['aa','livebench','media','research']}
export function collectionTasks(profile='all'){
 if(!Object.hasOwn(COLLECTION_PROFILES,profile))throw Error(`Unknown collection profile: ${profile}`)
 return [...COLLECTION_PROFILES[profile]]
}

export function selectedCollectionTasks(profile,override){
 const defaults=collectionTasks(profile)
 if(override===undefined||override===null||override==='')return defaults
 const selected=Array.isArray(override)?override:String(override).split(',')
 if(!selected.length||selected.some(id=>!COLLECTION_TASKS.includes(id))||new Set(selected).size!==selected.length)throw Error('Invalid collection task selection')
 if(profile==='approved'&&(selected.length!==1||selected[0]!=='intelligence'))throw Error('Approved collection must only collect intelligence')
 return COLLECTION_TASKS.filter(id=>selected.includes(id))
}
