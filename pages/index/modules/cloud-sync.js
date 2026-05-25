/**
 * cloud-sync.js — 云同步 & 数据存储
 * 职责：云函数调用、localStorage 读写、轮询、重试
 */
const { HISTORY_KEY, CACHE_KEY_PREFIX, CLOUD_ENABLED } = require('./config')

// ---------- 云函数统一调用（含重试） ----------
let cloudAvailable = false
try {
  wx.cloud
  cloudAvailable = true
} catch (e) { cloudAvailable = false }

/**
 * 调用云函数，自动 loading + 重试
 * @param {string} name 函数名
 * @param {object} data 参数
 * @param {object} opts { showLoading, loadingText, retries, onError }
 */
function callCloud(name, data, opts = {}) {
  const {
    showLoading = false,
    loadingText = '同步中',
    retries = 2,
    onError = null
  } = opts

  if (!cloudAvailable) {
    return Promise.reject(new Error('云开发未启用'))
  }

  if (showLoading) wx.showLoading({ title: loadingText, mask: true })

  const doCall = (attempt) => {
    return wx.cloud.callFunction({ name, data })
      .then(res => {
        if (showLoading) wx.hideLoading()
        return res.result
      })
      .catch(err => {
        if (attempt < retries) {
          return new Promise(resolve => setTimeout(resolve, 300 * attempt))
            .then(() => doCall(attempt + 1))
        }
        if (showLoading) wx.hideLoading()
        if (onError) onError(err)
        console.error(`[cloud] ${name} 失败 (重试${attempt}次):`, err)
        throw err
      })
  }

  return doCall(0)
}

// ---------- 本地存储封装 ----------

function getCache(key) {
  try { return wx.getStorageSync(key) || null }
  catch (e) { return null }
}

function setCache(key, data) {
  try { wx.setStorageSync(key, data); return true }
  catch (e) { return false }
}

function removeCache(key) {
  try { wx.removeStorageSync(key); return true }
  catch (e) { return false }
}

function getHistory() {
  return getCache(HISTORY_KEY) || []
}

function saveActivityLocal(activityId, data) {
  return setCache(CACHE_KEY_PREFIX + activityId, data)
}

function loadActivityLocal(activityId) {
  return getCache(CACHE_KEY_PREFIX + activityId)
}

function deleteActivityLocal(activityId) {
  removeCache(CACHE_KEY_PREFIX + activityId)
  const history = getHistory().filter(h => h.id !== activityId)
  setCache(HISTORY_KEY, history)
}

// ---------- 历史记录 ----------

function addToHistory(activity) {
  const history = getHistory()
  const idx = history.findIndex(h => h.id === activity.id)
  const entry = {
    id: activity.id,
    title: activity.title,
    date: activity.date,
    venue: activity.venue,
    playerCount: (activity.participants || []).length,
    gameCount: (activity.schedule || []).length,
    courtCount: activity.courtCount,
    status: activity.activityStatus || 'pending',
    updatedAt: new Date().toISOString()
  }
  if (idx >= 0) history[idx] = entry
  else history.unshift(entry)
  setCache(HISTORY_KEY, history.slice(0, 50))
  return history
}

function removeFromHistory(activityId) {
  const history = getHistory().filter(h => h.id !== activityId)
  setCache(HISTORY_KEY, history)
  return history
}

// ---------- 轮询 ----------
let pollingTimer = null

function startPolling(fn, interval = 15000) {
  stopPolling()
  pollingTimer = setInterval(() => {
    fn && fn()
  }, interval)
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

// ---------- 导出 ----------
module.exports = {
  cloudAvailable,
  callCloud,
  getCache,
  setCache,
  removeCache,
  getHistory,
  saveActivityLocal,
  loadActivityLocal,
  deleteActivityLocal,
  addToHistory,
  removeFromHistory,
  startPolling,
  stopPolling
}
