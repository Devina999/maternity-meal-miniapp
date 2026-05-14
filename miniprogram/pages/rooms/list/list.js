const app = getApp()
const cloud = require('../../../utils/cloud')
const { ROOM_STATUS, ROOM_STATUS_NAME } = require('../../../utils/constants')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    rooms: [],
    statusFilter: '',
    statusTabs: [
      { value: '', label: '全部' },
      { value: ROOM_STATUS.CHECKED_IN, label: '在住' },
      { value: ROOM_STATUS.TEMP_LEFT, label: '临时离店' },
      { value: ROOM_STATUS.CHECKED_OUT, label: '已退房' }
    ],
    activeTab: 0,
    today: dateHelper.getToday()
  },

  onShow() {
    this.setData({ canManageRooms: app.canManageRooms() })
    this.loadRooms()
  },

  async loadRooms() {
    try {
      const instId = app.globalData.institutionId
      const status = this.data.statusFilter || null
      let rooms = await cloud.getRooms(instId, status)
      rooms = rooms.map(r => ({
        ...r,
        statusName: ROOM_STATUS_NAME[r.status] || r.status
      }))
      this.setData({ rooms })
    } catch (err) {
      console.error('加载房间失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index
    const tab = this.data.statusTabs[index]
    this.setData({ activeTab: index, statusFilter: tab.value }, () => {
      this.loadRooms()
    })
  },

  onAddRoom() {
    wx.navigateTo({ url: '/pages/rooms/edit/edit' })
  },

  onRoomTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/rooms/detail/detail?id=${id}` })
  },

  getStatusClass(status) {
    const map = {
      checked_in: 'tag-green',
      temp_left: 'tag-orange',
      checked_out: 'tag-gray'
    }
    return map[status] || 'tag-gray'
  }
})
