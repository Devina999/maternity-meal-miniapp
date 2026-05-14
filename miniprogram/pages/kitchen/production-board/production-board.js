const app = getApp()
const cloud = require('../../../utils/cloud')
const { PRODUCTION_STATUS, PRODUCTION_STATUS_NAME, MEAL_TYPE_NAME } = require('../../../utils/constants')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    date: dateHelper.getToday(),
    mealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
    activeMealType: 'lunch',
    assignments: [],
    dishes: [],
    canUpdateStatus: false,
    statusColors: {
      pending: '#95A5A6',
      cooking: '#E67E22',
      completed: '#27AE60',
      distributed: '#4A90D9'
    }
  },

  onShow() {
    const role = app.getRole()
    this.setData({
      canUpdateStatus: role === 'super_admin' || role === 'head_chef' || role === 'cook'
    })
    this.loadData()
  },

  async loadData() {
    try {
      const instId = app.globalData.institutionId
      const [assignments, dishes] = await Promise.all([
        cloud.getRoomAssignments(instId, this.data.date, this.data.activeMealType),
        cloud.getDishes(instId)
      ])
      this.setData({ assignments, dishes })
    } catch (err) {
      console.error('加载看板失败', err)
    }
  },

  onMealTypeChange(e) {
    this.setData({ activeMealType: e.currentTarget.dataset.type }, () => this.loadData())
  },

  getDishNameById(id) {
    const dish = this.data.dishes.find(d => d._id === id)
    return dish ? dish.name : '未知'
  },

  async onStatusChange(e) {
    if (!this.data.canUpdateStatus) return
    const { id, status } = e.currentTarget.dataset
    try {
      await cloud.updateAssignment(id, {
        production_status: status,
        production_updated_by: app.globalData.user._id,
        production_updated_at: new Date()
      })
      this.loadData()
    } catch (err) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  getNextStatus(current) {
    const order = ['pending', 'cooking', 'completed', 'distributed']
    const idx = order.indexOf(current)
    if (idx < order.length - 1) return order[idx + 1]
    return null
  },

  getStats() {
    const stats = { pending: 0, cooking: 0, completed: 0, distributed: 0, total: 0 }
    this.data.assignments.forEach(a => {
      stats.total++
      if (stats[a.production_status] !== undefined) stats[a.production_status]++
    })
    return stats
  }
})
