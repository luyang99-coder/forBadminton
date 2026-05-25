/**
 * activityService — 云函数准入 & 路由分发
 *
 * 根据 action 分发到子云函数：
 *   signup/       → signup, cancelSignup, claimPlayer, bindPlayerOpenid
 *   score/        → saveScore
 *   roster/       → getActivity, getActivityQr, addAdmin, removeAdmin
 *
 * 通用 action（login, listActivities, createActivity, updateActivity, deleteActivity）
 * 保留在此入口函数中。
 */
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const COLLECTION_NAME = 'activities'

// ---------- 共享工具 ----------

function ok(data) {
  return Object.assign({ ok: true }, data || {})
}

function fail(message) {
  return { ok: false, message }
}

async function ensureCollection() {
  try {
    await db.createCollection(COLLECTION_NAME)
  } catch (error) {
    // 集合已存在是正常情况
  }
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

// ============================================================
//  通用操作（login / 活动 CRUD / 列表）
// ============================================================

async function handleLogin(openid) {
  return ok({ openid })
}

async function handleGetActivity(event, openid) {
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
}

async function handleListActivities(event, openid) {
  try {
    await ensureCollection()
    const data = event.data || {}
    const visibleFilter = { deleted: _.neq(true) }
    const size = Math.max(10, Math.min(80, Number(data.size) || 40))
    const page = Math.max(0, Number(data.page) || 0)
    const keyword = String(data.keyword || '').trim().toLowerCase()
    const owned = await db.collection(COLLECTION_NAME).where({
      ownerOpenid: openid,
      ...visibleFilter
    }).limit(200).get()
    const admined = await db.collection(COLLECTION_NAME).where({
      adminOpenids: openid,
      ...visibleFilter
    }).limit(200).get()
    const joined = await db.collection(COLLECTION_NAME).where({
      participantOpenids: openid,
      ...visibleFilter
    }).limit(200).get()
    const legacyJoined = await db.collection(COLLECTION_NAME).where({
      'participants.openid': openid,
      ...visibleFilter
    }).limit(200).get()
    const map = {}
    ;(owned.data || []).concat(admined.data || [], joined.data || [], legacyJoined.data || []).forEach((activity) => {
      if (activity && activity.activityId) map[activity.activityId] = activity
    })
    const filtered = Object.keys(map).map((id) => map[id]).filter((activity) => {
      if (!activity) return false
      if (!keyword) return true
      const hay = `${activity.activityTitle || ''}`.toLowerCase()
      return hay.indexOf(keyword) >= 0
    }).sort((a, b) => {
      const at = a.updatedAt && a.updatedAt.getTime ? a.updatedAt.getTime() : 0
      const bt = b.updatedAt && b.updatedAt.getTime ? b.updatedAt.getTime() : 0
      return bt - at
    })
    const start = page * size
    const end = start + size
    const list = filtered.slice(start, end)
    const hasMore = end < filtered.length
    return ok({ activities: list, hasMore, page, size, total: filtered.length })
  } catch (error) {
    return fail(`读取活动列表失败：${error.message || error.errMsg || JSON.stringify(error)}`)
  }
}

async function handleCreateActivity(event, openid) {
  try {
    await ensureCollection()
    const data = event.data || {}
    const activity = data.activity || {}
    const activityId = activity.activityId || data.activityId
    if (!activityId) return fail('缺少活动 ID')

    const doc = Object.assign({}, activity, {
      activityId,
      ownerOpenid: openid,
      participantOpenids: (activity.participants || []).map((item) => item.openid).filter(Boolean),
      deleted: false,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    })

    const exists = await getActivity(activityId)
    if (exists) {
      if (exists.ownerOpenid !== openid) return fail('无权覆盖该活动')
      delete doc._id
      await db.collection(COLLECTION_NAME).doc(activityId).update({ data: doc })
    } else {
      await db.collection(COLLECTION_NAME).doc(activityId).set({ data: doc })
    }

    return ok({ activityId, openid, isOwner: true, isAdmin: true })
  } catch (error) {
    return fail(`创建活动失败：${error.message || error.errMsg || JSON.stringify(error)}`)
  }
}

async function handleUpdateActivity(event, openid) {
  try {
    await ensureCollection()
    const data = event.data || {}
    const activityId = data.activityId
    const patch = data.patch || {}
    const activity = await getActivity(activityId)
    if (!activity) return fail('活动不存在')
    if (activity.deleted) return fail('活动已删除')
    if (!isActivityAdmin(activity, openid)) return fail('只有管理员可以修改活动')
    delete patch.ownerOpenid
    delete patch.createdAt
    delete patch.deleted
    delete patch.deletedAt
    delete patch.deletedBy
    if (Array.isArray(patch.participants)) {
      patch.participantOpenids = patch.participants.map((item) => item.openid).filter(Boolean)
    }
    if (activity.resultSnapshot) {
      delete patch.resultSnapshot
    }
    if (activity.ownerOpenid !== openid) {
      delete patch.adminOpenids
    }

    // Backward compatibility: old records may store objects as null.
    const nullableObjectFields = ['scheduleQuality', 'review', 'resultSnapshot']
    for (let i = 0; i < nullableObjectFields.length; i += 1) {
      const key = nullableObjectFields[i]
      if (activity[key] === null && patch[key] && typeof patch[key] === 'object') {
        await db.collection(COLLECTION_NAME).doc(activityId).update({
          data: { [key]: _.remove() }
        })
      }
    }

    await db.collection(COLLECTION_NAME).doc(activityId).update({
      data: Object.assign({}, patch, { updatedAt: db.serverDate() })
    })
    return ok({ activityId, openid, isOwner: activity.ownerOpenid === openid, isAdmin: true })
  } catch (error) {
    return fail(`更新活动失败：${error.message || error.errMsg || JSON.stringify(error)}`)
  }
}

async function handleDeleteActivity(event, openid) {
  try {
    await ensureCollection()
    const data = event.data || {}
    const activityId = data.activityId
    const activity = await getActivity(activityId)
    if (!activity) return ok({ activityId, deleted: true })
    if (activity.ownerOpenid !== openid) return fail('只有创建人可以删除活动')
    await db.collection(COLLECTION_NAME).doc(activityId).remove()
    return ok({ activityId, deleted: true })
  } catch (error) {
    return fail(`删除活动失败：${error.message || error.errMsg || JSON.stringify(error)}`)
  }
}

// ============================================================
//  子云函数调用封装
// ============================================================

async function callSubFunction(name, event) {
  try {
    const result = await cloud.callFunction({
      name: `activityService/${name}`,
      data: event
    })
    return result.result || { ok: false, message: '子云函数无返回' }
  } catch (error) {
    return fail(`子云函数 ${name} 调用失败：${error.message || error.errMsg || JSON.stringify(error)}`)
  }
}

// ============================================================
//  入口：action 路由
// ============================================================

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action

  switch (action) {
    // ---- 通用 ----
    case 'login':
      return handleLogin(openid)
    case 'getActivity':
      return handleGetActivity(event, openid)
    case 'listActivities':
      return handleListActivities(event, openid)
    case 'createActivity':
      return handleCreateActivity(event, openid)
    case 'updateActivity':
      return handleUpdateActivity(event, openid)
    case 'deleteActivity':
      return handleDeleteActivity(event, openid)

    // ---- 子云函数路由 ----
    case 'signup':
    case 'cancelSignup':
    case 'claimPlayer':
    case 'bindPlayerOpenid':
      return callSubFunction('signup', event)

    case 'saveScore':
      return callSubFunction('score', event)

    case 'getActivityQr':
    case 'addAdmin':
    case 'removeAdmin':
      return callSubFunction('roster', event)

    default:
      return fail('未知操作')
  }
}
