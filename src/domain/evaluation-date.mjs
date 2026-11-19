/** Source model release day, never a collection/check timestamp or a guessed name suffix. */
export function validReleaseDate(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
 const time=Date.parse(value+'T00:00:00Z')
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value
}
export function evaluationReleaseDate(row) {
 const value=row?.releaseDate
 return validReleaseDate(value)?value:null
}
export function fillMissingReleaseDates(rows,reference) {
 const byId=new Map((reference||[]).map(row=>[row.id,row]))
 return rows.map(row=>{
  if(evaluationReleaseDate(row))return row
  const saved=byId.get(row.id)
  return saved&&saved.name===row.name&&saved.provider===row.provider&&validReleaseDate(saved.releaseDate)?{...row,releaseDate:saved.releaseDate}:row
 })
}
