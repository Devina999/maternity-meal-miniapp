const app = getApp()
const cloud = require('../../../utils/cloud')
const { DEFAULT_CUTOFF_TIME } = require('../../../utils/constants')

Page({
  data: {
    cutoffTime: DEFAULT_CUTOFF_TIME,
    cutoffEnforced: true
  },

  onShow() {
    if (app.getRole() !== 'super_admin') {
      wx.showToast({ title: '仅超级管理员可访问', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }
    this.loadSettings()
  },

  async loadSettings() {
    try {
      const settings = await cloud.getMealCutoffSettings(app.globalData.institutionId)
      this.setData({
        cutoffTime: settings.cutoff_time || DEFAULT_CUTOFF_TIME,
        cutoffEnforced: settings.cutoff_enforced !== false
      })
    } catch (err) {
      console.error('加载设置失败', err)
    }
  },

  onCutoffTimeChange(e) {
    this.setData({ cutoffTime: e.detail.value })
  },

  onCutoffEnforcedChange(e) {
    this.setData({ cutoffEnforced: e.detail.value })
  },

  async onSave() {
    try {
      await cloud.updateMealCutoffSettings(app.globalData.institutionId, {
        cutoff_time: this.data.cutoffTime,
        cutoff_enforced: this.data.cutoffEnforced,
        updated_at: new Date()
      })
      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
