/**
 * pages/launch/index.js — 创建活动入口页
 * 跳转到主页面进行活动创建
 */
Page({
  onLoad() {
    wx.redirectTo({
      url: '/pages/index/index?tab=launch'
    })
  }
})
