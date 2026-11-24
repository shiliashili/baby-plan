/* 无头渲染校验：用 jsdom 把真实页面跑起来，检查各视图不报错、结构正确 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire('C:/Users/shilia/.workbuddy/binaries/node/workspace/');
const { JSDOM } = require('jsdom');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');

const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'http://127.0.0.1:8899/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

// 注入 baby plan 数据（模拟"用户已导入"）
const payload = JSON.parse(fs.readFileSync(path.join(APP, '..', '宝宝启蒙计划.json'), 'utf8'));
window.localStorage.setItem('chengming.plan.v1', JSON.stringify(payload.data));
window.localStorage.setItem('chengming.plan.v1.seeded', '1');

const errs = [];
window.addEventListener('error', (e) => errs.push('window.onerror: ' + e.message));

for (const f of ['js/quotes.js', 'js/core.js', 'js/baby-plan.js', 'js/ui.js']) {
  try {
    window.eval(fs.readFileSync(path.join(APP, f), 'utf8'));
  } catch (e) {
    errs.push('加载 ' + f + ' 失败: ' + e.message);
  }
}

const app = window.document.getElementById('app');
function click(sel) {
  const el = window.document.querySelector(sel);
  if (!el) { errs.push('找不到元素: ' + sel); return false; }
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}

console.log('--- 今日 ---');
console.log(app.textContent.replace(/\s+/g, ' ').slice(0, 260));
console.log('任务卡数量：', app.querySelectorAll('.task').length);

console.log('\n--- 切到周表 ---');
click('[data-act="tab"][data-tab="week"]');
const wkCards = app.querySelectorAll('.wk-card');
console.log('日卡数量：', wkCards.length);
console.log('行数量：', app.querySelectorAll('.wk-item').length);
console.log('汇总：', app.querySelector('.wk-sum') ? app.querySelector('.wk-sum').textContent.replace(/\s+/g, ' ') : '缺失');
[...wkCards].slice(0, 2).forEach((c) => {
  console.log('  ' + c.querySelector('.wk-head').textContent.replace(/\s+/g, ' '));
  [...c.querySelectorAll('.wk-item')].forEach((r) => {
    console.log('    ' + r.querySelector('.wk-time').textContent + '  ' + r.querySelector('.wk-text').textContent.slice(0, 46));
  });
});

console.log('\n--- 周表打卡一次 ---');
const firstRow = app.querySelector('.wk-item');
const before = firstRow.className;
firstRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const after = app.querySelector('.wk-item').className;
console.log('点前:', before, '→ 点后:', after);
const saved = JSON.parse(window.localStorage.getItem('chengming.plan.v1'));
console.log('已写入完成记录天数：', Object.keys(saved.days).length);

console.log('\n--- 其余视图 ---');
['plan', 'lists', 'review', 'settings'].forEach((t) => {
  click('[data-act="tab"][data-tab="' + t + '"]');
  const txt = app.textContent.replace(/\s+/g, ' ').trim();
  console.log('  ' + t + ' → ' + txt.length + ' 字' + (txt.length < 40 ? '  ⚠ 内容异常' : ''));
});

console.log('\n--- 回望页连续打卡徽标 ---');
click('[data-act="tab"][data-tab="review"]');
console.log('  徽标数量：', app.querySelectorAll('.iv-streak').length);

console.log('\n--- 设置页按钮 ---');
click('[data-act="tab"][data-tab="settings"]');
console.log('  有载入按钮：', !!window.document.querySelector('[data-act="load-baby"]'));

/* 走一遍「一键载入」的真实路径：confirm 需放行 */
console.log('\n--- 一键载入宝宝计划 ---');
window.localStorage.clear();
window.confirm = () => true;
window.alert = (m) => errs.push('alert: ' + m);
click('[data-act="load-baby"]');
const txt2 = app.textContent.replace(/\s+/g, ' ');
console.log('  回到今日：', /今日计划/.test(txt2));
console.log('  任务卡：', app.querySelectorAll('.task').length, '（期望 6）');
console.log('  首条含时间：', /17:30/.test(txt2));
const st2 = JSON.parse(window.localStorage.getItem('chengming.plan.v1'));
console.log('  已落盘模板：', st2.templates.length, '清单：', st2.lists.length);

console.log('\n=== 错误 ===');
console.log(errs.length ? errs.join('\n') : '无');
