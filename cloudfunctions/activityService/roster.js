function isDefaultPlayerName(name) {
  return /^(闃熷憳|Player )\d+$/.test(String(name || ''))
}

function isRealPlayer(player) {
  if (!player || player.isSynthetic) return false
  return !!player.openid || !isDefaultPlayerName(player.name)
}

function rotationLimitFromActivity(activity) {
  const configured = Math.floor(Number(activity && (activity.presetCount || activity.selectedPreset)) || 0)
  if (configured) return Math.max(4, Math.min(18, configured))
  const presentCount = ((activity && activity.participants) || []).filter((item) => !item.status || item.status === 'present').length
  return Math.max(4, Math.min(18, presentCount || 6))
}

function autoPromoteBench(participants, activity) {
  const rotationLimit = rotationLimitFromActivity(activity || {})
  let presentCount = (participants || []).filter((item) => isRealPlayer(item) && (!item.status || item.status === 'present')).length
  let changed = false
  const next = (participants || []).map((item) => {
    if (presentCount >= rotationLimit || item.status !== 'bench') return item
    presentCount += 1
    changed = true
    return Object.assign({}, item, {
      status: 'present',
      statusText: '鍒板満',
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
