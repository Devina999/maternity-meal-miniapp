const app = getApp()
const cloud = require('../../../utils/cloud')
const { ROLE_NAME } = require('../../../utils/constants')
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
      canRespond: true
    })
    this.loadData()
  },

  async loadData() {
    try {
      const instId = app.globalData.institutionId
      const [feedbacks, rooms] = await Promise.all([
        cloud.getFeedback(instId, this.data.date || null),
        cloud.getRooms(instId)
      ])
      const roomMap = {}
      rooms.forEach(r => { roomMap[r._id] = r.room_number })
      feedbacks.forEach(f => {
        if (!f.room_number && f.room_id) {
          f.room_number = roomMap[f.room_id] || ''
        }
      })
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
          const user = app.globalData.user
          await cloud.updateFeedback(id, {
            kitchen_response: res.content,
            kitchen_acknowledged: true,
            kitchen_responded_by: user._id,
            kitchen_responded_role: ROLE_NAME[user.role] || user.role,
            kitchen_responded_at: new Date()
          })
          wx.showToast({ title: '已回复', icon: 'success' })
          that.loadData()
        }
      }
    })
  }
})
