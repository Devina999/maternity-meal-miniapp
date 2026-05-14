const app = getApp()
const cloud = require('../../../utils/cloud')
const { ROLE, ROLE_NAME } = require('../../../utils/constants')

Page({
  data: {
    users: [],
    showInviteForm: false,
    inviteForm: {
      role: ROLE.NURSE,
      name: ''
    },
    inviteCode: '',
    roles: Object.keys(ROLE).map(k => ({ value: ROLE[k], label: ROLE_NAME[ROLE[k]] }))
  },

  onShow() {
    if (app.getRole() !== ROLE.SUPER_ADMIN) {
      wx.showToast({ title: '仅超级管理员可访问', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }
    this.loadUsers()
  },

  async loadUsers() {
    try {
      const users = await cloud.getUsersByInstitution(app.globalData.institutionId)
      users.forEach(u => {
        u.roleName = ROLE_NAME[u.role] || u.role
      })
      this.setData({ users })
    } catch (err) {
      console.error('加载用户失败', err)
    }
  },

  onShowInviteForm() {
    this.setData({ showInviteForm: true, inviteCode: '' })
  },

  onCancel() {
    this.setData({ showInviteForm: false })
  },

  onRoleChange(e) {
    this.setData({ 'inviteForm.role': this.data.roles[e.detail.value].value })
  },

  onNameInput(e) {
    this.setData({ 'inviteForm.name': e.detail.value })
  },

  async onGenerateInvite() {
    if (!this.data.inviteForm.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'generateInviteCode',
        data: {
          institution_id: app.globalData.institutionId,
          role: this.data.inviteForm.role,
          name: this.data.inviteForm.name.trim()
        }
      })

      if (res.result.success) {
        this.setData({ inviteCode: res.result.inviteCode })
      }
    } catch (err) {
      console.error('生成邀请码失败', err)
      wx.showToast({ title: '生成失败', icon: 'none' })
    }
  },

  async onToggleUser(e) {
    const user = this.data.users.find(u => u._id === e.currentTarget.dataset.id)
    if (!user) return

    const action = user.is_active ? '禁用' : '启用'
    wx.showModal({
      title: `${action}用户`,
      content: `确定${action}"${user.name}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          await cloud.updateUser(user._id, {
            is_active: !user.is_active,
            updated_at: new Date()
          })
          wx.showToast({ title: `已${action}`, icon: 'success' })
          this.loadUsers()
        }
      }
    })
  }
})
