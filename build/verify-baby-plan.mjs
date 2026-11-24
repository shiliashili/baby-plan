/* 校验：用 core.js 的排期引擎模拟一周，检查每天时间点与总时长 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const sandbox = { window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(APP, 'js', 'core.js'), 'utf8'), sandbox);
const CM = sandbox.window.CM;

const data = JSON.parse(fs.readFileSync(path.join(APP, '..', '宝宝启蒙计划.json'), 'utf8')).data;
const state = CM.normalize(data);

const ws = CM.weekStart(CM.todayKey());
console.log('周起算日：', ws, '\n');

for (let i = 0; i < 7; i++) {
  const dk = CM.addDays(ws, i);
  const items = CM.nativeItems(state, dk);
  let min = 0;
  console.log('=== ' + CM.WD_NAME[CM.weekday(dk)] + ' ' + dk + ' · ' + items.length + ' 项 ===');
  items.sort((a, b) => (a.start || '99') < (b.start || '99') ? -1 : 1);
  items.forEach((it) => {
    min += it.minutes;
    console.log('  ' + (it.start ? it.start + '-' + it.end : '  --  ') + '  [' + it.sectionLabel + ']  ' + it.text);
  });
  console.log('  合计 ' + min + ' 分钟 (' + CM.humanMin(min) + ')\n');
}

/* 第二天检查：清单是否推进（不是重复同一天） */
const d1 = CM.addDays(ws, 0);
const d8 = CM.addDays(ws, 7);
console.log('--- 跨周推进检查 ---');
console.log('周一(本)：', CM.nativeItems(state, d1).filter(i => i.templateId === 'tpl_en_read').map(i => i.text).join(' | '));
console.log('周一(下)：', CM.nativeItems(state, d8).filter(i => i.templateId === 'tpl_en_read').map(i => i.text).join(' | '));

/* 清单覆盖 */
console.log('\n--- 清单覆盖周数 ---');
state.lists.forEach((l) => {
  const c = CM.coverageWeeks(state, l.id);
  if (c) console.log('  ' + l.name + '：' + c.total + ' 项 · 每周消耗 ' + c.perWeek + ' · 约 ' + c.weeks + ' 周（至 ' + c.exhaustedAt + '）');
  else console.log('  ' + l.name + '：未引用');
});
