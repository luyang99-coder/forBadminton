const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
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

// ============================================================
//  计分/结果逻辑
// ============================================================

async function handleSaveScore(event, openid) {
  try {
    const data = event.data || {}
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
        await db.collection(COLLECTION_NAME).doc(activityId).update({
          data: { [key]: db.command.remove() }
        })
      }
    }

    await db.collection(COLLECTION_NAME).doc(activityId).update({ data: patchData })
    return ok({ activityId, gameId, openid, isOwner: activity.ownerOpenid === openid, isAdmin })
  } catch (error) {
    return fail(`保存比分失败：${error.message || error.errMsg || JSON.stringify(error)}`)
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
    case 'saveScore':
      return await handleSaveScore(event, openid)
    default:
      return { ok: false, message: '未知操作' }
  }
}
