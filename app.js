App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d3gt5f02n0ddacfb3',
        traceUser: true
      })
    }
  },

  globalData: {
    envId: 'cloud1-d3gt5f02n0ddacfb3'
  }
})
