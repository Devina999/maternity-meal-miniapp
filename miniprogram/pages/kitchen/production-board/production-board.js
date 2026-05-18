const app = getApp()
const cloud = require('../../../utils/cloud')
const { DISH_PRODUCTION_STATUS } = require('../../../utils/constants')
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
    menu: null,
    dishes: [],
    stats: { preparing: 0, completed: 0, served: 0, total: 0 },
    canUpdateToCompleted: false,
    canUpdateToServed: false,
    canUndo: false
  },

  onShow() {
    const role = app.getRole()
    this.setData({
      canUpdateToCompleted: role === 'super_admin' || role === 'head_chef' || role === 'cook' || role === 'boss' || role === 'nurse_manager',
      canUpdateToServed: role === 'super_admin' || role === 'nurse_manager' || role === 'boss' || role === 'head_chef',
      canUndo: role === 'super_admin' || role === 'boss' || role === 'head_chef'
    })
    this.loadData()
  },

  async loadData() {
    try {
      const instId = app.globalData.institutionId
      const mealType = this.data.activeMealType
      const [menus, allDishes] = await Promise.all([
        cloud.getDailyMenus(instId, this.data.date),
        cloud.getDishes(instId)
      ])

      const dishNameMap = {}
      allDishes.forEach(d => { dishNameMap[d._id] = d.name })

      const menu = menus.find(m => m.meal_type === mealType) || null

      if (!menu || menu.status !== 'confirmed' || !menu.dish_ids || menu.dish_ids.length === 0) {
        this.setData({ menu: null, dishes: [], stats: { preparing: 0, completed: 0, served: 0, total: 0 } })
        return
      }

      const progressMap = {
        [DISH_PRODUCTION_STATUS.PREPARING]: 33,
        [DISH_PRODUCTION_STATUS.COMPLETED]: 66,
        [DISH_PRODUCTION_STATUS.SERVED]: 100
      }
      const production = menu.dish_production || {}
      const dishes = menu.dish_ids.map(did => {
        const prod = production[did]
        const status = prod ? prod.status : DISH_PRODUCTION_STATUS.PREPARING
        return {
          dish_id: did,
          dish_name: dishNameMap[did] || '未知菜品',
          status,
          progress: progressMap[status] || 0,
          updated_by: prod ? prod.updated_by : null,
          updated_at: prod ? prod.updated_at : null
        }
      })

      const stats = { preparing: 0, completed: 0, served: 0, total: dishes.length }
      dishes.forEach(d => {
        if (stats[d.status] !== undefined) stats[d.status]++
      })

      this.setData({ menu, dishes, stats })
    } catch (err) {
      console.error('加载备餐看板失败', err)
    }
  },

  onMealTypeChange(e) {
    this.setData({ activeMealType: e.currentTarget.dataset.type }, () => this.loadData())
  },

  async onStatusChange(e) {
    const { dishId, status } = e.currentTarget.dataset
    const menuId = this.data.menu._id

    try {
      await cloud.updateDishProduction(menuId, dishId, status, app.globalData.user._id)
      wx.showToast({ title: '状态已更新', icon: 'success' })
      this.loadData()
    } catch (err) {
      console.error('更新制作状态失败', err)
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  }
})
