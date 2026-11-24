/* ============================================================
 * 生成「宝宝启蒙打卡计划」预设数据
 *   输出 1：js/baby-plan.js         —— 应用内置，设置页一键载入
 *   输出 2：../宝宝启蒙计划.json    —— 可手动「导入恢复」
 *
 * 用法：node build/make-baby-plan.mjs
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const pad2 = (n) => String(n).padStart(2, '0');

/* ---------------- 时间工具（与 core.js 同口径） ---------------- */
function toKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function weekStartOf(key) {
  const p = key.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  const w = d.getDay();
  d.setDate(d.getDate() - (w === 0 ? 6 : w - 1));
  return toKey(d);
}
const ANCHOR = weekStartOf(toKey(new Date()));

const slot = (a, b) => ({ start: a, end: b });

/* ============================================================
 * 一、清单：把每一份资源变成"按顺序消耗"的内容池
 * ============================================================ */

/** 同一级里轮换几种读法，避免每天提示一模一样 */
function rotate(tips, i) {
  return tips[i % tips.length];
}

/* ---- 1. 大猫分级绘本：工作日每天 2 本，按级别推进 ---- */
function bigCat() {
  const levels = [
    ['预备级①', '看图听音：家长读，宝宝指图找物', '指图命名：家长说词，宝宝指', '听音做动作：边读边演'],
    ['预备级②', '指读封面标题 + 跟读 3–5 词短句', '图句对应：读完让宝宝指回那一页', '重复句式：家长前半句，宝宝接后半句'],
    ['预备级③', '听读 + 回答 who / what', '圈出高频词：the / is / a / can', '跟读整句，注意语调起伏'],
    ['1级①', '跟读整句 + 图句对应', '找出 3 个认识的词，指给家长看', '读完用中文讲一遍讲了什么'],
    ['1级②', '复述 1–2 句 + 认读高频词', '听音选书：家长说一句，宝宝挑出对应的书', '自读已学句式，家长只补生词'],
    ['2级①', '自读已学句 + 简单问答', '看图说话：先用中文讲，再跟读英文', '挑 1 个新词，今晚生活里用 3 次'],
  ];
  const out = [];
  levels.forEach(([name, ...tips]) => {
    for (let i = 0; i < 10; i++) {
      out.push('大猫' + name + ' 第' + pad2(i + 1) + '本 · ' + rotate(tips, i));
    }
  });
  return out; // 60 本
}

/* ---- 2. 斑马配套绘本 L1 / L2 ---- */
function zebraBooks() {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    out.push('斑马绘本 L1-' + pad2(i) + ' · 跟读 3 遍 + 找出今天课上的词');
  }
  for (let i = 1; i <= 20; i++) {
    out.push('斑马绘本 L2-' + pad2(i) + ' · 自己读 1 句 + 家长纠音');
  }
  return out; // 40 本
}

/* ---- 3. 斑马英语课程：每周 5 节 + 周末复习/拓展 ---- */
function zebraCourse() {
  const out = [];
  for (let w = 1; w <= 10; w++) {
    for (let d = 1; d <= 5; d++) {
      out.push('斑马英语 S1 第' + w + '周 Day' + d + ' · 课程 10 分钟 + 跟读录音');
    }
    out.push('斑马英语 S1 第' + w + '周 周六复习 · 回看本周 2 节课 + 过一遍词卡');
    out.push('斑马英语 S1 第' + w + '周 周日拓展 · 本周句型用到生活里说 3 遍');
  }
  return out; // 70 节
}

/* ---- 4. 小小优趣：动画片单，3 周一轮 ---- */
const youqu = [
  '《布鲁伊》Bluey · 精看 1 集 20 分钟，看完复述 1 个情节',
  '《小猪佩奇》Peppa Pig · 看 2 集，学 1 句台词跟着说',
  '《嗨！道奇》Hey Duggee · 看 1 集，跟唱主题曲',
  '《梅西去乐趣岛》Messy Goes to Okido · 看 1 集，看完问"为什么会这样"',
  '《字母积木》Alphablocks · 看 1 集，认 2 个字母音',
  '《数字积木》Numberblocks · 看 1 集，跟着数 1–10',
  '《Super Simple Songs》 · 跟唱 3 首，边唱边做动作',
  '《单词世界》WordWorld · 看 1 集，指认 3 个单词',
  '《小鼠波波》Maisy · 看 2 集，学 1 个日常动作词',
  '《布鲁伊》Bluey 第二季 · 精看 1 集，把剧里的游戏玩一遍',
  '《小猪佩奇》Peppa Pig · 看 2 集，找今天课上学过的词',
  '《卡由》Caillou · 看 1 集，说说卡由遇到了什么事',
  '《字母积木》Alphablocks · 看 1 集，拼 1 个三字母单词',
  '《数字积木》Numberblocks · 看 1 集，用积木摆出 1–5',
  '《Super Simple Songs》 · 学 1 首新歌，睡前再唱一遍',
  '《Word World》单词世界 · 看 1 集，跟着念 3 个单词',
  '《嗨！道奇》Hey Duggee · 看 1 集，学道奇的"徽章"说法',
  '《梅西去乐趣岛》 · 看 1 集，用中文讲给家长听',
  '《布鲁伊》Bluey · 挑一集重看，这次只听不看画面',
  '自由选择 · 宝宝自己点一集，看完说出最喜欢的角色',
  /* 第二轮：同一批 IP，换关注点，避免"看过了"就没有新收获 */
  '《小猪佩奇》Peppa Pig · 看 2 集，数一数出现几次 muddy puddle',
  '《布鲁伊》Bluey · 看 1 集，学 Bluey 和 Bingo 怎么商量着玩',
  '《嗨！道奇》Hey Duggee · 看 1 集，说说这次拿了什么徽章',
  '《字母积木》Alphablocks · 看 1 集，听出开头音相同的两个词',
  '《数字积木》Numberblocks · 看 1 集，找出"比 5 多 1 个"',
  '《Super Simple Songs》 · 学 1 首动作歌，全家一起做',
  '《Word World》单词世界 · 看 1 集，拼出 1 个听到的词',
  '《梅西去乐趣岛》 · 看 1 集，看完和家长一起做个小实验',
  '《小鼠波波》Maisy · 看 2 集，复述波波今天做了什么',
  '《卡由》Caillou · 看 1 集，说说卡由为什么生气',
  '《布鲁伊》Bluey · 精看 1 集，把剧里的游戏玩一遍',
  '《小猪佩奇》Peppa Pig · 看 2 集，跟着说 3 个短句',
  '《字母积木》Alphablocks · 看 1 集，找出字母 e 的发音',
  '《数字积木》Numberblocks · 看 1 集，用积木摆出"多 2 个"',
  '《Super Simple Songs》 · 睡前放音频，只听不看',
  '《嗨！道奇》Hey Duggee · 看 1 集，学一句道奇的口头禅',
  '《Word World》单词世界 · 看 1 集，指认家里的 3 个物品',
  '《梅西去乐趣岛》 · 看 1 集，问宝宝"如果是你会怎么办"',
  '自由选择 · 宝宝点播一集，看完讲给家人听',
];

/* ---- 5. 斑马思维机：三科卡片 ---- */
function thinkCards() {
  const focus = [
    '分类：按颜色或形状分堆，说清"为什么这样分"',
    '比大小：三张卡排一排，找出最大和最小',
    '排序：按长短/高矮排成队',
    '图形辨认：圆、方、三角，生活里各找 1 个',
    '数感 1–5：点数并说出总数',
    '数感 6–10：点数 + 一眼看数量（不数）',
    '规律接续：AB 模式，问下一个是什么',
    '规律接续：ABC 模式，问下一个是什么',
    '空间方位：上、下、前、后，用玩具摆一摆',
    '空间方位：里、外、旁边，说一句话用上它',
    '一一对应：一个杯子配一个勺子',
    '数量守恒：排紧密排稀疏，数量变没变',
    '实物加减：3 个拿掉 1 个还剩几个',
    '图形拼合：两个三角拼成什么',
    '影子配对：找影子对应的实物',
    '局部与整体：看局部猜整体',
    '序列推理：先…再…最后…',
    '排除法：三个里挑出不一样的那个',
    '时间顺序：早上、中午、晚上各做什么',
    '综合闯关：随机抽 5 张，一次做完',
  ];
  return focus.map((f, i) => '思维卡 第' + (i + 1) + '组 · ' + f); // 20 组
}

const chineseCards = [
  '认字卡 · 人、口、手：指身体部位认字',
  '认字卡 · 大、小、多、少：用实物比一比',
  '认字卡 · 上、下、前、后：边摆边说',
  '词语卡 · 家人称呼：爸爸、妈妈、爷爷、奶奶',
  '词语卡 · 动物：猫、狗、鱼、鸟，学叫声',
  '词语卡 · 食物：饭、面、菜、果',
  '句子卡 · "我要喝水"句式仿说',
  '句子卡 · "这是…"句式，指物说句',
  '古诗卡 · 《咏鹅》：跟读 + 做动作',
  '古诗卡 · 《静夜思》：跟读 + 说月亮',
  '故事排序 · 三张图排先后，讲一个完整故事',
  '看图说话 · 一张图说 3 句话',
  '反义词卡 · 大小、高低、快慢',
  '量词卡 · 一只、一条、一个',
  '儿歌卡 · 拍手歌，边拍边念',
  '综合闯关 · 随机抽 5 张，认对给星星',
];

const englishCards = [
  '字母卡 A–E：认形 + 发音 + 找一个单词',
  '字母卡 F–J：认形 + 发音 + 找一个单词',
  '字母卡 K–O：认形 + 发音 + 找一个单词',
  '字母卡 P–T：认形 + 发音 + 找一个单词',
  '字母卡 U–Z：认形 + 发音 + 找一个单词',
  '单词卡 · 颜色：red / blue / yellow',
  '单词卡 · 数字：one–ten 边数边说',
  '单词卡 · 动物：cat / dog / duck / fish',
  '单词卡 · 水果：apple / banana / orange',
  '单词卡 · 身体：eye / nose / mouth / ear',
  '句型卡 · "I like…"：说 3 个喜欢的东西',
  '句型卡 · "This is…"：指物说句',
  '句型卡 · "Where is…?"：藏玩具找一找',
  '指令卡 · sit down / stand up / come here',
  '问候卡 · hello / goodbye / thank you',
  '综合闯关 · 随机抽 5 张，答对给星星',
];

/* ---- 6. 小羊上山识字 ---- */
function xiaoyang() {
  const levels = [['第1级', '60 字'], ['第2级', '120 字'], ['第3级', '180 字'], ['第4级', '240 字']];
  const out = [];
  levels.forEach(([lv, zi]) => {
    for (let i = 1; i <= 10; i++) {
      out.push('小羊上山 ' + lv + ' ' + pad2(i) + ' · ' + zi + '｜先看图讲故事，再指读生字');
    }
  });
  return out; // 40 册
}

/* ---- 7. 中文绘本：科普 / 数学 / 情感 三科轮换 ---- */
const kp = [
  '是谁嗯嗯在我的头上（动物认知）',
  '肚子里有个火车站（消化）',
  '牙齿大街的新鲜事（牙齿与刷牙）',
  '我们的身体（翻翻书，挑 2 页）',
  '揭秘恐龙（翻翻书，挑 2 页）',
  '揭秘太空（翻翻书，挑 2 页）',
  '地铁是怎样建成的（工程）',
  '房子是怎样建成的（工程）',
  '神奇校车 · 在人体中游览',
  '神奇校车 · 迷失在太阳系',
  '一粒种子的旅行（植物）',
  '叶子小屋（昆虫）',
  '下雨了，它们去哪儿（天气）',
  '昆虫记（绘本版，挑 2 种虫）',
  '水先生的奇幻旅程（水循环）',
  '空气太太去哪儿了（空气）',
  '轱辘轱辘转（机械认知）',
  '树木时钟（四季与树）',
  '小威向前冲（生命教育）',
  'DK 儿童动物百科（挑 2 页）',
];
const math = [
  '首先有一个苹果（数数）',
  '好饿的毛毛虫（数数 + 星期）',
  '点点点（颜色 + 数量）',
  '谁偷了包子（减法）',
  '鼓鼓和蛋蛋的梦想（10 的分合）',
  '我家漂亮的尺子（测量）',
  '插岘岭的狗（顺序与序数）',
  '让谁先吃好呢（排序）',
  '吃了魔法药的哈哈阿姨（图形）',
  '寻找消失的爸爸（图形）',
  '点和线相遇（点线面）',
  '世界上最帅的猪（数数策略）',
  '小偷们的黑暗银行（十进制）',
  '汪汪的生日派对（加法）',
  '都到我这里来（10 以内加减）',
  '树叶尺子（自然测量）',
  '乱七八糟的魔女之城（规律）',
  '宽宽窄窄量量看（比较）',
  '我家有只大狮子（部分与整体）',
  '避开恶猫的方法（统计图表）',
];
const emo = [
  '猜猜我有多爱你',
  '逃家小兔',
  '我爸爸',
  '我妈妈',
  '大卫，不可以',
  '爷爷一定有办法',
  '彩虹色的花',
  '活了一百万次的猫',
  '田鼠阿佛',
  '花婆婆',
  '爱心树',
  '鳄鱼怕怕，牙医怕怕',
  '抱抱',
  '菲菲生气了',
  '我的情绪小怪兽',
  '杰瑞的冷静太空',
  '小蓝和小黄',
  '月亮，生日快乐',
  '晚安，大猩猩',
  '小黑鱼',
];
function chineseBooks() {
  const out = [];
  for (let i = 0; i < 20; i++) {
    out.push('科普 · 《' + kp[i] + '》');
    out.push('数学 · 《' + math[i] + '》');
    out.push('情感 · 《' + emo[i] + '》');
  }
  return out; // 60 本，三天一轮三科
}

/* ============================================================
 * 二、模板：把清单挂到具体时间点上
 * ============================================================ */

const lists = [
  { id: 'lst_bigcat', name: '大猫分级绘本（工作日新书）', color: 'shu', items: bigCat() },
  { id: 'lst_zmbook', name: '斑马配套绘本 L1/L2', color: 'shu', items: zebraBooks() },
  { id: 'lst_zmcourse', name: '斑马英语课程 S1', color: 'shu', items: zebraCourse() },
  { id: 'lst_youqu', name: '小小优趣动画片单', color: 'shu', items: youqu },
  { id: 'lst_card_think', name: '思维机 · 思维卡', color: 'qing', items: thinkCards() },
  { id: 'lst_card_cn', name: '思维机 · 语文卡', color: 'qing', items: chineseCards },
  { id: 'lst_card_en', name: '思维机 · 英语卡', color: 'qing', items: englishCards },
  { id: 'lst_xiaoyang', name: '小羊上山识字绘本', color: 'qing', items: xiaoyang() },
  { id: 'lst_cnbook', name: '中文绘本（科普/数学/情感）', color: 'hu', items: chineseBooks() },
];

const L = (listId) => ({ type: 'list', mode: 'cycle', listId: listId, text: '' });
const F = (text) => ({ type: 'fixed', mode: 'cycle', listId: null, text: text });

const templates = [
  {
    id: 'tpl_en_read',
    name: '① 英语绘本 · 工作日饭前',
    kind: 'weekly',
    basis: 'week',
    weekdays: [1, 2, 3, 4, 5],
    color: 'shu',
    enabled: true,
    sections: [
      {
        id: 'sec_bigcat',
        label: '英语绘本 · 大猫 2 本',
        count: 1,
        perSlot: 2,
        slots: [slot('17:30', '17:50')],
        source: L('lst_bigcat'),
      },
      {
        id: 'sec_zmbook',
        label: '英语绘本 · 斑马 1 本',
        count: 1,
        perSlot: 1,
        slots: [slot('17:50', '18:00')],
        source: L('lst_zmbook'),
      },
    ],
  },
  {
    id: 'tpl_en_screen',
    name: '② 英语屏幕 · 每天晚饭后',
    kind: 'daily',
    basis: 'week',
    skipWeekdays: [],
    color: 'shu',
    enabled: true,
    sections: [
      {
        id: 'sec_zmcourse',
        label: '斑马英语课程',
        count: 1,
        perSlot: 1,
        slots: [slot('18:30', '18:40')],
        source: L('lst_zmcourse'),
      },
      {
        id: 'sec_youqu',
        label: '小小优趣动画',
        count: 1,
        perSlot: 1,
        slots: [slot('18:40', '19:00')],
        source: L('lst_youqu'),
      },
    ],
  },
  {
    id: 'tpl_card',
    name: '③ 思维机 · 隔天三科（一三五）',
    kind: 'weekly',
    basis: 'week',
    weekdays: [1, 3, 5],
    color: 'qing',
    enabled: true,
    sections: [
      {
        id: 'sec_card_think',
        label: '思维机 · 思维卡',
        count: 1,
        perSlot: 1,
        slots: [slot('19:30', '19:40')],
        source: L('lst_card_think'),
      },
      {
        id: 'sec_card_cn',
        label: '思维机 · 语文卡',
        count: 1,
        perSlot: 1,
        slots: [slot('19:40', '19:50')],
        source: L('lst_card_cn'),
      },
      {
        id: 'sec_card_en',
        label: '思维机 · 英语卡',
        count: 1,
        perSlot: 1,
        slots: [slot('19:50', '20:00')],
        source: L('lst_card_en'),
      },
    ],
  },
  {
    id: 'tpl_zi',
    name: '④ 识字 · 隔天一本（二四六）',
    kind: 'weekly',
    basis: 'week',
    weekdays: [2, 4, 6],
    color: 'qing',
    enabled: true,
    sections: [
      {
        id: 'sec_xiaoyang',
        label: '识字 · 小羊上山',
        count: 1,
        perSlot: 1,
        slots: [slot('19:30', '20:00')],
        source: L('lst_xiaoyang'),
      },
    ],
  },
  {
    id: 'tpl_cn_read',
    name: '⑤ 中文绘本 · 每天一本',
    kind: 'daily',
    basis: 'week',
    skipWeekdays: [],
    color: 'hu',
    enabled: true,
    sections: [
      {
        id: 'sec_cnbook',
        label: '中文绘本 1 本',
        count: 1,
        perSlot: 1,
        slots: [slot('20:00', '20:30')],
        source: L('lst_cnbook'),
      },
    ],
  },
  {
    id: 'tpl_weekend',
    name: '⑥ 周末晨读加量（六日）',
    kind: 'weekly',
    basis: 'week',
    weekdays: [6, 0],
    color: 'ink',
    enabled: true,
    sections: [
      {
        id: 'sec_wk_rep',
        label: '周末晨读 · 英语复读',
        count: 1,
        perSlot: 1,
        slots: [slot('09:00', '09:30')],
        source: F([
          '复读本周大猫 3 本：宝宝自己挑，家长指读、宝宝跟读',
          '复读本周斑马绘本 2 本：重点复现本周新词',
          '绘本闯关：本周 5 本摊开，宝宝挑出家长说的那一本',
          '看图说话：任选 1 本，先用中文讲一遍，再跟读英文',
        ].join('\n')),
      },
      {
        id: 'sec_wk_deep',
        label: '周末精读 · 中文',
        count: 1,
        perSlot: 1,
        slots: [slot('09:30', '10:00')],
        source: F([
          '科普精读：翻翻书挑 1 个跨页，边翻边问"为什么"',
          '数学游戏：用积木或水果做 10 以内分合',
          '情感绘本精读：读完聊"如果你是主角，你会怎么做"',
          '自由选读：让宝宝从书架挑 2 本，读给他听',
        ].join('\n')),
      },
    ],
  },
  {
    id: 'tpl_sun_review',
    name: '⑦ 周日复盘 · 回看一周',
    kind: 'weekly',
    basis: 'week',
    weekdays: [0],
    color: 'ink',
    enabled: true,
    sections: [
      {
        id: 'sec_sun_rev',
        label: '周日 · 一周复盘',
        count: 1,
        perSlot: 1,
        slots: [slot('19:30', '20:00')],
        source: F([
          '英语：本周 5 本大猫摊开，让宝宝挑"最喜欢的一本"再读一遍',
          '识字：随机抽 10 张字卡，认对一张贴一颗星',
          '思维机：挑 1 组上次没做对的卡片重做',
          '下周预告：跟宝宝说明天要读哪本新书，让他有期待',
        ].join('\n')),
      },
    ],
  },
];

/* ---------------- 组装 ---------------- */
/* 起算日是本周一，但今天之前的日子对用户来说还没"开工"——
   标成 skip 后：周表照样看得到排期，但不会变成一堆历史欠账。 */
const days = {};
{
  const todayKey = toKey(new Date());
  let k = ANCHOR;
  let guard = 0;
  while (k < todayKey && guard++ < 14) {
    days[k] = { done: {}, extra: [], skip: true };
    const p = k.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + 1);
    k = toKey(d);
  }
}

const data = {
  version: 2,
  settings: {
    weekAnchor: ANCHOR,
    autoCarry: true,
    maxCarryLookback: 7,
    carryMode: 'insert',
    keepHistory: 180,
    showQuote: true,
    quotePick: {},
    quoteSalt: '',
  },
  templates: templates,
  lists: lists,
  days: days,
  reviews: {},
  quotes: [],
  createdAt: Date.now(),
};

/* ---------------- 输出 ---------------- */
const js = '/* 宝宝启蒙打卡计划 —— 由 build/make-baby-plan.mjs 生成，勿手改 */\n' +
  'window.CM_BABY_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
fs.writeFileSync(path.join(APP, 'js', 'baby-plan.js'), js, 'utf8');

const payload = { app: 'chengming-plan', version: 1, title: '宝宝启蒙打卡计划', exportedAt: new Date().toISOString(), data: data };
fs.writeFileSync(path.join(APP, '..', '宝宝启蒙计划.json'), JSON.stringify(payload, null, 2), 'utf8');

console.log('anchor =', ANCHOR);
console.log('lists =', lists.length, '| items =', lists.reduce((a, l) => a + l.items.length, 0));
console.log('templates =', templates.length, '| sections =', templates.reduce((a, t) => a + t.sections.length, 0));
