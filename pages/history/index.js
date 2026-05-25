/**
 * pages/history/index.js — 历史记录分包页面
 * 跳转到 SPA 主页并显示历史列表
 */
Page({
  onLoad() {
    wx.redirectTo({
      url: '/pages/index/index?tab=history'
    })
  }
})
