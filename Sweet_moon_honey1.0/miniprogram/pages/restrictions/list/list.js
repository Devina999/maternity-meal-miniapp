const app = getApp()
const cloud = require('../../../utils/cloud')

Page({
  data: {
    rooms: [],
    restrictionsByRoom: {},
    canEdit: false,
    isNurse: false
  },

  onShow() {
    const role = app.getRole()
    this.setData({
      canEdit: role === 'super_admin' || role === 'nurse_manager' || role === 'boss' || role === 'receptionist',
      isNurse: role === 'nurse'
    })
    this.loadData()
  },

  async loadData() {
    try {
      const instId = app.globalData.institutionId
      const rooms = await cloud.getRooms(instId, 'checked_in')
      // 获取全部忌口（不限日期）
      const restrictions = await cloud.getRestrictionsByDate(instId, null)

      // 每个房间只保留最新一条忌口，包装为数组（WXML 遍历用）
      const map = {}
      restrictions.forEach(r => {
        if (!map[r.room_id]) {
          map[r.room_id] = [r]
        }
      })

      this.setData({ rooms, restrictionsByRoom: map })
    } catch (err) {
      console.error('加载忌口数据失败', err)
    }
  },

  onAddRestriction(e) {
    const roomId = e.currentTarget.dataset.roomId
    wx.navigateTo({ url: `/pages/restrictions/edit/edit?roomId=${roomId}` })
  },

  onEditRestriction(e) {
    if (!this.data.canEdit) return
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/restrictions/edit/edit?id=${id}` })
  },

  getRestrictionsForRoom(roomId) {
    const r = this.data.restrictionsByRoom[roomId]
    return r ? [r] : []
  }
})
