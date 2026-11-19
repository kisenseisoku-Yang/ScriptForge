// 激活码系统 - 纯函数模块
import { getDeviceId } from './device.js'

const LICENSE_STORAGE_KEY = 'scriptforge_license'
const ISSUED_CODES_KEY = 'scriptforge_issued_codes'
const ACTIVATIONS_KEY = 'scriptforge_activations'

// ============ 一码一机：本机激活记录 ============
function loadActivations() {
  try { return JSON.parse(localStorage.getItem(ACTIVATIONS_KEY) || '{}') } catch { return {} }
}

function getActivation(code) {
  if (!code) return null
  return loadActivations()[String(code).toUpperCase()] || null
}

function recordActivation(code, deviceId) {
  if (!code) return
  const list = loadActivations()
  list[String(code).toUpperCase()] = { deviceId, at: new Date().toISOString() }
  try { localStorage.setItem(ACTIVATIONS_KEY, JSON.stringify(list)) } catch {}
}

export function getBoundDevice(code) {
  return getActivation(code)
}


// ============ 默认内置的有效激活码 ============
// 硬编码在源码中，任何浏览器都能直接验证
export const DEFAULT_VALID_CODES = [
  { code: 'SF-TEST-MUHOU-2026', plan: 'test', expires: null, role: 'admin' },   // ⭐ 通用测试码
  { code: 'SF-ADMIN-0000-0000', plan: 'lifetime', expires: null, role: 'admin' },
  { code: 'SF-DEMO-2024-AAAA', plan: 'pro', expires: null, role: 'admin' },
  { code: 'SF-TEST-TRIAL-101', plan: 'trial', expires: null, role: 'user' },
  { code: 'SF-FREE-WELCOME-1', plan: 'free', expires: null, role: 'user' },
]

// ============ 激活码格式 ============
// 新格式：SF-AAAAA-BBBB-CCCCCC
//   A 段 5 位 = 计划位 1 位 + 到期日 4 位（36 进制，自 2024-01-01 起的天数，0000 = 永不过期）
//   B 段 4 位 = 随机序号
//   C 段 6 位 = 签名（由 A+B 段与内置密钥算出）
// 码本身自带签名，所以在任何浏览器 / 任何设备上都能离线验证，不依赖生成它的那台电脑。
const LICENSE_FORMAT = /^SF-[A-Z0-9]{5}-[A-Z0-9]{4}-[A-Z0-9]{6}$/
// 旧格式：SF-XXX-XXX-XXX（只能靠本机记录验证，换设备无效）
const LEGACY_FORMAT = /^SF-[A-Z0-9]{3,8}-[A-Z0-9]{3,8}-[A-Z0-9]{1,8}$/

const SIGN_SECRET = 'muhou-scriptforge-2026-sign'
const EPOCH = Date.UTC(2024, 0, 1)
const DAY_MS = 24 * 60 * 60 * 1000
const PLAN_BY_CHAR = { L: 'lifetime', P: 'pro', T: 'trial', F: 'free', A: 'admin' }
const CHAR_BY_PLAN = { lifetime: 'L', pro: 'P', trial: 'T', free: 'F', admin: 'A' }
const RAND_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉 I/O/0/1，避免手抄出错

function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let g = 5381
  for (let i = str.length - 1; i >= 0; i--) g = (Math.imul(g, 33) ^ str.charCodeAt(i)) >>> 0
  return (h ^ g) >>> 0
}

function sign(payload) {
  return hash32(`${SIGN_SECRET}|${payload}`)
    .toString(36)
    .toUpperCase()
    .padStart(6, '0')
    .slice(-6)
}

function randomChars(n) {
  let out = ''
  for (let i = 0; i < n; i++) out += RAND_CHARS.charAt(Math.floor(Math.random() * RAND_CHARS.length))
  return out
}

function encodeExpiry(expires) {
  if (!expires) return '0000'
  const days = Math.ceil((new Date(expires).getTime() - EPOCH) / DAY_MS)
  return Math.max(1, days).toString(36).toUpperCase().padStart(4, '0').slice(-4)
}

function decodeExpiry(seg) {
  const days = parseInt(seg, 36)
  if (!days || Number.isNaN(days)) return null
  return new Date(EPOCH + days * DAY_MS).toISOString()
}

// 验证激活码（纯函数，可独立调用）
export function validateLicenseCode(input) {
  if (!input) return { valid: false, reason: '激活码不能为空' }

  const code = input.trim().toUpperCase()

  if (!LEGACY_FORMAT.test(code)) {
    return { valid: false, reason: '激活码格式不正确，应为 SF-XXXXX-XXXX-XXXXXX' }
  }

  // 1. 先检查内置默认码（硬编码在源码里）
  let license = DEFAULT_VALID_CODES.find(c => c.code === code)

  // 2. 本机签发过的历史码（旧格式随机码没有签名，只在这台浏览器里有效）
  if (!license) {
    try {
      const stored = localStorage.getItem(ISSUED_CODES_KEY)
      if (stored) {
        const issued = JSON.parse(stored)
        license = issued.find(c => c.code === code)
      }
    } catch {}
  }

  // 3. 校验签名 —— 这一步不查任何存储，所以换设备、换浏览器同样有效
  if (!license && LICENSE_FORMAT.test(code)) {
    const [a, b, sig] = code.split('-').slice(1)
    if (sign(a + b) === sig) {
      const plan = PLAN_BY_CHAR[a.charAt(0)]
      if (plan) {
        license = {
          code,
          plan,
          expires: decodeExpiry(a.slice(1)),
          role: plan === 'admin' ? 'admin' : 'user',
        }
      }
    }
  }

  if (!license) {
    return { valid: false, reason: '激活码无效或未授权，请联系作者获取正版' }
  }

  // 一码一机：本机已用该码绑定过别的设备，就拒绝
  // 但测试码（plan === 'test'）永远通用，不受设备绑定限制
  const deviceId = getDeviceId()
  if (license.plan !== 'test') {
    const bound = getActivation(license.code)
    if (bound && bound.deviceId !== deviceId) {
      return { valid: false, reason: '此激活码已绑定其他设备，无法在本机使用' }
    }
  }

  // 检查过期
  if (license.expires && new Date() > new Date(license.expires)) {
    return { valid: false, reason: '激活码已过期' }
  }

  return {
    valid: true,
    plan: license.plan,
    role: license.role || 'user',
    expires: license.expires,
    activatedAt: new Date().toISOString(),
    deviceId,
    code: code,
  }
}

// 保存激活信息到 localStorage
export function saveLicense(license) {
  const deviceId = license.deviceId || getDeviceId()
  const payload = { ...license, deviceId }
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(payload))
  recordActivation(payload.code, deviceId)
}

// 清除激活信息（解绑记录保留，避免同一设备反复绑定）
export function clearLicense() {
  localStorage.removeItem(LICENSE_STORAGE_KEY)
}

// 读取当前激活信息
export function loadLicense() {
  try {
    const stored = localStorage.getItem(LICENSE_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)

    // 早期激活信息没有设备号，补上当前设备
    if (!parsed.deviceId) {
      parsed.deviceId = getDeviceId()
      localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(parsed))
    }

    // 换了设备（或把 localStorage 拷到别的机器）→ 失效
    if (parsed.deviceId !== getDeviceId()) {
      localStorage.removeItem(LICENSE_STORAGE_KEY)
      return null
    }

    if (parsed.expires && new Date() > new Date(parsed.expires)) {
      localStorage.removeItem(LICENSE_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

// ============ 管理后台工具 ============
export function generateLicenseCode(plan = 'pro', daysValid = 365) {
  const expires = daysValid
    ? new Date(Date.now() + daysValid * DAY_MS).toISOString()
    : null

  const a = (CHAR_BY_PLAN[plan] || 'P') + encodeExpiry(expires)
  const b = randomChars(4)
  const code = `SF-${a}-${b}-${sign(a + b)}`

  let list = []
  try { list = JSON.parse(localStorage.getItem(ISSUED_CODES_KEY) || '[]') } catch {}
  list.push({ code, plan, expires, role: 'user', createdAt: new Date().toISOString() })
  localStorage.setItem(ISSUED_CODES_KEY, JSON.stringify(list))

  return { code, plan, expires }
}

export function getIssuedCodes() {
  try {
    return JSON.parse(localStorage.getItem(ISSUED_CODES_KEY) || '[]')
  } catch {
    return []
  }
}

export function deleteIssuedCode(code) {
  try {
    const list = JSON.parse(localStorage.getItem(ISSUED_CODES_KEY) || '[]')
    const filtered = list.filter(c => c.code !== code)
    localStorage.setItem(ISSUED_CODES_KEY, JSON.stringify(filtered))
  } catch {}
}

// 台账导出 / 导入（静态站点没有服务器，记录只在本机，靠这两个按钮在设备间搬）
export function exportIssuedCodes() {
  return JSON.stringify(getIssuedCodes(), null, 2)
}

export function importIssuedCodes(json) {
  let incoming
  try { incoming = JSON.parse(json) } catch { return { ok: false, added: 0 } }
  if (!Array.isArray(incoming)) return { ok: false, added: 0 }

  const list = getIssuedCodes()
  const known = new Set(list.map(c => c.code))
  let added = 0
  incoming.forEach(item => {
    if (item && typeof item.code === 'string' && !known.has(item.code)) {
      known.add(item.code)
      list.push(item)
      added++
    }
  })
  localStorage.setItem(ISSUED_CODES_KEY, JSON.stringify(list))
  return { ok: true, added }
}

// 管理员密码
export const ADMIN_PASSWORD = 'scriptforge-admin-2025'
export function isAdmin(password) { return password === ADMIN_PASSWORD }
