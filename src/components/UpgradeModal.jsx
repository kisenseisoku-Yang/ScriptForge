import { X, Check } from 'lucide-react'
import { PLANS } from '../utils/plans.js'

export default function UpgradeModal({ onClose, onChoosePlan, currentPlan }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-noir-900 border border-gold-500/20 rounded-sm shadow-2xl my-6">
        {/* 关闭 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-ivory-400 hover:text-gold-400 border border-noir-700 hover:border-gold-500/50 transition-colors z-10"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="px-10 pt-10 pb-2 text-center">
          <div className="text-[10px] tracking-[0.4em] text-gold-500/70 uppercase mb-2">幕 后 · 文 字 剧 场</div>
          <h2 className="font-serif text-4xl text-gold-400 mb-2">选择你的版本</h2>
          <p className="text-ivory-300/70 text-sm">
            解锁电影美学工作台全部功能
            {currentPlan && currentPlan !== 'free' && currentPlan !== 'trial' && (
              <span className="block mt-1 text-gold-500/80 text-xs">当前已激活：{currentPlan}</span>
            )}
          </p>
          <div className="w-24 h-[1.5px] bg-gold-500/30 mx-auto mt-4 mb-6" />
        </div>

        {/* 方案卡片 */}
        <div className="px-10 pb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const Icon = plan.icon
            return (
              <div
                key={plan.id}
                className={`relative bg-noir-800/60 border p-5 rounded-sm flex flex-col transition-all duration-300 ${plan.accent} ${plan.highlight ? 'ring-1 ring-gold-500/30' : ''}`}
              >
                {plan.badge && (
                  <div className={`absolute -top-2.5 -right-2.5 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded-sm ${plan.highlight ? 'bg-gold-500 text-noir-900' : 'bg-noir-600 text-gold-500'}`}>
                    {plan.badge}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} className={plan.highlight ? 'text-gold-400' : 'text-gold-500/70'} />
                  <span className="font-serif text-lg text-ivory-100">{plan.name}</span>
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className={`font-serif text-3xl ${plan.highlight ? 'text-gold-400' : 'text-ivory-100'}`}>{plan.price}</span>
                  <span className="text-xs text-ivory-400">{plan.period}</span>
                </div>

                <ul className="flex-1 space-y-1.5 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-ivory-300/90">
                      <Check size={11} className={`mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-gold-400' : 'text-ivory-500'}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onChoosePlan(plan)}
                  className={`w-full py-2.5 text-[11px] uppercase tracking-[0.18em] font-semibold border transition-all duration-300 ${
                    plan.highlight
                      ? 'bg-gold-500 text-noir-900 border-gold-500 hover:bg-gold-400'
                      : 'border-noir-600 text-ivory-200 hover:border-gold-500 hover:text-gold-400'
                  }`}
                >
                  {plan.cta} →
                </button>
              </div>
            )
          })}
        </div>

        {/* 底部说明 */}
        <div className="px-10 pb-6 pt-2 border-t border-noir-700/60 text-center text-[10px] tracking-[0.15em] text-ivory-500">
          购买即表示同意《服务条款》 · 扫码支付后联系作者获取激活码
        </div>
      </div>
    </div>
  )
}
