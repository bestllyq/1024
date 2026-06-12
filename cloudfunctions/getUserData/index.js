const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const coll = db.collection('users')
  
  let user = await coll.where({ _openid: OPENID }).get()
  if (user.data.length === 0) {
    await coll.add({ data: { energy: 5, maxEnergy: 5, lastUpdate: Date.now(), items: { undo:3, shuffle:3, bomb:3 } } })
    return { energy:5, maxEnergy:5, items:{ undo:3, shuffle:3, bomb:3 } }
  }
  
  let u = user.data[0]
  // Regen energy: 1 per 10 min
  let elapsed = Date.now() - u.lastUpdate
  let regen = Math.floor(elapsed / 600000)
  let newE = Math.min(u.maxEnergy, u.energy + regen)
  if (newE !== u.energy) {
    await coll.doc(u._id).update({ data: { energy: newE, lastUpdate: Date.now() } })
  }
  return { energy: newE, maxEnergy: u.maxEnergy, items: u.items || { undo:3, shuffle:3, bomb:3 } }
}