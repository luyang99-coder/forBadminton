/**
 * canvas-export.js — Canvas 海报导出（修复版）
 * 职责：轮转安排图、赛后复盘图、二维码海报
 * 依赖：stats-util.js（getTeamMembers）
 * 
 * 修复：文字自动换行改用 ctx.measureText 精确测量，
 * 确保所有机型的 Canvas 2D API 下文字不重叠、不溢出
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

/**
 * 使用 Canvas measureText 精确换行
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} text 
 * @param {number} maxWidth px
 * @param {number} [fontSize] 字体大小（用于设置 ctx.font）
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth, fontSize) {
  const str = String(text || '')
  if (!str.length) return ['']
  
  // 确保设置了字体（canvas-export 默认字体设计基于 11px）
  const fs = fontSize || 11
  ctx.setFontSize(fs)
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
  
  ctx.setFontSize(fontSize)
  ctx.font = `normal ${fontSize}px sans-serif`
  ctx.setFillStyle(color)
  ctx.setTextAlign(textAlign)
  
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

// ============ 公开 API ============

/**
 * 导出轮转安排海报
 * @param {CanvasRenderingContext2D} ctx 
 * @param {object} data 海报数据
 * @param {object} opts { width, padding }
 */
function drawSchedulePoster(ctx, data, { width = 375, padding = 18 } = {}) {
  const cardX = padding
  const cardW = width - padding * 2

  // ---- 底色 ----
  ctx.setFillStyle(THEME.bg)
  ctx.fillRect(0, 0, width, 10000)

  return new Promise((resolve) => {
    finishDraw(ctx, width, padding, cardX, cardW, data, resolve)
  })
}

function finishDraw(ctx, width, padding, cardX, cardW, data, resolve) {
  const t = THEME
  let y = 12

  // ========== 头部卡片 ==========
  roundRect(ctx, cardX, y, cardW, 140, 12, t.cardBg)
  safeFillText(ctx, data.title || '', padding + 2, y + 24, { fontSize: 16, color: t.text })
  safeFillText(ctx, data.subtitle || '', padding + 2, y + 44, { fontSize: 10, color: t.textSecondary })
  safeFillText(ctx, `导出 ${data.generatedAt || getFormattedTime()}`, padding + 2, y + 62, { fontSize: 10, color: t.textSecondary })

  // ========== 概览标签 ==========
  const summaryY = y + 84
  const gap4 = 8
  const sw4 = (cardW - 12 - gap4 * 3) / 4
  const summary = data.summary || []
  summary.forEach((item, idx) => {
    const x = cardX + 6 + idx * (sw4 + gap4)
    roundRect(ctx, x, summaryY, sw4, 42, 7, t.tagBg)
    safeFillText(ctx, item.t || '', x + sw4 / 2, summaryY + 16, { fontSize: 9, color: t.textMuted, textAlign: 'center' })
    safeFillText(ctx, String(item.n || ''), x + sw4 / 2, summaryY + 34, { fontSize: 12, color: t.text, textAlign: 'center' })
  })

  // ========== 轮转安排 ==========
  y = 172
  safeFillText(ctx, '轮转安排', padding, y + 4, { fontSize: 13, color: t.text })
  y += 16

  data.schedule.forEach((game) => {
    const gh = 76
    roundRect(ctx, cardX, y, cardW, gh, 8, t.cardBg)

    // 第一行：轮次 + 比分
    safeFillText(ctx, `第${game.round}轮 | ${game.court}号场`, padding + 2, y + 14, { fontSize: 10, color: t.textSecondary })
    if (game.result) {
      safeFillText(ctx, `${game.result.scoreA}:${game.result.scoreB}`, width - padding - 2, y + 14, {
        fontSize: 11, color: t.greenDark, textAlign: 'right'
      })
    }

    // 队伍A + VS + 队伍B
    const halfW = Math.floor((cardW - 48) / 2)
    const linesA = safeFillText(ctx, game.teamAText || '', padding + 2, y + 34, { fontSize: 11, color: t.text, maxWidth: halfW })
    safeFillText(ctx, 'VS', cardX + cardW / 2, y + 34 + Math.max(0, linesA - 1) * 15, { fontSize: 11, color: t.textMuted, textAlign: 'center' })
    const linesB = safeFillText(ctx, game.teamBText || '', padding + 2 + halfW + 24, y + 34, { fontSize: 11, color: t.text, maxWidth: halfW })
    
    // 休息信息
    const maxLines = Math.max(linesA, linesB, 1)
    safeFillText(ctx, `休息：${game.restText || ''}`, padding + 2, y + 34 + maxLines * 15 + 8, { fontSize: 9, color: t.textMuted })

    y += gh + 4
  })

  // ========== 排名/统计 ==========
  y += 4
  const statCount = Math.min(6, (data.posterStats || []).length)
  const statCardH = 28 + statCount * 22 + 16
  roundRect(ctx, cardX, y, cardW, statCardH, 8, t.cardBg)
  
  safeFillText(ctx, data.rankingStats && data.rankingStats.length ? '实时排名' : '出场统计', padding, y + 18, { fontSize: 13, color: t.text })

  ;(data.posterStats || []).slice(0, statCount).forEach((item, idx) => {
    const line = item.rank
      ? `${item.rank}. ${item.name}  ${item.wins || 0}胜${item.losses || 0}负  净胜${item.netPoints || 0}`
      : `${idx + 1}. ${item.name}  ${item.games}局  胜率${item.winRate || '-'}`
    safeFillText(ctx, line, padding, y + 46 + idx * 22, { fontSize: 10, color: t.textSecondary, maxWidth: cardW - 8 })
  })

  // ========== 水印 ==========
  safeFillText(ctx, '羽毛球打转小程序', width / 2, y + statCardH + 30, { fontSize: 9, color: t.textMuted, textAlign: 'center' })

  resolve()
}

/**
 * 导出赛后复盘海报
 * @param {CanvasRenderingContext2D} ctx 
 * @param {object} snapshot 赛后数据
 * @param {object} opts { width, padding }
 */
function drawResultPoster(ctx, snapshot, { width = 375, padding = 18 } = {}) {
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

  let y = 12

  // ========== 头部绿色卡片 ==========
  roundRect(ctx, cardX, y, cardW, 118, 14, t.green)
  safeFillText(ctx, `${snapshot.title || ''} 赛后复盘`, padding + 4, y + 32, { fontSize: 18, color: '#ffffff' })
  safeFillText(ctx, `${snapshot.date || '时间待定'} | ${snapshot.venue || '场地待定'}`, padding + 4, y + 56, { fontSize: 11, color: '#d1e8dc', maxWidth: cardW - 8 })
  safeFillText(ctx, `完成 ${snapshot.completedGames}/${snapshot.totalGames} 局 · ${snapshot.playerCount} 人`, padding + 4, y + 76, { fontSize: 11, color: '#d1e8dc' })
  safeFillText(ctx, `导出 ${snapshot.endedAt || getFormattedTime()}`, padding + 4, y + 96, { fontSize: 11, color: '#d1e8dc' })

  // ========== 复盘卡片组 ==========
  y = 148
  cards.forEach((item) => {
    roundRect(ctx, cardX, y, cardW, 72, 10, t.cardBg)
    safeFillText(ctx, item.title, padding + 4, y + 22, { fontSize: 11, color: t.textSecondary })
    safeFillText(ctx, item.value, padding + 4, y + 44, { fontSize: 12, color: t.text, maxWidth: cardW - 20 })
    y += 78
  })

  // ========== 积分排名 ==========
  y += 4
  const rankH = 30 + ranking.length * 22 + 12
  roundRect(ctx, cardX, y, cardW, rankH, 10, t.cardBg)
  safeFillText(ctx, '积分排名', padding + 4, y + 22, { fontSize: 14, color: t.text })

  ranking.forEach((item, idx) => {
    const ry = y + 38 + idx * 22
    const color = idx < 3 ? t.greenDark : t.textSecondary
    const line = `${idx + 1}. ${item.name}  ${item.wins || 0}胜${item.losses || 0}负  净胜${item.netPoints || 0}`
    safeFillText(ctx, line, padding + 4, ry, { fontSize: 10, color, maxWidth: cardW - 12 })
  })

  // ========== 水印 ==========
  safeFillText(ctx, '羽毛球打转小程序 · 赛后结果', width / 2, y + rankH + 20, { fontSize: 9, color: t.textMuted, textAlign: 'center' })

  resolve()
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
