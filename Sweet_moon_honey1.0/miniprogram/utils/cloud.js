const db = wx.cloud.database()
const _ = db.command

function getCollection(name) {
  return db.collection(name)
}

// ============ 用户 ============

async function getUserByOpenId(openid) {
  const res = await getCollection('users').where({ openid }).get()
  return res.data.length > 0 ? res.data[0] : null
}

async function getUserById(id) {
  const res = await getCollection('users').doc(id).get()
  return res.data
}

async function getUsersByInstitution(instId) {
  const res = await getCollection('users').where({ institution_id: instId }).get()
  return res.data
}

async function createUser(data) {
  return await getCollection('users').add({ data })
}

async function updateUser(id, data) {
  return await getCollection('users').doc(id).update({ data })
}

async function deleteUser(id) {
  return await getCollection('users').doc(id).remove()
}

// ============ 房间 ============

async function getRooms(instId, status) {
  let query = getCollection('rooms').where({ institution_id: instId })
  if (status) query = query.where({ status })
  const res = await query.orderBy('room_number', 'asc').get()
  return res.data
}

async function getRoomById(id) {
  const res = await getCollection('rooms').doc(id).get()
  return res.data
}

async function createRoom(data) {
  return await getCollection('rooms').add({ data })
}

async function updateRoom(id, data) {
  return await getCollection('rooms').doc(id).update({ data })
}

async function deleteRoom(id) {
  return await getCollection('rooms').doc(id).remove()
}

// ============ 忌口 ============

async function getRestrictionsByRoom(roomId, date) {
  let query = getCollection('dietary_restrictions').where({ room_id: roomId })
  if (date) query = query.where({ date })
  const res = await query.orderBy('created_at', 'desc').get()
  return res.data
}

async function getRestrictionsByDate(instId, date) {
  let query = getCollection('dietary_restrictions').where({ institution_id: instId })
  if (date) query = query.where({ date })
  const res = await query.limit(200).get()
  return res.data
}

async function createRestriction(data) {
  return await getCollection('dietary_restrictions').add({ data })
}

async function updateRestriction(id, data) {
  return await getCollection('dietary_restrictions').doc(id).update({ data })
}

async function deleteRestriction(id) {
  return await getCollection('dietary_restrictions').doc(id).remove()
}

async function deleteRestrictionsByRoom(roomId) {
  const res = await getCollection('dietary_restrictions').where({ room_id: roomId }).get()
  const tasks = res.data.map(r => getCollection('dietary_restrictions').doc(r._id).remove())
  return await Promise.all(tasks)
}

async function deleteAssignmentsByRoom(roomId, date) {
  let query = getCollection('room_meal_assignments').where({ room_id: roomId })
  if (date) query = query.where({ date: _.gte(date) })
  const res = await query.get()
  const tasks = res.data.map(a => getCollection('room_meal_assignments').doc(a._id).remove())
  return await Promise.all(tasks)
}

// ============ 食材 ============

async function getIngredients(instId) {
  const res = await getCollection('ingredients')
    .where({ institution_id: instId })
    .orderBy('category', 'asc')
    .get()
  return res.data
}

async function createIngredient(data) {
  return await getCollection('ingredients').add({ data })
}

async function updateIngredient(id, data) {
  return await getCollection('ingredients').doc(id).update({ data })
}

async function deleteIngredient(id) {
  return await getCollection('ingredients').doc(id).remove()
}

// ============ 菜品 ============

async function getDishes(instId) {
  const res = await getCollection('dishes')
    .where({ institution_id: instId, is_active: true })
    .get()
  return res.data
}

async function getDishById(id) {
  const res = await getCollection('dishes').doc(id).get()
  return res.data
}

async function createDish(data) {
  return await getCollection('dishes').add({ data })
}

async function updateDish(id, data) {
  return await getCollection('dishes').doc(id).update({ data })
}

// ============ 餐单 ============

async function getDailyMenus(instId, date) {
  const res = await getCollection('daily_menus')
    .where({ institution_id: instId, date })
    .get()
  return res.data
}

async function createDailyMenu(data) {
  return await getCollection('daily_menus').add({ data })
}

async function updateDailyMenu(id, data) {
  return await getCollection('daily_menus').doc(id).update({ data })
}

// 更新菜品制作状态（存储在 daily_menus.dish_production 中）
async function updateDishProduction(menuId, dishId, status, userId) {
  const key = `dish_production.${dishId}`
  return await getCollection('daily_menus').doc(menuId).update({
    data: {
      [key]: {
        status,
        updated_by: userId,
        updated_at: new Date()
      }
    }
  })
}

// ============ 房餐分配 ============

async function getRoomAssignments(instId, date, mealType) {
  let query = getCollection('room_meal_assignments').where({ institution_id: instId, date })
  if (mealType) query = query.where({ meal_type: mealType })
  const res = await query.get()
  return res.data
}

async function updateAssignment(id, data) {
  return await getCollection('room_meal_assignments').doc(id).update({ data })
}

// ============ 反馈 ============

async function getFeedback(instId, date) {
  let query = getCollection('meal_feedback').where({ institution_id: instId })
  if (date) query = query.where({ date })
  const res = await query.orderBy('created_at', 'desc').get()
  return res.data
}

async function createFeedback(data) {
  return await getCollection('meal_feedback').add({ data })
}

async function updateFeedback(id, data) {
  return await getCollection('meal_feedback').doc(id).update({ data })
}

// ============ 审计日志 ============

async function getAuditLogs(instId, filter) {
  let query = getCollection('audit_log').where({ institution_id: instId })
  if (filter && filter.userId) query = query.where({ user_id: filter.userId })
  if (filter && filter.action) query = query.where({ action: filter.action })
  const res = await query.orderBy('created_at', 'desc').limit(200).get()
  return res.data
}

// ============ 设置 ============

async function getMealCutoffSettings(instId) {
  const res = await getCollection('meal_cutoff_settings')
    .where({ institution_id: instId })
    .get()
  return res.data.length > 0 ? res.data[0] : { cutoff_time: '20:00', cutoff_enforced: true }
}

async function updateMealCutoffSettings(instId, data) {
  const existing = await getCollection('meal_cutoff_settings')
    .where({ institution_id: instId }).get()
  if (existing.data.length > 0) {
    return await getCollection('meal_cutoff_settings').doc(existing.data[0]._id).update({ data })
  }
  return await getCollection('meal_cutoff_settings').add({ data: { institution_id: instId, ...data } })
}

// ============ 自定义标签 ============

async function getCustomTags(instId) {
  const res = await getCollection('institutions').doc(instId).get()
  return res.data.custom_tags || []
}

async function addCustomTag(instId, tag) {
  const current = await getCustomTags(instId)
  if (current.includes(tag)) return current
  current.push(tag)
  await getCollection('institutions').doc(instId).update({
    data: { custom_tags: current, updated_at: new Date() }
  })
  return current
}

module.exports = {
  db, _,
  getUserByOpenId, getUserById, getUsersByInstitution, createUser, updateUser, deleteUser,
  getRooms, getRoomById, createRoom, updateRoom, deleteRoom,
  getRestrictionsByRoom, getRestrictionsByDate, createRestriction, updateRestriction, deleteRestriction, deleteRestrictionsByRoom, deleteAssignmentsByRoom,
  getIngredients, createIngredient, updateIngredient, deleteIngredient,
  getDishes, getDishById, createDish, updateDish,
  getDailyMenus, createDailyMenu, updateDailyMenu, updateDishProduction,
  getRoomAssignments, updateAssignment,
  getFeedback, createFeedback, updateFeedback,
  getAuditLogs,
  getMealCutoffSettings, updateMealCutoffSettings,
  getCustomTags, addCustomTag
}
