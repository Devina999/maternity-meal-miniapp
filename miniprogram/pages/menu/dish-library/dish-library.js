const app = getApp()
const cloud = require('../../../utils/cloud')
const { DISH_CATEGORY } = require('../../../utils/constants')

Page({
  data: {
    dishes: [],
    ingredients: [],
    showForm: false,
    editId: null,
    form: {
      name: '', category: '主菜',
      ingredientSelections: []  // [{ingredient_id, name, amount}]
    },
    categories: DISH_CATEGORY,
    canEdit: false,
    showIngredientPicker: false,
    showNewIngredientForm: false,
    newIngredient: { name: '', category: '蔬菜', unit: '克', stock: 100 }
  },

  onShow() {
    this.setData({ canEdit: app.canEditMenu() })
    this.loadData()
  },

  async loadData() {
    const instId = app.globalData.institutionId
    const [dishes, ingredients] = await Promise.all([
      cloud.getDishes(instId),
      cloud.getIngredients(instId)
    ])

    // 将食材名称注入到菜品数据中
    const ingNameMap = {}
    ingredients.forEach(ing => { ingNameMap[ing._id] = ing.name })
    dishes.forEach(dish => {
      if (dish.ingredients) {
        dish.ingredients.forEach(ing => {
          ing.name = ingNameMap[ing.ingredient_id] || '未知'
        })
      }
    })

    this.setData({ dishes, ingredients })
  },

  onShowForm() {
    this.setData({
      showForm: true,
      editId: null,
      form: { name: '', category: '主菜', ingredientSelections: [] }
    })
  },

  onEditDish(e) {
    const dish = this.data.dishes.find(d => d._id === e.currentTarget.dataset.id)
    if (!dish) return
    const selections = (dish.ingredients || []).map(i => {
      const ing = this.data.ingredients.find(g => g._id === i.ingredient_id)
      return {
        ingredient_id: i.ingredient_id,
        name: ing ? ing.name : '未知食材',
        amount: i.amount
      }
    })
    this.setData({
      showForm: true,
      editId: dish._id,
      form: {
        name: dish.name,
        category: dish.category,
        ingredientSelections: selections
      }
    })
  },

  onNameInput(e) { this.setData({ 'form.name': e.detail.value }) },

  onCategoryChange(e) {
    this.setData({ 'form.category': this.data.categories[e.detail.value] })
  },

  // 新的食材选择方式：弹出一个列表让用户点选
  onShowIngredientPicker() {
    this.setData({ showIngredientPicker: true })
  },

  onHideIngredientPicker() {
    this.setData({ showIngredientPicker: false })
  },

  onSelectIngredient(e) {
    const ingId = e.currentTarget.dataset.id
    const ingName = e.currentTarget.dataset.name
    const selections = [...this.data.form.ingredientSelections]
    // 避免重复添加
    if (selections.find(s => s.ingredient_id === ingId)) {
      wx.showToast({ title: '已添加该食材', icon: 'none' })
      return
    }
    selections.push({ ingredient_id: ingId, name: ingName, amount: 1 })
    this.setData({
      'form.ingredientSelections': selections,
      showIngredientPicker: false
    })
  },

  onAmountChange(e) {
    const idx = parseInt(e.currentTarget.dataset.index)
    const val = parseInt(e.detail.value) || 0
    this.setData({ [`form.ingredientSelections[${idx}].amount`]: val })
  },

  onRemoveIngredient(e) {
    const idx = parseInt(e.currentTarget.dataset.index)
    const selections = [...this.data.form.ingredientSelections]
    selections.splice(idx, 1)
    this.setData({ 'form.ingredientSelections': selections })
  },

  // 在食材选择器中点击"添加新食材"
  onShowNewIngredientForm() {
    this.setData({
      showIngredientPicker: false,
      showNewIngredientForm: true,
      newIngredient: { name: '', category: '蔬菜', unit: '克', stock: 100 }
    })
  },

  onHideNewIngredientForm() {
    this.setData({ showNewIngredientForm: false, showIngredientPicker: true })
  },

  onNewIngredientInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`newIngredient.${field}`]: e.detail.value })
  },

  onNewIngredientCategoryChange(e) {
    const cats = ['肉类', '蔬菜', '海鲜', '蛋奶', '调味料', '主食', '豆制品', '菌菇', '水果', '其他']
    this.setData({ 'newIngredient.category': cats[e.detail.value] })
  },

  async onSubmitNewIngredient() {
    const ing = this.data.newIngredient
    if (!ing.name.trim()) {
      wx.showToast({ title: '请输入食材名称', icon: 'none' })
      return
    }
    const data = {
      name: ing.name.trim(),
      category: ing.category,
      unit: ing.unit,
      stock: parseInt(ing.stock) || 100,
      stock_alert_threshold: 50,
      institution_id: app.globalData.institutionId,
      created_at: new Date(),
      updated_at: new Date()
    }
    try {
      const res = await cloud.createIngredient(data)
      const newId = res._id
      // 自动添加到已选食材
      const selections = [...this.data.form.ingredientSelections]
      selections.push({ ingredient_id: newId, name: data.name, amount: 1 })
      this.setData({
        'form.ingredientSelections': selections,
        showNewIngredientForm: false
      })
      // 刷新食材列表
      const ingredients = await cloud.getIngredients(app.globalData.institutionId)
      this.setData({ ingredients })
      wx.showToast({ title: '食材已添加', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '添加食材失败', icon: 'none' })
    }
  },

  async onSubmit() {
    if (!this.data.form.name.trim()) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    const data = {
      institution_id: app.globalData.institutionId,
      name: this.data.form.name.trim(),
      category: this.data.form.category,
      ingredients: this.data.form.ingredientSelections
        .filter(i => i.ingredient_id)
        .map(i => ({ ingredient_id: i.ingredient_id, amount: i.amount })),
      is_active: true,
      updated_at: new Date()
    }

    try {
      if (this.data.editId) {
        await cloud.updateDish(this.data.editId, data)
      } else {
        data.created_by = app.globalData.user._id
        data.created_at = new Date()
        await cloud.createDish(data)
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.setData({ showForm: false })
      this.loadData()
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  onCancel() {
    this.setData({ showForm: false, showIngredientPicker: false })
  },

  async onDeleteDish(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(d => d._id === id)
    wx.showModal({
      title: '删除菜品',
      content: `确定删除"${dish ? dish.name : ''}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          await cloud.updateDish(id, { is_active: false, updated_at: new Date() })
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadData()
        }
      }
    })
  }
})
