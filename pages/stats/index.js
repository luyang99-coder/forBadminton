/**
 * pages/stats/index.js — 统计分包页面
 * 通过查询参数 ?activityId=xxx 跳转到 SPA 主页的统计 tab
 */
Page({
  data: {
    loading: true
  },

  onLoad(options) {
    const activityId = options.activityId || ''
    if (activityId) {
      // 跳转到主包页面并切换到统计 tab
      wx.redirectTo({
        url: `/pages/index/index?activityId=${activityId}&tab=stats`
      })
    } else {
      // 无 activityId 则返回首页
      wx.switchTab({
        url: '/pages/index/index'
      })
    }
  }
})
