const app = getApp()
const { ROLE, ROLE_NAME, MEAL_TYPE_NAME } = require('../../utils/constants')
const dateHelper = require('../../utils/date-helper')

Page({
  data: {
    roleName: '',
    today: '',
    tomorrow: '',
    menuGroups: [],
    stats: {},
    simulateRoles: [],
    simulateRoleIndex: 0
  },

  onLoad() {
    if (!app.globalData.isLoggedIn) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.refreshRoleInfo()
    this.setData({
      today: dateHelper.getToday(),
      tomorrow: dateHelper.getTomorrow()
    })
    this.buildMenu()
  },

  onShow() {
    if (!app.globalData.isLoggedIn) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.refreshRoleInfo()
    this.buildMenu()
  },

  refreshRoleInfo() {
    const user = app.globalData.user
    const realRole = user ? user.role : null
    const simulatedRole = app.globalData.simulatedRole || null
    // 构建可选角色列表（排除超管自身）
    const simulateRoles = [
      { value: ROLE.BOSS, label: ROLE_NAME[ROLE.BOSS] },
      { value: ROLE.HEAD_CHEF, label: ROLE_NAME[ROLE.HEAD_CHEF] },
      { value: ROLE.COOK, label: ROLE_NAME[ROLE.COOK] },
      { value: ROLE.NURSE_MANAGER, label: ROLE_NAME[ROLE.NURSE_MANAGER] },
      { value: ROLE.NURSE, label: ROLE_NAME[ROLE.NURSE] },
      { value: ROLE.RECEPTIONIST, label: ROLE_NAME[ROLE.RECEPTIONIST] }
    ]
    this.setData({
      isSuperAdmin: realRole === ROLE.SUPER_ADMIN,
      realRole: realRole,
      realRoleName: ROLE_NAME[realRole] || '',
      simulatedRole: simulatedRole,
      simulatedRoleName: ROLE_NAME[simulatedRole] || '',
      isSimulating: app.isSimulating(),
      simulateRoles,
      simulateRoleIndex: 0
    })
  },

  onSimulateRoleChange(e) {
    const idx = e.detail.value
    const role = this.data.simulateRoles[idx]
    if (!role) return

    wx.showModal({
      title: '切换视角',
      content: `确定要以"${role.label}"的视角查看小程序吗？\n\n提示：切换后您看到的页面和权限将与该角色一致。`,
      success: (res) => {
        if (res.confirm) {
          app.setSimulatedRole(role.value)
          this.refreshRoleInfo()
          this.buildMenu()
          wx.showToast({ title: '已切换为 ' + role.label, icon: 'success', duration: 2000 })
        }
      }
    })
  },

  onRestoreRole() {
    app.clearSimulatedRole()
    this.refreshRoleInfo()
    this.buildMenu()
    wx.showToast({ title: '已还原为 ' + ROLE_NAME[app.getRole()], icon: 'success', duration: 2000 })
  },

  buildMenu() {
    const role = app.getRole()
    let groups = []

    const allMenus = {
      [ROLE.BOSS]: [
        { title: '房间与入住', icon: '🏠', items: [
          { name: '房间管理', desc: '查看管理所有房间入住状态', url: '/pages/rooms/list/list' },
          { name: '客人忌口清单', desc: '查看所有宝妈客人忌口信息', url: '/pages/restrictions/list/list' },
        ]},
        { title: '餐食管理', icon: '🍽️', items: [
          { name: '每日餐单', desc: '查看当日/明日餐单', url: '/pages/menu/daily-plan/daily-plan' },
          { name: '菜品库管理', desc: '编辑菜品和食材绑定', url: '/pages/menu/dish-library/dish-library' },
          { name: '食材库存', desc: '查看食材库存和预警', url: '/pages/menu/ingredient-stock/ingredient-stock' },
          { name: '备餐进度看板', desc: '实时查看制作进度', url: '/pages/kitchen/production-board/production-board' },
        ]},
        { title: '反馈与数据', icon: '📊', items: [
          { name: '餐食反馈', desc: '查看处理宝妈反馈', url: '/pages/feedback/list/list' },
        ]},
        { title: '系统管理', icon: '⚙️', items: [
          { name: '系统设置', desc: '截止时间、系统规则', url: '/pages/settings/index/index' },
          { name: '用户管理', desc: '添加禁用员工账号', url: '/pages/settings/user-management/user-management' },
        ]},
      ],
      [ROLE.SUPER_ADMIN]: [
        { title: '房间与入住', icon: '🏠', items: [
          { name: '房间管理', desc: '查看管理所有房间入住状态', url: '/pages/rooms/list/list' },
          { name: '客人忌口清单', desc: '查看所有宝妈客人忌口信息', url: '/pages/restrictions/list/list' },
        ]},
        { title: '餐食管理', icon: '🍽️', items: [
          { name: '每日餐单', desc: '查看当日/明日餐单', url: '/pages/menu/daily-plan/daily-plan' },
          { name: '菜品库管理', desc: '编辑菜品和食材绑定', url: '/pages/menu/dish-library/dish-library' },
          { name: '食材库存', desc: '查看食材库存和预警', url: '/pages/menu/ingredient-stock/ingredient-stock' },
          { name: '备餐进度看板', desc: '实时查看制作进度', url: '/pages/kitchen/production-board/production-board' },
        ]},
        { title: '反馈与数据', icon: '📊', items: [
          { name: '餐食反馈', desc: '查看处理宝妈反馈', url: '/pages/feedback/list/list' },
        ]},
        { title: '系统管理', icon: '⚙️', items: [
          { name: '系统设置', desc: '截止时间、系统规则', url: '/pages/settings/index/index' },
          { name: '用户管理', desc: '添加禁用员工账号', url: '/pages/settings/user-management/user-management' },
        ]},
      ],
      [ROLE.HEAD_CHEF]: [
        { title: '餐食管理', icon: '🍽️', items: [
          { name: '每日餐单', desc: '编辑发布当日/明日餐单', url: '/pages/menu/daily-plan/daily-plan' },
          { name: '菜品库管理', desc: '编辑菜品和食材', url: '/pages/menu/dish-library/dish-library' },
          { name: '食材库存', desc: '查看库存预警', url: '/pages/menu/ingredient-stock/ingredient-stock' },
          { name: '备餐进度看板', desc: '分配任务、查看进度', url: '/pages/kitchen/production-board/production-board' },
        ]},
        { title: '信息查看', icon: '📋', items: [
          { name: '房间忌口清单', desc: '查看全量客人忌口信息', url: '/pages/restrictions/list/list' },
          { name: '餐食反馈', desc: '查看和处理反馈', url: '/pages/feedback/list/list' },
        ]},
      ],
      [ROLE.COOK]: [
        { title: '我的任务', icon: '👨‍🍳', items: [
          { name: '备餐进度看板', desc: '查看我的制作任务', url: '/pages/kitchen/production-board/production-board' },
        ]},
        { title: '餐食管理', icon: '🍽️', items: [
          { name: '食材库存', desc: '查看和管理食材库存', url: '/pages/menu/ingredient-stock/ingredient-stock' },
          { name: '菜品库管理', desc: '编辑菜品和食材绑定', url: '/pages/menu/dish-library/dish-library' },
        ]},
        { title: '信息查看', icon: '📋', items: [
          { name: '每日餐单', desc: '查看餐单', url: '/pages/menu/daily-plan/daily-plan' },
          { name: '房间忌口提示', desc: '查看客人忌口信息', url: '/pages/restrictions/list/list' },
          { name: '餐食反馈', desc: '查看相关反馈', url: '/pages/feedback/list/list' },
        ]},
      ],
      [ROLE.NURSE_MANAGER]: [
        { title: '房间管理', icon: '🏠', items: [
          { name: '房间管理', desc: '录入住户信息、管理房间状态', url: '/pages/rooms/list/list' },
        ]},
        { title: '忌口管理', icon: '📝', items: [
          { name: '忌口清单管理', desc: '查看审批忌口变更', url: '/pages/restrictions/list/list' },
        ]},
        { title: '信息查看', icon: '👁️', items: [
          { name: '每日餐单', desc: '查看餐单', url: '/pages/menu/daily-plan/daily-plan' },
          { name: '备餐进度', desc: '查看制作进度', url: '/pages/kitchen/production-board/production-board' },
          { name: '餐食反馈', desc: '督办反馈处理', url: '/pages/feedback/list/list' },
        ]},
      ],
      [ROLE.NURSE]: [
        { title: '日常操作', icon: '🏥', items: [
          { name: '查看忌口', desc: '查看宝妈忌口信息', url: '/pages/restrictions/list/list' },
          { name: '提交反馈', desc: '收集宝妈餐食评价', url: '/pages/feedback/submit/submit' },
        ]},
        { title: '信息查看', icon: '👁️', items: [
          { name: '每日餐单', desc: '查看今日餐单', url: '/pages/menu/daily-plan/daily-plan' },
          { name: '备餐进度', desc: '查看制作进度', url: '/pages/kitchen/production-board/production-board' },
        ]},
      ],
      [ROLE.RECEPTIONIST]: [
        { title: '入住管理', icon: '🏠', items: [
          { name: '房间管理', desc: '录入退房、状态更新', url: '/pages/rooms/list/list' },
          { name: '宝妈忌口', desc: '录入宝妈忌口信息', url: '/pages/restrictions/list/list' },
        ]},
        { title: '信息查看', icon: '👁️', items: [
          { name: '每日餐单', desc: '查看餐单概览', url: '/pages/menu/daily-plan/daily-plan' },
          { name: '备餐进度', desc: '查看制作进度', url: '/pages/kitchen/production-board/production-board' },
        ]},
      ],
    }

    groups = allMenus[role] || []
    this.setData({ menuGroups: groups })
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) app.logout()
      }
    })
  },

  navigateTo(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.navigateTo({ url })
  }
})
