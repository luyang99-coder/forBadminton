const { MAX_PLAYERS, LEVEL_OPTIONS, playerId } = require('./config')
const { rotationLimitFromActivity } = require('./roster')

function makePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: playerId(),
    name: `队员${index + 1}`,
    gender: 'male',
    genderText: '男',
    level: 3,
    status: 'present',
    statusText: '到场',
    source: 'manual',
    isNew: false
  }))
}

function makePlayerWithName(name) {
  return {
    id: playerId(),
    name,
    gender: 'male',
    genderText: '男',
    level: 3,
    status: 'present',
    statusText: '到场',
    source: 'manual',
    isNew: false
  }
}

function nextDefaultPlayerName(players) {
  const used = {}
  ;(players || []).forEach((player) => { used[player.name] = true })
  let index = 1
  while (used[`队员${index}`]) index += 1
  return `队员${index}`
}

function normalizeLevel(level) {
  const value = Math.floor(Number(level))
  if (Number.isNaN(value)) return 3
  return Math.max(0, Math.min(10, value))
}

function levelIndex(level) {
  const value = normalizeLevel(level)
  const index = LEVEL_OPTIONS.findIndex((item) => item.value === value)
  return index >= 0 ? index : 3
}

function levelLabel(level) {
  return LEVEL_OPTIONS[levelIndex(level)].label
}

function uniqueNames(text) {
  const seen = {}
  const names = []
  String(text || '')
    .split(/[\n,??\s]+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .forEach((name) => {
      if (!seen[name]) {
        seen[name] = true
        names.push(name)
      }
    })
  return names.slice(0, MAX_PLAYERS)
}

function teamLevel(team) {
  return team.reduce((sum, player) => sum + normalizeLevel(player.level), 0)
}

function teamNames(team) {
  return team.map((player) => player.name).join(' / ')
}

function genderText(gender) {
  if (gender === 'male') return '男'
  if (gender === 'female') return '女'
  return '男'
}

function statusText(status) {
  if (status === 'bench') return '替补'
  if (status === 'late') return '迟到'
  if (status === 'absent') return '缺席'
  return '到场'
}

function signupMeta(activity, participants) {
  const rotationLimit = rotationLimitFromActivity(activity || {})
  const presentCount = (participants || []).filter((player) => !player.status || player.status === 'present').length
  if (activity && activity.activityStatus === 'ended') {
    return {
      buttonText: '',
      hint: '',
      modeText: '已结束'
    }
  }
  const willBench = presentCount >= rotationLimit
  return {
    buttonText: willBench ? '加入替补' : '报名',
    hint: willBench
      ? `当前到场 ${presentCount}/${rotationLimit} 人，新报名将进入替补。`
      : `当前到场 ${presentCount}/${rotationLimit} 人，新报名会进入到场名单。`,
    modeText: willBench ? '替补' : '到场'
  }
}

function defaultActivityStartText() {
  const now = new Date()
  const start = new Date(now.getTime())
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const dayText = startDay === today ? '今天' : '明天'
  const hour = start.getHours()
  return `${dayText} ${hour < 10 ? '0' + hour : hour}:00`
}

function shortName(name, maxChars) {
  const value = String(name || '').trim()
  if (!value) return ''
  const limit = Math.max(1, Number(maxChars) || 2)
  const chars = Array.from(value)
  if (chars.length <= limit) return value
  return `${chars.slice(0, limit).join('')}...`
}

module.exports = {
  makePlayers,
  makePlayerWithName,
  nextDefaultPlayerName,
  normalizeLevel,
  levelIndex,
  levelLabel,
  uniqueNames,
  teamLevel,
  teamNames,
  genderText,
  statusText,
  signupMeta,
  defaultActivityStartText,
  shortName
}
