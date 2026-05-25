const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const COLLECTION_NAME = 'activities'

// ---------- 共享工具函数 ----------

function ok(data) {
  return Object.assign({ ok: true }, data || {})
}

function fail(message) {
  return { ok: false, message }
}

async function getActivity(activityId) {
  try {
    const result = await db.collection(COLLECTION_NAME).doc(activityId).get()
    return result.data
  } catch (error) {
    return null
  }
}

function isActivityAdmin(activity, openid) {
  return activity && (activity.ownerOpenid === openid || (activity.adminOpenids || []).indexOf(openid) >= 0)
}

// 名单/排阵相关工具

function isDefaultPlayerName(name) {
  return /^(队员|Player )\d+$/.test(String(name || ''))
}

function isRealPlayer(player) {
  if (!player || player.isSynthetic) return false
  return !!player.openid || !isDefaultPlayerName(player.name)
}

function rotationLimitFromActivity(activity) {
  const configured = Math.floor(Number(activity && (activity.presetCount || activity.selectedPreset)) || 0)
  if (configured) return Math.max(4, Math.min(18, configured))
  const presentCount = ((activity && activity.participants) || []).filter(
    (item) => !item.status || item.status === 'present'
  ).length
  return Math.max(4, Math.min(18, presentCount || 6))
}

function autoPromoteBench(participants, activity) {
  const rotationLimit = rotationLimitFromActivity(activity || {})
  let presentCount = (participants || []).filter(
    (item) => isRealPlayer(item) && (!item.status || item.status === 'present')
  ).length
  let changed = false
  const next = (participants || []).map((item) => {
    if (presentCount >= rotationLimit || item.status !== 'bench') return item
    presentCount += 1
    changed = true
    return Object.assign({}, item, {
      status: 'present',
      statusText: '到场',
      isNew: true
    })
  })
  return { participants: next, changed }
}

// ============================================================
//  名单管理 / 管理员操作
// ============================================================

async function handleAddAdmin(event, openid) {
  try {
    const data = event.data || {}
    const activityId = data.activityId
    const adminOpenid = String(data.adminOpenid || '').trim()
    const activity = await getActivity(activityId)
    if (!activity) return fail('活动不存在')
    if (activity.deleted) return fail('活动已删除')
    if (activity.ownerOpenid !== openid) return fail('只有创建人可以授权管理员')
    if (!adminOpenid) return fail('缺少管理员 openid')
    if (adminOpenid === activity.ownerOpenid) return fail('创建人已经是管理员')

    const adminOpenids = activity.adminOpenids || []
    if (adminOpenids.indexOf(adminOpenid) < 0) adminOpenids.push(adminOpenid)
    await db.collection(COLLECTION_NAME).doc(activityId).update({
      data: {
        adminOpenids,
        updatedAt: db.serverDate()
      }
    })
    return ok({ adminOpenids, openid, isOwner: true, isAdmin: true })
  } catch (error) {
    return fail(`授权管理员失败：${error.message || error.errMsg || JSON.stringify(error)}`)
  }
}

async function handleRemoveAdmin(event, openid) {
  try {
    const data = event.data || {}
    const activityId = data.activityId
    const adminOpenid = String(data.adminOpenid || '').trim()
    const activity = await getActivity(activityId)
    if (!activity) return fail('活动不存在')
    if (activity.deleted) return fail('活动已删除')
    if (activity.ownerOpenid !== openid) return fail('只有创建人可以移除管理员')

    const adminOpenids = (activity.adminOpenids || []).filter((item) => item !== adminOpenid)
    await db.collection(COLLECTION_NAME).doc(activityId).update({
      data: {
        adminOpenids,
        updatedAt: db.serverDate()
      }
    })
    return ok({ adminOpenids, openid, isOwner: true, isAdmin: true })
  } catch (error) {
    return fail(`移除管理员失败：${error.message || error.errMsg || JSON.stringify(error)}`)
  }
}

async function handleGetActivity(event, openid) {
  try {
    const data = event.data || {}
    const activity = await getActivity(data.activityId)
    if (!activity) return fail('活动不存在')
    if (activity.deleted) return fail('活动不存在')
    const isAdmin = isActivityAdmin(activity, openid)
    const isParticipant = (activity.participants || []).some((item) => item.openid === openid)
    if (!isAdmin && !isParticipant && activity.activityStatus === 'ended') {
      return fail('无权查看该活动')
    }
    return ok({
      activity,
      openid,
      isOwner: activity.ownerOpenid === openid,
      isAdmin
    })
  } catch (error) {
    return fail(`读取活动失败：${error.message || error.errMsg || JSON.stringify(error)}`)
  }
}

async function handleGetActivityQr(event, openid) {
  try {
    const data = event.data || {}
    const activityId = data.activityId
    const activity = await getActivity(activityId)
    if (!activity) return fail('活动不存在')
    if (activity.deleted) return fail('活动已删除')
    if (!isActivityAdmin(activity, openid)) return fail('只有管理员可以生成二维码')

    const qr = await cloud.openapi.wxacode.getUnlimited({
      scene: `activityId=${activityId}`,
      page: 'pages/index/index',
      checkPath: false
    })
    const upload = await cloud.uploadFile({
      cloudPath: `activity-qrcode/${activityId}.jpg`,
      fileContent: qr.buffer
    })
    await db.collection(COLLECTION_NAME).doc(activityId).update({
      data: {
        qrCodeFileID: upload.fileID,
        updatedAt: db.serverDate()
      }
    })
    return ok({ fileID: upload.fileID })
  } catch (error) {
    return fail(`生成二维码失败：${error.message || error.errMsg || JSON.stringify(error)}`)
  }
}

// ============================================================
//  导出
// ============================================================

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action

  switch (action) {
    case 'getActivity':
      return await handleGetActivity(event, openid)
    case 'getActivityQr':
      return await handleGetActivityQr(event, openid)
    case 'addAdmin':
      return await handleAddAdmin(event, openid)
    case 'removeAdmin':
      return await handleRemoveAdmin(event, openid)
    default:
      return { ok: false, message: '未知操作' }
  }
}
