const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const COLLECTION_NAME = 'activities'

// ---------- 共享工具函数（从父函数复制核心逻辑）----------

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
//  报名逻辑
// ============================================================

async function handleSignup(event, openid) {
  try {
    await ensureCollection()
    const data = event.data || {}
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
    const presentCount = participants.filter(
      (item) => isRealPlayer(item) && (!item.status || item.status === 'present')
    ).length
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
        const targetStatus =
          slotIndex < rotationLimit || participants[slotIndex].status === 'present' ? 'present' : 'bench'
        participants[slotIndex] = Object.assign({}, participants[slotIndex], nextPlayer, {
          id: participants[slotIndex].id,
          status: targetStatus,
          statusText: targetStatus === 'present' ? '到场' : '替补'
        })
      } else {
        if (participants.length >= 18) return fail('当前最多支持 18 人')
        const shouldJoinPresent = presentCount < rotationLimit
        participants.push(
          Object.assign({}, nextPlayer, {
            status: shouldJoinPresent ? 'present' : 'bench',
            statusText: shouldJoinPresent ? '到场' : '替补',
            isNew: !shouldJoinPresent
          })
        )
      }
    }

    await db.collection(COLLECTION_NAME).doc(activityId).update({
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

async function handleCancelSignup(event, openid) {
  try {
    await ensureCollection()
    const data = event.data || {}
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

    await db.collection(COLLECTION_NAME).doc(activityId).update({
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

async function handleClaimPlayer(event, openid) {
  try {
    await ensureCollection()
    const data = event.data || {}
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
        return Object.assign({}, item, { openid, updatedAt: Date.now() })
      })
    const participants = autoPromoteBench(claimed, activity).participants

    await db.collection(COLLECTION_NAME).doc(activityId).update({
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

async function handleBindPlayerOpenid(event, openid) {
  try {
    await ensureCollection()
    const data = event.data || {}
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
    const duplicate = source.find(
      (item) => item.id !== playerId && item.openid === bindOpenid && item.id !== removePlayerId
    )
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

    await db.collection(COLLECTION_NAME).doc(activityId).update({
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

// ============================================================
//  导出
// ============================================================

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action
  const data = event.data || {}

  switch (action) {
    case 'signup':
      return await handleSignup(event, openid)
    case 'cancelSignup':
      return await handleCancelSignup(event, openid)
    case 'claimPlayer':
      return await handleClaimPlayer(event, openid)
    case 'bindPlayerOpenid':
      return await handleBindPlayerOpenid(event, openid)
    default:
      return fail('未知操作')
  }
}
