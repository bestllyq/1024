const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const coll = db.collection('users')
  let user = await coll.where({ _openid: OPENID }).get()
  if (user.data.length === 0) {
    await coll.add({ data: { energy: event.energy, maxEnergy:5, lastUpdate: Date.now(), items: event.items || { undo:0, shuffle:0, bomb:0 } } })
  } else {
    let update = { lastUpdate: Date.now() }
    if (event.energy !== undefined) update.energy = event.energy
    if (event.items) update.items = event.items
    await coll.doc(user.data[0]._id).update({ data: update })
  }
  return { ok: true }
}