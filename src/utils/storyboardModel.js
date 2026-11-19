// 分镜数据模型 v2 —— 4 种剧作学正宗预设

import { nanoid } from 'nanoid'

// 分镜表核心栏目
export const STORYBOARD_FIELDS = [
  { key: 'scene', label: '场号', type: 'text', placeholder: 'S01' },
  { key: 'cut', label: '镜号', type: 'text', placeholder: '01' },
  { key: 'shotSize', label: '景别', type: 'select', options: ['特写', '近景', '中景', '中远景', '远景', '大远景', '全景', '过肩', '主观'] },
  { key: 'cameraMove', label: '运镜', type: 'select', options: ['固定', '推', '拉', '摇', '移', '跟', '升', '降', '手持', '稳定器', '航拍'] },
  { key: 'duration', label: '时长(秒)', type: 'number', placeholder: '3' },
  { key: 'image', label: '画面描述', type: 'textarea' },
  { key: 'action', label: '动作', type: 'textarea' },
  { key: 'dialogue', label: '台词/旁白', type: 'textarea' },
  { key: 'sfx', label: '音效', type: 'text' },
  { key: 'notes', label: '备注', type: 'textarea' },
]

export function createEmptyStoryboardRow(scene = '', cut = '') {
  return {
    id: nanoid(), scene, cut,
    shotSize: '中景', cameraMove: '固定', duration: '3',
    image: '', action: '', dialogue: '', sfx: '', notes: '',
  }
}

// 4 种剧作学正宗预设 —— 各自独立的视觉/排版/元数据
export const STORYBOARD_PRESETS = {
  us_horizontal: {
    id: 'us_horizontal',
    name: '美式横向 · Film Storyboard',
    desc: '好莱坞电影工业标准 · 4×6 卡 · 2.39:1 宽屏 · 胶片齿孔',
    layout: 'american',
    aspectRatio: '2.39/1',        // 宽屏电影
    panelsPerRow: 3,
    pageSize: 'letter',
    filmPerforation: true,         // 顶部胶片齿孔
    metadataStrip: true,           // 底部 metadata strip
    metadataKeys: ['scene', 'cut', 'shotSize', 'cameraMove', 'duration'],
    columns: ['scene', 'cut', 'image', 'shotSize', 'cameraMove', 'duration', 'dialogue', 'sfx'],
  },
  jp_vertical: {
    id: 'jp_vertical',
    name: '日式竖向 · Ekonte',
    desc: '演出用分镜 · 纵向时间轴 · 2:3 竖构图 · 手写感',
    layout: 'ekonte',
    aspectRatio: '2/3',           // 竖长构图
    pageSize: 'b4',
    timecodeSidebar: true,         // 侧边时间码栏
    handwrittenFont: true,          // 手写字体
    columns: ['scene', 'cut', 'image', 'action', 'dialogue'],
  },
  cn_animation: {
    id: 'cn_animation',
    name: '中式动画 · Animation Cel',
    desc: '动画前期分镜 · 赛璐璐格 · 16:9 宽 · 对白/音效/备注三栏',
    layout: 'animation',
    aspectRatio: '16/9',          // 动画宽屏
    panelsPerRow: 3,
    pageSize: 'a4',
    celBorder: true,                // 赛璐璐蓝色边框
    threeRowFooter: true,           // 动作/对白/音效三行
    columns: ['scene', 'cut', 'image', 'shotSize', 'cameraMove', 'duration', 'dialogue', 'sfx', 'notes'],
  },
  table_view: {
    id: 'table_view',
    name: '电子表格视图',
    desc: '电影工业线表 · 10 列可编辑',
    layout: 'table',
    columns: STORYBOARD_FIELDS.map(f => f.key),
  },
}

export function calculateTotalDuration(rows) {
  return rows.reduce((sum, row) => sum + (parseFloat(row.duration) || 0), 0)
}

export function groupByScene(rows) {
  const groups = {}
  rows.forEach(row => {
    const key = row.scene || '未分类'
    if (!groups[key]) groups[key] = []
    groups[key].push(row)
  })
  return groups
}

export async function fileToCompressedDataURL(file, maxSize = 1280, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取失败'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('图片解析失败'))
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = Math.round(height * (maxSize / width))
          width = maxSize
        } else if (height > maxSize) {
          width = Math.round(width * (maxSize / height))
          height = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
