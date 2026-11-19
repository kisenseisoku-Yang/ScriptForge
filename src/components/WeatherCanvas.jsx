import React, { useEffect, useRef, useState } from 'react'

/**
 * WeatherCanvas —— 顶栏动态天气层
 * 三种模式随机切换：rain 下雨 / leaves 落叶 / fog 薄雾
 * 每 ~45 分钟换一次，2s 淡入淡出过渡
 * pointer-events: none —— 不挡按钮点击
 */

const MODES = ['rain', 'leaves', 'fog']
const SWITCH_INTERVAL_MS = 45 * 60 * 1000 // 45 分钟
const TRANSITION_MS = 2000

// —— 雨：细长直线，斜落 ——
function initRain(ctx, w, h) {
  const drops = []
  const count = Math.min(180, Math.floor(w * 0.22))
  for (let i = 0; i < count; i++) {
    drops.push({
      x: Math.random() * w,
      y: Math.random() * h,
      len: 6 + Math.random() * 14,
      speed: 5 + Math.random() * 9,
      opacity: 0.15 + Math.random() * 0.35,
      width: 0.8 + Math.random() * 0.8,
    })
  }
  return () => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = '#C8D2E6'
    for (const d of drops) {
      ctx.globalAlpha = d.opacity
      ctx.lineWidth = d.width
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      // 15° 斜角
      ctx.lineTo(d.x - d.len * 0.27, d.y + d.len)
      ctx.stroke()
      // 聚光区（中心宽 60%）加亮
      const center = Math.abs(d.x - w / 2) / (w / 2)
      if (center < 0.3) {
        ctx.globalAlpha = d.opacity * 1.4
        ctx.stroke()
      }
      d.y += d.speed
      d.x -= d.speed * 0.27
      if (d.y > h) { d.y = -20; d.x = Math.random() * w }
      if (d.x < -20) d.x = w + 20
    }
    ctx.globalAlpha = 1
  }
}

// —— 落叶：金叶螺旋飘 ——
function initLeaves(ctx, w, h) {
  // 预渲染金色树叶 SVG → Image
  const leafColors = ['#C9A84C', '#E8D58A', '#8B6F2E', '#F0E09A', '#A0853A']
  const leaves = []
  const count = Math.min(22, Math.floor(w * 0.028))
  for (let i = 0; i < count; i++) {
    leaves.push({
      x: Math.random() * w,
      y: Math.random() * h - h,
      size: 10 + Math.random() * 16,
      speed: 0.6 + Math.random() * 1.4,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.02 + Math.random() * 0.04,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      color: leafColors[Math.floor(Math.random() * leafColors.length)],
      wobbleAmp: 0.5 + Math.random() * 1.2,
    })
  }
  return () => {
    ctx.clearRect(0, 0, w, h)
    for (const l of leaves) {
      l.sway += l.swaySpeed
      l.rot += l.rotSpeed
      const x = l.x + Math.sin(l.sway) * 12 * l.wobbleAmp
      const y = l.y
      // 聚光区加亮
      const center = Math.abs(x - w / 2) / (w / 2)
      const lightBoost = center < 0.3 ? 1.5 : 1
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(l.rot)
      ctx.globalAlpha = (0.55 + Math.random() * 0.15) * lightBoost
      ctx.fillStyle = l.color
      // 简单叶子形状：椭圆 + 柄
      ctx.beginPath()
      ctx.ellipse(0, 0, l.size * 0.9, l.size * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
      // 叶柄
      ctx.strokeStyle = '#5A4A1E'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(l.size * 0.85, 0)
      ctx.lineTo(l.size * 1.3, 0)
      ctx.stroke()
      ctx.restore()
      l.y += l.speed
      l.x += Math.sin(l.sway) * 0.4
      if (l.y > h + 30) {
        l.y = -30
        l.x = Math.random() * w
        l.rot = Math.random() * Math.PI * 2
      }
    }
    ctx.globalAlpha = 1
  }
}

// —— 雾：淡白漂浮光斑 ——
// 雾用 CSS，Canvas 不需要画。这里返回一个空 ticker。
function initFog(ctx, w, h) {
  return () => { ctx.clearRect(0, 0, w, h) }
}

export default function WeatherCanvas({ mode, intensity = 1 }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const fadeRef = useRef({ opacity: 0, targetOpacity: 0 })

  useEffect(() => {
    if (mode === 'fog') return // 雾不用 Canvas，父组件用 CSS 实现

    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.parentElement.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    let ticker
    if (mode === 'rain') ticker = initRain(ctx, w, h)
    else if (mode === 'leaves') ticker = initLeaves(ctx, w, h)
    else ticker = initFog(ctx, w, h)

    // 淡入
    fadeRef.current.opacity = 0
    fadeRef.current.targetOpacity = 0.75 * intensity
    canvas.style.opacity = '0'

    let last = performance.now()
    const loop = (t) => {
      // 淡入动画（2s 内 opacity → target）
      const dt = t - last
      last = t
      const f = fadeRef.current
      if (f.opacity < f.targetOpacity) {
        f.opacity = Math.min(f.opacity + dt / TRANSITION_MS, f.targetOpacity)
        canvas.style.opacity = f.opacity.toFixed(3)
      }
      ticker()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [mode, intensity])

  if (mode === 'fog') return null // 走 CSS 雾

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    />
  )
}

// —— 天气自动切换 Hook ——
export function useAutoWeather() {
  const [mode, setMode] = useState(() => {
    const seed = localStorage.getItem('scriptforge_weather_seed')
    if (seed) return seed
    return MODES[Math.floor(Math.random() * MODES.length)]
  })

  useEffect(() => {
    localStorage.setItem('scriptforge_weather_seed', mode)
  }, [mode])

  useEffect(() => {
    const t = setInterval(() => {
      setMode(prev => {
        // 不跟上次一样
        let next = MODES[Math.floor(Math.random() * MODES.length)]
        if (next === prev) next = MODES[(MODES.indexOf(next) + 1) % MODES.length]
        return next
      })
    }, SWITCH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])

  return mode
}

export { MODES }
