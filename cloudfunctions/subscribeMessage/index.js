const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { openid, tmplId, data, page } = event
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: tmplId,
      data: data,
      page: page || 'pages/index/index'
    })
    return { success: true }
  } catch (err) {
    console.error('subscribeMessage.send failed', err)
    return { success: false, errMsg: err.message }
  }
}
