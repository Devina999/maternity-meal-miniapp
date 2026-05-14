const app = getApp()
const cloud = require('../../../utils/cloud')
const { ROOM_STATUS } = require('../../../utils/constants')

Page({
  data: {
    isEdit: false,
    id: null,
    form: {
      room_number: '',
      mother_name: '',
      check_in_date: '',
      check_out_date: '',
      notes: ''
    }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, id: options.id })
      this.loadRoom(options.id)
    }
  },

  async loadRoom(id) {
    const room = await cloud.getRoomById(id)
    this.setData({
      form: {
        room_number: room.room_number || '',
        mother_name: room.mother_name || '',
        check_in_date: room.check_in_date || '',
        check_out_date: room.check_out_date || '',
        notes: room.notes || ''
      }
    })
    wx.setNavigationBarTitle({ title: '编辑房间' })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onDateChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  async onSubmit() {
    const { room_number, mother_name } = this.data.form
    if (!room_number) {
      wx.showToast({ title: '请输入房间号', icon: 'none' })
      return
    }
    if (!mother_name) {
      wx.showToast({ title: '请输入宝妈姓名', icon: 'none' })
      return
    }

    const data = {
      ...this.data.form,
      institution_id: app.globalData.institutionId,
      status: ROOM_STATUS.CHECKED_IN,
      updated_at: new Date()
    }

    try {
      if (this.data.isEdit) {
        await cloud.updateRoom(this.data.id, data)
      } else {
        data.created_at = new Date()
        await cloud.createRoom(data)
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
    } catch (err) {
      console.error('保存失败', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
