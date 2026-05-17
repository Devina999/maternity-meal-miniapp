const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const MAX_LIMIT = 100

async function getAll(collectionName, where) {
  const countRes = await db.collection(collectionName).where(where).count()
  const total = countRes.total
  if (total === 0) return []
  const batchTimes = Math.ceil(total / MAX_LIMIT)
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    tasks.push(db.collection(collectionName).where(where).skip(i * MAX_LIMIT).limit(MAX_LIMIT).get())
  }
  const results = await Promise.all(tasks)
  return results.reduce((arr, r) => arr.concat(r.data), [])
}

function extractKeywords(tag) {
  const suffixes = ['过敏', '不吃', '忌', '不能吃', '不喜']
  let keyword = tag
  suffixes.forEach(s => {
    if (keyword.endsWith(s)) keyword = keyword.slice(0, -s.length)
  })
  return keyword.trim()
}

function doesTagMatchIngredient(tag, ingredient) {
  const keyword = extractKeywords(tag)
  if (!keyword) return false

  const kw = keyword.toLowerCase()
  const name = (ingredient.name || '').toLowerCase()
  const cat = (ingredient.category || '').toLowerCase()

  if (name.includes(kw) || kw.includes(name)) return true
  if (cat && (kw.includes(cat) || cat.includes(kw))) return true

  const tagLower = tag.toLowerCase()
  if (name.includes(tagLower) || tagLower.includes(name)) return true
  if (cat && (tagLower.includes(cat) || cat.includes(tagLower))) return true

  return false
}

exports.main = async (event, context) => {
  const { institution_id, date, meal_type } = event

  console.log('=== 开始匹配 ===')
  console.log('参数:', JSON.stringify({ institution_id, date, meal_type }))

  try {
    // 1. 获取餐单
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

    // 2. 获取菜品及其食材
    const dishes = await getAll('dishes', { institution_id, is_active: true })
    const dishMap = {}
    dishes.forEach(d => { dishMap[d._id] = d })

    // 3. 获取所有在住房间（过滤免餐）
    const rooms = await getAll('rooms', { institution_id, status: 'checked_in' })
    const activeRooms = rooms.filter(r => !r.meal_exempt)
    console.log('在住房间数:', activeRooms.length, '(总:', rooms.length, ')')

    if (activeRooms.length === 0) {
      return { success: false, message: '无在住房间需要备餐' }
    }

    const activeRoomIds = new Set(activeRooms.map(r => r._id))

    // 4. 获取全部忌口（不限日期——忌口是持续的，不因日期改变）
    const allRestrictions = await getAll('dietary_restrictions', { institution_id })
    // 只保留在住房间的忌口
    const restrictions = allRestrictions.filter(r => activeRoomIds.has(r.room_id))
    console.log('有效忌口记录数:', restrictions.length, '(总:', allRestrictions.length, ')')

    // 5. 获取全部食材
    const allIngredients = await getAll('ingredients', { institution_id })
    const ingredientMap = {}
    allIngredients.forEach(ing => { ingredientMap[ing._id] = ing })

    // 6. 为每个房间构建忌口食材集合和冲突详情
    const roomRestrictedSet = {} // roomId → Set of ingredient_id
    const roomConflictTags = {}  // roomId → Map of ingredient_id → [tags]
    const roomCookingNotes = {}

    activeRooms.forEach(room => {
      roomRestrictedSet[room._id] = new Set()
      roomConflictTags[room._id] = new Map()
      roomCookingNotes[room._id] = []
    })

    restrictions.forEach(r => {
      const set = roomRestrictedSet[r.room_id]
      const conflictMap = roomConflictTags[r.room_id]
      if (!set) return

      const tags = r.template_tags || []
      tags.forEach(tag => {
        allIngredients.forEach(ing => {
          if (doesTagMatchIngredient(tag, ing)) {
            set.add(ing._id)
            // 记录是哪个标签导致的冲突（用于展示）
            const existing = conflictMap.get(ing._id) || []
            if (!existing.includes(tag)) existing.push(tag)
            conflictMap.set(ing._id, existing)
          }
        })
      })

      if (r.cooking_notes) {
        roomCookingNotes[r.room_id].push(r.cooking_notes)
      }
    })

    // 7. 计算每道菜的需要份数和排除房间
    // dishStats: dishId → { total: 0, assigned: 0, excludedRooms: [], excludedReasons: {} }
    const dishStats = {}
    dishIds.forEach(did => {
      dishStats[did] = { total: activeRooms.length, assigned: 0, excludedRooms: [], excludedReasons: {} }
    })

    // 8. 为每个房间生成分配
    const assignments = []
    const now = new Date()
    // 全局库存扣减记录: ingredientId → totalDeduction
    const globalStockDeduction = {}

    for (const room of activeRooms) {
      const restrictedSet = roomRestrictedSet[room._id] || new Set()
      const conflictMap = roomConflictTags[room._id] || new Map()
      const assignedDishIds = []
      const excludedDishIds = []
      const exclusionReasons = {}

      for (const dishId of dishIds) {
        const dish = dishMap[dishId]
        if (!dish) continue

        const dishIngredients = dish.ingredients || []

        if (dishIngredients.length === 0) {
          assignedDishIds.push(dishId)
          dishStats[dishId].assigned++
          continue
        }

        // 检查是否与忌口冲突
        let hasConflict = false
        const conflictIngredientNames = []

        for (const di of dishIngredients) {
          if (restrictedSet.has(di.ingredient_id)) {
            hasConflict = true
            const ing = ingredientMap[di.ingredient_id]
            const ingName = ing ? ing.name : '未知食材'
            const tags = conflictMap.get(di.ingredient_id) || []
            const reason = tags.length > 0 ? `${ingName}(${tags.join('、')})` : ingName
            conflictIngredientNames.push(reason)
          }
        }

        if (hasConflict) {
          excludedDishIds.push(dishId)
          const reasonStr = conflictIngredientNames.join('；')
          exclusionReasons[dishId] = reasonStr
          dishStats[dishId].excludedRooms.push(room.room_number)
          dishStats[dishId].excludedReasons[room.room_number] = reasonStr
        } else {
          assignedDishIds.push(dishId)
          dishStats[dishId].assigned++

          // 累加库存扣减
          for (const di of dishIngredients) {
            const amount = parseFloat(di.amount) || 0
            if (amount > 0) {
              globalStockDeduction[di.ingredient_id] = (globalStockDeduction[di.ingredient_id] || 0) + amount
            }
          }
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

    // 9. 删除旧记录并写入新记录
    await db.collection('room_meal_assignments').where({
      institution_id, date, meal_type
    }).remove()

    for (const a of assignments) {
      await db.collection('room_meal_assignments').add({ data: a })
    }

    // 10. 扣减食材库存
    const stockChanges = []
    for (const [ingId, deduction] of Object.entries(globalStockDeduction)) {
      if (deduction <= 0) continue
      const ing = ingredientMap[ingId]
      if (!ing) continue

      const newStock = Math.max(0, (ing.stock || 0) - deduction)
      await db.collection('ingredients').doc(ingId).update({
        data: {
          stock: newStock,
          updated_at: now
        }
      })

      stockChanges.push({
        ingredient_id: ingId,
        name: ing.name,
        before: ing.stock || 0,
        deduction: deduction,
        after: newStock,
        alert: newStock <= (ing.stock_alert_threshold || 0)
      })
      console.log(`库存扣减: ${ing.name} ${ing.stock} → ${newStock} (-${deduction}${ing.unit || ''})`)
    }

    // 11. 审计日志
    await db.collection('audit_log').add({
      data: {
        institution_id,
        user_id: '', user_name: '系统', user_role: 'system',
        action: 'generate_assignments',
        target_type: 'room_meal_assignments',
        target_id: `${date}_${meal_type}`,
        details: `为${activeRooms.length}间房生成${meal_type}餐食分配，${dishIds.length}道菜品，扣减${stockChanges.length}种食材库存`,
        created_at: now
      }
    })

    // 12. 构建菜品维度汇总（供备餐看板图表使用）
    const dishSummary = dishIds.map(did => {
      const stats = dishStats[did]
      const dish = dishMap[did]
      const excludedRoomNumbers = stats.excludedRooms.length > 0 ? stats.excludedRooms.join('、') : ''
      const exclusionReasonsStr = stats.excludedRooms.length > 0
        ? stats.excludedRooms.map(rn => `${rn}号(${stats.excludedReasons[rn] || '忌口'})`).join('；')
        : ''
      return {
        dish_id: did,
        dish_name: dish ? dish.name : '未知菜品',
        category: dish ? dish.category : '',
        assigned_count: stats.assigned,
        total_rooms: activeRooms.length,
        portion_label: `${stats.assigned}/${activeRooms.length}`,
        excluded_rooms: excludedRoomNumbers,
        exclusion_reasons: exclusionReasonsStr
      }
    })

    return {
      success: true,
      totalRooms: activeRooms.length,
      totalDishes: dishIds.length,
      totalAssignments: assignments.length,
      stockChanges,
      dishSummary
    }
  } catch (err) {
    console.error('生成分配失败', err)
    return { success: false, message: err.message }
  }
}
