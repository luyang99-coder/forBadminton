/**
 * stats-util.js — 统计计算工具
 * 职责：积分排名、复牌质量统计、赛后数据快照
 */

/**
 * 构建积分排名
 * @param {Array} schedule 排阵
 * @param {Array} participants 参与人员
 * @param {string} ratingField 'rating' | 'skillLevel'
 */
function buildRankingStats(schedule, participants, ratingField = 'rating') {
  const stats = {}
  participants.forEach(p => {
    stats[p.openid || p.uuid] = {
      ...p,
      wins: 0, losses: 0, games: 0,
      totalScore: 0, totalLost: 0,
      netPoints: 0, winRate: '-'
    }
  })

  schedule.forEach(game => {
    if (!game.result) return
    const { scoreA, scoreB } = game.result
    if (scoreA == null || scoreB == null) return

    const winnerSide = scoreA > scoreB ? 'A' : (scoreB > scoreA ? 'B' : null)
    ;['A', 'B'].forEach(side => {
      const members = side === 'A' ? getTeamMembers(game.teamAText) : getTeamMembers(game.teamBText)
      const score = side === 'A' ? scoreA : scoreB
      const oppScore = side === 'A' ? scoreB : scoreA
      members.forEach(name => {
        const player = Object.values(stats).find(s => s.name === name)
        if (!player) {
          stats[name] = { name, wins: 0, losses: 0, games: 0, totalScore: 0, totalLost: 0, netPoints: 0, winRate: '-' }
        }
        const p = stats[name]
        p.games++
        p.totalScore += score
        p.totalLost += oppScore
        p.netPoints += (score - oppScore)
        if (winnerSide === side) p.wins++
        else p.losses++
        p.winRate = p.games > 0 ? Math.round(p.wins / p.games * 100) : 0
      })
    })
  })

  const byField = ratingField === 'rating' ? (s) => -(s.wins || 0) * 10000 - (s.netPoints || 0)
    : (s) => -(s.wins || 0) * 10000 + (s.losses || 0)

  return Object.values(stats)
    .sort((a, b) => byField(a) - byField(b))
    .map((s, i) => ({ ...s, rank: i + 1 }))
}

/**
 * 从队伍文本解析队员名
 */
function getTeamMembers(teamText) {
  return (String(teamText || ''))
    .replace(/[〔（【\[]\s*[^〕）】\]\]]+[〕）】\]\]]/g, '')
    .split(/[、,，\/\\]/)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * 赛后复盘数据快照
 */
function buildResultSnapshot(schedule, stats, review) {
  const completed = schedule.filter(g => g.result)
  if (!completed.length) return null

  const first = completed[0]
  const last = completed[completed.length - 1]
  const allPlayers = new Set()
  completed.forEach(g => {
    const a = getTeamMembers(g.teamAText)
    const b = getTeamMembers(g.teamBText)
    a.forEach(n => allPlayers.add(n))
    b.forEach(n => allPlayers.add(n))
  })

  return {
    title: (stats && stats.title) || '',
    date: (stats && stats.date) || '',
    venue: (stats && stats.venue) || '',
    endedAt: new Date().toISOString(),
    totalGames: schedule.length,
    completedGames: completed.length,
    playerCount: allPlayers.size,
    rankingStats: (stats && stats.rankingStats) || [],
    review: review || {}
  }
}

/**
 * 构建排阵质量统计
 */
function buildScheduleQuality(schedule) {
  const total = schedule.length
  const completed = schedule.filter(g => g.result).length
  const pending = total - completed
  const repeatPlayers = {}
  const played = new Set()
  schedule.forEach(game => {
    const a = getTeamMembers(game.teamAText)
    const b = getTeamMembers(game.teamBText)
    ;[...a, ...b].forEach(n => {
      played.add(n)
      repeatPlayers[n] = (repeatPlayers[n] || 0) + 1
    })
  })
  const maxRepeat = Math.max(0, ...Object.values(repeatPlayers))
  const avgGames = Object.values(repeatPlayers).length
    ? (Object.values(repeatPlayers).reduce((a, b) => a + b, 0) / Object.values(repeatPlayers).length).toFixed(1)
    : 0

  return {
    total,
    completed,
    pending,
    uniquePlayers: played.size,
    maxGamesPerPlayer: maxRepeat,
    avgGamesPerPlayer: avgGames,
    completionRate: total > 0 ? Math.round(completed / total * 100) : 0
  }
}

module.exports = {
  buildRankingStats,
  getTeamMembers,
  buildResultSnapshot,
  buildScheduleQuality
}
