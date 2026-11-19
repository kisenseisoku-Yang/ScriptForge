import React, { useEffect, useMemo, useState } from 'react'
import {
  Layers, Check, AlertTriangle, Info, ChevronRight, BookOpen,
  MapPin, Film, Tv, Sparkles, RotateCcw,
} from 'lucide-react'
import {
  STYLES, LEVEL_INFO, getStyleById, isHardCheck, nodeChecksEnabled,
  analyzeStyle, defaultEpisodeCount, episodeFor, getDisputedNotes,
} from '../utils/styleLibrary.js'
import { getScript } from '../utils/scriptShelf.js'
import { saveProject } from '../utils/projectStore.js'
import { useI18n } from '../i18n/index.jsx'

const TRADITIONS = ['美国', '韩国', '日本']

const LEVEL_STYLE = {
  A: 'border-gold-500/60 text-gold-400 bg-gold-500/10',
  B: 'border-violet-400/50 text-violet-300 bg-violet-500/10',
  C: 'border-blue-400/50 text-blue-300 bg-blue-500/10',
  D: 'border-noir-500 text-ivory-300 bg-noir-700/40',
}

const NODE_STYLE = {
  hit: 'border-green-500/50 text-green-400 bg-green-500/10',
  missing: 'border-red-500/50 text-red-400 bg-red-500/10',
  warn: 'border-amber-500/50 text-amber-300 bg-amber-500/10',
  info: 'border-noir-600 text-ivory-300 bg-noir-800',
  pending: 'border-noir-700 text-ivory-500 bg-noir-800/50',
}

function LevelBadge({ level, small = false }) {
  const { t } = useI18n()
  return (
    <span className={`inline-flex items-center border ${LEVEL_STYLE[level]} ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'} uppercase tracking-[0.15em]`}>
      {t('{level} 级', { level })}
    </span>
  )
}

export default function StyleLibrary() {
  const { t } = useI18n()
  const [projectId, setProjectId] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [scriptText, setScriptText] = useState('')
  const [formatId, setFormatId] = useState('hollywood')
  const [appliedId, setAppliedId] = useState('')
  const [selectedId, setSelectedId] = useState(STYLES[0]?.id || '')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(() => {
    const saved = Number(localStorage.getItem('scriptforge_cursor_pct'))
    return Number.isFinite(saved) && saved > 0 ? saved : 100
  })
  const [episodes, setEpisodes] = useState(null)
  const [showDisputed, setShowDisputed] = useState(false)

  // 读取当前项目（编辑器写入的 active id）与已套用风格
  const loadCurrent = async (id) => {
    if (!id) return
    setProjectId(id)
    const script = await getScript(id)
    if (script) {
      setProjectTitle(script.title || '')
      setScriptText(script.content || '')
      setFormatId(script.formatId || 'hollywood')
      const applied = script.styleId || localStorage.getItem(`scriptforge_style_${id}`) || ''
      setAppliedId(applied)
      if (applied && getStyleById(applied)) setSelectedId(applied)
    } else {
      setProjectTitle('')
      setScriptText('')
    }
  }

  useEffect(() => {
    loadCurrent(localStorage.getItem('scriptforge_active_script_id')).catch(() => {})
    const onOpen = (e) => {
      const id = e.detail?.id
      if (id) loadCurrent(id).catch(() => {})
    }
    const onCursor = (e) => {
      const pct = Number(e.detail?.pct)
      if (Number.isFinite(pct)) setProgress(pct)
    }
    const onStyle = (e) => {
      if (e.detail?.styleId) setAppliedId(e.detail.styleId)
    }
    window.addEventListener('scriptforge:open-script', onOpen)
    window.addEventListener('scriptforge:cursor', onCursor)
    window.addEventListener('scriptforge:style-changed', onStyle)
    return () => {
      window.removeEventListener('scriptforge:open-script', onOpen)
      window.removeEventListener('scriptforge:cursor', onCursor)
      window.removeEventListener('scriptforge:style-changed', onStyle)
    }
  }, [])

  const style = getStyleById(selectedId) || STYLES[0]
  const levelInfo = LEVEL_INFO[style.level] || LEVEL_INFO.D
  const hard = isHardCheck(style)
  const checksOn = nodeChecksEnabled(style)
  const totalEpisodes = episodes ?? defaultEpisodeCount(style)

  useEffect(() => {
    setEpisodes(defaultEpisodeCount(style))
  }, [style.id])

  const result = useMemo(
    () => analyzeStyle(style, scriptText, { formatId, progressPct: progress, episodeCount: totalEpisodes }),
    [style, scriptText, formatId, progress, totalEpisodes]
  )

  const grouped = TRADITIONS.map(tradition => ({
    tradition,
    items: STYLES.filter(s => s.tradition === tradition),
  }))

  const handleClear = async () => {
    if (!projectId) return
    setSaving(true)
    try {
      await saveProject({ id: projectId, styleId: '' })
      localStorage.removeItem(`scriptforge_style_${projectId}`)
      setAppliedId('')
      window.dispatchEvent(new CustomEvent('scriptforge:style-changed', {
        detail: { projectId, styleId: '' },
      }))
      setStatus(t('已取消套用：项目回到未绑定风格的状态，剧本内容未改动'))
      setTimeout(() => setStatus(''), 3200)
    } catch (err) {
      setStatus(t('取消失败：{msg}', { msg: err.message || err }))
    } finally {
      setSaving(false)
    }
  }

  const handleApply = async () => {
    if (!projectId) {
      setStatus(t('还没有可套用的项目：请先在编辑器里保存一次剧本'))
      return
    }
    setSaving(true)
    try {
      await saveProject({ id: projectId, styleId: style.id })
      localStorage.setItem(`scriptforge_style_${projectId}`, style.id)
      setAppliedId(style.id)
      window.dispatchEvent(new CustomEvent('scriptforge:style-changed', {
        detail: { projectId, styleId: style.id },
      }))
      setStatus(t('已把「{name}」套用到当前项目，重新打开会自动恢复', { name: style.name }))
      setTimeout(() => setStatus(''), 3200)
    } catch (err) {
      setStatus(t('保存失败：{msg}', { msg: err.message || err }))
    } finally {
      setSaving(false)
    }
  }

  const disputed = getDisputedNotes()

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6">
      {/* 标题 */}
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-gold-500 mb-2">
            <Layers size={13} /> {t('Story Structure Library')}
          </div>
          <h1 className="headline-display text-3xl text-ivory-100">{t('剧作风格库')}</h1>
          <p className="text-xs text-ivory-400 mt-1">
            {t('13 种风格 · 62 个阶段 · 62 个节点。A 级可硬校验，B/C 级只提示，D 级不判错。')}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ivory-500 mb-1">{t('当前项目')}</div>
          <div className="text-sm text-ivory-100">{projectTitle || (projectId ? t('未命名剧本') : t('未打开剧本'))}</div>
          <div className="text-[10px] text-ivory-500 mt-1 flex items-center justify-end gap-2">
            <span>{appliedId ? t('已套用：{name}', { name: getStyleById(appliedId)?.name || appliedId }) : t('尚未套用风格')}</span>
            {appliedId && (
              <button
                onClick={handleClear}
                disabled={saving || !projectId}
                className="px-2 py-0.5 border border-noir-600 text-ivory-400 hover:border-red-400/60 hover:text-red-300 disabled:opacity-40"
                title={t('解除当前项目与风格的绑定（剧本内容不变）')}
              >
                {t('取消套用')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
        {/* 左侧：风格列表 */}
        <aside className="border border-noir-700 bg-noir-900/60 max-h-[calc(100vh-220px)] overflow-y-auto scroll-noir">
          {grouped.map(group => (
            <div key={group.tradition}>
              <div className="px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-gold-500/80 border-b border-noir-700 bg-noir-800 sticky top-0">
                {t(group.tradition)} · {group.items.length}
              </div>
              {group.items.map(item => {
                const active = item.id === style.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-4 py-3 border-b border-noir-700/50 transition-colors ${
                      active ? 'bg-noir-700/60 border-l-2 border-l-gold-500' : 'hover:bg-noir-800/70 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${active ? 'text-gold-400' : 'text-ivory-100'}`}>{item.name}</span>
                      <LevelBadge level={item.level} small />
                    </div>
                    <div className="text-[10px] text-ivory-500 mt-1 flex items-center gap-2">
                      {item.media.includes('剧集') ? <Tv size={10} /> : <Film size={10} />}
                      {item.media.map(m => t(m)).join(' / ')}
                      {item.id === appliedId && <span className="text-gold-500">{t('· 当前项目')}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        {/* 右侧：详情 */}
        <section className="min-w-0">
          <div className="border border-noir-700 bg-noir-900/60 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="headline text-2xl text-ivory-100">{style.name}</h2>
                  <LevelBadge level={style.level} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-ivory-500">
                    {t(style.tradition)} / {t(style.line)} / {style.media.map(m => t(m)).join('·')}
                  </span>
                </div>
                <div className="text-xs text-ivory-400 mt-1">{style.orig}</div>
                <div className="text-[11px] text-ivory-500 mt-2">{style.baseline}</div>
              </div>
              <div className="flex items-center gap-2">
                {style.id === appliedId ? (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2 text-xs border border-gold-500/50 text-gold-400 bg-gold-500/10 flex items-center gap-2">
                      <Check size={14} /> {t('已套用到当前项目')}
                    </span>
                    <button
                      onClick={handleClear}
                      disabled={saving || !projectId}
                      className="px-3 py-2 text-xs border border-noir-600 text-ivory-400 hover:border-red-400/60 hover:text-red-300 disabled:opacity-40"
                    >
                      {t('取消套用')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleApply}
                    disabled={saving || !projectId}
                    className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                      saving || !projectId
                        ? 'bg-noir-700 text-ivory-500 cursor-not-allowed'
                        : 'bg-gold-500 hover:bg-gold-400 text-noir-900'
                    }`}
                  >
                    <Sparkles size={15} /> {saving ? t('保存中…') : t('套用到当前剧本')}
                  </button>
                )}
              </div>
            </div>

            {/* 等级说明 */}
            <div className={`mt-4 border px-3 py-2 text-[11px] leading-relaxed ${LEVEL_STYLE[style.level]}`}>
              <span className="font-medium">{t(levelInfo.label)}</span>
              <span className="opacity-80"> · {t(levelInfo.desc)}</span>
              {style.level === 'D' && (
                <span className="block mt-1 text-ivory-400">
                  {t('节点缺失校验已关闭：下面只展示阶段区间与倾向，相同的结构偏离不会被判成错误。')}
                </span>
              )}
            </div>

            {status && (
              <div className="mt-3 text-[11px] text-gold-400 border border-gold-500/40 bg-gold-500/10 px-3 py-2">{status}</div>
            )}

            {/* 阶段时间轴 */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[0.25em] text-ivory-400">{t('阶段划分')}</div>
                <div className="text-[10px] text-ivory-500">
                  {t('当前 {pct}%', { pct: progress.toFixed(1) })}
                  {result?.isSeries && <span className="text-gold-500"> · {t('第 {ep} 集 / 共 {total} 集', { ep: episodeFor(progress, totalEpisodes), total: totalEpisodes })}</span>}
                </div>
              </div>
              <div className="relative flex h-10 border border-noir-700 overflow-hidden">
                {result.stages.map(st => {
                  const width = Math.max(0, st.end - st.start)
                  const current = st.state === 'current'
                  return (
                    <div
                      key={st.name}
                      style={{ width: `${width}%` }}
                      title={t('{name}：{start}–{end}%', { name: st.name, start: st.start, end: st.end })}
                      className={`h-full border-r border-noir-900/80 last:border-r-0 flex items-center justify-center px-1 transition-colors ${
                        current
                          ? 'bg-gold-500/25 text-gold-300'
                          : st.state === 'past'
                            ? 'bg-noir-700/70 text-ivory-400'
                            : 'bg-noir-800/50 text-ivory-600'
                      }`}
                    >
                      <span className="text-[9px] leading-tight text-center truncate">{st.name}</span>
                    </div>
                  )
                })}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-gold-400"
                  style={{ left: `${Math.min(99.7, progress)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-ivory-600 mt-1">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>

              <div className="mt-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-ivory-500 whitespace-nowrap">{t('当前进度')}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={progress}
                    onChange={e => setProgress(Number(e.target.value))}
                    className="w-full accent-yellow-500"
                  />
                </div>
                {result?.isSeries && (
                  <label className="flex items-center gap-2 text-[10px] text-ivory-500">
                    {t('全剧集数')}
                    <input
                      type="number"
                      min="1"
                      value={totalEpisodes}
                      onChange={e => setEpisodes(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 bg-noir-800 border border-noir-600 px-2 py-1 text-ivory-100 text-xs focus:outline-none focus:border-gold-500/60"
                    />
                  </label>
                )}
                <div className="flex items-center gap-1.5 text-[11px] text-ivory-300">
                  <MapPin size={12} className="text-gold-500" />
                  {t('落在：')}<span className="text-gold-400">{result.stage?.name || t('不在任何阶段区间')}</span>
                  {result.stage && <span className="text-ivory-500">{t('（{start}–{end}%）', { start: result.stage.start, end: result.stage.end })}</span>}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-ivory-600">
                {t('剧本识别：{scenes} 场 · {chars} 字符', { scenes: result.sceneCount, chars: scriptText.length })}
                {result.isSeries && t(' · 集号换算 floor({pct}/100 × {total}) + 1 = 第 {ep} 集', { pct: progress.toFixed(1), total: totalEpisodes, ep: episodeFor(progress, totalEpisodes) })}
              </div>
            </div>
          </div>

          {/* 节点校验 */}
          <div className="border border-noir-700 border-t-0 bg-noir-900/40 p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-[10px] uppercase tracking-[0.25em] text-ivory-400">
                {t('关键节点 · {mode}', { mode: checksOn ? (hard ? t('硬校验') : t('提示模式')) : t('仅作倾向描述') })}
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                {checksOn && <span className="text-green-400">{t('命中 {n}', { n: result.counts.hit })}</span>}
                {checksOn && <span className={result.counts.error ? 'text-red-400' : 'text-ivory-500'}>{t('错误 {n}', { n: result.counts.error })}</span>}
                {checksOn && <span className={result.counts.warn ? 'text-amber-300' : 'text-ivory-500'}>{t('提示 {n}', { n: result.counts.warn })}</span>}
                {!checksOn && <span className="text-ivory-400">{t('节点缺失不参与校验')}</span>}
              </div>
            </div>

            <div className="space-y-1.5">
              {result.nodes.map(node => {
                const tone = node.status === 'hit'
                  ? NODE_STYLE.hit
                  : node.status === 'missing'
                    ? (node.severity === 'error' ? NODE_STYLE.missing : NODE_STYLE.warn)
                    : node.status === 'info' ? NODE_STYLE.info : NODE_STYLE.pending
                const Icon = node.severity === 'error' ? AlertTriangle : node.status === 'hit' ? Check : Info
                return (
                  <div key={node.name} className={`border px-3 py-2 ${tone}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon size={12} className="flex-shrink-0" />
                        <span className="text-xs text-ivory-100">{node.name}</span>
                        <span className="text-[10px] opacity-60">{node.orig}</span>
                        {node.level && node.level !== 'A' && (
                          <span className="text-[9px] border border-noir-600 px-1 text-ivory-400">{t('{level} 级节点', { level: node.level })}</span>
                        )}
                      </div>
                      <span className="text-[10px] opacity-80">
                        {node.start === node.end ? `${node.start}%` : `${node.start}–${node.end}%`}
                        {result.isSeries && t(' · 第 {ep} 集', { ep: node.episodeEnd !== node.episodeStart ? `${node.episodeStart}–${node.episodeEnd}` : node.episodeStart })}
                      </span>
                    </div>
                    <div className="text-[10px] mt-1 opacity-75 leading-relaxed">{node.message}</div>
                    <div className="text-[10px] mt-1 text-ivory-500 leading-relaxed">{node.test}</div>
                  </div>
                )
              })}
            </div>

            {hard && result.structureIssues.length > 0 && (
              <div className="mt-3 border border-red-500/40 bg-red-500/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.2em] text-red-400 mb-1">{t('阶段/节点结构问题')}</div>
                {result.structureIssues.map((issue, i) => (
                  <div key={i} className="text-[11px] text-ivory-200">· {issue.message}</div>
                ))}
              </div>
            )}
          </div>

          {/* 倾向说明 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-noir-700 border-t-0 bg-noir-900/40">
            <div className="p-5 border-b md:border-b-0 md:border-r border-noir-700">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-ivory-400 mb-3">
                <BookOpen size={12} /> {t('倾向描述')}
              </div>
              {['character', 'conflict', 'info'].map(key => (
                <div key={key} className="mb-3 last:mb-0">
                  <div className="text-[10px] uppercase tracking-[0.15em] text-gold-500/80 mb-1">
                    {key === 'character' ? t('人物') : key === 'conflict' ? t('冲突') : t('信息')}
                  </div>
                  <ul className="space-y-0.5">
                    {(style.conv?.[key] || []).map((line, i) => (
                      <li key={i} className="text-[11px] text-ivory-300 leading-relaxed flex gap-1.5">
                        <ChevronRight size={10} className="text-noir-500 mt-1 flex-shrink-0" />{line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-ivory-400 mb-2">{t('常见失败模式')}</div>
              <ul className="space-y-1">
                {(style.failures || []).map((line, i) => (
                  <li key={i} className="text-[11px] text-ivory-300 leading-relaxed flex gap-1.5">
                    <span className="text-red-400/70">·</span>{line}
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-ivory-500 mb-1">{t('分级依据')}</div>
              <p className="text-[11px] text-ivory-400 leading-relaxed">{style.note}</p>
              {style.diff && (
                <>
                  <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-ivory-500 mb-1">{t('与其他线的差异')}</div>
                  <p className="text-[11px] text-ivory-400 leading-relaxed">{style.diff}</p>
                </>
              )}
            </div>
          </div>

          {/* 传统结构注释 */}
          <div className="border border-noir-700 border-t-0 bg-noir-900/20 p-4">
            <button
              onClick={() => setShowDisputed(v => !v)}
              className="text-[10px] uppercase tracking-[0.2em] text-ivory-400 hover:text-gold-400 flex items-center gap-2"
            >
              <RotateCcw size={11} />
              {t('{action}传统结构注释（无量化依据）', { action: showDisputed ? t('隐藏') : t('显示') })}
            </button>
            {showDisputed && (
              <div className="mt-3 space-y-2">
                {disputed.map(item => (
                  <div key={item.term} className="border border-noir-700 bg-noir-800/40 px-3 py-2">
                    <div className="text-xs text-ivory-100">
                      {item.term}
                      <span className="ml-2 text-[9px] border border-noir-600 px-1 text-ivory-400">{t('无量化依据 · {level} 级', { level: item.level })}</span>
                    </div>
                    <div className="text-[11px] text-ivory-400 mt-1 leading-relaxed">{item.evidence}</div>
                    <div className="text-[10px] text-amber-300/80 mt-1">{t('结论：{verdict}', { verdict: item.verdict })}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-[10px] text-ivory-600 leading-relaxed">
              {t('这些条目不进入默认结构，也不参与任何节点/阶段校验，只作为可选的注释性说明。')}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
