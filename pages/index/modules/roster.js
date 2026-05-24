const { MAX_PLAYERS } = require('./config')

function isDefaultPlayerName(name) {
  return /^(队员|Player )\d+$/.test(String(name || ''))
}

function isRealPlayer(player) {
  if (!player || player.isSynthetic) return false
  return !!player.openid || !isDefaultPlayerName(player.name)
}

function rotationLimitFromActivity(activity) {
  const configured = Math.floor(Number(activity && (activity.presetCount || activity.selectedPreset)) || 0)
  if (configured) return Math.max(4, Math.min(MAX_PLAYERS, configured))
  const presentCount = ((activity && activity.participants) || []).filter((player) => !player.status || player.status === 'present').length
  return Math.max(4, Math.min(MAX_PLAYERS, presentCount || 6))
}

function autoPromoteBench(participants, activity) {
  const rotationLimit = rotationLimitFromActivity(activity || {})
  let presentCount = (participants || []).filter((player) => isRealPlayer(player) && (!player.status || player.status === 'present')).length
  let changed = false
  const next = (participants || []).map((player) => {
    if (presentCount >= rotationLimit || player.status !== 'bench') return player
    presentCount += 1
    changed = true
    return Object.assign({}, player, {
      status: 'present',
      statusText: '到场',
      isNew: true
    })
  })
  return { participants: next, changed }
}

module.exports = {
  isDefaultPlayerName,
  isRealPlayer,
  rotationLimitFromActivity,
  autoPromoteBench
}
