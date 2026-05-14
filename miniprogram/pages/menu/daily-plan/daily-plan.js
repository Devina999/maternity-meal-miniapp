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
    selectedDishIds: [],  // 当前餐别已选菜品ID（用于高亮）
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

      // 计算当前餐别已选菜品
      const current = menuMap[this.data.activeMealType]
      const selectedDishIds = current ? (current.dish_ids || []) : []

      this.setData({
        menus: menuMap,
        selectedDishIds: selectedDishIds,
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
      console.log('加载分配结果:', assignments.length, '条')
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
    // 同时更新 selectedDishIds
    const current = this.data.menus[type]
    const selectedDishIds = current ? (current.dish_ids || []) : []
    this.setData({ activeMealType: type, selectedDishIds })
    if (this.data.canEdit) {
      this.loadAssignments()
    }
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
    if (!this.data.canEdit) return
    const dishId = e.currentTarget.dataset.id
    const current = this.getCurrentMenu()
    let dishIds = current ? [...current.dish_ids] : []

    const idx = dishIds.indexOf(dishId)
    if (idx > -1) {
      dishIds.splice(idx, 1)
    } else {
      dishIds.push(dishId)
    }

    // 先更新UI（乐观更新），再保存数据库
    this.setData({ selectedDishIds: dishIds })

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
      // 静默更新菜单map
      const menus = { ...this.data.menus }
      menus[this.data.activeMealType] = { ...(menus[this.data.activeMealType] || {}), dish_ids: dishIds, _id: current ? current._id : undefined }
      // 重新加载确保同步
      this.loadData()
    } catch (err) {
      console.error('更新餐单失败', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
      this.loadData()
    }
  },

  async onConfirmMenu() {
    const current = this.getCurrentMenu()
    if (!current || !current.dish_ids || current.dish_ids.length === 0) {
      wx.showToast({ title: '请先选择菜品', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认发布',
      content: '确认后将自动为每个房间匹配菜品（排除忌口），确定吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在匹配...' })
          try {
            // 先更新餐单状态
            await cloud.updateDailyMenu(current._id, { status: 'confirmed', updated_at: new Date() })

            // 调用匹配引擎
            const result = await wx.cloud.callFunction({
              name: 'generateDailyAssignments',
              data: {
                institution_id: app.globalData.institutionId,
                date: this.data.date,
                meal_type: this.data.activeMealType
              }
            })

            wx.hideLoading()
            console.log('匹配结果:', result)

            if (result.result && result.result.success) {
              wx.showToast({ title: `发布成功! ${result.result.totalRooms}间房已匹配`, icon: 'success' })
            } else {
              wx.showToast({ title: '发布成功，但匹配过程有问题', icon: 'none' })
            }
            this.loadData()
            this.loadAssignments()
          } catch (err) {
            wx.hideLoading()
            console.error('匹配失败', err)
            wx.showToast({ title: '匹配失败: ' + (err.message || '未知错误'), icon: 'none' })
          }
        }
      }
    })
  }
})
