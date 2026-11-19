import { X, ArrowLeft, ShieldCheck, MessageCircle } from 'lucide-react'

export default function CheckoutModal({ plan, onClose, onBack }) {
  if (!plan) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-noir-900 border border-gold-500/20 rounded-sm shadow-2xl my-6">
        {/* 关闭 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-ivory-400 hover:text-gold-400 border border-noir-700 hover:border-gold-500/50 transition-colors z-10"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="px-10 pt-10 pb-6 text-center">
          <button
            onClick={onBack}
            className="absolute top-4 left-4 flex items-center gap-1 text-[11px] uppercase tracking-[0.15em] text-ivory-500 hover:text-gold-400 transition-colors"
          >
            <ArrowLeft size={12} /> 返回方案
          </button>
          <div className="text-[10px] tracking-[0.4em] text-gold-500/70 uppercase mb-2">支 付 方 式</div>
          <h2 className="font-serif text-3xl text-gold-400 mb-1">
            {plan.name}
            <span className="font-sans text-lg text-ivory-300/70 ml-2">
              {plan.price}{plan.period}
            </span>
          </h2>
          <div className="w-24 h-[1.5px] bg-gold-500/30 mx-auto mt-3 mb-2" />
          <p className="text-xs text-ivory-400">支付宝扫码支付 · 请按对应金额付款</p>
        </div>

        {/* 二维码 */}
        <div className="px-10 pb-8">
          <div className="flex flex-col items-center">
            <div className="p-3 bg-white border border-noir-600 rounded-sm shadow-lg">
              <img
                src="/payment/alipay-qr.png"
                alt="支付宝收款码"
                className="w-52 h-auto block select-none"
                draggable={false}
              />
            </div>
            <div className="text-center mt-4">
              <div className="text-[11px] tracking-[0.2em] text-gold-400">支付宝 · Alipay</div>
              <div className="text-[10px] text-ivory-500 mt-1">扫码后手动输入金额 {plan.price}</div>
            </div>
          </div>

          {/* 提示 */}
          <div className="mt-8 p-4 border border-noir-700 bg-noir-800/40 rounded-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck size={16} className="text-gold-500 mt-0.5 flex-shrink-0" />
              <div className="text-[11px] text-ivory-400 leading-relaxed">
                <div className="text-ivory-200 font-medium mb-1">购买流程</div>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>扫码支付 {plan.price}（备注你的邮箱）</li>
                  <li>截图支付凭证（含订单号 / 金额 / 时间）</li>
                  <li>把截图发给作者（联系方式见主页底部）</li>
                  <li>收到激活码后，在激活页粘贴即可解锁</li>
                </ol>
              </div>
            </div>
          </div>

          {/* 微信说明 */}
          <div className="mt-4 flex items-start gap-2 text-[11px] text-ivory-500 leading-relaxed">
            <MessageCircle size={13} className="text-gold-500/70 mt-0.5 flex-shrink-0" />
            <span>习惯用微信的话，加作者微信备注「购买」，作者会把微信收款码发给你。</span>
          </div>
        </div>

        {/* 底部 */}
        <div className="px-10 pb-6 pt-4 border-t border-noir-700/60 text-center text-[10px] tracking-[0.15em] text-ivory-500">
          一个激活码绑定一台设备 · 换机请联系作者解绑
        </div>
      </div>
    </div>
  )
}
