const app = getApp()
const cloud = require('../../../utils/cloud')
const { MEAL_TYPE, MEAL_TYPE_NAME, DISH_PRODUCTION_STATUS } = require('../../../utils/constants')
const dateHelper = require('../../../utils/date-helper')

// 客户端的忌口匹配逻辑（精简版，用于份数预览）
function extractKeyword(tag) {
  const suffixes = ['过敏', '不吃', '忌', '不能吃', '不喜']
  let kw = tag
  suffixes.forEach(s => { if (kw.endsWith(s)) kw = kw.slice(0, -s.length) })
  return kw.trim()
}

function doesTagMatchIngredient(tag, ingredient) {
  const keyword = extractKeyword(tag)
  if (!keyword) return false
  const kw = keyword.toLowerCase()
  const name = (ingredient.name || '').toLowerCase()
  const cat = (ingredient.category || '').toLowerCase()
  if (name.includes(kw) || kw.includes(name)) return true
  if (cat && (kw.includes(cat) || cat.includes(kw))) return true
  const tagLower = tag.toLowerCase()
  if (name.includes(tagLower) || tagLower.includes(name)) return true
  if (cat && (tagLower.includes(cat) || cat.includes(tagLower))) return true
  return false
}

Page({
  data: {
    date: dateHelper.getToday(),
    today: dateHelper.getToday(),
    mealTypes: [
      { value: MEAL_TYPE.BREAKFAST, label: MEAL_TYPE_NAME[MEAL_TYPE.BREAKFAST] },
      { value: MEAL_TYPE.LUNCH, label: MEAL_TYPE_NAME[MEAL_TYPE.LUNCH] },
      { value: MEAL_TYPE.DINNER, label: MEAL_TYPE_NAME[MEAL_TYPE.DINNER] },
      { value: MEAL_TYPE.SNACK, label: MEAL_TYPE_NAME[MEAL_TYPE.SNACK] }
    ],
    activeMealType: MEAL_TYPE.LUNCH,
    menus: {},
    selectedDishIds: [],
    allDishes: [],
    assignments: [],
    canEdit: false,
    canEditPast: false,
    canCancelMenu: false,
    isPast: false,
    totalRooms: 0,
    portionPreview: [],  // [{dish_id, dish_name, portion, excludedRooms, reason}]
    selectedDishNames: [] // 只读模式下预计算的菜品名列表
  },

  onShow() {
    const role = app.getRole()
    const isPast = this.data.date < dateHelper.getToday()
    const canEditMenu = role === 'super_admin' || role === 'boss' || role === 'head_chef'
    this.setData({
      canEdit: canEditMenu,
      canEditPast: canEditMenu,
      canCancelMenu: role === 'super_admin' || role === 'boss' || role === 'head_chef' || role === 'nurse_manager',
      isPast
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

      const current = menuMap[this.data.activeMealType]
      const selectedDishIds = current ? (current.dish_ids || []) : []
      const dishNameMap = {}
      allDishes.forEach(d => { dishNameMap[d._id] = d.name })
      const selectedDishNames = selectedDishIds.map(id => dishNameMap[id] || '未知菜品')

      this.setData({
        menus: menuMap,
        selectedDishIds,
        selectedDishNames,
        allDishes,
        totalRooms: rooms.length
      })

      // 计算份数预览
      if (selectedDishIds.length > 0 && rooms.length > 0) {
        this.computePortionPreview(rooms, allDishes, selectedDishIds, instId)
      } else {
        this.setData({ portionPreview: [] })
      }

      this.loadAssignments()
    } catch (err) {
      console.error('加载餐单失败', err)
    }
  },

  // 客户端计算每道菜的份数预览
  async computePortionPreview(rooms, allDishes, selectedDishIds, instId) {
    try {
      const [restrictions, allIngredients] = await Promise.all([
        cloud.getRestrictionsByDate(instId, null), // 获取全部忌口
        (async () => {
          try { return await cloud.getIngredients(instId) } catch (e) { return [] }
        })()
      ])

      const ingredientMap = {}
      allIngredients.forEach(ing => { ingredientMap[ing._id] = ing })
      const dishMap = {}
      allDishes.forEach(d => { dishMap[d._id] = d })

      // 为每个在住房间构建忌口食材集合
      const roomRestricted = {}
      rooms.forEach(r => { roomRestricted[r._id] = new Set() })

      restrictions.forEach(r => {
        const set = roomRestricted[r.room_id]
        if (!set) return
        ;(r.template_tags || []).forEach(tag => {
          allIngredients.forEach(ing => {
            if (doesTagMatchIngredient(tag, ing)) set.add(ing._id)
          })
        })
      })

      // 计算每道菜的份数
      const totalRooms = rooms.length
      const dishPreview = selectedDishIds.map(did => {
        const dish = dishMap[did]
        let assigned = 0
        const excludedRooms = []
        const exclusionReasons = {}

        rooms.forEach(room => {
          const restrictedSet = roomRestricted[room._id] || new Set()
          const dishIngs = (dish && dish.ingredients) ? dish.ingredients : []
          const conflictIngs = dishIngs.filter(di => restrictedSet.has(di.ingredient_id))

          if (conflictIngs.length > 0) {
            excludedRooms.push(room.room_number)
            exclusionReasons[room.room_number] = conflictIngs
              .map(di => {
                const ing = ingredientMap[di.ingredient_id]
                return ing ? ing.name : '?'
              }).join('、')
          } else {
            assigned++
          }
        })

        return {
          dish_id: did,
          dish_name: dish ? dish.name : '未知菜品',
          portion: `${assigned}/${totalRooms}`,
          excludedRooms: excludedRooms.length > 0 ? excludedRooms.join('、') : '',
          exclusionReasons: excludedRooms.length > 0
            ? excludedRooms.map(rn => `${rn}号(${exclusionReasons[rn] || '忌口'})`).join('；')
            : ''
        }
      })

      this.setData({ portionPreview: dishPreview })
    } catch (err) {
      console.error('份数预览计算失败', err)
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
    const newDate = e.detail.value
    const isPast = newDate < dateHelper.getToday()
    const role = app.getRole()
    const canEditMenu = role === 'super_admin' || role === 'boss' || role === 'head_chef'
    this.setData({
      date: newDate,
      isPast,
      canEdit: canEditMenu,
      canEditPast: canEditMenu,
      canCancelMenu: role === 'super_admin' || role === 'boss' || role === 'head_chef' || role === 'nurse_manager'
    }, () => this.loadData())
  },

  onMealTypeChange(e) {
    const type = e.currentTarget.dataset.type
    const current = this.data.menus[type]
    const selectedDishIds = current ? (current.dish_ids || []) : []
    this.setData({ activeMealType: type, selectedDishIds })
    if (this.data.canEdit) {
      this.loadAssignments()
    } else {
      this.loadData()
    }
  },

  getCurrentMenu() {
    return this.data.menus[this.data.activeMealType] || null
  },

  getDishNameById(id) {
    const dish = this.data.allDishes.find(d => d._id === id)
    return dish ? dish.name : '未知菜品'
  },

  // 构建历史表格行数据 "早餐：...；午餐：..."
  buildHistoryRows() {
    const rows = []
    this.data.mealTypes.forEach(mt => {
      const menu = this.data.menus[mt.value]
      const dishNames = menu && menu.dish_ids
        ? menu.dish_ids.map(id => this.getDishNameById(id)).join('、')
        : '未设置'
      rows.push({ label: mt.label, dishes: dishNames })
    })
    return rows
  },

  onAddDish() {
    wx.navigateTo({ url: '/pages/menu/dish-library/dish-library' })
  },

  async onToggleDish(e) {
    if (!this.data.canEdit) return
    const dishId = e.currentTarget.dataset.id
    const current = this.getCurrentMenu()

    // 已发布的菜单不允许直接修改菜品，需先取消发布
    if (current && current.status === 'confirmed') {
      wx.showToast({ title: '请先取消发布再修改菜品', icon: 'none' })
      return
    }

    let dishIds = current ? [...current.dish_ids] : []

    const idx = dishIds.indexOf(dishId)
    if (idx > -1) {
      dishIds.splice(idx, 1)
    } else {
      dishIds.push(dishId)
    }

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

    // 当日该餐别已发布过，不允许再次发布
    if (current.status === 'confirmed') {
      wx.showToast({ title: '今日该餐别已发布过，不可再次发布', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认发布',
      content: '确认后将自动为每个房间匹配菜品（排除忌口），并同步扣减食材库存，确定吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在匹配...' })
          try {
            const dishProduction = {}
            current.dish_ids.forEach(did => {
              dishProduction[did] = {
                status: DISH_PRODUCTION_STATUS.PREPARING,
                updated_by: app.globalData.user._id,
                updated_at: new Date()
              }
            })
            await cloud.updateDailyMenu(current._id, {
              status: 'confirmed',
              confirmed_at: new Date(),
              dish_production: dishProduction,
              updated_at: new Date()
            })

            const result = await wx.cloud.callFunction({
              name: 'generateDailyAssignments',
              data: {
                institution_id: app.globalData.institutionId,
                date: this.data.date,
                meal_type: this.data.activeMealType
              }
            })

            wx.hideLoading()

            if (result.result && result.result.success) {
              const r = result.result
              // 保存库存扣减记录到菜单，供取消发布时恢复
              if (r.stockChanges && r.stockChanges.length > 0) {
                await cloud.updateDailyMenu(current._id, {
                  stock_changes: r.stockChanges,
                  updated_at: new Date()
                })
              }
              let msg = `发布成功! ${r.totalRooms}间房已匹配`
              if (r.stockChanges && r.stockChanges.length > 0) {
                const alerts = r.stockChanges.filter(s => s.alert)
                if (alerts.length > 0) {
                  msg += `\n⚠️ ${alerts.length}种食材库存不足预警`
                }
              }
              wx.showToast({ title: msg, icon: 'success', duration: 3000 })
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
  },

  onCancelMenu() {
    const current = this.getCurrentMenu()
    if (!current || current.status !== 'confirmed') return

    wx.showModal({
      title: '取消发布',
      content: '取消发布后，食材库存将恢复，所有房间分配将被删除，制作进度将被清除。确定要继续吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' })
          try {
            const user = app.globalData.user
            const result = await wx.cloud.callFunction({
              name: 'cancelMenuPublish',
              data: {
                institution_id: app.globalData.institutionId,
                date: this.data.date,
                meal_type: this.data.activeMealType,
                user_id: user._id,
                user_name: user.name || '',
                user_role: user.role
              }
            })

            wx.hideLoading()

            if (result.result && result.result.success) {
              wx.showToast({ title: '已取消发布，库存已恢复', icon: 'success' })
            } else {
              wx.showToast({ title: result.result.message || '取消失败', icon: 'none' })
            }
            this.loadData()
            this.loadAssignments()
          } catch (err) {
            wx.hideLoading()
            console.error('取消发布失败', err)
            wx.showToast({ title: '取消失败: ' + (err.message || '未知错误'), icon: 'none' })
          }
        }
      }
    })
  }
})
