const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  // Get top 20 scores
  const res = await db.collection('scores')
    .orderBy('score', 'desc')
    .limit(20)
    .get()
  // Get current user's rank
  const userRes = await db.collection('scores')
    .where({ _openid: OPENID })
    .orderBy('score', 'desc')
    .limit(1)
    .get()
  return {
    list: res.data,
    myScore: userRes.data.length > 0 ? userRes.data[0].score : 0
  }
}