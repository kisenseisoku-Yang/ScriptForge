// 剧本虚拟目录 —— 用 IndexedDB 模拟「每个剧本一个文件夹」
// 目录结构（导出 zip 时原样还原）：
//   剧本名_sc1234567/
//     meta.json       标题 / 类型 / 梗概 / 排版格式 / 时间
//     script.md       剧本正文
//     workspace.json  构箱（笔记 / 梗概 / 人物 / 世界 / 大纲 / 三幕）
//     poster.jpg      海报（可选）
import JSZip from 'jszip'
import { saveBlob } from './exporters.js'

const DB_NAME = 'scriptforge_fs'
const DB_VERSION = 1
const S_PROJECTS = 'projects'
const S_FILES = 'files'

const LEGACY_SHELF_KEY = 'scriptforge_shelf'
const FS_INIT_KEY = 'scriptforge_fs_initialized'

let dbPromise = null
let migratePromise = null

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
      if (!db.objectStoreNames.contains(S_PROJECTS)) {
        db.createObjectStore(S_PROJECTS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(S_FILES)) {
        const store = db.createObjectStore(S_FILES, { keyPath: 'key' })
        store.createIndex('byProject', 'projectId', { unique: false })
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

async function getOne(storeName, key) {
  const db = await openDb()
  return wrap(db.transaction(storeName, 'readonly').objectStore(storeName).get(key))
}

async function getAll(storeName) {
  const db = await openDb()
  return wrap(db.transaction(storeName, 'readonly').objectStore(storeName).getAll())
}

async function putOne(storeName, value) {
  const db = await openDb()
  return wrap(db.transaction(storeName, 'readwrite').objectStore(storeName).put(value))
}

async function deleteOne(storeName, key) {
  const db = await openDb()
  return wrap(db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key))
}

// ============ 命名 ============
export function makeProjectId() {
  return 'sc_' + Math.random().toString(36).slice(2, 10)
}

export function folderName(title, id) {
  const base = String(title || '未命名剧本')
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return `${base || '剧本'}_${id}`
}

function fileKey(projectId, name) {
  return `${projectId}::${name}`
}

function safeJson(value) {
  try { return JSON.stringify(value, null, 2) } catch { return '{}' }
}

// ============ 老数据迁移 ============
// 老版本把剧本存在 localStorage 的 scriptforge_shelf 里，一次性搬进虚拟目录
export function ensureInitialized() {
  if (!migratePromise) migratePromise = doMigrate()
  return migratePromise
}

async function doMigrate() {
  try {
    if (localStorage.getItem(FS_INIT_KEY) === '1') return
    const existing = await getAll(S_PROJECTS)
    if (existing.length === 0) {
      let legacy = []
      try { legacy = JSON.parse(localStorage.getItem(LEGACY_SHELF_KEY) || '[]') } catch {}
      for (const item of legacy) {
        if (!item) continue
        const id = item.id || makeProjectId()
        await saveProjectInternal({
          id,
          title: item.title,
          genre: item.genre,
          logline: item.logline,
          poster: item.poster,
          formatId: item.formatId,
          styleId: item.styleId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })
        if (item.content) await writeProjectFile(id, 'script.md', item.content)
      }
    }
    localStorage.setItem(FS_INIT_KEY, '1')
  } catch (e) {
    console.warn('[projectStore] 初始化失败', e)
  }
}

// ============ 项目（文件夹）============
export async function listProjects() {
  await ensureInitialized()
  const list = await getAll(S_PROJECTS)
  return list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

export async function getProject(id) {
  await ensureInitialized()
  return (await getOne(S_PROJECTS, id)) || null
}

export async function saveProject(input) {
  await ensureInitialized()
  return saveProjectInternal(input)
}

async function saveProjectInternal(input) {
  const id = input.id || makeProjectId()
  const prev = await getOne(S_PROJECTS, id)
  const now = new Date().toISOString()

  const record = {
    id,
    title: input.title ?? prev?.title ?? '未命名剧本',
    genre: input.genre ?? prev?.genre ?? '',
    logline: input.logline ?? prev?.logline ?? '',
    poster: input.poster ?? prev?.poster ?? '',
    formatId: input.formatId ?? prev?.formatId ?? 'hollywood',
    styleId: input.styleId ?? prev?.styleId ?? '',
    contentLength: input.contentLength ?? prev?.contentLength ?? 0,
    createdAt: prev?.createdAt || input.createdAt || now,
    updatedAt: input.updatedAt || now,
  }
  record.folder = folderName(record.title, id)

  await putOne(S_PROJECTS, record)

  // meta.json 不写海报本体，避免把 base64 塞进可读文本
  const metaFile = {
    ...record,
    poster: record.poster ? 'poster.jpg' : '',
  }
  await writeProjectFile(id, 'meta.json', safeJson(metaFile), 'application/json')

  return record
}

export async function deleteProject(id) {
  await ensureInitialized()
  const files = await listFileRecords(id)
  const db = await openDb()
  const tx = db.transaction([S_PROJECTS, S_FILES], 'readwrite')
  tx.objectStore(S_PROJECTS).delete(id)
  files.forEach(f => tx.objectStore(S_FILES).delete(f.key))
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// ============ 文件 ============
export async function writeProjectFile(projectId, name, content, mime = 'text/plain') {
  if (!projectId || !name) return null
  const now = new Date().toISOString()
  const size = typeof content === 'string'
    ? new Blob([content]).size
    : (content?.size || 0)
  const record = {
    key: fileKey(projectId, name),
    projectId,
    name,
    mime,
    size,
    content,
    updatedAt: now,
  }
  await putOne(S_FILES, record)
  return record
}

export async function readProjectFile(projectId, name) {
  return (await getOne(S_FILES, fileKey(projectId, name))) || null
}

async function listFileRecords(projectId) {
  const db = await openDb()
  const index = db.transaction(S_FILES, 'readonly').objectStore(S_FILES).index('byProject')
  return wrap(index.getAll(IDBKeyRange.only(projectId)))
}

export async function listProjectFiles(projectId) {
  await ensureInitialized()
  const files = await listFileRecords(projectId)
  return files
    .map(f => ({ name: f.name, size: f.size || 0, mime: f.mime, updatedAt: f.updatedAt }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function deleteProjectFile(projectId, name) {
  return deleteOne(S_FILES, fileKey(projectId, name))
}

// ============ 导出 ============
function isImageName(name) {
  return /\.(jpg|jpeg|png|webp)$/i.test(name)
}

async function addFilesToZip(zip, project) {
  const folder = zip.folder(project.folder || project.id)
  const records = await listFileRecords(project.id)
  records.forEach(f => {
    if (isImageName(f.name) && typeof f.content === 'string' && f.content.startsWith('data:')) {
      folder.file(f.name, f.content.split(',')[1] || '', { base64: true })
    } else {
      folder.file(f.name, f.content)
    }
  })
  return folder
}

export async function exportProjectZip(projectId) {
  const project = await getProject(projectId)
  if (!project) throw new Error('剧本不存在')
  const zip = new JSZip()
  await addFilesToZip(zip, project)
  const blob = await zip.generateAsync({ type: 'blob' })
  return saveBlob(blob, `${project.folder || project.id}.zip`, [{ name: '剧本归档', extensions: ['zip'] }])
}

export async function exportAllProjectsZip() {
  const projects = await listProjects()
  if (projects.length === 0) throw new Error('还没有可导出的剧本')
  const zip = new JSZip()
  for (const p of projects) {
    await addFilesToZip(zip, p)
  }
  const stamp = new Date().toISOString().slice(0, 10)
  const blob = await zip.generateAsync({ type: 'blob' })
  return saveBlob(blob, `幕后剧本库-${stamp}.zip`, [{ name: '剧本库归档', extensions: ['zip'] }])
}

export async function downloadProjectFile(projectId, name) {
  const project = await getProject(projectId)
  const file = await readProjectFile(projectId, name)
  if (!file) throw new Error('文件不存在')

  if (isImageName(name) && typeof file.content === 'string' && file.content.startsWith('data:')) {
    const bin = atob(file.content.split(',')[1] || '')
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const blob = new Blob([bytes], { type: file.mime || 'image/jpeg' })
    const ext = (name.includes('.') ? name.split('.').pop() : 'jpg').toLowerCase()
    return saveBlob(blob, name, [{ name: '图片', extensions: [ext] }])
  }
  const textBlob = new Blob([file.content], { type: file.mime || 'text/plain;charset=utf-8' })
  return saveBlob(textBlob, name, [{ name: '文件', extensions: [name.includes('.') ? name.split('.').pop() : 'txt'] }])
}
