const cloud = require('wx-server-sdk')
const {
  isRealPlayer,
  isDefaultPlayerName,
  rotationLimitFromActivity,
  autoPromoteBench
} = require('./roster')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const activities = db.collection('activities')
const COLLECTION_NAME = 'activities'

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
    // The collection already existing is the normal path after first setup.
  }
}

async function getActivity(activityId) {
  try {
    const result = await activities.doc(activityId).get()
    return result.data
  } catch (error) {
    return null
  }
}

function isActivityAdmin(activity, openid) {
  return activity && (activity.ownerOpenid === openid || (activity.adminOpenids || []).indexOf(openid) >= 0)
}

function findRotationPlayer(activity, openid) {
  const player = (activity.participants || []).find((item) => item.openid && item.openid === openid)
  if (!player) return null
  const inSchedule = (activity.schedule || []).some((game) => (game.playerIds || []).indexOf(player.id) >= 0)
  return inSchedule ? player : null
}

function buildGameResult(game, scoreA, scoreB) {
  const handicapA = Math.max(0, Number(game.handicapA) || 0)
  const handicapB = Math.max(0, Number(game.handicapB) || 0)
  const effectiveScoreA = scoreA + handicapA
  const effectiveScoreB = scoreB + handicapB
  if (effectiveScoreA === effectiveScoreB) return null
  return {
    scoreA,
    scoreB,
    handicapA,
    handicapB,
    effectiveScoreA,
    effectiveScoreB,
    winner: effectiveScoreA > effectiveScoreB ? 'A' : 'B'
  }
}

function pickScorePatch(patch) {
  const allowedKeys = [
    'schedule',
    'stats',
    'repeatedPartners',
    'scheduleQuality',
    'review',
    'resultSnapshot',
    'shareText',
    'generatedAt'
  ]
  return allowedKeys.reduce((next, key) => {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) next[key] = patch[key]
    return next
  }, {})
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action
  const data = event.data || {}

  if (action === 'login') {
    return ok({ openid })
  }

  if (action === 'getActivity') {
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

  if (action === 'listActivities') {
    try {
      await ensureCollection()
      const visibleFilter = { deleted: _.neq(true) }
      const size = Math.max(10, Math.min(80, Number(data.size) || 40))
      const page = Math.max(0, Number(data.page) || 0)
      const keyword = String(data.keyword || '').trim().toLowerCase()
      const owned = await activities.where({
        ownerOpenid: openid,
        ...visibleFilter
      }).limit(200).get()
      const admined = await activities.where({
        adminOpenids: openid,
        ...visibleFilter
      }).limit(200).get()
      const joined = await activities.where({
        participantOpenids: openid,
        ...visibleFilter
      }).limit(200).get()
      const legacyJoined = await activities.where({
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

  if (action === 'createActivity') {
    try {
      await ensureCollection()
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
        await activities.doc(activityId).update({ data: doc })
      } else {
        await activities.doc(activityId).set({ data: doc })
      }

      return ok({ activityId, openid, isOwner: true, isAdmin: true })
    } catch (error) {
      return fail(`创建活动失败：${error.message || error.errMsg || JSON.stringify(error)}`)
    }
  }

  if (action === 'updateActivity') {
    try {
      await ensureCollection()
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
      // Clear the null container first, otherwise nested writes can fail.
      const nullableObjectFields = ['scheduleQuality', 'review', 'resultSnapshot']
      for (let i = 0; i < nullableObjectFields.length; i += 1) {
        const key = nullableObjectFields[i]
        if (activity[key] === null && patch[key] && typeof patch[key] === 'object') {
          await activities.doc(activityId).update({
            data: {
              [key]: _.remove()
            }
          })
        }
      }

      await activities.doc(activityId).update({
        data: Object.assign({}, patch, {
          updatedAt: db.serverDate()
        })
      })
      return ok({ activityId, openid, isOwner: activity.ownerOpenid === openid, isAdmin: true })
    } catch (error) {
      return fail(`更新活动失败：${error.message || error.errMsg || JSON.stringify(error)}`)
    }
  }

  if (action === 'saveScore') {
    try {
      await ensureCollection()
      const activityId = data.activityId
      const gameId = String(data.gameId || '').trim()
      const scoreA = Number(data.scoreA)
      const scoreB = Number(data.scoreB)
      const activity = await getActivity(activityId)
      if (!activity) return fail('活动不存在')
      if (activity.deleted) return fail('活动已删除')
      if (!gameId) return fail('缺少对局 ID')
      if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) return fail('比分无效')

      const isAdmin = isActivityAdmin(activity, openid)
      const rotationPlayer = findRotationPlayer(activity, openid)
      if (!isAdmin && !rotationPlayer) return fail('只有当前轮转队员或管理员可以录入比分')

      const sourceSchedule = activity.schedule || []
      const target = sourceSchedule.find((game) => game.id === gameId)
      if (!target) return fail('未找到对局')
      if (target.completed) return fail('该对局已完成')

      const result = buildGameResult(target, scoreA, scoreB)
      if (!result) return fail('让分后不能平分')

      const schedule = sourceSchedule.map((game) => {
        if (game.id !== gameId) return game
        return Object.assign({}, game, {
          scoreA: String(scoreA),
          scoreB: String(scoreB),
          completed: true,
          result
        })
      })
      const scorePatch = pickScorePatch(data.patch || {})
      delete scorePatch.schedule
      const patchData = Object.assign({}, scorePatch, {
        schedule,
        updatedAt: db.serverDate()
      })

      const nullableObjectFields = ['scheduleQuality', 'review', 'resultSnapshot']
      for (let i = 0; i < nullableObjectFields.length; i += 1) {
        const key = nullableObjectFields[i]
        if (activity[key] === null && patchData[key] && typeof patchData[key] === 'object') {
          await activities.doc(activityId).update({
            data: {
              [key]: _.remove()
            }
          })
        }
      }

      await activities.doc(activityId).update({ data: patchData })
      return ok({ activityId, gameId, openid, isOwner: activity.ownerOpenid === openid, isAdmin })
    } catch (error) {
      return fail(`保存比分失败：${error.message || error.errMsg || JSON.stringify(error)}`)
    }
  }

  if (action === 'deleteActivity') {
    try {
      await ensureCollection()
      const activityId = data.activityId
      const activity = await getActivity(activityId)
      if (!activity) return ok({ activityId, deleted: true })
      if (activity.ownerOpenid !== openid) return fail('只有创建人可以删除活动')
      await activities.doc(activityId).remove()
      return ok({ activityId, deleted: true })
    } catch (error) {
      return fail(`删除活动失败：${error.message || error.errMsg || JSON.stringify(error)}`)
    }
  }

  if (action === 'addAdmin') {
    try {
      await ensureCollection()
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
      await activities.doc(activityId).update({
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

  if (action === 'removeAdmin') {
    try {
      await ensureCollection()
      const activityId = data.activityId
      const adminOpenid = String(data.adminOpenid || '').trim()
      const activity = await getActivity(activityId)
      if (!activity) return fail('活动不存在')
      if (activity.deleted) return fail('活动已删除')
      if (activity.ownerOpenid !== openid) return fail('只有创建人可以移除管理员')

      const adminOpenids = (activity.adminOpenids || []).filter((item) => item !== adminOpenid)
      await activities.doc(activityId).update({
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

  if (action === 'signup') {
    try {
      await ensureCollection()
      const activityId = data.activityId
      const player = data.player
      const activity = await getActivity(activityId)
      if (!activity) return fail('活动不存在')
      if (activity.deleted) return fail('活动已删除')
      if (activity.activityStatus === 'ended') return fail('活动已结束，无法报名')

      const promoted = autoPromoteBench(activity.participants || [], activity)
      const participants = promoted.participants
      const existingIndex = participants.findIndex((item) => item.openid === openid)
      const rotationLimit = rotationLimitFromActivity(activity)
      const presentCount = participants.filter((item) => isRealPlayer(item) && (!item.status || item.status === 'present')).length
      const canUseRotationSlot = !!activity.registrationOpen && !activity.rosterLocked
      const requestedId = player && player.id
      const nextPlayer = Object.assign({}, player, {
        openid,
        source: 'self',
        updatedAt: Date.now()
      })

      if (existingIndex >= 0) {
        let slotIndex = -1
        if (canUseRotationSlot && requestedId) {
          slotIndex = participants.findIndex((item, index) => {
            return item.id === requestedId && index < rotationLimit && (!item.openid || item.openid === openid)
          })
        }
        if (slotIndex >= 0 && slotIndex !== existingIndex) {
          const targetSlot = participants[slotIndex]
          participants.splice(existingIndex, 1)
          const adjustedSlotIndex = existingIndex < slotIndex ? slotIndex - 1 : slotIndex
          participants[adjustedSlotIndex] = Object.assign({}, targetSlot, nextPlayer, {
            id: targetSlot.id,
            status: 'present',
            statusText: '到场'
          })
        } else {
          participants[existingIndex] = Object.assign({}, participants[existingIndex], nextPlayer)
        }
      } else {
        let slotIndex = -1
        if (canUseRotationSlot && requestedId) {
          slotIndex = participants.findIndex((item, index) => {
            return item.id === requestedId && index < rotationLimit && !item.openid
          })
        }
        if (canUseRotationSlot && slotIndex < 0) {
          slotIndex = participants.findIndex((item, index) => {
            return index < rotationLimit && !item.openid && isDefaultPlayerName(item.name)
          })
        }
        if (slotIndex >= 0) {
          const targetStatus = slotIndex < rotationLimit || participants[slotIndex].status === 'present' ? 'present' : 'bench'
          participants[slotIndex] = Object.assign({}, participants[slotIndex], nextPlayer, {
            id: participants[slotIndex].id,
            status: targetStatus,
            statusText: targetStatus === 'present' ? '到场' : '替补'
          })
        } else {
          if (participants.length >= 18) return fail('当前最多支持 18 人')
          const shouldJoinPresent = presentCount < rotationLimit
          participants.push(Object.assign({}, nextPlayer, {
            status: shouldJoinPresent ? 'present' : 'bench',
            statusText: shouldJoinPresent ? '到场' : '替补',
            isNew: !shouldJoinPresent
          }))
        }
      }

      await activities.doc(activityId).update({
        data: {
          participants,
          participantOpenids: participants.map((item) => item.openid).filter(Boolean),
          batchText: participants.map((item) => item.name).join('\n'),
          updatedAt: db.serverDate()
        }
      })
      return ok({ participants, openid, isOwner: false })
    } catch (error) {
      return fail(`报名失败：${error.message || error.errMsg || JSON.stringify(error)}`)
    }
  }

  if (action === 'claimPlayer') {
    try {
      await ensureCollection()
      const activityId = data.activityId
      const playerId = String(data.playerId || '').trim()
      const activity = await getActivity(activityId)
      if (!activity) return fail('活动不存在')
      if (activity.deleted) return fail('活动已删除')
      if (!activity.registrationOpen || activity.rosterLocked) return fail('报名已关闭或名单已锁定')
      if (!playerId) return fail('请选择要认领的队员')

      const source = activity.participants || []
      const target = source.find((item) => item.id === playerId)
      if (!target) return fail('未找到要认领的队员')
      if (target.openid && target.openid !== openid) return fail('该队员已绑定其他微信')

      const claimed = source
        .filter((item) => item.id === playerId || item.openid !== openid)
        .map((item) => {
          if (item.id !== playerId) return item
          return Object.assign({}, item, {
            openid,
            updatedAt: Date.now()
          })
        })
      const participants = autoPromoteBench(claimed, activity).participants

      await activities.doc(activityId).update({
        data: {
          participants,
          participantOpenids: participants.map((item) => item.openid).filter(Boolean),
          batchText: participants.map((item) => item.name).join('\n'),
          updatedAt: db.serverDate()
        }
      })
      return ok({ participants, openid, isOwner: false })
    } catch (error) {
      return fail(`认领失败：${error.message || error.errMsg || JSON.stringify(error)}`)
    }
  }

  if (action === 'bindPlayerOpenid') {
    try {
      await ensureCollection()
      const activityId = data.activityId
      const playerId = String(data.playerId || '').trim()
      const bindOpenid = String(data.bindOpenid || '').trim()
      const removePlayerId = String(data.removePlayerId || '').trim()
      const activity = await getActivity(activityId)
      if (!activity) return fail('活动不存在')
      if (activity.deleted) return fail('活动已删除')
      if (!isActivityAdmin(activity, openid)) return fail('只有管理员可以绑定微信')
      if (!playerId || !bindOpenid) return fail('缺少绑定信息')

      const source = activity.participants || []
      const target = source.find((item) => item.id === playerId)
      if (!target) return fail('未找到要绑定的队员')
      const duplicate = source.find((item) => item.id !== playerId && item.openid === bindOpenid && item.id !== removePlayerId)
      if (duplicate) return fail('该微信已绑定其他队员')

      const participants = source
        .filter((item) => !removePlayerId || item.id !== removePlayerId)
        .map((item) => {
          if (item.id !== playerId) return item
          return Object.assign({}, item, {
            openid: bindOpenid,
            source: item.source || 'manual',
            boundFromPlayerId: removePlayerId,
            updatedAt: Date.now()
          })
        })

      await activities.doc(activityId).update({
        data: {
          participants,
          participantOpenids: participants.map((item) => item.openid).filter(Boolean),
          batchText: participants.map((item) => item.name).join('\n'),
          updatedAt: db.serverDate()
        }
      })
      return ok({ participants, openid, isAdmin: true })
    } catch (error) {
      return fail(`绑定失败：${error.message || error.errMsg || JSON.stringify(error)}`)
    }
  }

  if (action === 'cancelSignup') {
    try {
      await ensureCollection()
      const activityId = data.activityId
      const activity = await getActivity(activityId)
      if (!activity) return fail('活动不存在')
      if (activity.deleted) return fail('活动已删除')
      const hasScore = (activity.schedule || []).some((game) => {
        const hasResult = !!(game.completed || game.result)
        const hasDraftScore = String(game.scoreA || '') !== '' || String(game.scoreB || '') !== ''
        return hasResult || hasDraftScore
      })
      if (hasScore) return fail('已录入比分，不能取消报名')

      const rotationLimit = rotationLimitFromActivity(activity)
      const source = activity.participants || []
      const cancelledIndex = source.findIndex((item) => item.openid === openid)
      if (cancelledIndex < 0) return ok({ participants: source, openid, isOwner: false })
      const kept = source.reduce((list, item, index) => {
        if (item.openid !== openid) {
          list.push(item)
          return list
        }
        if (index < rotationLimit) {
          list.push({
            id: item.id,
            name: `队员${index + 1}`,
            gender: 'male',
            genderText: '男',
            level: 3,
            status: 'present',
            statusText: '到场',
            source: 'manual',
            isNew: false
          })
        }
        return list
      }, [])
      const participants = autoPromoteBench(kept, activity).participants
      await activities.doc(activityId).update({
        data: {
          participants,
          participantOpenids: participants.map((item) => item.openid).filter(Boolean),
          batchText: participants.map((item) => item.name).join('\n'),
          updatedAt: db.serverDate()
        }
      })
      return ok({ participants, openid, isOwner: false })
    } catch (error) {
      return fail(`取消报名失败：${error.message || error.errMsg || JSON.stringify(error)}`)
    }
  }

  if (action === 'getActivityQr') {
    try {
      await ensureCollection()
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
      await activities.doc(activityId).update({
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

  return fail('未知操作')
}
