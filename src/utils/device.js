// 设备标识 —— 激活码「一码一机」的基础（纯本地软绑定）
// 说明：没有服务器，无法真正阻止有技术手段的人。这里做的是：
//   1. 每台设备生成一个稳定 id；
//   2. id 与一组稳定的浏览器特征绑定，把 localStorage 拷到另一台机器会失效；
//   3. 同一台机器重复激活不受影响。
const DEVICE_KEY = 'scriptforge_device_id'

function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

// 只用不会因为插拔显示器、改系统时区就变化的字段，避免误判成换设备
function signature() {
  const nav = typeof navigator !== 'undefined' ? navigator : {}
  return hash32([
    nav.platform || '',
    nav.hardwareConcurrency || 0,
    nav.deviceMemory || 0,
    (nav.languages || []).join(','),
  ].join('|'))
}

export function getDeviceId() {
  const fp = signature()
  try {
    const raw = localStorage.getItem(DEVICE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved && saved.id && saved.fp === fp) return saved.id
    }
  } catch {}

  const id = 'dv_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({
      id,
      fp,
      createdAt: new Date().toISOString(),
    }))
  } catch {}
  return id
}

export function getDeviceLabel(id) {
  const value = id || getDeviceId()
  return String(value).replace(/^dv_/, '').slice(-6).toUpperCase()
}
