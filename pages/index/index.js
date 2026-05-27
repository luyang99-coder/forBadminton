const {
  PRESETS,
  DEFAULT_HOURS,
  DEFAULT_GAME_MINUTES,
  MAX_PLAYERS,
  LEVEL_OPTIONS,
  HISTORY_KEY,
  ACTIVITIES_KEY,
  USER_KEY,
  CLOUD_FUNCTION,
  nowId,
  playerId
} = require('./modules/config')
const { makeQrMatrix } = require('./modules/qr')
const {
  isDefaultPlayerName,
  isRealPlayer,
  rotationLimitFromActivity,
  autoPromoteBench
} = require('./modules/roster')
const {
  makePlayers,
  makePlayerWithName,
  nextDefaultPlayerName,
  normalizeLevel,
  levelIndex,
  levelLabel,
  uniqueNames,
  genderText,
  statusText,
  signupMeta,
  defaultActivityStartText,
  shortName
} = require('./modules/player')
const {
  pairKey,
  generateSchedule,
  buildStateFromGames
} = require('./modules/schedule')
const { getPixelRatio } = require('./modules/system')
const { requestSubscribe, sendSubscribeMessage, NOTIFY_TMPL_IDS } = require('./modules/notify')
Page({
  data: {
    mainTab: 'home',
    recentActivities: [],
    activeActivities: [],
    endedActivities: [],
    homeActivitiesRaw: [],
    homeKeyword: '',
    homeSectionLimit: {
      active: 6,
      ended: 6
    },
    cloudActivityPage: 0,
    cloudActivitySize: 40,
    cloudActivityHasMore: false,
    activeHasMore: false,
    endedHasMore: false,
    myActivities: [],
    profileTrend: [],
    profileAvatarText: 'Guest',
    profileTitle: 'My badminton profile',
    profileStats: {
      matches: 0,
      games: 0,
      wins: 0,
      losses: 0,
      winRate: '0%',
      netPoints: 0,
      judgedGames: 0
    },
    profileRecords: [],
    presets: PRESETS,
    tabs: [
      { key: 'signup', label: '报名' },
      { key: 'games', label: '轮转' },
      { key: 'scored', label: '已计分' },
      { key: 'stats', label: '统计' }
    ],
    activeTab: 'signup',
    advancedOpen: false,
    constraintsOpen: false,
    adminOpen: false,
    selectedPreset: 6,
    presetCount: 6,
    role: 'admin',
    roleText: '管理员',
    activityId: '',
    activityTitle: '',
    activityDate: defaultActivityStartText(),
    activityVenue: '',
    activityStatus: 'signup',
    activityStatusText: '报名中',
    registrationOpen: true,
    rosterLocked: false,
    signupMode: 'single',
    batchImportOpen: false,
    batchText: '队员1\n队员2\n队员3\n队员4\n队员5\n队员6',
    singleName: '',
    singleGender: 'male',
    singleLevel: 3,
    singleLevelDraft: '',
    levelOptions: LEVEL_OPTIONS,
    levelDrafts: {},
    playerNameDrafts: {},
    participants: makePlayers(6),
    rosterParticipants: [],
    rosterPresentCount: 0,
    rosterBenchCount: 0,
    rosterLateCount: 0,
    rosterTotalCount: 0,
    rosterEditorOpen: false,
    rosterEditorId: '',
    rosterEditorTitle: '',
    rosterEditorName: '',
    rosterEditorGender: 'male',
    rosterEditorLevel: 3,
    rosterEditorSourceText: '',
    rosterEditorIsOpenSlot: false,
    rosterEditorCanEdit: false,
    rosterEditorCanBindWechat: false,
    rosterEditorCanRemove: false,
    signupButtonText: '报名',
    signupHint: '',
    signupModeText: '到场',
    signupActionText: '报名',
    signupHelpText: '',
    playerOptions: [],
    playerOpenidOptions: [],
    claimPlayerOptions: [],
    claimPlayerIndex: 0,
    claimPlayerLabel: '',
    adminPlayerIndex: 0,
    adminPlayerLabel: '',
    pairAIndex: 0,
    pairBIndex: 1,
    pairALabel: '队员1',
    pairBLabel: '队员2',
    fixedPairs: [],
    avoidPairs: [],
    restLowLevel: true,
    newcomerFirstRest: false,
    manualRests: [],
    restRound: 1,
    restPlayerIndex: 0,
    restPlayerLabel: '队员1',
    weightFairness: 5,
    weightRepeat: 5,
    weightSkill: 5,
    activityHours: DEFAULT_HOURS,
    gameMinutes: DEFAULT_GAME_MINUTES,
    courtCount: 1,
    recommendedGames: 12,
    recommendedPlayerGames: 4,
    perPlayerGameCount: 4,
    displayGameCount: 12,
    gameCount: 12,
    useRecommended: true,
    preferMixed: false,
    balanceSkill: true,
    avoidWomenDoubles: false,
    handicapMdXd: 3,
    handicapMdWd: 6,
    handicapXdWd: 3,
    schedule: [],
    openSchedule: [],
    completedSchedule: [],
    stats: [],
    rankingStats: [],
    repeatedPartners: [],
    scheduleQuality: null,
    progressData: {
      doneNum: 0,
      totalNum: 0,
      progress: 0
    },
    history: [],
    errorText: '',
    generatedAt: '',
    shareText: '',
    fees: { items: [], payments: {}, splitMode: 'equal', totalAmount: 0, currency: '¥' },
    posterPath: '',
    darkMode: '',
    theme: 'light',
    radarStats: [],
    weeklyStats: null,
    userKey: '',
    localOwnerKey: '',
    openid: '',
    isOwner: false,
    cloudReady: false,
    cloudErrorText: '',
    syncing: false,
    lastSyncedAt: '',
    syncText: '刚刚',
    qrCodeFileID: '',
    qrLocalPath: '',
    qrPosterPath: '',
    adminOpenids: [],
    isAdmin: false,
    myGames: [],
    myGameSummary: '',
    focusedPlayerId: '',
    focusedPlayerName: '',
    expandedRosterId: '',
    review: {
      bestPartner: '-',
      bestWinRate: '-',
      mostBalancedGame: '-',
      repeatRisk: '-'
    },
    resultSnapshot: null
  },

  onLoad(options) {
    const userKey = this.getLocalUserKey()
    this.data.userKey = userKey
    const savedTheme = wx.getStorageSync('darkMode') || 'light'
    this.setData({ userKey, theme: savedTheme, darkMode: savedTheme === 'dark' ? 'dark' : '' })
    this.loadHistory()
    if (options && options.scene) {
      const scene = decodeURIComponent(options.scene)
      scene.split('&').forEach((part) => {
        const pair = part.split('=')
        if (pair[0] === 'activityId') options.activityId = pair[1]
      })
      options.role = 'player'
    }
    // 从分包跳转时的参数
    var initialTab = (options && options.tab) || ''
    this.initCloudSession(() => {
      if (options && options.activityId) {
        this.setData({ mainTab: 'launch' })
        this.loadActivity(options.activityId, options.role === 'admin' ? 'admin' : 'player', initialTab)
      } else {
        this.refreshPlayerOptions()
        if (initialTab === 'history') {
          this.setData({ activeTab: 'history' })
        }
      }
      this.refreshRecommended()
      this.refreshHomeData()
      this.startCloudPolling()
    })
  },

  onShow() {
    if (this.data.activityId && this.data.cloudReady) {
      this.refreshCloudActivity(true)
      this.startCloudPolling()
    } else if (this.data.cloudReady && this.data.mainTab === 'home') {
      this.fetchCloudActivities()
    }
  },

  onHide() {
    this.stopCloudPolling()
  },

  onUnload() {
    this.stopCloudPolling()
    if (this.homeQueryTimer) clearTimeout(this.homeQueryTimer)
  },

  getLocalUserKey() {
    let userKey = wx.getStorageSync(USER_KEY)
    if (!userKey) {
      userKey = nowId('u')
      wx.setStorageSync(USER_KEY, userKey)
    }
    return userKey
  },

  onShareAppMessage() {
    const activityId = this.data.activityId || this.createActivity()
    return {
      title: `${this.data.activityTitle} 报名`,
      path: `/pages/index/index?activityId=${activityId}&role=player`
    }
  },

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab === 'review' ? 'stats' : event.currentTarget.dataset.tab
    const extra = tab === 'games' ? {} : { focusedPlayerId: '', focusedPlayerName: '' }
    this.setData(Object.assign({ activeTab: tab }, extra), () => this.refreshGameBuckets())
  },

  switchMainTab(event) {
    const tab = event.currentTarget.dataset.tab
    if (tab === 'launch') {
      this.setData({ mainTab: 'launch' })
      return
    }
    this.setData({ mainTab: tab }, () => this.refreshHomeData())
  },

  toggleDarkMode() {
    const theme = this.data.theme === 'dark' ? 'light' : 'dark'
    this.setData({ theme, darkMode: theme === 'dark' ? 'dark' : '' }, () => {
      wx.setStorageSync('darkMode', theme)
    })
  },

  onHomeKeywordInput(event) {
    this.setData({ homeKeyword: event.detail.value || '' }, () => this.triggerHomeQuery())
  },

  loadMoreHomeSection(event) {
    const section = event.currentTarget.dataset.section
    if (!section) return
    const limits = Object.assign({}, this.data.homeSectionLimit)
    limits[section] = (limits[section] || 6) + 6
    this.setData({ homeSectionLimit: limits }, () => this.applyHomeFilters())
  },

  loadMoreCloudActivities() {
    if (!this.data.cloudReady || !this.data.cloudActivityHasMore || this.data.syncing) return
    this.fetchCloudActivities(false)
  },

  triggerHomeQuery() {
    if (this.homeQueryTimer) clearTimeout(this.homeQueryTimer)
    this.homeQueryTimer = setTimeout(() => this.runHomeQuery(), 300)
  },

  runHomeQuery() {
    if (this.data.cloudReady) {
      this.fetchCloudActivities(true)
      return
    }
    this.applyHomeFilters()
  },

  /** 重新开启已结束活动：复制到新活动 */
  reactivateActivity(event) {
    const activityId = event.currentTarget.dataset.id
    if (!activityId) return
    const activities = wx.getStorageSync(ACTIVITIES_KEY) || {}
    const activity = activities[activityId]
    if (!activity) {
      showError('操作失败')
      return
    }
    const newId = nowId('a')
    const newActivity = Object.assign({}, activity, {
      activityId: newId,
      activityTitle: `${activity.activityTitle || '羽毛球活动'} (续)`,
      activityStatus: 'signup',
      activityStatusText: '报名中',
      registrationOpen: true,
      rosterLocked: false,
      schedule: [],
      stats: [],
      rankingStats: [],
      repeatedPartners: [],
      scheduleQuality: null,
      review: {
        bestPartner: '-',
        bestWinRate: '-',
        mostBalancedGame: '-',
        repeatRisk: '-'
      },
      resultSnapshot: null,
      generatedAt: '',
      shareText: '',
      qrCodeFileID: '',
      qrLocalPath: '',
      posterPath: '',
      progressData: { doneNum: 0, totalNum: 0, progress: 0 },
      errorText: '',
      fees: { items: [], payments: {}, splitMode: 'equal', totalAmount: 0, currency: '¥' },
      localOwnerKey: this.data.userKey,
      ownerOpenid: this.data.openid || '',
      adminOpenids: [],
      syncing: false,
      lastSyncedAt: '',
      syncText: '刚刚'
    })
    delete newActivity.deleted
    delete newActivity.updatedAt
    activities[newId] = newActivity
    wx.setStorageSync(ACTIVITIES_KEY, activities)
    this.setData({ mainTab: 'launch' }, () => {
      this.loadActivity(newId, 'admin')
    })
    wx.showToast({ title: '已复制为新活动', icon: 'success' })
  },

  startNewActivity() {
    const participants = makePlayers(6)
    this.setData({
      mainTab: 'launch',
      activeTab: 'signup',
      activityId: nowId('a'),
      role: 'admin',
      isOwner: true,
      isAdmin: true,
      localOwnerKey: this.data.userKey,
      activityTitle: '',
      activityDate: defaultActivityStartText(),
      activityVenue: '',
      activityStatus: 'signup',
      activityStatusText: '报名中',
      registrationOpen: true,
      rosterLocked: false,
      selectedPreset: 6,
      presetCount: 6,
      signupMode: 'single',
      batchImportOpen: false,
      batchText: participants.map((player) => player.name).join('\n'),
      singleGender: 'male',
      singleLevel: 3,
      singleLevelDraft: '',
      levelDrafts: {},
      playerNameDrafts: {},
      rosterTotalCount: 0,
      participants,
      fixedPairs: [],
      avoidPairs: [],
      manualRests: [],
      pairAIndex: 0,
      pairBIndex: 1,
      pairALabel: '队员1',
      pairBLabel: '队员2',
      restRound: 1,
      restPlayerIndex: 0,
      restPlayerLabel: '队员1',
      preferMixed: false,
      balanceSkill: true,
      avoidWomenDoubles: false,
      handicapMdXd: 3,
      handicapMdWd: 6,
      handicapXdWd: 3,
      schedule: [],
      openSchedule: [],
      completedSchedule: [],
      stats: [],
      rankingStats: [],
      repeatedPartners: [],
      scheduleQuality: null,
      progressData: { doneNum: 0, totalNum: 0, progress: 0 },
      generatedAt: '',
      shareText: '',
      fees: { items: [], payments: {}, splitMode: 'equal', totalAmount: 0, currency: '¥' },
      review: {
        bestPartner: '-',
        bestWinRate: '-',
        mostBalancedGame: '-',
        repeatRisk: '-'
      },
      resultSnapshot: null,
      errorText: ''
    }, () => {
      this.refreshPlayerOptions()
      this.refreshRecommended()
      this.persistActivity(true)
    })
  },

  openCurrentActivity() {
    if (!this.data.activityId) {
      this.startNewActivity()
      return
    }
    this.setData({ mainTab: 'launch', activeTab: this.data.schedule.length ? 'games' : 'signup' })
  },

  openActivityCard(event) {
    const activityId = event.currentTarget.dataset.id
    if (!activityId) return
    const card = (this.data.recentActivities || []).concat(this.data.activeActivities || [], this.data.endedActivities || [])
      .find((item) => item.id === activityId)
    const role = card && (card.isOwner || card.isAdmin) ? 'admin' : 'player'
    this.setData({ mainTab: 'launch' })
    this.loadActivity(activityId, role)
  },

  viewActivityResult(event) {
    const activityId = event.currentTarget.dataset.id
    if (!activityId) return
    const card = (this.data.recentActivities || []).concat(this.data.activeActivities || [], this.data.endedActivities || [])
      .find((item) => item.id === activityId)
    const role = card && (card.isOwner || card.isAdmin) ? 'admin' : 'player'
    this.setData({ mainTab: 'launch', activeTab: 'stats' })
    this.loadActivity(activityId, role)
  },

  deleteActivityCard(event) {
    const activityId = event.currentTarget.dataset.id
    if (!activityId) return
    const activities = wx.getStorageSync(ACTIVITIES_KEY) || {}
    const activity = activities[activityId]
    const card = (this.data.recentActivities || []).find((item) => item.id === activityId) || {}
    const title = (activity && activity.activityTitle) || card.title || '羽毛球活动'
    wx.showModal({
      title: '删除活动',
      content: `确定永久删除「${title}」吗？删除后无法恢复。`,
      confirmText: '删除',
      success: (res) => {
        if (!res.confirm) return
        if (this.data.cloudReady) {
          this.setData({ syncing: true })
          this.callCloud('deleteActivity', { activityId }).then((cloudRes) => {
            this.setData({ syncing: false })
            if (!cloudRes.ok) {
              this.showError(cloudRes.message || '')
              return
            }
            this.deleteActivityLocal(activityId, true)
            this.fetchCloudActivities()
          }).catch(() => {
            this.setData({ syncing: false })
            showError('同步失败，请重试')
          })
          return
        }
        this.deleteActivityLocal(activityId, true)
      }
    })
  },

  deleteActivityLocal(activityId, removeHistory) {
    const activities = wx.getStorageSync(ACTIVITIES_KEY) || {}
    delete activities[activityId]
    wx.setStorageSync(ACTIVITIES_KEY, activities)
    const currentHistory = wx.getStorageSync(HISTORY_KEY) || []
    const history = removeHistory ? currentHistory.filter((item) => item.activityId !== activityId) : currentHistory
    wx.setStorageSync(HISTORY_KEY, history)
    const resetCurrent = activityId === this.data.activityId
    const resetState = resetCurrent ? this.getEmptyActivityState() : {}
    this.setData(Object.assign({
      history,
      recentActivities: (this.data.recentActivities || []).filter((item) => item.id !== activityId),
      profileStats: this.buildProfileStats(),
      profileRecords: this.buildProfileRecords(),
      errorText: ''
    }, resetState), () => {
      wx.showToast({ title: '', icon: 'success' })
    })
  },

  canDeleteActivity(activity) {
    const schedule = activity.schedule || []
    const hasResult = schedule.some((game) => game.completed || game.result)
    return !hasResult && activity.activityStatus !== 'running' && activity.activityStatus !== 'ended'
  },

  getEmptyActivityState() {
    const participants = makePlayers(6)
    return {
      mainTab: 'home',
      activeTab: 'signup',
      activityId: '',
      role: 'admin',
      isOwner: false,
      isAdmin: false,
      localOwnerKey: '',
      activityTitle: '',
      activityDate: defaultActivityStartText(),
      activityVenue: '',
      activityStatus: 'signup',
      activityStatusText: '报名中',
      registrationOpen: true,
      rosterLocked: false,
      selectedPreset: 6,
      presetCount: 6,
      signupMode: 'single',
      batchImportOpen: false,
      batchText: participants.map((player) => player.name).join('\n'),
      singleGender: 'male',
      singleLevel: 3,
      singleLevelDraft: '',
      levelDrafts: {},
      playerNameDrafts: {},
      participants,
      fixedPairs: [],
      avoidPairs: [],
      preferMixed: false,
      balanceSkill: true,
      avoidWomenDoubles: false,
      handicapMdXd: 3,
      handicapMdWd: 6,
      handicapXdWd: 3,
      manualRests: [],
      schedule: [],
      openSchedule: [],
      completedSchedule: [],
      stats: [],
      rankingStats: [],
      repeatedPartners: [],
      scheduleQuality: null,
      progressData: { doneNum: 0, totalNum: 0, progress: 0 },
      generatedAt: '',
      shareText: '',
      qrCodeFileID: '',
      qrLocalPath: '',
      myGames: [],
      myGameSummary: '',
      focusedPlayerId: '',
      focusedPlayerName: '',
      expandedRosterId: '',
      review: {
        bestPartner: '-',
        bestWinRate: '-',
        mostBalancedGame: '-',
        repeatRisk: '-'
      }
    }
  },

  toggleAdvanced() {
    this.setData({ advancedOpen: !this.data.advancedOpen })
  },

  toggleConstraints() {
    this.setData({ constraintsOpen: !this.data.constraintsOpen })
  },

  toggleAdminPanel() {
    this.setData({ adminOpen: !this.data.adminOpen })
  },

  createActivity() {
    const activityId = this.data.activityId || nowId('a')
    this.setData({ activityId, role: 'admin', isOwner: true, isAdmin: true, localOwnerKey: this.data.userKey }, () => {
      this.persistActivity(true)
      this.refreshHomeData()
    })
    return activityId
  },

  loadActivity(activityId, role) {
    if (this.data.cloudReady) {
      this.callCloud('getActivity', { activityId }).then((res) => {
        if (!res.ok) {
          this.loadLocalActivity(activityId, role, res.message || '')
          return
        }
        this.applyCloudActivity(res.activity, role, res.isOwner, res.isAdmin)
      }).catch(() => {
        this.loadLocalActivity(activityId, role, '')
      })
      return
    }
    this.loadLocalActivity(activityId, role, '')
  },

  loadActivity(activityId, role, initialTab) {
    if (this.data.cloudReady) {
      this.callCloud('getActivity', { activityId }).then((res) => {
        if (!res.ok) {
          this.loadLocalActivity(activityId, role, res.message || '', initialTab)
          return
        }
        this.applyCloudActivity(res.activity, role, res.isOwner, res.isAdmin, initialTab)
      }).catch(() => {
        this.loadLocalActivity(activityId, role, '', initialTab)
      })
      return
    }
    this.loadLocalActivity(activityId, role, '', initialTab)
  },

  loadLocalActivity(activityId, role, message, initialTab) {
    const activities = wx.getStorageSync(ACTIVITIES_KEY) || {}
    const activity = activities[activityId]
    if (!activity || activity.deleted) {
      this.setData({ activityId, role, errorText: message })
      return
    }
    const presetCount = rotationLimitFromActivity(activity)
    var activeTab = activity.activeTab === 'review' ? 'stats' : (activity.activeTab || this.data.activeTab)
    if (initialTab === 'stats') activeTab = 'stats'
    if (initialTab === 'history') activeTab = 'history'
    this.setData(Object.assign({}, activity, {
      singleGender: activity.singleGender === 'female' ? 'female' : 'male',
      singleLevel: normalizeLevel(activity.singleLevel),
      selectedPreset: presetCount,
      presetCount,
      singleLevelDraft: '',
      levelDrafts: {},
      playerNameDrafts: {},
      avoidWomenDoubles: !!activity.avoidWomenDoubles,
      handicapMdXd: Math.max(0, Number(activity.handicapMdXd) || 3),
      handicapMdWd: Math.max(0, Number(activity.handicapMdWd) || 6),
      handicapXdWd: Math.max(0, Number(activity.handicapXdWd) || 3),
      role,
      activityId,
      localOwnerKey: activity.localOwnerKey || '',
      activeTab: activeTab,
      fees: activity.fees || { items: [], payments: {}, splitMode: 'equal', totalAmount: 0, currency: '¥' }
    }), () => {
      this.refreshPlayerOptions()
      this.refreshRecommended()
      this.refreshGameBuckets()
      this.refreshScoreSummary()
      this.refreshMyGames()
      this.refreshHomeData()
    })
  },

  applyCloudActivity(activity, preferredRole, isOwner, isAdmin, initialTab) {
    if (!activity) return
    const canAdmin = !!isAdmin || !!isOwner
    const role = canAdmin ? 'admin' : (preferredRole === 'admin' ? 'player' : preferredRole)
    const presetCount = rotationLimitFromActivity(activity)
    const presentKey = (players) => (players || [])
      .filter((player) => !player.status || player.status === 'present')
      .map((player) => player.id)
      .join('|')
    const shouldRebuild = canAdmin &&
      this.data.activityId === activity.activityId &&
      this.data.schedule.length &&
      presentKey(this.data.participants) !== presentKey(activity.participants)
    var activeTab = activity.activeTab === 'review' ? 'stats' : (activity.activeTab || this.data.activeTab)
    if (initialTab === 'stats') activeTab = 'stats'
    if (initialTab === 'history') activeTab = 'history'
    this.setData(Object.assign({}, activity, {
      singleGender: activity.singleGender === 'female' ? 'female' : 'male',
      singleLevel: normalizeLevel(activity.singleLevel),
      selectedPreset: presetCount,
      presetCount,
      singleLevelDraft: '',
      levelDrafts: {},
      playerNameDrafts: {},
      avoidWomenDoubles: !!activity.avoidWomenDoubles,
      handicapMdXd: Math.max(0, Number(activity.handicapMdXd) || 3),
      handicapMdWd: Math.max(0, Number(activity.handicapMdWd) || 6),
      handicapXdWd: Math.max(0, Number(activity.handicapXdWd) || 3),
      role,
      activityId: activity.activityId,
      localOwnerKey: activity.localOwnerKey || '',
      activeTab: activeTab,
      fees: activity.fees || { items: [], payments: {}, splitMode: 'equal', totalAmount: 0, currency: '¥' },
      isOwner,
      isAdmin: canAdmin,
      cloudReady: true,
      lastSyncedAt: this.formatTime(new Date())
      ,
      syncText: this.formatTime(new Date())
    }), () => {
      this.refreshPlayerOptions()
      this.refreshRecommended()
      this.refreshGameBuckets()
      this.refreshScoreSummary()
      this.refreshMyGames()
      this.refreshHomeData()
      if (shouldRebuild) this.rebuildRemainingForRosterChange('')
    })
  },

  persistActivity(forceCreate) {
    if (!this.data.activityId) return
    const activities = wx.getStorageSync(ACTIVITIES_KEY) || {}
    activities[this.data.activityId] = {
      activityTitle: this.data.activityTitle,
      deleted: false,
      activityId: this.data.activityId,
      localOwnerKey: this.data.localOwnerKey || this.data.userKey,
      ownerOpenid: this.data.openid || '',
      activityDate: this.data.activityDate,
      activityVenue: this.data.activityVenue,
      activityStatus: this.data.activityStatus,
      activityStatusText: this.data.activityStatusText,
      registrationOpen: this.data.registrationOpen,
      rosterLocked: this.data.rosterLocked,
      selectedPreset: this.data.selectedPreset,
      presetCount: this.data.presetCount,
      participants: this.data.participants,
      batchText: this.data.batchText,
      singleGender: this.data.singleGender,
      singleLevel: this.data.singleLevel,
      activityHours: this.data.activityHours,
      gameMinutes: this.data.gameMinutes,
      courtCount: this.data.courtCount,
      perPlayerGameCount: this.data.perPlayerGameCount,
      gameCount: this.data.gameCount,
      preferMixed: this.data.preferMixed,
      balanceSkill: this.data.balanceSkill,
      schedule: this.data.schedule,
      stats: this.data.stats,
      repeatedPartners: this.data.repeatedPartners,
      scheduleQuality: this.data.scheduleQuality,
      review: this.data.review,
      resultSnapshot: this.data.resultSnapshot,
      fixedPairs: this.data.fixedPairs,
      avoidPairs: this.data.avoidPairs,
      restLowLevel: this.data.restLowLevel,
      newcomerFirstRest: this.data.newcomerFirstRest,
      manualRests: this.data.manualRests,
      weightFairness: this.data.weightFairness,
      weightRepeat: this.data.weightRepeat,
      weightSkill: this.data.weightSkill,
      useRecommended: this.data.useRecommended,
      avoidWomenDoubles: this.data.avoidWomenDoubles,
      handicapMdXd: this.data.handicapMdXd,
      handicapMdWd: this.data.handicapMdWd,
      handicapXdWd: this.data.handicapXdWd,
      qrCodeFileID: this.data.qrCodeFileID,
      adminOpenids: this.data.adminOpenids,
      generatedAt: this.data.generatedAt,
      shareText: this.data.shareText
    }
    wx.setStorageSync(ACTIVITIES_KEY, activities)
    this.refreshHomeData()
    if (!this.data.cloudReady || !this.data.activityId) return
    if (!forceCreate && !this.data.isAdmin && !this.data.isOwner) return

    const snapshot = this.getActivitySnapshot()
    if (!forceCreate) {
      delete snapshot.scheduleQuality
      delete snapshot.review
      delete snapshot.resultSnapshot
    }
    const action = forceCreate ? 'createActivity' : 'updateActivity'
    const payload = forceCreate
      ? { activityId: this.data.activityId, activity: snapshot }
      : { activityId: this.data.activityId, patch: snapshot }

    this.setData({ syncing: true })
    this.callCloud(action, payload).then((res) => {
      if (!res.ok) {
        this.setData({ syncing: false })
        this.showError(res.message || '')
        return
      }
      this.setData({
        isOwner: !!res.isOwner || this.data.isOwner,
        isAdmin: !!res.isAdmin || this.data.isAdmin,
        lastSyncedAt: this.formatTime(new Date()),
        syncText: this.formatTime(new Date()),
        syncing: false,
        errorText: ''
      })
    }).catch((error) => {
      this.setData({ syncing: false })
      this.showError(`云端同步失败：${error.errMsg || error.message || ''}`)
    })
  },

  onActivityTitleInput(event) {
    this.setData({ activityTitle: event.detail.value }, () => this.persistActivity())
  },

  onActivityDateInput(event) {
    this.setData({ activityDate: event.detail.value }, () => this.persistActivity())
  },

  onActivityVenueInput(event) {
    this.setData({ activityVenue: event.detail.value }, () => this.persistActivity())
  },

  setActivityStatus(event) {
    const status = event.currentTarget.dataset.status
    if (status === 'signup') {
      this.openSignup()
      return
    }
    if (status === 'locked') {
      this.lockRoster()
      return
    }
    if (status === 'running') {
      this.startActivity()
      return
    }
    if (status === 'ended') {
      this.endActivity()
    }
  },

  openSignup() {
    if (this.data.role !== 'admin') {
      showError('报名失败')
      return
    }
    this.setData({
      activityStatus: 'signup',
      activityStatusText: '报名中',
      registrationOpen: true,
      rosterLocked: false,
      errorText: ''
    }, () => {
      this.persistActivity()
      wx.showToast({ title: '已开放报名', icon: 'success' })
    })
  },

  lockRoster() {
    if (this.data.role !== 'admin') {
      showError('操作失败')
      return
    }
    this.setData({
      activityStatus: 'locked',
      activityStatusText: '已锁定',
      registrationOpen: false,
      rosterLocked: true,
      errorText: ''
    }, () => {
      this.persistActivity()
      wx.showToast({ title: '已锁定', icon: 'success' })
    })
  },

  startActivity() {
    if (this.data.role !== 'admin') {
      showError('操作失败')
      return
    }
    if (!this.data.schedule.length) {
      const result = this.buildSchedule([])
      if (!result) return
      this.applyScheduleResult(result, '排阵已生成', {
        activityStatus: 'running',
        activityStatusText: '进行中',
        registrationOpen: false,
        rosterLocked: true,
        activeTab: 'games'
      })
      return
    }
    this.setData({
      activityStatus: 'running',
      activityStatusText: '进行中',
      registrationOpen: false,
      rosterLocked: true,
      activeTab: 'games',
      errorText: ''
    }, () => {
      this.persistActivity()
      wx.showToast({ title: '已开始', icon: 'success' })
    })
  },

  endActivity() {
    if (this.data.role !== 'admin') {
      showError('操作失败')
      return
    }
    if (!this.data.schedule.length) {
      showError('排阵失败')
      return
    }
    const review = this.buildReview(this.data.schedule, this.data.stats, this.data.repeatedPartners)
    const resultSnapshot = this.buildResultSnapshot(this.data.schedule, this.data.stats, review)
    this.setData({
      activityStatus: 'ended',
      activityStatusText: '已结束',
      registrationOpen: false,
      rosterLocked: true,
      activeTab: 'stats',
      review,
      radarStats: this.buildRadarStats(this.data.stats, this.data.schedule),
      resultSnapshot,
      errorText: ''
    }, () => {
      this.persistActivity()
      wx.showToast({ title: '已结束', icon: 'success' })
    })
  },

  copyShareLink() {
    const activityId = this.data.activityId || this.createActivity()
    wx.setClipboardData({
      data: `/pages/index/index?activityId=${activityId}&role=player`
    })
    wx.showToast({ title: '链接已复制', icon: 'success' })
  },

  /** 生成活动二维码（公开入口，队员也可使用） */
  generateActivityQr() {
    if (!this.data.activityId) {
      const activityId = nowId('a')
      this.setData({ activityId }, () => this.createActivity())
    }
    if (this.data.cloudReady) {
      this.generateQrCode()
    } else {
      this.generateLocalQrCode('')
    }
  },

  generateQrCode() {
    if (!this.data.activityId || !this.data.cloudReady) {
      showError('同步失败，请重试')
      return
    }
    this.callCloud('getActivityQr', { activityId: this.data.activityId }).then((res) => {
      if (!res.ok) {
        this.generateLocalQrCode(res.message || '')
        return
      }
      this.clearError()
      this.setData({ qrCodeFileID: res.fileID, qrLocalPath: '' })
      wx.previewImage({ urls: [res.fileID] })
    }).catch(() => this.generateLocalQrCode(''))
  },

  onPresetCountInput(event) {
    this.setData({ presetCount: event.detail.value })
  },

  applyPresetCount() {
    if (!this.canAdminEdit()) return
    const count = Math.max(4, Math.min(MAX_PLAYERS, Math.floor(Number(this.data.presetCount) || 6)))
    const currentLimit = rotationLimitFromActivity(this.data)
    const presentSlotCount = (this.data.participants || []).filter((player) => !player.status || player.status === 'present').length
    if (count === currentLimit && presentSlotCount === count) {
      this.setData({ selectedPreset: count, presetCount: count })
      return
    }
    const result = this.resizeRotationSlots(count)
    this.setData({
      selectedPreset: result.count,
      presetCount: result.count,
      batchText: result.participants.map((player) => player.name).join('\n'),
      participants: result.participants,
      schedule: [],
      stats: [],
      rankingStats: [],
      repeatedPartners: [],
      progressData: {
        doneNum: 0,
        totalNum: 0,
        progress: 0
      },
      errorText: ''
    }, () => {
      this.afterRosterChange()
      wx.showToast({ title: `已设为 ${result.count} 人`, icon: 'none' })
    })
  },

  resizeRotationSlots(count) {
    const target = Math.max(4, Math.min(MAX_PLAYERS, Math.floor(Number(count) || 6)))
    const current = this.data.participants || []
    const presentPlayers = current.filter((player) => !player.status || player.status === 'present')
    const otherPlayers = current.filter((player) => player.status && player.status !== 'present')
    const presentReal = presentPlayers.filter(isRealPlayer)
    const presentEmpty = presentPlayers.filter((player) => !isRealPlayer(player))
    const effectiveCount = Math.max(target, presentReal.length)
    const nextPresent = presentReal.concat(presentEmpty).slice(0, effectiveCount)
    while (nextPresent.length < effectiveCount) {
      nextPresent.push(makePlayerWithName(nextDefaultPlayerName(nextPresent.concat(otherPlayers))))
    }
    return {
      count: effectiveCount,
      participants: nextPresent.concat(otherPlayers)
    }
  },

  onSignupModeChange(event) {
    this.setData({ signupMode: event.currentTarget.dataset.mode, errorText: '' })
  },

  toggleBatchImport() {
    if (!this.canAdminEdit()) return
    this.setData({ batchImportOpen: !this.data.batchImportOpen })
  },

  applyBatchImport() {
    if (!this.canAdminEdit()) return
    const participants = this.mergeNames(uniqueNames(this.data.batchText || ''))
    this.setData({
      participants,
      selectedPreset: PRESETS.indexOf(participants.length) >= 0 ? participants.length : 0,
      schedule: [],
      batchImportOpen: false
    }, () => this.afterRosterChange())
  },

  onBatchInput(event) {
    if (!this.canAdminEdit()) return
    const batchText = event.detail.value
    const participants = this.mergeNames(uniqueNames(batchText))
    this.setData({
      batchText,
      participants,
      selectedPreset: PRESETS.indexOf(participants.length) >= 0 ? participants.length : 0,
      schedule: []
    }, () => this.afterRosterChange())
  },

  onSingleNameInput(event) {
    this.setData({ singleName: event.detail.value })
  },

  onSingleGenderChange(event) {
    const gender = event.currentTarget.dataset.gender === 'female' ? 'female' : 'male'
    this.setData({ singleGender: gender })
  },

  onSingleLevelInput(event) {
    const value = (event.detail && event.detail.value) || this.data.singleLevelDraft || this.data.singleLevel
    const level = normalizeLevel(value)
    this.setData({ singleLevel: level, singleLevelDraft: '' })
  },

  onSingleLevelDraft(event) {
    this.setData({ singleLevelDraft: (event.detail && event.detail.value) || '' })
  },

  onSingleLevelChange(event) {
    const option = LEVEL_OPTIONS[Number(event.detail.value)] || LEVEL_OPTIONS[3]
    this.setData({ singleLevel: option.value, singleLevelDraft: '' })
  },

  onPlayerNameDraft(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    this.setData({ [`playerNameDrafts.${id}`]: (event.detail && event.detail.value) || '' })
  },

  onPlayerNameBlur(event) {
    if (!event || !event.type || event.type !== 'confirm') return
    if (this.hasRosterEditLocked()) {
      showError('操作失败')
      this.refreshPlayerOptions()
      return
    }
    const id = event.currentTarget.dataset.id
    const drafts = Object.assign({}, this.data.playerNameDrafts || {})
    const name = String(drafts[id] != null ? drafts[id] : ((event.detail && event.detail.value) || '')).trim()
    if (!id) return
    delete drafts[id]
    this.setData({ playerNameDrafts: drafts })
    if (!name) {
      this.refreshPlayerOptions()
      return
    }
    const duplicated = (this.data.participants || []).some((player) => player.id !== id && player.name === name)
    if (duplicated) {
      showError('加载失败，请重试')
      this.refreshPlayerOptions()
      return
    }
    this.updatePlayer(id, { name })
  },

  submitRosterSlotName(event) {
    const next = Object.assign({}, event || {}, { type: 'confirm' })
    this.onPlayerNameBlur(next)
  },

  toggleRosterDrawer(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    this.setData({
      expandedRosterId: this.data.expandedRosterId === id ? '' : id
    })
  },

  addSinglePlayer() {
    if (this.hasRosterEditLocked()) {
      showError('操作失败')
      return
    }
    const name = this.data.singleName.trim()
    if (!name) {
      showError('操作失败')
      return
    }
    if (this.data.role !== 'admin' && this.data.cloudReady) {
      const gender = this.data.singleGender === 'female' ? 'female' : 'male'
      const level = normalizeLevel(this.data.singleLevelDraft || this.data.singleLevel)
      this.signupToCloud({
        id: playerId(),
        name,
        gender,
        genderText: genderText(gender),
        level,
        status: 'present',
        statusText: '到场',
        source: 'self',
        isNew: true
      })
      return
    }
    if (this.data.activityStatus === 'ended') {
      showError('操作失败')
      return
    }
    if (this.data.participants.length >= MAX_PLAYERS) {
      showError('操作失败')
      return
    }
    if (this.data.participants.some((player) => player.name === name)) {
      showError('操作失败')
      this.setData({ singleName: '' })
      return
    }
    const promotedBeforeSignup = this.ensureRosterCapacity()
    const gender = this.data.singleGender === 'female' ? 'female' : 'male'
    const level = normalizeLevel(this.data.singleLevelDraft || this.data.singleLevel)
    const rotationLimit = rotationLimitFromActivity(this.data)
    const presentCount = this.getSchedulablePlayers().length
    const isBenchSignup = presentCount >= rotationLimit
    const shouldKeepSchedule = isBenchSignup && this.data.schedule.length
    const participants = this.data.participants.concat({
      id: playerId(),
      name,
      gender,
      genderText: genderText(gender),
      level,
      status: isBenchSignup ? 'bench' : 'present',
      statusText: isBenchSignup ? '替补' : '到场',
      source: 'manual',
      isNew: isBenchSignup
    })
    this.setData({
      participants,
      singleName: '',
      singleLevel: level,
      singleLevelDraft: '',
      batchText: participants.map((player) => player.name).join('\n'),
      selectedPreset: PRESETS.indexOf(participants.length) >= 0 ? participants.length : 0,
      schedule: shouldKeepSchedule ? this.data.schedule : [],
      errorText: ''
    }, () => {
      this.afterRosterChange()
      if (promotedBeforeSignup) this.rebuildRemainingForRosterChange('')
      wx.showToast({ title: isBenchSignup ? '已加入替补' : '报名成功', icon: 'success' })
      // 首次报名后提示开启通知
      const hasPrompted = wx.getStorageSync('notifyPrompted')
      if (!hasPrompted) {
        wx.setStorageSync('notifyPrompted', true)
        this.promptSubscribe()
      }
    })
  },

  signupOpenSlot(event) {
    if (this.hasRosterEditLocked()) {
      showError('报名失败')
      return
    }
    if (this.data.role === 'admin') return
    if (!this.data.cloudReady) {
      showError('同步失败，请重试')
      return
    }
    const id = event.currentTarget.dataset.id
    const slot = (this.data.participants || []).find((player) => player.id === id)
    if (!slot) return
    const gender = this.data.singleGender === 'female' ? 'female' : 'male'
    const level = normalizeLevel(this.data.singleLevelDraft || this.data.singleLevel || slot.level)
    const name = String(this.data.singleName || '').trim() || slot.name
    if (isDefaultPlayerName(name)) {
      showError('操作失败')
      return
    }
    this.signupToCloud(Object.assign({}, slot, {
      name,
      gender,
      genderText: genderText(gender),
      level,
      status: 'present',
      statusText: '到场',
      source: 'self',
      isNew: false
    }))
  },

  addBenchSlot() {
    if (this.hasRosterEditLocked()) {
      showError('操作失败')
      return
    }
    if (this.data.role !== 'admin') return
    if ((this.data.participants || []).length >= MAX_PLAYERS) {
      showError('操作失败')
      return
    }
    const participants = (this.data.participants || []).concat({
      id: playerId(),
      name: nextDefaultPlayerName(this.data.participants || []),
      gender: 'male',
      genderText: '男',
      level: 3,
      status: 'bench',
      statusText: '替补',
      source: 'manual',
      isNew: true
    })
    this.setData({
      participants,
      batchText: participants.map((player) => player.name).join('\n')
    }, () => this.afterRosterChange())
  },

  cancelSignup(event) {
    if (this.hasRosterEditLocked()) {
      this.showError('已录入比分，报名信息已锁定，不能取消报名。')
      return
    }
    const id = event.currentTarget.dataset.id
    if (this.data.role !== 'admin' && this.data.cloudReady) {
      this.callCloud('cancelSignup', { activityId: this.data.activityId }).then((res) => {
        if (!res.ok) {
          this.showError(res.message || '')
          return
        }
        this.leaveActivityAfterCancel()
      }).catch(() => this.showError('退出活动失败'))
      return
    }
    if (this.data.role !== 'admin') {
      this.removeLocalSignupThenLeave(id)
      return
    }
    this.removePlayerById(id)
  },

  leaveActivityAfterCancel() {
    this.setData(Object.assign({}, this.getEmptyActivityState(), {
      cloudReady: this.data.cloudReady,
      openid: this.data.openid,
      userKey: this.data.userKey,
      localOwnerKey: '',
      errorText: ''
    }), () => {
      this.refreshPlayerOptions()
      this.refreshHomeData()
      if (this.data.cloudReady) this.fetchCloudActivities(true)
      wx.showToast({ title: '已取消报名', icon: 'success' })
    })
  },

  removeLocalSignupThenLeave(id) {
    const rotationLimit = rotationLimitFromActivity(this.data)
    const participants = (this.data.participants || []).filter((player) => player.id !== id)
    while (participants.length < rotationLimit) {
      participants.push(makePlayerWithName(nextDefaultPlayerName(participants)))
    }
    const activities = wx.getStorageSync(ACTIVITIES_KEY) || {}
    if (this.data.activityId && activities[this.data.activityId]) {
      activities[this.data.activityId] = Object.assign({}, activities[this.data.activityId], {
        participants,
        batchText: participants.map((player) => player.name).join('\n'),
        schedule: [],
        updatedAt: Date.now()
      })
      wx.setStorageSync(ACTIVITIES_KEY, activities)
    }
    this.leaveActivityAfterCancel()
  },

  removePlayer(event) {
    if (this.hasRosterEditLocked()) {
      showError('活动操作失败')
      return
    }
    if (this.data.role !== 'admin') {
      showError('操作失败')
      return
    }
    const id = event.currentTarget.dataset.id
    const player = (this.data.participants || []).find((item) => item.id === id)
    wx.showModal({
      title: '删除队员',
      content: `确定删除「${player ? player.name : ''}」吗？已生成的轮转会清空。`,
      confirmText: '删除',
      confirmColor: '#be123c',
      success: (res) => {
        if (res.confirm) this.removePlayerById(id)
      }
    })
  },

  removePlayerById(id) {
    const removed = this.data.participants.find((player) => player.id === id)
    const participants = this.data.participants.filter((player) => player.id !== id)
    const keepSchedule = this.data.schedule.length && removed && removed.status === 'bench'
    this.setData({
      participants,
      batchText: participants.map((player) => player.name).join('\n'),
      selectedPreset: PRESETS.indexOf(participants.length) >= 0 ? participants.length : 0,
      schedule: keepSchedule ? this.data.schedule : []
    }, () => {
      this.afterRosterChange()
      if (!keepSchedule) this.rebuildRemainingForRosterChange('')
    })
  },

  bindPlayerOpenid(event) {
    if (this.data.role !== 'admin') {
      showError('操作失败')
      return
    }
    if (!this.data.cloudReady) {
      showError('同步失败，请重试')
      return
    }
    const targetId = event.currentTarget.dataset.id
    const target = (this.data.participants || []).find((player) => player.id === targetId)
    if (!target) return
    const candidates = []
    const usedByOther = (this.data.participants || []).some((player) => player.id !== targetId && player.openid === this.data.openid)
    if (this.data.openid && target.openid !== this.data.openid && !usedByOther) {
      candidates.push({ id: '', name: '我的微信', openid: this.data.openid })
    }
    ;(this.data.playerOpenidOptions || []).forEach((item) => {
      if (item.id !== targetId && item.openid && candidates.every((candidate) => candidate.openid !== item.openid)) {
        candidates.push(item)
      }
    })
    if (!candidates.length) {
      showError('操作失败')
      return
    }
    wx.showActionSheet({
      itemList: candidates.map((item) => item.name),
      success: (res) => {
        const picked = candidates[res.tapIndex]
        if (!picked || !picked.openid) return
        wx.showModal({
          title: '绑定微信身份',
          content: `将「${target.name}」绑定到「${picked.name}」的微信身份？绑定后会移除「${picked.name}」这条重复报名。`,
          confirmText: '绑定',
          success: (modalRes) => {
            if (!modalRes.confirm) return
            const participants = (this.data.participants || [])
              .filter((player) => player.id !== picked.id)
              .map((player) => {
                if (player.id !== targetId) return player
                return Object.assign({}, player, {
                  openid: picked.openid,
                  source: player.source || 'manual',
                  boundFromPlayerId: picked.id,
                  updatedAt: Date.now()
                })
              })
            if (this.data.cloudReady) {
              this.setData({ syncing: true })
              this.callCloud('bindPlayerOpenid', {
                activityId: this.data.activityId,
                playerId: targetId,
                bindOpenid: picked.openid,
                removePlayerId: picked.id || ''
              }).then((bindRes) => {
                this.setData({ syncing: false })
                if (!bindRes.ok) {
                  this.showError(bindRes.message || '')
                  return
                }
                this.refreshCloudActivity(true)
              }).catch(() => {
                this.setData({ syncing: false })
                showError('加载失败，请重试')
              })
              return
            }
            this.setData({
              participants,
              batchText: participants.map((player) => player.name).join('\n')
            }, () => this.afterRosterChange())
          }
        })
      }
    })
  },

  setGender(event) {
    if (this.hasRosterEditLocked()) {
      showError('操作失败')
      return
    }
    const gender = event.currentTarget.dataset.gender
    if (gender !== 'male' && gender !== 'female') return
    this.updatePlayer(event.currentTarget.dataset.id, { gender })
  },

  setStatus(event) {
    this.updatePlayer(event.currentTarget.dataset.id, { status: event.currentTarget.dataset.status })
  },

  changeLevel(event) {
    if (this.hasRosterEditLocked()) {
      showError('操作失败')
      return
    }
    const id = event.currentTarget.dataset.id
    const drafts = Object.assign({}, this.data.levelDrafts || {})
    const value = (event.detail && event.detail.value) || drafts[id]
    const level = normalizeLevel(value)
    delete drafts[id]
    this.setData({ levelDrafts: drafts })
    this.updatePlayer(id, { level })
  },

  changePlayerLevel(event) {
    if (this.hasRosterEditLocked()) {
      showError('操作失败')
      return
    }
    const id = event.currentTarget.dataset.id
    const option = LEVEL_OPTIONS[Number(event.detail.value)] || LEVEL_OPTIONS[3]
    this.updatePlayer(id, { level: option.value })
  },

  onPlayerLevelDraft(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    this.setData({ [`levelDrafts.${id}`]: (event.detail && event.detail.value) || '' })
  },

  onHoursInput(event) {
    if (!this.canAdminEditSettings()) return
    this.setData({ activityHours: event.detail.value }, () => this.afterSettingsChange())
  },

  onMinutesInput(event) {
    if (!this.canAdminEditSettings()) return
    this.setData({ gameMinutes: event.detail.value }, () => this.afterSettingsChange())
  },

  onCourtInput(event) {
    if (!this.canAdminEditSettings()) return
    this.setData({ courtCount: event.detail.value }, () => this.afterSettingsChange())
  },

  onGameCountInput(event) {
    if (!this.canAdminEditSettings()) return
    const value = String((event.detail && event.detail.value) || '').trim()
    if (!value) {
      this.setData({
        gameCount: '',
        displayGameCount: 0,
        useRecommended: false,
        schedule: []
      }, () => this.persistActivity())
      return
    }
    const gameCount = Math.max(1, Math.floor(Number(value) || 1))
    const playerCount = this.getSchedulablePlayers().length || this.getActivePlayers().length || 0
    const perPlayerGameCount = playerCount ? Math.max(1, Math.round((gameCount * 4) / playerCount)) : this.data.perPlayerGameCount
    this.setData({
      gameCount,
      perPlayerGameCount,
      displayGameCount: gameCount,
      useRecommended: false,
      schedule: []
    }, () => this.persistActivity())
  },

  onPerPlayerGameCountInput(event) {
    if (!this.canAdminEditSettings()) return
    const value = String((event.detail && event.detail.value) || '').trim()
    if (!value) {
      this.setData({
        perPlayerGameCount: '',
        useRecommended: false,
        schedule: []
      }, () => this.persistActivity())
      return
    }
    const perPlayerGameCount = Math.max(1, Number(value) || 1)
    const playerCount = this.getSchedulablePlayers().length || this.getActivePlayers().length || 0
    const gameCount = Math.max(1, Math.round((playerCount * perPlayerGameCount) / 4))
    this.setData({
      perPlayerGameCount,
      gameCount,
      displayGameCount: gameCount,
      useRecommended: false,
      schedule: []
    }, () => this.persistActivity())
  },

  normalizeGameCountInput() {
    if (!this.canAdminEditSettings()) return
    const gameCount = Math.max(1, Math.floor(Number(this.data.gameCount) || 1))
    const playerCount = this.getSchedulablePlayers().length || this.getActivePlayers().length || 0
    const perPlayerGameCount = playerCount ? Math.max(1, Math.round((gameCount * 4) / playerCount)) : (this.data.perPlayerGameCount || 1)
    this.setData({
      gameCount,
      perPlayerGameCount,
      displayGameCount: gameCount
    }, () => this.persistActivity())
  },

  normalizePerPlayerGameCountInput() {
    if (!this.canAdminEditSettings()) return
    const perPlayerGameCount = Math.max(1, Number(this.data.perPlayerGameCount) || 1)
    const playerCount = this.getSchedulablePlayers().length || this.getActivePlayers().length || 0
    const gameCount = Math.max(1, Math.round((playerCount * perPlayerGameCount) / 4))
    this.setData({
      perPlayerGameCount,
      gameCount,
      displayGameCount: gameCount
    }, () => this.persistActivity())
  },

  togglePreferMixed(event) {
    this.setData({ preferMixed: event.detail.value, schedule: [] }, () => this.persistActivity())
  },

  toggleBalanceSkill(event) {
    this.setData({ balanceSkill: event.detail.value, schedule: [] }, () => this.persistActivity())
  },

  toggleAvoidWomenDoubles(event) {
    this.setData({ avoidWomenDoubles: event.detail.value, schedule: [] }, () => this.persistActivity())
  },

  toggleRestLowLevel(event) {
    this.setData({ restLowLevel: event.detail.value, schedule: [] }, () => this.persistActivity())
  },

  toggleNewcomerFirstRest(event) {
    this.setData({ newcomerFirstRest: event.detail.value, schedule: [] }, () => this.persistActivity())
  },

  changeWeightFairness(event) {
    this.setData({ weightFairness: Number(event.detail.value), schedule: [] }, () => this.persistActivity())
  },

  changeWeightRepeat(event) {
    this.setData({ weightRepeat: Number(event.detail.value), schedule: [] }, () => this.persistActivity())
  },

  changeWeightSkill(event) {
    this.setData({ weightSkill: Number(event.detail.value), schedule: [] }, () => this.persistActivity())
  },

  onHandicapInput(event) {
    if (!this.canAdminEditSettings()) return
    const key = event.currentTarget.dataset.key
    if (!key) return
    const value = Math.max(0, Math.min(21, Number(event.detail.value) || 0))
    this.setData({ [key]: value, schedule: [] }, () => this.persistActivity())
  },

  onRestRoundInput(event) {
    this.setData({ restRound: event.detail.value })
  },

  onRestPlayerChange(event) {
    const restPlayerIndex = Number(event.detail.value)
    this.setData({
      restPlayerIndex,
      restPlayerLabel: this.data.playerOptions[restPlayerIndex] || ''
    })
  },

  viewQrCode() {
    if (this.data.qrLocalPath) {
      wx.previewImage({ urls: [this.data.qrLocalPath] })
      return
    }
    if (this.data.qrCodeFileID) wx.previewImage({ urls: [this.data.qrCodeFileID] })
  },

  generateLocalQrCode(message) {
    const path = `/pages/index/index?activityId=${this.data.activityId}&role=player`
    const matrix = makeQrMatrix(path)
    const size = 340
    const quiet = 24
    const moduleSize = Math.floor((size - quiet * 2) / matrix.length)
    const qrSize = moduleSize * matrix.length
    const start = Math.floor((size - qrSize) / 2)

    const query = wx.createSelectorQuery()
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) {
        this.showError('Canvas 初始化失败')
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      canvas.width = size * dpr
      canvas.height = size * dpr
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.fillStyle = '#111827'
      matrix.forEach((row, r) => {
        row.forEach((dark, c) => {
          if (dark) ctx.fillRect(start + c * moduleSize, start + r * moduleSize, moduleSize, moduleSize)
        })
      })
      wx.canvasToTempFilePath({
        canvas: canvas,
        width: size,
        height: size,
        destWidth: size * 3,
        destHeight: size * 3,
        success: (res2) => {
          this.setData({ qrLocalPath: res2.tempFilePath, qrCodeFileID: '' })
          this.showError(`${message} 本地二维码内容为报名路径，可用于开发调试。`, 5000)
          wx.previewImage({ urls: [res2.tempFilePath] })
        },
        fail: () => { wx.hideLoading(); this.showError('二维码生成失败') }
      })
    })
  },

  copyMyOpenid() {
    if (!this.data.openid) return
    wx.setClipboardData({ data: this.data.openid })
  },

  onClaimPlayerChange(event) {
    const claimPlayerIndex = Number(event.detail.value)
    const option = this.data.claimPlayerOptions[claimPlayerIndex]
    this.setData({
      claimPlayerIndex,
      claimPlayerLabel: option ? option.name : ''
    })
  },

  claimMyPlayer() {
    if (!this.data.cloudReady || !this.data.openid) {
      showError('同步失败，请重试')
      return
    }
    if (!this.data.activityId) {
      showError('同步失败，请重试')
      return
    }
    const option = this.data.claimPlayerOptions[this.data.claimPlayerIndex]
    if (!option || !option.id) {
      showError('操作失败')
      return
    }
    wx.showModal({
      title: '认领报名',
      content: `确认将微信身份绑定到「${option.name}」？之后我的战绩会按这个姓名统计。`,
      confirmText: '认领',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ syncing: true })
        this.callCloud('claimPlayer', {
          activityId: this.data.activityId,
          playerId: option.id
        }).then((claimRes) => {
          this.setData({ syncing: false })
          if (!claimRes.ok) {
            this.showError(claimRes.message || '')
            return
          }
          wx.showToast({ title: '已认领', icon: 'success' })
          this.refreshCloudActivity(true)
        }).catch(() => {
          this.setData({ syncing: false })
          showError('加载失败，请重试')
        })
      }
    })
  },

  addAdminOpenid() {
    const option = this.data.playerOpenidOptions[this.data.adminPlayerIndex]
    if (!option || !option.openid) {
      showError('操作失败')
      return
    }
    const adminOpenid = option.openid
    this.callCloud('addAdmin', {
      activityId: this.data.activityId,
      adminOpenid
    }).then((res) => {
      if (!res.ok) {
        this.showError(res.message || '')
        return
      }
      this.setData({ adminOpenids: res.adminOpenids || [], errorText: '' }, () => this.refreshCloudActivity(true))
    }).catch(() => this.showError('加载管理员列表失败'))
  },

  removeAdminOpenid(event) {
    const adminOpenid = event.currentTarget.dataset.openid
    this.callCloud('removeAdmin', {
      activityId: this.data.activityId,
      adminOpenid
    }).then((res) => {
      if (!res.ok) {
        this.showError(res.message || '')
        return
      }
      this.setData({ adminOpenids: res.adminOpenids || [], errorText: '' }, () => this.refreshCloudActivity(true))
    }).catch(() => this.showError('加载管理员列表失败'))
  },

  onAdminPlayerChange(event) {
    const adminPlayerIndex = Number(event.detail.value)
    const option = this.data.playerOpenidOptions[adminPlayerIndex]
    this.setData({
      adminPlayerIndex,
      adminPlayerLabel: option ? option.name : ''
    })
  },

  addManualRest() {
    const players = this.getSchedulablePlayers()
    const player = players[this.data.restPlayerIndex]
    const round = Math.max(1, Math.floor(Number(this.data.restRound) || 1))
    if (!player) return
    const id = `${round}_${player.id}`
    if (this.data.manualRests.some((item) => item.id === id)) return
    const manualRests = this.data.manualRests.concat({
      id,
      round,
      playerId: player.id,
      label: `第${round}轮 ${player.name} 休息`
    })
    this.setData({ manualRests, schedule: [] }, () => this.persistActivity())
  },

  removeManualRest(event) {
    const id = event.currentTarget.dataset.id
    this.setData({
      manualRests: this.data.manualRests.filter((item) => item.id !== id),
      schedule: []
    }, () => this.persistActivity())
  },

  toggleNewPlayer(event) {
    const id = event.currentTarget.dataset.id
    const participants = this.data.participants.map((player) => {
      if (player.id !== id) return player
      return Object.assign({}, player, { isNew: !player.isNew })
    })
    this.setData({ participants }, () => {
      this.afterRosterChange()
      this.persistActivity()
    })
  },

  useRecommendedGames() {
    if (!this.canAdminEditSettings()) return
    this.setData({
      gameCount: this.data.recommendedGames,
      perPlayerGameCount: this.data.recommendedPlayerGames,
      displayGameCount: this.data.recommendedGames,
      useRecommended: true,
      schedule: []
    }, () => this.persistActivity())
  },

  onPairAChange(event) {
    const pairAIndex = Number(event.detail.value)
    this.setData({ pairAIndex, pairALabel: this.data.playerOptions[pairAIndex] || '' })
  },

  onPairBChange(event) {
    const pairBIndex = Number(event.detail.value)
    this.setData({ pairBIndex, pairBLabel: this.data.playerOptions[pairBIndex] || '' })
  },

  addFixedPair() {
    this.addPairConstraint('fixedPairs')
  },

  addAvoidPair() {
    this.addPairConstraint('avoidPairs')
  },

  addPairConstraint(key) {
    const players = this.getSchedulablePlayers()
    const a = players[this.data.pairAIndex]
    const b = players[this.data.pairBIndex]
    if (!a || !b || a.id === b.id) {
      showError('操作失败')
      return
    }
    const pairId = pairKey(a.id, b.id)
    const exists = this.data[key].some((pair) => pair.id === pairId)
    if (exists) return
    const next = this.data[key].concat({ id: pairId, a: a.id, b: b.id, label: `${a.name} / ${b.name}` })
    this.setData({ [key]: next, schedule: [] }, () => this.persistActivity())
  },

  removePairConstraint(event) {
    const key = event.currentTarget.dataset.type
    const id = event.currentTarget.dataset.id
    this.setData({ [key]: this.data[key].filter((pair) => pair.id !== id), schedule: [] }, () => this.persistActivity())
  },

  refreshRecommended() {
    const hours = Number(this.data.activityHours) || DEFAULT_HOURS
    const minutes = Number(this.data.gameMinutes) || DEFAULT_GAME_MINUTES
    const courts = Math.max(1, Math.floor(Number(this.data.courtCount) || 1))
    const activeCount = this.getSchedulablePlayers().length || this.getActivePlayers().length || this.data.participants.length
    const playableCourts = Math.max(1, Math.min(courts, Math.floor(activeCount / 4) || 1))
    const recommendedGames = Math.max(1, Math.floor((hours * 60) / minutes) * playableCourts)
    const recommendedPlayerGames = activeCount ? Math.round((recommendedGames * 4 / activeCount) * 10) / 10 : 0
    this.setData({
      recommendedGames,
      recommendedPlayerGames,
      displayGameCount: (this.data.schedule || []).length || this.data.gameCount || recommendedGames,
      gameCount: this.data.useRecommended ? recommendedGames : this.data.gameCount,
      perPlayerGameCount: this.data.useRecommended ? recommendedPlayerGames : this.data.perPlayerGameCount
    })
  },

  generate() {
    if (this.data.role !== 'admin') {
      showError('操作失败')
      return
    }
    if (this.data.schedule.some((game) => game.completed)) {
      showError('排阵失败')
      return
    }
    this.ensureRosterCapacity()
    const result = this.buildSchedule([])
    if (!result) return
    this.applyScheduleResult(result, '排阵已生成', { activeTab: 'games' })
  },

  regenerateRemaining(event) {
    if (this.data.role !== 'admin') return
    const round = Number(event.currentTarget.dataset.round)
    const lockedConflict = this.data.schedule.some((game) => game.completed && game.round >= round)
    if (lockedConflict) {
      showError('排阵失败')
      return
    }
    const keptGames = this.data.schedule.filter((game) => game.round < round || game.completed)
    const remaining = Math.max(1, Number(this.data.gameCount) - keptGames.length)
    const result = this.buildSchedule(keptGames, remaining)
    if (!result) return
    this.applyScheduleResult(result, `已保留 ${keptGames.length} 局，只重排剩余局。`)
  },

  insertBenchFromNextRound() {
    if (this.data.role !== 'admin') {
      showError('排阵失败')
      return
    }
    if (this.data.activityStatus === 'ended') {
      showError('操作失败')
      return
    }
    const hasBench = this.data.participants.some((player) => player.status === 'bench' || player.status === 'late')
    if (!hasBench) {
      showError('操作失败')
      return
    }
    const promoted = autoPromoteBench(this.data.participants, this.data)
    if (!promoted.changed) {
      showError('操作失败')
      return
    }
    const participants = promoted.participants
    const firstOpen = this.data.schedule.find((game) => !game.completed)
    this.setData({ participants }, () => {
      this.afterRosterChange()
      if (firstOpen) {
        const result = this.buildSchedule(this.data.schedule.filter((game) => game.round < firstOpen.round || game.completed), Math.max(1, Number(this.data.gameCount) - firstOpen.order + 1))
        if (result) this.applyScheduleResult(result, '排阵已生成')
      } else if (!this.data.schedule.length) {
        const result = this.buildSchedule([])
        if (result) this.applyScheduleResult(result, '排阵已生成', { activeTab: 'games' })
      } else {
        showError('排阵失败')
      }
    })
  },

  buildSchedule(baseGames, forcedRemaining) {
    this.ensureRosterCapacity()
    const players = this.getSchedulablePlayers()
    const configuredGameCount = Math.max(1, Math.floor(Number(this.data.gameCount) || 1))
    if (!forcedRemaining && configuredGameCount !== this.data.gameCount) {
      const playerCount = players.length || this.getActivePlayers().length || 0
      const perPlayerGameCount = playerCount ? Math.max(1, Math.round((configuredGameCount * 4) / playerCount)) : (this.data.perPlayerGameCount || 1)
      this.setData({
        gameCount: configuredGameCount,
        perPlayerGameCount,
        displayGameCount: configuredGameCount
      })
    }
    const gameCount = Math.floor(Number(forcedRemaining || configuredGameCount))
    const courtCount = Math.max(1, Math.floor(Number(this.data.courtCount) || 1))
    if (players.length < 4) {
      showError('操作失败')
      return null
    }
    if (players.length > MAX_PLAYERS) {
      showError('操作失败')
      return null
    }
    if (!gameCount || gameCount < 1) {
      showError('操作失败')
      return null
    }
    return generateSchedule(players, gameCount, courtCount, {
      preferMixed: this.data.preferMixed,
      balanceSkill: this.data.balanceSkill,
      avoidWomenDoubles: this.data.avoidWomenDoubles,
      fixedPairs: this.data.fixedPairs,
      avoidPairs: this.data.avoidPairs,
      restLowLevel: this.data.restLowLevel,
      newcomerFirstRest: this.data.newcomerFirstRest,
      manualRests: this.data.manualRests,
      handicap: {
        mdVsXd: this.data.handicapMdXd,
        mdVsWd: this.data.handicapMdWd,
        xdVsWd: this.data.handicapXdWd
      },
      weights: {
        fairness: this.data.weightFairness,
        repeat: this.data.weightRepeat,
        skill: this.data.weightSkill
      }
    }, baseGames)
  },

  applyScheduleResult(result, message, extraState) {
    if (!result.games.length) {
      showError('排阵失败')
      return
    }
    const now = new Date()
    const generatedAt = `${now.getHours()}:${now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes()}`
    const shareText = this.buildShareText(result.games, result.stats)
    const courtCount = Math.max(1, Math.floor(Number(this.data.courtCount) || 1))
    this.setData(Object.assign({
      schedule: result.games,
      stats: result.stats,
      rankingStats: this.buildRankingStats(result.games, this.getActivePlayers()),
      progressData: this.buildProgressData(result.games),
      repeatedPartners: result.repeatedPartners,
      scheduleQuality: result.quality,
      review: this.buildReview(result.games, result.stats, result.repeatedPartners),
      radarStats: this.buildRadarStats(result.stats, result.games),
      generatedAt,
      shareText,
      errorText: result.playableCourts < courtCount ? `当前人数最多同时使用 ${result.playableCourts} 片场地，已按可用场地生成。` : ''
    }, extraState || {}), () => {
      this.persistActivity()
      this.saveHistory(result.games, result.stats, generatedAt)
      this.refreshGameBuckets()
      this.refreshMyGames()
      if (message) wx.showToast({ title: message, icon: 'success' })
      // 发送「轮转已生成」通知给所有参与者
      const participants = this.data.participants || this.data.rosterParticipants || []
      const tmplId = NOTIFY_TMPL_IDS.activityReminder
      if (tmplId) {
        participants.forEach(p => {
          if (p.openid) {
            sendSubscribeMessage(
              'cloud1-d3gt5f02n0ddacfb3',
              p.openid,
              tmplId,
              {
                thing1: { value: this.data.activityTitle || '羽毛球活动' },
                thing2: { value: (this.data.courtCount || 1) + '片场 · ' + (this.data.schedule ? this.data.schedule.length : 0) + '局' },
                time3: { value: this.data.generatedAt || new Date().toLocaleString() },
                thing4: { value: '点击查看你的轮转排阵' }
              },
              'pages/index/index?activityId=' + this.data.activityId
            )
          }
        })
      }
    })
  },

  onScoreInput(event) {
    const id = event.currentTarget.dataset.id
    const side = event.currentTarget.dataset.side
    const value = event.detail.value
    const target = this.data.schedule.find((game) => game.id === id)
    if (!this.canScoreGame(target)) {
      this.showError('只有当前轮转队员或管理员可以录入比分')
      return
    }
    const schedule = this.data.schedule.map((game) => {
      if (game.id !== id) return game
      if (game.completed) return game
      const next = Object.assign({}, game)
      if (side === 'A') next.scoreA = value
      if (side === 'B') next.scoreB = value
      return next
    })
    this.setData({ schedule }, () => {
      this.refreshGameBuckets()
      this.persistActivity()
    })
  },

  adjustScore(event) {
    const id = event.currentTarget.dataset.id
    const side = event.currentTarget.dataset.side
    const delta = Number(event.currentTarget.dataset.delta || 0)
    const target = this.data.schedule.find((game) => game.id === id)
    if (!this.canScoreGame(target)) {
      this.showError('只有当前轮转队员或管理员可以录入比分')
      return
    }
    const schedule = this.data.schedule.map((game) => {
      if (game.id !== id || game.completed) return game
      const next = Object.assign({}, game)
      const key = side === 'A' ? 'scoreA' : 'scoreB'
      const current = Math.max(0, Number(next[key]) || 0)
      next[key] = String(Math.max(0, current + delta))
      return next
    })
    this.setData({ schedule }, () => {
      this.refreshGameBuckets()
      this.persistActivity()
    })
  },

  buildGameResult(game, scoreA, scoreB) {
    const handicapA = Math.max(0, Number(game.handicapA) || 0)
    const handicapB = Math.max(0, Number(game.handicapB) || 0)
    const effectiveScoreA = scoreA + handicapA
    const effectiveScoreB = scoreB + handicapB
    if (effectiveScoreA === effectiveScoreB) return null
    return {
      scoreA,
      scoreB,
      handicapA,
      handicapB,
      effectiveScoreA,
      effectiveScoreB,
      winner: effectiveScoreA > effectiveScoreB ? 'A' : 'B'
    }
  },

  quickScore(event) {
    const id = event.currentTarget.dataset.id
    const winner = event.currentTarget.dataset.winner
    const target = this.data.schedule.find((game) => game.id === id)
    if (!this.canScoreGame(target)) {
      this.showError('只有当前轮转队员或管理员可以录入比分')
      return
    }
    const schedule = this.data.schedule.map((game) => {
      if (game.id !== id || game.completed) return game
      let scoreA = winner === 'A' ? 21 : 18
      let scoreB = winner === 'B' ? 21 : 18
      let result = this.buildGameResult(game, scoreA, scoreB)
      if (!result || result.winner !== winner) {
        if (winner === 'A') scoreA += Math.abs((game.handicapB || 0) - (game.handicapA || 0)) + 1
        if (winner === 'B') scoreB += Math.abs((game.handicapA || 0) - (game.handicapB || 0)) + 1
        result = this.buildGameResult(game, scoreA, scoreB)
      }
      if (!result) return game
      return Object.assign({}, game, {
        scoreA: String(scoreA),
        scoreB: String(scoreB),
        completed: true,
        result
      })
    })
    this.applyScoreUpdate(schedule, '快速计分完成')
  },

  quickFinish(event) {
    const id = event.currentTarget.dataset.id
    const scoreA = Number(event.currentTarget.dataset.scorea)
    const scoreB = Number(event.currentTarget.dataset.scoreb)
    const target = this.data.schedule.find((game) => game.id === id)
    if (!this.canScoreGame(target)) {
      this.showError('只有当前轮转队员或管理员可以录入比分')
      return
    }
    const schedule = this.data.schedule.map((game) => {
      if (game.id !== id || game.completed) return game
      const result = this.buildGameResult(game, scoreA, scoreB)
      if (!result) return game
      return Object.assign({}, game, {
        scoreA: String(scoreA),
        scoreB: String(scoreB),
        completed: true,
        result
      })
    })
    this.applyScoreUpdate(schedule, '一键胜出')
  },

  saveResult(event) {
    const id = event.currentTarget.dataset.id
    const target = this.data.schedule.find((game) => game.id === id)
    if (!target || target.completed) return
    if (!this.canScoreGame(target)) {
      this.showError('只有当前轮转队员或管理员可以录入比分')
      return
    }
    const targetScoreA = Number(target.scoreA)
    const targetScoreB = Number(target.scoreB)
    if (target.scoreA === '' || target.scoreB === '' || Number.isNaN(targetScoreA) || Number.isNaN(targetScoreB)) {
      showError('计分失败')
      return
    }
    const targetResult = this.buildGameResult(target, targetScoreA, targetScoreB)
    if (!targetResult) {
      showError('排阵失败')
      return
    }
    const schedule = this.data.schedule.map((game) => {
      if (game.id !== id) return game
      if (game.completed) return game
      const scoreA = Number(game.scoreA)
      const scoreB = Number(game.scoreB)
      if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) return game
      const result = this.buildGameResult(game, scoreA, scoreB)
      if (!result) return game
      return Object.assign({}, game, {
        completed: true,
        result
      })
    })
    this.applyScoreUpdate(schedule, '比分已保存', id, targetScoreA, targetScoreB, targetResult)
  },

  applyScoreUpdate(schedule, toastTitle, scoreGameId, scoreA, scoreB, result) {
    const players = this.getActivePlayers()
    const state = buildStateFromGames(players, schedule)
    const stats = players.map((player) => {
      const wins = state.wins[player.id] || 0
      const losses = state.losses[player.id] || 0
      const total = wins + losses
      return {
        id: player.id,
        name: player.name,
        games: state.appearances[player.id] || 0,
        wins,
        losses,
        winRate: total ? `${Math.round((wins / total) * 100)}%` : '-'
      }
    })
    this.setData({
      schedule,
      stats,
      rankingStats: this.buildRankingStats(schedule, players),
      progressData: this.buildProgressData(schedule),
      review: this.buildReview(schedule, stats, this.data.repeatedPartners),
      radarStats: this.buildRadarStats(stats, schedule),
      shareText: this.buildShareText(schedule, stats),
      errorText: ''
    }, () => {
      this.persistActivity()
      if (scoreGameId) this.syncScoreResult(scoreGameId, scoreA, scoreB, result)
      this.saveHistory(schedule, stats, this.data.generatedAt || this.formatTime(new Date()))
      this.refreshGameBuckets()
      this.refreshMyGames()
      wx.showToast({ title: toastTitle || '', icon: 'success' })
    })
  },

  syncScoreResult(gameId, scoreA, scoreB, result) {
    if (!this.data.cloudReady || !this.data.activityId) return
    const patch = {
      schedule: this.data.schedule,
      stats: this.data.stats,
      repeatedPartners: this.data.repeatedPartners,
      scheduleQuality: this.data.scheduleQuality,
      review: this.data.review,
      shareText: this.data.shareText,
      generatedAt: this.data.generatedAt
    }
    if (this.data.resultSnapshot) patch.resultSnapshot = this.data.resultSnapshot
    this.setData({ syncing: true })
    this.callCloud('saveScore', {
      activityId: this.data.activityId,
      gameId,
      scoreA,
      scoreB,
      result,
      patch
    }).then((res) => {
      if (!res.ok) {
        this.setData({ syncing: false })
        this.showError(res.message || '比分同步失败')
        return
      }
      this.setData({
        lastSyncedAt: this.formatTime(new Date()),
        syncText: this.formatTime(new Date()),
        syncing: false,
        errorText: ''
      })
    }).catch((error) => {
      this.setData({ syncing: false })
      this.showError(`比分同步失败：${error.errMsg || error.message || ''}`)
    })
  },

  copyShareText() {
    if (!this.data.shareText) {
      showError('复制失败')
      return
    }
    wx.setClipboardData({ data: this.data.shareText, success: () => wx.showToast({ title: '分享文本已复制', icon: 'success' }) })
  },

  exportPoster() {
    if (!this.data.schedule.length) {
      showError('请先生成轮转排阵')
      return
    }
    wx.showLoading({ title: '生成海报中' })
    const ratio = Math.max(2, Math.min(4, getPixelRatio()))
    const width = 375
    const query = wx.createSelectorQuery()
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) {
        wx.hideLoading()
        showError('Canvas 初始化失败')
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      const completedCount = this.data.schedule.filter(g => g.completed || g.result).length
      const posterStats = this.data.rankingStats.length ? this.data.rankingStats : this.data.stats
      const statCount = Math.min(8, posterStats.length)
      const gameCardH = 76
      const statRowH = 22
      const bodyHeight = 196 + this.data.schedule.length * gameCardH + 30 + 46 + statCount * statRowH + 48
      const height = Math.max(680, bodyHeight)
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)

      const { drawSchedulePoster } = require('./modules/canvas-export')
      drawSchedulePoster(ctx, {
        title: this.data.activityTitle || '羽毛球活动',
        subtitle: `${this.data.activityDate || ''} | ${this.data.activityVenue || ''}`,
        generatedAt: this.data.generatedAt || this.formatTime(new Date()),
        summary: [
          { n: this.data.schedule.length, t: '总局' },
          { n: completedCount, t: '完成' },
          { n: this.data.courtCount || 1, t: '场地' },
          { n: this.data.participants.length, t: '人数' }
        ],
        schedule: this.data.schedule.map(game => ({
          round: game.round,
          court: game.court,
          teamAText: game.teamAText || '',
          teamBText: game.teamBText || '',
          restText: game.restText || '无',
          result: game.result ? { scoreA: game.result.scoreA, scoreB: game.result.scoreB } : null
        })),
        posterStats: posterStats.slice(0, 8),
        rankingStats: this.data.rankingStats
      }, { width, padding: 18 }).then(() => {
        wx.canvasToTempFilePath({
          canvas: canvas,
          width: width,
          height: height,
          destWidth: width * ratio,
          destHeight: height * ratio,
          success: (res2) => {
            wx.hideLoading()
            this.setData({ posterPath: res2.tempFilePath })
            wx.previewImage({ urls: [res2.tempFilePath] })
          },
          fail: () => { wx.hideLoading(); showError('导出失败，请重试') }
        })
      }).catch(() => { wx.hideLoading(); showError('绘制失败') })
    })
  },

  /** 导出结果图（赛后复盘） */
  exportResultPoster() {
    wx.showLoading({ title: '生成复盘中' })
    const snapshot = this.data.resultSnapshot || this.buildResultSnapshot(this.data.schedule, this.data.stats, this.data.review)
    if (!snapshot || !snapshot.totalGames) {
      wx.hideLoading()
      showError('请先完成计分后查看')
      return
    }
    const ratio = Math.max(2, Math.min(4, getPixelRatio()))
    const width = 375
    const query = wx.createSelectorQuery()
    query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) {
        wx.hideLoading()
        showError('Canvas 初始化失败')
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2
      const { drawResultPoster } = require('./modules/canvas-export')
      const ranking = (snapshot.rankingStats || []).slice(0, 10)
      const review = snapshot.review || {}
      const estH = 150 + 4 * 78 + 28 + 22 + ranking.length * 24 + 50
      const height = Math.max(760, estH)
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
      drawResultPoster(ctx, snapshot, { width, padding: 18 }).then(() => {
        wx.canvasToTempFilePath({
          canvas: canvas,
          width: width,
          height: height,
          destWidth: width * ratio,
          destHeight: height * ratio,
          success: (res2) => {
            wx.hideLoading()
            wx.previewImage({ urls: [res2.tempFilePath] })
          },
          fail: () => { wx.hideLoading(); showError('导出失败') }
        })
      }).catch(() => { wx.hideLoading(); showError('绘制失败') })
    })
  },

  exportQrPoster() {
    if (!this.data.qrCodeFileID && !this.data.qrLocalPath) {
      this.generateQrCode()
      showError('海报生成失败')
      return
    }
    wx.showLoading({ title: '生成中' })
    this.getQrImagePath().then((qrPath) => {
      const width = 340
      const height = 520
      const query = wx.createSelectorQuery()
      query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0]) {
          wx.hideLoading()
          showError('Canvas 初始化失败')
          return
        }
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio || 2
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)

        ctx.fillStyle = '#f8fafc'
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = '#0f766e'
        ctx.fillRect(0, 0, width, 112)
        ctx.fillStyle = '#ffffff'
        ctx.font = '23px sans-serif'
        ctx.fillText(this.data.activityTitle || '', 22, 44)

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(26, 136, 288, 310)
        ctx.fillStyle = '#0f172a'
        ctx.font = '15px sans-serif'
        ctx.fillText(`时间：${this.data.activityDate || '待定'}`, 46, 172)
        ctx.fillText(`场地：${this.data.activityVenue || '待定'}`, 46, 202)
        ctx.fillStyle = '#64748b'
        ctx.font = '12px sans-serif'
        ctx.fillText(`活动ID：${this.data.activityId}`, 46, 230)

        const img = canvas.createImage()
        img.src = qrPath
        img.onload = () => {
          ctx.drawImage(img, 90, 250, 160, 160)
          wx.canvasToTempFilePath({
            canvas: canvas,
            width: width,
            height: height,
            destWidth: width * 3,
            destHeight: height * 3,
            success: (res2) => {
              wx.hideLoading()
              this.setData({ qrPosterPath: res2.tempFilePath })
              wx.previewImage({ urls: [res2.tempFilePath] })
            },
            fail: () => {
              wx.hideLoading()
              showError('加载失败，请重试')
            }
          })
        }
        img.onerror = () => {
          wx.hideLoading()
          showError('加载失败，请重试')
        }
      })
    }).catch(() => {
      wx.hideLoading()
      showError('加载失败，请重试')
    })
  },

  getQrImagePath() {
    return new Promise((resolve, reject) => {
      if (this.data.qrLocalPath) {
        resolve(this.data.qrLocalPath)
        return
      }
      wx.cloud.getTempFileURL({
        fileList: [this.data.qrCodeFileID],
        success: (res) => {
          const item = res.fileList && res.fileList[0]
          if (!item || !item.tempFileURL) {
            reject(new Error('empty qr url'))
            return
          }
          wx.getImageInfo({
            src: item.tempFileURL,
            success: (info) => resolve(info.path),
            fail: reject
          })
        },
        fail: reject
      })
    })
  },

  loadHistoryItem(event) {
    const item = this.data.history[Number(event.currentTarget.dataset.index)]
    if (!item) return
    this.setData({
      schedule: item.games,
      stats: item.stats,
      rankingStats: this.buildRankingStats(item.games, this.getActivePlayers()),
      progressData: this.buildProgressData(item.games),
      generatedAt: item.generatedAt,
      shareText: this.buildShareText(item.games, item.stats),
      repeatedPartners: [],
      activeTab: 'games',
      errorText: ''
    }, () => {
      this.refreshGameBuckets()
      this.refreshMyGames()
    })
  },

  clearHistory() {
    wx.removeStorageSync(HISTORY_KEY)
    this.setData({ history: [] })
  },

  clearSchedule() {
    if (this.data.schedule.some((game) => game.completed)) {
      showError('排阵失败')
      return
    }
    this.setData({
      schedule: [],
      stats: [],
      repeatedPartners: [],
      generatedAt: '',
      shareText: '',
      errorText: '',
      review: {
        bestPartner: '-',
        bestWinRate: '-',
        mostBalancedGame: '-',
        repeatRisk: '-'
      }
    }, () => {
      this.persistActivity()
      this.refreshGameBuckets()
      wx.showToast({ title: '', icon: 'success' })
    })
  },

  showError(message, duration) {
    if (this.errorTimer) clearTimeout(this.errorTimer)
    this.setData({ errorText: message })
    wx.showToast({ title: String(message || '操作失败').slice(0, 18), icon: 'none' })
    const timeout = duration || 8000
    this.errorTimer = setTimeout(() => {
      this.setData({ errorText: '' })
    }, timeout)
  },

  clearError() {
    if (this.errorTimer) clearTimeout(this.errorTimer)
    this.setData({ errorText: '' })
  },

  dismissError() {
    this.clearError()
  },

  mergeNames(namesValue) {
    const existing = {}
    this.data.participants.forEach((player) => { existing[player.name] = player })
    return namesValue.map((name) => existing[name] || {
        id: playerId(),
        name,
        gender: 'male',
        genderText: '',
        level: 3,
        status: 'present',
        statusText: '到场',
        isNew: false
    })
  },

  updatePlayer(id, patch) {
    if (this.hasRosterEditLocked()) {
      showError('操作失败')
      return
    }
    if (this.data.role !== 'admin' && this.data.rosterLocked) {
      showError('操作失败')
      return
    }
    if (this.data.role !== 'admin' && this.data.cloudReady) {
      const target = this.data.participants.find((player) => player.id === id)
      if (!target && id === 'bench_slot') {
        const gender = this.data.singleGender === 'female' ? 'female' : 'male'
        const level = normalizeLevel(patch.level != null ? patch.level : (this.data.singleLevelDraft || this.data.singleLevel))
        this.signupToCloud({
          id: playerId(),
          name: patch.name,
          gender,
          genderText: genderText(gender),
          level,
          status: 'bench',
          statusText: '替补',
          source: 'self',
          isNew: true
        })
        return
      }
      if (target && !target.openid && isDefaultPlayerName(target.name)) {
        this.signupToCloud(Object.assign({}, target, patch, {
          genderText: genderText(patch.gender || target.gender),
          statusText: '到场',
          source: 'self'
        }))
        return
      }
      if (!target || target.openid !== this.data.openid) {
        showError('操作失败')
        return
      }
      this.signupToCloud(Object.assign({}, target, patch, {
        genderText: genderText(patch.gender || target.gender),
        statusText: statusText(patch.status || target.status)
      }))
      return
    }
    const participants = this.data.participants.map((player) => {
      if (player.id !== id) return player
      return Object.assign({}, player, patch, {
        genderText: genderText(patch.gender || player.gender),
        statusText: statusText(patch.status || player.status)
      })
    })
    this.setData({ participants, schedule: [] }, () => this.afterRosterChange())
  },

  getActivePlayers() {
    return (this.data.participants || []).slice()
  },

  getSchedulablePlayers() {
    return (this.data.participants || []).filter((player) => isRealPlayer(player) && (!player.status || player.status === 'present'))
  },
  refreshPlayerOptions() {
    const rotationLimit = rotationLimitFromActivity(this.data)
    const participants = this.data.participants || []
    const realParticipants = participants.filter(isRealPlayer)
    const playerNameDrafts = this.data.playerNameDrafts || {}
    const rosterPresentCount = realParticipants.filter((player) => !player.status || player.status === 'present').length
    const rosterBenchCount = realParticipants.filter((player) => player.status === 'bench').length
    const rosterLateCount = realParticipants.filter((player) => player.status === 'late').length
    const meta = signupMeta(this.data, realParticipants)
    const isAdmin = this.data.role === 'admin'
    const rosterEditLocked = this.hasRosterEditLocked()
    const signupActionText = isAdmin
      ? (meta.modeText === '替补' ? '加替补' : '添加')
      : meta.buttonText
    const signupHelpText = isAdmin
      ? '管理员手动添加的队员会标记为手动；分享页报名会标记为本人。'
      : meta.hint
    let rosterSource = participants
    const hasClaimableSlot = participants.some((player, index) => {
      return index < rotationLimit && !player.openid && isDefaultPlayerName(player.name)
    })
    if (this.data.role !== 'admin' && this.data.cloudReady && !rosterEditLocked && !hasClaimableSlot && participants.length < MAX_PLAYERS) {
      rosterSource = participants.concat({
        id: 'bench_slot',
        name: nextDefaultPlayerName(participants),
        gender: this.data.singleGender || 'male',
        genderText: genderText(this.data.singleGender || 'male'),
        level: this.data.singleLevel || 3,
        status: 'bench',
        statusText: '替补',
        source: 'manual',
        isSynthetic: true
      })
    }
    const rosterParticipants = rosterSource.map((player, index) => {
      const isOpenSlot = (index < rotationLimit && !player.openid && isDefaultPlayerName(player.name)) || player.isSynthetic
      const draftName = playerNameDrafts[player.id]
      const displayName = draftName != null
        ? draftName
        : (isDefaultPlayerName(player.name) ? '' : player.name)
      const source = player.source || (player.openid ? 'self' : 'manual')
      const cleanName = isDefaultPlayerName(player.name) ? '' : String(player.name || '')
      const slotLabel = `${index + 1}号`
      const avatarText = shortName(cleanName || displayName, 2) || '?'
      const updatedText = player.updatedAt ? this.formatCloudDate(player.updatedAt) : ''
      return Object.assign({}, player, {
        displayName: isOpenSlot ? '' : displayName,
        displayNameShort: isOpenSlot ? '' : shortName(cleanName || displayName, 2),
        isOpenSlot,
        source,
        slotLabel,
        avatarText,
        avatarUrl: player.avatarUrl || '',
        updatedText,
        isExpanded: this.data.expandedRosterId === player.id,
        levelIndex: levelIndex(player.level),
        levelLabel: levelLabel(player.level),
        isMine: !!this.data.openid && player.openid === this.data.openid,
        genderSymbol: player.gender === 'female' ? '♀' : '♂',
        genderText: genderText(player.gender),
        statusText: statusText(player.status),
        sourceText: isOpenSlot
          ? ''
          : (source === 'self' ? '本人报名' : (player.openid ? '手动添加 · 已绑定' : '手动添加')),
        canBindWechat: this.data.cloudReady && source !== 'self' && this.data.role === 'admin',
        canEditProfile: !rosterEditLocked && (this.data.role === 'admin' || player.openid === this.data.openid),
        canClaimSlot: !rosterEditLocked && isOpenSlot,
        canRemove: !rosterEditLocked && this.data.role === 'admin',
        canCancel: !rosterEditLocked && this.data.role !== 'admin',
        statusClass: player.status || 'present'
      })
    })
    const options = this.getSchedulablePlayers().map((player) => player.name)
    const playerOpenidOptions = participants
      .filter((player) => !!player.openid)
      .map((player) => ({ id: player.id, name: player.name, openid: player.openid }))
    const claimPlayerOptions = participants
      .filter((player) => !player.openid || player.openid === this.data.openid)
      .map((player) => ({ id: player.id, name: player.name, openid: player.openid || '' }))
    const pairAIndex = Math.min(this.data.pairAIndex, Math.max(0, options.length - 1))
    const pairBIndex = Math.min(this.data.pairBIndex, Math.max(0, options.length - 1))
    const adminPlayerIndex = Math.min(this.data.adminPlayerIndex, Math.max(0, playerOpenidOptions.length - 1))
    const claimPlayerIndex = Math.min(this.data.claimPlayerIndex, Math.max(0, claimPlayerOptions.length - 1))
    this.setData({
      playerOptions: options,
      rosterParticipants,
      rosterTotalCount: realParticipants.length,
      roleText: this.data.role === 'admin' ? '管理员' : '队员',
      displayGameCount: (this.data.schedule || []).length || this.data.gameCount || this.data.recommendedGames,
      rosterPresentCount,
      rosterBenchCount,
      rosterLateCount,
      rosterEditLocked,
      signupButtonText: meta.buttonText,
      signupHint: meta.hint,
      signupModeText: meta.modeText,
      signupActionText,
      signupHelpText,
      playerOpenidOptions,
      claimPlayerOptions,
      claimPlayerIndex,
      pairAIndex,
      pairBIndex,
      adminPlayerIndex,
      restPlayerIndex: Math.min(this.data.restPlayerIndex, Math.max(0, options.length - 1)),
      pairALabel: options[pairAIndex] || '',
      pairBLabel: options[pairBIndex] || '',
      restPlayerLabel: options[Math.min(this.data.restPlayerIndex, Math.max(0, options.length - 1))] || '',
      adminPlayerLabel: playerOpenidOptions[adminPlayerIndex] ? playerOpenidOptions[adminPlayerIndex].name : '',
      claimPlayerLabel: claimPlayerOptions[claimPlayerIndex] ? claimPlayerOptions[claimPlayerIndex].name : ''
    })
    this.calcFeeSummary()
  },

  refreshMyGames() {
    if (!(this.data.schedule || []).length) {
      this.setData({ myGames: [], myGameSummary: '' })
      return
    }
    const myPlayer = this.data.participants.find((player) => player.openid && player.openid === this.data.openid)
    if (!myPlayer) {
      this.setData({ myGames: [], myGameSummary: '报名后可查看自己的对局。' })
      return
    }
    const myGames = this.data.schedule.filter((game) => (game.playerIds || []).indexOf(myPlayer.id) >= 0)
    const nextGame = myGames.find((game) => !game.completed)
    this.setData({
      myGames,
      myGameSummary: nextGame ? `预计第 ${nextGame.round} 轮 ${nextGame.court} 号场上场` : '暂无未完成对局'
    })
  },

  getCurrentRotationPlayer() {
    const openid = this.data.openid
    if (!openid) return null
    const player = (this.data.participants || []).find((item) => item.openid && item.openid === openid)
    if (!player) return null
    const inSchedule = (this.data.schedule || []).some((game) => (game.playerIds || []).indexOf(player.id) >= 0)
    return inSchedule ? player : null
  },

  canScoreGame(game) {
    if (!game || game.completed) return false
    if (this.data.role === 'admin' || this.data.isAdmin || this.data.isOwner) return true
    return !!this.getCurrentRotationPlayer()
  },

  refreshGameBuckets() {
    const focusedPlayerId = this.data.focusedPlayerId
    const filteredSchedule = focusedPlayerId
      ? (this.data.schedule || []).filter((game) => (game.playerIds || []).indexOf(focusedPlayerId) >= 0)
      : (this.data.schedule || [])
    const openSchedule = filteredSchedule
      .filter((game) => !game.completed)
      .map((game) => Object.assign({}, game, { canScore: this.canScoreGame(game) }))
    const completedSchedule = filteredSchedule
      .filter((game) => game.completed)
      .map((game) => Object.assign({}, game, { canScore: false }))
    this.setData({
      openSchedule,
      completedSchedule,
      displayGameCount: (this.data.schedule || []).length || this.data.gameCount || this.data.recommendedGames
    })
  },

  viewPlayerSchedule(event) {
    const id = event.currentTarget.dataset.id
    const player = (this.data.participants || []).find((item) => item.id === id)
    if (!player || isDefaultPlayerName(player.name)) return
    if (!this.data.schedule.length) return
    this.setData({
      activeTab: 'games',
      focusedPlayerId: id,
      focusedPlayerName: player.name
    }, () => this.refreshGameBuckets())
  },

  clearPlayerScheduleFilter() {
    this.setData({ focusedPlayerId: '', focusedPlayerName: '' }, () => this.refreshGameBuckets())
  },

  refreshScoreSummary() {
    const schedule = this.data.schedule || []
    this.setData({
      progressData: this.buildProgressData(schedule),
      rankingStats: this.buildRankingStats(schedule, this.getActivePlayers())
    })
  },

  buildProgressData(games) {
    const totalNum = (games || []).length
    const doneNum = (games || []).filter((game) => game.completed || game.result).length
    return {
      doneNum,
      totalNum,
      progress: totalNum ? Math.round((doneNum / totalNum) * 100) : 0
    }
  },

  buildRankingStats(games, players) {
    const ranking = {}
    ;(players || []).forEach((player) => {
      ranking[player.id] = {
        id: player.id,
        name: player.name,
        games: 0,
        wins: 0,
        losses: 0,
        netPoints: 0,
        winDiff: 0,
        winRate: '-',
        level: normalizeLevel(player.level),
        levelLabel: levelLabel(player.level),
        rank: '-'
      }
    })
    ;(games || []).forEach((game) => {
      if (!game.result) return
      const scoreA = Number(game.result.effectiveScoreA != null ? game.result.effectiveScoreA : (Number(game.result.scoreA) + (Number(game.result.handicapA) || 0)))
      const scoreB = Number(game.result.effectiveScoreB != null ? game.result.effectiveScoreB : (Number(game.result.scoreB) + (Number(game.result.handicapB) || 0)))
      const teamAWin = scoreA > scoreB
      ;(game.teamAIds || []).forEach((id) => {
        if (!ranking[id]) return
        ranking[id].games += 1
        ranking[id].wins += teamAWin ? 1 : 0
        ranking[id].losses += teamAWin ? 0 : 1
        ranking[id].netPoints += scoreA - scoreB
      })
      ;(game.teamBIds || []).forEach((id) => {
        if (!ranking[id]) return
        ranking[id].games += 1
        ranking[id].wins += teamAWin ? 0 : 1
        ranking[id].losses += teamAWin ? 1 : 0
        ranking[id].netPoints += scoreB - scoreA
      })
    })
    return Object.keys(ranking).map((id) => {
      const item = ranking[id]
      item.winDiff = item.wins - item.losses
      item.winRate = item.games ? `${Math.round((item.wins / item.games) * 100)}%` : '-'
      return item
    }).sort((a, b) => {
      if (b.winDiff !== a.winDiff) return b.winDiff - a.winDiff
      if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints
      if (b.wins !== a.wins) return b.wins - a.wins
      return a.name.localeCompare(b.name)
    }).map((item, index) => Object.assign({}, item, { rank: index + 1 }))
  },

  buildReview(games, stats, repeatedPartners) {
    const completed = games.filter((game) => game.result)
    const ranking = this.buildRankingStats(games || [], this.getActivePlayers())
    const bestPartner = (repeatedPartners || []).slice().sort((a, b) => (b.wins || 0) - (a.wins || 0))[0]
    const bestPlayer = (stats || []).slice().filter((item) => item.winRate !== '-').sort((a, b) => {
      return Number(String(b.winRate).replace('%', '')) - Number(String(a.winRate).replace('%', ''))
    })[0]
    const balanced = games.slice().sort((a, b) => (a.skillGap || 0) - (b.skillGap || 0))[0]
    const closeGame = completed.slice().sort((a, b) => {
      const ad = Math.abs(Number(a.result.scoreA) - Number(a.result.scoreB))
      const bd = Math.abs(Number(b.result.scoreA) - Number(b.result.scoreB))
      return ad - bd
    })[0]
    const avgSkillGap = games.length
      ? Math.round((games.reduce((sum, game) => sum + (Number(game.skillGap) || 0), 0) / games.length) * 10) / 10
      : 0
    const champion = ranking[0]
    const netPointLeader = ranking.slice().sort((a, b) => b.netPoints - a.netPoints)[0]
    const riskCount = (repeatedPartners || []).filter((item) => item.count > 1).length

    // --- 增强统计：搭档胜率 ---
    const bestPartnerWinRate = bestPartner && (bestPartner.wins || 0) + (bestPartner.losses || 0) > 0
      ? `${Math.round((bestPartner.wins / (bestPartner.wins + bestPartner.losses)) * 100)}% (${bestPartner.wins}胜${bestPartner.losses}负)`
      : (bestPartner ? `100% (${bestPartner.wins || 0}胜0负)` : '暂无')

    // --- 增强统计：最难缠对手 ---
    const opponentStats = {}
    let toughestOpponent = '暂无'
    completed.forEach(function (game) {
      if (!game || !game.teamAText || !game.teamBText) return
      const allPlayers = (game.teamAIds || []).concat(game.teamBIds || [])
      allPlayers.forEach(function (pid) {
        if (!opponentStats[pid]) opponentStats[pid] = { name: '', count: 0, wins: 0, losses: 0 }
      })
      if (game.result && game.result.winner && game.teamAIds && game.teamBIds) {
        const winners = game.result.winner === 'A' ? game.teamAIds : game.teamBIds
        const losers = game.result.winner === 'A' ? game.teamBIds : game.teamAIds
        winners.forEach(function (wid) {
          if (opponentStats[wid]) opponentStats[wid].wins++
        })
        losers.forEach(function (lid) {
          if (opponentStats[lid]) opponentStats[lid].losses++
        })
      }
      if (game.teamAIds) game.teamAIds.forEach(function (pid) {
        if (opponentStats[pid]) opponentStats[pid].count++
      })
      if (game.teamBIds) game.teamBIds.forEach(function (pid) {
        if (opponentStats[pid]) opponentStats[pid].count++
      })
    })
    ;(stats || []).forEach(function (s) {
      if (opponentStats[s.id]) opponentStats[s.id].name = s.name
    })
    // 找对战最多且胜率最低的对手
    const opponentList = Object.keys(opponentStats).filter(function (id) {
      return opponentStats[id].count > 0 && opponentStats[id].name
    }).map(function (id) {
      var o = opponentStats[id]
      o.games = o.wins + o.losses
      o.winRate = o.games > 0 ? o.wins / o.games : 0
      return o
    }).filter(function (o) { return o.games > 0 })
    var sortedOpponents = opponentList.slice().sort(function (a, b) {
      if (a.count !== b.count) return b.count - a.count
      return a.winRate - b.winRate
    })
    if (sortedOpponents.length) {
      var top = sortedOpponents[0]
      toughestOpponent = top.name + ' ' + top.games + '场 ' + Math.round(top.winRate * 100) + '%胜率'
    }

    // --- 增强统计：本周参赛活跃度 ---
    var weeklyActivity = '暂无数据'
    var weeklyStats = null
    if (games.length) {
      var today = new Date()
      var weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      var weeklyGames = completed.filter(function (g) {
        return g.recordedAt && new Date(g.recordedAt).getTime() > weekAgo.getTime()
      })
      if (!weeklyGames.length) {
        // 如果没有时间戳，用活动时间或整个对局数
        weeklyActivity = completed.length + ' 局 (本场)'
      } else {
        var wWins = 0; var wLosses = 0
        weeklyGames.forEach(function (g) {
          if (g.result && g.result.winner) {
            wWins += (g.result.winner === 'A' ? (g.teamAIds || []).length : (g.teamBIds || []).length)
            wLosses += (g.result.winner === 'A' ? (g.teamBIds || []).length : (g.teamAIds || []).length)
          }
        })
        var wTotal = wWins + wLosses
        weeklyActivity = weeklyGames.length + '局, ' + (wTotal ? (Math.round(wWins / wTotal * 100) + '%胜率') : '')
      }
      weeklyStats = { activityCount: 1, gameCount: completed.length, winRate: ' - ' }
      var wTotal = 0; var wWins = 0
      completed.forEach(function (g) {
        if (g.result && g.result.winner) {
          wTotal += 2
          wWins += g.result.winner === 'A' ? 2 : 0
        }
      })
      if (wTotal) weeklyStats.winRate = Math.round(wWins / wTotal * 100) + '%'
    }

    return {
      champion: champion && champion.games ? champion.name + ' ' + champion.wins + '-' + champion.losses : '暂无',
      netPointLeader: netPointLeader && netPointLeader.games ? netPointLeader.name + ' +' + netPointLeader.netPoints : '暂无',
      avgSkillGap: avgSkillGap,
      closeGame: closeGame ? '第' + closeGame.round + '轮 ' + closeGame.result.scoreA + ':' + closeGame.result.scoreB : '暂无',
      bestPartner: bestPartner ? bestPartner.names + '，赢 ' + (bestPartner.wins || 0) + ' 次' : '暂无',
      bestPartnerWinRate: bestPartnerWinRate,
      bestWinRate: bestPlayer ? bestPlayer.name + ' ' + bestPlayer.winRate : '暂无',
      toughestOpponent: toughestOpponent,
      mostBalancedGame: balanced ? '第' + balanced.round + '轮 ' + balanced.court + '号场，强弱差 ' + balanced.skillGap : '暂无',
      repeatRisk: riskCount ? riskCount + ' 组搭档重复' : '',
      weeklyActivity: weeklyActivity,
      completedText: completed.length + ' 局已记录比分'
    }
  },

  buildRadarStats(stats, games) {
    if (!stats || !stats.length) return []
    var maxGames = stats.length
    var totalWinRate = 0
    var totalNetPoints = 0
    var totalGames = 0
    var totalWins = 0
    var totalLosses = 0
    stats.forEach(function (s) {
      totalGames += s.games || 0
      totalWins += s.wins || 0
      totalLosses += s.losses || 0
      totalNetPoints += Math.abs(s.netPoints || 0)
    })
    totalWinRate = totalGames > 0 ? totalWins / totalGames : 0
    // 参赛率：实际参赛人数/总人数
    var participationRate = Math.min(100, Math.round((maxGames / Math.max(1, (stats.length || 1))) * 100))
    // 净胜分指数
    var netPointIndex = Math.min(100, Math.round((totalNetPoints / Math.max(1, totalGames)) * 20))
    // 胜率指数
    var winRateIndex = Math.min(100, Math.round(totalWinRate * 100))
    // 均衡指数
    var balanceIndex = Math.min(100, Math.round((1 - Math.abs(totalWins - totalLosses) / Math.max(1, totalGames)) * 100))
    // 活跃指数
    var activityIndex = (games || []).length > 0 ? Math.min(100, Math.round((stats.length / Math.max(1, (games || []).length)) * 100)) : 50
    return [
      { label: '胜率', value: winRateIndex, score: Math.round(totalWinRate * 100) + '%' },
      { label: '净胜', value: netPointIndex, score: totalNetPoints + '' },
      { label: '均衡', value: balanceIndex, score: balanceIndex + '%' },
      { label: '参赛', value: participationRate, score: participationRate + '%' },
      { label: '活跃', value: activityIndex, score: activityIndex + '%' }
    ]
  },

  buildResultSnapshot(games, stats, review) {
    const rankingStats = this.buildRankingStats(games || [], this.getActivePlayers())
    const completed = (games || []).filter((game) => game.result)
    return {
      title: this.data.activityTitle,
      date: this.data.activityDate,
      venue: this.data.activityVenue,
      endedAt: this.formatTime(new Date()),
      totalGames: (games || []).length,
      completedGames: completed.length,
      playerCount: (stats || []).length || this.data.participants.length,
      rankingStats,
      stats: stats || [],
      review: review || {},
      games: games || []
    }
  },

  buildShareText(games, stats) {
    const lines = [this.data.activityTitle || '']
    games.forEach((game) => {
      const result = game.result ? ` ${game.result.scoreA}:${game.result.scoreB}` : ''
      const handicap = game.handicapText && game.handicapText !== '无让分' ? `（${game.handicapText}）` : ''
      lines.push(`第${game.round}轮 ${game.court}号场：${game.teamAText} vs ${game.teamBText}${handicap}${result}`)
    })
    const rankingStats = this.buildRankingStats(games, this.getActivePlayers())
    if (rankingStats.some((item) => item.games)) {
      lines.push('')
      rankingStats.forEach((item) => {
        lines.push(`${item.rank}. ${item.name} ${item.wins}-${item.losses} 净胜${item.netPoints} 胜率${item.winRate}`)
      })
    } else {
      lines.push('')
      stats.forEach((item) => {
        lines.push(`${item.name} ${item.games}局 ${item.wins || 0}胜${item.losses || 0}负 胜率${item.winRate || '-'}`)
      })
    }
    return lines.join('\n')
  },

  saveHistory(games, stats, generatedAt) {
    const myPlayer = this.data.openid
      ? (this.data.participants || []).find((item) => item.openid === this.data.openid)
      : null
    const item = {
      generatedAt,
      games,
      stats,
      count: games.length,
      players: stats.length,
      date: this.formatDate(new Date()),
      title: this.data.activityTitle,
      activityId: this.data.activityId,
      myPlayerId: myPlayer ? myPlayer.id : '',
      participants: (this.data.participants || []).map((player) => ({
        id: player.id,
        name: player.name,
        openid: player.openid || ''
      })),
      playersDetail: (stats || []).map((s) => ({ id: s.id, name: s.name }))
    }
    const history = [item].concat((this.data.history || []).filter((historyItem) => {
      return historyItem.activityId !== item.activityId
    })).slice(0, 8)
    wx.setStorageSync(HISTORY_KEY, history)
    this.setData({ history }, () => this.refreshHomeData())
  },

  loadHistory() {
    this.setData({ history: wx.getStorageSync(HISTORY_KEY) || [] }, () => this.refreshHomeData())
  },

  refreshHomeData() {
    if (this.data.cloudReady) {
      this.fetchCloudActivities(true)
      return
    }
    const activities = wx.getStorageSync(ACTIVITIES_KEY) || {}
    const allActivities = Object.keys(activities)
      .filter((id) => id)
      .filter((id) => !(activities[id] || {}).deleted)
      .filter((id) => this.canShowLocalActivity(activities[id] || {}))
      .map((id) => this.toActivityCard(id, activities[id] || {}))
      .sort((a, b) => String(b.id).localeCompare(String(a.id)))
    this.setData({
      homeActivitiesRaw: allActivities,
      profileStats: this.buildProfileStats(),
      profileRecords: this.buildProfileRecords(),
      profileTrend: this.buildProfileTrend()
    }, () => this.applyHomeFilters())
  },

  canShowLocalActivity(activity) {
    if (!activity) return false
    const openid = this.data.openid
    const userKey = this.data.userKey
    if (openid && activity.ownerOpenid === openid) return true
    if (userKey && activity.localOwnerKey === userKey) return true
    if (openid && (activity.adminOpenids || []).indexOf(openid) >= 0) return true
    if (openid && (activity.participants || []).some((player) => player.openid === openid)) return true
    return !activity.ownerOpenid && !activity.localOwnerKey && !openid
  },

  fetchCloudActivities(reset) {
    if (!this.data.cloudReady) return
    const shouldReset = reset !== false
    const nextPage = shouldReset ? 0 : this.data.cloudActivityPage + 1
    const size = this.data.cloudActivitySize || 40
    const requestId = Date.now()
    this.homeRequestId = requestId
    this.setData({ syncing: true })
    this.callCloud('listActivities', {
      page: nextPage,
      size,
      keyword: this.data.homeKeyword
    }).then((res) => {
      if (this.homeRequestId !== requestId) return
      this.setData({ syncing: false })
      if (!res.ok) {
        this.showError(res.message || '')
        return
      }
      const list = (res.activities || [])
        .filter((activity) => activity && activity.activityId)
        .map((activity) => this.toActivityCard(activity.activityId, activity))
      const map = {}
      const merged = (shouldReset ? [] : (this.data.homeActivitiesRaw || [])).concat(list).filter((item) => {
        if (!item || !item.id) return false
        map[item.id] = item
        return true
      })
      const allActivities = Object.keys(map).map((id) => map[id]).sort((a, b) => String(b.id).localeCompare(String(a.id)))
      this.setData({
        homeActivitiesRaw: allActivities,
        cloudActivityPage: nextPage,
        cloudActivityHasMore: !!res.hasMore,
        homeSectionLimit: shouldReset ? { active: 6, ended: 6 } : this.data.homeSectionLimit,
        profileStats: this.buildProfileStats(),
        profileRecords: this.buildProfileRecords(),
        profileTrend: this.buildProfileTrend(),
        errorText: ''
      }, () => this.applyHomeFilters())
    }).catch(() => {
      if (this.homeRequestId !== requestId) return
      this.setData({ syncing: false })
      showError('操作失败')
    })
  },

  toActivityCard(id, activity) {
    const schedule = activity.schedule || []
    const completed = schedule.filter((game) => game.completed || game.result).length
    const canDelete = this.canDeleteActivity(activity)
    const canViewResult = (activity.activityStatus === 'ended') || completed > 0
    const isOwner = activity.ownerOpenid
      ? activity.ownerOpenid === this.data.openid
      : (!!activity.localOwnerKey && activity.localOwnerKey === this.data.userKey)
    const isAdmin = !isOwner && (activity.adminOpenids || []).indexOf(this.data.openid) >= 0
    return {
      id,
      title: activity.activityTitle || '',
      date: activity.activityDate || '时间待定',
      venue: activity.activityVenue || '场地待定',
      status: activity.activityStatus || 'signup',
      statusText: activity.activityStatusText || '报名中',
      deleted: !!activity.deleted,
      isOwner,
      isAdmin,
      activity,
      roleText: isOwner ? '创建者' : (isAdmin ? '协作' : '队员'),
      updatedText: this.formatCloudDate(activity.updatedAt),
      playerCount: (activity.participants || []).length,
      gameCount: schedule.length || activity.gameCount || 0,
      completed,
      courtCount: activity.courtCount || 1,
      canDelete,
      canViewResult,
      canRemove: isOwner,
      entryText: '进入',
      removeText: '删除'
    }
  },

  groupActivityCards(cards) {
    const activeActivities = []
    const endedActivities = []
    ;(cards || []).forEach((card) => {
      if (card.status === 'ended') {
        endedActivities.push(card)
      } else {
        activeActivities.push(card)
      }
    })
    return {
      activeActivities,
      endedActivities,
      recentActivities: activeActivities.concat(endedActivities)
    }
  },

  getCurrentHomeActivityCard() {
    if (!this.data.activityId) return null
    const activity = Object.assign({}, this.getActivitySnapshot(), {
      ownerOpenid: this.data.ownerOpenid || '',
      adminOpenids: this.data.adminOpenids || []
    })
    if (activity.deleted) return null
    if (!this.data.cloudReady && !this.canShowLocalActivity(activity)) return null
    return this.toActivityCard(this.data.activityId, activity)
  },

  buildMyActivities() {
    const openid = this.data.openid
    if (!openid) return []
    const raw = this.data.homeActivitiesRaw || []
    return raw.filter((card) => {
      if (!card || !card.activity) return false
      const participants = card.activity.participants || []
      return participants.some((p) => p.openid === openid)
    }).slice(0, 10)
  },

  applyHomeFilters() {
    const keyword = String(this.data.homeKeyword || '').trim().toLowerCase()
    const raw = (this.data.homeActivitiesRaw || []).slice()
    const currentCard = this.getCurrentHomeActivityCard()
    if (currentCard && !raw.some((item) => item && item.id === currentCard.id)) {
      raw.unshift(currentCard)
    }
    const source = raw.filter((item) => {
      if (!item) return false
      if (!keyword) return true
      const hay = `${item.title || ''}`.toLowerCase()
      return hay.indexOf(keyword) >= 0
    })
    const grouped = this.groupActivityCards(source)
    const limits = this.data.homeSectionLimit || { active: 6, ended: 6 }
    const activeActivities = grouped.activeActivities.slice(0, limits.active || 6)
    const endedActivities = grouped.endedActivities.slice(0, limits.ended || 6)
    this.setData({
      recentActivities: activeActivities.concat(endedActivities),
      activeActivities,
      endedActivities,
      myActivities: this.buildMyActivities(),
      activeHasMore: grouped.activeActivities.length > activeActivities.length,
      endedHasMore: grouped.endedActivities.length > endedActivities.length,
      profileStats: this.buildProfileStats(),
      profileRecords: this.buildProfileRecords(),
      profileTrend: this.buildProfileTrend()
    })
  },

  buildProfileHistoryItems() {
    const map = {}
    ;(this.data.history || []).forEach((item) => {
      if (item && item.activityId) map[item.activityId] = item
    })
    ;(this.data.homeActivitiesRaw || []).forEach((card) => {
      const activity = card && card.activity
      if (!activity || !activity.activityId || !this.data.openid) return
      const myPlayer = (activity.participants || []).find((player) => player.openid === this.data.openid)
      if (!myPlayer) return
      const games = activity.schedule || []
      const completedGames = games.filter((game) => game.result || game.completed).length
      if (!completedGames) return
      map[activity.activityId] = {
        generatedAt: this.formatCloudDate(activity.updatedAt) || activity.generatedAt || '',
        games,
        stats: activity.stats || [],
        count: games.length,
        players: (activity.participants || []).length,
        date: activity.activityDate || '',
        title: activity.activityTitle || '',
        activityId: activity.activityId,
        myPlayerId: myPlayer.id,
        participants: (activity.participants || []).map((player) => ({
          id: player.id,
          name: player.name,
          openid: player.openid || ''
        })),
        playersDetail: (activity.participants || []).map((player) => ({ id: player.id, name: player.name }))
      }
    })
    return Object.keys(map).map((id) => map[id]).sort((a, b) => String(b.activityId || '').localeCompare(String(a.activityId || '')))
  },

  buildProfileRecords() {
    return this.buildProfileHistoryItems().slice(0, 6).map((item) => {
      const mine = this.getMyRankingFromHistory(item)
      return {
        title: item.title || '',
        date: item.date || '',
        count: item.count || 0,
        players: item.players || 0,
        summary: mine
          ? `个人第${mine.rank}名，${mine.wins}-${mine.losses}，净胜${mine.netPoints}，胜率${mine.winRate}`
          : '未识别到我的战绩'
      }
    })
  },

  buildProfileTrend() {
    return this.buildProfileHistoryItems().slice(0, 8).reverse().map((item) => {
      const mine = this.getMyRankingFromHistory(item)
      const games = mine ? mine.games : 0
      const wins = mine ? mine.wins : 0
      return {
        label: item.date || item.generatedAt || '-',
        games,
        winRate: games ? Math.round((wins / games) * 100) : 0,
        netPoints: mine ? mine.netPoints : 0
      }
    }).filter((item) => item.games > 0)
  },

  buildProfileStats() {
    const history = this.buildProfileHistoryItems()
    let games = 0
    let wins = 0
    let losses = 0
    let netPoints = 0
    let matches = 0
    history.forEach((item) => {
      const mine = this.getMyRankingFromHistory(item)
      if (!mine) return
      matches += 1
      games += mine.games
      wins += mine.wins
      losses += mine.losses
      netPoints += mine.netPoints
    })
    return {
      matches,
      games,
      wins,
      losses,
      winRate: games ? `${Math.round((wins / games) * 100)}%` : '0%',
      netPoints,
      judgedGames: games
    }
  },

  pickMyPlayerId(historyItem) {
    if (!historyItem) return ''
    if (historyItem.myPlayerId) return historyItem.myPlayerId
    if (this.data.openid && Array.isArray(historyItem.participants)) {
      const mine = historyItem.participants.find((item) => item.openid === this.data.openid)
      if (mine && mine.id) return mine.id
    }
    return ''
  },

  pickMyRanking(ranking, historyItem) {
    if (!ranking.length) return null
    const myId = this.pickMyPlayerId(historyItem)
    if (!myId) return null
    return ranking.find((item) => item.id === myId) || null
  },

  getMyRankingFromHistory(item) {
    const ranking = this.buildRankingStats(item.games || [], item.playersDetail || (item.stats || []).map((s) => ({ id: s.id, name: s.name })))
    return this.pickMyRanking(ranking, item)
  },

  afterRosterChange() {
    const promoted = this.ensureRosterCapacity()
    this.refreshPlayerOptions()
    this.refreshRecommended()
    this.persistActivity()
    if (promoted) this.rebuildRemainingForRosterChange('')
  },

  ensureRosterCapacity() {
    const result = autoPromoteBench(this.data.participants || [], this.data)
    if (result.changed) {
      this.data.participants = result.participants
      this.setData({
        participants: result.participants,
        batchText: result.participants.map((player) => player.name).join('\n')
      })
    }
    return result.changed
  },

  rebuildRemainingForRosterChange(message) {
    if (this.data.role !== 'admin' || this.data.activityStatus === 'ended' || !this.data.schedule.length) return
    const firstOpen = this.data.schedule.find((game) => !game.completed)
    if (!firstOpen) return
    const keptGames = this.data.schedule.filter((game) => game.round < firstOpen.round || game.completed)
    const remaining = Math.max(1, Number(this.data.gameCount) - firstOpen.order + 1)
    const result = this.buildSchedule(keptGames, remaining)
    if (result) this.applyScheduleResult(result, message || '')
  },

  afterSettingsChange() {
    this.refreshRecommended()
    this.persistActivity()
  },

  initCloudSession(done) {
    if (!wx.cloud) {
      this.setData({
        cloudReady: false,
        cloudErrorText: '当前基础库不支持云开发',
        errorText: '',
        syncText: '云端未连接'
      })
      if (done) done()
      return
    }
    this.callCloud('login', {}).then((res) => {
      this.setData({
        openid: res.openid || '',
        cloudReady: !!res.ok,
        cloudErrorText: res.ok ? '' : (res.message || '云函数 activityService 未连接'),
        errorText: '',
        syncText: res.ok ? this.data.syncText : '云端未连接'
      })
      if (done) done()
    }).catch((error) => {
      this.setData({
        cloudReady: false,
        cloudErrorText: `云函数 activityService 未连接：${(error && (error.errMsg || error.message)) || '请上传并部署云函数'}`,
        errorText: '',
        syncText: '云端未连接'
      })
      if (done) done()
    })
  },

  callCloud(action, data) {
    // action → 子云函数映射
    var subFnMap = {
      signup: 'signup',
      cancelSignup: 'signup',
      claimPlayer: 'signup',
      bindPlayerOpenid: 'signup',
      saveScore: 'score',
      getActivityQr: 'roster',
      addAdmin: 'roster',
      removeAdmin: 'roster'
    }
    var subFn = subFnMap[action]
    var functionName = subFn ? CLOUD_FUNCTION + '/' + subFn : CLOUD_FUNCTION
    var callData = subFn ? { action: action, data: data } : { action: action, data: data }
    return wx.cloud.callFunction({
      name: functionName,
      data: callData
    }).then((res) => res.result || { ok: false, message: '云函数无返回。' })
  },

  getActivitySnapshot() {
    return {
      activityId: this.data.activityId,
      deleted: false,
      localOwnerKey: this.data.localOwnerKey || this.data.userKey,
      activityTitle: this.data.activityTitle,
      activityDate: this.data.activityDate,
      activityVenue: this.data.activityVenue,
      activityStatus: this.data.activityStatus,
      activityStatusText: this.data.activityStatusText,
      registrationOpen: this.data.registrationOpen,
      rosterLocked: this.data.rosterLocked,
      selectedPreset: this.data.selectedPreset,
      presetCount: this.data.presetCount,
      participants: this.data.participants,
      batchText: this.data.batchText,
      singleGender: this.data.singleGender,
      singleLevel: this.data.singleLevel,
      activityHours: this.data.activityHours,
      gameMinutes: this.data.gameMinutes,
      courtCount: this.data.courtCount,
      perPlayerGameCount: this.data.perPlayerGameCount,
      gameCount: this.data.gameCount,
      useRecommended: this.data.useRecommended,
      avoidWomenDoubles: this.data.avoidWomenDoubles,
      handicapMdXd: this.data.handicapMdXd,
      handicapMdWd: this.data.handicapMdWd,
      handicapXdWd: this.data.handicapXdWd,
      preferMixed: this.data.preferMixed,
      balanceSkill: this.data.balanceSkill,
      schedule: this.data.schedule,
      stats: this.data.stats,
      repeatedPartners: this.data.repeatedPartners,
      scheduleQuality: this.data.scheduleQuality,
      fixedPairs: this.data.fixedPairs,
      avoidPairs: this.data.avoidPairs,
      restLowLevel: this.data.restLowLevel,
      newcomerFirstRest: this.data.newcomerFirstRest,
      manualRests: this.data.manualRests,
      weightFairness: this.data.weightFairness,
      weightRepeat: this.data.weightRepeat,
      weightSkill: this.data.weightSkill,
      review: this.data.review,
      resultSnapshot: this.data.resultSnapshot,
      qrCodeFileID: this.data.qrCodeFileID,
      adminOpenids: this.data.adminOpenids,
      generatedAt: this.data.generatedAt,
      shareText: this.data.shareText
    }
  },

  signupToCloud(player) {
    if (!this.data.activityId) {
      showError('同步失败，请重试')
      return
    }
    this.setData({ syncing: true })
    this.callCloud('signup', {
      activityId: this.data.activityId,
      player
    }).then((res) => {
      if (!res.ok) {
        this.setData({ syncing: false })
        this.showError(res.message || '')
        return
      }
      this.setData({ singleName: '', syncing: false, errorText: '' })
      this.refreshCloudActivity(true)
      this.refreshHomeData()
      // 首次报名后提示开启通知
      const hasPrompted = wx.getStorageSync('notifyPrompted')
      if (!hasPrompted) {
        wx.setStorageSync('notifyPrompted', true)
        this.promptSubscribe()
      }
    }).catch(() => {
      this.setData({ syncing: false })
      showError('加载失败，请重试')
    })
  },

  refreshCloudActivity(force) {
    if (!this.data.cloudReady || !this.data.activityId) return
    if (this.cloudRefreshing) return
    const now = Date.now()
    if (!force && this.lastCloudRefreshAt && now - this.lastCloudRefreshAt < 3000) return
    this.cloudRefreshing = true
    this.lastCloudRefreshAt = now
    this.callCloud('getActivity', { activityId: this.data.activityId }).then((res) => {
      if (!res.ok) return
      this.applyCloudActivity(res.activity, this.data.role, res.isOwner, res.isAdmin)
    }).finally(() => {
      this.cloudRefreshing = false
    })
  },

  startCloudPolling() {
    if (this.syncTimer) clearInterval(this.syncTimer)
    this.syncTimer = setInterval(() => {
      if (this.data.activityId && this.data.cloudReady && !this.data.syncing) {
        this.refreshCloudActivity()
      }
    }, 30000)
  },

  stopCloudPolling() {
    if (!this.syncTimer) return
    clearInterval(this.syncTimer)
    this.syncTimer = null
  },

  canAdminEdit() {
    if (this.data.role !== 'admin') {
      showError('操作失败')
      return false
    }
    if (this.data.rosterLocked) {
      showError('操作失败')
      return false
    }
    if (this.hasRosterEditLocked()) {
      this.showError('已录入比分，报名信息已锁定，仅支持微信绑定。')
      return false
    }
    return true
  },

  hasRosterEditLocked() {
    const schedule = this.data.schedule || []
    return schedule.some((game) => {
      const hasResult = !!(game.completed || game.result)
      const hasDraftScore = String(game.scoreA || '') !== '' || String(game.scoreB || '') !== ''
      return hasResult || hasDraftScore
    })
  },

  canAdminEditSettings() {
    if (this.data.role !== 'admin') {
      showError('操作失败')
      return false
    }
    return true
  },

  saveGeneratedPoster(path, title) {
    if (!path) return
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => wx.showToast({ title: title || '海报已保存到相册', icon: 'success' }),
      fail: () => {
        showError('保存失败')
      }
    })
  },

  shareGeneratedPoster(path) {
    if (!path) return
    if (wx.showShareImageMenu) {
      wx.showShareImageMenu({
        path,
        fail: () => wx.previewImage({ urls: [path] })
      })
      return
    }
    wx.previewImage({ urls: [path] })
  },

  formatDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  },

  formatCloudDate(value) {
    if (!value) return ''
    let date = value
    if (value.$date) date = new Date(value.$date)
    if (typeof value === 'number' || typeof value === 'string') date = new Date(value)
    if (value.toDate) date = value.toDate()
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
    const month = date.getMonth() + 1
    const day = date.getDate()
    const minutes = date.getMinutes()
    return `${month}-${day} ${date.getHours()}:${minutes < 10 ? '0' + minutes : minutes}`
  },

  formatTime(date) {
    const minutes = date.getMinutes()
    return `${date.getHours()}:${minutes < 10 ? '0' + minutes : minutes}`
  },

  /** Canvas 导出共享主题色 */
  _canvasTheme() {
    return {
      bg: '#f2f6f4',
      green: '#16744f',
      greenDark: '#0f5e41',
      greenLight: '#d1e8dc',
      cardBg: '#ffffff',
      tagBg: '#f4f8f6',
      text: '#17201b',
      textSecondary: '#4a5a52',
      textMuted: '#8a9a92',
      accent: '#f0b429',
      danger: '#be123c'
    }
  },

  /** 画圆角矩形 */
  _roundRect(ctx, x, y, w, h, r, color) {
    if (!ctx) { ctx = this.ctx }
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
  },

  /** Canvas 文字自动换行（使用 Canvas 2D measureText 精确测量） */
  _wrapText(ctx, text, maxWidth) {
    const str = String(text || '')
    if (!str.length) return ['']
    const lines = []
    let current = ''
    for (const ch of str) {
      const testStr = current + ch
      const metrics = ctx.measureText ? ctx.measureText(testStr) : { width: testStr.length * 7 }
      if (metrics.width > maxWidth && current.length > 0) {
        lines.push(current)
        current = ch
      } else {
        current += ch
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : [str]
  },

  /* ===== 费用管理 ===== */
  calcFeeSummary() {
    const fees = this.data.fees || { items: [], payments: {}, splitMode: 'equal', totalAmount: 0, currency: '¥' }
    const total = (fees.items || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
    const count = (this.data.participants || []).filter(p => !p.isOpenSlot).length || 1
    const perPerson = total > 0 ? (total / count).toFixed(2) : '0.00'
    this.setData({
      'fees.totalAmount': total,
      totalFeeAmount: total,
      perPersonFee: perPerson
    })
  },

  addFeeItem() {
    const items = (this.data.fees.items || []).concat([{ id: nowId('fee'), name: '', amount: 0 }])
    this.setData({ 'fees.items': items }, () => this.calcFeeSummary())
    this.persistActivity()
  },

  removeFeeItem(e) {
    const id = e.currentTarget.dataset.id
    const items = (this.data.fees.items || []).filter(i => i.id !== id)
    this.setData({ 'fees.items': items }, () => this.calcFeeSummary())
    this.persistActivity()
  },

  onFeeNameInput(e) {
    const id = e.currentTarget.dataset.id
    const items = (this.data.fees.items || []).map(i => i.id === id ? { ...i, name: e.detail.value } : i)
    this.setData({ 'fees.items': items }, () => this.calcFeeSummary())
    this.persistActivity()
  },

  onFeeAmountInput(e) {
    const id = e.currentTarget.dataset.id
    const items = (this.data.fees.items || []).map(i => i.id === id ? { ...i, amount: Number(e.detail.value) || 0 } : i)
    this.setData({ 'fees.items': items }, () => this.calcFeeSummary())
    this.persistActivity()
  },

  onFeePaymentInput(e) {
    const id = e.currentTarget.dataset.id
    const amount = Number(e.detail.value) || 0
    const payments = { ...(this.data.fees.payments || {}), [id]: amount }
    this.setData({ 'fees.payments': payments }, () => this.persistActivity())
  },

  scanQrCode() {
    wx.scanCode({
      success: (res) => {
        if (res.result && res.result.includes('activityId=')) {
          const match = res.result.match(/activityId=([^&\s]+)/)
          if (match) {
            this.loadActivity(match[1], 'player')
          }
        } else {
          wx.showToast({ title: '无效的活动码', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '扫码取消', icon: 'none' })
      }
    })
  },

  openStats() {
    wx.navigateTo({ url: '/pages/stats/index' })
  },

  openHistory() {
    wx.navigateTo({ url: '/pages/history/index' })
  },

  promptSubscribe() {
    wx.showModal({
      title: '开启通知',
      content: '开启消息通知后，你将在活动报名确认、轮转生成和比分更新时收到微信提醒。',
      confirmText: '去开启',
      cancelText: '暂不',
      success: (res) => {
        if (res.confirm) {
          requestSubscribe((err, result) => {
            if (err) {
              console.log('subscribe rejected', err)
            } else {
              wx.showToast({ title: '已开启', icon: 'success' })
            }
          })
        }
      }
    })
  },
})
