const app = getApp()
const cloud = require('../../../utils/cloud')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    rooms: [],
    selectedRoomId: '',
    mealTypes: [
      { value: 'breakfast', label: '早餐' },
      { value: 'lunch', label: '午餐' },
      { value: 'dinner', label: '晚餐' },
      { value: 'snack', label: '加餐' }
    ],
    selectedMealType: 'lunch',
    rating: 0,
    feedbackText: '',
    submitting: false
  },

  onShow() {
    this.loadRooms()
  },

  async loadRooms() {
    try {
      const instId = app.globalData.institutionId
      const rooms = await cloud.getRooms(instId, 'checked_in')
      this.setData({ rooms })
    } catch (err) {
      console.error('加载房间失败', err)
    }
  },

  onRoomChange(e) {
    this.setData({ selectedRoomId: this.data.rooms[e.detail.value]._id })
  },

  onMealTypeChange(e) {
    this.setData({ selectedMealType: e.currentTarget.dataset.type })
  },

  onRating(e) {
    this.setData({ rating: parseInt(e.currentTarget.dataset.star) })
  },

  onTextInput(e) {
    this.setData({ feedbackText: e.detail.value })
  },

  async onSubmit() {
    if (!this.data.selectedRoomId) {
      wx.showToast({ title: '请选择房间', icon: 'none' })
      return
    }
    if (this.data.rating === 0) {
      wx.showToast({ title: '请评分', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    const room = this.data.rooms.find(r => r._id === this.data.selectedRoomId)

    try {
      await cloud.createFeedback({
        room_id: this.data.selectedRoomId,
        room_number: room ? room.room_number : '',
        institution_id: app.globalData.institutionId,
        date: dateHelper.getToday(),
        meal_type: this.data.selectedMealType,
        rating: this.data.rating,
        feedback_text: this.data.feedbackText,
        kitchen_acknowledged: false,
        created_at: new Date()
      })

      wx.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => {
        this.setData({
          rating: 0,
          feedbackText: '',
          submitting: false
        })
      }, 1000)
    } catch (err) {
      console.error('提交反馈失败', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  }
})
