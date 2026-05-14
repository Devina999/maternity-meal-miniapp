const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const collections = [
    'institutions',
    'users',
    'rooms',
    'dietary_restrictions',
    'ingredients',
    'dishes',
    'daily_menus',
    'room_meal_assignments',
    'meal_feedback',
    'audit_log',
    'food_waste_log',
    'meal_cutoff_settings',
    'invite_codes'
  ]

  const results = []
  for (const name of collections) {
    try {
      await db.createCollection(name)
      results.push({ collection: name, status: 'created' })
    } catch (err) {
      if (err.errCode === -502005) {
        results.push({ collection: name, status: 'already exists' })
      } else {
        results.push({ collection: name, status: 'error: ' + err.message })
      }
    }
  }

  // 创建超级管理员和默认机构（如果不存在）
  try {
    const instRes = await db.collection('institutions').where({ name: '默认月子中心' }).get()
    let instId
    if (instRes.data.length === 0) {
      const res = await db.collection('institutions').add({
        data: {
          name: '默认月子中心',
          status: 'active',
          max_rooms: 30,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
      instId = res._id
      results.push({ action: 'created default institution', id: instId })
    } else {
      instId = instRes.data[0]._id
    }

    // 检查是否有超级管理员
    const adminRes = await db.collection('users').where({ role: 'super_admin' }).get()
    if (adminRes.data.length === 0) {
      results.push({
        action: 'reminder',
        message: '请先在微信开发者工具中手动添加超级管理员账号，或使用邀请码功能'
      })
    }

    // 确保有默认截止时间设置
    const cutoffRes = await db.collection('meal_cutoff_settings').where({ institution_id: instId }).get()
    if (cutoffRes.data.length === 0) {
      await db.collection('meal_cutoff_settings').add({
        data: {
          institution_id: instId,
          cutoff_time: '20:00',
          cutoff_enforced: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
      results.push({ action: 'created default cutoff settings' })
    }
  } catch (err) {
    results.push({ action: 'init error', message: err.message })
  }

  return { success: true, results }
}
