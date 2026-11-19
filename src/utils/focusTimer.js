// 专注计时器 —— 番茄钟 + 正计时 + 打卡记录

const RECORD_KEY = 'scriptforge_muse_focus'
const SETTINGS_KEY = 'scriptforge_muse_focus_settings'

export const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  breakMinutes: 5,
}

export function loadFocusSettings() {
  try {
    const v = localStorage.getItem(SETTINGS_KEY)
    return v ? { ...DEFAULT_SETTINGS, ...JSON.parse(v) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveFocusSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

// 记录：{ date: { focusMinutes, sessions, streak } }
export function loadFocusRecord() {
  try {
    const v = localStorage.getItem(RECORD_KEY)
    return v ? JSON.parse(v) : { days: {}, streak: 0, lastDate: '' }
  } catch {
    return { days: {}, streak: 0, lastDate: '' }
  }
}

const todayStr = () => new Date().toISOString().slice(0, 10)

export function addFocusMinutes(minutes) {
  const rec = loadFocusRecord()
  const today = todayStr()
  if (!rec.days[today]) rec.days[today] = { focusMinutes: 0, sessions: 0 }
  rec.days[today].focusMinutes += minutes
  rec.days[today].sessions += 1

  // 连续天数计算
  if (rec.lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    rec.streak = rec.lastDate === yesterday ? (rec.streak || 0) + 1 : 1
    rec.lastDate = today
  }

  // 只保留最近 60 天
  const keys = Object.keys(rec.days).sort()
  if (keys.length > 60) {
    keys.slice(0, keys.length - 60).forEach(k => delete rec.days[k])
  }

  try { localStorage.setItem(RECORD_KEY, JSON.stringify(rec)) } catch {}
  return rec
}

export function getTodayFocus() {
  const rec = loadFocusRecord()
  const d = rec.days[todayStr()]
  return {
    focusMinutes: d?.focusMinutes || 0,
    sessions: d?.sessions || 0,
    streak: rec.streak || 0,
  }
}

export function getWeekFocus() {
  const rec = loadFocusRecord()
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    out.push({
      date: key,
      label: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
      minutes: rec.days[key]?.focusMinutes || 0,
    })
  }
  return out
}

// 格式化 mm:ss 或 h:mm:ss
export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = n => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

// 提示音（Web Audio 生成，无需外部文件）
export function playChime(type = 'end') {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const notes = type === 'end' ? [659.25, 783.99, 1046.5] : [880]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.9)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.18)
      osc.stop(ctx.currentTime + i * 0.18 + 1)
    })
    setTimeout(() => ctx.close(), 2500)
  } catch {}
}
