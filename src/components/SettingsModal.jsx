import React from 'react'
import { Globe, X, Check } from 'lucide-react'
import { useI18n } from '../i18n/index.jsx'

export default function SettingsModal({ onClose }) {
  const { locale, setLocale, t, locales } = useI18n()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="modal-backdrop absolute inset-0" />
      <div
        className="relative z-10 card-noir art-corner p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto scroll-noir"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold-500 mb-2">Preferences</div>
            <h2 className="headline text-3xl text-ivory-100">{t('偏好设置')}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-noir-600 text-ivory-300 hover:text-gold-500 hover:border-gold-500/50 transition-colors"
            title={t('关闭')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="hairline mb-6" />

        <div className="text-[10px] uppercase tracking-[0.25em] text-gold-500 mb-3">{t('通用')}</div>

        <div className="flex items-center gap-2 mb-1 text-ivory-100 text-sm">
          <Globe size={14} className="text-gold-500" />
          {t('界面语言')}
        </div>
        <p className="text-[11px] text-ivory-400 mb-4 leading-relaxed">
          {t('选择工作台界面语言，切换后立即生效。')}
        </p>

        <div className="grid grid-cols-2 gap-2">
          {locales.map(item => {
            const active = item.id === locale
            return (
              <button
                key={item.id}
                onClick={() => setLocale(item.id)}
                className={`relative px-4 py-3 border text-left transition-colors ${
                  active
                    ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                    : 'border-noir-600 text-ivory-200 hover:border-gold-500/50 hover:text-gold-400'
                }`}
              >
                <div className="text-sm leading-tight">{item.label}</div>
                <div className="text-[9px] uppercase tracking-[0.15em] text-ivory-400 mt-1">{item.en}</div>
                {active && <Check size={14} className="absolute top-2.5 right-2.5 text-gold-500" />}
              </button>
            )
          })}
        </div>

        <div className="hairline mt-6 mb-4" />
        <p className="text-[10px] text-ivory-400 leading-relaxed">
          {t('语言设置保存在本地，下次打开自动沿用。')}
        </p>
      </div>
    </div>
  )
}
