const app = getApp()
const { ROLE_NAME } = require('../../utils/constants')

Component({
  properties: {
    roles: {
      type: Array,
      value: []
    },
    requireLogin: {
      type: Boolean,
      value: true
    }
  },

  data: {
    allowed: false,
    roleName: ''
  },

  lifetimes: {
    attached() {
      this.checkPermission()
    }
  },

  pageLifetimes: {
    show() {
      this.checkPermission()
    }
  },

  methods: {
    checkPermission() {
      if (!this.properties.requireLogin) {
        this.setData({ allowed: true })
        return
      }

      if (!app.globalData.isLoggedIn) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }

      const roles = this.properties.roles
      if (roles.length === 0) {
        this.setData({ allowed: true })
        return
      }

      const userRole = app.getRole()
      const allowed = roles.includes(userRole)

      if (!allowed) {
        wx.showToast({ title: '无访问权限', icon: 'none' })
      }

      this.setData({
        allowed,
        roleName: ROLE_NAME[userRole] || ''
      })
    }
  }
})
