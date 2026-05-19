const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const {
    institution_id,
    user_id,
    user_name,
    user_role,
    action,
    target_type,
    target_id,
    details
  } = event

  try {
    await db.collection('audit_log').add({
      data: {
        institution_id,
        user_id: user_id || '',
        user_name: user_name || '',
        user_role: user_role || '',
        action,
        target_type,
        target_id,
        details,
        created_at: new Date()
      }
    })
    return { success: true }
  } catch (err) {
    console.error('审计日志写入失败', err)
    return { success: false, message: err.message }
  }
}
