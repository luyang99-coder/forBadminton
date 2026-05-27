/**
 * canvas-export.js — Canvas 海报导出（视觉增强版）
 * 职责：轮转安排图、赛后复盘图、二维码海报
 * 依赖：stats-util.js（getTeamMembers）
 *
 * 增强：彩色装饰条、court badge、奖牌图标、emoji 分区图标、章节分割线
 * 修复：VS 中心点精确对齐两队之间
 */
const { getTeamMembers } = require('./stats-util')

// ---- 主题色（绿色系，与小程序一致） ----
const THEME = {
  bg: '#f2f6f4',
  green: '#16744f',
  greenDark: '#0f5e41',
  greenLight: '#e8f5ee',
  cardBg: '#ffffff',
  tagBg: '#f4f8f6',
  text: '#17201b',
  textSecondary: '#4a5a52',
  textMuted: '#8a9a92',
  gold: '#f0a020',
  silver: '#8899aa',
  bronze: '#c08040',
  accentBlue: '#3b82d6',
  accentOrange: '#f59e0b',
  accentPurple: '#8b5cf6',
  accentPink: '#ec4899'
}

// ---- 辅助方法 ----
function roundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color
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

/**
 * 使用 Canvas measureText 精确换行
 */
function wrapText(ctx, text, maxWidth, fontSize) {
  const str = String(text || '')
  if (!str.length) return ['']

  const fs = fontSize || 11
  ctx.font = `normal ${fs}px sans-serif`

  const lines = []
  let current = ''

  for (const ch of str) {
    const testStr = current + ch
    const w = ctx.measureText ? ctx.measureText(testStr).width : (fs * 0.6 * testStr.length)
    if (w > maxWidth && current.length > 0) {
      lines.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [str]
}

/**
 * 安全填充文字（自动设字体 & 颜色）
 */
function safeFillText(ctx, text, x, y, opts = {}) {
  const fontSize = opts.fontSize || 11
  const color = opts.color || THEME.text
  const maxWidth = opts.maxWidth || Infinity
  const textAlign = opts.textAlign || 'left'

  ctx.font = `normal ${fontSize}px sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = textAlign

  if (maxWidth < Infinity) {
    const lines = wrapText(ctx, text, maxWidth, fontSize)
    const lineHeight = fontSize + 4
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * lineHeight)
    })
    return lines.length
  }

  const displayText = String(text || '').slice(0, 40)
  ctx.fillText(displayText, x, y)
  return 1
}

/**
 * 绘制彩色左侧竖条装饰
 */
function drawLeftAccent(ctx, x, y, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 4, h)
}

/**
 * 绘制场地徽章（彩色圆点 + 场地号）
 */
function drawCourtBadge(ctx, cx, cy, courtNum, bgColor) {
  const r = 13
  // 外圈阴影/底色
  ctx.beginPath()
  ctx.fillStyle = bgColor || THEME.green
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // 内圈白色
  ctx.beginPath()
  ctx.fillStyle = '#ffffff'
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2)
  ctx.fill()

  // 场地号
  ctx.fillStyle = bgColor || THEME.green
  ctx.font = 'bold 11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(courtNum), cx, cy + 4)
  ctx.textAlign = 'left'
}

/**
 * 绘制章节分割线
 */
function drawSectionDivider(ctx, x, w, y, label) {
  ctx.strokeStyle = '#e0e5e2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.stroke()

  if (label) {
    // 标签小圆点
    ctx.beginPath()
    ctx.fillStyle = THEME.green
    ctx.arc(x + 8, y, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = THEME.textSecondary
    ctx.font = 'normal 10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(label, x + 16, y + 4)
  }
}

// ---- 奖牌映射 ----
const MEDALS = ['🥇', '🥈', '🥉']

// ---- 复盘卡片图标 ----
const REVIEW_ICONS = {
  '最佳搭档': '🤝',
  '最高胜率': '🏆',
  '最均衡对局': '⚖️',
  '重复风险': '⚠️'
}

const REVIEW_COLORS = {
  '最佳搭档': THEME.accentBlue,
  '最高胜率': THEME.gold,
  '最均衡对局': THEME.accentPurple,
  '重复风险': THEME.accentOrange
}

// ============ 公开 API ============

/**
 * 导出轮转安排海报
 */
function drawSchedulePoster(ctx, data, { width = 375, padding = 18 } = {}) {
  const cardX = padding
  const cardW = width - padding * 2

  // ---- 底色 ----
  ctx.fillStyle = THEME.bg
  ctx.fillRect(0, 0, width, 10000)

  return new Promise((resolve) => {
    finishDraw(ctx, width, padding, cardX, cardW, data, resolve)
  })
}

function finishDraw(ctx, width, padding, cardX, cardW, data, resolve) {
  const t = THEME
  let y = 12

  // ========== 头部卡片（绿色左侧竖条 + emoji） ==========
  const headerH = 140
  roundRect(ctx, cardX, y, cardW, headerH, 12, t.cardBg)
  // 左侧绿色装饰条
  drawLeftAccent(ctx, cardX, y + 16, headerH - 32, t.green)
  // 标题区（文字缩进避开竖条）
  const textX = padding + 10
  safeFillText(ctx, '🏸 ' + (data.title || ''), textX, y + 24, { fontSize: 16, color: t.text })
  safeFillText(ctx, data.subtitle || '', textX, y + 44, { fontSize: 10, color: t.textSecondary })
  safeFillText(ctx, '📅 导出 ' + (data.generatedAt || getFormattedTime()), textX, y + 62, { fontSize: 10, color: t.textSecondary })

  // ========== 概览标签（含 emoji 图标） ==========
  const summaryY = y + 84
  const gap4 = 8
  const sw4 = (cardW - 12 - gap4 * 3) / 4
  const summary = data.summary || []
  const summaryEmojis = ['👥', '🏸', '📊', '⏱️']

  summary.forEach((item, idx) => {
    const x = cardX + 6 + idx * (sw4 + gap4)
    roundRect(ctx, x, summaryY, sw4, 42, 7, t.tagBg)
    // emoji 图标
    safeFillText(ctx, summaryEmojis[idx] || '•', x + sw4 / 2, summaryY + 14, { fontSize: 12, color: t.text, textAlign: 'center' })
    safeFillText(ctx, item.t || '', x + sw4 / 2, summaryY + 28, { fontSize: 9, color: t.textMuted, textAlign: 'center' })
    safeFillText(ctx, String(item.n || ''), x + sw4 / 2, summaryY + 40, { fontSize: 12, color: t.text, textAlign: 'center' })
  })

  // ========== 章节分割线 ==========
  y = headerH + 12 + 8
  drawSectionDivider(ctx, cardX + 4, cardW - 8, y, '轮转安排')

  // ========== 轮转安排 ==========
  y += 20
  const games = data.schedule || []

  games.forEach((game, gIdx) => {
    const gh = 80
    roundRect(ctx, cardX, y, cardW, gh, 8, t.cardBg)

    // 左侧绿色装饰条
    drawLeftAccent(ctx, cardX, y + 8, gh - 16, t.green)

    // Court badge（彩色圆点）
    const badgeX = cardX + 38
    const badgeY = y + 16
    // 不同场地用不同颜色
    const courtColors = [t.green, t.accentBlue, t.accentOrange, t.accentPurple, t.gold, t.accentPink]
    const courtColor = courtColors[(game.court - 1) % courtColors.length] || t.green
    drawCourtBadge(ctx, badgeX, badgeY, game.court, courtColor)

    // 第一行：轮次 + 比分（在 badge 右侧）
    const infoX = badgeX + 22
    safeFillText(ctx, '第' + game.round + '轮', infoX, y + 12, { fontSize: 10, color: t.textSecondary })
    if (game.result) {
      safeFillText(ctx, game.result.scoreA + ':' + game.result.scoreB, width - padding - 2, y + 12, {
        fontSize: 11, color: t.greenDark, textAlign: 'right'
      })
    }

    // 队伍A + VS + 队伍B（精确居中对齐）
    // VS 在 cardX + cardW/2 居中，两队分列两侧，间隙28px
    const halfW = (cardW - 28) / 2
    const teamY = y + 34

    // 左侧队伍名
    const linesA = safeFillText(ctx, game.teamAText || '', infoX, teamY, { fontSize: 10, color: t.text, maxWidth: halfW - 20 })
    // VS 居中
    const vsX = cardX + cardW / 2
    safeFillText(ctx, 'VS', vsX, teamY, { fontSize: 11, color: t.textMuted, textAlign: 'center' })
    // 右侧队伍名（VS 右侧 halfW 宽度）
    const teamBX = vsX + 14
    const linesB = safeFillText(ctx, game.teamBText || '', teamBX, teamY, { fontSize: 10, color: t.text, maxWidth: halfW - 10 })

    // 休息信息
    const maxLines = Math.max(linesA, linesB, 1)
    safeFillText(ctx, '🕐 休息：' + (game.restText || '—'), infoX, y + 34 + maxLines * 14 + 6, { fontSize: 9, color: t.textMuted })

    y += gh + 4
  })

  // ========== 章节分割线 ==========
  y += 6
  drawSectionDivider(ctx, cardX + 4, cardW - 8, y, '排名统计')

  // ========== 排名/统计 ==========
  y += 20
  const statCount = Math.min(6, (data.posterStats || []).length)
  const statCardH = 28 + statCount * 22 + 16
  roundRect(ctx, cardX, y, cardW, statCardH, 8, t.cardBg)

  // 左侧装饰条
  drawLeftAccent(ctx, cardX, y + 8, 18, t.green)

  const rankTitle = (data.rankingStats && data.rankingStats.length) ? '📊 实时排名' : '📋 出场统计'
  safeFillText(ctx, rankTitle, padding + 10, y + 18, { fontSize: 13, color: t.text })

  ;(data.posterStats || []).slice(0, statCount).forEach((item, idx) => {
    const medalPrefix = idx < 3 ? MEDALS[idx] + ' ' : ''
    const line = item.rank
      ? medalPrefix + item.rank + '. ' + item.name + '  ' + (item.wins || 0) + '胜' + (item.losses || 0) + '负  净胜' + (item.netPoints || 0)
      : medalPrefix + (idx + 1) + '. ' + item.name + '  ' + item.games + '局  胜率' + (item.winRate || '-')
    safeFillText(ctx, line, padding + 10, y + 46 + idx * 22, { fontSize: 10, color: t.textSecondary, maxWidth: cardW - 14 })
  })

  // ========== 水印 ==========
  safeFillText(ctx, '🏸 羽毛球打转小程序', width / 2, y + statCardH + 30, { fontSize: 9, color: t.textMuted, textAlign: 'center' })

  resolve()
}

/**
 * 导出赛后复盘海报
 */
function drawResultPoster(ctx, snapshot, { width = 375, padding = 18 } = {}) {
  const t = THEME
  const cardX = padding
  const cardW = width - padding * 2

  ctx.fillStyle = t.bg
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

  let y = 12

  // ========== 头部绿色卡片（加 badge 装饰） ==========
  const headerH = 118
  roundRect(ctx, cardX, y, cardW, headerH, 14, t.green)

  // 右上角装饰圆
  ctx.beginPath()
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.arc(cardX + cardW - 24, y + 24, 30, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.arc(cardX + cardW - 16, y + 16, 16, 0, Math.PI * 2)
  ctx.fill()

  safeFillText(ctx, '🏆 ' + (snapshot.title || '') + ' 赛后复盘', padding + 4, y + 32, { fontSize: 18, color: '#ffffff' })
  safeFillText(ctx, '📍 ' + (snapshot.date || '时间待定') + ' | ' + (snapshot.venue || '场地待定'), padding + 4, y + 56, { fontSize: 11, color: '#d1e8dc', maxWidth: cardW - 8 })
  safeFillText(ctx, '✅ 完成 ' + snapshot.completedGames + '/' + snapshot.totalGames + ' 局 · ' + snapshot.playerCount + ' 人', padding + 4, y + 76, { fontSize: 11, color: '#d1e8dc' })
  safeFillText(ctx, '📅 导出 ' + (snapshot.endedAt || getFormattedTime()), padding + 4, y + 96, { fontSize: 11, color: '#d1e8dc' })

  // ========== 章节分割线 ==========
  y = headerH + 12 + 8
  drawSectionDivider(ctx, cardX + 4, cardW - 8, y, '赛后复盘')

  // ========== 复盘卡片组（彩色左侧条 + 图标） ==========
  y += 20
  cards.forEach((item, idx) => {
    const cardH = 72
    const accentColor = REVIEW_COLORS[item.title] || t.green
    roundRect(ctx, cardX, y, cardW, cardH, 10, t.cardBg)

    // 左侧彩色装饰条
    drawLeftAccent(ctx, cardX, y + 10, cardH - 20, accentColor)

    // 图标
    const icon = REVIEW_ICONS[item.title] || '📋'
    safeFillText(ctx, icon, padding + 12, y + 22, { fontSize: 16, color: t.text })
    safeFillText(ctx, item.title, padding + 36, y + 22, { fontSize: 11, color: t.textSecondary })
    safeFillText(ctx, item.value, padding + 12, y + 46, { fontSize: 12, color: t.text, maxWidth: cardW - 28 })

    y += cardH + 6
  })

  // ========== 章节分割线 ==========
  y += 2
  drawSectionDivider(ctx, cardX + 4, cardW - 8, y, '积分排名')

  // ========== 积分排名 ==========
  y += 20
  const rankH = 30 + ranking.length * 22 + 12
  roundRect(ctx, cardX, y, cardW, rankH, 10, t.cardBg)

  // 装饰条
  drawLeftAccent(ctx, cardX, y + 8, 18, t.green)

  safeFillText(ctx, '🏅 积分排名', padding + 10, y + 22, { fontSize: 14, color: t.text })

  ranking.forEach((item, idx) => {
    const ry = y + 38 + idx * 22
    const medalPrefix = idx < 3 ? MEDALS[idx] + ' ' : ''
    const rankColor = idx < 3 ? t.greenDark : t.textSecondary
    const line = medalPrefix + (idx + 1) + '. ' + item.name + '  ' + (item.wins || 0) + '胜' + (item.losses || 0) + '负  净胜' + (item.netPoints || 0)
    safeFillText(ctx, line, padding + 10, ry, { fontSize: 10, color: rankColor, maxWidth: cardW - 16 })
  })

  // ========== 水印 ==========
  safeFillText(ctx, '🏸 羽毛球打转小程序 · 赛后结果', width / 2, y + rankH + 20, { fontSize: 9, color: t.textMuted, textAlign: 'center' })

  resolve()
}

function getFormattedTime() {
  const d = new Date()
  return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0')
}

module.exports = {
  drawSchedulePoster,
  drawResultPoster,
  THEME
}
