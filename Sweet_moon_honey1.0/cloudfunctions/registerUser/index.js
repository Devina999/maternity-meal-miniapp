const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { inviteCode, name } = event

  try {
    // 检查是否已注册——已注册直接返回用户信息（当登录用）
    const existRes = await db.collection('users').where({ openid }).get()
    if (existRes.data.length > 0) {
      const user = existRes.data[0]
      if (!user.is_active) {
        return { success: false, message: '账号已被禁用' }
      }
      return { success: true, user, alreadyExists: true, message: '欢迎回来' }
    }

    // 检查系统是否有用户——首位用户自动成为超级管理员
    const userCountRes = await db.collection('users').count()
    const isFirstUser = userCountRes.total === 0

    let institution_id, role, userName

    if (isFirstUser) {
      // 首位用户：自动成为超级管理员，无需邀请码
      // 获取或创建默认机构
      const instRes = await db.collection('institutions').where({ name: '默认月子中心' }).get()
      if (instRes.data.length > 0) {
        institution_id = instRes.data[0]._id
      } else {
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
      }
      role = 'super_admin'
      userName = name || '管理员'
    } else {
      // 非首位用户：必须使用邀请码
      if (!inviteCode) {
        return { success: false, message: '请输入邀请码' }
      }

      const codeRes = await db.collection('invite_codes').where({ code: inviteCode, used: false }).get()
      if (codeRes.data.length === 0) {
        return { success: false, message: '邀请码无效或已被使用' }
      }

      const codeData = codeRes.data[0]
      institution_id = codeData.institution_id
      role = codeData.role
      userName = name || codeData.name

      // 标记邀请码已使用
      await db.collection('invite_codes').doc(codeData._id).update({
        data: {
          used: true,
          used_by_openid: openid,
          used_at: new Date()
        }
      })
    }

    // 创建用户
    const userData = {
      openid,
      institution_id,
      name: userName,
      role,
      phone: '',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }

    const userRes = await db.collection('users').add({ data: userData })

    const result = {
      success: true,
      user: { _id: userRes._id, ...userData }
    }

    if (isFirstUser) {
      result.message = '已自动创建超级管理员账号'
      result.isFirstUser = true
    }

    return result
  } catch (err) {
    console.error('注册失败', err)
    return { success: false, message: '注册失败: ' + err.message }
  }
}
