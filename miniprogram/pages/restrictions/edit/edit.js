const app = getApp()
const cloud = require('../../../utils/cloud')
const { RESTRICTION_TAGS } = require('../../../utils/constants')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    isEdit: false, id: null,
    roomId: '', date: '',
    predefinedTags: RESTRICTION_TAGS,
    customTagLib: [],
    allTags: RESTRICTION_TAGS,
    filteredTags: RESTRICTION_TAGS,
    selectedTags: [],
    customNotes: '',
    cookingNotes: '',
    roomInfo: null,
    tagSearch: '',
    autoMatchedTags: [],
    customTagInput: ''
  },

  onLoad(options) {
    const date = options.date || dateHelper.getToday()
    this.setData({ date })
    this.loadCustomTags()

    if (options.id) {
      this.setData({ isEdit: true, id: options.id })
      this.loadRestriction(options.id)
    } else if (options.roomId) {
      this.setData({ roomId: options.roomId })
      this.loadRoomInfo(options.roomId)
    }
  },

  async loadCustomTags() {
    try {
      const instId = app.globalData.institutionId
      if (!instId) return
      const customTags = await cloud.getCustomTags(instId)
      const all = [...this.data.predefinedTags, ...customTags]
      this.setData({ customTagLib: customTags, allTags: all, filteredTags: all })
    } catch (err) {
      console.error('加载自定义标签失败', err)
    }
  },

  async loadRoomInfo(roomId) {
    try {
      const room = await cloud.getRoomById(roomId)
      this.setData({ roomInfo: room })
    } catch (err) { console.error(err) }
  },

  async loadRestriction(id) {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('dietary_restrictions').doc(id).get()
      const d = res.data
      this.setData({
        roomId: d.room_id,
        selectedTags: d.template_tags || [],
        customNotes: d.custom_notes || '',
        cookingNotes: d.cooking_notes || ''
      }, () => this.autoMatchFromText())
      this.loadRoomInfo(d.room_id)
    } catch (err) { console.error(err) }
  },

  onTagSearchInput(e) {
    const kw = e.detail.value.trim()
    let filtered = this.data.allTags
    if (kw) filtered = this.data.allTags.filter(t => t.includes(kw))
    this.setData({ tagSearch: kw, filteredTags: filtered })
  },

  onTagToggle(e) {
    const tag = e.currentTarget.dataset.tag
    let tags = [...this.data.selectedTags]
    const idx = tags.indexOf(tag)
    idx > -1 ? tags.splice(idx, 1) : tags.push(tag)
    this.setData({ selectedTags: tags })
  },

  // ===== 自定义标签 =====
  onCustomTagInput(e) {
    this.setData({ customTagInput: e.detail.value })
  },

  async onAddCustomTag() {
    const tag = this.data.customTagInput.trim()
    if (!tag) {
      wx.showToast({ title: '请输入忌口食物名称', icon: 'none' })
      return
    }
    // 标签已存在 → 直接选中
    if (this.data.allTags.includes(tag)) {
      if (!this.data.selectedTags.includes(tag)) {
        this.setData({ selectedTags: [...this.data.selectedTags, tag], customTagInput: '' })
      } else {
        wx.showToast({ title: '该标签已选中', icon: 'none' })
      }
      return
    }
    // 新标签 → 写入标签库
    try {
      const instId = app.globalData.institutionId
      if (instId) await cloud.addCustomTag(instId, tag)
    } catch (err) { console.error(err) }

    const newLib = [...this.data.customTagLib, tag]
    const newAll = [...this.data.predefinedTags, ...newLib]
    this.setData({
      customTagLib: newLib, allTags: newAll, filteredTags: newAll,
      selectedTags: [...this.data.selectedTags, tag],
      customTagInput: '', tagSearch: ''
    })
    wx.showToast({ title: `已添加"${tag}"`, icon: 'success' })
  },

  // ===== 文本自动匹配 =====
  autoMatchFromText() {
    const text = (this.data.customNotes + this.data.cookingNotes).toLowerCase()
    if (!text) { this.setData({ autoMatchedTags: [] }); return }
    const matched = this.data.allTags.filter(tag =>
      (text.includes(tag.toLowerCase()) || tag.toLowerCase().includes(text))
    ).filter(tag => !this.data.selectedTags.includes(tag))
    this.setData({ autoMatchedTags: matched.slice(0, 8) })
  },

  onAddAutoTag(e) {
    const tag = e.currentTarget.dataset.tag
    if (!this.data.selectedTags.includes(tag)) {
      this.setData({ selectedTags: [...this.data.selectedTags, tag] })
    }
  },

  onCustomNotesInput(e) {
    this.setData({ customNotes: e.detail.value }, () => this.autoMatchFromText())
  },

  onCookingNotesInput(e) {
    this.setData({ cookingNotes: e.detail.value }, () => this.autoMatchFromText())
  },

  // ===== 提交 =====
  async onSubmit() {
    if (this.data.selectedTags.length === 0 && !this.data.customNotes && !this.data.cookingNotes) {
      wx.showToast({ title: '请至少添加一项忌口信息', icon: 'none' })
      return
    }
    const data = {
      room_id: this.data.roomId,
      institution_id: app.globalData.institutionId,
      date: this.data.date,
      template_tags: this.data.selectedTags,
      custom_notes: this.data.customNotes,
      cooking_notes: this.data.cookingNotes,
      source: app.getRole(), confirmed: true,
      updated_at: new Date()
    }
    try {
      if (this.data.isEdit) {
        await cloud.updateRestriction(this.data.id, data)
      } else {
        data.created_at = new Date()
        await cloud.createRestriction(data)
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
