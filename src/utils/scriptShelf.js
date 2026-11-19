﻿﻿// 剧本架数据模型 —— 底层是 projectStore 的虚拟目录（IndexedDB）
// 每个剧本 = 一个虚拟文件夹：
//   meta.json / script.md / workspace.json / poster.jpg
import {
  makeProjectId, saveProject, getProject, listProjects, deleteProject,
  writeProjectFile, readProjectFile,
} from './projectStore.js'

export async function loadShelf() {
  return listProjects()
}

export async function addScript(item) {
  const id = makeProjectId()
  const record = await saveProject({
    id,
    title: item.title || '未命名剧本',
    genre: item.genre || '',
    logline: item.logline || '',
    poster: item.poster || '',
    formatId: item.formatId || 'hollywood',
    contentLength: (item.content || '').length,
  })
  if (item.content) {
    await writeProjectFile(id, 'script.md', item.content)
  }
  return { ...record, content: item.content || '' }
}

export async function updateScript(id, patch) {
  const { content, ...rest } = patch || {}
  const record = await saveProject({
    id,
    ...rest,
    ...(content !== undefined ? { contentLength: content.length } : {}),
  })
  if (content !== undefined) {
    await writeProjectFile(id, 'script.md', content)
  }
  return { ...(record || {}), content: content ?? '' }
}

export async function deleteScript(id) {
  return deleteProject(id)
}

export async function getScript(id) {
  const record = await getProject(id)
  if (!record) return null
  const file = await readProjectFile(id, 'script.md')
  return { ...record, content: file?.content || '' }
}

// 海报图片压缩 (同 storyboard)
export async function compressPoster(file, maxSize = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取失败'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片解析失败'))
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = Math.round(height * (maxSize / width)); width = maxSize
        } else if (height > maxSize) {
          width = Math.round(width * (maxSize / height)); height = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
