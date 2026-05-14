const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { institution_id, dish_ids } = event

  try {
    // 获取菜品及其食材
    const dishesRes = await db.collection('dishes').where({
      institution_id,
      _id: _.in(dish_ids || []),
      is_active: true
    }).get()

    const dishes = dishesRes.data

    // 计算每种食材的总需求
    const ingredientDemand = {}
    dishes.forEach(dish => {
      (dish.ingredients || []).forEach(ing => {
        if (!ingredientDemand[ing.ingredient_id]) {
          ingredientDemand[ing.ingredient_id] = 0
        }
        ingredientDemand[ing.ingredient_id] += ing.amount || 0
      })
    })

    // 检查库存
    const ingredientIds = Object.keys(ingredientDemand)
    const ingredientsRes = await db.collection('ingredients').where({
      institution_id,
      _id: _.in(ingredientIds)
    }).get()

    const alerts = []
    const lowStock = []

    ingredientsRes.data.forEach(ing => {
      const demand = ingredientDemand[ing._id] || 0
      const remaining = ing.stock - demand

      if (remaining < 0) {
        alerts.push({
          ingredient_id: ing._id,
          name: ing.name,
          stock: ing.stock,
          demand,
          shortage: Math.abs(remaining),
          unit: ing.unit
        })
      } else if (remaining <= ing.stock_alert_threshold) {
        lowStock.push({
          ingredient_id: ing._id,
          name: ing.name,
          stock: ing.stock,
          demand,
          remaining,
          unit: ing.unit,
          threshold: ing.stock_alert_threshold
        })
      }
    })

    return {
      success: true,
      hasAlerts: alerts.length > 0,
      hasLowStock: lowStock.length > 0,
      alerts,
      lowStock
    }
  } catch (err) {
    console.error('库存检查失败', err)
    return { success: false, message: err.message }
  }
}
