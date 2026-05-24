function getPixelRatio() {
  if (wx.getWindowInfo) {
    const windowInfo = wx.getWindowInfo()
    return Number(windowInfo.pixelRatio) || 3
  }
  const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
  return Number(systemInfo.pixelRatio) || 3
}

module.exports = {
  getPixelRatio
}
