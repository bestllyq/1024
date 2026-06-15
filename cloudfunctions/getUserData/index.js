const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const coll = db.collection('users')
  let user = await coll.where({ _openid: OPENID }).get()
  if (user.data.length === 0) {
    await coll.add({ data: {
      items:{ undo:3, shuffle:3, bomb:3 }, coins:0,
      totalShares:0, shareMilestones:{}, achievements:{},
      bestScore:0
    }})
    return { items:{ undo:3, shuffle:3, bomb:3 }, coins:0, totalShares:0, shareMilestones:{}, achievements:{}, bestScore:0 }
  }
  var u = user.data[0]
  return {
    items: u.items || { undo:3, shuffle:3, bomb:3 },
    coins: u.coins || 0,
    totalShares: u.totalShares || 0,
    shareMilestones: u.shareMilestones || {},
    achievements: u.achievements || {},
    bestScore: u.bestScore || 0
  }
}