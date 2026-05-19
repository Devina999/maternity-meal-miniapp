const app = getApp()
const cloud = require('../../../utils/cloud')
const { INGREDIENT_CATEGORY } = require('../../../utils/constants')

Page({
  data: {
    ingredients: [],
    categories: INGREDIENT_CATEGORY,
    showForm: false,
    editId: null,
    form: { name: '', category: '蔬菜', unit: '克', stock: 0, stock_alert_threshold: 100 },
    canEdit: false
  },

  onShow() {
    this.setData({ canEdit: app.canEditMenu() })
    this.loadData()
  },

  async loadData() {
    const instId = app.globalData.institutionId
    const ingredients = await cloud.getIngredients(instId)
    this.setData({ ingredients })
  },

  onShowForm() {
    this.setData({ showForm: true, editId: null, form: { name: '', category: '蔬菜', unit: '克', stock: 0, stock_alert_threshold: 100 } })
  },

  onCancel() {
    this.setData({ showForm: false })
  },

  onEdit(e) {
    const ing = this.data.ingredients.find(i => i._id === e.currentTarget.dataset.id)
    if (!ing) return
    this.setData({
      showForm: true, editId: ing._id,
      form: { name: ing.name, category: ing.category, unit: ing.unit, stock: ing.stock, stock_alert_threshold: ing.stock_alert_threshold }
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onCategoryChange(e) {
    this.setData({ 'form.category': this.data.categories[e.detail.value] })
  },

  async onSubmit() {
    if (!this.data.form.name.trim()) {
      wx.showToast({ title: '请输入食材名称', icon: 'none' })
      return
    }
    const data = {
      ...this.data.form,
      name: this.data.form.name.trim(),
      stock: parseInt(this.data.form.stock) || 0,
      stock_alert_threshold: parseInt(this.data.form.stock_alert_threshold) || 100,
      institution_id: app.globalData.institutionId,
      updated_at: new Date()
    }
    try {
      if (this.data.editId) {
        await cloud.updateIngredient(this.data.editId, data)
      } else {
        data.created_at = new Date()
        await cloud.createIngredient(data)
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.setData({ showForm: false })
      this.loadData()
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除食材', content: '确定删除吗？',
      success: async (res) => {
        if (res.confirm) {
          await cloud.deleteIngredient(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadData()
        }
      }
    })
  }
})
