import { parseScriptText, serializeScript, validateFormat, getScriptStats } from './src/utils/scriptParser.js'
import { getPresetById } from './src/config/formatPresets.js'

const RAW = `装修简单但温馨的出租屋里，在情人节这天，顾源下班回家，和往常一样，冲一下热水澡卸下疲惫，换好衣服坐在沙发上。
她和其他所有的普通女孩一样，都在今天期待着一个同样的浪漫。
她拿起手机，给男朋友杨桃安发去语音。
顾：老公，你什么时候到家啊？
顾：你回来的时候可以给我带好吃的吗？今天好累，好饿，不想做饭…
杨：你今天可能得自己解决咯。我今天得陪领导去应酬，回家可能要很晚了。
杨：你点个外卖吧，吃完早点休息。
（手机屏幕，五十二元微信转账。）
女生失落的放下手机。
顾：五十二块，你还知道今天情人节啊情人节加班是什么意思嘛…
一边说着，她转身走进厨房开始简单的准备晚饭。
吃完，又想起他说晚上要去应酬，怕他吃不好回来饿，单独弄了些，放作宵夜。
顺便准备了些醒酒汤，热了保温放着，以防万一他回来醉得不行。
忙完了，她才回过头来，窝在客厅的沙发上，关灯打开电视，准备看部电影，等他回来。
一个穿着黑色羽绒服的男人，摇摇晃晃的走在街上，醉醺醺的，路上只有一两盏不够亮的灯，模糊的照着他的路。
一只小猫在草丛里叫了两声，男人注意到了，他想看看是什么，走过去，却一头栽倒在绿化带里。昏昏沉沉的，睡了过去。
依旧是雪，男人终于在地上醒来，起身回家，他的脸和耳朵已经冻得通红，双手仍然插在羽绒服口袋里，衣服裹得很严实，走路跌跌撞撞，一边走着嘴里还在嘟囔着什么。
画面来到家里。内景-出租屋女生因为等他回家，困得在沙发上睡着了，客厅的灯没开，厨房的灯亮着，放着已经热好的醒酒汤，和一些宵夜，都保温放着。
电子锁接连的解锁失败声，把她从睡梦中吵醒，她起身想去开门，还有些踉跄，越近越清晰，到门口听见，他在哭，在说着许多她听不懂的话。
她是人，知道他在因为别人难受，心里也会难受，有点委屈。她站在门口，红了眼眶，没有开门。心里一个念头：“让他冻死在外面算了”过了许久，门外没动静了，她还是忍不住担心起来。打开门，男人已经靠在门边睡着了。
她叹了口气，费劲的给他拖进门，抱上沙发。
给他解衣服时，看见，他的羽绒服里，捂着给她带的，她平时老爱让他去买的那些个小吃，因为他刚才的闹腾，衣服已经染上油渍，还有一小捧被压得有些难看的花，里面夹着一张小卡片，卡片上也染上了油污，上面歪歪扭扭写着五个字“情人节快乐”。`

const FORMATS = ['hollywood', 'netflix', 'bbc', 'cn-gov', 'fountain', 'free']

for (const id of FORMATS) {
  const elements = parseScriptText(RAW, id)
  const text = serializeScript(elements, id)
  const types = elements.map(e => e.type)
  const sluglines = elements.filter(e => e.type === 'slugline').map(e => e.text)
  const chars = [...new Set(elements.filter(e => e.type === 'character').map(e => e.text))]

  console.log(`\n================ ${id} ================`)
  console.log('elements:', types.length, '| scenes:', sluglines.length, '| characters:', chars.join(' / '))
  sluglines.forEach(s => console.log('  SLUG:', s))
  console.log('----- OUTPUT -----')
  console.log(text)
  console.log('----- END -----')

  // 幂等：同一模板下再次解析 + 序列化应保持一致
  const again = serializeScript(parseScriptText(text, id), id)
  console.log(`idempotent(${id}):`, again === text ? 'PASS' : 'FAIL')
  if (again !== text) {
    console.log('--- SECOND PASS ---')
    console.log(again)
  }
}

/* ---------- 英文无格式文本 ---------- */
const EN_RAW = `INT. COFFEE SHOP - DAY

Anna walks in from the rain. Marcus looks up from his laptop.

ANNA
(hesitant)
Is this seat taken?

MARCUS
(looking up, smiling)
It is now.

CUT TO:

EXT. STREET - NIGHT

Anna walks home alone. The streetlights flicker.`

for (const id of FORMATS) {
  const elements = parseScriptText(EN_RAW, id)
  const text = serializeScript(elements, id)
  const { issues } = validateFormat(elements, getPresetById(id))
  const stats = getScriptStats(elements, getPresetById(id))
  console.log(`\n[EN ${id}] scenes=${stats.scenes} chars=${stats.characterList.join('|')} issues=${issues.length}`)
  console.log(text)
  const again = serializeScript(parseScriptText(text, id), id)
  console.log(`idempotent(${id}):`, again === text ? 'PASS' : 'FAIL')
  if (again !== text) console.log(again)
}

