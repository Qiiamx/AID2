/**
 * 干员数据工具函数
 * 用于读取和处理 operators.json 和 branches.json 数据
 */

import operatorsData from '@/assets/operators.json'
import branchesData from '@/assets/branches.json'

/**
 * 获取所有干员数据
 * @returns {Array} 干员数组
 */
export const getAllOperators = () => {
  return operatorsData
}

/**
 * 根据稀有度筛选干员
 * @param {number|string} rarity - 稀有度（1-6）
 * @returns {Array} 符合条件的干员数组
 */
export const getOperatorsByRarity = (rarity) => {
  return operatorsData.filter(op => op.稀有度 === String(rarity))
}

/**
 * 根据职业筛选干员
 * @param {string} profession - 职业名称（如"近卫"、"狙击"等）
 * @returns {Array} 符合条件的干员数组
 */
export const getOperatorsByProfession = (profession) => {
  return operatorsData.filter(op => op.职业 === profession)
}

/**
 * 根据分支筛选干员
 * @param {string} branch - 分支名称（如"领主"、"阵法术师"等）
 * @returns {Array} 符合条件的干员数组
 */
export const getOperatorsByBranch = (branch) => {
  return operatorsData.filter(op => op.分支 === branch)
}

/**
 * 根据名字查找干员
 * @param {string} name - 干员名字
 * @returns {Object|null} 干员对象，如果不存在返回null
 */
export const getOperatorByName = (name) => {
  return operatorsData.find(op => op.干员 === name) || null
}

/**
 * 随机获取指定数量的干员
 * @param {number} count - 需要获取的数量
 * @param {Object} options - 筛选选项
 * @param {number} options.rarity - 指定稀有度
 * @param {string} options.profession - 指定职业
 * @param {string} options.branch - 指定分支
 * @returns {Array} 随机干员数组
 */
export const getRandomOperators = (count, options = {}) => {
  let pool = operatorsData

  // 根据选项筛选
  if (options.rarity) {
    pool = pool.filter(op => op.稀有度 === String(options.rarity))
  }
  if (options.profession) {
    pool = pool.filter(op => op.职业 === options.profession)
  }
  if (options.branch) {
    pool = pool.filter(op => op.分支 === options.branch)
  }

  // 随机选择
  const shuffled = [...pool].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

/**
 * 获取所有分支数据
 * @returns {Array} 分支数组
 */
export const getAllBranches = () => {
  return branchesData
}

/**
 * 根据分支名称获取所属职业
 * @param {string} branch - 分支名称
 * @returns {string|null} 所属职业，如果不存在返回null
 */
export const getProfessionByBranch = (branch) => {
  const branchData = branchesData.find(b => b.分支 === branch)
  return branchData ? branchData.所属职业 : null
}

/**
 * 根据职业获取所有分支
 * @param {string} profession - 职业名称
 * @returns {Array} 分支名称数组
 */
export const getBranchesByProfession = (profession) => {
  return branchesData
    .filter(b => b.所属职业 === profession)
    .map(b => b.分支)
}

/**
 * 将干员数据转换为游戏使用的格式
 * @param {Object} operator - 原始干员数据
 * @returns {Object} 转换后的干员对象
 */
export const formatOperatorForGame = (operator) => {
  return {
    name: operator.干员,
    rarity: parseInt(operator.稀有度),
    profession: operator.职业,
    subClass: operator.分支,
    // 游戏状态字段
    isRevealed: false,
    isStarRevealed: false,
    isSubclassRevealed: false,
    cost: 0 // 调用点，由游戏逻辑决定
  }
}

/**
 * 获取职业的英文映射（用于显示）
 * @param {string} profession - 中文职业名
 * @returns {string} 英文职业名
 */
export const getProfessionEn = (profession) => {
  const map = {
    '近卫': 'GUARD',
    '狙击': 'SNIPER',
    '术师': 'CASTER',
    '医疗': 'MEDIC',
    '重装': 'DEFENDER',
    '先锋': 'VANGUARD',
    '辅助': 'SUPPORTER',
    '特种': 'SPECIALIST'
  }
  return map[profession] || profession
}

