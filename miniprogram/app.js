const constants = require('./utils/constants')

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用2.2.3或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: 'cloud1-d2gsvhf0e4480c1a1',
      traceUser: true
    })
    this.loadUser()
  },

  loadUser: function () {
    const user = wx.getStorageSync('user')
    if (user) {
      this.globalData.user = user
      this.globalData.isLoggedIn = true
    }
  },

  globalData: {
    user: null,
    isLoggedIn: false,
    institutionId: null
  },

  setUser: function (user) {
    this.globalData.user = user
    this.globalData.isLoggedIn = true
    this.globalData.institutionId = user.institution_id
    wx.setStorageSync('user', user)
  },

  logout: function () {
    this.globalData.user = null
    this.globalData.isLoggedIn = false
    this.globalData.institutionId = null
    wx.removeStorageSync('user')
    wx.reLaunch({ url: '/pages/login/login' })
  },

  getRole: function () {
    const user = this.globalData.user
    return user ? user.role : null
  },

  isRole: function (role) {
    return this.getRole() === role
  },

  canManageUsers: function () {
    return this.isRole(constants.ROLE.SUPER_ADMIN)
  },

  canEditMenu: function () {
    const role = this.getRole()
    return role === constants.ROLE.SUPER_ADMIN || role === constants.ROLE.HEAD_CHEF
  },

  canApproveRestrictions: function () {
    const role = this.getRole()
    return role === constants.ROLE.SUPER_ADMIN || role === constants.ROLE.NURSE_MANAGER || role === constants.ROLE.HEAD_CHEF
  },

  canManageRooms: function () {
    const role = this.getRole()
    return role === constants.ROLE.SUPER_ADMIN || role === constants.ROLE.RECEPTIONIST
  }
})
