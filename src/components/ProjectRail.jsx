import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Layers, FolderKanban, Archive, Plus, RotateCcw, Loader2, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { loadShelf, addScript } from '../utils/scriptShelf.js'
import { useI18n } from '../i18n/index.jsx'

const ARCHIVE_KEY = 'scriptforge_archived_ids'

function loadArchived() {
  try {
    const list = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

function saveArchived(list) {
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list)) } catch { /* 忽略 */ }
}

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 编辑器左侧半透明项目栏：视图 / 环境 / 归档 + 新建项目；可向左收纳
export default function ProjectRail({ currentId, env, collapsed = false, onToggle = () => {} }) {
  const { t } = useI18n()
  const [tab, setTab] = useState('view')
  const [items, setItems] = useState([])
  const [archived, setArchived] = useState(loadArchived)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setItems(await loadShelf())
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh, currentId])

  const archivedSet = useMemo(() => new Set(archived), [archived])
  const activeItems = items.filter(item => !archivedSet.has(item.id))
  const archivedItems = items.filter(item => archivedSet.has(item.id))

  const openProject = (id) => {
    if (!id || id === currentId) return
    window.dispatchEvent(new CustomEvent('scriptforge:open-script', { detail: { id } }))
  }

  const toggleArchive = (id, next) => {
    const list = next
      ? Array.from(new Set([...archived, id]))
      : archived.filter(x => x !== id)
    setArchived(list)
    saveArchived(list)
  }

  const createProject = async () => {
    if (creating) return
    setCreating(true)
    try {
      const record = await addScript({ title: t('未命名剧本'), formatId: env?.formatId || 'hollywood' })
      await refresh()
      setTab('view')
      openProject(record.id)
    } catch (err) {
      window.alert(err?.message || String(err))
    } finally {
      setCreating(false)
    }
  }

  // 环境：当前项目的基础信息（管理员查看用）
  const current = items.find(item => item.id === currentId) || null
  const envRows = [
    { label: '标题', value: current?.title || t('未命名剧本') },
    { label: '格式', value: env?.formatName || '—' },
    { label: '风格', value: env?.styleName || t('未套用') },
    { label: '字数', value: env?.chars ?? 0 },
    { label: '页数', value: env?.pages ?? '—' },
    { label: '最后保存', value: formatTime(env?.savedAt || current?.updatedAt) },
  ]

  const TABS = [
    { id: 'view', label: '视图' },
    { id: 'env', label: '环境' },
    { id: 'archive', label: '归档' },
  ]

  const Row = ({ item, isArchived }) => (
    <div
      onClick={() => openProject(item.id)}
      className={`group relative px-3 py-2 cursor-pointer border-l-2 transition-colors ${
        item.id === currentId
          ? 'border-l-gold-500 bg-white/[0.06]'
          : 'border-l-transparent hover:bg-white/[0.04]'
      }`}
    >
      <div className={`text-[11px] truncate ${item.id === currentId ? 'text-gold-400' : 'text-ivory-200'}`}>
        {item.title || t('未命名剧本')}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[9px] tracking-[0.1em] text-ivory-500">
        <span className="tabular-nums">{formatTime(item.updatedAt)}</span>
        {item.contentLength > 0 && <span className="tabular-nums">{item.contentLength} {t('字')}</span>}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); toggleArchive(item.id, !isArchived) }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-ivory-500 opacity-0 group-hover:opacity-100 hover:text-gold-400 transition-opacity"
        title={isArchived ? t('恢复') : t('归档')}
      >
        {isArchived ? <RotateCcw size={12} /> : <Archive size={12} />}
      </button>
    </div>
  )

  if (collapsed) {
    return (
      <aside className="w-9 h-full flex-shrink-0 flex flex-col items-center bg-noir-950/55 backdrop-blur-sm border-r border-white/5">
        <button
          onClick={onToggle}
          className="w-9 h-9 flex items-center justify-center text-ivory-400 hover:text-gold-400 hover:bg-white/[0.06] transition-colors"
          title={t('展开项目栏')}
        >
          <ChevronRight size={14} />
        </button>
        <span
          className="mt-1 text-[9px] tracking-[0.35em] text-ivory-500"
          style={{ writingMode: 'vertical-rl' }}
        >
          {t('项目')}
        </span>
        <span className="mt-auto mb-2 text-[9px] tabular-nums text-ivory-500/70">
          {activeItems.length}
        </span>
      </aside>
    )
  }

  return (
    <aside className="w-56 h-full flex-shrink-0 flex flex-col bg-noir-950/55 backdrop-blur-sm border-r border-white/5 overflow-hidden">
      {/* 标题 */}
      <div className="px-3 h-9 flex items-center justify-between border-b border-white/5">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-ivory-400">
          <FolderKanban size={12} className="text-gold-500/80" />
          {t('项目')}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => refresh()}
            className="w-6 h-6 flex items-center justify-center text-ivory-500 hover:text-gold-400 transition-colors"
            title={t('刷新')}
          >
            <RefreshCw size={11} />
          </button>
          <button
            onClick={onToggle}
            className="w-6 h-6 flex items-center justify-center text-ivory-500 hover:text-gold-400 hover:bg-white/[0.06] transition-colors"
            title={t('向左收起项目栏')}
          >
            <ChevronLeft size={13} />
          </button>
        </div>
      </div>

      {/* 视图选项 */}
      <div className="flex border-b border-white/5">
        {TABS.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 h-8 text-[10px] tracking-[0.15em] transition-colors ${
              tab === item.id ? 'text-gold-400 bg-white/[0.06]' : 'text-ivory-400 hover:text-ivory-100 hover:bg-white/[0.03]'
            }`}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center text-ivory-500">
            <Loader2 size={14} className="animate-spin" />
          </div>
        ) : tab === 'env' ? (
          <div className="px-3 py-3 space-y-2.5">
            {envRows.map(row => (
              <div key={row.label} className="flex items-start justify-between gap-2">
                <span className="text-[10px] tracking-[0.1em] text-ivory-500">{t(row.label)}</span>
                <span className="text-[10px] text-ivory-200 text-right break-all">{row.value}</span>
              </div>
            ))}
            <div className="pt-2 text-[9px] leading-relaxed text-ivory-500/70">
              {t('环境展示当前剧本的纸面设定与保存状态。')}
            </div>
          </div>
        ) : tab === 'archive' ? (
          archivedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-ivory-500">
              <Archive size={16} />
              <span className="text-[10px] tracking-[0.15em]">{t('归档为空')}</span>
            </div>
          ) : archivedItems.map(item => <Row key={item.id} item={item} isArchived />)
        ) : activeItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-ivory-500">
            <Layers size={16} />
            <span className="text-[10px] tracking-[0.15em]">{t('暂无项目')}</span>
          </div>
        ) : activeItems.map(item => <Row key={item.id} item={item} isArchived={false} />)}
      </div>

      {/* 新建项目 */}
      <button
        onClick={createProject}
        disabled={creating}
        className="h-9 flex items-center justify-center gap-1.5 border-t border-white/5 text-[10px] uppercase tracking-[0.2em] text-ivory-300 hover:text-gold-400 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
      >
        {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        {t('新建项目')}
      </button>
    </aside>
  )
}
