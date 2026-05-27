/**
 * pages/stats/index.js — 统计分包页面
 * 通过查询参数 ?activityId=xxx 跳转到 SPA 主页的统计 tab
 * 无 activityId 时展示全局数据看板（趋势图 + 搭档网络）
 */
const HISTORY_KEY = 'badminton_activity_history'

Page({
  data: {
    loading: true,
    trendData: [],
    partnerNodes: [],
    partnerEdges: [],
    canvasWidth: 0
  },

  onLoad(options) {
    const activityId = options.activityId || ''
    if (activityId) {
      // 跳转到主包页面并切换到统计 tab
      wx.redirectTo({
        url: `/pages/index/index?activityId=${activityId}&tab=stats`
      })
      return
    }
    // 无 activityId：显示全局数据看板
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      loading: false,
      canvasWidth: sysInfo.windowWidth - 32
    })
    this.computeTrends()
    this.computePartnerNetwork()
  },

  onReady() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({ canvasWidth: sysInfo.windowWidth - 32 })
  },

  computeTrends() {
    try {
      const history = wx.getStorageSync(HISTORY_KEY) || []
      const trendData = history.slice(-10).map((act) => {
        const games = act.games || act.completedSchedule || []
        let wins = 0, total = 0
        games.forEach(g => {
          if (g.myTeam === 'A' && g.scoreA > g.scoreB) wins++
          if (g.myTeam === 'B' && g.scoreB > g.scoreA) wins++
          if (g.myTeam) total++
        })
        return {
          label: (act.date || '').slice(5),
          winRate: total ? Math.round(wins / total * 100) : 0,
          games: total
        }
      })
      this.setData({ trendData })
      setTimeout(() => {
        if (trendData.length) this.drawTrendChart()
      }, 500)
    } catch (e) {
      console.error('computeTrends error', e)
    }
  },

  computePartnerNetwork() {
    try {
      const history = wx.getStorageSync(HISTORY_KEY) || []
      const partnerMap = {}
      history.forEach(act => {
        const games = act.games || act.completedSchedule || []
        games.forEach(g => {
          if (!g.pairA || !g.pairB) return
          const aNames = g.pairA.split('+')
          const bNames = g.pairB.split('+')
          const allPairs = [aNames, bNames]
          allPairs.forEach(pair => {
            if (pair.length < 2) return
            const key = [pair[0], pair[1]].sort().join('|')
            partnerMap[key] = (partnerMap[key] || 0) + 1
          })
        })
      })
      const entries = Object.entries(partnerMap).sort((a, b) => b[1] - a[1]).slice(0, 15)
      if (!entries.length) return
      const nameSet = new Set()
      entries.forEach(([key]) => {
        key.split('|').forEach(n => nameSet.add(n))
      })
      const nodeList = Array.from(nameSet)
      const cx = this.data.canvasWidth / 2 || 180
      const cy = 150
      const radius = Math.min(cx, cy) - 30
      const nodes = nodeList.map((name, i) => {
        const angle = (i / nodeList.length) * Math.PI * 2 - Math.PI / 2
        return {
          id: name,
          name: name,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          size: 16,
          color: '#16744F'
        }
      })
      const edges = entries.map(([key, count]) => {
        const [a, b] = key.split('|')
        return { from: a, to: b, weight: count }
      })
      this.setData({ partnerNodes: nodes, partnerEdges: edges })
      setTimeout(() => {
        if (nodes.length) this.drawPartnerNetworkChart()
      }, 500)
    } catch (e) {
      console.error('computePartnerNetwork error', e)
    }
  },

  drawTrendChart() {
    const query = wx.createSelectorQuery()
    query.select('#trendCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      canvas.width = res[0].width * dpr
      canvas.height = 220 * dpr
      ctx.scale(dpr, dpr)
      const { drawLineChart } = require('./modules/chart-utils')
      const winRates = this.data.trendData.map(d => d.winRate)
      const labels = this.data.trendData.map(d => d.label)
      drawLineChart(ctx, {
        width: res[0].width,
        height: 220,
        data: winRates,
        labels: labels,
        lineColor: '#16744F',
        dotColor: '#16744F'
      })
    })
  },

  drawPartnerNetworkChart() {
    const query = wx.createSelectorQuery()
    query.select('#partnerCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      canvas.width = res[0].width * dpr
      canvas.height = 300 * dpr
      ctx.scale(dpr, dpr)
      const { drawPartnerNetwork } = require('./modules/chart-utils')
      drawPartnerNetwork(ctx, {
        width: res[0].width,
        height: 300,
        nodes: this.data.partnerNodes,
        edges: this.data.partnerEdges
      })
    })
  }
})
