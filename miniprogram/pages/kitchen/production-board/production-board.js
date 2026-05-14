const app = getApp()
const cloud = require('../../../utils/cloud')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    date: dateHelper.getToday(),
    mealTypeLabels: [
      { value: 'breakfast', label: '早餐' },
      { value: 'lunch', label: '午餐' },
      { value: 'dinner', label: '晚餐' },
      { value: 'snack', label: '加餐' }
    ],
    activeMealType: 'lunch',
    assignments: [],
    stats: { pending: 0, cooking: 0, completed: 0, distributed: 0, total: 0 },
    canUpdateStatus: false
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

      const dishNameMap = {}
      dishes.forEach(d => { dishNameMap[d._id] = d.name })

      const stats = { pending: 0, cooking: 0, completed: 0, distributed: 0, total: 0 }
      assignments.forEach(a => {
        stats.total++
        const s = a.production_status || 'pending'
        if (stats[s] !== undefined) stats[s]++
        a.dishNames = (a.assigned_dish_ids || []).map(id => dishNameMap[id] || '未知').join('、')
        a.excludedNames = (a.excluded_dish_ids || []).map(id => dishNameMap[id] || '未知').join('、')
      })

      this.setData({ assignments, stats })
    } catch (err) {
      console.error('加载看板失败', err)
    }
  },

  onMealTypeChange(e) {
    this.setData({ activeMealType: e.currentTarget.dataset.type }, () => this.loadData())
  },

  async onStatusChange(e) {
    if (!this.data.canUpdateStatus) {
      wx.showToast({ title: '无操作权限', icon: 'none' })
      return
    }
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
  }
})
