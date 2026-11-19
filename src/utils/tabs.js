﻿﻿// 多标签页 Hook —— 类似 VS Code / Final Cut Pro
// Tab 结构: { id, type: 'editor'|'storyboard'|'shelf', title }
// 持久化到 sessionStorage（标签关闭就丢，不会像 localStorage 那样残留）

import { useState, useEffect, useCallback } from 'react'

const SESSION_KEY = 'scriptforge_tabs'
const DEFAULT_TAB = () => ({
  id: 'tab_' + Math.random().toString(36).slice(2, 8),
  type: 'editor',
  title: '剧本编辑器',
})

const TYPE_META = {
  editor:    { label: '剧本编辑器', icon: 'FileText' },
  timeline:  { label: '剧本叙事线', icon: 'Clapperboard' },
  storyboard:{ label: '分镜编辑器', icon: 'Film' },
  shelf:     { label: '剧本架',     icon: 'BookOpen' },
  style:     { label: '剧作风格库', icon: 'Layers' },
}

export function getTypeMeta(type) {
  return TYPE_META[type] || TYPE_META.editor
}

export function useTabs() {
  const [tabs, setTabs] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 旧会话里的标签标题按当前名称表刷新（例如“时间线”已改叫“叙事线”）
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(t => ({ ...t, title: getTypeMeta(t.type).label }))
        }
      }
    } catch {}
    return [DEFAULT_TAB()]
  })

  const [activeId, setActiveId] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY + '_active')
      if (saved) return saved
    } catch {}
    return tabs[0]?.id || null
  })

  // 持久化
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(tabs))
  }, [tabs])
  useEffect(() => {
    if (activeId) sessionStorage.setItem(SESSION_KEY + '_active', activeId)
  }, [activeId])

  // 确保至少有一个 tab
  useEffect(() => {
    if (tabs.length === 0) {
      const fresh = DEFAULT_TAB()
      setTabs([fresh])
      setActiveId(fresh.id)
    }
    if (!tabs.find(t => t.id === activeId)) {
      setActiveId(tabs[tabs.length - 1]?.id || tabs[0]?.id)
    }
  }, [tabs, activeId])

  // ============ API ============

  // 切换到已有 tab，如果没有就新建一个并切换
  const switchTo = useCallback((type) => {
    const existing = tabs.find(t => t.type === type)
    if (existing) {
      setActiveId(existing.id)
    } else {
      const meta = getTypeMeta(type)
      const newTab = {
        id: 'tab_' + Math.random().toString(36).slice(2, 8),
        type, title: meta.label,
      }
      setTabs(prev => [...prev, newTab])
      setActiveId(newTab.id)
    }
  }, [tabs])

  // 强制新建一个 tab（不管同类型是否已有）
  const addTab = useCallback((type) => {
    const meta = getTypeMeta(type)
    const newTab = {
      id: 'tab_' + Math.random().toString(36).slice(2, 8),
      type, title: meta.label,
    }
    setTabs(prev => [...prev, newTab])
    setActiveId(newTab.id)
  }, [])

  const closeTab = useCallback((id) => {
    setTabs(prev => prev.filter(t => t.id !== id))
  }, [])

  const closeOthers = useCallback((id) => {
    setTabs(prev => prev.filter(t => t.id === id))
    setActiveId(id)
  }, [])

  const closeAll = useCallback(() => {
    const fresh = DEFAULT_TAB()
    setTabs([fresh])
    setActiveId(fresh.id)
  }, [])

  const activeTab = tabs.find(t => t.id === activeId) || null

  return {
    tabs, activeId, activeTab,
    switchTo, addTab, closeTab, closeOthers, closeAll,
    setActiveId,
  }
}
