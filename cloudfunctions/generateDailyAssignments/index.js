const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { institution_id, date, meal_type } = event

  try {
    // 1. 获取该餐别的餐单
    const menuRes = await db.collection('daily_menus').where({
      institution_id, date, meal_type
    }).get()

    if (menuRes.data.length === 0) {
      return { success: false, message: '未找到该餐单' }
    }

    const menu = menuRes.data[0]
    const dishIds = menu.dish_ids || []

    if (dishIds.length === 0) {
      return { success: false, message: '餐单无菜品' }
    }

    // 2. 获取所有菜品及其食材
    const dishesRes = await db.collection('dishes').where({
      institution_id,
      _id: _.in(dishIds),
      is_active: true
    }).get()
    const dishes = dishesRes.data

    // 构建菜品-食材映射
    const dishIngredientMap = {}
    dishes.forEach(d => {
      dishIngredientMap[d._id] = (d.ingredients || []).map(i => i.ingredient_id)
    })

    // 3. 获取所有在住房间
    const roomsRes = await db.collection('rooms').where({
      institution_id,
      status: 'checked_in',
      meal_exempt: _.neq(true)
    }).get()
    const rooms = roomsRes.data

    // 4. 获取当日所有忌口
    const restrictionsRes = await db.collection('dietary_restrictions').where({
      institution_id, date
    }).get()
    const restrictions = restrictionsRes.data

    // 构建房间-忌口食材映射
    // 忌口的template_tags需要转换为对应食材ID
    const allIngredientsRes = await db.collection('ingredients').where({
      institution_id
    }).get()
    const allIngredients = allIngredientsRes.data

    // 构建标签到食材ID的映射（按名称匹配）
    function matchTagToIngredients(tag, ingredients) {
      const matches = []
      const tagLower = tag.toLowerCase()
      ingredients.forEach(ing => {
        const nameLower = ing.name.toLowerCase()
        // 简单匹配：标签中包含食材名，或食材名中包含标签关键词
        if (nameLower.includes(tagLower) || tagLower.includes(nameLower)) {
          matches.push(ing._id)
        }
        // 分类匹配
        if (ing.category && tagLower.includes(ing.category.toLowerCase())) {
          matches.push(ing._id)
        }
      })
      return matches
    }

    const roomRestrictedIngredients = {}
    const roomCookingNotes = {}

    rooms.forEach(room => {
      roomRestrictedIngredients[room._id] = new Set()
      roomCookingNotes[room._id] = []
    })

    restrictions.forEach(r => {
      if (!roomRestrictedIngredients[r.room_id]) return

      // 从忌口标签匹配食材
      (r.template_tags || []).forEach(tag => {
        const matchedIds = matchTagToIngredients(tag, allIngredients)
        matchedIds.forEach(id => roomRestrictedIngredients[r.room_id].add(id))
      })

      // 收集个性化制作要求
      if (r.cooking_notes) {
        roomCookingNotes[r.room_id].push(r.cooking_notes)
      }
    })

    // 5. 为每个房间生成餐食分配
    const assignments = []
    const now = new Date()

    for (const room of rooms) {
      const restrictedSet = roomRestrictedIngredients[room._id] || new Set()
      const assignedDishIds = []
      const excludedDishIds = []
      const exclusionReasons = {}

      for (const dishId of dishIds) {
        const dishIngredientIds = dishIngredientMap[dishId] || []
        // 检查菜品的食材是否与忌口食材有交集
        const hasConflict = dishIngredientIds.some(ingId => restrictedSet.has(ingId))

        if (hasConflict) {
          excludedDishIds.push(dishId)
          exclusionReasons[dishId] = '含忌口食材'
        } else {
          assignedDishIds.push(dishId)
        }
      }

      assignments.push({
        institution_id,
        room_id: room._id,
        room_number: room.room_number,
        mother_name: room.mother_name || '',
        menu_id: menu._id,
        date,
        meal_type,
        assigned_dish_ids: assignedDishIds,
        excluded_dish_ids: excludedDishIds,
        exclusion_reasons: exclusionReasons,
        cooking_notes: (roomCookingNotes[room._id] || []).join('；'),
        production_status: 'pending',
        created_at: now,
        updated_at: now
      })
    }

    // 6. 删除旧的分配记录
    await db.collection('room_meal_assignments').where({
      institution_id, date, meal_type
    }).remove()

    // 7. 批量写入新分配
    for (const assignment of assignments) {
      await db.collection('room_meal_assignments').add({ data: assignment })
    }

    // 8. 写入审计日志
    await db.collection('audit_log').add({
      data: {
        institution_id,
        user_id: '',
        user_name: '系统',
        user_role: 'system',
        action: 'generate_assignments',
        target_type: 'room_meal_assignments',
        target_id: `${date}_${meal_type}`,
        details: `为${rooms.length}间房生成${meal_type}餐食分配，共${dishIds.length}道菜品`,
        created_at: now
      }
    })

    return {
      success: true,
      totalRooms: rooms.length,
      totalDishes: dishIds.length,
      totalAssignments: assignments.length
    }
  } catch (err) {
    console.error('生成分配失败', err)
    return { success: false, message: err.message }
  }
}
