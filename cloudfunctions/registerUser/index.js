const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { inviteCode } = event
  if (!inviteCode) {
    return { success: false, message: '请输入邀请码' }
  }

  try {
    // 查找邀请码
    const codeRes = await db.collection('invite_codes').where({ code: inviteCode, used: false }).get()
    if (codeRes.data.length === 0) {
      return { success: false, message: '邀请码无效或已被使用' }
    }

    const codeData = codeRes.data[0]

    // 检查是否已注册
    const existRes = await db.collection('users').where({ openid }).get()
    if (existRes.data.length > 0) {
      return { success: false, message: '该微信已注册' }
    }

    // 创建用户
    const userData = {
      openid,
      institution_id: codeData.institution_id,
      name: codeData.name,
      role: codeData.role,
      phone: '',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }

    const userRes = await db.collection('users').add({ data: userData })

    // 标记邀请码已使用
    await db.collection('invite_codes').doc(codeData._id).update({
      data: {
        used: true,
        used_by_openid: openid,
        used_at: new Date()
      }
    })

    return {
      success: true,
      user: { _id: userRes._id, ...userData }
    }
  } catch (err) {
    console.error('注册失败', err)
    return { success: false, message: '注册失败' }
  }
}
