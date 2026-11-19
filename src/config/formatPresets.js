// 格式预设配置（已按 2026-11 规格核查收敛）
//
// 每个保留的模板都标注了出处与证据等级：
//   sourceKind: 'official'   官方发布的规定/申报要求
//               'industry'   编剧软件官方文档、行业手册、出版机构指南
//               'convention' 行业惯例（可查证资料，但非强制标准）
//   sourceUrl 为可复核链接；没有可靠出处的模板已删除，不再硬凑数量。
//
// 核查结论（详见交付说明）：
//   - WGA 没有公开排版手册，“好莱坞标准”来自 Final Draft 默认值与行业惯例
//   - BBC 没有独立版式，只有 master-scene 示例；BAFTA 只要求 ≥12pt
//   - Netflix 没有剧本排版规范，Partner Help 的 Scripting 是字幕/配音交付规范
//   - 中国没有全国统一剧本格式；广电总局只对“申报件”规定字体与行距
//
// 因此以下模板被删除或合并（id 保留在 FORMAT_ALIASES 中，旧稿仍可打开）：
//   netflix / netflix-feature / netflix-onehour / netflix-limited → hollywood 族
//   bbc-film / bbc-tv → bbc
//   cn-tv / cn-web → cn-film
//   free → 无任何出处，删除

export const FORMAT_PRESETS = {
  hollywood: {
    id: 'hollywood',
    name: '好莱坞标准',
    nameEn: 'Hollywood Standard',
    source: 'Final Draft《How to Format a Screenplay》',
    sourceUrl: 'https://info.finaldraft.com/hubfs/Final%20Draft%20-%20How%20To%20Format%20a%20Screenplay.pdf',
    sourceKind: 'industry',
    description: 'Courier 12pt，Letter，左 1.5" 装订位，角色名距纸左 3.7"，约 55 行/页，1 页 ≈ 1 分钟',
    category: 'international',
    page: { width: 8.5, height: 11, unit: 'in' },
    font: { family: 'Courier Prime', sizePt: 12 },
    margins: { top: 1, bottom: 1, left: 1.5, right: 1, unit: 'in' },
    lineHeight: 1.15,
    slugline: { flushLeft: true, uppercase: true, bold: true, spaceBefore: 2, spaceAfter: 1 },
    action: { flushLeft: true, spaceBefore: 1, spaceAfter: 1 },
    character: { indentIn: 3.7, uppercase: true, bold: false, spaceBefore: 2 },
    parenthetical: { leftIn: 3.1, rightIn: 2.9, spaceAfter: 0 },
    dialogue: { leftIn: 3.1, rightIn: 2.9, spaceAfter: 1 },
    transition: { flushRight: true, uppercase: true, bold: true, spaceBefore: 1, spaceAfter: 2 },
    pageTiming: '1 页 ≈ 1 分钟（仅对 Courier 12pt + 标准边距成立）',
    pageNumber: { position: 'top-right', fromTop: 0.5, hideFirstPage: true },
    sluglinePatterns: ['INT.', 'EXT.', 'INT./EXT.', 'EST.'],
    family: 'english',
    sceneNumbers: false,
    titlePage: true,
  },

  // BBC：没有独立版式（BBC Writersroom 只提供 master-scene 示例，
  // BAFTA Rocliffe 只要求 industry standard 且 ≥12pt）。保留为一个模板，
  // 但明确标注“版式同好莱坞”，差异仅在 slugline 不加粗与投稿页数。
  bbc: {
    id: 'bbc',
    name: 'BBC / UK 标准',
    nameEn: 'BBC / UK Standard',
    source: 'BBC Writersroom + BAFTA Rocliffe',
    sourceUrl: 'https://rocliffe.com/FAQs2020.pdf',
    sourceKind: 'industry',
    description: '版式与好莱坞一致（Courier 12pt、同边距）；BBC/BAFTA 只要求不小于 12pt，小时剧 50-70 页',
    layoutSameAs: 'hollywood',
    category: 'television',
    page: { width: 8.5, height: 11, unit: 'in' },
    font: { family: 'Courier Prime', sizePt: 12 },
    margins: { top: 1, bottom: 1, left: 1.5, right: 1, unit: 'in' },
    lineHeight: 1.15,
    slugline: { flushLeft: true, uppercase: true, bold: false, spaceBefore: 2, spaceAfter: 1 },
    action: { flushLeft: true, spaceBefore: 1, spaceAfter: 1 },
    character: { indentIn: 3.7, uppercase: true, bold: false, spaceBefore: 2 },
    parenthetical: { leftIn: 3.1, rightIn: 2.9, spaceAfter: 0 },
    dialogue: { leftIn: 3.1, rightIn: 2.9, spaceAfter: 1 },
    transition: { flushRight: true, uppercase: true, bold: false, spaceBefore: 1, spaceAfter: 2 },
    pageTiming: '小时剧单集 50-70 页',
    pageNumber: { position: 'top-right', fromTop: 0.5, hideFirstPage: true },
    sluglinePatterns: ['INT.', 'EXT.', 'INT./EXT.'],
    family: 'english',
    sceneNumbers: false,
    titlePage: true,
  },

  // 唯一有官方文件支撑的中文模板：申报件要求三号仿宋、固定行距 30 磅。
  'cn-gov': {
    id: 'cn-gov',
    name: '广电申报稿',
    nameEn: 'NRTA Submission',
    source: '国家广电总局 2026 年度电视剧引导扶持项目申报通知',
    sourceUrl: 'http://www.nrta.gov.cn/art/2026/2/12/art_113_72461.html',
    sourceKind: 'official',
    description: '三号仿宋（16pt），固定行距 30 磅，A4，申报件要求目录页码、每集另起页',
    category: 'chinese',
    page: { width: 21, height: 29.7, unit: 'cm' },
    font: { family: 'FangSong, STFangsong, Noto Serif SC', sizePt: 16 },
    margins: { top: 2.54, bottom: 2.54, left: 3.17, right: 3.17, unit: 'cm' },
    lineHeightPt: 30,
    lineHeight: 30 / 16,
    slugline: { flushLeft: true, uppercase: false, bold: true, cnFormat: true },
    action: { flushLeft: true, indentEm: 2 },
    character: { flushLeft: true, uppercase: false, bold: true, cnFormat: true },
    dialogue: { flushLeft: true, indentEm: 2, cnFormat: true },
    parenthetical: { flushLeft: true, cnFormat: true },
    transition: { flushRight: true, bold: true, cnFormat: true },
    pageTiming: '每集另起一页',
    cnSceneFormat: true,
    family: 'chinese',
    sceneNumbers: true,
    titlePage: true,
  },

  fountain: {
    id: 'fountain',
    name: 'Fountain 语法',
    nameEn: 'Fountain Syntax',
    source: 'fountain.io 语法规范',
    sourceUrl: 'https://fountain.io/syntax',
    sourceKind: 'industry',
    description: '纯文本标记语法（不是页面排版模板）：场景头行首、转场 > 前缀、换页 ===，可导入 Final Draft',
    category: 'syntax',
    page: { width: 8.5, height: 11, unit: 'in' },
    font: { family: 'JetBrains Mono', sizePt: 12 },
    margins: { top: 1, bottom: 1, left: 1, right: 1, unit: 'in' },
    lineHeight: 1.3,
    slugline: { flushLeft: true, uppercase: true, bold: false },
    action: { flushLeft: true },
    character: { flushLeft: true, uppercase: true },
    parenthetical: { flushLeft: true },
    dialogue: { flushLeft: true },
    transition: { prefixed: '>', flushRight: true, uppercase: true },
    useFountainMarkup: true,
    family: 'fountain',
    sceneNumbers: false,
    titlePage: false,
  },
}

/* ==========================================================
   扩展格式库
   ========================================================== */
const EN_BASE = {
  page: { width: 8.5, height: 11, unit: 'in' },
  font: { family: 'Courier Prime', sizePt: 12 },
  margins: { top: 1, bottom: 1, left: 1.5, right: 1, unit: 'in' },
  lineHeight: 1.15,
  slugline: { flushLeft: true, uppercase: true, bold: true, spaceBefore: 2, spaceAfter: 1 },
  action: { flushLeft: true, spaceBefore: 1, spaceAfter: 1 },
  character: { indentIn: 3.7, uppercase: true, bold: false, spaceBefore: 2 },
  parenthetical: { leftIn: 3.1, rightIn: 2.9, spaceAfter: 0 },
  dialogue: { leftIn: 3.1, rightIn: 2.9, spaceAfter: 1 },
  transition: { flushRight: true, uppercase: true, bold: true, spaceBefore: 1, spaceAfter: 2 },
  pageNumber: { position: 'top-right', fromTop: 0.5, hideFirstPage: true },
  category: 'english',
  family: 'english',
  sceneNumbers: false,
  titlePage: true,
}

const en = (id, name, nameEn, source, description, extra = {}) => ({
  ...EN_BASE, ...extra, id, name, nameEn, source, description,
  sluglinePatterns: extra.sluglinePatterns || ['INT.', 'EXT.', 'INT./EXT.', 'EST.'],
})

const CN_BASE = {
  page: { width: 21, height: 29.7, unit: 'cm' },
  font: { family: 'FangSong', sizePt: 12 },
  margins: { top: 2.54, bottom: 2.54, left: 3.0, right: 2.54, unit: 'cm' },
  lineHeight: 1.5,
  slugline: { flushLeft: true, bold: true },
  action: { flushLeft: true },
  character: { flushLeft: true, cnFormat: true },
  parenthetical: { cnFormat: true },
  dialogue: { indentEm: 2, cnFormat: true },
  transition: { flushRight: true, cnFormat: true },
  category: 'chinese',
  family: 'chinese',
  sceneNumbers: true,
  titlePage: true,
  cnSceneFormat: true,
}

const cn = (id, name, nameEn, source, description, extra = {}) => ({
  ...CN_BASE, ...extra, id, name, nameEn, source, description,
})

Object.assign(FORMAT_PRESETS, {
  // 一小时剧：字体/边距与电影完全相同（无“剧集专用字体”），
  // 差异只在页数与幕结构，因此明确标为内容模板。
  'hollywood-tv': en(
    'hollywood-tv', '一小时剧集', 'One-Hour TV Drama',
    'Celtx / ScreenWeaver 剧集页数指南',
    '版式同好莱坞；差异是单集 50-60 页、teaser + 5-6 幕',
    {
      layoutSameAs: 'hollywood',
      sourceUrl: 'https://www.screenweaver.ai/blog/how-long-should-a-script-be',
      sourceKind: 'industry',
      pageTiming: '单集 50-60 页（流媒体可无广告幕）',
      actStructure: 'teaser-4act',
      minPageCount: 50, maxPageCount: 60,
    }
  ),
  // 半小时单机：同样只差页数与幕结构。
  'hollywood-halfhour': en(
    'hollywood-halfhour', '半小时单机喜剧', 'Half-Hour Single-Camera Comedy',
    'Celtx / ScreenWeaver 剧集页数指南',
    '版式同好莱坞；差异是单集 25-35 页、cold open + 3 幕',
    {
      layoutSameAs: 'hollywood',
      sourceUrl: 'https://www.screenweaver.ai/blog/how-long-should-a-script-be',
      sourceKind: 'industry',
      pageTiming: '单集 25-35 页',
      actStructure: 'cold-open-3act',
      minPageCount: 25, maxPageCount: 35,
    }
  ),
  // 多机位：单栏 + 对白双倍行距，这是有资料支撑的版式差异。
  // 原“双栏对白”没有可靠出处，已删除。
  'hollywood-multicam': en(
    'hollywood-multicam', '多机位情景喜剧', 'Multi-Camera Sitcom',
    'ScriptSerious / StudioBinder 格式指南（有分歧）',
    '单栏、对白双倍行距；单集 45-55 页。“双栏”无可靠出处，未采用',
    {
      layoutSameAs: 'hollywood',
      sourceUrl: 'https://scriptserious.com/wp-content/uploads/2025/10/Screenplay-Format-Guide.pdf',
      sourceKind: 'industry',
      pageTiming: '单集 45-55 页',
      actStructure: 'cold-open-2act',
      minPageCount: 45, maxPageCount: 55,
      dialogue: { leftIn: 3.1, rightIn: 2.9, spaceAfter: 1, doubleSpaced: true },
    }
  ),
  // 拍摄稿：版式与 spec 相同，多出来的是制作层标注。
  shooting: en(
    'shooting', '拍摄稿', 'Shooting Script',
    'Celtx《Spec Script vs Shooting Script》',
    '版式同 spec；多的是场号锁定、12A/12B 插入场、A/B 页、修订色（后三项暂未实现）',
    {
      layoutSameAs: 'hollywood',
      sourceUrl: 'https://blog.celtx.com/shooting-script/',
      sourceKind: 'industry',
      pageTiming: '与成片时长对应',
      sceneNumbers: true,
      productionMarks: ['sceneNumbers', 'insertScenes', 'abPages', 'revisionColors'],
      unimplementedMarks: ['insertScenes', 'abPages', 'revisionColors'],
      minPageCount: 90, maxPageCount: 120,
    }
  ),
  // 广播剧：有独立规范（音效大写、无镜头、角色名常居中），保留。
  'bbc-radio': en(
    'bbc-radio', 'BBC 广播剧', 'BBC Radio Drama',
    'BBC Writers · Radio（Sarah Crockford 指南）',
    '以声音与音效驱动；角色名居中大写、对白通栏、SFX 全大写',
    {
      sourceUrl: 'https://www.sarahcrockford.com/resources/A%20Quick%20Guide%20to%20Writing%20Radio%20Scripts.pdf',
      sourceKind: 'industry',
      page: { width: 21, height: 29.7, unit: 'cm' },
      margins: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54, unit: 'cm' },
      character: { indentIn: 0, uppercase: true, bold: false, spaceBefore: 2 },
      parenthetical: { leftIn: 0, rightIn: 0, spaceAfter: 0 },
      dialogue: { leftIn: 0, rightIn: 0, spaceAfter: 1 },
      pageTiming: '约 1 页 ≈ 1 分钟（估算）',
      radioFormat: true,
      titlePage: true,
    }
  ),
  // 舞台剧：Samuel French / Dramatists Guild 有据，字体与版式都不同。
  stage: en(
    'stage', '舞台剧', 'Stage Play',
    'Samuel French《General Formatting Guidelines》',
    '12pt Times New Roman；四边 1"；角色名居中大写；舞台指示缩进；封面不编页码',
    {
      sourceUrl: 'https://static1.squarespace.com/static/52f9468ce4b0a6dd2f9f0607/t/606a0b885e4fca448604045b/1617562504281/%20Playwriting+Formatting+Guidelines.pdf',
      sourceKind: 'industry',
      font: { family: 'Times New Roman', sizePt: 12 },
      margins: { top: 1, bottom: 1, left: 1, right: 1, unit: 'in' },
      slugline: { flushLeft: true, uppercase: false, bold: true, spaceBefore: 2, spaceAfter: 1 },
      character: { indentIn: 3.5, uppercase: true, bold: false, spaceBefore: 2 },
      dialogue: { leftIn: 1.0, rightIn: 1.0, spaceAfter: 1 },
      pageTiming: '1 页 ≈ 1 分钟舞台时间（估算，非硬规则）',
      pageNumber: { position: 'top-right', hideFirstPage: true, format: 'I-1-1' },
      actStructure: 'acts-only',
      category: 'theater',
      titlePage: true,
    }
  ),
  // 中文影视：没有国标，属可查证的行业惯例，明确标注“惯例”。
  'cn-film': cn(
    'cn-film', '中文影视剧本', 'Chinese Film / TV Script',
    '国家电影局征集启事 + 行业惯例（非国家标准）',
    'A4、仿宋小四、场号 + 内外景 + 地点 + 日夜、人物名 + 冒号；电影/电视剧/网络剧共用此版式',
    {
      sourceUrl: 'https://www.chinafilm.gov.cn/xxgk/gztz/202504/t20250429_893593.html',
      sourceKind: 'convention',
      pageTiming: '无官方页数；电影约 2.5-5 万字，电视剧每集约 1.5 万字',
    }
  ),
})

// 旧版模板 id → 合并后的模板，保证已存剧本/历史版本仍能打开
export const FORMAT_ALIASES = {
  netflix: 'hollywood',
  'netflix-feature': 'hollywood',
  'netflix-onehour': 'hollywood-tv',
  'netflix-limited': 'hollywood-tv',
  'bbc-film': 'bbc',
  'bbc-tv': 'bbc',
  'cn-tv': 'cn-film',
  'cn-web': 'cn-film',
  free: 'hollywood',
}

export const FORMAT_PRESET_LIST = Object.values(FORMAT_PRESETS)

export const getPresetById = (id) =>
  FORMAT_PRESETS[id] || FORMAT_PRESETS[FORMAT_ALIASES[id]] || FORMAT_PRESETS.hollywood
