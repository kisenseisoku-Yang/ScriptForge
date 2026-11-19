import { useEffect } from 'react'

// 每个页面进入时同步 title / description / robots，供搜索引擎与分享卡片读取
export function usePageSeo({ title, description, noindex = false }) {
  useEffect(() => {
    if (title) document.title = title

    if (description) {
      const pairs = [
        ['name', 'description', description],
        ['property', 'og:description', description],
        ['name', 'twitter:description', description],
      ]
      for (const [attr, key, value] of pairs) {
        const el = document.head.querySelector(`meta[${attr}="${key}"]`)
        if (el) el.setAttribute('content', value)
      }
    }

    const robots = document.head.querySelector('meta[name="robots"]')
    if (robots) robots.setAttribute('content', noindex ? 'noindex,nofollow' : 'index,follow')
  }, [title, description, noindex])
}
