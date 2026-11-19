// 斧头的台词库 —— 理性敏锐、有点毒舌、内心柔软

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export const MUSE_NAME = '斧头'
export const MUSE_PROFILE = {
  name: '斧头',
  age: 28,
  height: '168cm',
  role: '编剧 / 你的剧本监工',
  traits: ['理性', '敏锐', '有点毒舌', '内心柔软'],
  likes: ['看电影', '喝咖啡', '写剧本'],
  intro: '我不是来监督你的，我是来让你写完的。这两件事很像，但不是一回事。',
}

// 按场景分类的台词
export const DIALOGUE = {
  greet: [
    '坐下吧。今天想写多少？',
    '我看了你昨天的进度，还行——如果你管这叫进度的话。',
    '咖啡我喝了，剧本你写。公平。',
    '别急着开新项目，先把手上的收个尾。',
    '来了？椅子还是热的，稿子还是空的。',
    '今天不聊理论，写三场戏再说。',
    '你昨晚说今天一定开始。现在开始，不晚。',
  ],
  idle: [
    '光标在闪，你在等它自己写吗？',
    '发呆也算创作的一部分，但只有五分钟。',
    '我数了，你已经盯着这一页看了很久。',
    '要不先写最难看的那一场？写完就不难看了。',
    '写不出来，是因为你想一次写对。别想，先写。',
    '你在等灵感，灵感在等你动手。你俩谁先？',
    '这一段卡住了？跳过去，明天再回来收拾它。',
    '你刚才那口气叹得挺有戏，写进台词里正好。',
  ],
  life: [
    '水杯空了。去接一杯，回来接着写。',
    '坐太久了，站起来走两步，肩膀都硬了。',
    '窗外天变了，你一次都没抬头。',
    '饭点过了。你饿着写出来的东西，角色也会饿。',
    '手机倒扣着吧，屏幕一亮你就跑神。',
    '我不是催你，我只是在你身后一直站着，腿有点酸。',
    '写累了就趴十分钟，别硬撑，硬撑写出来的都是废纸。',
    '今天天气不错。可惜你只看得见文档。',
    '咖啡别续了，第四杯了，手都在抖。',
    '你哼的那首歌跑调了，但节奏不错，可以给这场戏用。',
  ],
  tooLittle: [
    '就这些？我见过更短的，但那是片尾字幕。',
    '字数不是全部，但你这也太不是全部了。',
    '写不下去就写烂的。烂的可以改，空白的不能。',
    '你的主角还在第一场戏里等着出场呢。',
  ],
  goodProgress: [
    '不错。今天的状态可以。',
    '继续。别在这一刻庆祝，容易散。',
    '这段我看了，比你想的好。',
    '很好，写下去，别回头改。',
    '手感回来了。趁热，多写两场。',
    '刚才那句台词有点意思，我记住了。',
  ],
  aLot: [
    '你今天写得比我预期的多。我收回一点偏见。',
    '这个量，值得一杯咖啡。我的意思是，去给我买一杯。',
    '很好。现在关掉这一页，明天再读会更容易发现问题。',
    '这速度，我得给你倒杯水了。别停。',
    '写这么多，手酸的是你，心疼的是我。歇五分钟。',
  ],
  auditClean: [
    '标点干净。这是基本功，很多人一辈子没过。',
    '我没有找到错误。这不代表它是好剧本，只代表它没有低级错误。',
    '格式上你及格了。现在的问题是内容。',
  ],
  auditDirty: [
    '问题不少，我列在下面了。别生气，我不是针对你。',
    '这些是手艺问题，改起来快。改吧。',
    '中文里塞半角标点，读起来像牙缝里塞了东西。',
    '一排排看下去，每一条都改。别跳。',
  ],
  focusStart: [
    '开始吧。这段时间里，别碰手机。',
    '专注模式。我会安静，你也安静。',
    '计时开始。写不好没关系，别停。',
  ],
  focusEnd: [
    '时间到。站起来，看看窗外。',
    '这一段结束了。你写得怎么样，自己心里有数。',
    '休息。回来的时候别重读刚才的部分，直接往下写。',
  ],
  focusPause: [
    '暂停。想清楚再回来。',
    '停在这里可以，但要知道为什么停。',
  ],
  nightOwl: [
    '这个点了。你要么是灵感来了，要么是在逃避。',
    '深夜写的东西，第二天通常会让你脸红。但我支持你写。',
  ],
  click: [
    '嗯？有事？',
    '我在。说。',
    '又想聊剧本了？',
    '别戳我，我看得见。',
  ],
  modeChange: {
    full: '站起来了。这样看得清楚点。',
    bust: '坐下了。省点地方给你写字。',
  },
}

export function museSay(context) {
  const arr = DIALOGUE[context]
  if (!arr || arr.length === 0) return ''
  return pick(arr)
}

// 根据码字量给出反应
export function reactToProgress(written, scenes) {
  if (written <= 0) return pick(DIALOGUE.tooLittle)
  if (written < 200) return pick(DIALOGUE.tooLittle)
  if (written < 1500) return pick(DIALOGUE.goodProgress)
  if (written < 4000) return pick(DIALOGUE.goodProgress)
  return pick(DIALOGUE.aLot)
}

// 根据时间给开场白
export function greetingByHour() {
  const h = new Date().getHours()
  if (h >= 23 || h < 4) return pick(DIALOGUE.nightOwl)
  if (h < 9) return '早。趁脑子还干净，先写难的。'
  if (h < 12) return pick(DIALOGUE.greet)
  if (h < 14) return '吃完就写，别躺。'
  if (h < 18) return pick(DIALOGUE.greet)
  if (h < 22) return '晚上好。今天写了多少，我看看。'
  return pick(DIALOGUE.nightOwl)
}
