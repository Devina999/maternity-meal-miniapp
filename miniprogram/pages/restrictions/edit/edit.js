const app = getApp()
const cloud = require('../../../utils/cloud')
const { RESTRICTION_TAGS } = require('../../../utils/constants')
const dateHelper = require('../../../utils/date-helper')

Page({
  data: {
    isEdit: false,
    id: null,
    roomId: '',
    date: '',
    allTags: RESTRICTION_TAGS,
    selectedTags: [],
    customNotes: '',
    cookingNotes: '',
    roomInfo: null
  },

  onLoad(options) {
    const date = options.date || dateHelper.getToday()
    this.setData({ date })

    if (options.id) {
      this.setData({ isEdit: true, id: options.id })
      this.loadRestriction(options.id)
    } else if (options.roomId) {
      this.setData({ roomId: options.roomId })
      this.loadRoomInfo(options.roomId)
    }
  },

  async loadRoomInfo(roomId) {
    try {
      const room = await cloud.getRoomById(roomId)
      this.setData({ roomInfo: room })
    } catch (err) {
      console.error('加载房间信息失败', err)
    }
  },

  async loadRestriction(id) {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('dietary_restrictions').doc(id).get()
      const data = res.data
      this.setData({
        roomId: data.room_id,
        selectedTags: data.template_tags || [],
        customNotes: data.custom_notes || '',
        cookingNotes: data.cooking_notes || ''
      })
      this.loadRoomInfo(data.room_id)
    } catch (err) {
      console.error('加载忌口失败', err)
    }
  },

  onTagToggle(e) {
    const tag = e.currentTarget.dataset.tag
    let tags = [...this.data.selectedTags]
    const idx = tags.indexOf(tag)
    if (idx > -1) {
      tags.splice(idx, 1)
    } else {
      tags.push(tag)
    }
    this.setData({ selectedTags: tags })
  },

  onCustomNotesInput(e) {
    this.setData({ customNotes: e.detail.value })
  },

  onCookingNotesInput(e) {
    this.setData({ cookingNotes: e.detail.value })
  },

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
      source: app.getRole(),
      confirmed: true,
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
      console.error('保存忌口失败', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
