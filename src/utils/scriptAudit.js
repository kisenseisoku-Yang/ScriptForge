// 剧本审稿规则引擎 —— 检查标点、空格、括号、重复标点、场景头、角色名一致性

const CJK = '\u4e00-\u9fa5'
const CJK_RE = new RegExp(`[${CJK}]`)

// 中文语境下的半角标点 → 全角对应
const HALF_TO_FULL = {
  ',': '，', '.': '。', '?': '？', '!': '！',
  ':': '：', ';': '；', '(': '（', ')': '）',
}

let seq = 0
function makeIssue(type, severity, message, lineNo, col, example) {
  return {
    id: `iss-${++seq}`,
    type,
    severity, // error | warn | info
    message,
    line: lineNo,
    col,
    example: example || '',
  }
}

/**
 * 主审稿函数
 * @param {string} text 剧本全文
 * @returns {{ issues: Array, counts: Object }}
 */
export function auditScript(text) {
  seq = 0
  const issues = []
  if (!text || !text.trim()) {
    return { issues: [], counts: { error: 0, warn: 0, info: 0, total: 0 } }
  }

  const lines = text.split('\n')

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1
    const line = rawLine

    // ---------- 1. 中文里混用半角标点 ----------
    const halfPunctInCjk = new RegExp(
      `[${CJK}]\\s*([,.?!:;])|([,.?!:;])\\s*[${CJK}]`, 'g'
    )
    let m
    while ((m = halfPunctInCjk.exec(line)) !== null) {
      const ch = m[1] || m[2]
      issues.push(makeIssue(
        'punctuation', 'error',
        `中文句子中出现半角「${ch}」，应为全角「${HALF_TO_FULL[ch]}」`,
        lineNo, m.index,
        line.slice(Math.max(0, m.index - 8), m.index + 10).trim()
      ))
      if (m.index === halfPunctInCjk.lastIndex) halfPunctInCjk.lastIndex++
    }

    // ---------- 2. 中文之间的多余空格 ----------
    const spaceBetweenCjk = new RegExp(`[${CJK}]([ \\t]{1,})[${CJK}]`, 'g')
    while ((m = spaceBetweenCjk.exec(line)) !== null) {
      issues.push(makeIssue(
        'space', 'warn',
        '中文字符之间有多余空格',
        lineNo, m.index,
        line.slice(Math.max(0, m.index - 6), m.index + 8).trim()
      ))
      if (m.index === spaceBetweenCjk.lastIndex) spaceBetweenCjk.lastIndex++
    }

    // ---------- 3. 标点前后多余空格 ----------
    const spaceAroundPunct = /([，。！？；：、）])([ \t]+)|([ \t]+)([，。！？；：、（])/g
    while ((m = spaceAroundPunct.exec(line)) !== null) {
      issues.push(makeIssue(
        'space', 'warn',
        '标点符号前后有多余空格',
        lineNo, m.index,
        line.slice(Math.max(0, m.index - 6), m.index + 8).trim()
      ))
      if (m.index === spaceAroundPunct.lastIndex) spaceAroundPunct.lastIndex++
    }

    // ---------- 4. 行尾空格 ----------
    if (/[ \t]+$/.test(line) && line.trim() !== '') {
      issues.push(makeIssue(
        'space', 'info',
        '行尾有多余空格',
        lineNo, line.length - 1,
        line.trim().slice(-14)
      ))
    }

    // ---------- 5. 全角空格 ----------
    if (line.includes('\u3000')) {
      issues.push(makeIssue(
        'space', 'warn',
        '使用了全角空格（U+3000），建议改用普通空格或制表缩进',
        lineNo, line.indexOf('\u3000'),
        line.trim().slice(0, 20)
      ))
    }

    // ---------- 6. 中文语境里的半角括号 ----------
    const halfParen = new RegExp(`[${CJK}]\\s*\\([^)]{0,40}\\)`, 'g')
    while ((m = halfParen.exec(line)) !== null) {
      issues.push(makeIssue(
        'bracket', 'error',
        '中文语境中应使用全角括号「（）」',
        lineNo, m.index,
        m[0].slice(0, 24)
      ))
      if (m.index === halfParen.lastIndex) halfParen.lastIndex++
    }

    // ---------- 7. 括号不配对 ----------
    const openCount = (line.match(/（/g) || []).length + (line.match(/\(/g) || []).length
    const closeCount = (line.match(/）/g) || []).length + (line.match(/\)/g) || []).length
    if (openCount !== closeCount) {
      issues.push(makeIssue(
        'bracket', 'error',
        `括号不配对：左括号 ${openCount} 个，右括号 ${closeCount} 个`,
        lineNo, 0, line.trim().slice(0, 24)
      ))
    }

    // ---------- 8. 重复标点 ----------
    const dupPunct = /([，。、！？；：,.!?;:])\1+/g
    while ((m = dupPunct.exec(line)) !== null) {
      // 排除英文省略号 ... 和中文省略号 ……
      if (m[0] === '...' || m[0] === '……') continue
      issues.push(makeIssue(
        'repeat', 'error',
        `重复标点「${m[0]}」`,
        lineNo, m.index,
        line.slice(Math.max(0, m.index - 8), m.index + 8).trim()
      ))
      if (m.index === dupPunct.lastIndex) dupPunct.lastIndex++
    }

    // ---------- 9. 省略号写法 ----------
    if (/\.\.\./.test(line)) {
      issues.push(makeIssue(
        'punctuation', 'info',
        '中文剧本建议用「……」代替英文「...」',
        lineNo, line.indexOf('...'),
        line.slice(Math.max(0, line.indexOf('...') - 8), line.indexOf('...') + 10).trim()
      ))
    }
    // ---------- 10. 破折号写法 ----------
    if (/(^|[^—-])--([^—-]|$)/.test(line)) {
      const i = line.search(/(^|[^—-])--([^—-]|$)/)
      issues.push(makeIssue(
        'punctuation', 'info',
        '中文剧本建议用「——」（双破折号）表示打断',
        lineNo, i,
        line.slice(Math.max(0, i - 6), i + 12).trim()
      ))
    }

    // ---------- 11. 场景头格式 ----------
    const trimmed = line.trim()
    if (/^(INT|EXT|INT\/EXT|I\/E)[\.\s]/i.test(trimmed) && !/\s[-–—]\s/.test(trimmed)) {
      issues.push(makeIssue(
        'slugline', 'warn',
        '场景头缺少「 - 」分隔符，标准写法：INT. 地点 - 时间',
        lineNo, 0, trimmed.slice(0, 30)
      ))
    }
    if (/^(INT|EXT)[\.\s]/i.test(trimmed) && !/(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|白天|夜晚|清晨|黄昏|日|夜)/i.test(trimmed)) {
      issues.push(makeIssue(
        'slugline', 'info',
        '场景头缺少时间标签（DAY / NIGHT / 白天 / 夜晚）',
        lineNo, 0, trimmed.slice(0, 30)
      ))
    }
    // 中文场景头
    if (/^场景\s*\d+/.test(trimmed) && !/[：:—\-]/.test(trimmed)) {
      issues.push(makeIssue(
        'slugline', 'info',
        '中文场景头建议加「：地点 - 时间」，如：场景1：咖啡馆 - 日',
        lineNo, 0, trimmed.slice(0, 30)
      ))
    }
  })

  // ---------- 12. 角色名大小写不一致 ----------
  const upperNames = new Set()
  const mixedNames = new Set()
  lines.forEach(line => {
    const t = line.trim()
    // 独立成行的角色名（对话提示词）
    if (/^[A-Z][A-Z0-9 #'\-\.]{1,20}$/.test(t)) upperNames.add(t)
    if (/^[A-Z][a-z]+([ ][A-Z][a-z]+)?$/.test(t)) mixedNames.add(t.toLowerCase())
  })
  upperNames.forEach(u => {
    const lower = u.toLowerCase()
    if (mixedNames.has(lower)) {
      issues.push(makeIssue(
        'character', 'warn',
        `角色名大小写不一致：「${u}」与首字母大写写法混用`,
        0, 0, u
      ))
    }
  })

  // ---------- 统计 ----------
  const counts = {
    error: issues.filter(i => i.severity === 'error').length,
    warn: issues.filter(i => i.severity === 'warn').length,
    info: issues.filter(i => i.severity === 'info').length,
    total: issues.length,
  }

  // 按类型分组统计（用于面板展示）
  const byType = {}
  issues.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1 })

  return { issues, counts, byType }
}

/**
 * 写作统计
 * @param {string} text
 */
export function computeStats(text = '') {
  const chars = text.replace(/\s/g, '').length
  const charsWithSpace = text.length
  const lines = text.split('\n').filter(l => l.trim()).length

  // 场数：英文场景头 + 中文场景头
  const sceneRe = /^(\s*)(INT|EXT|INT\/EXT|I\/E)[\.\s]/gim
  const cnSceneRe = /^\s*(场景|【\s*\d+\s*】|#\s*\d+)/gm
  const enScenes = (text.match(sceneRe) || []).length
  const cnScenes = (text.match(cnSceneRe) || []).length
  const scenes = enScenes + cnScenes

  // 角色出场统计
  const charRe = /^\s*([A-Z][A-Z0-9 '\-\.]{1,20})\s*$/gm
  const charCount = {}
  let cm
  const textForChar = text
  while ((cm = charRe.exec(textForChar)) !== null) {
    const name = cm[1].trim()
    if (['INT', 'EXT', 'FADE', 'CUT', 'THE END'].includes(name)) continue
    charCount[name] = (charCount[name] || 0) + 1
  }
  // 中文角色名（角色名后紧跟对话行）
  const cnLines = text.split('\n')
  for (let i = 0; i < cnLines.length - 1; i++) {
    const cur = cnLines[i].trim()
    const nxt = cnLines[i + 1] || ''
    if (/^[\u4e00-\u9fa5]{2,4}[\u4e00-\u9fa5]?$/.test(cur) && nxt.trim().length > 0 && /^\s/.test(nxt)) {
      charCount[cur] = (charCount[cur] || 0) + 1
    }
  }

  const characters = Object.entries(charCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  // 预估时长：中文剧本约 380 字 / 分钟（1 页 ≈ 1 分钟）
  const CHARS_PER_MIN = 380
  const minutes = chars / CHARS_PER_MIN
  const pages = minutes // 1 页 ≈ 1 分钟

  return {
    chars,
    charsWithSpace,
    lines,
    scenes,
    characters,
    minutes: Math.round(minutes * 10) / 10,
    pages: Math.round(pages * 10) / 10,
    durationText: formatDuration(minutes),
  }
}

export function formatDuration(minutes) {
  if (!minutes || minutes < 0.05) return '0 秒'
  const totalSec = Math.round(minutes * 60)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s} 秒`
  return `${s} 秒`
}

// 今日码字进度（按日期记录起始字数）
const DAILY_KEY = 'scriptforge_muse_daily'
export function getDailyProgress(currentChars) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const raw = localStorage.getItem(DAILY_KEY)
    let data = raw ? JSON.parse(raw) : null
    if (!data || data.date !== today) {
      data = { date: today, startChars: currentChars, bestChars: currentChars, goal: 3000 }
    }
    if (currentChars > (data.bestChars || 0)) data.bestChars = currentChars
    localStorage.setItem(DAILY_KEY, JSON.stringify(data))
    const written = Math.max(0, (data.bestChars || currentChars) - data.startChars)
    return { written, goal: data.goal || 3000, date: today }
  } catch {
    return { written: 0, goal: 3000, date: '' }
  }
}

export function setDailyGoal(goal) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const raw = localStorage.getItem(DAILY_KEY)
    const data = raw ? JSON.parse(raw) : { date: today, startChars: 0, bestChars: 0 }
    data.goal = goal
    localStorage.setItem(DAILY_KEY, JSON.stringify(data))
  } catch {}
}
