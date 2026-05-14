const app = getApp()
const cloud = require('../../../utils/cloud')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    date: '',
    feedbacks: [],
    canRespond: false
  },

  onShow() {
    const role = app.getRole()
    this.setData({
      canRespond: role === 'super_admin' || role === 'head_chef' || role === 'nurse_manager'
    })
    this.loadData()
  },

  async loadData() {
    try {
      const instId = app.globalData.institutionId
      const feedbacks = await cloud.getFeedback(instId, this.data.date || null)
      this.setData({ feedbacks })
    } catch (err) {
      console.error('加载反馈失败', err)
    }
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value }, () => this.loadData())
  },

  async onRespond(e) {
    const id = e.currentTarget.dataset.id
    const that = this
    wx.showModal({
      title: '回复反馈',
      editable: true,
      placeholderText: '输入处理备注...',
      success: async (res) => {
        if (res.confirm && res.content) {
          await cloud.updateFeedback(id, {
            kitchen_response: res.content,
            kitchen_acknowledged: true,
            kitchen_responded_by: app.globalData.user._id,
            kitchen_responded_at: new Date()
          })
          wx.showToast({ title: '已回复', icon: 'success' })
          that.loadData()
        }
      }
    })
  }
})
