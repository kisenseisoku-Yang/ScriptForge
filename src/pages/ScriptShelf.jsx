﻿﻿import React, { useState, useEffect, useRef } from 'react'
import {
  Plus, Search, Film, Edit3, Trash2, Image, X, Save,
  BookOpen, Upload, Clock, Calendar, FileText, PenLine,
  Folder, Download, Archive
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import mammoth from 'mammoth'
import { useLicense } from '../utils/LicenseContext.jsx'
import {
  loadShelf, addScript, updateScript, deleteScript, getScript, compressPoster
} from '../utils/scriptShelf.js'
import {
  listProjectFiles, downloadProjectFile, exportProjectZip, exportAllProjectsZip
} from '../utils/projectStore.js'
import { FORMAT_PRESET_LIST } from '../config/formatPresets.js'
import { parseScriptText, serializeScript } from '../utils/scriptParser.js'
import { useI18n } from '../i18n/index.jsx'

export default function ScriptShelf({ onOpenScript }) {
  const { t } = useI18n()
  const { isPro, isLifetime, isTest, plan } = useLicense()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [folderOf, setFolderOf] = useState(null)   // 正在查看的剧本文件夹
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const posterInputRef = useRef(null)

  // 新建/编辑表单状态
  const [form, setForm] = useState({
    title: '', genre: '', logline: '', poster: '', formatId: 'hollywood', content: ''
  })

  const refresh = async () => setItems(await loadShelf())

  useEffect(() => { refresh() }, [])

  const canAccess = isPro || isLifetime || isTest

  const filtered = items.filter(s =>
    !query ||
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    (s.genre || '').toLowerCase().includes(query.toLowerCase())
  )

  // ============ 打开编辑器 ============
  const openCreate = () => {
    setEditingId(null)
    setForm({ title: '', genre: '', logline: '', poster: '', formatId: 'hollywood', content: '' })
    setShowModal(true)
  }

  const openEdit = async (id) => {
    const s = await getScript(id)
    if (!s) return
    setEditingId(id)
    setForm({
      title: s.title, genre: s.genre, logline: s.logline,
      poster: s.poster, formatId: s.formatId, content: s.content
    })
    setShowModal(true)
  }

  const openReadonly = async (id) => setSelected(await getScript(id))

  // 在编辑器中打开：存 id 到 localStorage，跳转编辑器路由
  const openInEditor = (id) => {
    localStorage.setItem('scriptforge_open_script_id', id)
    window.dispatchEvent(new CustomEvent('scriptforge:open-script', { detail: { id } }))
    if (onOpenScript) onOpenScript()
    else navigate('/studio')
  }

  // ============ 保存 ============
  const handleSave = async () => {
    if (!form.title.trim()) { alert(t('请填写标题')); return }
    if (editingId) {
      await updateScript(editingId, form)
    } else {
      await addScript(form)
    }
    setShowModal(false); await refresh()
  }

  // ============ 剧本文件夹 ============
  const openFolder = async (item) => {
    setFolderOf(item)
    setFiles(await listProjectFiles(item.id))
  }

  const handleExportZip = async (id) => {
    try {
      setBusy(true)
      await exportProjectZip(id)
    } catch (e) {
      alert(t('导出失败：{msg}', { msg: e.message || e }))
    } finally {
      setBusy(false)
    }
  }

  const handleExportAll = async () => {
    try {
      setBusy(true)
      await exportAllProjectsZip()
    } catch (e) {
      alert(t('导出失败：{msg}', { msg: e.message || e }))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (item) => {
    if (!confirm(t('删除「{title}」及其文件夹？', { title: item.title }))) return
    await deleteScript(item.id)
    await refresh()
  }

  // ============ 海报上传 ============
  const handlePoster = async (file) => {
    if (!file) return
    try {
      const data = await compressPoster(file, 800, 0.85)
      setForm(f => ({ ...f, poster: data }))
    } catch (err) {
      alert(t('海报处理失败：{msg}', { msg: err.message }))
    }
  }

  // ============ 导入 Word / 纯文本 / Fountain / Final Draft ============
  const importScriptFile = async (file) => {
    if (!file) return
    try {
      const lowerName = file.name.toLowerCase()
      let raw
      if (lowerName.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
        raw = result.value || ''
      } else {
        raw = await file.text()
        if (lowerName.endsWith('.fdx')) {
          const xml = new DOMParser().parseFromString(raw, 'application/xml')
          if (xml.querySelector('parsererror')) throw new Error(t('Final Draft 文件无法解析'))
          raw = Array.from(xml.getElementsByTagName('Paragraph'))
            .map(p => Array.from(p.getElementsByTagName('Text')).map(t => t.textContent).join(''))
            .filter(Boolean).join('\n')
        }
      }
      if (!raw.trim()) throw new Error(t('文件中没有可导入的文字'))
      const name = file.name.replace(/\.[^.]+$/, '')
      setForm(f => ({
        ...f,
        content: serializeScript(parseScriptText(raw), f.formatId) || raw.trim(),
        title: f.title || name,
      }))
    } catch (err) {
      alert(t('导入失败：{msg}', { msg: err.message || err }))
    }
  }

  // ============ Pro 限制 ============
  if (!canAccess) {
    return (
      <div className="p-8 bg-noir-900 min-h-full">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="inline-flex items-center gap-2 lock-chip mb-6">
            <span className="text-xl">👑</span>
            {t('Pro / 终身版专属功能')}
          </div>
          <h2 className="headline text-6xl text-gold-gradient mb-4">{t('剧本架')}</h2>
          <p className="text-ivory-400 mb-8 leading-relaxed">
            {t('一个存放你所有剧本的专属剧本架。')}<br />
            {t('支持海报封面、类型分类、一行梗概、自定义排版、')}<br />
            {t('以及从本地文件导入已有的剧本作品。')}<br /><br />
            {t('升级到 Pro 版即可解锁剧本架，所有功能我们提供，内容由你掌控。')}
          </p>
          <div className="inline-block text-sm text-ivory-400 border border-noir-600 px-4 py-2">
            {t('当前版本：')}<span className="text-gold-500 font-medium">{plan}</span>
          </div>
        </div>
      </div>
    )
  }

  // ============ 剧本架主界面 ============
  return (
    <div className="p-6 w-full bg-noir-900 min-h-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="headline text-4xl text-ivory-100 flex items-center gap-3">
            <BookOpen className="text-gold-500" /> {t('剧本架')}
          </h1>
          <p className="text-[11px] uppercase tracking-[0.25em] text-gold-500 mt-2">
            {t('POSTER · LOGLINE · FORMAT')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAll}
            disabled={busy || items.length === 0}
            className="btn-outline flex items-center gap-2 disabled:opacity-40"
            title={t('把整座剧本架打包成 zip')}
          >
            <Archive size={16} /> {t('导出全部')}
          </button>
          <button
            onClick={openCreate}
            className="btn-gold flex items-center gap-2"
          >
            <Plus size={18} /> {t('新建剧本')}
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 text-gold-500" size={16} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('搜索标题、类型...')}
            className="input-noir pl-6"
          />
        </div>
      </div>

      {/* 空状态 */}
      {filtered.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-noir-600">
          <BookOpen size={48} className="mx-auto text-gold-500/30 mb-4" />
          <p className="text-ivory-400">
            {items.length === 0 ? t('剧本架空空如也，点击右上角新建第一个剧本') : t('没有匹配的剧本')}
          </p>
        </div>
      )}

      {/* 卡片网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {filtered.map(s => (
          <ScriptCard
            key={s.id}
            item={s}
            onOpen={() => openReadonly(s.id)}
            onEdit={() => openEdit(s.id)}
            onOpenInEditor={() => openInEditor(s.id)}
            onFolder={() => openFolder(s)}
            onDelete={() => handleDelete(s)}
          />
        ))}
      </div>

      {/* ============= 新建/编辑弹窗 ============= */}
      {showModal && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="card-noir w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-noir-700">
              <h3 className="headline text-2xl text-gold-500">
                {editingId ? t('编辑剧本') : t('新建剧本')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-ivory-400 hover:text-gold-500">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 bg-noir-900">
              {/* 海报 + 基本信息 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div
                    className="w-32 h-44 border border-dashed border-noir-600 bg-noir-800 flex items-center justify-center overflow-hidden relative group cursor-pointer"
                    onClick={() => posterInputRef.current?.click()}
                  >
                    {form.poster ? (
                      <img src={form.poster} alt={t('海报')} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-ivory-400">
                        <Image size={28} className="mx-auto mb-1" />
                        <span className="text-xs">{t('上传海报')}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-ivory-100 text-xs">{form.poster ? t('点击换图') : t('点击上传')}</span>
                    </div>
                  </div>
                  <input
                    ref={posterInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => handlePoster(e.target.files?.[0])}
                  />
                  {form.poster && (
                    <button
                      onClick={() => setForm(f => ({ ...f, poster: '' }))}
                      className="mt-2 text-xs text-red-400 hover:text-red-300"
                    >
                      {t('移除海报')}
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={t('剧本标题 *')}
                    className="input-noir font-semibold"
                  />
                  <div className="flex gap-2">
                    <input
                      value={form.genre}
                      onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                      placeholder={t('类型（如：科幻 / 喜剧 / 悬疑）')}
                      className="input-noir flex-1"
                    />
                    <select
                      value={form.formatId}
                      onChange={e => {
                        const formatId = e.target.value
                        setForm(f => ({
                          ...f,
                          formatId,
                          content: f.content.trim() ? serializeScript(parseScriptText(f.content), formatId) : f.content,
                        }))
                      }}
                      className="px-3 py-2 border border-noir-600 bg-noir-800 text-ivory-100 text-sm focus:outline-none focus:border-gold-500"
                    >
                      {FORMAT_PRESET_LIST.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <textarea
                    value={form.logline}
                    onChange={e => setForm(f => ({ ...f, logline: e.target.value }))}
                    placeholder={t('一句话梗概 / Logline（主角 + 冲突 + 悬念）')}
                    rows={2}
                    className="input-noir resize-none"
                  />
                </div>
              </div>

              {/* 正文 + 导入 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-ivory-200">{t('剧本正文')}</label>
                  <label className="text-xs text-gold-500 hover:text-gold-400 cursor-pointer flex items-center gap-1">
                    <Upload size={14} /> {t('导入 Word / TXT / Fountain')}
                    <input
                      type="file"
                      accept=".docx,.txt,.fountain,.fdx,.md,.markdown"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        importScriptFile(file)
                      }}
                    />
                  </label>
                </div>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder={t('在此粘贴或编写剧本正文...')}
                  rows={12}
                  className="w-full px-3 py-2 border border-noir-600 bg-noir-800 font-mono text-sm resize-none text-ivory-100 focus:outline-none focus:border-gold-500"
                />
                <div className="text-xs text-ivory-400 mt-1">
                  {t('{chars} 字符 · {lines} 行', { chars: form.content.length, lines: form.content.split('\n').length })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-noir-700 flex justify-end gap-2 bg-noir-800">
              <button
                onClick={() => setShowModal(false)}
                className="btn-outline"
              >
                {t('取消')}
              </button>
              <button
                onClick={handleSave}
                className="btn-gold flex items-center gap-2"
              >
                <Save size={16} /> {t('保存到剧本架')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============= 只读详情弹窗 ============= */}
      {selected && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="card-noir w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* 海报头 */}
            <div className="relative h-56 card-noir border border-gold-500/20 overflow-hidden">
              {selected.poster && (
                <img src={selected.poster} alt={selected.title} className="absolute inset-0 w-full h-full object-cover opacity-60" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-noir-900 via-noir-900/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 flex gap-5 items-end">
                {selected.poster ? (
                  <img src={selected.poster} alt={selected.title} className="w-28 h-40 object-cover border border-gold-500/20" />
                ) : (
                  <div className="w-28 h-40 bg-noir-800 border border-gold-500/20 flex items-center justify-center">
                    <Film size={32} className="text-gold-500/40" />
                  </div>
                )}
                <div className="flex-1 text-ivory-100">
                  <h2 className="headline text-4xl text-ivory-100">{selected.title}</h2>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ivory-400 mt-1 flex items-center gap-3">
                    {selected.genre && <span>{selected.genre}</span>}
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {new Date(selected.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {selected.logline && (
                    <p className="text-sm text-ivory-200 mt-2 line-clamp-2">{selected.logline}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-noir-800/50 hover:bg-noir-700 text-ivory-100 flex items-center justify-center border border-noir-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto p-6 bg-noir-900">
              {selected.content ? (
                <pre className="whitespace-pre-wrap font-mono text-sm text-ivory-200 leading-relaxed">
                  {selected.content}
                </pre>
              ) : (
                <p className="text-ivory-400 text-center py-10">{t('（剧本正文为空）')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============= 本地文件夹弹窗 ============= */}
      {folderOf && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4" onClick={() => setFolderOf(null)}>
          <div className="card-noir w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-noir-700">
              <div className="min-w-0">
                <h3 className="headline text-xl text-gold-500 flex items-center gap-2">
                  <Folder size={16} /> {t('本地文件夹')}
                </h3>
                <p className="text-[11px] text-ivory-400 mt-1 font-mono truncate">{folderOf.folder}/</p>
              </div>
              <button onClick={() => setFolderOf(null)} className="text-ivory-400 hover:text-gold-500">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-noir-900">
              {files.length === 0 ? (
                <p className="text-ivory-400 text-sm text-center py-8">
                  {t('还没有文件。回到编辑器写点东西，会自动生成 script.md / workspace.json。')}
                </p>
              ) : files.map(f => (
                <div key={f.name} className="flex items-center justify-between gap-3 px-3 py-2 border border-noir-700 bg-noir-800">
                  <div className="min-w-0">
                    <div className="text-sm text-ivory-100 font-mono truncate">{f.name}</div>
                    <div className="text-[10px] text-ivory-400">
                      {(f.size / 1024).toFixed(1)} KB
                      {f.updatedAt ? ` · ${new Date(f.updatedAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try { await downloadProjectFile(folderOf.id, f.name) }
                      catch (e) { alert(t('下载失败：{msg}', { msg: e.message || e })) }
                    }}
                    className="p-1.5 border border-gold-500/30 text-gold-500 hover:border-gold-500 flex-shrink-0"
                    title={t('下载')}
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-noir-700 flex justify-between items-center gap-3 bg-noir-800">
              <span className="text-[10px] uppercase tracking-[0.2em] text-ivory-400">
                {t('存在本机浏览器 · 不上传服务器')}
              </span>
              <button
                onClick={() => handleExportZip(folderOf.id)}
                disabled={busy}
                className="btn-gold flex items-center gap-2 disabled:opacity-40"
              >
                <Archive size={14} /> {t('导出文件夹 zip')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ 单张卡片 ============
function ScriptCard({ item, onOpen, onEdit, onOpenInEditor, onFolder, onDelete }) {
  const { t } = useI18n()
  return (
    <div className="group relative card-noir art-corner spotlight-card overflow-hidden poster-hover cursor-pointer" onClick={onOpen}>
      {/* 海报 */}
      <div className="aspect-[2/3] bg-noir-900 relative overflow-hidden">
        {item.poster ? (
          <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ivory-400/30">
            <Film size={40} />
          </div>
        )}
        {/* 悬浮操作 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-noir-900/60 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={e => { e.stopPropagation(); onOpenInEditor() }}
            className="p-2 bg-gold-500 border border-gold-500 hover:bg-gold-400"
            title={t('在编辑器打开')}
          >
            <PenLine size={14} className="text-noir-900" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onFolder() }}
            className="p-2 bg-noir-800 border border-gold-500/30 hover:border-gold-500"
            title={t('查看本地文件夹')}
          >
            <Folder size={14} className="text-gold-500" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-2 bg-noir-800 border border-gold-500/30 hover:border-gold-500"
            title={t('编辑信息')}
          >
            <Edit3 size={14} className="text-gold-500" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-2 bg-noir-800 border border-red-500/30 hover:border-red-500"
            title={t('删除')}
          >
            <Trash2 size={14} className="text-red-400" />
          </button>
        </div>
      </div>
      {/* 信息 */}
      <div className="p-3 bg-noir-800 border-t border-noir-700">
        <h3 className="font-medium text-sm text-ivory-100 truncate">{item.title}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-ivory-400 truncate">{item.genre || t('未分类')}</span>
          <span className="text-xs text-ivory-400 flex-shrink-0 ml-1 flex items-center gap-0.5">
            <FileText size={10} /> {(item.contentLength || 0)}
          </span>
        </div>
      </div>
    </div>
  )
}
