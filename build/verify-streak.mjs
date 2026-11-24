/* 校验 templateStreak 与「清单续航」修复 */
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

const state = CM.normalize(JSON.parse(fs.readFileSync(path.join(APP, '..', '宝宝启蒙计划.json'), 'utf8')).data);
const today = CM.todayKey();
// 测试需要回看更早的日子，把起算日往前挪，否则 anchor 之前不产生排期
state.settings.weekAnchor = CM.weekStart(CM.addDays(today, -35));

function markAllDone(dk, tplId) {
  const ov = state.days[dk] || (state.days[dk] = { done: {}, extra: [] });
  ov.done = ov.done || {};
  CM.nativeItems(state, dk)
    .filter((it) => it.templateId === tplId)
    .forEach((it) => { ov.done[dk + '|' + it.key] = 1; });
}

console.log('今天：', today, CM.WD_NAME[CM.weekday(today)]);

/* 中文绘本每天，往前连做 3 天 */
['-1', '-2', '-3'].forEach((n) => markAllDone(CM.addDays(today, Number(n)), 'tpl_cn_read'));
console.log('中文绘本连续打卡 →', CM.templateStreak(state, 'tpl_cn_read'), '（期望 3）');

/* 思维机只在一三五：把最近 3 个应用日做完 */
['-1', '-2', '-3', '-4', '-5', '-6', '-7'].forEach((n) => markAllDone(CM.addDays(today, Number(n)), 'tpl_card'));
console.log('思维机连续打卡 →', CM.templateStreak(state, 'tpl_card'), '（期望 3，只有一三五算）');

/* 今天还没做，不应中断 */
console.log('周日复盘（从未做过）→', CM.templateStreak(state, 'tpl_sun_review'), '（期望 0）');

/* 清单续航：大猫每天 2 本 ×5 天 = 10 项/周，60 项应约 6 周 */
const c = CM.coverageWeeks(state, 'lst_bigcat');
console.log('大猫续航 →', c.perWeek, '项/周 ·', c.weeks, '周（期望 10 / 6）');
