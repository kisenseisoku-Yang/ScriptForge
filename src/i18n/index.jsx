// 轻量 i18n —— 以「中文原文」为 key，缺失时自动回落到中文。
// 这样新增文案不必先定义 key，未翻译的地方也不会显示成空白。
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import core from './entries/core.js'
import editor from './entries/editor.js'
import timeline from './entries/timeline.js'
import storyboard from './entries/storyboard.js'
import shelf from './entries/shelf.js'
import library from './entries/library.js'

export const LOCALES = [
  { id: 'zh-CN', label: '简体中文', en: 'Simplified Chinese' },
  { id: 'zh-TW', label: '繁體中文', en: 'Traditional Chinese' },
  { id: 'en', label: 'English', en: 'English' },
  { id: 'ja', label: '日本語', en: 'Japanese' },
  { id: 'ko', label: '한국어', en: 'Korean' },
  { id: 'fr', label: 'Français', en: 'French' },
]

const MODULES = [core, editor, timeline, storyboard, shelf, library]
const STORAGE_KEY = 'scriptforge_locale'
const DEFAULT_LOCALE = 'zh-CN'

function readLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LOCALES.some(l => l.id === saved)) return saved
  } catch { /* 忽略 */ }
  return DEFAULT_LOCALE
}

function buildDict(locale) {
  const dict = {}
  if (locale === DEFAULT_LOCALE) return dict
  for (const mod of MODULES) {
    const table = mod?.[locale]
    if (table) Object.assign(dict, table)
  }
  return dict
}

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (text) => text,
  locales: LOCALES,
})

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(readLocale)

  const dict = useMemo(() => buildDict(locale), [locale])

  const setLocale = useCallback((next) => {
    if (!LOCALES.some(l => l.id === next)) return
    setLocaleState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* 忽略 */ }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    window.dispatchEvent(new CustomEvent('scriptforge:locale-changed', { detail: locale }))
  }, [locale])

  // 跨标签页同步
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) setLocaleState(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // t('原文') 或 t('原文 {n} 项', { n: 3 })
  const t = useCallback((text, vars) => {
    if (text == null) return text
    const source = String(text)
    let out = dict[source] || source
    if (vars) {
      out = out.replace(/\{(\w+)\}/g, (m, key) => (vars[key] !== undefined ? String(vars[key]) : m))
    }
    return out
  }, [dict])

  const value = useMemo(() => ({ locale, setLocale, t, locales: LOCALES }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

export { STORAGE_KEY as LOCALE_STORAGE_KEY }
