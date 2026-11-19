import React, { useState, useEffect, useRef } from 'react'
import {
  StickyNote, Lightbulb, Users, Globe, ListTree,
  Plus, Trash2, Check, ChevronDown, ChevronRight, Pin, X, Clapperboard
} from 'lucide-react'
import { getProject, saveProject, writeProjectFile } from '../utils/projectStore.js'

// ============ 构箱存储 ============
// 每个剧本一份，key 形如 scriptforge_workspace_sc_ab12cd34_notes
// 同时落一份 workspace.json 到该剧本的虚拟目录
const LS_PREFIX = 'scriptforge_workspace_'
const WORKSPACE_KEYS = ['notes', 'logline', 'characters', 'world', 'outline', 'three_act_beats']

let ACTIVE_SCRIPT_ID = '__draft__'
let flushTimer = null

const prefix = (id) => `${LS_PREFIX}${id}_`

// 老版本把构箱存在全局 key（没有剧本 id），一次性搬进当前剧本并删除旧 key
export function migrateLegacyWorkspace(scriptId) {
  if (!scriptId) return
  WORKSPACE_KEYS.forEach(k => {
    const oldValue = localStorage.getItem(LS_PREFIX + k)
    if (oldValue === null) return
    const newKey = prefix(scriptId) + k
    if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, oldValue)
    localStorage.removeItem(LS_PREFIX + k)
  })
}

const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(prefix(ACTIVE_SCRIPT_ID) + key)
    return v !== null ? JSON.parse(v) : fallback
  } catch { return fallback }
}

function collectWorkspace(id = ACTIVE_SCRIPT_ID) {
  const out = {}
  WORKSPACE_KEYS.forEach(k => {
    try {
      const raw = localStorage.getItem(prefix(id) + k)
      if (raw !== null) out[k] = JSON.parse(raw)
    } catch {}
  })
  return out
}

async function flushWorkspace(id = ACTIVE_SCRIPT_ID) {
  if (!id || id === '__draft__') return
  const data = collectWorkspace(id)
  if (!(await getProject(id))) {
    // 什么都还没写就离开编辑器时，不要凭空建一个空剧本文件夹
    if (Object.keys(data).length === 0) return
    await saveProject({ id, title: '未命名剧本' })
  }
  await writeProjectFile(id, 'workspace.json', JSON.stringify(data, null, 2), 'application/json')
}

const save = (key, value) => {
  try {
    localStorage.setItem(prefix(ACTIVE_SCRIPT_ID) + key, JSON.stringify(value))
  } catch {}
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => { flushWorkspace().catch(() => {}) }, 700)
}

// 只在用户真的改动后写盘，避免一挂载就把默认值当成内容
function usePersist(key, value) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    save(key, value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
}

// ============ 主面板 ============
export default function WorkspacePanel({ onClose, scriptId }) {
  if (scriptId) ACTIVE_SCRIPT_ID = scriptId
  migrateLegacyWorkspace(scriptId)

  const [tab, setTab] = useState('notes') // notes | logline | characters | world | outline | threeAct

  // 面板卸载时把最后一批改动写进该剧本的 workspace.json
  useEffect(() => {
    const mountedId = scriptId
    return () => {
      if (flushTimer) clearTimeout(flushTimer)
      flushWorkspace(mountedId).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs = [
    { id: 'notes',     icon: StickyNote, label: '构箱' },
    { id: 'logline',   icon: Lightbulb,  label: '梗概' },
    { id: 'characters',icon: Users,      label: '人物' },
    { id: 'world',     icon: Globe,      label: '世界' },
    { id: 'outline',   icon: ListTree,   label: '大纲' },
    { id: 'threeAct',  icon: Clapperboard, label: '三幕' },
  ]

  return (
    <div className="w-80 flex-shrink-0 flex flex-col h-full bg-noir-900/55 backdrop-blur-sm border-r border-noir-700/60">
      {/* 顶部 tab 条 */}
      <div className="flex items-center border-b border-noir-700/50 bg-noir-800/50 backdrop-blur-sm">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-2 py-2.5 text-[10px] uppercase tracking-[0.15em] flex flex-col items-center gap-1 border-b-2 transition-colors ${
                active
                  ? 'border-gold-500 text-gold-400 bg-noir-700/40'
                  : 'border-transparent text-ivory-400 hover:text-ivory-200 hover:bg-noir-700/20'
              }`}
              title={t.label}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          )
        })}
        <button
          onClick={onClose}
          className="px-2 py-2.5 text-ivory-500 hover:text-ivory-200"
          title="收起构箱"
        >
          <X size={14} />
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'notes'      && <NotesTab />}
        {tab === 'logline'    && <LoglineTab />}
        {tab === 'characters' && <CharactersTab />}
        {tab === 'world'      && <WorldTab />}
        {tab === 'outline'    && <OutlineTab />}
        {tab === 'threeAct'   && <ThreeActTab />}
      </div>
    </div>
  )
}

// ============================================================
// 1. 构箱笔记 —— 随手记想法/改动/疑问/待办
// ============================================================
const NOTE_COLORS = {
  idea:     { label: '想法', cls: 'bg-gold-500/15 border-gold-500/40 text-gold-300' },
  change:   { label: '改动', cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300' },
  question: { label: '疑问', cls: 'bg-purple-500/15 border-purple-500/40 text-purple-300' },
  todo:     { label: '待办', cls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
}

function NotesTab() {
  const [notes, setNotes] = useState(() => load('notes', []))
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState('idea')

  usePersist('notes', notes)

  const addNote = () => {
    if (!draft.trim()) return
    setNotes([{
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      text: draft.trim(),
      color,
      pinned: false,
      createdAt: new Date().toISOString(),
    }, ...notes])
    setDraft('')
  }

  const removeNote = (id) => setNotes(notes.filter(n => n.id !== id))
  const togglePin = (id) => setNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n))

  const sorted = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <div className="p-3 space-y-3">
      {/* 快速输入 */}
      <div className="border border-noir-700 bg-noir-800 p-2 space-y-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote() }}
          placeholder="随手记一个想法... (Ctrl+Enter 保存)"
          rows={3}
          className="w-full bg-noir-900 border border-noir-700 text-ivory-100 text-xs p-2 resize-none focus:outline-none focus:border-gold-500"
        />
        <div className="flex items-center gap-1">
          {Object.entries(NOTE_COLORS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setColor(k)}
              className={`flex-1 px-1.5 py-1 text-[10px] border ${v.cls} ${color === k ? 'ring-1 ring-gold-500' : 'opacity-60 hover:opacity-100'}`}
            >
              {v.label}
            </button>
          ))}
          <button
            onClick={addNote}
            className="px-3 py-1 bg-gold-500 hover:bg-gold-400 text-noir-900 text-[11px] font-medium flex items-center gap-1"
          >
            <Plus size={12} /> 存
          </button>
        </div>
      </div>

      {/* 列表 */}
      {sorted.length === 0 ? (
        <p className="text-center text-ivory-500 text-xs py-6">还没有笔记，先随手记一条吧。</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(n => (
            <div key={n.id} className={`border p-2 text-xs leading-relaxed ${NOTE_COLORS[n.color].cls} relative group`}>
              <div className="flex items-start gap-1.5">
                <span className="text-[9px] uppercase tracking-wider opacity-70 flex-shrink-0 mt-0.5">
                  {NOTE_COLORS[n.color].label}
                </span>
                {n.pinned && <Pin size={10} className="text-gold-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 whitespace-pre-wrap break-words text-ivory-100">{n.text}</div>
              </div>
              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => togglePin(n.id)} className="p-0.5 hover:bg-noir-900/60 text-gold-400" title="置顶">
                  <Pin size={10} />
                </button>
                <button onClick={() => removeNote(n.id)} className="p-0.5 hover:bg-noir-900/60 text-red-400" title="删除">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 2. 一句话梗概 Logline
// ============================================================
function LoglineTab() {
  const [data, setData] = useState(() => load('logline', {
    logline: '', theme: '', genre: '', audience: '', hook: '',
  }))
  usePersist('logline', data)

  const set = (k, v) => setData({ ...data, [k]: v })

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="border border-gold-500/30 bg-gold-500/5 p-2 text-[11px] leading-relaxed text-gold-200">
        <div className="uppercase tracking-wider text-[9px] text-gold-400 mb-1">Logline 公式</div>
        当 <em>[激励事件]</em> 发生时，<em>[主角]</em> 必须 <em>[行动]</em>，
        否则 <em>[代价]</em>。
      </div>

      <Field
        label="一句话梗概"
        hint="25-50 字，说清主角+冲突+代价"
        value={data.logline}
        onChange={v => set('logline', v)}
        rows={3}
        placeholder="当父亲被冤入狱，沉默的拳击手女儿必须在 30 天内赢下地下拳赛，否则家族拳馆将被债主拍卖。"
      />
      <Field label="主题" value={data.theme} onChange={v => set('theme', v)} rows={2}
        placeholder="救赎 / 成长 / 父爱 / 反抗命运..." />
      <Field label="类型" value={data.genre} onChange={v => set('genre', v)} rows={1}
        placeholder="剧情 / 悬疑 / 科幻 / 爱情..." />
      <Field label="目标受众" value={data.audience} onChange={v => set('audience', v)} rows={1}
        placeholder="18-35 岁都市青年..." />
      <Field label="核心钩子 / 卖点" value={data.hook} onChange={v => set('hook', v)} rows={2}
        placeholder="本片最独特的一点是什么？让人非看不可的理由。" />
    </div>
  )
}

function Field({ label, hint, value, onChange, rows = 2, placeholder }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.15em] text-gold-400 mb-1">
        {label}
        {hint && <span className="ml-2 text-ivory-500 normal-case tracking-normal">{hint}</span>}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-noir-800 border border-noir-700 text-ivory-100 text-xs p-2 resize-none focus:outline-none focus:border-gold-500"
      />
    </div>
  )
}

// ============================================================
// 3. 人物小传 Characters
// ============================================================
const EMPTY_CHAR = () => ({
  id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
  name: '', role: '主角', age: '', gender: '',
  appearance: '', personality: '', motivation: '',
  fear: '', backstory: '',
  // 人物弧光
  want: '', need: '', wound: '', lie: '', arcConflict: '', transformation: '',
})

function CharactersTab() {
  const [chars, setChars] = useState(() => load('characters', []))
  const [openId, setOpenId] = useState(null)
  usePersist('characters', chars)

  const addChar = () => {
    const c = EMPTY_CHAR()
    setChars([c, ...chars])
    setOpenId(c.id)
  }
  const update = (id, k, v) => setChars(chars.map(c => c.id === id ? { ...c, [k]: v } : c))
  const remove = (id) => { setChars(chars.filter(c => c.id !== id)); if (openId === id) setOpenId(null) }

  return (
    <div className="p-3 space-y-2">
      <button onClick={addChar} className="w-full px-3 py-2 bg-gold-500 hover:bg-gold-400 text-noir-900 text-xs font-medium flex items-center justify-center gap-1">
        <Plus size={12} /> 新增人物
      </button>

      {chars.length === 0 ? (
        <p className="text-center text-ivory-500 text-xs py-6">还没有人物。先创建你的主角。</p>
      ) : chars.map(c => {
        const open = openId === c.id
        return (
          <div key={c.id} className="border border-noir-700 bg-noir-800">
            {/* 折叠头 */}
            <button
              onClick={() => setOpenId(open ? null : c.id)}
              className="w-full px-2 py-2 flex items-center gap-2 hover:bg-noir-700/40 text-left"
            >
              {open ? <ChevronDown size={12} className="text-gold-400" /> : <ChevronRight size={12} className="text-gold-400" />}
              <span className="text-ivory-100 text-xs font-medium flex-1 truncate">{c.name || '(未命名)'}</span>
              <span className="text-[9px] uppercase tracking-wider text-gold-400 px-1.5 py-0.5 bg-gold-500/10 border border-gold-500/30">
                {c.role}
              </span>
            </button>
            {/* 展开编辑 */}
            {open && (
              <div className="border-t border-noir-700 p-2 space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <input value={c.name} onChange={e => update(c.id, 'name', e.target.value)} placeholder="姓名"
                    className="col-span-1 bg-noir-900 border border-noir-700 text-ivory-100 text-xs px-2 py-1 focus:outline-none focus:border-gold-500" />
                  <input value={c.age} onChange={e => update(c.id, 'age', e.target.value)} placeholder="年龄"
                    className="bg-noir-900 border border-noir-700 text-ivory-100 text-xs px-2 py-1 focus:outline-none focus:border-gold-500" />
                  <select value={c.role} onChange={e => update(c.id, 'role', e.target.value)}
                    className="bg-noir-900 border border-noir-700 text-ivory-100 text-xs px-1 py-1 focus:outline-none focus:border-gold-500">
                    {['主角','反派','配角','导师','伙伴','路人'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <CharField label="外貌" value={c.appearance} onChange={v => update(c.id, 'appearance', v)} placeholder="高挑、眉心有疤、永远穿灰风衣..." />
                <CharField label="性格关键词" value={c.personality} onChange={v => update(c.id, 'personality', v)} placeholder="冷静、固执、内心柔软..." />
                <CharField label="动机 / 目标" value={c.motivation} onChange={v => update(c.id, 'motivation', v)} placeholder="他想得到什么？为什么？" />
                <CharField label="背景故事" value={c.backstory} onChange={v => update(c.id, 'backstory', v)} rows={3} placeholder="出身、关键创伤、塑造他的事件..." />

                {/* 人物弧光 */}
                <div className="pt-2 mt-1 border-t border-noir-700 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-gold-400">人物弧光</span>
                    <span className="text-[9px] italic text-ivory-500">Character Arc</span>
                  </div>
                  <CharField label="Want · 外在目标" value={c.want} onChange={v => update(c.id, 'want', v)} placeholder="他以为自己想要什么？推动剧情的外在目标。" />
                  <CharField label="Need · 内在需求" value={c.need} onChange={v => update(c.id, 'need', v)} placeholder="他真正缺失、必须学会的东西。" />
                  <CharField label="Wound · 创伤" value={c.wound} onChange={v => update(c.id, 'wound', v)} placeholder="过去哪件事造成了今天的他？" />
                  <CharField label="Lie · 错误信念" value={c.lie} onChange={v => update(c.id, 'lie', v)} placeholder="他相信的谎言，如「我只能靠自己」。" />
                  <CharField label="Fear · 恐惧" value={c.fear} onChange={v => update(c.id, 'fear', v)} placeholder="他最怕失去什么？" />
                  <CharField label="Conflict · 内外冲突" value={c.arcConflict} onChange={v => update(c.id, 'arcConflict', v)} placeholder="外在困境与内心挣扎如何互相撕扯？" />
                  <CharField label="Transformation · 转变" value={c.transformation} onChange={v => update(c.id, 'transformation', v)} rows={3} placeholder="从什么样的人，变成什么样的人？" />
                </div>

                <button onClick={() => remove(c.id)} className="w-full px-2 py-1 text-red-400 hover:bg-red-500/10 border border-red-500/40 text-[11px] flex items-center justify-center gap-1">
                  <Trash2 size={11} /> 删除人物
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CharField({ label, value, onChange, rows = 2, placeholder }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-gold-400 mb-0.5">{label}</div>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full bg-noir-900 border border-noir-700 text-ivory-100 text-xs p-1.5 resize-none focus:outline-none focus:border-gold-500" />
    </div>
  )
}

// ============================================================
// 4. 故事背景 World
// ============================================================
function WorldTab() {
  const [data, setData] = useState(() => load('world', {
    timeframe: '', location: '', rules: '', society: '', visualTone: '', references: '',
  }))
  usePersist('world', data)
  const set = (k, v) => setData({ ...data, [k]: v })

  return (
    <div className="p-3 space-y-3 text-xs">
      <Field label="时代 / 时间" value={data.timeframe} onChange={v => set('timeframe', v)} rows={1}
        placeholder="1980 年代末 / 近未来 2045 / 架空古代..." />
      <Field label="地点 / 舞台" value={data.location} onChange={v => set('location', v)} rows={2}
        placeholder="东北小城老工业区 / 沿海科幻都市..." />
      <Field label="世界观规则" value={data.rules} onChange={v => set('rules', v)} rows={3}
        placeholder="这个世界运作的特殊规则（科幻/奇幻尤其重要）..." />
      <Field label="社会 / 历史背景" value={data.society} onChange={v => set('society', v)} rows={3}
        placeholder="时代氛围、社会矛盾、历史事件..." />
      <Field label="视觉基调" value={data.visualTone} onChange={v => set('visualTone', v)} rows={2}
        placeholder="冷色调 + 雨夜 + 霓虹 / 暖黄胶片感..." />
      <Field label="参考作品" value={data.references} onChange={v => set('references', v)} rows={2}
        placeholder="《寄生虫》《银翼杀手 2049》《花样年华》..." />
    </div>
  )
}

// ============================================================
// 5. 三幕大纲 Outline
// ============================================================
const DEFAULT_OUTLINE = [
  {
    id: 'act1', act: 'ACT I · 建置', title: '第一幕',
    beats: [
      { id: 'a1-1', text: '开场画面 — 奠定基调', done: false },
      { id: 'a1-2', text: '激励事件 — 打破日常', done: false },
      { id: 'a1-3', text: '第一幕转折 — 主角踏入新世界', done: false },
    ],
  },
  {
    id: 'act2', act: 'ACT II · 对抗', title: '第二幕',
    beats: [
      { id: 'a2-1', text: '上升动作 — 主角尝试与挫败', done: false },
      { id: 'a2-2', text: '中点 — 虚假胜利或虚假失败', done: false },
      { id: 'a2-3', text: '低谷 — 失去一切', done: false },
    ],
  },
  {
    id: 'act3', act: 'ACT III · 解决', title: '第三幕',
    beats: [
      { id: 'a3-1', text: '灵魂黑夜后的顿悟', done: false },
      { id: 'a3-2', text: '高潮对决', done: false },
      { id: 'a3-3', text: '结局 — 新世界图景', done: false },
    ],
  },
]

function OutlineTab() {
  const [outline, setOutline] = useState(() => load('outline', DEFAULT_OUTLINE))
  const [collapsed, setCollapsed] = useState({})
  usePersist('outline', outline)

  const toggleAct = (actId) => setCollapsed({ ...collapsed, [actId]: !collapsed[actId] })
  const toggleBeat = (actId, beatId) => {
    setOutline(outline.map(a => a.id === actId
      ? { ...a, beats: a.beats.map(b => b.id === beatId ? { ...b, done: !b.done } : b) }
      : a
    ))
  }
  const updateBeat = (actId, beatId, text) => {
    setOutline(outline.map(a => a.id === actId
      ? { ...a, beats: a.beats.map(b => b.id === beatId ? { ...b, text } : b) }
      : a
    ))
  }
  const addBeat = (actId) => {
    setOutline(outline.map(a => a.id === actId
      ? { ...a, beats: [...a.beats, { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), text: '', done: false }] }
      : a
    ))
  }
  const removeBeat = (actId, beatId) => {
    setOutline(outline.map(a => a.id === actId
      ? { ...a, beats: a.beats.filter(b => b.id !== beatId) }
      : a
    ))
  }

  // 完成度
  const total = outline.reduce((s, a) => s + a.beats.length, 0)
  const done = outline.reduce((s, a) => s + a.beats.filter(b => b.done).length, 0)
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  return (
    <div className="p-3 space-y-3">
      {/* 进度条 */}
      <div className="border border-noir-700 bg-noir-800 p-2">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-gold-400 mb-1">
          <span>大纲完成度</span>
          <span>{done}/{total} · {pct}%</span>
        </div>
        <div className="h-1 bg-noir-900 overflow-hidden">
          <div className="h-full bg-gold-500 transition-all" style={{ width: pct + '%' }} />
        </div>
      </div>

      {/* 三幕 */}
      {outline.map(act => {
        const open = !collapsed[act.id]
        const actDone = act.beats.filter(b => b.done).length
        return (
          <div key={act.id} className="border border-noir-700 bg-noir-800">
            <button
              onClick={() => toggleAct(act.id)}
              className="w-full px-2 py-2 flex items-center gap-2 hover:bg-noir-700/40 text-left"
            >
              {open ? <ChevronDown size={12} className="text-gold-400" /> : <ChevronRight size={12} className="text-gold-400" />}
              <span className="text-gold-400 text-[10px] uppercase tracking-[0.2em] flex-1">{act.act}</span>
              <span className="text-[9px] text-ivory-500">{actDone}/{act.beats.length}</span>
            </button>
            {open && (
              <div className="border-t border-noir-700 p-2 space-y-1.5">
                {act.beats.map(beat => (
                  <div key={beat.id} className="flex items-start gap-1.5 group">
                    <button
                      onClick={() => toggleBeat(act.id, beat.id)}
                      className={`mt-1 w-3 h-3 flex-shrink-0 border flex items-center justify-center ${
                        beat.done ? 'bg-gold-500 border-gold-500 text-noir-900' : 'border-noir-600 hover:border-gold-500'
                      }`}
                    >
                      {beat.done && <Check size={9} />}
                    </button>
                    <textarea
                      value={beat.text}
                      onChange={e => updateBeat(act.id, beat.id, e.target.value)}
                      rows={1}
                      placeholder="情节点..."
                      className={`flex-1 bg-noir-900 border border-noir-700 text-xs px-1.5 py-1 resize-none focus:outline-none focus:border-gold-500 ${
                        beat.done ? 'text-ivory-500 line-through' : 'text-ivory-100'
                      }`}
                    />
                    <button
                      onClick={() => removeBeat(act.id, beat.id)}
                      className="mt-1 p-0.5 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addBeat(act.id)}
                  className="w-full px-2 py-1 text-gold-400 hover:bg-gold-500/10 border border-dashed border-gold-500/40 text-[10px] flex items-center justify-center gap-1"
                >
                  <Plus size={10} /> 加情节点
                </button>
              </div>
            )}
          </div>
        )
      })}

      <p className="text-[10px] text-ivory-500 leading-relaxed">
        💡 情节点是可以拖动改写的活文档。建议每写完一场戏，就回到大纲勾选完成度。
      </p>
    </div>
  )
}

// ============================================================
// 6. 三幕式辅助框架（Save the Cat 15 节拍表 · 可选辅助工具）
//    不强制绑定任何模板，作者可自主选择是否启用
// ============================================================
const SAVE_THE_CAT_BEATS = [
  // ACT I
  { id: 'stc-01', act: 1, page: 'p1',      name: '开场画面',   en: 'Opening Image',      hint: '奠定基调，呈现主角日常世界。与终场画面形成对照。' },
  { id: 'stc-02', act: 1, page: 'p5',      name: '主题呈现',   en: 'Theme Stated',       hint: '用一句不经意的台词暗示电影主题（通常不是主角说的）。' },
  { id: 'stc-03', act: 1, page: 'p1-10',   name: '铺垫',       en: 'Set-Up',             hint: '介绍主角、他的世界、他的缺憾。埋下所有后续要回收的伏笔。' },
  { id: 'stc-04', act: 1, page: 'p12',     name: '激励事件',   en: 'Catalyst',           hint: '打破日常的事件：一通电话、一次相遇、一场事故。' },
  { id: 'stc-05', act: 1, page: 'p12-25',  name: '争执',       en: 'Debate',             hint: '主角犹豫是否行动。这是英雄之旅的"拒绝召唤"阶段。' },
  // ACT II
  { id: 'stc-06', act: 2, page: 'p25',     name: '进入第二幕', en: 'Break into Two',     hint: '主角做出选择，主动踏入新世界。第一幕结束。' },
  { id: 'stc-07', act: 2, page: 'p30',     name: '副线故事',   en: 'B Story',            hint: '通常是爱情线/师徒线/友情线。承载主题的另一半讨论。' },
  { id: 'stc-08', act: 2, page: 'p30-55',  name: '游戏时间',   en: 'Fun and Games',      hint: '类型承诺兑现。动作片打、喜剧片笑、恐怖片吓。观众来看的就是这段。' },
  { id: 'stc-09', act: 2, page: 'p55',     name: '中点',       en: 'Midpoint',           hint: '虚假胜利或虚假失败。赌注提高，主角从被动变主动。' },
  { id: 'stc-10', act: 2, page: 'p55-75',  name: '坏人逼近',   en: 'Bad Guys Close In',  hint: '外部反派 + 内部缺陷双重夹击。主角团队开始分裂。' },
  { id: 'stc-11', act: 2, page: 'p75',     name: '一无所有',   en: 'All Is Lost',        hint: '主角失去最重要的东西。常有"死亡气息"——导师/爱人/希望。' },
  { id: 'stc-12', act: 2, page: 'p75-85',  name: '灵魂黑夜',   en: 'Dark Night of Soul', hint: '主角在最低谷反思。承认自己的错误。酝酿顿悟。' },
  // ACT III
  { id: 'stc-13', act: 3, page: 'p85',     name: '进入第三幕', en: 'Break into Three',   hint: '主角获得新信息/新觉悟，主动发起最后一击。' },
  { id: 'stc-14', act: 3, page: 'p85-110', name: '结局',       en: 'Finale',             hint: '主角用行动证明他已改变。五部曲：集结/执行/绝地/新方案/胜利。' },
  { id: 'stc-15', act: 3, page: 'p110',    name: '终场画面',   en: 'Final Image',        hint: '与开场画面对照。一眼看出主角已经改变。' },
]

const ACT_LABEL = {
  1: { name: 'ACT I · 建置', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/5' },
  2: { name: 'ACT II · 对抗', color: 'text-amber-400 border-amber-500/40 bg-amber-500/5' },
  3: { name: 'ACT III · 解决', color: 'text-rose-400 border-rose-500/40 bg-rose-500/5' },
}

function ThreeActTab() {
  const [beats, setBeats] = useState(() => load('three_act_beats', {}))
  usePersist('three_act_beats', beats)

  const setBeat = (id, patch) => setBeats({ ...beats, [id]: { ...beats[id], ...patch } })

  const total = SAVE_THE_CAT_BEATS.length
  const done = SAVE_THE_CAT_BEATS.filter(b => beats[b.id]?.done).length
  const pct = Math.round((done / total) * 100)

  // 三幕可视化（一条时间轴，标注三幕分界）
  const actGroups = [1, 2, 3].map(n => SAVE_THE_CAT_BEATS.filter(b => b.act === n))

  return (
    <div className="p-3 space-y-3">
      {/* 说明 */}
      <div className="border border-gold-500/30 bg-gold-500/5 p-2 text-[11px] leading-relaxed text-gold-200">
        <div className="uppercase tracking-wider text-[9px] text-gold-400 mb-1">三幕式 · Save the Cat</div>
        经典好莱坞 15 节拍表。这是<strong>辅助工具</strong>，不影响任何模板。
        作者可自由勾选、填写，也可以完全忽略。
      </div>

      {/* 三幕可视化时间轴 */}
      <div className="border border-noir-700 bg-noir-800 p-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gold-400 mb-2">三幕结构时间轴</div>
        <div className="flex h-8 border border-noir-600 overflow-hidden text-[9px]">
          {[25, 50, 25].map((w, i) => (
            <div
              key={i}
              style={{ width: w + '%' }}
              className={`flex items-center justify-center border-r last:border-r-0 border-noir-600 font-bold tracking-wider ${
                i === 0 ? 'bg-emerald-500/15 text-emerald-300' :
                i === 1 ? 'bg-amber-500/15 text-amber-300' :
                          'bg-rose-500/15 text-rose-300'
              }`}
            >
              ACT {['I','II','III'][i]}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-ivory-500 mt-1">
          <span>p1</span><span>p25</span><span>p75</span><span>p110</span>
        </div>
      </div>

      {/* 总进度 */}
      <div className="border border-noir-700 bg-noir-800 p-2">
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-gold-400 mb-1">
          <span>节拍完成度</span>
          <span>{done}/{total} · {pct}%</span>
        </div>
        <div className="h-1 bg-noir-900 overflow-hidden">
          <div className="h-full bg-gold-500 transition-all" style={{ width: pct + '%' }} />
        </div>
      </div>

      {/* 15 节拍列表（按幕分组） */}
      {actGroups.map((group, idx) => {
        const act = idx + 1
        const actMeta = ACT_LABEL[act]
        return (
          <div key={act} className={`border ${actMeta.color}`}>
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.2em] font-bold border-b border-inherit">
              {actMeta.name}
            </div>
            <div className="p-2 space-y-1.5">
              {group.map(beat => {
                const data = beats[beat.id] || {}
                return (
                  <div key={beat.id} className="border border-noir-700 bg-noir-900 p-1.5">
                    <div className="flex items-start gap-1.5">
                      <button
                        onClick={() => setBeat(beat.id, { done: !data.done })}
                        className={`mt-1 w-3 h-3 flex-shrink-0 border flex items-center justify-center ${
                          data.done ? 'bg-gold-500 border-gold-500 text-noir-900' : 'border-noir-600 hover:border-gold-500'
                        }`}
                      >
                        {data.done && <Check size={9} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className={`text-xs font-medium ${data.done ? 'text-ivory-500 line-through' : 'text-ivory-100'}`}>
                            {beat.name}
                          </span>
                          <span className="text-[9px] text-ivory-500 italic">{beat.en}</span>
                          <span className="text-[9px] text-gold-400 ml-auto">{beat.page}</span>
                        </div>
                        <p className="text-[10px] text-ivory-500 leading-snug mt-0.5">{beat.hint}</p>
                        <textarea
                          value={data.text || ''}
                          onChange={e => setBeat(beat.id, { text: e.target.value })}
                          placeholder="在这里写你的这一场..."
                          rows={1}
                          className="w-full mt-1 bg-noir-950 border border-noir-700 text-ivory-100 text-[11px] px-1.5 py-1 resize-none focus:outline-none focus:border-gold-500"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="text-[10px] text-ivory-500 leading-relaxed">
        📖 页码按 110 页标准剧本计算。短片按比例缩放即可。参考：Blake Snyder《Save the Cat》。
      </p>
    </div>
  )
}
