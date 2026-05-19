const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 单独调用：检查某个房间对某个菜品的匹配情况
exports.main = async (event, context) => {
  const { room_id, dish_id, institution_id, date } = event

  try {
    // 获取菜品食材
    const dishRes = await db.collection('dishes').doc(dish_id).get()
    const dish = dishRes.data
    const dishIngredients = (dish.ingredients || []).map(i => i.ingredient_id)

    // 获取房间当日忌口
    const restrictionsRes = await db.collection('dietary_restrictions').where({
      room_id, institution_id, date
    }).get()

    const allIngredientsRes = await db.collection('ingredients').where({
      institution_id
    }).get()
    const allIngredients = allIngredientsRes.data

    // 收集忌口食材ID
    const restrictedIngredientIds = new Set()

    restrictionsRes.data.forEach(r => {
      (r.template_tags || []).forEach(tag => {
        allIngredients.forEach(ing => {
          const tagLower = tag.toLowerCase()
          const nameLower = ing.name.toLowerCase()
          if (nameLower.includes(tagLower) || tagLower.includes(nameLower)) {
            restrictedIngredientIds.add(ing._id)
          }
          if (ing.category && tagLower.includes(ing.category.toLowerCase())) {
            restrictedIngredientIds.add(ing._id)
          }
        })
      })
    })

    // 检查冲突
    const conflicts = dishIngredients.filter(id => restrictedIngredientIds.has(id))
    const conflictNames = conflicts.map(id => {
      const ing = allIngredients.find(i => i._id === id)
      return ing ? ing.name : '未知食材'
    })

    return {
      success: true,
      canServe: conflicts.length === 0,
      conflicts: conflictNames,
      dishName: dish.name
    }
  } catch (err) {
    console.error('匹配检查失败', err)
    return { success: false, message: err.message }
  }
}
