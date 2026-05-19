// 角色枚举
const ROLE = {
  SUPER_ADMIN: 'super_admin',
  HEAD_CHEF: 'head_chef',
  COOK: 'cook',
  NURSE_MANAGER: 'nurse_manager',
  NURSE: 'nurse',
  RECEPTIONIST: 'receptionist',
  BOSS: 'boss'
}

// 角色中文名
const ROLE_NAME = {
  super_admin: '超级管理员',
  head_chef: '后厨主厨',
  cook: '后厨操作厨师',
  nurse_manager: '前厅护士经理',
  nurse: '前厅护士',
  receptionist: '前厅前台',
  boss: '老板'
}

// 房间状态
const ROOM_STATUS = {
  CHECKED_IN: 'checked_in',
  TEMP_LEFT: 'temp_left',
  CHECKED_OUT: 'checked_out'
}

const ROOM_STATUS_NAME = {
  checked_in: '在住',
  temp_left: '临时离店',
  checked_out: '已退房'
}

// 制作状态（房间维度）
const PRODUCTION_STATUS = {
  PENDING: 'pending',
  COOKING: 'cooking',
  COMPLETED: 'completed',
  DISTRIBUTED: 'distributed'
}

const PRODUCTION_STATUS_NAME = {
  pending: '待制作',
  cooking: '制作中',
  completed: '已完成',
  distributed: '已分餐'
}

// 菜品制作状态（菜品维度）
const DISH_PRODUCTION_STATUS = {
  PREPARING: 'preparing',
  COMPLETED: 'completed',
  SERVED: 'served'
}

const DISH_PRODUCTION_STATUS_NAME = {
  preparing: '制作中',
  completed: '已出餐',
  served: '已上菜'
}

// 餐食类型
const MEAL_TYPE = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  SNACK: 'snack'
}

const MEAL_TYPE_NAME = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐'
}

// 忌口模板标签
const RESTRICTION_TAGS = [
  '海鲜过敏', '鸡蛋过敏', '牛奶过敏', '花生过敏', '大豆过敏',
  '辣椒', '生姜', '大蒜', '香菜', '葱',
  '牛羊肉', '猪肉', '鸡肉', '鸭肉',
  '辛辣', '油腻', '油炸', '生冷',
  '蘑菇', '茄子', '菠菜', '芹菜', '韭菜',
  '芒果', '菠萝', '桃子',
  '坚果', '芝麻'
]

// 食材分类
const INGREDIENT_CATEGORY = ['肉类', '蔬菜', '海鲜', '蛋奶', '调味料', '主食', '豆制品', '菌菇', '水果', '其他']

// 菜品分类
const DISH_CATEGORY = ['主菜', '副菜', '汤品', '主食', '甜品', '饮品']

// 浪费原因
const WASTE_REASONS = ['宝妈离店', '忌口错误', '不合口味', '份量过多', '重复菜品', '其他']

// 备餐截止默认时间
const DEFAULT_CUTOFF_TIME = '20:00'

// 操作类型（用于审计日志）
const ACTION_TYPE = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject',
  LOGIN: 'login'
}

module.exports = {
  ROLE, ROLE_NAME,
  ROOM_STATUS, ROOM_STATUS_NAME,
  PRODUCTION_STATUS, PRODUCTION_STATUS_NAME,
  DISH_PRODUCTION_STATUS, DISH_PRODUCTION_STATUS_NAME,
  MEAL_TYPE, MEAL_TYPE_NAME,
  RESTRICTION_TAGS,
  INGREDIENT_CATEGORY,
  DISH_CATEGORY,
  WASTE_REASONS,
  DEFAULT_CUTOFF_TIME,
  ACTION_TYPE
}
