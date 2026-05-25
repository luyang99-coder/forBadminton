/**
 * canvas-export.js — Canvas 海报导出
 * 职责：轮转安排图、赛后复盘图、二维码海报
 * 依赖：stats-util.js（getTeamMembers）
 */
const { getTeamMembers } = require('./stats-util')

// ---- 主题色（绿色系，与小程序一致） ----
const THEME = {
  bg: '#f2f6f4',
  green: '#16744f',
  greenDark: '#0f5e41',
  cardBg: '#ffffff',
  tagBg: '#f4f8f6',
  text: '#17201b',
  textSecondary: '#4a5a52',
  textMuted: '#8a9a92'
}

// ---- 辅助方法 ----
function roundRect(ctx, x, y, w, h, r, color) {
  ctx.setFillStyle(color)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arc(x + w - r, y + r, r, 1.5 * Math.PI, 0)
  ctx.lineTo(x + w, y + h - r)
  ctx.arc(x + w - r, y + h - r, r, 0, 0.5 * Math.PI)
  ctx.lineTo(x + r, y + h)
  ctx.arc(x + r, y + h - r, r, 0.5 * Math.PI, Math.PI)
  ctx.lineTo(x, y + r)
  ctx.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI)
  ctx.closePath()
  ctx.fill()
}

function wrapText(ctx, text, maxWidth) {
  const str = String(text || '')
  if (!str.length) return ['']
  const maxChars = Math.max(1, Math.floor(maxWidth / 7))
  const lines = []
  let current = ''
  let currentW = 0
  for (const ch of str) {
    const cw = ch.charCodeAt(0) > 127 ? 13 : 7
    if (currentW + cw > maxWidth * 0.95 && current.length > 0) {
      lines.push(current)
      current = ch
      currentW = cw
    } else {
      current += ch
      currentW += cw
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [str]
}

// ============ 公开 API ============

/**
 * 导出轮转安排海报
 */
function drawSchedulePoster(ctx, data, { width = 375, padding = 18 }) {
  const cardX = padding
  const cardW = width - padding * 2
  const gameCardH = 80
  const statCount = Math.min(6, (data.posterStats || []).length)

  // ---- 底色 ----
  ctx.setFillStyle(THEME.bg)
  ctx.fillRect(0, 0, width, 10000) // 先填满，后面裁剪

  return new Promise((resolve) => {
    // 先画全部
    finishDraw(ctx, width, padding, cardX, cardW, data, gameCardH, statCount, resolve)
  })
}

function finishDraw(ctx, width, padding, cardX, cardW, data, gameCardH, statCount, resolve) {
  const t = THEME

  // 头部
  roundRect(ctx, cardX, 12, cardW, 140, 12, t.cardBg)
  ctx.setFillStyle(t.text)
  ctx.setFontSize(16)
  ctx.fillText(String(data.title || '').slice(0, 24), padding + 2, 36)
  ctx.setFillStyle(t.textSecondary)
  ctx.setFontSize(10)
  ctx.fillText(String(data.subtitle || '').slice(0, 36), padding + 2, 54)
  ctx.fillText(`导出 ${data.generatedAt || getFormattedTime()}`, padding + 2, 70)

  // 概览标签
  const summaryY = 84
  const gap4 = 8
  const sw4 = (cardW - 12 - gap4 * 3) / 4
  const summary = data.summary || []
  summary.forEach((item, idx) => {
    const x = cardX + 6 + idx * (sw4 + gap4)
    roundRect(ctx, x, summaryY, sw4, 42, 7, t.tagBg)
    ctx.setTextAlign('center')
    ctx.setFillStyle(t.textMuted)
    ctx.setFontSize(9)
    ctx.fillText(item.t, x + sw4 / 2, summaryY + 16)
    ctx.setFillStyle(t.text)
    ctx.setFontSize(12)
    ctx.fillText(String(item.n), x + sw4 / 2, summaryY + 34)
  })
  ctx.setTextAlign('left')

  // 轮转
  let y = 172
  ctx.setFillStyle(t.text)
  ctx.setFontSize(13)
  ctx.fillText('轮转安排', padding, y)
  y += 12

  data.schedule.forEach((game) => {
    const gh = gameCardH - 4
    roundRect(ctx, cardX, y, cardW, gh, 8, t.cardBg)

    ctx.setFillStyle(t.textSecondary)
    ctx.setFontSize(10)
    ctx.fillText(`第${game.round}轮 | ${game.court}号场`, padding + 2, y + 14)
    if (game.result) {
      ctx.setTextAlign('right')
      ctx.setFillStyle(t.greenDark)
      ctx.setFontSize(11)
      ctx.fillText(`${game.result.scoreA}:${game.result.scoreB}`, width - padding - 2, y + 14)
      ctx.setTextAlign('left')
    }

    const halfW = Math.floor((cardW - 48) / 2)
    ctx.setFillStyle(t.text)
    ctx.setFontSize(11)
    const linesA = writeTeams(ctx, padding + 2, y, halfW, game.teamAText)
    ctx.setTextAlign('center')
    ctx.setFillStyle(t.textMuted)
    ctx.setFontSize(11)
    ctx.fillText('VS', cardX + cardW / 2, y + 24 + (linesA - 1) * 7)
    ctx.setTextAlign('left')
    ctx.setFillStyle(t.text)
    const linesB = writeTeams(ctx, padding + 2 + halfW + 24, y, halfW, game.teamBText)

    const maxLines = Math.max(linesA, linesB, 1)
    ctx.setFillStyle(t.textMuted)
    ctx.setFontSize(9)
    ctx.fillText(`休息：${String(game.restText || '').slice(0, 26)}`, padding + 2, y + 20 + maxLines * 14 + 8)

    y += gh + 4
  })

  // 排名
  y += 4
  const statCardH = 28 + statCount * 22 + 16
  roundRect(ctx, cardX, y, cardW, statCardH, 8, t.cardBg)
  ctx.setFillStyle(t.text)
  ctx.setFontSize(13)
  ctx.fillText(data.rankingStats.length ? '实时排名' : '出场统计', padding, y + 20)

  ;(data.posterStats || []).slice(0, statCount).forEach((item, idx) => {
    ctx.setFillStyle(t.textSecondary)
    ctx.setFontSize(10)
    const text = item.rank
      ? `${item.rank}. ${item.name}  ${item.wins || 0}胜${item.losses || 0}负  净胜${item.netPoints || 0}`
      : `${idx + 1}. ${item.name}  ${item.games}局  胜率${item.winRate || '-'}`
    ctx.fillText(String(text).slice(0, 38), padding, y + 48 + idx * 22)
  })

  // 水印
  ctx.setFillStyle(t.textMuted)
  ctx.setFontSize(9)
  ctx.setTextAlign('center')
  ctx.fillText('羽毛球打转小程序', width / 2, y + statCardH + 30)
  ctx.setTextAlign('left')

  resolve()
}

/**
 * 导出赛后复盘海报
 */
function drawResultPoster(ctx, snapshot, { width = 375, padding = 18 }) {
  const t = THEME
  const cardX = padding
  const cardW = width - padding * 2

  ctx.setFillStyle(t.bg)
  ctx.fillRect(0, 0, width, 10000)

  return new Promise((resolve) => {
    finishResultDraw(ctx, width, padding, cardX, cardW, snapshot, t, resolve)
  })
}

function finishResultDraw(ctx, width, padding, cardX, cardW, snapshot, t, resolve) {
  const ranking = (snapshot.rankingStats || []).slice(0, 10)
  const review = snapshot.review || {}
  const cards = [
    { title: '最佳搭档', value: review.bestPartner || '-' },
    { title: '最高胜率', value: review.bestWinRate || '-' },
    { title: '最均衡对局', value: review.mostBalancedGame || '-' },
    { title: '重复风险', value: review.repeatRisk || '-' }
  ]

  // 头部
  roundRect(ctx, cardX, 12, cardW, 118, 14, t.green)
  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(18)
  ctx.fillText(String(snapshot.title || '').slice(0, 18) + ' 赛后复盘', padding + 4, 44)
  ctx.setFillStyle('#d1e8dc')
  ctx.setFontSize(11)
  const line1 = `${String(snapshot.date || '时间待定').slice(0, 24)} | ${String(snapshot.venue || '场地待定').slice(0, 14)}`
  ctx.fillText(line1, padding + 4, 66)
  ctx.fillText(`完成 ${snapshot.completedGames}/${snapshot.totalGames} 局 · ${snapshot.playerCount} 人`, padding + 4, 84)
  ctx.fillText(`导出 ${snapshot.endedAt || getFormattedTime()}`, padding + 4, 102)

  // 复盘卡片
  let y = 148
  cards.forEach((item) => {
    roundRect(ctx, cardX, y, cardW, 72, 10, t.cardBg)
    ctx.setFillStyle(t.textSecondary)
    ctx.setFontSize(11)
    ctx.fillText(item.title, padding + 4, y + 22)
    ctx.setFillStyle(t.text)
    ctx.setFontSize(12)
    const valLines = wrapText(ctx, item.value, cardW - 20)
    valLines.forEach((line, li) => {
      ctx.fillText(line, padding + 4, y + 44 + li * 16)
    })
    y += 78
  })

  // 排名
  y += 4
  const rankH = 30 + ranking.length * 22 + 12
  roundRect(ctx, cardX, y, cardW, rankH, 10, t.cardBg)
  ctx.setFillStyle(t.text)
  ctx.setFontSize(14)
  ctx.fillText('积分排名', padding + 4, y + 22)
  ranking.forEach((item, idx) => {
    const ry = y + 38 + idx * 22
    ctx.setFillStyle(idx < 3 ? t.greenDark : t.textSecondary)
    ctx.setFontSize(10)
    const namePart = `${idx + 1}. ${item.name}`
    const statPart = `${item.wins || 0}胜${item.losses || 0}负  净胜${item.netPoints || 0}`
    ctx.fillText(`${namePart}  ${statPart}`.slice(0, 36), padding + 4, ry)
  })

  // 水印
  ctx.setFillStyle(t.textMuted)
  ctx.setFontSize(9)
  ctx.setTextAlign('center')
  ctx.fillText('羽毛球打转小程序 · 赛后结果', width / 2, y + rankH + 20)
  ctx.setTextAlign('left')

  resolve()
}

// ---- 内部辅助 ----
function writeTeams(ctx, x, y, maxW, text) {
  const lines = wrapText(ctx, text, maxW - 4)
  lines.forEach((line, li) => {
    ctx.fillText(line, x + 2, y + 22 + li * 14)
  })
  return lines.length
}

function getFormattedTime() {
  const d = new Date()
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

module.exports = {
  drawSchedulePoster,
  drawResultPoster,
  THEME
}
