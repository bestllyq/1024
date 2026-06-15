const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const coll = db.collection('users')
  let user = await coll.where({ _openid: OPENID }).get()
  var data = {}
  if (event.items) data.items = event.items
  if (event.coins !== undefined) data.coins = event.coins
  if (event.totalShares !== undefined) data.totalShares = event.totalShares
  if (event.shareMilestones) data.shareMilestones = event.shareMilestones
  if (event.achievements) data.achievements = event.achievements
  if (event.bestScore !== undefined) data.bestScore = event.bestScore

  if (user.data.length === 0) {
    data._openid = OPENID
    await coll.add({ data: data })
  } else {
    await coll.doc(user.data[0]._id).update({ data: data })
  }
  return { ok: true }
}