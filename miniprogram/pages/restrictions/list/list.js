const app = getApp()
const cloud = require('../../../utils/cloud')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    date: dateHelper.getToday(),
    rooms: [],
    restrictionsByRoom: {},
    canEdit: false,
    isNurse: false
  },

  onShow() {
    const role = app.getRole()
    this.setData({
      canEdit: role === 'super_admin' || role === 'nurse' || role === 'nurse_manager',
      isNurse: role === 'nurse'
    })
    this.loadData()
  },

  async loadData() {
    try {
      const instId = app.globalData.institutionId
      const rooms = await cloud.getRooms(instId, 'checked_in')
      const restrictions = await cloud.getRestrictionsByDate(instId, this.data.date)

      const map = {}
      restrictions.forEach(r => {
        if (!map[r.room_id]) map[r.room_id] = []
        map[r.room_id].push(r)
      })

      this.setData({ rooms, restrictionsByRoom: map })
    } catch (err) {
      console.error('加载忌口数据失败', err)
    }
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value }, () => this.loadData())
  },

  onPrevDay() {
    const d = dateHelper.addDays(this.data.date, -1)
    this.setData({ date: d }, () => this.loadData())
  },

  onNextDay() {
    const d = dateHelper.addDays(this.data.date, 1)
    this.setData({ date: d }, () => this.loadData())
  },

  onAddRestriction(e) {
    const roomId = e.currentTarget.dataset.roomId
    wx.navigateTo({ url: `/pages/restrictions/edit/edit?roomId=${roomId}&date=${this.data.date}` })
  },

  onEditRestriction(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/restrictions/edit/edit?id=${id}&date=${this.data.date}` })
  },

  getRestrictionsForRoom(roomId) {
    return this.data.restrictionsByRoom[roomId] || []
  }
})
