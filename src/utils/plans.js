// 套餐目录 —— 主页与工作台共用的唯一价格来源
import { Crown, Sparkles, Gift, Rocket, Zap, CalendarRange } from 'lucide-react'

export const PLANS = [
  {
    id: 'trial',
    name: '试用版',
    price: '¥0',
    period: '7 天免费',
    accent: 'text-green-400 border-green-500/40 hover:border-green-500',
    badge: 'NEW',
    features: [
      '全格式预设（除 Netflix/广电）',
      '剧本编辑器 + 格式校验',
      '美式 / 日式 / 中式分镜',
      '公共领域壁纸库',
      'PDF / Fountain 导出',
      '工作台双栏布局',
    ],
    cta: '开始 7 天试用',
    highlight: false,
    icon: Gift,
  },
  {
    id: 'standard',
    name: '标准版',
    price: '¥15',
    period: '/ 月',
    accent: 'text-blue-300 border-blue-400/40 hover:border-blue-400',
    badge: null,
    features: [
      '试用版全部功能',
      'Netflix / 中国广电总局 格式',
      '剧本架（Pro 级收纳）',
      'DOCX / HTML 导出',
      '建筑艺术边框全套',
    ],
    cta: '选择标准版',
    highlight: false,
    icon: Rocket,
  },
  {
    id: 'annual',
    name: '包年版',
    price: '¥128',
    period: '/ 年 · 约 ¥10.7/月',
    accent: 'text-emerald-300 border-emerald-400/40 hover:border-emerald-400',
    badge: '省 ¥180',
    features: [
      'Pro 版全部功能',
      '按年付费，比月付省 ¥180',
      '一年内所有更新免费',
      '优先技术支持',
    ],
    cta: '选择包年版',
    highlight: false,
    icon: CalendarRange,
  },
  {
    id: 'pro',
    name: 'Pro 版',
    price: '¥45',
    period: '/ 月',
    accent: 'text-violet-300 border-violet-400/40 hover:border-violet-400',
    badge: null,
    features: [
      '标准版全部功能',
      '未来所有新增功能',
      '优先更新 / 抢先测试',
      '优先技术支持',
    ],
    cta: '选择 Pro',
    highlight: false,
    icon: Sparkles,
  },
  {
    id: 'promo',
    name: '新人优惠',
    price: '¥30',
    period: '连续包月',
    accent: 'text-gold-400 border-gold-500 hover:border-gold-400',
    badge: '限时',
    features: [
      'Pro 版全部权益',
      '新人专享连续包月价',
      '自动续费 · 随时取消',
    ],
    cta: '立即锁定 ¥30',
    highlight: true,
    icon: Zap,
  },
  {
    id: 'lifetime',
    name: '终身版',
    price: '¥299',
    period: '一次 · 永久',
    accent: 'text-gold-300 border-gold-400 hover:border-gold-300',
    badge: '最超值',
    features: [
      'Pro 版全部功能',
      '一次买断 · 永久使用',
      '未来更新全部免费',
      '专属付费优先通道',
    ],
    cta: '¥299 买断',
    highlight: true,
    icon: Crown,
  },
]

export const PLAN_BY_ID = PLANS.reduce((map, plan) => {
  map[plan.id] = plan
  return map
}, {})
