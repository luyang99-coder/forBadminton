// pages/index/modules/notify.js

const NOTIFY_TMPL_IDS = {
  activityConfirm: '',
  scheduleReady: '',
  scoreUpdate: '',
  activityReminder: 's6QRccbEYZZfAmlaK8XOtzpi07W2EnhmF8DuyPkhmNA'
}

function getNotifySettings(activity) {
  return activity.notifySettings || { enabled: true, tmplIds: Object.values(NOTIFY_TMPL_IDS).filter(Boolean) }
}

function requestSubscribe(callback) {
  const tmplIds = Object.values(NOTIFY_TMPL_IDS).filter(Boolean)
  if (!tmplIds.length) {
    if (callback) callback({ errMsg: 'no templates configured' })
    return
  }
  wx.requestSubscribeMessage({
    tmplIds: tmplIds,
    success: (res) => { if (callback) callback(null, res) },
    fail: (err) => { if (callback) callback(err) }
  })
}

function sendSubscribeMessage(cloudEnv, openid, tmplId, data, page) {
  wx.cloud.callFunction({
    name: 'subscribeMessage',
    data: { env: cloudEnv, openid: openid, tmplId: tmplId, data: data, page: page },
    success: () => {},
    fail: (err) => console.error('send subscribe msg failed', err)
  })
}

module.exports = { NOTIFY_TMPL_IDS, getNotifySettings, requestSubscribe, sendSubscribeMessage }
