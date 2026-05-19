const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { institution_id, date, meal_type, user_id, user_name, user_role } = event

  try {
    // 1. 查找已发布的菜单
    const menuRes = await db.collection('daily_menus').where({
      institution_id, date, meal_type, status: 'confirmed'
    }).get()

    if (menuRes.data.length === 0) {
      return { success: false, message: '未找到已发布的餐单' }
    }

    const menu = menuRes.data[0]
    const stockChanges = menu.stock_changes || []

    // 2. 恢复食材库存
    const restoreResults = []
    for (const sc of stockChanges) {
      if (!sc.ingredient_id || sc.deduction <= 0) continue

      // 获取当前库存
      const ingRes = await db.collection('ingredients').doc(sc.ingredient_id).get()
      const ing = ingRes.data
      const restoredStock = (ing.stock || 0) + sc.deduction

      await db.collection('ingredients').doc(sc.ingredient_id).update({
        data: {
          stock: restoredStock,
          updated_at: new Date()
        }
      })

      restoreResults.push({
        ingredient_id: sc.ingredient_id,
        name: sc.name || ing.name,
        before: ing.stock || 0,
        restored: sc.deduction,
        after: restoredStock
      })
    }

    // 3. 删除房间分配记录
    const delResult = await db.collection('room_meal_assignments').where({
      institution_id, date, meal_type
    }).remove()

    // 4. 更新菜单状态为草稿，清除发布相关字段
    await db.collection('daily_menus').doc(menu._id).update({
      data: {
        status: 'draft',
        confirmed_at: db.command.remove(),
        dish_production: db.command.remove(),
        stock_changes: db.command.remove(),
        updated_at: new Date()
      }
    })

    // 5. 审计日志
    await db.collection('audit_log').add({
      data: {
        institution_id,
        user_id: user_id || '',
        user_name: user_name || '未知',
        user_role: user_role || '',
        action: 'cancel_menu_publish',
        target_type: 'daily_menus',
        target_id: menu._id,
        details: `取消发布${date}${meal_type}餐单，恢复${restoreResults.length}种食材库存，删除${delResult.stats ? delResult.stats.removed : 0}条房间分配`,
        created_at: new Date()
      }
    })

    return {
      success: true,
      message: '已取消发布',
      restoredIngredients: restoreResults.length,
      deletedAssignments: delResult.stats ? delResult.stats.removed : 0
    }
  } catch (err) {
    console.error('取消发布失败', err)
    return { success: false, message: err.message }
  }
}
