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
      ingredientSelections: []  // [{ingredient_id, amount}]
    },
    categories: DISH_CATEGORY,
    canEdit: false
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
    this.setData({
      showForm: true,
      editId: dish._id,
      form: {
        name: dish.name,
        category: dish.category,
        ingredientSelections: (dish.ingredients || []).map(i => ({
          ingredient_id: i.ingredient_id,
          amount: i.amount
        }))
      }
    })
  },

  onNameInput(e) { this.setData({ 'form.name': e.detail.value }) },

  onCategoryChange(e) {
    this.setData({ 'form.category': this.data.categories[e.detail.value] })
  },

  onAddIngredient() {
    const selections = [...this.data.form.ingredientSelections]
    selections.push({ ingredient_id: '', amount: 1 })
    this.setData({ 'form.ingredientSelections': selections })
  },

  onIngredientChange(e) {
    const { index, field } = e.currentTarget.dataset
    const selections = [...this.data.form.ingredientSelections]
    if (field === 'id') {
      selections[index].ingredient_id = this.data.ingredients[e.detail.value]._id
    } else {
      selections[index].amount = parseInt(e.detail.value) || 0
    }
    this.setData({ 'form.ingredientSelections': selections })
  },

  onRemoveIngredient(e) {
    const idx = e.currentTarget.dataset.index
    const selections = [...this.data.form.ingredientSelections]
    selections.splice(idx, 1)
    this.setData({ 'form.ingredientSelections': selections })
  },

  getIngredientName(id) {
    const ing = this.data.ingredients.find(i => i._id === id)
    return ing ? ing.name : '未知'
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
      ingredients: this.data.form.ingredientSelections.filter(i => i.ingredient_id),
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
    this.setData({ showForm: false })
  },

  async onDeleteDish(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(d => d._id === id)
    wx.showModal({
      title: '删除菜品',
      content: `确定删除"${dish.name}"吗？`,
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
