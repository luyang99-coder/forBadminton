/**
 * 羽毛球轮转排阵算法
 * 基于贪心搜索 + 多轮随机扰动取全局最优
 */
const { nowId } = require('./config')
const { normalizeLevel, levelLabel, genderText, teamLevel, teamNames } = require('./player')

/** 候选缓存：避免重复计算相同球员集合的候选 */
const candidateCache = new Map()

function pairKey(a, b) {
  return [a, b].sort().join('|')
}

function groupKey(ids) {
  return ids.slice().sort().join('|')
}

function combinations(items, size) {
  const result = []
  function walk(start, picked) {
    if (picked.length === size) {
      result.push(picked.slice())
      return
    }
    for (let i = start; i <= items.length - (size - picked.length); i += 1) {
      picked.push(items[i])
      walk(i + 1, picked)
      picked.pop()
    }
  }
  walk(0, [])
  return result
}

function splitTeams(group) {
  const [a, b, c, d] = group
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] }
  ]
}

function hasMixedTeam(team) {
  const genders = team.map((player) => player.gender)
  return genders.indexOf('male') >= 0 && genders.indexOf('female') >= 0
}

function teamType(team) {
  const male = team.filter((player) => player.gender === 'male').length
  const female = team.filter((player) => player.gender === 'female').length
  if (male === 2) return 'md'
  if (female === 2) return 'wd'
  if (male >= 1 && female >= 1) return 'xd'
  return 'open'
}

function teamTypeText(type) {
  if (type === 'md') return '男双'
  if (type === 'wd') return '女双'
  if (type === 'xd') return '混双'
  return '不限'
}

function resolveHandicap(teamAType, teamBType, handicap) {
  const cfg = Object.assign({
    mdVsXd: 3,
    mdVsWd: 6,
    xdVsWd: 3
  }, handicap || {})
  let handicapA = 0
  let handicapB = 0
  const apply = (giver, receiver, value) => {
    const points = Math.max(0, Number(value) || 0)
    if (teamAType === giver && teamBType === receiver) handicapB = points
    if (teamAType === receiver && teamBType === giver) handicapA = points
  }
  apply('md', 'xd', cfg.mdVsXd)
  apply('md', 'wd', cfg.mdVsWd)
  apply('xd', 'wd', cfg.xdVsWd)
  return { handicapA, handicapB }
}

function makeEmptyState(players) {
  const state = {
    appearances: {},
    wins: {},
    losses: {},
    partnerCounts: {},
    partnerWins: {},
    opponentCounts: {},
    groupCounts: {},
    lastRound: {}
  }
  players.forEach((player) => {
    state.appearances[player.id] = 0
    state.wins[player.id] = 0
    state.losses[player.id] = 0
    state.lastRound[player.id] = -99
  })
  return state
}

function addGameToState(state, game) {
  const ids = game.playerIds || []
  ids.forEach((id) => {
    state.appearances[id] = (state.appearances[id] || 0) + 1
    state.lastRound[id] = game.roundIndex
  })
  ;(game.partnerKeys || []).forEach((key) => {
    state.partnerCounts[key] = (state.partnerCounts[key] || 0) + 1
  })
  ;(game.opponentKeys || []).forEach((key) => {
    state.opponentCounts[key] = (state.opponentCounts[key] || 0) + 1
  })
  if (game.groupKey) {
    state.groupCounts[game.groupKey] = (state.groupCounts[game.groupKey] || 0) + 1
  }
  if (game.result && game.result.winner) {
    const winnerIds = game.result.winner === 'A' ? game.teamAIds : game.teamBIds
    const loserIds = game.result.winner === 'A' ? game.teamBIds : game.teamAIds
    winnerIds.forEach((id) => { state.wins[id] = (state.wins[id] || 0) + 1 })
    loserIds.forEach((id) => { state.losses[id] = (state.losses[id] || 0) + 1 })
    ;(game.partnerKeys || []).forEach((key) => {
      const idsInPair = key.split('|')
      const wonTogether = idsInPair.every((id) => winnerIds.indexOf(id) >= 0)
      if (wonTogether) state.partnerWins[key] = (state.partnerWins[key] || 0) + 1
    })
  }
}

function buildStateFromGames(players, games) {
  const state = makeEmptyState(players)
  games.forEach((game) => addGameToState(state, game))
  return state
}

function constraintPenalty(teamAIds, teamBIds, options) {
  let penalty = 0
  const teamOf = {}
  teamAIds.forEach((id) => { teamOf[id] = 'A' })
  teamBIds.forEach((id) => { teamOf[id] = 'B' })

  ;(options.fixedPairs || []).forEach((pair) => {
    if (teamOf[pair.a] && teamOf[pair.b] && teamOf[pair.a] !== teamOf[pair.b]) {
      penalty = Number.POSITIVE_INFINITY
    }
  })
  if (!Number.isFinite(penalty)) return penalty
  ;(options.avoidPairs || []).forEach((pair) => {
    if (teamOf[pair.a] && teamOf[pair.b] && teamOf[pair.a] === teamOf[pair.b]) {
      penalty += 180
    }
  })
  return penalty
}

function buildCandidates(players, options) {
  // 缓存：相同球员集合+约束 → 复用结果
  const cacheKey = players.map(function(p) { return p.id }).sort().join(',') +
    '|' + (options.avoidWomenDoubles ? 'a' : '') +
    '|' + (options.preferMixed ? 'm' : '')
  const cached = candidateCache.get(cacheKey)
  if (cached) return cached

  const groups = combinations(players, 4)
  const candidates = []

  groups.forEach((group) => {
    splitTeams(group).forEach((split) => {
      const ids = group.map((player) => player.id)
      const teamAIds = split.teamA.map((player) => player.id)
      const teamBIds = split.teamB.map((player) => player.id)
      const partnerKeys = [pairKey(teamAIds[0], teamAIds[1]), pairKey(teamBIds[0], teamBIds[1])]
      const opponentKeys = [
        pairKey(teamAIds[0], teamBIds[0]),
        pairKey(teamAIds[0], teamBIds[1]),
        pairKey(teamAIds[1], teamBIds[0]),
        pairKey(teamAIds[1], teamBIds[1])
      ]
      const penalty = constraintPenalty(teamAIds, teamBIds, options)
      if (!Number.isFinite(penalty)) return
      const teamAType = teamType(split.teamA)
      const teamBType = teamType(split.teamB)
      if (options.avoidWomenDoubles && (teamAType === 'wd' || teamBType === 'wd')) return
      const handicap = resolveHandicap(teamAType, teamBType, options.handicap)
      candidates.push({
        players: group,
        ids,
        teamA: split.teamA,
        teamB: split.teamB,
        teamAIds,
        teamBIds,
        partnerKeys,
        opponentKeys,
        groupKey: groupKey(ids),
        skillGap: Math.abs(teamLevel(split.teamA) - teamLevel(split.teamB)),
        teamAType,
        teamBType,
        handicapA: handicap.handicapA,
        handicapB: handicap.handicapB,
        mixedPenalty: (hasMixedTeam(split.teamA) ? 0 : 1) + (hasMixedTeam(split.teamB) ? 0 : 1),
        constraintPenalty: penalty
      })
    })
  })

  candidateCache.set(cacheKey, candidates)
  if (candidateCache.size > 32) {
    const firstKey = candidateCache.keys().next().value
    candidateCache.delete(firstKey)
  }
  return candidates
}

function scoreCandidate(candidate, state, players, slotIndex, roundIndex, options, noise) {
  const projected = Object.assign({}, state.appearances)
  candidate.ids.forEach((id) => { projected[id] = (projected[id] || 0) + 1 })

  const target = ((slotIndex + 1) * 4) / players.length
  const weights = options.weights || { fairness: 5, repeat: 5, skill: 5 }
  const fairnessWeight = Number(weights.fairness || 5) / 5
  const repeatWeight = Number(weights.repeat || 5) / 5
  const skillWeight = Number(weights.skill || 5) / 5
  const fairnessScore = players.reduce((sum, player) => {
    const diff = (projected[player.id] || 0) - target
    return sum + diff * diff * 24 * fairnessWeight
  }, 0)
  const partnerRepeatScore = candidate.partnerKeys.reduce((sum, key) => sum + (state.partnerCounts[key] || 0) * 54 * repeatWeight, 0)
  const opponentRepeatScore = candidate.opponentKeys.reduce((sum, key) => sum + (state.opponentCounts[key] || 0) * 9 * repeatWeight, 0)
  const sameFourScore = (state.groupCounts[candidate.groupKey] || 0) * 24 * repeatWeight
  const consecutiveScore = candidate.ids.reduce((sum, id) => sum + (state.lastRound[id] === roundIndex - 1 ? 6 : 0), 0)
  const waitingRelief = candidate.ids.reduce((sum, id) => sum + Math.max(0, roundIndex - (state.lastRound[id] || -99) - 1), 0)
  const skillScore = options.balanceSkill ? candidate.skillGap * 14 * skillWeight : 0
  const mixedScore = options.preferMixed ? candidate.mixedPenalty * 28 : 0
  const handicapScore = Math.max(candidate.handicapA || 0, candidate.handicapB || 0) * 4
  const lowLevelConsecutiveScore = options.restLowLevel
    ? candidate.players.reduce((sum, player) => sum + (normalizeLevel(player.level) <= 2 && state.lastRound[player.id] === roundIndex - 1 ? 60 : 0), 0)
    : 0
  const newcomerFirstRestScore = options.newcomerFirstRest && roundIndex === 0
    ? candidate.players.reduce((sum, player) => sum + (player.isNew ? 80 : 0), 0)
    : 0
  const manualRestScore = (options.manualRests || []).some((rule) => {
    return Number(rule.round) === roundIndex + 1 && candidate.ids.indexOf(rule.playerId) >= 0
  }) ? 1000 : 0

  return fairnessScore + partnerRepeatScore + opponentRepeatScore + sameFourScore +
    consecutiveScore + skillScore + mixedScore + handicapScore + lowLevelConsecutiveScore +
    newcomerFirstRestScore + manualRestScore + candidate.constraintPenalty - waitingRelief + noise
}

function makeGame(candidate, slot, roundIndex, courtIndex, players) {
  const rest = players.filter((player) => candidate.ids.indexOf(player.id) === -1)
  return {
    id: nowId('g'),
    roundIndex,
    round: roundIndex + 1,
    court: courtIndex + 1,
    playerIds: candidate.ids,
    teamAIds: candidate.teamAIds,
    teamBIds: candidate.teamBIds,
    partnerKeys: candidate.partnerKeys,
    opponentKeys: candidate.opponentKeys,
    groupKey: candidate.groupKey,
    teamAText: teamNames(candidate.teamA),
    teamBText: teamNames(candidate.teamB),
    teamAType: teamTypeText(candidate.teamAType),
    teamBType: teamTypeText(candidate.teamBType),
    teamATypeCode: candidate.teamAType,
    teamBTypeCode: candidate.teamBType,
    handicapA: candidate.handicapA || 0,
    handicapB: candidate.handicapB || 0,
    handicapText: (() => {
      if (candidate.handicapA) return `${teamTypeText(candidate.teamBType)}让${teamTypeText(candidate.teamAType)} ${candidate.handicapA} 分`
      if (candidate.handicapB) return `${teamTypeText(candidate.teamAType)}让${teamTypeText(candidate.teamBType)} ${candidate.handicapB} 分`
      return '无让分'
    })(),
    restText: rest.map((player) => player.name).join(''),
    skillGap: candidate.skillGap,
    scoreA: '',
    scoreB: '',
    result: null,
    completed: false,
    order: slot + 1
  }
}

function runGreedy(players, totalGames, courtCount, options, seedNoise, baseGames) {
  const playableCourts = Math.max(1, Math.min(courtCount, Math.floor(players.length / 4)))
  const candidates = buildCandidates(players, options)
  const state = buildStateFromGames(players, baseGames || [])
  const games = []
  let totalScore = 0

  for (let slot = 0; slot < totalGames; slot += 1) {
    const absoluteSlot = (baseGames || []).length + slot
    const roundIndex = Math.floor(absoluteSlot / playableCourts)
    const courtIndex = absoluteSlot % playableCourts
    const usedThisRound = {}
    ;(baseGames || []).concat(games)
      .filter((game) => game.roundIndex === roundIndex)
      .forEach((game) => game.playerIds.forEach((id) => { usedThisRound[id] = true }))

    let best = null
    let bestScore = Number.POSITIVE_INFINITY
    candidates.forEach((candidate, index) => {
      if (candidate.ids.some((id) => usedThisRound[id])) return
      const noise = seedNoise ? Math.sin((slot + 1) * (index + 7) * seedNoise) * 4 : 0
      const score = scoreCandidate(candidate, state, players, absoluteSlot, roundIndex, options, noise)
      if (score < bestScore) {
        best = candidate
        bestScore = score
      }
    })
    if (!best) break

    const game = makeGame(best, absoluteSlot, roundIndex, courtIndex, players)
    addGameToState(state, game)
    games.push(game)
    totalScore += bestScore
  }

  return { games, score: totalScore, playableCourts, state }
}

function generateSchedule(players, totalGames, courtCount, options, baseGames) {
  let bestRun = null
  const trials = players.length > 12 ? 10 : 14
  for (let i = 0; i < trials; i += 1) {
    const run = runGreedy(players, totalGames, courtCount, options, i * 1.37, baseGames)
    if (!bestRun || run.score < bestRun.score) bestRun = run
  }
  if (!bestRun) {
    return { games: baseGames || [], stats: [], repeatedPartners: [], playableCourts: 1 }
  }
  const allGames = (baseGames || []).concat(bestRun.games)
  const finalState = buildStateFromGames(players, allGames)
  const stats = players.map((player) => {
    const wins = finalState.wins[player.id] || 0
    const losses = finalState.losses[player.id] || 0
    const completed = wins + losses
    return {
      id: player.id,
      name: player.name,
      games: finalState.appearances[player.id] || 0,
      wins,
      losses,
      winRate: completed ? `${Math.round((wins / completed) * 100)}%` : '-',
      level: normalizeLevel(player.level),
      levelLabel: levelLabel(player.level),
      genderText: genderText(player.gender)
    }
  })
  const repeatedPartners = Object.keys(finalState.partnerCounts)
    .filter((key) => finalState.partnerCounts[key] > 1)
    .map((key) => ({
      names: key.split('|').map((id) => (players.find((player) => player.id === id) || {}).name || id).join(' / '),
      count: finalState.partnerCounts[key],
      wins: finalState.partnerWins[key] || 0
    }))
  return {
    games: allGames,
    stats,
    repeatedPartners,
    playableCourts: bestRun.playableCourts,
    quality: buildScheduleQuality(allGames, players, repeatedPartners)
  }
}

function buildScheduleQuality(games, players, repeatedPartners) {
  const counts = {}
  const rests = {}
  const opponentCounts = {}
  ;(players || []).forEach((player) => {
    counts[player.id] = 0
    rests[player.id] = 0
  })
  ;(games || []).forEach((game) => {
    ;(game.playerIds || []).forEach((id) => { counts[id] = (counts[id] || 0) + 1 })
    ;(players || []).forEach((player) => {
      if ((game.playerIds || []).indexOf(player.id) < 0) rests[player.id] = (rests[player.id] || 0) + 1
    })
    ;(game.opponentKeys || []).forEach((key) => { opponentCounts[key] = (opponentCounts[key] || 0) + 1 })
  })
  const values = Object.keys(counts).map((id) => counts[id])
  const restValues = Object.keys(rests).map((id) => rests[id])
  const appearanceSpread = values.length ? Math.max.apply(null, values) - Math.min.apply(null, values) : 0
  const restSpread = restValues.length ? Math.max.apply(null, restValues) - Math.min.apply(null, restValues) : 0
  const repeatedOpponentCount = Object.keys(opponentCounts).filter((key) => opponentCounts[key] > 1).length
  const skillGaps = (games || []).map((game) => Number(game.skillGap) || 0)
  const avgSkillGap = skillGaps.length ? Math.round((skillGaps.reduce((sum, item) => sum + item, 0) / skillGaps.length) * 10) / 10 : 0
  const repeatedPartnerCount = (repeatedPartners || []).length
  const score = Math.max(0, 100 - appearanceSpread * 12 - restSpread * 8 - repeatedPartnerCount * 6 - repeatedOpponentCount * 2 - avgSkillGap * 4)
  return {
    score: Math.round(score),
    appearanceSpread,
    restSpread,
    repeatedPartnerCount,
    repeatedOpponentCount,
    avgSkillGap
  }
}
/** 清除排阵缓存（球员/约束变更时调用） */
function clearCandidateCache() {
  candidateCache.clear()
}

module.exports = {
  pairKey,
  generateSchedule,
  buildStateFromGames,
  buildScheduleQuality,
  clearCandidateCache
}
