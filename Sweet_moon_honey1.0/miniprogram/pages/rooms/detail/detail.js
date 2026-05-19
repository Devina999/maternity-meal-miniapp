const app = getApp()
const cloud = require('../../../utils/cloud')
const { ROOM_STATUS, ROOM_STATUS_NAME } = require('../../../utils/constants')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    room: null,
    restrictions: [],
    canEdit: false
  },

  onLoad(options) {
    const id = options.id
    if (id) this.loadRoom(id)
    this.setData({
      canEdit: app.canManageRooms(),
      canDeletePerson: app.canDeletePersonFromRoom()
    })
  },

  async loadRoom(id) {
    try {
      const room = await cloud.getRoomById(id)
      room.statusName = ROOM_STATUS_NAME[room.status] || room.status
      this.setData({ room })

      const restrictions = await cloud.getRestrictionsByRoom(id, null)
      this.setData({ restrictions })
    } catch (err) {
      console.error('加载房间失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onEdit() {
    wx.navigateTo({ url: `/pages/rooms/edit/edit?id=${this.data.room._id}` })
  },

  onToggleStatus() {
    const room = this.data.room
    const newStatus = room.status === ROOM_STATUS.CHECKED_IN ? ROOM_STATUS.TEMP_LEFT : ROOM_STATUS.CHECKED_IN

    wx.showModal({
      title: '修改状态',
      content: `确定将状态改为"${ROOM_STATUS_NAME[newStatus]}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          await cloud.updateRoom(room._id, { status: newStatus, updated_at: new Date() })
          this.loadRoom(room._id)
        }
      }
    })
  },

  onCheckOut() {
    wx.showModal({
      title: '确认退房',
      content: '退房后该房间将不再备餐，确定吗？',
      success: async (res) => {
        if (res.confirm) {
          await cloud.updateRoom(this.data.room._id, {
            status: ROOM_STATUS.CHECKED_OUT,
            updated_at: new Date()
          })
          wx.showToast({ title: '已退房', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1000)
        }
      }
    })
  },

  onClearMother() {
    const room = this.data.room
    wx.showModal({
      title: '清除住户并删除房间',
      content: `确定要清除${room.room_number}号房吗？\n\n此操作将同时：\n· 删除该房间所有忌口记录\n· 移除该房间待处理餐食分配\n· 删除该房间\n\n此操作不可撤销！`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })
          try {
            // 1. 删除房间忌口记录
            await cloud.deleteRestrictionsByRoom(room._id)
            // 2. 移除今日起的餐食分配
            await cloud.deleteAssignmentsByRoom(room._id, dateHelper.getToday())
            // 3. 删除房间
            await cloud.deleteRoom(room._id)
            wx.hideLoading()
            wx.showToast({ title: '房间已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1000)
          } catch (err) {
            wx.hideLoading()
            console.error('删除失败', err)
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  }
})
