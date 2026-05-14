const app = getApp()
const cloud = require('../../utils/cloud')
const { ROLE_NAME } = require('../../utils/constants')

Page({
  data: {
    loading: false,
    showInviteInput: false,
    inviteCode: '',
    needRegister: false,
    openid: ''
  },

  onLoad() {
    if (app.globalData.isLoggedIn) {
      this.navigateToDashboard()
    }
  },

  handleLogin() {
    const that = this
    this.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getOpenId',
      success(res) {
        const openid = res.result.openid
        that.setData({ openid })
        that.checkUser(openid)
      },
      fail(err) {
        console.error('获取openid失败', err)
        that.setData({ loading: false })
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      }
    })
  },

  async checkUser(openid) {
    try {
      const user = await cloud.getUserByOpenId(openid)
      if (user) {
        if (!user.is_active) {
          wx.showToast({ title: '账号已被禁用', icon: 'none' })
          this.setData({ loading: false })
          return
        }
        app.setUser(user)
        this.navigateToDashboard()
      } else {
        this.setData({ showInviteInput: true, needRegister: true, loading: false })
      }
    } catch (err) {
      console.error('查询用户失败', err)
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

    try {
      const res = await wx.cloud.callFunction({
        name: 'registerUser',
        data: { inviteCode: code }
      })

      if (res.result.success) {
        const user = res.result.user
        app.setUser(user)
        wx.showToast({ title: '注册成功', icon: 'success' })
        setTimeout(() => this.navigateToDashboard(), 500)
      } else {
        wx.showToast({ title: res.result.message || '注册失败', icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('注册失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '注册失败，请重试', icon: 'none' })
    }
  },

  navigateToDashboard() {
    wx.reLaunch({ url: '/pages/dashboard/dashboard' })
  }
})
