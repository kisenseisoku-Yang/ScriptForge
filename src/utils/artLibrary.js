// 艺术壁纸库 v6
// 内置名画：Wikimedia Commons 公有领域（PD）高清图，本地离线打包，无水印
// 氛围摄影：Unsplash 直链（CC0）
// 自定义：用户上传 → dataURL，存 localStorage

const CUSTOM_KEY = 'scriptforge_custom_arts'

// ============ 内置艺术壁纸（31 条，全部本地离线）============
export const ART_BACKGROUNDS = [

  // ============ 古典油画 / 巴洛克 ============
  {
    id: 'vermeer-pearl',
    title: '戴珍珠耳环的少女',
    artist: 'Johannes Vermeer',
    year: '1665',
    style: '巴洛克 · 荷兰黄金时代',
    url: '/wallpapers/vermeer-pearl.jpg',
    thumb: '/wallpapers/vermeer-pearl-thumb.jpg',
    focusY: 38,
    mood: '静谧 · 光',
  },
  {
    id: 'rembrandt',
    title: '三十四岁自画像',
    artist: 'Rembrandt',
    year: '1640',
    style: '伦勃朗光 · 暗调油画',
    url: '/wallpapers/rembrandt.jpg',
    thumb: '/wallpapers/rembrandt-thumb.jpg',
    focusY: 38,
    mood: '沉思 · 暗金',
  },
  {
    id: 'de-hoch-interior',
    title: '代尔夫特庭院',
    artist: 'Pieter de Hooch',
    year: '1658',
    style: '荷兰室内',
    url: '/wallpapers/de-hoch-interior.jpg',
    thumb: '/wallpapers/de-hoch-interior-thumb.jpg',
    focusY: 38,
    mood: '日光 · 室内',
  },
  {
    id: 'baroque-chiaroscuro',
    title: '圣马太的召唤',
    artist: 'Caravaggio',
    year: '1599–1600',
    style: '巴洛克 · 明暗对照',
    url: '/wallpapers/baroque-chiaroscuro.jpg',
    thumb: '/wallpapers/baroque-chiaroscuro-thumb.jpg',
    focusY: 50,
    mood: '戏剧性 · 明暗',
  },

  // ============ 文艺复兴 ============
  {
    id: 'raphael-madonna',
    title: '西斯廷圣母',
    artist: 'Raphael',
    year: '1512',
    style: '文艺复兴',
    url: '/wallpapers/raphael-madonna.jpg',
    thumb: '/wallpapers/raphael-madonna-thumb.jpg',
    focusY: 40,
    mood: '神圣 · 蓝',
  },
  {
    id: 'renaissance-interior',
    title: '雅典学院',
    artist: 'Raphael',
    year: '1511',
    style: '文艺复兴壁画',
    url: '/wallpapers/renaissance-interior.jpg',
    thumb: '/wallpapers/renaissance-interior-thumb.jpg',
    focusY: 40,
    mood: '庄重 · 金',
  },
  {
    id: 'botticelli-venus',
    title: '维纳斯的诞生',
    artist: 'Sandro Botticelli',
    year: '1485',
    style: '佛罗伦萨文艺复兴',
    url: '/wallpapers/botticelli-venus.jpg',
    thumb: '/wallpapers/botticelli-venus-thumb.jpg',
    focusY: 50,
    mood: '柔 · 诞生',
  },
  {
    id: 'titian-assumption',
    title: '圣母升天',
    artist: 'Titian',
    year: '1518',
    style: '威尼斯文艺复兴',
    url: '/wallpapers/titian-assumption.jpg',
    thumb: '/wallpapers/titian-assumption-thumb.jpg',
    focusY: 40,
    mood: '升腾 · 光',
  },

  // ============ 印象派 ============
  {
    id: 'monet-lilies',
    title: '睡莲',
    artist: 'Claude Monet',
    year: '1906',
    style: '印象派',
    url: '/wallpapers/monet-lilies.jpg',
    thumb: '/wallpapers/monet-lilies-thumb.jpg',
    focusY: 50,
    mood: '宁静 · 水面',
  },
  {
    id: 'monet-poppies',
    title: '罂粟田',
    artist: 'Claude Monet',
    year: '1873',
    style: '印象派',
    url: '/wallpapers/monet-poppies.jpg',
    thumb: '/wallpapers/monet-poppies-thumb.jpg',
    focusY: 50,
    mood: '红 · 田园',
  },
  {
    id: 'monet-san-giorgio',
    title: '黄昏的圣乔治',
    artist: 'Claude Monet',
    year: '1908',
    style: '印象派 · 威尼斯',
    url: '/wallpapers/monet-san-giorgio.jpg',
    thumb: '/wallpapers/monet-san-giorgio-thumb.jpg',
    focusY: 50,
    mood: '紫 · 晚霞',
  },
  {
    id: 'degas-dancers',
    title: '粉红与绿的舞者',
    artist: 'Edgar Degas',
    year: '1890',
    style: '印象派 · 芭蕾',
    url: '/wallpapers/degas-dancers.jpg',
    thumb: '/wallpapers/degas-dancers-thumb.jpg',
    focusY: 48,
    mood: '粉 · 绿',
  },

  // ============ 后印象派 / 梵高 ============
  {
    id: 'vangogh-irises',
    title: '鸢尾花',
    artist: 'Vincent van Gogh',
    year: '1889',
    style: '后印象派',
    url: '/wallpapers/vangogh-irises.jpg',
    thumb: '/wallpapers/vangogh-irises-thumb.jpg',
    focusY: 50,
    mood: '紫 · 怒放',
  },
  {
    id: 'vangogh-sunflowers',
    title: '向日葵',
    artist: 'Vincent van Gogh',
    year: '1888',
    style: '后印象派',
    url: '/wallpapers/vangogh-sunflowers.jpg',
    thumb: '/wallpapers/vangogh-sunflowers-thumb.jpg',
    focusY: 50,
    mood: '黄 · 炽热',
  },
  {
    id: 'vangogh-roses',
    title: '玫瑰花瓶',
    artist: 'Vincent van Gogh',
    year: '1890',
    style: '后印象派',
    url: '/wallpapers/vangogh-roses.jpg',
    thumb: '/wallpapers/vangogh-roses-thumb.jpg',
    focusY: 44,
    mood: '粉 · 瓣',
  },
  {
    id: 'vangogh-almond',
    title: '盛开的杏花',
    artist: 'Vincent van Gogh',
    year: '1890',
    style: '后印象派',
    url: '/wallpapers/vangogh-almond.jpg',
    thumb: '/wallpapers/vangogh-almond-thumb.jpg',
    focusY: 44,
    mood: '白 · 春',
  },
  {
    id: 'vangogh-potatoes',
    title: '吃土豆的人',
    artist: 'Vincent van Gogh',
    year: '1885',
    style: '后印象派',
    url: '/wallpapers/vangogh-potatoes.jpg',
    thumb: '/wallpapers/vangogh-potatoes-thumb.jpg',
    focusY: 46,
    mood: '土 · 沉',
  },
  {
    id: 'impression-landscape',
    title: '麦田群鸦',
    artist: 'Vincent van Gogh',
    year: '1890',
    style: '后印象派',
    url: '/wallpapers/impression-landscape.jpg',
    thumb: '/wallpapers/impression-landscape-thumb.jpg',
    focusY: 50,
    mood: '金 · 阴云',
  },

  // ============ 后印象派 / 塞尚 / 高更 ============
  {
    id: 'gauguin-tahiti',
    title: '两个塔希提女人',
    artist: 'Paul Gauguin',
    year: '1899',
    style: '后印象派 · 综合主义',
    url: '/wallpapers/gauguin-tahiti.jpg',
    thumb: '/wallpapers/gauguin-tahiti-thumb.jpg',
    focusY: 44,
    mood: '暖 · 异域',
  },

  // ============ 浪漫主义 ============
  {
    id: 'delacroix-liberty',
    title: '自由引导人民',
    artist: 'Eugène Delacroix',
    year: '1830',
    style: '浪漫主义',
    url: '/wallpapers/delacroix-liberty.jpg',
    thumb: '/wallpapers/delacroix-liberty-thumb.jpg',
    focusY: 50,
    mood: '张力 · 红',
  },
  {
    id: 'goya-dark',
    title: '1808年5月3日',
    artist: 'Francisco Goya',
    year: '1814',
    style: '浪漫主义 · 暗黑',
    url: '/wallpapers/goya-dark.jpg',
    thumb: '/wallpapers/goya-dark-thumb.jpg',
    focusY: 50,
    mood: '暗黑 · 张力',
  },
  {
    id: 'friedrich-fog',
    title: '雾海上的漫游者',
    artist: 'Caspar David Friedrich',
    year: '1818',
    style: '德国浪漫',
    url: '/wallpapers/friedrich-fog.jpg',
    thumb: '/wallpapers/friedrich-fog-thumb.jpg',
    focusY: 52,
    mood: '雾 · 远',
  },
  {
    id: 'turner-rain',
    title: '雨、蒸汽与速度',
    artist: 'J.M.W. Turner',
    year: '1844',
    style: '浪漫主义 · 光',
    url: '/wallpapers/turner-rain.jpg',
    thumb: '/wallpapers/turner-rain-thumb.jpg',
    focusY: 62,
    mood: '雨 · 力',
  },

  // ============ 抽象 / 现代 ============
  {
    id: 'kandinsky',
    title: '构成第七号',
    artist: 'Wassily Kandinsky',
    year: '1913',
    style: '抽象表现主义',
    url: '/wallpapers/kandinsky.jpg',
    thumb: '/wallpapers/kandinsky-thumb.jpg',
    focusY: 50,
    mood: '圆 · 色彩',
  },
  {
    id: 'mondrian',
    title: '百老汇爵士乐',
    artist: 'Piet Mondrian',
    year: '1942–43',
    style: 'De Stijl',
    url: '/wallpapers/mondrian.jpg',
    thumb: '/wallpapers/mondrian-thumb.jpg',
    focusY: 50,
    mood: '格 · 原色',
  },
  {
    id: 'picasso-guernica',
    title: '格尔尼卡',
    artist: 'Pablo Picasso',
    year: '1937',
    style: '立体主义 · 控诉',
    url: '/wallpapers/picasso-guernica.jpg',
    thumb: '/wallpapers/picasso-guernica-thumb.jpg',
    focusY: 50,
    mood: '痛 · 黑',
  },
  {
    id: 'pollock',
    title: '滴 · 能量',
    artist: '抽象 · 泼洒',
    year: '—',
    style: 'Action Painting',
    url: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=2000&q=85',
    mood: '滴 · 能量',
  },
  {
    id: 'rothko-fields',
    title: '色域',
    artist: '抽象 · 色域',
    year: '—',
    style: '色域摄影',
    url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=2000&q=85',
    mood: '沉 · 色域',
  },

  // ============ 东方 ============
  {
    id: 'chinese-ink',
    title: '谿山行旅图',
    artist: '范宽',
    year: '北宋',
    style: '水墨 · 绢本',
    url: '/wallpapers/chinese-ink.jpg',
    thumb: '/wallpapers/chinese-ink-thumb.jpg',
    focusY: 30,
    mood: '山水 · 墨',
  },
  {
    id: 'ukiyoe-wave',
    title: '神奈川冲浪里',
    artist: '葛饰北斋',
    year: '1831',
    style: '浮世绘',
    url: '/wallpapers/ukiyoe-wave.jpg',
    thumb: '/wallpapers/ukiyoe-wave-thumb.jpg',
    focusY: 30,
    mood: '浪 · 蓝',
  },
  {
    id: 'hokusai-fuji',
    title: '赤富士',
    artist: '葛饰北斋',
    year: '1831',
    style: '浮世绘 · 富岳三十六景',
    url: '/wallpapers/hokusai-fuji.jpg',
    thumb: '/wallpapers/hokusai-fuji-thumb.jpg',
    focusY: 55,
    mood: '赤 · 风',
  },
  {
    id: 'japan-temple',
    title: '浅草金龙山',
    artist: '歌川广重',
    year: '1856',
    style: '浮世绘 · 名所江户百景',
    url: '/wallpapers/japan-temple.jpg',
    thumb: '/wallpapers/japan-temple-thumb.jpg',
    focusY: 45,
    mood: '寂 · 禅',
  },
  {
    id: 'asian-paper',
    title: '千里江山图',
    artist: '王希孟',
    year: '1113',
    style: '青绿山水 · 长卷',
    url: '/wallpapers/asian-paper.jpg',
    thumb: '/wallpapers/asian-paper-thumb.jpg',
    focusY: 42,
    mood: '青绿 · 江山',
  },

  // ============ 摄影 · 光影（Unsplash CC0） ============
  {
    id: 'studio-light',
    title: '摄影棚光',
    artist: '—',
    year: '—',
    style: '光影',
    url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=2000&q=85',
    mood: '光 · 影',
  },
  {
    id: 'film-reel',
    title: '胶片颗粒',
    artist: '—',
    year: '—',
    style: '电影感',
    url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=2000&q=85',
    mood: '胶片 · 颗粒',
  },
  {
    id: 'neon-noir',
    title: '霓虹夜',
    artist: '—',
    year: '—',
    style: '赛博黑色',
    url: 'https://images.unsplash.com/photo-1515630278258-407f66498911?auto=format&fit=crop&w=2000&q=85',
    mood: '霓虹 · 夜',
  },
  {
    id: 'minimal-arch',
    title: '极简建筑',
    artist: '—',
    year: '—',
    style: '极简',
    url: 'https://images.unsplash.com/photo-1486718448742-163732cd1544?auto=format&fit=crop&w=2000&q=85',
    mood: '极简 · 线条',
  },
]

// ============ 自定义壁纸 CRUD ============
export function getCustomArts() {
  try {
    const v = localStorage.getItem(CUSTOM_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}

export function saveCustomArt(art) {
  const list = getCustomArts()
  const newArt = {
    id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    title: art.title || '我的壁纸',
    artist: '自定义上传',
    year: '',
    style: '自定义',
    url: art.url, // dataURL
    mood: '自定义',
    custom: true,
    createdAt: new Date().toISOString(),
  }
  list.unshift(newArt)
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)) } catch (e) {
    console.warn('壁纸存储失败', e)
    throw new Error('图片过大或存储空间不足')
  }
  return newArt
}

export function deleteCustomArt(id) {
  const list = getCustomArts().filter(a => a.id !== id)
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)) } catch {}
}

// ============ 合并查询 ============
export function getAllArts() {
  return [...getCustomArts(), ...ART_BACKGROUNDS]
}

export function getArtById(id) {
  if (!id) return null
  // 先查自定义（可能 id 冲突，自定义优先）
  const custom = getCustomArts().find(a => a.id === id)
  if (custom) return custom
  return ART_BACKGROUNDS.find(a => a.id === id) || null
}

// ============ 图片压缩 ============
export function fileToArtDataURL(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('不是图片'))
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, maxWidth / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('图片解码失败'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}
