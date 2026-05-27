// pages/stats/modules/chart-utils.js
// Canvas 2D 图表绘制工具

function drawLineChart(ctx, config) {
  const { width, height, data, labels, padding = 40, lineColor = '#16744F', dotColor = '#16744F' } = config
  const W = width - padding * 2
  const H = height - padding * 2
  if (!data.length) return
  const maxVal = Math.max(...data, 1)
  const minVal = Math.min(0, ...data)

  ctx.beginPath()
  ctx.strokeStyle = '#ddd'
  ctx.lineWidth = 1
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, height - padding)
  ctx.lineTo(width - padding, height - padding)
  ctx.stroke()

  ctx.beginPath()
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  const points = data.map((v, i) => ({
    x: padding + (i / Math.max(data.length - 1, 1)) * W,
    y: height - padding - ((v - minVal) / Math.max(maxVal - minVal, 1)) * H
  }))
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.stroke()

  points.forEach(p => {
    ctx.beginPath()
    ctx.fillStyle = dotColor
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
    ctx.fill()
  })
  return { points }
}

function drawRadar(ctx, config) {
  const { width, height, data, labels, maxVal = 100, color = 'rgba(22,116,79,0.3)', strokeColor = '#16744F' } = config
  const cx = width / 2, cy = height / 2
  const radius = Math.min(cx, cy) - 40
  const sides = data.length
  const angleStep = (Math.PI * 2) / sides

  for (let r = 1; r <= 4; r++) {
    ctx.beginPath()
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 0.5
    for (let i = 0; i < sides; i++) {
      const a = angleStep * i - Math.PI / 2
      const x = cx + Math.cos(a) * radius * (r / 4)
      const y = cy + Math.sin(a) * radius * (r / 4)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  }

  for (let i = 0; i < sides; i++) {
    ctx.beginPath()
    ctx.strokeStyle = '#e0e0e0'
    ctx.moveTo(cx, cy)
    const a = angleStep * i - Math.PI / 2
    ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius)
    ctx.stroke()
    ctx.fillStyle = '#666'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(labels[i], cx + Math.cos(a) * (radius + 18), cy + Math.sin(a) * (radius + 18) + 4)
  }

  ctx.beginPath()
  ctx.fillStyle = color
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 2
  for (let i = 0; i < sides; i++) {
    const a = angleStep * i - Math.PI / 2
    const r = radius * Math.min(data[i] / maxVal, 1)
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawPartnerNetwork(ctx, config) {
  const { width, height, nodes, edges } = config
  ctx.clearRect(0, 0, width, height)

  edges.forEach(e => {
    const from = nodes.find(n => n.id === e.from)
    const to = nodes.find(n => n.id === e.to)
    if (!from || !to) return
    ctx.beginPath()
    ctx.strokeStyle = `rgba(22,116,79,${Math.min(e.weight / 20, 0.8)})`
    ctx.lineWidth = Math.max(e.weight / 5, 0.5)
    ctx.moveTo(from.x || 0, from.y || 0)
    ctx.lineTo(to.x || 0, to.y || 0)
    ctx.stroke()
  })

  nodes.forEach(n => {
    ctx.beginPath()
    ctx.fillStyle = n.color || '#16744F'
    ctx.arc(n.x || 0, n.y || 0, n.size || 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `${Math.max((n.size || 12) * 0.5, 8)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(n.name || '', n.x || 0, n.y || 0)
  })
}

module.exports = { drawLineChart, drawRadar, drawPartnerNetwork }
