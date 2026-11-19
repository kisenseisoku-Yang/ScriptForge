// 版本功能权限矩阵
// plan: free | trial | pro | lifetime
// 原则：trial 是有限免费试用；pro 和 lifetime 基本解锁全部

// 剧本格式预设：id -> 哪些 plan 可用
// 只保留有可靠出处、且版式确有差异的模板（内容模板已明确标注）
export const FORMAT_ACCESS = {
  hollywood:            ['trial', 'pro', 'lifetime'],  // 好莱坞 spec — 基准格式
  bbc:                  ['trial', 'pro', 'lifetime'],  // BBC/UK — 版式同好莱坞
  fountain:             ['trial', 'pro', 'lifetime'],  // Fountain 语法
  'cn-film':            ['trial', 'pro', 'lifetime'],  // 中文影视（行业惯例）
  'hollywood-tv':       ['trial', 'pro', 'lifetime'],  // 一小时剧（内容模板）
  'hollywood-halfhour': ['trial', 'pro', 'lifetime'],  // 半小时单机（内容模板）
  shooting:             ['trial', 'pro', 'lifetime'],  // 拍摄稿（制作版）
  'hollywood-multicam': ['pro', 'lifetime'],           // 多机位：对白双倍行距
  'bbc-radio':          ['pro', 'lifetime'],           // 广播剧：居中角色名、通栏对白
  stage:                ['pro', 'lifetime'],           // 舞台剧：Times 12pt
  'cn-gov':             ['pro', 'lifetime'],           // 广电申报稿：三号仿宋
}

// 分镜模板：id -> 哪些 plan 可用
export const STORYBOARD_ACCESS = {
  table_view:       ['trial', 'pro', 'lifetime'], // 表格视图 — 试用版也能用
  us_horizontal:    ['pro', 'lifetime'],          // 美式横向分镜 — 仅 Pro+
  jp_vertical:      ['pro', 'lifetime'],          // 日式竖向 Ekonte — 仅 Pro+
  cn_animation:     ['pro', 'lifetime'],          // 中式动画分镜 — 仅 Pro+
}

// 导出格式 -> 哪些 plan 可用
export const EXPORT_ACCESS = {
  pdf:     ['trial', 'pro', 'lifetime'],
  fountain:['trial', 'pro', 'lifetime'],
  fdx:     ['trial', 'pro', 'lifetime'],
  docx:    ['pro', 'lifetime'],
  html:    ['pro', 'lifetime'],
}

// 检查某功能对某 plan 是否可用
export function canUse(plan, accessMap, key) {
  if (!plan) return false
  const allowed = accessMap[key] || []
  return allowed.includes(plan)
}

// 过滤可用列表（返回 key 数组）
export function filterAllowed(plan, accessMap) {
  return Object.keys(accessMap).filter(k => canUse(plan, accessMap, k))
}

// 获取某 key 被哪些 plan 锁了
export function lockedFor(plan, accessMap, key) {
  return !canUse(plan, accessMap, key)
}

// 友好的 plan 中文名
export const PLAN_NAMES = {
  free:     '免费版',
  trial:    '试用版',
  pro:      'Pro 版',
  lifetime: '终身版',
}

// 锁了之后提示升级的文案
export const UPGRADE_HINT = {
  trial: '此功能仅限 Pro 版及以上可用，升级即可解锁',
  free:  '请先激活以使用此功能',
}
