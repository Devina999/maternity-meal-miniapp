const app = getApp()
const { ROLE_NAME } = require('../../utils/constants')

Page({
  data: {
    loading: false,
    showInviteInput: false,
    inviteCode: '',
    openid: ''
  },

  onLoad() {
    if (app.globalData.isLoggedIn) {
      this.navigateToDashboard()
    }
  },

  // 微信一键登录（新老用户通用）
  handleLogin() {
    this.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getOpenId',
      success: (res) => {
        // 直接调用 registerUser 云函数，它会自动判断：
        // 1. 已注册 → 返回用户信息直接登录
        // 2. 首位用户 → 自动创建超级管理员
        // 3. 新用户 → 提示需要邀请码
        this.doLoginOrRegister()
      },
      fail: (err) => {
        console.error('获取openid失败', err)
        this.setData({ loading: false })
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      }
    })
  },

  async doLoginOrRegister(inviteCode) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'registerUser',
        data: inviteCode ? { inviteCode } : {}
      })

      if (res.result && res.result.success) {
        const user = res.result.user
        app.setUser(user)
        wx.showToast({
          title: res.result.alreadyExists ? '登录成功' : (res.result.message || '注册成功'),
          icon: 'success'
        })
        setTimeout(() => this.navigateToDashboard(), 500)
      } else {
        // 需要邀请码
        this.setData({ showInviteInput: true, loading: false })
      }
    } catch (err) {
      console.error('登录失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  onInviteCodeInput(e) {
    this.setData({ inviteCode: e.detail.value })
  },

  async handleRegister() {
    const code = this.data.inviteCode.trim()
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    this.doLoginOrRegister(code)
  },

  navigateToDashboard() {
    wx.reLaunch({ url: '/pages/dashboard/dashboard' })
  }
})
