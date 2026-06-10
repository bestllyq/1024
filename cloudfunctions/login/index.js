const cloud = require('wx-server-sdk')
cloud.init()
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  return { openid: OPENID }
}