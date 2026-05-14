const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 一次最多取100条
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

// 从标签提取关键词匹配食材
// 例如 "海鲜过敏" → ["海鲜"]  → 匹配 category="海鲜" 的食材
// 例如 "辣椒" → ["辣椒"] → 匹配 name="辣椒" 的食材
function extractKeywords(tag) {
  // 去掉常见的后缀词，提取核心关键词
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

  // 1. 食材名精确包含关键词 或 关键词包含食材名
  if (name.includes(kw) || kw.includes(name)) return true

  // 2. 关键词包含食材分类名（如 "海鲜过敏" 中的 "海鲜" 匹配分类 "海鲜"）
  if (cat && (kw.includes(cat) || cat.includes(kw))) return true

  // 3. 标签整体包含食材名或食材名包含标签（直接匹配原始标签）
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
    console.log('餐单菜品数:', dishIds.length)

    if (dishIds.length === 0) {
      return { success: false, message: '餐单无菜品' }
    }

    // 2. 获取菜品及其食材
    const dishes = await getAll('dishes', { institution_id, is_active: true })
    console.log('总菜品数:', dishes.length)
    const dishMap = {}
    dishes.forEach(d => { dishMap[d._id] = d })

    // 3. 获取所有在住房间
    const rooms = await getAll('rooms', { institution_id, status: 'checked_in' })
    console.log('在住房间数:', rooms.length)

    // 过滤掉免餐房间
    const activeRooms = rooms.filter(r => !r.meal_exempt)

    // 4. 获取当日忌口
    const restrictions = await getAll('dietary_restrictions', { institution_id, date })
    console.log('忌口记录数:', restrictions.length)

    // 5. 获取全部食材
    const allIngredients = await getAll('ingredients', { institution_id })
    console.log('食材总数:', allIngredients.length)

    // 6. 为每个房间构建忌口食材集合
    const roomRestrictedSet = {}
    const roomCookingNotes = {}

    activeRooms.forEach(room => {
      roomRestrictedSet[room._id] = new Set()
      roomCookingNotes[room._id] = []
    })

    restrictions.forEach(r => {
      const set = roomRestrictedSet[r.room_id]
      if (!set) return

      const tags = r.template_tags || []
      tags.forEach(tag => {
        allIngredients.forEach(ing => {
          if (doesTagMatchIngredient(tag, ing)) {
            set.add(ing._id)
            console.log(`匹配: 标签"${tag}" → 食材"${ing.name}"(分类:${ing.category})`)
          }
        })
      })

      if (r.cooking_notes) {
        roomCookingNotes[r.room_id].push(r.cooking_notes)
      }
    })

    // 7. 为每个房间生成分配
    const assignments = []
    const now = new Date()

    for (const room of activeRooms) {
      const restrictedSet = roomRestrictedSet[room._id] || new Set()
      const assignedDishIds = []
      const excludedDishIds = []
      const exclusionReasons = {}

      for (const dishId of dishIds) {
        const dish = dishMap[dishId]
        if (!dish) continue

        const dishIngredientIds = (dish.ingredients || []).map(i => i.ingredient_id)

        if (dishIngredientIds.length === 0) {
          // 菜品没有绑定食材，默认分配给所有房间
          assignedDishIds.push(dishId)
          continue
        }

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

      console.log(`房间${room.room_number}: 分配${assignedDishIds.length}道, 排除${excludedDishIds.length}道`)
    }

    // 8. 删除旧记录并写入新记录
    await db.collection('room_meal_assignments').where({
      institution_id, date, meal_type
    }).remove()

    for (const a of assignments) {
      await db.collection('room_meal_assignments').add({ data: a })
    }

    // 9. 审计日志
    await db.collection('audit_log').add({
      data: {
        institution_id,
        user_id: '', user_name: '系统', user_role: 'system',
        action: 'generate_assignments',
        target_type: 'room_meal_assignments',
        target_id: `${date}_${meal_type}`,
        details: `为${activeRooms.length}间房生成${meal_type}餐食分配，共${dishIds.length}道菜品`,
        created_at: now
      }
    })

    return {
      success: true,
      totalRooms: activeRooms.length,
      totalDishes: dishIds.length,
      totalAssignments: assignments.length
    }
  } catch (err) {
    console.error('生成分配失败', err)
    return { success: false, message: err.message }
  }
}
