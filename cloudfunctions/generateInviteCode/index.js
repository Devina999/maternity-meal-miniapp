const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { institution_id, role, name } = event

  // 生成6位邀请码
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  try {
    await db.collection('invite_codes').add({
      data: {
        code,
        institution_id,
        role,
        name,
        used: false,
        created_at: new Date()
      }
    })

    return { success: true, inviteCode: code }
  } catch (err) {
    console.error('生成邀请码失败', err)
    return { success: false, message: '生成失败' }
  }
}
