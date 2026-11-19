import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  BarChart3, ScanText, Timer, User, X, Play, Pause, RotateCcw,
  AlertTriangle, Info, CheckCircle2, Coffee, ChevronDown, Target
} from 'lucide-react'
import { computeStats, auditScript, getDailyProgress, setDailyGoal, formatDuration } from '../../utils/scriptAudit.js'
import {
  loadFocusSettings, saveFocusSettings, addFocusMinutes,
  getTodayFocus, getWeekFocus, fmtClock, playChime
} from '../../utils/focusTimer.js'
import { MUSE_PROFILE, museSay } from '../../utils/museDialogue.js'
import { VIEWS } from './MuseAvatar.jsx'

const TABS = [
  { id: 'stats', icon: BarChart3, label: '统计' },
  { id: 'audit', icon: ScanText, label: '审稿' },
  { id: 'focus', icon: Timer, label: '专注' },
  { id: 'profile', icon: User, label: '档案' },
]

export default function MusePanel({ text = '', onClose, mode, setMode, onSpeak, setExpression, onStartFocus }) {
  const [tab, setTab] = useState('stats')

  return (
    <div className="muse-panel w-[360px] max-h-[560px] flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gold-500/20 bg-gradient-to-r from-noir-800 to-noir-900">
        <div className="w-1.5 h-1.5 rounded-full bg-gold-500" />
        <span className="text-[11px] tracking-[0.2em] text-gold-400 uppercase">斧头</span>
        <span className="text-[10px] text-ivory-500">编剧</span>
        <button onClick={onClose} className="ml-auto text-ivory-500 hover:text-ivory-100 p-0.5">
          <X size={13} />
        </button>
      </div>

      {/* tab 条 */}
      <div className="flex border-b border-noir-700 bg-noir-850">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-[10px] tracking-[0.12em] flex items-center justify-center gap-1 border-b-2 transition-colors ${
                active
                  ? 'border-gold-500 text-gold-400 bg-noir-800/60'
                  : 'border-transparent text-ivory-400 hover:text-ivory-200'
              }`}
            >
              <Icon size={12} /> {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto scroll-noir">
        {tab === 'stats' && <StatsTab text={text} />}
        {tab === 'audit' && <AuditTab text={text} onSpeak={onSpeak} setExpression={setExpression} />}
        {tab === 'focus' && <FocusTab onSpeak={onSpeak} onStartFocus={onStartFocus} />}
        {tab === 'profile' && (
          <ProfileTab mode={mode} setMode={setMode} onSpeak={onSpeak} setExpression={setExpression} />
        )}
      </div>
    </div>
  )
}

// ============================================================
// 1. 统计
// ============================================================
function StatsTab({ text }) {
  const stats = useMemo(() => computeStats(text), [text])
  const daily = useMemo(() => getDailyProgress(stats.chars), [stats.chars])
  const pct = Math.min(100, Math.round((daily.written / (daily.goal || 3000)) * 100))

  return (
    <div className="p-3 space-y-3">
      {/* 今日进度环 */}
      <div className="flex items-center gap-3 p-2.5 border border-gold-500/25 bg-gold-500/5">
        <ProgressRing pct={pct} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold-400">今日码字</div>
          <div className="text-ivory-100 text-lg font-medium leading-tight">
            {daily.written.toLocaleString()}
            <span className="text-ivory-500 text-[11px] ml-1">/ {daily.goal}</span>
          </div>
          <div className="text-[10px] text-ivory-500 mt-0.5">目标完成 {pct}%</div>
        </div>
      </div>

      {/* 核心四项 */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="总字数" value={stats.chars.toLocaleString()} unit="字" />
        <StatBox label="场数" value={stats.scenes} unit="场" />
        <StatBox label="预估页数" value={stats.pages} unit="页" />
        <StatBox label="预估时长" value={stats.durationText} />
      </div>

      {/* 时长换算说明 */}
      <div className="text-[10px] text-ivory-500 leading-relaxed border-l-2 border-gold-500/30 pl-2">
        按行业标准 1 页 ≈ 1 分钟银幕时间换算；中文剧本约 380 字 / 分钟。
      </div>

      {/* 角色出场 */}
      {stats.characters.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold-400 mb-1.5">角色出场</div>
          <div className="space-y-1">
            {stats.characters.map(c => {
              const max = stats.characters[0].count || 1
              return (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="text-[11px] text-ivory-200 w-16 truncate">{c.name}</span>
                  <div className="flex-1 h-1.5 bg-noir-700 overflow-hidden">
                    <div className="h-full bg-gold-500/70" style={{ width: `${(c.count / max) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-ivory-500 w-6 text-right">{c.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressRing({ pct }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg width="56" height="56" className="flex-shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#2A2620" strokeWidth="5" />
      <circle
        cx="28" cy="28" r={r} fill="none" stroke="#C9A84C" strokeWidth="5"
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
        strokeLinecap="round" transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dashoffset .5s' }}
      />
      <text x="28" y="32" textAnchor="middle" fontSize="11" fill="#E8DCC8">{pct}%</text>
    </svg>
  )
}

function StatBox({ label, value, unit }) {
  return (
    <div className="border border-noir-700 bg-noir-850 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.15em] text-ivory-500">{label}</div>
      <div className="text-ivory-100 text-sm font-medium leading-tight mt-0.5">
        {value}{unit && <span className="text-[10px] text-ivory-500 ml-0.5">{unit}</span>}
      </div>
    </div>
  )
}

// ============================================================
// 2. 审稿
// ============================================================
function AuditTab({ text, onSpeak, setExpression }) {
  const [ran, setRan] = useState(false)
  const result = useMemo(() => (ran ? auditScript(text) : null), [ran, text])

  const run = () => {
    const r = auditScript(text)
    setRan(true)
    if (setExpression) setExpression(r.counts.error > 0 ? 'serious' : 'smile')
    if (onSpeak) {
      onSpeak(r.counts.total === 0 ? museSay('auditClean') : museSay('auditDirty'))
    }
  }

  const SEV = {
    error: { icon: AlertTriangle, cls: 'text-red-400', label: '错误' },
    warn: { icon: AlertTriangle, cls: 'text-amber-400', label: '警告' },
    info: { icon: Info, cls: 'text-sky-400', label: '建议' },
  }

  if (!ran) {
    return (
      <div className="p-4 space-y-3 text-center">
        <ScanText size={28} className="mx-auto text-gold-500/60" />
        <p className="text-[11px] text-ivory-400 leading-relaxed">
          我会逐行检查标点、空格、括号、重复标点、场景头格式和角色名一致性。
        </p>
        <button onClick={run} className="w-full py-2 bg-gold-500 hover:bg-gold-400 text-noir-900 text-xs font-medium">
          开始审稿
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      {/* 概览 */}
      <div className="flex items-center gap-2 p-2 border border-noir-700 bg-noir-850">
        {result.counts.total === 0 ? (
          <>
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className="text-[11px] text-emerald-300">没有发现问题。格式上你及格了。</span>
          </>
        ) : (
          <>
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="text-[11px] text-ivory-200">
              共 <b className="text-amber-300">{result.counts.total}</b> 处问题
            </span>
            <span className="ml-auto text-[10px] text-ivory-500">
              错误 {result.counts.error} · 警告 {result.counts.warn}
            </span>
          </>
        )}
      </div>

      {/* 列表 */}
      <div className="space-y-1.5">
        {result.issues.map(iss => {
          const s = SEV[iss.severity]
          const Icon = s.icon
          return (
            <div key={iss.id} className="border border-noir-700 bg-noir-900 px-2 py-1.5">
              <div className="flex items-start gap-1.5">
                <Icon size={11} className={`${s.cls} mt-0.5 flex-shrink-0`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-ivory-200 leading-snug">{iss.message}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {iss.line > 0 && (
                      <span className="text-[9px] text-gold-500">第 {iss.line} 行</span>
                    )}
                    {iss.example && (
                      <span className="text-[9px] text-ivory-500 truncate font-mono">{iss.example}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={run} className="w-full py-1.5 border border-noir-600 hover:border-gold-500/60 text-ivory-300 text-[11px]">
        重新审稿
      </button>
    </div>
  )
}

// ============================================================
// 3. 专注
// ============================================================
function FocusTab({ onSpeak, onStartFocus }) {
  const [settings, setSettings] = useState(loadFocusSettings)
  const [mode, setMode] = useState('pomodoro') // pomodoro | countup
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState('focus') // focus | break
  const [remaining, setRemaining] = useState(loadFocusSettings().focusMinutes * 60)
  const [elapsed, setElapsed] = useState(0)
  const [today, setToday] = useState(getTodayFocus)
  const [week, setWeek] = useState(getWeekFocus)
  const tickRef = useRef(null)

  // 计时
  useEffect(() => {
    if (!running) return
    tickRef.current = setInterval(() => {
      if (mode === 'pomodoro') {
        setRemaining(r => {
          if (r <= 1) {
            // 阶段结束
            clearInterval(tickRef.current)
            setRunning(false)
            playChime('end')
            if (phase === 'focus') {
              addFocusMinutes(settings.focusMinutes)
              setToday(getTodayFocus())
              setWeek(getWeekFocus())
              if (onSpeak) onSpeak(museSay('focusEnd'))
              setPhase('break')
              return settings.breakMinutes * 60
            } else {
              if (onSpeak) onSpeak('休息结束。回来吧。')
              setPhase('focus')
              return settings.focusMinutes * 60
            }
          }
          return r - 1
        })
      } else {
        setElapsed(e => e + 1)
      }
    }, 1000)
    return () => clearInterval(tickRef.current)
  }, [running, mode, phase, settings, onSpeak])

  const start = () => {
    setRunning(true)
    if (onSpeak) onSpeak(phase === 'focus' ? museSay('focusStart') : '休息一下。')
    if (onStartFocus) onStartFocus(true)
  }
  const pause = () => {
    setRunning(false)
    if (onSpeak) onSpeak(museSay('focusPause'))
    if (onStartFocus) onStartFocus(false)
  }
  const reset = () => {
    setRunning(false)
    setPhase('focus')
    setRemaining(settings.focusMinutes * 60)
    setElapsed(0)
    if (onStartFocus) onStartFocus(false)
  }
  const finishCountup = () => {
    setRunning(false)
    const mins = Math.round(elapsed / 60)
    if (mins > 0) {
      addFocusMinutes(mins)
      setToday(getTodayFocus())
      setWeek(getWeekFocus())
    }
    if (onSpeak) onSpeak(`这段写了 ${formatDuration(elapsed / 60)}。记下了。`)
    setElapsed(0)
    if (onStartFocus) onStartFocus(false)
  }

  const total = phase === 'focus' ? settings.focusMinutes * 60 : settings.breakMinutes * 60
  const display = mode === 'pomodoro' ? fmtClock(remaining) : fmtClock(elapsed)
  const pct = mode === 'pomodoro' ? ((total - remaining) / total) * 100 : 0
  const maxWeek = Math.max(30, ...week.map(w => w.minutes))

  return (
    <div className="p-3 space-y-3">
      {/* 模式切换 */}
      <div className="flex gap-1.5">
        {[
          { id: 'pomodoro', label: '番茄钟', icon: Timer },
          { id: 'countup', label: '正计时', icon: Play },
        ].map(m => {
          const Icon = m.icon
          return (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); reset() }}
              className={`flex-1 py-1.5 text-[11px] border flex items-center justify-center gap-1 ${
                mode === m.id
                  ? 'border-gold-500 text-gold-400 bg-gold-500/10'
                  : 'border-noir-600 text-ivory-400 hover:border-gold-500/40'
              }`}
            >
              <Icon size={11} /> {m.label}
            </button>
          )
        })}
      </div>

      {/* 时钟 */}
      <div className="relative flex flex-col items-center py-4 border border-noir-700 bg-noir-900">
        {mode === 'pomodoro' && (
          <div className="text-[9px] uppercase tracking-[0.25em] mb-1 flex items-center gap-1 text-gold-500">
            {phase === 'focus' ? <Target size={10} /> : <Coffee size={10} />}
            {phase === 'focus' ? '专注中' : '休息中'}
          </div>
        )}
        <div className={`font-mono text-4xl tracking-wider ${phase === 'break' ? 'text-emerald-300' : 'text-ivory-100'}`}>
          {display}
        </div>
        {mode === 'pomodoro' && (
          <div className="w-40 h-1 bg-noir-700 mt-2 overflow-hidden">
            <div className="h-full bg-gold-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {/* 控制 */}
      <div className="flex gap-1.5">
        {!running ? (
          <button
            onClick={start}
            className="flex-1 py-2 bg-gold-500 hover:bg-gold-400 text-noir-900 text-xs font-medium flex items-center justify-center gap-1"
          >
            <Play size={12} /> 开始
          </button>
        ) : (
          <button
            onClick={pause}
            className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-noir-900 text-xs font-medium flex items-center justify-center gap-1"
          >
            <Pause size={12} /> 暂停
          </button>
        )}
        {mode === 'countup' && elapsed > 0 && (
          <button
            onClick={finishCountup}
            className="px-3 py-2 border border-emerald-500/50 text-emerald-300 text-xs hover:bg-emerald-500/10"
          >
            记下
          </button>
        )}
        <button onClick={reset} className="px-3 py-2 border border-noir-600 text-ivory-300 hover:border-gold-500/50">
          <RotateCcw size={12} />
        </button>
      </div>

      {/* 时长设置 */}
      {mode === 'pomodoro' && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-ivory-500">专注</span>
          <select
            value={settings.focusMinutes}
            onChange={e => {
              const s = { ...settings, focusMinutes: Number(e.target.value) }
              setSettings(s); saveFocusSettings(s)
              if (!running) setRemaining(Number(e.target.value) * 60)
            }}
            className="bg-noir-800 border border-noir-600 text-ivory-100 text-[11px] px-1.5 py-1"
          >
            {[15, 25, 35, 45, 60, 90].map(m => <option key={m} value={m}>{m} 分</option>)}
          </select>
          <span className="text-ivory-500">休息</span>
          <select
            value={settings.breakMinutes}
            onChange={e => {
              const s = { ...settings, breakMinutes: Number(e.target.value) }
              setSettings(s); saveFocusSettings(s)
            }}
            className="bg-noir-800 border border-noir-600 text-ivory-100 text-[11px] px-1.5 py-1"
          >
            {[3, 5, 10, 15].map(m => <option key={m} value={m}>{m} 分</option>)}
          </select>
        </div>
      )}

      {/* 今日 & 打卡 */}
      <div className="border border-noir-700 bg-noir-850 p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.15em] text-gold-400">今日专注</span>
          <span className="text-[11px] text-ivory-100">
            {today.focusMinutes} 分 · {today.sessions} 段
            {today.streak > 0 && <span className="text-gold-400 ml-1.5">连续 {today.streak} 天</span>}
          </span>
        </div>
        {/* 周柱状 */}
        <div className="flex items-end gap-1 h-12">
          {week.map(w => (
            <div key={w.date} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full bg-gold-500/60 min-h-[2px]"
                style={{ height: `${Math.max(2, (w.minutes / maxWeek) * 34)}px` }}
                title={`${w.date} · ${w.minutes} 分`}
              />
              <span className="text-[8px] text-ivory-500">{w.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 4. 档案
// ============================================================
function ProfileTab({ mode, setMode, onSpeak, setExpression }) {
  const p = MUSE_PROFILE
  return (
    <div className="p-3 space-y-3">
      <div className="border border-gold-500/25 bg-gold-500/5 p-2.5">
        <div className="flex items-baseline gap-2">
          <span className="headline text-lg text-ivory-100">{p.name}</span>
          <span className="text-[10px] text-gold-400">{p.age} 岁 · {p.height}</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-ivory-500 mt-0.5">{p.role}</div>
        <p className="text-[11px] text-ivory-300 leading-relaxed mt-2 italic">「{p.intro}」</p>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-gold-400 mb-1">性格</div>
        <div className="flex flex-wrap gap-1">
          {p.traits.map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 border border-gold-500/30 text-gold-300">{t}</span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-gold-400 mb-1">喜欢</div>
        <div className="text-[11px] text-ivory-300">{p.likes.join(' · ')}</div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-gold-400 mb-1">形态</div>
        <div className="flex gap-1.5">
          {[
            { id: 'bust', label: '半身（省地方）' },
            { id: 'full', label: '全身（看得清）' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); if (onSpeak) onSpeak(museSay('modeChange')?.[m.id] || '') }}
              className={`flex-1 py-1.5 text-[11px] border ${
                mode === m.id
                  ? 'border-gold-500 text-gold-400 bg-gold-500/10'
                  : 'border-noir-600 text-ivory-400 hover:border-gold-500/40'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-gold-400 mb-1">
          视角（设定稿四视图）
        </div>
        <div className="grid grid-cols-4 gap-1">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => {
                if (setMode) setMode(v.mode)
                if (setExpression) setExpression(v.view)
              }}
              className="group relative border border-noir-600 hover:border-gold-500/60 overflow-hidden"
              title={v.label}
            >
              <div className="aspect-[3/4] overflow-hidden bg-noir-800/60">
                <img src={v.src} alt={v.label} className="w-full h-full object-cover object-top" />
              </div>
              <span className="absolute inset-x-0 bottom-0 bg-noir-950/75 text-[9px] text-gold-300 py-0.5 text-center">
                {v.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-noir-700 pt-2">
        <div className="text-[10px] uppercase tracking-[0.15em] text-gold-400 mb-1">快捷键</div>
        <div className="space-y-1 text-[11px]">
          <ShortcutRow keys="H" desc="呼出 / 收起我（不在输入框时）" />
          <ShortcutRow keys="Alt + H" desc="写作中也能呼出我" />
          <ShortcutRow keys="Esc" desc="关闭面板" />
        </div>
      </div>
    </div>
  )
}

function ShortcutRow({ keys, desc }) {
  return (
    <div className="flex items-center gap-2">
      <kbd className="px-1.5 py-0.5 bg-noir-900 border border-noir-600 text-[10px] text-gold-300 font-mono">{keys}</kbd>
      <span className="text-ivory-400 text-[10px]">{desc}</span>
    </div>
  )
}
