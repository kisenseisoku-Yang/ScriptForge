/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ============== 电影 Noir 美学色彩 ==============
      colors: {
        // 深炭黑基底（不是纯黑，带温度）
        noir: {
          950: '#08080A',  // 最深背景
          900: '#0C0C0F',  // 主背景
          800: '#14141A',  // 卡片背景
          700: '#1C1C24',  // 悬浮卡片
          600: '#2A2A35',  // 分割线
        },
        // 暖象牙白文字
        ivory: {
          50:  '#FAF7F2',
          100: '#F4F1EA',  // 主文字
          200: '#E8E4DC',  // 次级文字
          300: '#D4CFC4',  // 弱化文字
          400: '#8A8580',  // 辅助文字
        },
        // 暗金点缀（不是亮金，低调奢华）
        gold: {
          400: '#D4B784',
          500: '#B89768',
          600: '#9A7C52',
          700: '#7B6241',
        },
        // 墨蓝
        ink: {
          400: '#6B8A9A',
          500: '#4A6B7C',
        },
      },

      // ============== 字体系统 ==============
      fontFamily: {
        // 衬线大标题
        display: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        // 正文 sans
        sans: ['Inter', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        // 中文衬线
        serif: ['"Noto Serif SC"', '"Source Han Serif"', 'Georgia', 'serif'],
        // 剧本正文等宽
        script: ['"Courier Prime"', '"JetBrains Mono"', '"Courier New"', 'monospace'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },

      // ============== 字距微调 ==============
      letterSpacing: {
        'tighter': '-0.04em',
        'luxury': '-0.02em',
      },

      // ============== 过渡 ==============
      transitionDuration: {
        'luxury': '700ms',
      },

      // ============== 背景噪点 ==============
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.85  0 0 0 0 0.82  0 0 0 0 0.76  0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        'vignette': 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
      },

      // ============== 动画 ==============
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slow-pulse': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.75' },
        },
        // 斜角光扫 —— 按钮 hover 时一道光从左上扫到右下
        'sheen': {
          '0%': { transform: 'translateX(-120%) skewX(-20deg)' },
          '100%': { transform: 'translateX(220%) skewX(-20deg)' },
        },
        // 锁微抖 —— 暗示"你碰不到我"
        'lock-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-2px)' },
          '75%': { transform: 'translateX(2px)' },
        },
        // 锥形聚焦光 —— 卡片 hover 从底部向上打一束
        'spotlight': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // 光标熔金 —— 输入框光标变色
        'cursor-glow': {
          '0%, 100%': { boxShadow: 'inset 0 -1px 0 0 rgba(184, 151, 104, 0.3)' },
          '50%': { boxShadow: 'inset 0 -1px 0 0 rgba(184, 151, 104, 1)' },
        },
        // 保存微闪 —— 保存成功时按钮闪一次
        'save-flash': {
          '0%': { boxShadow: '0 0 0 0 rgba(184, 151, 104, 0.7)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(184, 151, 104, 0.4)' },
          '100%': { boxShadow: '0 0 0 0 rgba(184, 151, 104, 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.7s ease-out both',
        'slow-pulse': 'slow-pulse 5s ease-in-out infinite',
        'sheen': 'sheen 0.9s ease-out',
        'lock-shake': 'lock-shake 0.4s ease-in-out',
        'spotlight': 'spotlight 0.6s ease-out',
        'save-flash': 'save-flash 1.2s ease-out',
      },
    },
  },
  plugins: [],
}
