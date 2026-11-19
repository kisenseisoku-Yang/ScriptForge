// 剧本版本快照 —— 独立 IndexedDB，按剧本 id 归档，最多保留 20 个版本
const DB_NAME = 'scriptforge_history'
const DB_VERSION = 1
const STORE = 'versions'
const MAX_VERSIONS = 20

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前环境不支持 IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('byScript', 'scriptId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function listVersions(scriptId, limit = MAX_VERSIONS) {
  if (!scriptId) return []
  const db = await openDb()
  const index = db.transaction(STORE, 'readonly').objectStore(STORE).index('byScript')
  const rows = await wrap(index.getAll(IDBKeyRange.only(scriptId)))
  return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
}

export async function saveVersion(scriptId, { title = '', formatId = 'hollywood', text = '' } = {}) {
  if (!scriptId || !String(text || '').trim()) return null
  const existing = await listVersions(scriptId, 1)
  if (existing[0] && existing[0].text === text) return existing[0]

  const record = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    scriptId,
    title,
    formatId,
    text,
    createdAt: Date.now(),
  }
  const db = await openDb()
  await wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record))

  const all = await listVersions(scriptId, MAX_VERSIONS + 20)
  const overflow = all.slice(MAX_VERSIONS)
  if (overflow.length) {
    const tx = db.transaction(STORE, 'readwrite')
    overflow.forEach(row => tx.objectStore(STORE).delete(row.id))
  }
  return record
}

export async function deleteVersion(id) {
  const db = await openDb()
  return wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
}
