const app = getApp()
const { ROLE, ROLE_NAME, MEAL_TYPE_NAME } = require('../../utils/constants')
const dateHelper = require('../../utils/date-helper')

Page({
  data: {
    roleName: '',
    today: '',
    tomorrow: '',
    menuGroups: [],
    stats: {}
  },

  onLoad() {
    if (!app.globalData.isLoggedIn) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.setData({
      roleName: ROLE_NAME[app.getRole()] || '',
      today: dateHelper.getToday(),
      tomorrow: dateHelper.getTomorrow()
    })
    this.buildMenu()
  },

  onShow() {
    if (!app.globalData.isLoggedIn) {
      wx.reLaunch({ url: '/pages/login/login' })
    }
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
        { title: '信息查看', icon: '📋', items: [
          { name: '房间忌口提示', desc: '查看客人忌口信息', url: '/pages/restrictions/list/list' },
          { name: '我的反馈', desc: '查看相关餐食反馈', url: '/pages/feedback/list/list' },
        ]},
      ],
      [ROLE.NURSE_MANAGER]: [
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
          { name: '分管房间忌口', desc: '录入修改忌口需求', url: '/pages/restrictions/list/list' },
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
