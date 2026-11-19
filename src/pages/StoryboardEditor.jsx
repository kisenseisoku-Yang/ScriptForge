﻿﻿import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Trash2, Download, Upload, LayoutGrid, Table, Image, Clock,
  Film, ChevronDown, Copy, Settings, Eye, EyeOff, Lock
} from 'lucide-react'
import {
  STORYBOARD_FIELDS, STORYBOARD_PRESETS,
  createEmptyStoryboardRow, calculateTotalDuration, groupByScene
} from '../utils/storyboardModel.js'
import { exportStoryboardCSV, exportStoryboardHTML } from '../utils/exporters.js'
import { useLicense } from '../utils/LicenseContext.jsx'
import { canUse, STORYBOARD_ACCESS, UPGRADE_HINT } from '../utils/planPermissions.js'
import { fileToCompressedDataURL } from '../utils/storyboardModel.js'
import { useI18n } from '../i18n/index.jsx'
import { getArtById } from '../utils/artLibrary.js'

// ============ 每种分镜模板正宗示例 ============
const SAMPLE_BY_PRESET = {

}
export default function StoryboardEditor() {
  const { t } = useI18n()
  const { plan } = useLicense()
  const [presetId, setPresetId] = useState('table_view')
  // 壁纸 —— 从 localStorage 读取，订阅 storage 事件跨组件同步
  const [wallpaperId, setWallpaperId] = useState(() => localStorage.getItem('scriptforge_wallpaper'))
  useEffect(() => {
    const handler = (e) => { if (e.key === 'scriptforge_wallpaper') setWallpaperId(e.newValue) }
    window.addEventListener('storage', handler)
    // 同标签页 WallpaperPicker setItem 不触发 storage，定时轮询兜底
    const poll = setInterval(() => setWallpaperId(localStorage.getItem('scriptforge_wallpaper')), 4000)
    return () => { window.removeEventListener('storage', handler); clearInterval(poll) }
  }, [])
  const wallpaperArt = wallpaperId ? getArtById(wallpaperId) : null
  const preset = STORYBOARD_PRESETS[presetId]

  const [rows, setRows] = useState(SAMPLE_BY_PRESET.table_view || [])
  const [showPreview, setShowPreview] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [presetMenuOpen, setPresetMenuOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const exportMenuRef = React.useRef(null)
  const presetMenuRef = React.useRef(null)

  const totalDuration = useMemo(() => calculateTotalDuration(rows), [rows])
  const groupedRows = useMemo(() => groupByScene(rows), [rows])

  // 切换分镜模板时自动加载该模板的正宗示例（仅当用户没有编辑过示例时）
  useEffect(() => {
    // 收集所有模板的所有示例 id
    const allSampleIds = new Set()
    Object.values(SAMPLE_BY_PRESET).forEach(sampleRows => {
      sampleRows.forEach(r => allSampleIds.add(r.id))
    })
    // 判断当前 rows 是否全部是示例数据
    const isSampleRows = rows.length > 0 && rows.every(r => allSampleIds.has(r.id))
    if (isSampleRows) {
      const newSample = SAMPLE_BY_PRESET[presetId]
      if (newSample) {
        // 确保不是同一份引用
        const currentIds = new Set(rows.map(r => r.id))
        const newIds = new Set(newSample.map(r => r.id))
        const isDifferentPreset = ![...currentIds].every(id => newIds.has(id)) || currentIds.size !== newIds.size
        if (isDifferentPreset) {
          setRows(newSample.map(r => ({ ...r })))
        }
      }
    }
    // 如果用户已经编辑过分镜（行 id 不是任何示例的 id），则不替换 —— 尊重用户内容
  }, [presetId])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportMenuOpen(false)
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target)) setPresetMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const updateRow = useCallback((id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }, [])

  const addRow = (scene = '') => {
    const newRow = createEmptyStoryboardRow(scene)
    // 自动填写镜号
    if (scene) {
      const sameScene = rows.filter(r => r.scene === scene)
      newRow.cut = String(sameScene.length + 1).padStart(2, '0')
    }
    setRows(prev => [...prev, newRow])
  }

  const addRowAfter = (id) => {
    const idx = rows.findIndex(r => r.id === id)
    const row = rows[idx]
    const newRow = createEmptyStoryboardRow(row?.scene || '')
    if (row?.scene) {
      const sameScene = rows.filter(r => r.scene === row.scene)
      newRow.cut = String(sameScene.length + 1).padStart(2, '0')
    }
    const newRows = [...rows]
    newRows.splice(idx + 1, 0, newRow)
    setRows(newRows)
  }

  const deleteRow = (id) => {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const duplicateRow = (id) => {
    const idx = rows.findIndex(r => r.id === id)
    const row = rows[idx]
    const copy = { ...row, id: Math.random().toString(36).slice(2) }
    const newRows = [...rows]
    newRows.splice(idx + 1, 0, copy)
    setRows(newRows)
  }

  const addScene = () => {
    const scenes = Object.keys(groupedRows).filter(s => s.startsWith('S'))
    const nextNum = scenes.length > 0
      ? Math.max(...scenes.map(s => parseInt(s.replace(/[^\d]/g, '') || '0'))) + 1
      : 1
    const newSceneId = `S${String(nextNum).padStart(2, '0')}`
    addRow(newSceneId)
  }

  const loadExample = () => setRows(SAMPLE_BY_PRESET[presetId] || SAMPLE_BY_PRESET.table_view)
  const clearAll = () => setRows([])

  const handleExport = (type) => {
    if (type === 'csv') exportStoryboardCSV(rows)
    if (type === 'html') exportStoryboardHTML(rows)
    setExportMenuOpen(false)
  }

  // ============ 分镜导入 + 自动解析 ============
  const handleImport = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const raw = e.target.result || ''
      let parsed = null
      const name = file.name.toLowerCase()
      if (name.endsWith('.json')) {
        try { parsed = JSON.parse(raw).rows || JSON.parse(raw) } catch { parsed = null }
      } else if (name.endsWith('.csv')) {
        try {
          const lines = raw.trim().split(/\r?\n/)
          const header = lines[0].split(',').map(h => h.trim())
          parsed = lines.slice(1).map(line => {
            const cols = line.split(',')
            const obj = {}
            header.forEach((h, i) => obj[h] = (cols[i] || '').trim())
            return { ...createEmptyStoryboardRow(), ...obj }
          })
        } catch { parsed = null }
      } else {
        // 纯文本：按场景/镜头号自动切分
        const blocks = raw.split(/\n\s*\n/)
        parsed = blocks.map((b, i) => {
          const lines = b.trim().split('\n')
          const sceneMatch = b.match(/[Ss](\d+)/)
          const cutMatch = b.match(/[Cc]ut\s*#?(\d+)|镜号\s*[:：]?\s*(\d+)/i)
          const shotMatch = b.match(/景别\s*[:：]?\s*(\S+)/)
          const durMatch = b.match(/(\d+(?:\.\d+)?)\s*(?:秒|s|sec)/i)
          return {
            ...createEmptyStoryboardRow(),
            id: `${Date.now()}-${i}`,
            scene: sceneMatch ? `S${sceneMatch[1]}` : '',
            cut: cutMatch ? (cutMatch[1] || cutMatch[2]) : String(i + 1).padStart(2, '0'),
            shotSize: shotMatch ? shotMatch[1] : '中景',
            duration: durMatch ? durMatch[1] : '3',
            image: lines.slice(0, 2).join(' '),
            action: lines.slice(2, 4).join(' '),
          }
        }).filter(r => r.image || r.action)
      }
      if (parsed && parsed.length > 0) {
        setRows(parsed)
        alert(t('✓ 导入成功：{name}\n解析到 {count} 个镜头\n已载入当前分镜模板（{preset}）', {
          name: file.name, count: parsed.length, preset: t(preset.name),
        }))
      } else {
        alert(t('无法识别文件格式，请使用 .csv / .json / .txt'))
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* 工具栏 */}
      <div className="border-b border-noir-700 px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* 分镜模板选择 */}
        <div className="relative" ref={presetMenuRef}>
          <button
            onClick={() => { setPresetMenuOpen(!presetMenuOpen); setExportMenuOpen(false) }}
            className="px-4 py-2 border border-noir-600 hover:border-gold-500/50 text-sm font-medium flex items-center gap-2 transition-colors text-ivory-100"
          >
            <LayoutGrid size={16} />
            {t(preset.name)}
            <ChevronDown size={14} />
          </button>

          {presetMenuOpen && (
            <div className="menu-noir animate-fade-in absolute top-full left-0 mt-1 w-64 py-2 z-50">
              {Object.values(STORYBOARD_PRESETS).map(p => {
                const locked = !canUse(plan, STORYBOARD_ACCESS, p.id)
                return (
                  <button
                    key={p.id}
                    disabled={locked}
                    title={locked ? t(UPGRADE_HINT[plan]) : ''}
                    onClick={() => { if (!locked) { setPresetId(p.id); setPresetMenuOpen(false) } }}
                    className={`w-full text-left px-4 py-2 transition-colors flex items-center justify-between border-b border-noir-700/50 ${
                      locked
                        ? 'opacity-50 cursor-not-allowed hover:bg-transparent text-ivory-400'
                        : `hover:bg-noir-700/30 text-ivory-100 ${presetId === p.id ? 'bg-noir-700/50' : ''}`
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {t(p.name)}
                      {locked && <Lock size={12} className="text-gold-500" />}
                    </span>
                    {locked && <span className="lock-chip">Pro</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-4 py-2 border border-noir-600 hover:border-gold-500/50 text-sm font-medium flex items-center gap-2 text-ivory-100"
        >
          <Settings size={16} />
          {showAdvanced ? t('简单模式') : t('高级模式')}
        </button>

        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border ${
            showPreview ? 'border-gold-500 text-gold-500' : 'border-noir-600 text-ivory-100'
          }`}
        >
          {showPreview ? <Eye size={16} /> : <EyeOff size={16} />}
          {showPreview ? t('隐藏预览') : t('显示预览')}
        </button>

        <div className="h-6 w-px bg-noir-700 mx-1" />

        {/* 操作按钮 */}
        <button
          onClick={addScene}
          className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-noir-900 text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} />
          {t('新场景')}
        </button>
        <button
          onClick={() => addRow()}
          className="px-4 py-2 btn-outline text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} />
          {t('新镜头')}
        </button>

        <div className="h-6 w-px bg-noir-700 mx-1" />

        <button
          onClick={loadExample}
          className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-ivory-400 hover:text-gold-500 border border-noir-700 hover:border-gold-500/50"
        >
          {t('加载示例')}
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-red-400 hover:text-red-300 border border-noir-700 hover:border-red-500/50"
        >
          {t('清空')}
        </button>

        <div className="flex-1" />

        {/* 统计 */}
        <div className="hidden lg:flex items-center gap-4 text-sm text-ivory-400 mr-4">
          <span className="flex items-center gap-1">
            <Film size={14} /> {t('{n} 个场景', { n: Object.keys(groupedRows).length })}
          </span>
          <span className="flex items-center gap-1">
            <LayoutGrid size={14} /> {t('{n} 个镜头', { n: rows.length })}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} /> {t('{sec} 秒', { sec: totalDuration.toFixed(1) })}
          </span>
        </div>

        {/* 导入 */}
        <label className="px-4 py-2 border border-noir-600 hover:border-gold-500/50 text-sm font-medium flex items-center gap-2 text-ivory-100 cursor-pointer">
          <Upload size={16} />
          {t('导入')}
          <input type="file" accept=".txt,.csv,.json,.fountain" className="hidden" onChange={e => handleImport(e.target.files?.[0])} />
        </label>

        {/* 导出 */}
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => { setExportMenuOpen(!exportMenuOpen); setPresetMenuOpen(false) }}
            className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-noir-900 text-sm font-medium flex items-center gap-2"
          >
            <Download size={16} />
            {t('导出')}
            <ChevronDown size={14} />
          </button>

          {exportMenuOpen && (
            <div className="menu-noir animate-fade-in absolute top-full right-0 mt-1 w-40 py-2 z-50">
              <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-ivory-100 hover:bg-noir-700/30 border-b border-noir-700/50">Excel/CSV</button>
              <button onClick={() => handleExport('html')} className="w-full text-left px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-ivory-100 hover:bg-noir-700/30">{t('HTML 表格')}</button>
            </div>
          )}
        </div>
      </div>

      {/* 主体区域（底图透壁纸） */}
      <div className="flex-1 flex overflow-hidden">
        {/* 编辑器 */}
        <div className={`${showPreview ? 'w-1/2 border-r border-noir-700/60' : 'w-full'} overflow-auto bg-noir-900/75 p-4`}>
          {rows.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎬</div>
              <h2 className="headline text-2xl text-ivory-100 mb-2">{t('开始创建分镜表')}</h2>
              <p className="text-ivory-400 mb-6">{t('点击「新场景」或「新镜头」开始你的创作')}</p>
              <button
                onClick={() => addRow()}
                className="btn-gold font-semibold"
              >
                {t('+ 创建第一个镜头')}
              </button>
            </div>
          ) : presetId === 'table_view' ? (
            <StoryboardTable
              rows={rows}
              fields={showAdvanced ? STORYBOARD_FIELDS : STORYBOARD_FIELDS.slice(0, 7)}
              onUpdate={updateRow}
              onAddAfter={addRowAfter}
              onDelete={deleteRow}
              onDuplicate={duplicateRow}
            />
          ) : (
            <StoryboardCards
              rows={rows}
              preset={preset}
              onUpdate={updateRow}
              onAddAfter={addRowAfter}
              onDelete={deleteRow}
            />
          )}
        </div>

        {/* 预览 */}
        {showPreview && (
          <div className="flex-1 overflow-auto bg-noir-900/75">
            <StoryboardPreview rows={rows} preset={preset} grouped={groupedRows} totalDuration={totalDuration} />
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== 表格视图 ====================
function StoryboardTable({ rows, fields, onUpdate, onAddAfter, onDelete, onDuplicate }) {
  const { t } = useI18n()
  return (
    <div className="border border-noir-600 overflow-x-auto">
      <table className="min-w-full text-sm text-ivory-200">
        <thead className="bg-noir-800 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-gold-500 border-b border-noir-600 w-10">#</th>
            {fields.map(f => (
              <th key={f.key} className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-gold-500 border-b border-noir-600 min-w-[80px]">
                {t(f.label)}
              </th>
            ))}
            <th className="px-3 py-2 text-center text-[10px] uppercase tracking-[0.15em] text-gold-500 border-b border-noir-600 w-28">{t('操作')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} className="border-b border-noir-700 hover:border-gold-500/30">
              <td className="px-3 py-2 text-ivory-400 text-center">{idx + 1}</td>
              {fields.map(field => (
                <td key={field.key} className="px-2 py-1">
                  {field.type === 'select' ? (
                    <select
                      value={row[field.key] || ''}
                      onChange={e => onUpdate(row.id, field.key, e.target.value)}
                      className="w-full px-2 py-1.5 border border-noir-600 text-sm bg-noir-800 text-ivory-100 focus:outline-none focus:border-gold-500"
                    >
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>{t(opt)}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={row[field.key] || ''}
                      onChange={e => onUpdate(row.id, field.key, e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1.5 border border-noir-600 text-sm bg-noir-800 text-ivory-100 resize-none focus:outline-none focus:border-gold-500"
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={row[field.key] || ''}
                      onChange={e => onUpdate(row.id, field.key, e.target.value)}
                      placeholder={t(field.placeholder) || ''}
                      className="w-full px-2 py-1.5 border border-noir-600 text-sm bg-noir-800 text-ivory-100 focus:outline-none focus:border-gold-500"
                    />
                  )}
                </td>
              ))}
              <td className="px-2 py-1">
                <div className="flex gap-1 justify-center">
                  <button
                    onClick={() => onAddAfter(row.id)}
                    className="p-1.5 hover:bg-gold-500/20 text-gold-500"
                    title={t('在下方插入')}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => onDuplicate(row.id)}
                    className="p-1.5 hover:bg-gold-500/20 text-gold-500"
                    title={t('复制')}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(row.id)}
                    className="p-1.5 hover:bg-red-500/20 text-red-400"
                    title={t('删除')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ==================== 卡片视图 ====================
// ==================== 分镜卡（按布局分发） ====================
function StoryboardCards({ rows, preset, onUpdate, onAddAfter, onDelete }) {
  const { t } = useI18n()
  const handleImageFile = async (rowId, file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { alert(t('请选择图片文件')); return }
    if (file.size > 8 * 1024 * 1024) { alert(t('图片超过 8MB')); return }
    try { onUpdate(rowId, 'imageData', await fileToCompressedDataURL(file)) }
    catch (err) { alert(t('图片处理失败：{msg}', { msg: err.message })) }
  }

  const grouped = groupByScene(rows)
  const layout = preset.layout

  if (layout === 'american')
    return <AmericanHorizontalCards grouped={grouped} preset={preset} onUpdate={onUpdate} onAddAfter={onAddAfter} onDelete={onDelete} handleImageFile={handleImageFile} />
  if (layout === 'ekonte')
    return <JapaneseEkonteCards grouped={grouped} preset={preset} onUpdate={onUpdate} onAddAfter={onAddAfter} onDelete={onDelete} handleImageFile={handleImageFile} />
  if (layout === 'animation')
    return <ChineseAnimationCards grouped={grouped} preset={preset} onUpdate={onUpdate} onAddAfter={onAddAfter} onDelete={onDelete} handleImageFile={handleImageFile} />
  return null
}

// ============ 🇺🇸 美式横向 · Film Storyboard ============
// 剧作学特征：4×6 卡片网格、胶片齿孔顶、2.39:1 宽屏、底部 metadata strip
function AmericanHorizontalCards({ grouped, preset, onUpdate, onAddAfter, onDelete, handleImageFile }) {
  const { t } = useI18n()
  const cols = preset.panelsPerRow || 3
  return (
    <div className="space-y-10">
      {Object.entries(grouped).map(([scene, sceneRows]) => (
        <div key={scene}>
          {/* 场景分隔 */}
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-gold-500/10 border border-gold-500/40 text-gold-400 text-[10px] uppercase tracking-[0.2em]">{t('场景 {scene}', { scene: t(scene) })}</span>
            <span className="text-xs text-ivory-500">{sceneRows.length} shots</span>
            <div className="flex-1 h-px bg-gradient-to-r from-gold-500/30 to-transparent" />
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(240px, 1fr))` }}>
            {sceneRows.map(row => (
              <div key={row.id} className="story-film-card group relative bg-noir-800 border border-noir-600">
                {/* 顶部胶片齿孔 */}
                <div className="film-perforation h-3" />

                {/* 2.39:1 画面 */}
                <div className="relative bg-noir-900" style={{ aspectRatio: '2.39/1' }}>
                  {row.imageData ? (
                    <img src={row.imageData} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] flex items-center justify-center">
                        <Image size={32} className="text-ivory-500/40" />
                      </div>
                      <textarea value={row.image || ''} onChange={e => onUpdate(row.id, 'image', e.target.value)}
                        className="absolute inset-0 w-full h-full bg-transparent p-2 text-[11px] resize-none focus:outline-none text-ivory-300"
                        placeholder={t('画面描述...')} />
                    </>
                  )}

                  {/* 顶角标 */}
                  <div className="absolute top-1 left-1 flex gap-1">
                    <span className="px-1.5 py-0.5 bg-black/80 text-ivory-100 text-[9px] tracking-wider">{row.scene || '?'}</span>
                    <span className="px-1.5 py-0.5 bg-gold-500/90 text-noir-900 text-[9px] font-bold">#{row.cut || '?'}</span>
                  </div>
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/80 text-ivory-200 text-[9px] font-mono">{row.duration || '?'}s</div>

                  {/* 悬浮图片操作 */}
                  <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <label className="px-1.5 py-0.5 bg-gold-500/90 hover:bg-gold-400 text-noir-900 text-[9px] cursor-pointer">
                      {row.imageData ? t('换图') : '📷'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageFile(row.id, e.target.files?.[0])} />
                    </label>
                  </div>
                </div>

                {/* metadata strip —— 美式工业标准信息条 */}
                <div className="bg-noir-900/80 border-t border-noir-700 px-2 py-1.5">
                  <div className="flex items-center gap-2 text-[9px] tracking-wider">
                    <select value={row.shotSize || '中景'} onChange={e => onUpdate(row.id, 'shotSize', e.target.value)}
                      className="bg-noir-800 border border-noir-600 px-1 py-0.5 text-ivory-200 focus:outline-none focus:border-gold-500">
                      {['特写','近景','中景','中远景','远景','全景','过肩','主观'].map(s => <option key={s} value={s}>{t(s)}</option>)}
                    </select>
                    <span className="text-noir-600">|</span>
                    <select value={row.cameraMove || '固定'} onChange={e => onUpdate(row.id, 'cameraMove', e.target.value)}
                      className="bg-noir-800 border border-noir-600 px-1 py-0.5 text-ivory-200 focus:outline-none focus:border-gold-500">
                      {['固定','推','拉','摇','移','跟','手持','稳定器'].map(s => <option key={s} value={s}>{t(s)}</option>)}
                    </select>
                    {row.sfx && <><span className="text-noir-600">|</span><span className="text-noir-500 italic">🔊 {row.sfx}</span></>}
                  </div>
                </div>

                {/* 台词区 —— 美式卡独立台词框 */}
                <div className="bg-noir-800 p-2 border-t border-noir-700">
                  <textarea value={row.dialogue || ''} onChange={e => onUpdate(row.id, 'dialogue', e.target.value)} rows={2}
                    className="w-full text-[11px] px-2 py-1 bg-noir-900 border border-noir-600 text-ivory-100 resize-none focus:outline-none focus:border-gold-500 font-serif italic"
                    placeholder={t('人物对话 / VO...')} />
                </div>

                {/* 行操作 */}
                <div className="flex border-t border-noir-700 text-[10px]">
                  <button onClick={() => onAddAfter(row.id)} className="flex-1 py-1 text-gold-500 hover:bg-gold-500/10">{t('+ 插入')}</button>
                  <button onClick={() => onDelete(row.id)} className="flex-1 py-1 text-red-400 hover:bg-red-500/10 border-l border-noir-700">{t('删除')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============ 🇯🇵 日式竖向 · Ekonte ============
// 剧作学特征：纵向时间轴、2:3 竖构图、侧边时间码栏、手写字体
function JapaneseEkonteCards({ grouped, onUpdate, onAddAfter, onDelete, handleImageFile }) {
  const { t } = useI18n()
  return (
    <div className="space-y-12">
      {Object.entries(grouped).map(([scene, sceneRows]) => (
        <div key={scene} className="ekonte-vertical">
          {/* 场景头 —— 日式手写风 */}
          <div className="mb-5">
            <div className="inline-flex items-center gap-2 border-l-2 border-gold-500 pl-3 py-1">
              <span className="text-gold-400 font-serif text-lg">場面 {scene}</span>
              <span className="text-xs text-ivory-500">· {sceneRows.length} カット</span>
            </div>
          </div>

          {/* 竖向时间轴 */}
          <div className="relative pl-8">
            {/* 侧边时间码轨道 */}
            <div className="absolute left-2 top-0 bottom-0 w-px bg-noir-600" />

            {sceneRows.map((row, idx) => (
              <div key={row.id} className="ekonte-panel group relative mb-6">
                {/* 侧边编号 */}
                <div className="absolute -left-8 top-2 w-6 text-right">
                  <div className="font-serif text-gold-500 text-lg leading-none">{String(idx + 1).padStart(2, '0')}</div>
                  <div className="text-[9px] text-noir-500 mt-0.5">{row.duration || '?'}s</div>
                </div>

                <div className="flex gap-4">
                  {/* 2:3 竖构图画面 —— 日式经典比例 */}
                  <div className="w-40 flex-shrink-0">
                    <div className="relative bg-noir-900 border border-noir-600" style={{ aspectRatio: '2/3' }}>
                      {row.imageData ? (
                        <img src={row.imageData} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-noir-800/50 flex items-center justify-center">
                            <Image size={28} className="text-ivory-500/40" />
                          </div>
                          <textarea value={row.image || ''} onChange={e => onUpdate(row.id, 'image', e.target.value)}
                            className="absolute inset-0 w-full h-full bg-transparent p-2 text-[11px] resize-none focus:outline-none text-ivory-300"
                            placeholder={t('画面...')} />
                        </>
                      )}
                      {/* 左下角镜号 */}
                      <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-gold-500/90 text-noir-900 text-[9px] font-bold rounded-sm">#{row.cut}</div>
                    </div>
                  </div>

                  {/* 右侧文字信息 —— 日式分镜重"动作连贯" */}
                  <div className="flex-1 min-w-0 border-l border-noir-700 pl-4 space-y-2">
                    {/* 景别 + 运镜 标签 */}
                    <div className="flex flex-wrap gap-1.5">
                      <select value={row.shotSize || '中景'} onChange={e => onUpdate(row.id, 'shotSize', e.target.value)}
                        className="bg-noir-800 border border-noir-600 px-2 py-1 text-[10px] text-gold-400 focus:outline-none focus:border-gold-500">
                        {['特写','近景','中景','远景','全景','过肩'].map(s => <option key={s} value={s}>{t(s)}</option>)}
                      </select>
                      <select value={row.cameraMove || '固定'} onChange={e => onUpdate(row.id, 'cameraMove', e.target.value)}
                        className="bg-noir-800 border border-noir-600 px-2 py-1 text-[10px] text-ivory-300 focus:outline-none focus:border-gold-500">
                        {['固定','推','拉','摇','移','跟','手持'].map(s => <option key={s} value={s}>{t(s)}</option>)}
                      </select>
                    </div>

                    {/* 动作 —— 日文 ekonte 最强调的部分 */}
                    <div>
                      <div className="text-[9px] tracking-wider text-noir-500 uppercase mb-0.5">動作 · Action</div>
                      <textarea value={row.action || ''} onChange={e => onUpdate(row.id, 'action', e.target.value)} rows={2}
                        className="w-full text-[11px] px-2 py-1 bg-noir-900 border border-noir-600 text-ivory-200 resize-none focus:outline-none focus:border-gold-500"
                        placeholder={t('人物动作 / 表情变化...')} />
                    </div>

                    {/* 台词 */}
                    <div>
                      <div className="text-[9px] tracking-wider text-noir-500 uppercase mb-0.5">セリフ · Dialogue</div>
                      <textarea value={row.dialogue || ''} onChange={e => onUpdate(row.id, 'dialogue', e.target.value)} rows={2}
                        className="w-full text-[11px] px-2 py-1 bg-noir-900 border border-noir-600 text-ivory-100 resize-none focus:outline-none focus:border-gold-500 italic"
                        placeholder={t('台词...')} />
                    </div>

                    {/* 操作 */}
                    <div className="flex gap-1 pt-1">
                      <label className="px-2 py-0.5 bg-gold-500/20 hover:bg-gold-500/40 text-gold-400 text-[10px] cursor-pointer border border-gold-500/40">
                        {row.imageData ? t('换图') : t('📷 上传')}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageFile(row.id, e.target.files?.[0])} />
                      </label>
                      <button onClick={() => onAddAfter(row.id)} className="px-2 py-0.5 text-[10px] text-gold-500 border border-noir-600 hover:border-gold-500">{t('+ 插入')}</button>
                      <button onClick={() => onDelete(row.id)} className="px-2 py-0.5 text-[10px] text-red-400 border border-noir-600 hover:border-red-500">{t('删除')}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============ 🇨🇳 中式动画 · Animation Cel ============
// 剧作学特征：16:9 赛璐璐格、动作/对白/音效三栏独立、原画 pose 强调
function ChineseAnimationCards({ grouped, preset, onUpdate, onAddAfter, onDelete, handleImageFile }) {
  const { t } = useI18n()
  const cols = preset.panelsPerRow || 3
  return (
    <div className="space-y-10">
      {Object.entries(grouped).map(([scene, sceneRows]) => (
        <div key={scene}>
          {/* 场景头 */}
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-noir-800 border border-noir-500 text-ivory-200 text-[11px] tracking-wider">{t('场次 · {scene}', { scene: t(scene) })}</span>
            <span className="text-xs text-ivory-500">{t('{n} 镜头', { n: sceneRows.length })}</span>
            <div className="flex-1 h-px bg-noir-700" />
          </div>

          <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(260px, 1fr))` }}>
            {sceneRows.map(row => (
              <div key={row.id} className="animation-cel group bg-noir-900 border-2 border-red-900/60 relative">
                {/* 赛璐璐格角标 */}
                <div className="absolute -top-2 -left-2 w-4 h-4 border-l-2 border-t-2 border-red-500 z-10" />
                <div className="absolute -top-2 -right-2 w-4 h-4 border-r-2 border-t-2 border-red-500 z-10" />

                {/* 16:9 宽屏画面 —— 动画标准 */}
                <div className="relative bg-noir-950" style={{ aspectRatio: '16/9' }}>
                  {row.imageData ? (
                    <img src={row.imageData} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      {/* 动画格十字参考线 */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5" />
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Image size={36} className="text-red-400/30" />
                      </div>
                      <textarea value={row.image || ''} onChange={e => onUpdate(row.id, 'image', e.target.value)}
                        className="absolute inset-0 w-full h-full bg-transparent p-3 text-[12px] resize-none focus:outline-none text-ivory-300 z-10"
                        placeholder={t('原画 Pose / 关键帧描述...')} />
                    </>
                  )}
                  {/* 编号角标 */}
                  <div className="absolute top-1.5 left-1.5 bg-red-900/90 text-white px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
                    CUT #{row.cut || '?'} · {row.duration || '?'}s
                  </div>
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <select value={row.shotSize || '中景'} onChange={e => onUpdate(row.id, 'shotSize', e.target.value)}
                      className="bg-noir-900/90 border border-noir-600 px-1 py-0.5 text-[9px] text-ivory-200 focus:outline-none focus:border-gold-500">
                      {['特写','近景','中景','远景','全景','过肩'].map(s => <option key={s} value={s}>{t(s)}</option>)}
                    </select>
                    <select value={row.cameraMove || '固定'} onChange={e => onUpdate(row.id, 'cameraMove', e.target.value)}
                      className="bg-noir-900/90 border border-noir-600 px-1 py-0.5 text-[9px] text-ivory-200 focus:outline-none focus:border-gold-500">
                      {['固定','推','拉','摇','移','跟','手持'].map(s => <option key={s} value={s}>{t(s)}</option>)}
                    </select>
                  </div>
                  {/* 悬浮图片操作 */}
                  <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <label className="px-1.5 py-0.5 bg-red-900/90 hover:bg-red-800 text-white text-[9px] cursor-pointer">
                      {row.imageData ? t('换图') : '📷'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageFile(row.id, e.target.files?.[0])} />
                    </label>
                  </div>
                </div>

                {/* 动画三行：动作 / 对白 / 音效 —— 中国动画行业标准 */}
                <div className="divide-y divide-noir-700">
                  {/* Row 1: 动作 */}
                  <div className="bg-noir-800/80 px-2 py-1.5 flex gap-2 items-start">
                    <span className="text-[9px] tracking-wider text-blue-400 flex-shrink-0 w-8 mt-0.5">{t('动作')}</span>
                    <textarea value={row.action || ''} onChange={e => onUpdate(row.id, 'action', e.target.value)} rows={1}
                      className="flex-1 text-[11px] px-2 py-0.5 bg-noir-900 border border-noir-700 text-ivory-200 resize-none focus:outline-none focus:border-red-500"
                      placeholder={t('动作描述...')} />
                  </div>
                  {/* Row 2: 对白 */}
                  <div className="bg-noir-800/60 px-2 py-1.5 flex gap-2 items-start">
                    <span className="text-[9px] tracking-wider text-gold-400 flex-shrink-0 w-8 mt-0.5">{t('对白')}</span>
                    <textarea value={row.dialogue || ''} onChange={e => onUpdate(row.id, 'dialogue', e.target.value)} rows={1}
                      className="flex-1 text-[11px] px-2 py-0.5 bg-noir-900 border border-noir-700 text-ivory-100 resize-none focus:outline-none focus:border-gold-500 italic"
                      placeholder={t('台词...')} />
                  </div>
                  {/* Row 3: 音效 + 备注 */}
                  <div className="bg-noir-800/40 px-2 py-1.5 flex gap-2 items-start">
                    <span className="text-[9px] tracking-wider text-purple-400 flex-shrink-0 w-8 mt-0.5">{t('音效')}</span>
                    <input value={row.sfx || ''} onChange={e => onUpdate(row.id, 'sfx', e.target.value)}
                      className="flex-1 text-[11px] px-2 py-0.5 bg-noir-900 border border-noir-700 text-ivory-300 focus:outline-none focus:border-purple-500"
                      placeholder={t('SFX...')} />
                  </div>
                </div>

                {/* 操作 */}
                <div className="flex border-t border-noir-700 text-[10px]">
                  <button onClick={() => onAddAfter(row.id)} className="flex-1 py-1 text-gold-500 hover:bg-gold-500/10">{t('+ 插入')}</button>
                  <button onClick={() => onDelete(row.id)} className="flex-1 py-1 text-red-400 hover:bg-red-500/10 border-l border-noir-700">{t('删除')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ==================== 预览视图（全 Noir 暗金主题） ====================
function StoryboardPreview({ rows, preset, grouped, totalDuration }) {
  const { t } = useI18n()
  return (
    <div className="p-6 bg-noir-900 text-ivory-100">
      <div className="text-center mb-8">
        <h1 className="headline text-3xl text-gold-gradient mb-2">{t('分镜表 · Storyboard')}</h1>
        <p className="text-ivory-400 text-sm tracking-wider">
          {t('{scenes} 场景 · {shots} 镜头 · 总时长 ≈ {duration}s', {
            scenes: Object.keys(grouped).length,
            shots: rows.length,
            duration: totalDuration.toFixed(1),
          })}
        </p>
      </div>

      {/* 按场景分组展示 */}
      {Object.entries(grouped).map(([scene, sceneRows]) => (
        <div key={scene} className="mb-10">
          {/* 场景头 —— 金色饰条 */}
          <div className="flex items-center gap-4 mb-5 pb-3 border-b border-gold-500/30">
            <span className="px-4 py-1.5 bg-gold-500/10 border border-gold-500/40 text-gold-400 text-xs tracking-[0.2em] font-medium">
              {t('场景 {scene}', { scene: t(scene) })}
            </span>
            <span className="text-xs text-ivory-400">
              {t('{n} 镜头 · {duration}s', { n: sceneRows.length, duration: calculateTotalDuration(sceneRows).toFixed(1) })}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-gold-500/30 to-transparent" />
          </div>

          {/* 美式横向预览 */}
          {preset.layout === 'american' && (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${preset.panelsPerRow || 3}, 1fr)` }}>
              {sceneRows.map(row => (
                <div key={row.id} className="bg-noir-800 border border-noir-700 overflow-hidden">
                  <div className="aspect-video bg-noir-950 flex items-center justify-center relative">
                    <span className="text-noir-600 text-4xl">🎬</span>
                    <div className="absolute top-2 left-2 text-[10px] bg-noir-900/90 text-ivory-200 px-2 py-0.5 border border-gold-500/30 font-mono">
                      #{row.cut} · {t(row.shotSize)}
                    </div>
                    <div className="absolute bottom-2 right-2 text-[10px] bg-gold-500/90 text-noir-900 px-2 py-0.5 font-bold">
                      {row.duration}s
                    </div>
                  </div>
                  <div className="p-3 space-y-2 text-xs text-ivory-200">
                    {row.image && <div className="text-ivory-300">{row.image}</div>}
                    <div className="flex gap-2">
                      <span className="px-1.5 py-0.5 bg-gold-500/15 border border-gold-500/30 text-gold-400 text-[10px] tracking-wider">{t(row.cameraMove)}</span>
                      {row.sfx && <span className="px-1.5 py-0.5 bg-noir-700 text-noir-400 text-[10px]">🔊 {row.sfx}</span>}
                    </div>
                    {row.dialogue && (
                      <div className="bg-noir-900 border-l-2 border-gold-500/50 pl-2 py-1 italic text-ivory-100">"{row.dialogue}"</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 日式竖向预览 */}
          {preset.layout === 'ekonte' && (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {sceneRows.map(row => (
                <div key={row.id} className="w-44 flex-shrink-0 flex flex-col gap-2">
                  <div className="aspect-[2/3] bg-noir-950 border border-noir-700 flex flex-col items-center justify-center relative p-2">
                    <span className="text-noir-600 text-3xl">🎬</span>
                    <div className="absolute top-1.5 left-1.5 text-[9px] bg-gold-500/90 text-noir-900 px-1.5 py-0.5 font-bold">
                      #{row.cut}
                    </div>
                    <div className="text-center text-[11px] text-ivory-300 mt-2 px-1 leading-tight">
                      {row.image || t('画面')}
                    </div>
                  </div>
                  <div className="bg-noir-800 border border-noir-700 p-2 text-xs space-y-1 text-ivory-200">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gold-400 font-medium">{t(row.shotSize)}</span>
                      <span className="text-ivory-500">{row.duration}s</span>
                    </div>
                    {row.cameraMove && <div className="text-gold-400/80 text-[10px]">{t('运镜: {move}', { move: t(row.cameraMove) })}</div>}
                    {row.dialogue && <div className="italic text-ivory-100 leading-snug">"{row.dialogue}"</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 中式动画预览 */}
          {preset.layout === 'animation' && (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${preset.panelsPerRow || 3}, 1fr)` }}>
              {sceneRows.map(row => (
                <div key={row.id} className="bg-noir-900 border-2 border-red-900/60 overflow-hidden relative">
                  {/* 赛璐璐角标 */}
                  <div className="absolute -top-2 -left-2 w-4 h-4 border-l-2 border-t-2 border-red-500 z-10" />
                  <div className="absolute -top-2 -right-2 w-4 h-4 border-r-2 border-t-2 border-red-500 z-10" />
                  <div className="aspect-video bg-noir-950 flex items-center justify-center relative">
                    <span className="text-red-900/40 text-4xl">🎬</span>
                    <div className="absolute top-1.5 left-1.5 text-[9px] bg-red-900/90 text-white px-1.5 py-0.5 font-bold tracking-wider">
                      CUT #{row.cut}
                    </div>
                    <div className="absolute bottom-1.5 right-1.5 text-[9px] bg-noir-900/90 text-gold-400 px-1.5 py-0.5 border border-gold-500/40">
                      {row.duration}s
                    </div>
                  </div>
                  <div className="bg-noir-800 divide-y divide-noir-700">
                    <div className="px-2 py-1.5 flex gap-2 text-[11px]">
                      <span className="text-red-400 w-8 flex-shrink-0">{t('动作')}</span>
                      <span className="text-ivory-200 truncate">{row.action || row.image}</span>
                    </div>
                    <div className="px-2 py-1.5 flex gap-2 text-[11px]">
                      <span className="text-gold-400 w-8 flex-shrink-0">{t('对白')}</span>
                      <span className="text-ivory-100 italic truncate">"{row.dialogue || '-'}"</span>
                    </div>
                    <div className="px-2 py-1.5 flex gap-2 text-[11px]">
                      <span className="text-purple-400 w-8 flex-shrink-0">{t('音效')}</span>
                      <span className="text-noir-400 truncate">{row.sfx || '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 表格视图预览 */}
          {preset.layout === 'table' && (
            <table className="w-full text-sm border border-noir-600 bg-noir-800">
              <thead className="bg-noir-900">
                <tr>
                  {['镜号','景别','运镜','时长','画面','台词','音效'].map(h => (
                    <th key={h} className="border border-noir-600 px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-gold-500">{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sceneRows.map(row => (
                  <tr key={row.id} className="hover:bg-noir-700/50 border border-noir-700">
                    <td className="px-3 py-2 text-ivory-100 font-mono text-xs">{row.cut}</td>
                    <td className="px-3 py-2 text-ivory-200">{t(row.shotSize)}</td>
                    <td className="px-3 py-2 text-gold-400">{t(row.cameraMove)}</td>
                    <td className="px-3 py-2 text-ivory-300">{row.duration}s</td>
                    <td className="px-3 py-2 text-ivory-300">{row.image}</td>
                    <td className="px-3 py-2 italic text-ivory-100">"{row.dialogue}"</td>
                    <td className="px-3 py-2 text-noir-400">{row.sfx}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}

