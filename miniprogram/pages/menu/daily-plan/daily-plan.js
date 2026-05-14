const app = getApp()
const cloud = require('../../../utils/cloud')
const { MEAL_TYPE, MEAL_TYPE_NAME } = require('../../../utils/constants')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    date: dateHelper.getTomorrow(),
    today: dateHelper.getToday(),
    mealTypes: [
      { value: MEAL_TYPE.BREAKFAST, label: MEAL_TYPE_NAME[MEAL_TYPE.BREAKFAST] },
      { value: MEAL_TYPE.LUNCH, label: MEAL_TYPE_NAME[MEAL_TYPE.LUNCH] },
      { value: MEAL_TYPE.DINNER, label: MEAL_TYPE_NAME[MEAL_TYPE.DINNER] },
      { value: MEAL_TYPE.SNACK, label: MEAL_TYPE_NAME[MEAL_TYPE.SNACK] }
    ],
    activeMealType: MEAL_TYPE.LUNCH,
    menus: {},
    allDishes: [],
    assignments: [],
    canEdit: false,
    totalRooms: 0
  },

  onShow() {
    const role = app.getRole()
    this.setData({
      canEdit: role === 'super_admin' || role === 'head_chef'
    })
    this.loadData()
  },

  async loadData() {
    try {
      const instId = app.globalData.institutionId
      const [menus, allDishes, rooms] = await Promise.all([
        cloud.getDailyMenus(instId, this.data.date),
        cloud.getDishes(instId),
        cloud.getRooms(instId, 'checked_in')
      ])

      const menuMap = {}
      menus.forEach(m => { menuMap[m.meal_type] = m })

      this.setData({
        menus: menuMap,
        allDishes,
        totalRooms: rooms.length
      })

      if (this.data.canEdit) {
        this.loadAssignments()
      }
    } catch (err) {
      console.error('加载餐单失败', err)
    }
  },

  async loadAssignments() {
    try {
      const instId = app.globalData.institutionId
      const assignments = await cloud.getRoomAssignments(instId, this.data.date, this.data.activeMealType)
      this.setData({ assignments })
    } catch (err) {
      console.error('加载分配失败', err)
    }
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value }, () => this.loadData())
  },

  onMealTypeChange(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ activeMealType: type })
    if (this.data.canEdit) this.loadAssignments()
  },

  getCurrentMenu() {
    return this.data.menus[this.data.activeMealType] || null
  },

  getDishNameById(id) {
    const dish = this.data.allDishes.find(d => d._id === id)
    return dish ? dish.name : '未知菜品'
  },

  onAddDish() {
    wx.navigateTo({ url: '/pages/menu/dish-library/dish-library' })
  },

  async onToggleDish(e) {
    const dishId = e.currentTarget.dataset.id
    const current = this.getCurrentMenu()
    let dishIds = current ? [...current.dish_ids] : []

    const idx = dishIds.indexOf(dishId)
    if (idx > -1) {
      dishIds.splice(idx, 1)
    } else {
      dishIds.push(dishId)
    }

    const data = {
      institution_id: app.globalData.institutionId,
      date: this.data.date,
      meal_type: this.data.activeMealType,
      dish_ids: dishIds,
      status: 'draft',
      updated_at: new Date()
    }

    try {
      if (current) {
        await cloud.updateDailyMenu(current._id, data)
      } else {
        data.created_by = app.globalData.user._id
        data.created_at = new Date()
        await cloud.createDailyMenu(data)
      }
      this.loadData()
    } catch (err) {
      console.error('更新餐单失败', err)
    }
  },

  async onConfirmMenu() {
    const current = this.getCurrentMenu()
    if (!current || current.dish_ids.length === 0) {
      wx.showToast({ title: '请先选择菜品', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认发布',
      content: '确认后将自动为每个房间匹配菜品（排除忌口），确定吗？',
      success: async (res) => {
        if (res.confirm) {
          await cloud.updateDailyMenu(current._id, { status: 'confirmed', updated_at: new Date() })

          wx.showLoading({ title: '正在匹配...' })
          try {
            await wx.cloud.callFunction({
              name: 'generateDailyAssignments',
              data: {
                institution_id: app.globalData.institutionId,
                date: this.data.date,
                meal_type: this.data.activeMealType
              }
            })
            wx.hideLoading()
            wx.showToast({ title: '发布成功', icon: 'success' })
            this.loadData()
            this.loadAssignments()
          } catch (err) {
            wx.hideLoading()
            console.error('匹配失败', err)
            wx.showToast({ title: '匹配失败', icon: 'none' })
          }
        }
      }
    })
  },

  getDishStatus(dishId) {
    const current = this.getCurrentMenu()
    if (!current) return false
    return current.dish_ids.includes(dishId)
  }
})
