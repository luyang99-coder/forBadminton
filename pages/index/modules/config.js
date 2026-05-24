const PRESETS = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18]
const DEFAULT_HOURS = 2
const DEFAULT_GAME_MINUTES = 10
const MAX_PLAYERS = 18
const LEVEL_OPTIONS = [
  { label: '萌新', value: 0 },
  { label: '1级', value: 1 },
  { label: '2级', value: 2 },
  { label: '3级', value: 3 },
  { label: '4级', value: 4 },
  { label: '5级', value: 5 },
  { label: '6级', value: 6 },
  { label: '7级', value: 7 },
  { label: '8级', value: 8 },
  { label: '9级', value: 9 },
  { label: '专业级', value: 10 }
]
const HISTORY_KEY = 'badminton_activity_history'
const ACTIVITIES_KEY = 'badminton_activities'
const USER_KEY = 'badminton_local_user_key'
const CLOUD_FUNCTION = 'activityService'

function nowId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

function playerId() {
  return nowId('p')
}

module.exports = {
  PRESETS,
  DEFAULT_HOURS,
  DEFAULT_GAME_MINUTES,
  MAX_PLAYERS,
  LEVEL_OPTIONS,
  HISTORY_KEY,
  ACTIVITIES_KEY,
  USER_KEY,
  CLOUD_FUNCTION,
  nowId,
  playerId
}
