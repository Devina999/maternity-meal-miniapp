const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  let { institution_id, role, name } = event

  try {
    // 如果没传机构ID，自动查第一个
    if (!institution_id) {
      try {
        const instRes = await db.collection('institutions').limit(1).get()
        if (instRes.data.length > 0) {
          institution_id = instRes.data[0]._id
        }
      } catch (e) {
        // institutions 集合可能不存在，跳过
        console.log('查询机构失败，将创建新机构', e.message)
      }

      // 没有就创建一个
      if (!institution_id) {
        try {
          const newInst = await db.collection('institutions').add({
            data: {
              name: '默认月子中心',
              status: 'active',
              max_rooms: 30,
              created_at: new Date(),
              updated_at: new Date()
            }
          })
          institution_id = newInst._id
        } catch (e2) {
          return { success: false, message: '无法创建机构，请先在云开发数据库中手动创建 institutions 集合，或运行 initDB 云函数。错误：' + e2.message }
        }
      }
    }

    // 生成6位邀请码
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    // 写入邀请码
    try {
      await db.collection('invite_codes').add({
        data: {
          code,
          institution_id,
          role: role || 'super_admin',
          name: name || '员工',
          used: false,
          created_at: new Date()
        }
      })
    } catch (e3) {
      return { success: false, message: 'invite_codes 集合不存在，请先运行 initDB 云函数初始化数据库。错误：' + e3.message }
    }

    return { success: true, inviteCode: code, role: role || 'super_admin' }
  } catch (err) {
    console.error('生成邀请码失败', err)
    return { success: false, message: '生成失败: ' + err.message }
  }
}
