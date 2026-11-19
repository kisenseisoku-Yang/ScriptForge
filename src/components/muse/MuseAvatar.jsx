import React, { useEffect, useState } from 'react'
import fullSrc from '../../assets/muse/full.png'
import fullSideSrc from '../../assets/muse/full_side.png'
import faceFront from '../../assets/muse/face_normal.png'
import faceSide from '../../assets/muse/face_side.png'

// ============================================================
// 斧头 · 原画角色
// 素材来自角色设定稿的四个视角（正面 / 侧面 × 半身 / 全身）；
// 呼吸摆动不是贴图拉伸，而是把原画按像素位移场重采样出来的序列帧。
// ============================================================

const SWAY_SRC = import.meta.glob('../../assets/muse/sway/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

function swayFrames(tag) {
  const list = []
  for (let i = 1; i <= 8; i++) {
    const hit = Object.entries(SWAY_SRC).find(([k]) => k.endsWith(`sway/${tag}_${i}.webp`))
    if (hit) list.push(hit[1])
  }
  return list
}

const SWAY = { normal: swayFrames('normal'), full: swayFrames('full') }

// 设定稿四视图，面板里直接切换
export const VIEWS = [
  { id: 'front',      label: '正面半身', mode: 'bust', view: 'front', src: faceFront },
  { id: 'side',       label: '侧面半身', mode: 'bust', view: 'side',  src: faceSide },
  { id: 'full-front', label: '正面全身', mode: 'full', view: 'front', src: fullSrc },
  { id: 'full-side',  label: '侧面全身', mode: 'full', view: 'side',  src: fullSideSrc },
]

// 情绪 → 视角：设定稿只有一张表情，换情绪时只切换机位，不做「换脸」
const MOOD_VIEW = {
  normal: 'front', smile: 'front', open: 'front', surprised: 'front', calm: 'front',
  thinking: 'side', serious: 'side', wry: 'side',
}

export default function MuseAvatar({
  expression = 'normal',
  mode = 'bust',
  focusing = false,
  width = 160,
}) {
  const isFull = mode === 'full'
  const view = expression === 'front' || expression === 'side'
    ? expression
    : (MOOD_VIEW[expression] || 'front')

  const frames = isFull ? SWAY.full : SWAY.normal
  const animated = view === 'front' && frames.length > 1
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!animated) {
      setFrame(0)
      return
    }
    // 8 帧 × 380ms ≈ 3 秒一个完整呼吸周期
    const id = setInterval(() => setFrame((v) => (v + 1) % frames.length), 380)
    return () => clearInterval(id)
  }, [animated, frames.length])

  // 换视角时给一个下沉回弹，让切换像是「她自己动了」而不是照片溶解
  const [swap, setSwap] = useState(false)
  useEffect(() => {
    setSwap(true)
    const t = setTimeout(() => setSwap(false), 320)
    return () => clearTimeout(t)
  }, [view, isFull])

  const sizeStyle = isFull
    ? { width, height: Math.round((width * 1000) / 296) }
    : { width, height: Math.round((width * 292) / 202) }

  const layers = []

  if (isFull) {
    if (view === 'side') {
      layers.push({ src: fullSideSrc, on: true, key: 'full-side' })
    } else {
      frames.forEach((src, i) => {
        layers.push({ src, on: i === frame && animated, key: `f${i}` })
      })
      if (!layers.some((l) => l.on)) layers.push({ src: fullSrc, on: true, key: 'full-still' })
    }
  } else if (view === 'side') {
    layers.push({ src: faceSide, on: true, key: 'face-side' })
  } else {
    frames.forEach((src, i) => {
      layers.push({ src, on: animated && i === frame, key: `s${i}` })
    })
    if (!layers.some((l) => l.on)) layers.push({ src: faceFront, on: true, key: 'face-still' })
  }

  return (
    <div
      className={`muse-stage ${swap ? 'is-swap' : ''} ${focusing ? 'muse-focusing' : ''}`}
      style={sizeStyle}
    >
      <div className={`muse-bitmap ${animated ? 'is-anim' : ''}`}>
        {layers.map((l) => (
          <img
            key={l.key}
            src={l.src}
            alt="斧头"
            draggable={false}
            decoding="sync"
            className={l.on ? 'is-on' : ''}
          />
        ))}
      </div>
      {isFull && <div className="muse-ground" />}
    </div>
  )
}
