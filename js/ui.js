/* ============================================================
 * 柚柚今天学什么
 * ui.js —— 视图层与交互（无框架，原生 DOM）
 * ============================================================ */
(function () {
  'use strict';

  const CM = window.CM;
  const KEY = 'chengming.plan.v1';
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  const ICON = {
    today: '<path d="M4 6.5h16M8 3.5v3M16 3.5v3M4.5 6.5h15a1 1 0 011 1v12a1 1 0 01-1 1h-15a1 1 0 01-1-1v-12a1 1 0 011-1z"/><path d="M8 12h2M14 12h2M8 16h2M14 16h2"/>',
    calendar: '<path d="M4 6.5h16M8 3.5v3M16 3.5v3M4.5 6.5h15a1 1 0 011 1v12a1 1 0 01-1 1h-15a1 1 0 01-1-1v-12a1 1 0 011-1z"/><path d="M8 12h2M14 12h2M8 16h2M14 16h2"/>',
    plan: '<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18.5" cy="6" r="1.6"/><circle cx="14" cy="18" r="1.6"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h8"/><path d="M3.5 5.5l1 1 2-2M3.5 11.5l1 1 2-2M3.5 17.5l1 1 2-2"/>',
    review: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    more: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/>',
    upload: '<path d="M12 16V4m0 0L8 8m4-4l4 4M4 19h16"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
    back: '<path d="M11 5L4 12l7 7M4 12h16"/>',
    chev: '<path d="M7 14l5-5 5 5"/>',
    back2: '<path d="M4 12h16M11 5l-7 7 7 7"/>'
  };

  function icon(name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || '') + '</svg>';
  }

  /* ---------------- 存储 ---------------- */

  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return CM.normalize(CM.defaultState());
      const obj = JSON.parse(raw);
      return CM.normalize(obj);
    } catch (e) {
      console.warn('数据读取失败，已回退到空白状态', e);
      return CM.normalize(CM.defaultState());
    }
  }

  let saveTimer = null;
  function save(immediate) {
    const write = function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        toast('存储空间不足，请先导出备份');
      }
    };
    if (immediate) { clearTimeout(saveTimer); write(); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(write, 220);
  }

  /* ---------------- 视图状态 ---------------- */

  const view = {
    tab: 'today',
    date: CM.todayKey(),
    planExpanded: null
  };

  /* ---------------- 工具 ---------------- */

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 1900);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pctText(v) { return Math.round(v * 100); }

  function ensureDay(key) {
    if (!state.days[key]) state.days[key] = { done: {}, extra: [] };
    const d = state.days[key];
    if (!d.done) d.done = {};
    if (!d.extra) d.extra = [];
    return d;
  }

  /** 清理过旧覆盖数据，控制 localStorage 体积 */
  function prune() {
    const keep = state.settings.keepHistory || 120;
    const limit = CM.addDays(CM.todayKey(), -keep);
    Object.keys(state.days).forEach(function (k) {
      if (k < limit) {
        const ov = state.days[k];
        const empty = (!ov.done || !Object.keys(ov.done).length) && (!ov.extra || !ov.extra.length) && !ov.note;
        if (empty) delete state.days[k];
      }
    });
    Object.keys(state.reviews || {}).forEach(function (k) {
      if (k < limit) delete state.reviews[k];
    });
  }

  /* ---------------- 顶部 ---------------- */

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return '深夜了';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '午间好';
    if (h < 18) return '下午好';
    if (h < 23) return '晚上好';
    return '夜深了';
  }

  function topbar() {
    const today = CM.todayKey();
    const isToday = view.date === today;
    const wk = CM.isoWeekNo(view.date);
    let title, sub, badge = '';
    if (view.tab === 'today') {
      title = isToday ? greeting() : CM.mdText(view.date);
      sub = CM.fullText(view.date) + ' · ' + CM.WD_NAME[CM.weekday(view.date)] + ' · 第' + wk + '周';
      if (!isToday) badge = '<span class="tag shu">非今天</span>';
    } else if (view.tab === 'plan') {
      title = '计划编排';
      sub = '模板 · 清单 · 排期';
    } else if (view.tab === 'week') {
      const ws = CM.weekStart(view.date);
      title = CM.mdText(ws) + ' – ' + CM.mdText(CM.addDays(ws, 6));
      sub = '第' + CM.isoWeekNo(ws) + '周 · 一周时间表';
      if (CM.weekStart(CM.todayKey()) !== ws) badge = '<span class="tag shu">非本周</span>';
    } else if (view.tab === 'lists') {
      title = '内容清单';
      sub = '逐项延续，用完即止';
    } else if (view.tab === 'review') {
      title = '回望';
      sub = '完成度 · 节奏 · 复盘';
    } else {
      title = '设置';
      sub = '数据与偏好';
    }

    // 右上角：今日页「月历」，其它页「回今天」；有偏离今天的日期时补一枚「回今天」
    let acts = '';
    if (view.tab === 'today') {
      acts += '<button class="icon-btn" data-act="cal-open" aria-label="打开月历" title="月历">' + icon('calendar') + '</button>';
      if (!isToday) acts += '<button class="icon-btn" data-act="goto-today" aria-label="回到今天" title="回到今天">' + icon('back2') + '</button>';
    } else {
      acts += '<button class="icon-btn" data-act="goto-today" aria-label="回到今天" title="回到今天">' + icon('back2') + '</button>';
    }

    return '' +
      '<div class="topbar">' +
        '<div class="topbar-row">' +
          '<div class="greet"><small>' + esc(sub) + '</small>' + esc(title) + badge + '</div>' +
          (acts ? '<div class="topbar-actions">' + acts + '</div>' : '') +
        '</div>' +
      '</div>';
  }

  function tabbar() {
    const tabs = [
      { id: 'today', label: '今日', ic: 'today' },
      { id: 'week', label: '周表', ic: 'calendar' },
      { id: 'plan', label: '计划', ic: 'plan' },
      { id: 'lists', label: '清单', ic: 'list' },
      { id: 'review', label: '回望', ic: 'review' },
      { id: 'settings', label: '设置', ic: 'gear' }
    ];
    return '<nav class="tabbar"><div class="tabbar-inner">' + tabs.map(function (t) {
      return '<button class="tab' + (view.tab === t.id ? ' on' : '') + '" data-act="tab" data-tab="' + t.id + '">' +
        (view.tab === t.id ? '<i class="tab-dot"></i>' : '') + icon(t.ic) + '<span>' + t.label + '</span></button>';
    }).join('') + '</div></nav>';
  }

  /* ---------------- 今日视图 ---------------- */

  function weekStrip() {
    const days = CM.weekDays(view.date);
    const today = CM.todayKey();
    return '<div class="wrap"><div class="weekstrip">' + days.map(function (d) {
      const st = CM.dayStats(state, d);
      const ov = state.days[d] || {};
      let dot = '';
      if (d === today && st.open > 0 && st.done === 0) dot = '<i class="dot warn"></i>';
      else if (st.total && st.done === st.total) dot = '<i class="dot solid"></i>';
      else if (st.done > 0) dot = '<i class="dot"></i>';
      else dot = '<i class="dot"></i>';
      const cls = ['day-cell'];
      if (d === today) cls.push('today');
      if (d === view.date) cls.push('sel');
      if (d < today) cls.push('past');
      return '<button class="' + cls.join(' ') + '" data-act="pick-day" data-date="' + d + '">' +
        '<span class="dw">' + CM.WD_SHORT[CM.weekday(d)] + '</span>' +
        '<span class="dn">' + CM.fromKey(d).getDate() + '</span>' +
        dot +
      '</button>';
    }).join('') + '</div></div>';
  }

  /** 月历：整月网格 + 每月完成度，点任意一天跳到那天 */
  let calMonth = null; // 'YYYY-MM'，null 表示跟随当前查看的日期

  function monthKeyOf(dayKey) { return String(dayKey).slice(0, 7); }

  function shiftMonth(ym, delta) {
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(5, 7)) - 1 + delta;
    const d = new Date(y, m, 1);
    return d.getFullYear() + '-' + CM.pad(d.getMonth() + 1);
  }

  function calendar() {
    const today = CM.todayKey();
    const ym = calMonth || monthKeyOf(view.date);
    const y = Number(ym.slice(0, 4));
    const m = Number(ym.slice(5, 7)) - 1;
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    // 周一为第一列：JS 的 getDay() 里周日是 0
    const lead = (first.getDay() + 6) % 7;

    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<div class="cal-cell blank"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = y + '-' + CM.pad(m + 1) + '-' + CM.pad(d);
      const st = CM.dayStats(state, dk);
      const ov = state.days[dk] || {};
      const cls = ['cal-cell'];
      if (dk === today) cls.push('today');
      if (dk === view.date) cls.push('sel');
      if (dk < today) cls.push('past');
      if (ov.skip) cls.push('rest');
      // 完成度指示
      //   已过去：全完成=实心，做了一部分=空心，一件没做=浅灰点
      //   今天：全完成=实心，做了一部分=空心，还没开始=浅灰点（提醒今天有安排）
      //   未来：有安排就给一个极浅的点，表示"这天有排期"，不暗示完成与否
      let dot = '';
      if (st.total && st.done === st.total) dot = '<i class="cdot full"></i>';
      else if (st.done > 0) dot = '<i class="cdot part"></i>';
      else if (st.total) dot = '<i class="cdot ' + (dk > today ? 'plan' : 'miss') + '"></i>';
      cells += '<button class="' + cls.join(' ') + '" data-act="cal-pick" data-date="' + dk + '">' +
        '<span class="cn">' + d + '</span>' + dot + '</button>';
    }

    // 本月汇总
    const monthStart = y + '-' + CM.pad(m + 1) + '-01';
    const lastDay = y + '-' + CM.pad(m + 1) + '-' + CM.pad(daysInMonth);
    const upTo = lastDay > today ? today : lastDay;
    let mTotal = 0, mDone = 0;
    if (upTo >= monthStart) {
      let k = monthStart;
      let guard = 0;
      while (k <= upTo && guard++ < 40) {
        const st = CM.dayStats(state, k);
        mTotal += st.total;
        mDone += st.done;
        k = CM.addDays(k, 1);
      }
    }
    const mMin = upTo >= monthStart ? CM.minutesBetween(state, monthStart, upTo) : 0;

    const head = '<div class="cal-head">' +
      '<button class="icon-btn" data-act="cal-prev" aria-label="上个月">' + icon('left') + '</button>' +
      '<div class="cal-ym">' + y + ' 年 ' + (m + 1) + ' 月</div>' +
      '<button class="icon-btn" data-act="cal-next" aria-label="下个月">' + icon('right') + '</button>' +
    '</div>';

    const week = ['一', '二', '三', '四', '五', '六', '日'].map(function (w) {
      return '<span class="cal-w">' + w + '</span>';
    }).join('');

    const foot = '<div class="cal-foot">' +
      '<div class="cal-stat"><b>' + mDone + '</b><span>/ ' + mTotal + ' 项完成</span></div>' +
      '<div class="cal-stat"><b>' + (mMin ? Math.round(mMin / 60) : 0) + '</b><span>小时投入</span></div>' +
      '<div class="cal-stat"><b>' + (mTotal ? Math.round((mDone / mTotal) * 100) : 0) + '</b><span>% 完成率</span></div>' +
    '</div>';

    openSheet('月历', head +
      '<div class="cal-grid">' + week + cells + '</div>' +
      foot +
      '<div class="btn-row" style="margin-top:14px">' +
        '<button class="btn sm" data-act="cal-today">回到今天</button>' +
        '<button class="btn sm" data-act="cal-close">取消</button>' +
      '</div>' +
      '<div class="hint" style="margin-top:10px;font-size:11.5px;color:var(--ink-4);line-height:1.7">' +
        '实心点＝当天全部完成，空心点＝完成了一部分，浅点＝有安排但没完成。点任意一天可直接跳到那天查看。' +
      '</div>');
  }

  function progressRing(rate, label) {
    const r = 26, c = 2 * Math.PI * r;
    const off = c * (1 - rate);
    return '<div class="ring">' +
      '<svg width="62" height="62" viewBox="0 0 62 62">' +
        '<circle class="bg" cx="31" cy="31" r="' + r + '" fill="none" stroke-width="4"/>' +
        '<circle class="fg" cx="31" cy="31" r="' + r + '" fill="none" stroke-width="4" ' +
          'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg>' +
      '<span class="num">' + label + '</span>' +
    '</div>';
  }

  /**
   * 是否"已经到点了但还没做"——只对今天有意义。
   * 超过 2 小时的不再标红：那时已经算"漏了"，标红只会让整页都是红的，失去提示意义。
   */
  function isOverdue(it, dayKey) {
    if (!it || !it.start || dayKey !== CM.todayKey()) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = CM.toMin(it.start);
    if (start == null) return false;
    const gap = cur - start;
    return gap >= 0 && gap <= 120;
  }

  function slotBadge(it, dayKey, done) {
    if (!it.start) return '';
    const late = !done && isOverdue(it, dayKey);
    const label = it.end ? it.start + '–' + it.end : it.start;
    return '<span class="slot' + (late ? ' late' : '') + '">' + esc(label) + '</span>';
  }

  /**
   * opts.noSectionTag：分组标题已经写了分组名，卡片里就不再重复一遍。
   * 只有顺延项（挤在"顺延事项"里）才需要用它自己的分组名做标记。
   */
  function renderTask(it, dayKey, idx, opts) {
    const noTag = !!(opts && opts.noSectionTag);
    const done = CM.isDoneBy(state, dayKey, it);
    const uidKey = it.uidKey || it.key;
    const tags = [];
    if (it.carried) tags.push('<span class="tag' + (it.carryDays >= 2 ? ' shu' : '') + '">' + (it.carryDays <= 1 ? '昨日' : '顺延 ' + it.carryDays + ' 天') + '</span>');
    if (it.extra) tags.push('<span class="tag hu">临时</span>');
    if (!it.extra && it.sectionLabel && (it.carried || !noTag)) tags.push('<span class="tag qing">' + esc(it.sectionLabel) + '</span>');
    return '<div class="task' + (done ? ' done' : '') + '" data-key="' + esc(uidKey) + '" data-idx="' + idx + '">' +
      '<button class="check" data-act="toggle" data-key="' + esc(uidKey) + '" aria-label="完成">' +
        '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>' +
      '</button>' +
      '<div class="task-body" data-act="task-menu" data-key="' + esc(uidKey) + '">' +
        '<div class="task-line">' + slotBadge(it, dayKey, done) + '<span class="task-text">' + esc(it.text) + '</span></div>' +
        (tags.length ? '<div class="task-tags">' + tags.join('') + '</div>' : '') +
      '</div>' +
      '<button class="task-more" data-act="task-menu" data-key="' + esc(uidKey) + '">' + icon('more') + '</button>' +
    '</div>';
  }

  /** 有时间的排前面（按开始时间），没时间的保持原顺序在后 */
  function sortByTime(items) {
    return items.slice().sort(function (a, b) {
      const ta = a.start ? CM.toMin(a.start) : null;
      const tb = b.start ? CM.toMin(b.start) : null;
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    });
  }

  function groupedTasks(items, dayKey) {
    const carried = sortByTime(items.filter(function (i) { return i.carried; }));
    const extra = sortByTime(items.filter(function (i) { return !i.carried && i.extra; }));
    const native = sortByTime(items.filter(function (i) { return !i.carried && !i.extra; }));

    // 原生项按 section 分组
    const groups = [];
    const map = {};
    native.forEach(function (it) {
      const k = it.sectionId || '_';
      if (!map[k]) { map[k] = { label: it.sectionLabel || '计划', items: [] }; groups.push(map[k]); }
      map[k].items.push(it);
    });

    let html = '';
    if (carried.length) {
      html += '<div class="group"><div class="group-head">顺延事项 <span class="cnt">' + carried.length + '</span><i class="rule"></i></div>' +
        '<div class="group-box">' + carried.map(function (it) { return renderTask(it, dayKey); }).join('') + '</div></div>';
    }
    groups.forEach(function (g) {
      const cnt = g.items.length > 1 ? ' <span class="cnt">' + g.items.length + '</span>' : '';
      html += '<div class="group"><div class="group-head">' + esc(g.label) + cnt + '<i class="rule"></i></div>' +
        '<div class="group-box">' + g.items.map(function (it) { return renderTask(it, dayKey, undefined, { noSectionTag: true }); }).join('') + '</div></div>';
    });
    if (extra.length) {
      html += '<div class="group"><div class="group-head">临时添加 <span class="cnt">' + extra.length + '</span><i class="rule"></i></div>' +
        '<div class="group-box">' + extra.map(function (it) { return renderTask(it, dayKey); }).join('') + '</div></div>';
    }
    return html;
  }

  function viewToday() {
    const dayKey = view.date;
    const day = CM.resolveDay(state, dayKey);
    const st = CM.dayStats(state, dayKey);
    const ov = state.days[dayKey] || {};
    const today = CM.todayKey();
    const isToday = dayKey === today;
    const isPast = dayKey < today;
    const carry = CM.carryIns(state, dayKey);
    const streakN = CM.streak(state);

    let sub;
    if (st.total === 0) sub = '今天没有固定计划，留白也是一种安排';
    else if (st.open === 0) sub = '全部完成，收工';
    else sub = '还有 <b>' + st.open + '</b> 项未完成';
    const dayMin = CM.dayMinutes(state, dayKey);
    if (dayMin) sub += ' · 约 ' + CM.humanMin(dayMin);
    if (carry.length && isToday) sub += ' · 含顺延 ' + carry.length + ' 项';

    let html = topbar() + weekStrip();
    html += '<div class="wrap">';

    // 每日金句
    if (state.settings.showQuote !== false) {
      const q = CM.quoteOfDay(state, dayKey);
      if (q) {
        html += '<div class="quote" data-act="quote-menu">' +
          '<span class="qmark">“</span>' +
          '<span class="qtext">' + esc(q.text) + '</span>' +
          '<span class="qmark end">”</span>' +
        '</div>';
      }
    }

    // 休息日
    if (ov.skip) {
      html += '<div class="card progress-card" style="margin-top:16px">' +
        '<div class="progress-meta"><div class="big">今日休息</div>' +
        '<div class="sub">已标记为休息日，计划自动顺延到下一个工作日</div></div>' +
        '<button class="btn sm" data-act="unskip">恢复</button></div>';
      return html + '</div>' + tabbar();
    }

    html += '<div class="card progress-card" style="margin-top:16px">' +
      progressRing(st.rate, pctText(st.rate) + '%') +
      '<div class="progress-meta">' +
        '<div class="big">' + st.done + ' / ' + st.total + ' 项</div>' +
        '<div class="sub">' + sub + (streakN > 1 ? ' · 连续 ' + streakN + ' 天' : '') + '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="section-title"><h2>' + (isToday ? '今日计划' : (isPast ? '当日计划' : '计划预览')) + '</h2>' +
      '<span class="aside">第' + CM.isoWeekNo(dayKey) + '周 · ' + (CM.cycleIndex(dayKey, state.settings.weekAnchor) + 1) + '/' + cycleSpan() + '</span></div>';

    if (!day.items.length) {
      html += '<div class="empty"><span class="mark">空</span>这一天还没有安排<br>可以在「计划」里新建模板，或直接添加临时事项</div>';
    } else {
      html += groupedTasks(day.items, dayKey);
    }

    html += '<button class="quick-add" data-act="add-extra"><span style="font-size:16px;line-height:1">＋</span> 添加临时事项</button>';

    // 备注
    html += '<div class="section-title"><h2>当日备注</h2></div>';
    html += '<textarea data-input="note" rows="2" placeholder="随手记点什么…" style="font-size:13.5px">' + esc(day.note) + '</textarea>';

    // 快捷操作
    html += '<div class="btn-row">' +
      '<button class="btn sm" data-act="skip-day">标记休息</button>' +
      '<button class="btn sm" data-act="carry-preview">顺延清单' + (carry.length ? '（' + carry.length + '）' : '') + '</button>' +
      '<button class="btn sm" data-act="day-menu">更多</button>' +
    '</div>';

    html += '</div>';
    return html + tabbar();
  }

  function cycleSpan() {
    // 模板最长能排多少周（以清单覆盖为准），无清单时显示 ∞
    let max = 0;
    state.lists.forEach(function (l) {
      const c = CM.coverageWeeks(state, l.id);
      if (c && c.weeks && c.weeks > max) max = c.weeks;
    });
    return max ? max + '周' : '∞';
  }

  /* ---------------- 周表视图 ---------------- */

  /** 按开始时间排序；没时间的排最后 */
  function byStart(a, b) {
    const ta = a.start ? CM.toMin(a.start) : 1e9;
    const tb = b.start ? CM.toMin(b.start) : 1e9;
    return ta - tb;
  }

  function viewWeek() {
    const ws = CM.weekStart(view.date);
    const today = CM.todayKey();
    const isThisWeek = ws === CM.weekStart(today);

    const days = [];
    let sumMin = 0, sumItems = 0, sumDone = 0;
    for (let i = 0; i < 7; i++) {
      const dk = CM.addDays(ws, i);
      const d = CM.resolveDay(state, dk, { carry: false });   // 周表只看排期骨架，不掺顺延
      const items = d.items.slice().sort(byStart);
      const min = items.reduce(function (a, it) { return a + (Number(it.minutes) || 0); }, 0);
      const done = items.filter(function (it) { return CM.isDoneBy(state, dk, it); }).length;
      const rest = !!(state.days[dk] && state.days[dk].skip);
      if (!rest) { sumMin += min; sumItems += items.length; sumDone += done; }   // 休息日不计入
      days.push({ dk: dk, items: items, min: min, done: done, rest: rest });
    }

    let html = topbar() + '<div class="wrap">';

    // 翻周 + 汇总
    html += '<div class="wk-nav">' +
      '<button class="icon-btn" data-act="week-prev" aria-label="上一周">' + icon('left') + '</button>' +
      '<div class="wk-nav-mid">' + (isThisWeek ? '本周' : '第 ' + CM.isoWeekNo(ws) + ' 周') + '</div>' +
      '<button class="icon-btn" data-act="week-next" aria-label="下一周">' + icon('right') + '</button>' +
    '</div>';
    if (!isThisWeek) {
      html += '<div class="btn-row" style="margin:-6px 0 12px"><button class="btn sm" data-act="week-today">回到本周</button></div>';
    }

    html += '<div class="wk-sum">' +
      '<div class="wk-sum-item"><b>' + (Math.round(sumMin / 6) / 10) + '</b><span>小时／周</span></div>' +
      '<div class="wk-sum-item"><b>' + sumItems + '</b><span>项</span></div>' +
      '<div class="wk-sum-item"><b>' + (sumItems ? Math.round(sumDone / sumItems * 100) : 0) + '</b><span>% 已完成</span></div>' +
    '</div>';

    days.forEach(function (d) {
      const isToday = d.dk === today;
      const isPast = d.dk < today;
      const isRest = !!d.rest;
      const ratio = isRest
        ? '<span class="wk-ratio rest">休息</span>'
        : '<span class="wk-ratio' + (d.items.length && d.done === d.items.length ? ' all' : '') + '">' +
            d.done + '/' + d.items.length + '</span>';
      html += '<div class="wk-card' + (isToday ? ' now' : '') + (isRest ? ' rest' : '') + '">' +
        '<button class="wk-head" data-act="week-open" data-date="' + d.dk + '">' +
          '<span class="wk-day">' + CM.WD_NAME[CM.weekday(d.dk)] + '</span>' +
          '<span class="wk-date">' + (CM.fromKey(d.dk).getMonth() + 1) + '/' + CM.fromKey(d.dk).getDate() + '</span>' +
          (d.min ? '<span class="wk-min">' + CM.humanMin(d.min) + '</span>' : '') +
          ratio +
        '</button>';

      if (!d.items.length) {
        html += '<div class="wk-empty">' + (isPast ? '这天没有排期' : '这天还没有安排') + '</div>';
      } else {
        html += '<div class="wk-list">' + d.items.map(function (it) {
          const key = it.uidKey || it.key;
          const done = CM.isDoneBy(state, d.dk, it);
          return '<button class="wk-item' + (done ? ' done' : '') + '" data-act="wk-toggle" data-date="' + d.dk + '" data-key="' + esc(key) + '">' +
            '<i class="wk-box"></i>' +
            '<span class="wk-time">' + (it.start ? it.start : '—') + '</span>' +
            '<span class="wk-text">' + esc(it.text) + '</span>' +
          '</button>';
        }).join('') + '</div>';
      }
      html += '</div>';
    });

    html += '<div class="hint" style="font-size:11.5px;color:var(--ink-4);line-height:1.75;margin-top:14px">' +
      '周表只显示模板排出来的骨架，顺延事项只在「今日」里出现。点任意一行可直接打卡，点日期抬头进入当天详情。' +
    '</div>';

    html += '</div>';
    return html + tabbar();
  }

  /* ---------------- 计划视图 ---------------- */

  function viewPlan() {
    let html = topbar() + '<div class="wrap">';

    html += '<div class="section-title"><h2>周期模板</h2><span class="aside">条目按周重复</span></div>';
    if (!state.templates.length) {
      html += '<div class="empty"><span class="mark">无</span>还没有任何模板</div>';
    }
    state.templates.forEach(function (tpl, ti) {
      const basisText = tpl.basis === 'week' ? '按周推进' : '按工作日推进';
      const dayText = tpl.kind === 'daily'
        ? '每日' + (tpl.skipWeekdays && tpl.skipWeekdays.length ? '（跳过' + tpl.skipWeekdays.map(function (w) { return CM.WD_SHORT[w]; }).join('、') + '）' : '')
        : tpl.weekdays.map(function (w) { return CM.WD_SHORT[w]; }).sort().length + ' 天／周：' + tpl.weekdays.slice().sort(function (a, b) { return ((a + 6) % 7) - ((b + 6) % 7); }).map(function (w) { return CM.WD_NAME[w]; }).join('、');
      html += '<div class="card tpl-card">' +
        '<div class="tpl-top">' +
          '<span class="tpl-accent ' + (tpl.color || '') + '"></span>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="tpl-name">' + esc(tpl.name) + (tpl.enabled ? '' : ' <span class="tag">已停用</span>') + '</div>' +
            '<div class="tpl-desc">' + esc(dayText) + ' · ' + basisText + '</div>' +
          '</div>' +
          '<button class="task-more" data-act="tpl-menu" data-tpl="' + tpl.id + '">' + icon('more') + '</button>' +
        '</div>';
      if (state.planExpanded === tpl.id) {
        html += '<div class="tpl-secs">';
        tpl.sections.forEach(function (sec) {
          const srcText = secSrcText(sec);
          const slotTxt = (sec.slots || []).map(function (v) { return v ? CM.slotText(v) : ''; })
            .filter(Boolean).join(' / ');
          html += '<div class="sec-row"><span class="lbl">' + esc(sec.label) + '</span>' +
            '<span class="src">' + sec.count + ' 条 × ' + (sec.perSlot || 1) + ' 项 · ' + srcText +
            (slotTxt ? ' · <i class="sec-slot">' + esc(slotTxt) + '</i>' : '') + '</span></div>';
        });
        html += '<div class="chip-row" style="margin-top:4px">' +
          '<button class="chip" data-act="tpl-edit" data-tpl="' + tpl.id + '">编辑模板</button>' +
          '<button class="chip" data-act="tpl-sec-add" data-tpl="' + tpl.id + '">＋ 增加分组</button>' +
          '<button class="chip" data-act="tpl-use-sample" data-tpl="' + tpl.id + '">套用示例</button>' +
          '</div>';
        html += '</div>';
      }
      html += '</div>';
    });

    html += '<button class="quick-add" data-act="tpl-new"><span style="font-size:16px">＋</span> 新建周期模板</button>';

    html += '<div class="section-title"><h2>本周安排</h2><span class="aside">按时间点查看</span></div>';
    html += renderSchedulePreview();

    html += '</div>';
    return html + tabbar();
  }

  function secSrcText(sec) {
    const s = sec.source || {};
    if (s.type === 'fixed') {
      const n = CM.parseList(s.text).length;
      return (s.mode === 'random' ? '固定内容轮换' : '固定 ' + n + ' 条');
    }
    const list = CM.listOf(state, s.listId);
    if (!list) return '未选清单';
    return (s.mode === 'random' ? '随机取' : '延续') + '《' + list.name + '》' + list.items.length + '项';
  }

  /** 计划页底部：导流到周表（原先的纯文字预览已由周表取代） */
  function renderSchedulePreview() {
    const start = CM.weekStart(view.date);
    let min = 0, cnt = 0;
    for (let i = 0; i < 7; i++) {
      const items = CM.nativeItems(state, CM.addDays(start, i));
      cnt += items.length;
      min += items.reduce(function (a, it) { return a + (Number(it.minutes) || 0); }, 0);
    }
    return '<button class="card wk-entry" data-act="goto-week">' +
      '<div class="wk-entry-main">' +
        '<div class="wk-entry-t">本周时间表</div>' +
        '<div class="wk-entry-s">' + (cnt ? (Math.round(min / 6) / 10) + ' 小时 · ' + cnt + ' 项，精确到每个时间点' : '本周还没有排期') + '</div>' +
      '</div>' +
      '<span class="wk-entry-go">' + icon('right') + '</span>' +
    '</button>';
  }

  /* ---------------- 清单视图 ---------------- */

  function viewLists() {
    let html = topbar() + '<div class="wrap">';
    html += '<div class="section-title"><h2>内容清单</h2><span class="aside">' + state.lists.length + ' 个</span></div>';

    if (!state.lists.length) {
      html += '<div class="empty"><span class="mark">清</span>还没有清单<br>把团队学习 100 项、检查项点贴进来，<br>系统会按周期自动切片排进每一天</div>';
    }

    state.lists.forEach(function (l) {
      const cov = CM.coverageWeeks(state, l.id);
      const used = cov ? Math.min(l.items.length, CM.consumedAt(state, CM.todayKey(), l.id)) : 0;
      const pct = l.items.length ? used / l.items.length : 0;
      html += '<div class="card list-card" data-act="list-open" data-list="' + l.id + '">' +
        '<div class="meta">' +
          '<div class="nm">' + esc(l.name) + '</div>' +
          '<div class="st">' + l.items.length + ' 项 · 已排 ' + used + ' 项' +
            (cov && cov.exhaustedAt ? ' · 约至 ' + CM.smartDate(cov.exhaustedAt) + '（' + (cov.weeks || 0) + ' 周）' : '') +
            (cov ? ' · 每周消耗 ' + cov.perWeek + ' 项' : '') +
          '</div>' +
          '<div class="bar"><i style="width:' + pctText(pct) + '%"></i></div>' +
        '</div>' +
        '<span style="color:var(--ink-4);font-size:18px">›</span>' +
      '</div>';
    });

    html += '<button class="quick-add" data-act="list-new"><span style="font-size:16px">＋</span> 新建清单（可批量粘贴）</button>';

    html += '<div class="section-title"><h2>使用提示</h2></div>' +
      '<div class="card" style="padding:14px 15px;font-size:12.5px;line-height:1.85;color:var(--ink-2)">' +
        '· 清单是<b>有顺序</b>的：一行一项，系统从第 1 项开始逐日依次取用，取完回到开头。<br>' +
        '· 模板里设置「每日几条 × 每条几项」，就决定了清单消耗的速度。<br>' +
        '· 排期基准选<b>按周推进</b>：同一周的几天内容一致、跨周滚动（适合每周一、五团队学习）。<br>' +
        '· 选<b>按工作日推进</b>：每个工作日都往下取，周末不消耗。' +
      '</div>';

    html += '</div>';
    return html + tabbar();
  }

  /* ---------------- 回望视图 ---------------- */

  /** 分钟数 → 带 <small> 的 HTML 片段 */
  function totalMinHTML(min) {
    const n = Math.round(Number(min) || 0);
    if (n <= 0) return '0<small>分钟</small>';
    const h = Math.floor(n / 60), m = n % 60;
    let out = '';
    if (h) out += h + '<small>小时</small>';
    if (m) out += m + '<small>分</small>';
    return out;
  }

  function viewReview() {
    const today = CM.todayKey();
    let html = topbar() + '<div class="wrap">';

    // 近 30 天统计
    let sum = 0, doneSum = 0, days = 0, perfect = 0;
    for (let i = 0; i < 30; i++) {
      const d = CM.addDays(today, -i);
      const st = CM.dayStats(state, d);
      if (!st.total) continue;
      days++;
      sum += st.total;
      doneSum += st.done;
      if (st.rate >= 1) perfect++;
    }
    const rate = sum ? doneSum / sum : 0;

    html += '<div class="stat-grid">' +
      '<div class="stat"><div class="k">近 30 天完成率</div><div class="v">' + pctText(rate) + '<small>%</small></div></div>' +
      '<div class="stat"><div class="k">连续达标</div><div class="v">' + CM.streak(state) + '<small>天</small></div></div>' +
      '<div class="stat"><div class="k">全清日</div><div class="v">' + perfect + '<small>天</small></div></div>' +
      '<div class="stat"><div class="k">累计完成</div><div class="v">' + doneSum + '<small>项</small></div></div>' +
    '</div>';

    // ---- 清单完成进度（如 51/100）----
    const progresses = state.lists.map(function (l) {
      return CM.listProgress(state, l.id, today);
    }).filter(Boolean);

    if (progresses.length) {
      html += '<div class="section-title"><h2>清单完成度</h2><span class="aside">已勾选 / 总条目</span></div>';
      progresses.forEach(function (p) {
        const pct = Math.round(p.rate * 100);
        const left = p.total - p.done;
        html += '<div class="card prog-card" data-act="prog-open" data-list="' + p.listId + '">' +
          '<div class="prog-top">' +
            '<div class="prog-name">' + esc(p.name) + '</div>' +
            '<div class="prog-num"><b>' + p.done + '</b><span>/' + p.total + '</span></div>' +
          '</div>' +
          '<div class="prog-bar"><i style="width:' + pct + '%"></i></div>' +
          '<div class="prog-foot">' +
            '<span>' + pct + '% 完成</span>' +
            '<span>' + (left > 0 ? '还剩 ' + left + ' 项' : '已全部走完一轮') + '</span>' +
          '</div>' +
        '</div>';
      });
    }

    // ---- 各模板累计执行 ----
    const tstats = CM.allTemplateStats(state, state.settings.weekAnchor, today);
    const totalMin = tstats.reduce(function (a, b) { return a + b.minutes; }, 0);
    const totalTimes = tstats.reduce(function (a, b) { return a + b.times; }, 0);

    html += '<div class="section-title"><h2>累计投入</h2><span class="aside">按完成记录统计</span></div>';
    if (!tstats.length) {
      html += '<div class="empty" style="padding:22px">还没有完成记录<br>勾掉第一条计划后，这里就会有数字</div>';
    } else {
      html += '<div class="card" style="padding:14px 15px">' +
        '<div class="invest-hero">' +
          '<div><div class="invest-k">累计完成</div><div class="invest-v">' + totalTimes + '<small>次</small></div></div>' +
          '<div class="invest-split"></div>' +
          '<div><div class="invest-k">累计投入</div><div class="invest-v">' + totalMinHTML(totalMin) + '</div></div>' +
        '</div>' +
        '<div class="invest-list">' +
        tstats.map(function (t) {
          const m = t.minutes;
          const dur = m ? CM.humanMin(m) : '—';
          const stk = CM.templateStreak(state, t.templateId);
          return '<div class="invest-row">' +
            '<span class="iv-name"><i>' + esc(t.name) + '</i>' +
              (stk >= 2 ? '<em class="iv-streak">连 ' + stk + '</em>' : '') + '</span>' +
            '<span class="iv-times">' + t.times + ' 次</span>' +
            '<span class="iv-dur">' + dur + '</span>' +
          '</div>';
        }).join('') +
        '</div>' +
        (totalMin ? '' : '<div class="hint" style="font-size:11.5px;color:var(--ink-4);margin-top:10px;line-height:1.6">' +
          '时长来自分组的时间段。在「计划 → 编辑模板」里给分组填上「10:30-11:30」这样的时段，完成后就会自动累计。' +
        '</div>') +
      '</div>';
    }

    // ---- 近 4 周投入趋势 ----
    const weekRows = [];
    for (let w = 3; w >= 0; w--) {
      const ws = CM.addDays(CM.weekStart(today), -7 * w);
      const we = CM.addDays(ws, 6);
      const m = CM.minutesBetween(state, ws, we > today ? today : we);
      weekRows.push({ ws: ws, m: m });
    }
    const maxW = Math.max.apply(null, weekRows.map(function (r) { return r.m; }).concat([1]));
    if (weekRows.some(function (r) { return r.m > 0; })) {
      html += '<div class="section-title"><h2>近 4 周投入</h2><span class="aside">按时间段累计</span></div>';
      html += '<div class="card" style="padding:14px 15px"><div class="wk-bars">' +
        weekRows.map(function (r, i) {
          const h = Math.max(3, Math.round(r.m / maxW * 56));
          const label = i === weekRows.length - 1 ? '本周' : CM.mdText(r.ws);
          return '<div class="wk-col">' +
            '<span class="wk-val">' + (r.m ? Math.round(r.m / 60 * 10) / 10 + 'h' : '') + '</span>' +
            '<i style="height:' + h + 'px"></i>' +
            '<span class="wk-lab">' + label + '</span>' +
          '</div>';
        }).join('') +
      '</div></div>';
    }

    html += '<div class="section-title"><h2>近 8 周节奏</h2><span class="aside">深色＝完成多</span></div>';
    html += '<div class="card" style="padding:14px 15px">' + heatmap(56) + '</div>';

    // 今日复盘
    html += '<div class="section-title"><h2>今日复盘</h2></div>';
    const rv = state.reviews[today] || {};
    html += '<div class="card review-card">' +
      '<div class="review-q">今天最有价值的一件事</div>' +
      '<textarea data-review="win" rows="2" placeholder="写下来，明天就不会忘">' + esc(rv.win || '') + '</textarea>' +
      '<div class="review-q">卡住的地方</div>' +
      '<textarea data-review="block" rows="2" placeholder="是什么让它没推进">' + esc(rv.block || '') + '</textarea>' +
      '<div class="review-q">精力状态</div>' +
      '<div class="chip-row">' + [1, 2, 3, 4, 5].map(function (n) {
        return '<button class="chip' + (rv.score === n ? ' on' : '') + '" data-act="score" data-n="' + n + '">' + n + '</button>';
      }).join('') + '</div>' +
    '</div>';

    // 欠账
    const debt = debtList();
    html += '<div class="section-title"><h2>顺延中的事项</h2><span class="aside">可一键放弃</span></div>';
    if (!debt.length) {
      html += '<div class="empty" style="padding:20px">没有欠账，节奏很干净</div>';
    } else {
      html += '<div class="card" style="padding:6px 15px">' + debt.slice(0, 12).map(function (d2) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)">' +
          '<span style="flex:1;font-size:13.5px">' + esc(d2.text) + '</span>' +
          '<span class="tag shu">' + d2.days + ' 天</span>' +
          '<button class="btn sm" data-act="drop-debt" data-key="' + esc(d2.uidKey) + '" data-date="' + d2.originDate + '">放弃</button>' +
        '</div>';
      }).join('') + '</div>';
    }

    html += '</div>';
    return html + tabbar();
  }

  function heatmap(nDays) {
    const today = CM.todayKey();
    const start = CM.addDays(today, -(nDays - 1));
    // 补齐到周一对齐
    let cur = CM.weekStart(start);
    let cols = [];
    while (cur <= today) {
      const col = [];
      for (let i = 0; i < 7; i++) {
        const d = CM.addDays(cur, i);
        if (d > today) { col.push('<div class="heat-cell future"></div>'); continue; }
        const st = CM.dayStats(state, d);
        let cls = 'heat-cell';
        if (st.total) {
          const r = st.rate;
          cls += r >= 0.999 ? ' l4' : r >= 0.66 ? ' l3' : r >= 0.33 ? ' l2' : r > 0 ? ' l1' : '';
        }
        col.push('<div class="' + cls + '" title="' + d + '"></div>');
      }
      cols.push('<div class="heat-col">' + col.join('') + '</div>');
      cur = CM.addDays(cur, 7);
    }
    return '<div class="heat">' + cols.slice(-9).join('') + '</div>';
  }

  function debtList() {
    const today = CM.todayKey();
    const out = CM.carryIns(state, today).map(function (it) {
      return { uidKey: it.uidKey || it.key, key: it.key, text: it.text, originDate: it.originDate, days: it.carryDays };
    });
    // 顺延项若已在今天被勾选，则不算欠账
    const todayOv = state.days[today] || {};
    return out.filter(function (d) { return !(todayOv.done && todayOv.done[d.uidKey]); });
  }

  /* ---------------- 设置视图 ---------------- */

  function viewSettings() {
    const s = state.settings;
    let html = topbar() + '<div class="wrap">';

    html += '<div class="section-title"><h2>数据</h2><span class="aside">只存在本机</span></div>';
    html += '<div class="card" style="padding:14px 15px">' +
      '<div style="font-size:12.5px;line-height:1.8;color:var(--ink-2)">所有数据保存在这台设备的浏览器里，不上传任何服务器。换手机、清缓存、换浏览器都会丢失 —— <b>请定期导出备份</b>。</div>' +
      '<div class="btn-row">' +
        '<button class="btn" data-act="export-json">' + icon('download') + ' 导出备份</button>' +
        '<button class="btn" data-act="import-json">' + icon('upload') + ' 导入恢复</button>' +
      '</div>' +
      '<div class="btn-row">' +
        '<button class="btn sm" data-act="export-md">导出为文本</button>' +
        '<button class="btn sm" data-act="copy-backup">复制到剪贴板</button>' +
      '</div>' +
      '<div class="hint" style="font-size:11.5px;color:var(--ink-4);margin-top:10px;line-height:1.6">' +
        '导出文件为 .json，含模板、清单、完成记录与复盘。导入时可选择「合并」或「覆盖」。' +
      '</div>' +
      '<input type="file" accept=".json,application/json" id="fileInput" style="display:none">' +
    '</div>';

    html += '<div class="section-title"><h2>排期规则</h2></div>';
    html += '<div class="card" style="padding:4px 15px 12px">' +
      rowSwitch('未完成自动顺延', '当天没勾选的条目进入次日计划', 'autoCarry', s.autoCarry) +
      rowSwitch('顺延项置顶', '关闭则排在当日计划之后', 'carryModeTop', s.carryMode === 'insert') +
      '<div class="field" style="margin-top:12px"><label>回溯窗口（天）</label>' +
        '<input type="number" min="1" max="60" value="' + s.maxCarryLookback + '" data-setting="maxCarryLookback">' +
        '<div class="hint">只看最近多少天内的未完成事项，避免陈年旧账一直堆着</div></div>' +
      '<div class="field"><label>周期基准日（第 1 周的周一）</label>' +
        '<input type="date" value="' + s.weekAnchor + '" data-setting="weekAnchor">' +
        '<div class="hint">改动会让所有清单排期重新起算，通常保持默认即可</div></div>' +
      '<div class="field"><label>历史保留（天）</label>' +
        '<input type="number" min="30" max="720" value="' + s.keepHistory + '" data-setting="keepHistory">' +
        '<div class="hint">超期的完成记录会自动清理，控制占用空间</div></div>' +
    '</div>';

    html += '<div class="section-title"><h2>每日金句</h2></div>';
    html += '<div class="card" style="padding:4px 15px 12px">' +
      rowSwitch('首页显示金句', '每天自动换一句，点金句可换或管理', 'quoteToggle', s.showQuote !== false) +
      '<div class="btn-row" style="margin-top:12px">' +
        '<button class="btn sm" data-act="quote-lib">管理金句库</button>' +
        '<button class="btn sm" data-act="quote-shuffle">换今天的金句</button>' +
      '</div>' +
      '<div class="hint" style="font-size:11.5px;color:var(--ink-4);margin-top:10px;line-height:1.6">' +
        '内置 100 条，当前共 ' + (state.quotes && state.quotes.length ? state.quotes.length : (window.CM_QUOTES || []).length) + ' 条。' +
        '可整库替换成自己的句子。' +
      '</div>' +
    '</div>';

    html += '<div class="section-title"><h2>预设计划</h2><span class="aside">一键铺好整套排期</span></div>';
    html += '<div class="card" style="padding:14px 15px">' +
      '<div style="font-family:var(--serif);font-size:15px;margin-bottom:6px">宝宝启蒙打卡计划</div>' +
      '<div style="font-size:12.5px;line-height:1.8;color:var(--ink-2)">' +
        '英语为首位、每天不断；思维机与识字隔天轮换；中文绘本按科普 / 数学 / 情感三科轮着来。' +
        '工作日约 2 小时，周末上午加一段晨读。<br>' +
        '<span style="color:var(--ink-4)">含 9 份清单、7 个模板、361 条内容，一次铺满约 10 周。</span>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:12px">' +
        '<button class="btn primary" data-act="load-baby">载入宝宝启蒙计划</button>' +
      '</div>' +
      '<div class="hint" style="font-size:11.5px;color:var(--ink-4);margin-top:10px;line-height:1.6">' +
        '会覆盖当前的模板、清单与完成记录，建议先「导出备份」。' +
      '</div>' +
    '</div>';

    html += '<div class="section-title"><h2>关于</h2></div>';
    html += '<div class="card" style="padding:14px 15px;font-size:12.5px;line-height:1.85;color:var(--ink-2)">' +
      '<div style="font-family:var(--serif);font-size:15px;margin-bottom:6px">柚柚今天学什么</div>' +
      '英语启蒙优先，每天的时间点、绘本和打卡都在这一页。<br>' +
      '模板负责「骨架」，清单负责「内容」，覆盖层负责「意外」。今天看到的一切都由这三层实时推导出来，所以改模板不会破坏历史记录。' +
      '<div style="margin-top:12px;display:flex;gap:9px">' +
        '<button class="btn sm" data-act="reset-demo">载入示例</button>' +
        '<button class="btn sm danger" data-act="reset-all">清空全部</button>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--ink-4);margin-top:12px">数据条目：模板 ' + state.templates.length +
        ' · 清单 ' + state.lists.length + ' · 覆盖日 ' + Object.keys(state.days).length + '</div>' +
    '</div>';

    html += '</div>';
    return html + tabbar();
  }

  function rowSwitch(title, desc, act, on) {
    return '<div class="switch"><div class="txt">' + esc(title) +
      '<small>' + esc(desc) + '</small></div>' +
      '<button class="tgl' + (on ? ' on' : '') + '" data-act="' + act + '" aria-label="' + esc(title) + '"></button></div>';
  }

  /* ---------------- 渲染 ---------------- */

  function render() {
    const views = { today: viewToday, week: viewWeek, plan: viewPlan, lists: viewLists, review: viewReview, settings: viewSettings };
    $('#app').innerHTML = (views[view.tab] || viewToday)();
  }

  /* ---------------- 弹层 ---------------- */

  function openSheet(title, bodyHtml, onMount) {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = bodyHtml;
    $('#mask').classList.add('on');
    $('#sheet').classList.add('on');
    document.body.style.overflow = 'hidden';
    if (onMount) onMount($('#sheetBody'));
  }
  function closeSheet() {
    $('#mask').classList.remove('on');
    $('#sheet').classList.remove('on');
    document.body.style.overflow = '';
  }

  /* ---------------- 事件 ---------------- */

  const actions = {
    tab: function (el) {
      view.tab = el.dataset.tab;
      if (view.tab === 'today' || view.tab === 'week') view.date = CM.todayKey();
      render();
    },
    'goto-today': function () { view.date = CM.todayKey(); render(); },
    'goto-settings': function () { view.tab = 'settings'; render(); },
    'pick-day': function (el) { view.date = el.dataset.date; render(); },

    /* ---- 月历 ---- */
    'cal-open': function () { calMonth = null; calendar(); },
    'cal-prev': function () {
      calMonth = shiftMonth(calMonth || monthKeyOf(view.date), -1);
      calendar();
    },
    'cal-next': function () {
      calMonth = shiftMonth(calMonth || monthKeyOf(view.date), 1);
      calendar();
    },
    'cal-pick': function (el) {
      const dk = el.dataset.date;
      view.tab = 'today';
      view.date = dk;
      calMonth = null;
      closeSheet();
      render();
    },
    'cal-today': function () {
      view.tab = 'today';
      view.date = CM.todayKey();
      calMonth = null;
      closeSheet();
      render();
    },
    'cal-close': function () { calMonth = null; closeSheet(); },

    toggle: function (el) {
      const uidKey = el.dataset.key;
      const dk = el.dataset.date || view.date;
      const ov = ensureDay(dk);
      if (ov.done[uidKey]) delete ov.done[uidKey];
      else ov.done[uidKey] = 1;
      save();
      render();
      if (ov.done[uidKey]) {
        const st = CM.dayStats(state, dk);
        if (st.total && st.done === st.total) toast('今天的计划全部完成');
      }
    },

    /* ---- 周表 ---- */
    'week-prev': function () {
      view.date = CM.addDays(CM.weekStart(view.date), -7);
      render();
    },
    'week-next': function () {
      view.date = CM.addDays(CM.weekStart(view.date), 7);
      render();
    },
    'week-today': function () { view.date = CM.todayKey(); render(); },
    'goto-week': function () {
      view.tab = 'week';
      view.date = CM.todayKey();
      render();
      try { window.scrollTo(0, 0); } catch (e) { /* 某些环境不支持 */ }
    },
    'week-open': function (el) {
      view.tab = 'today';
      view.date = el.dataset.date;
      render();
    },
    /* 周表很长，整页重绘后要把滚动位置还回去 */
    'wk-toggle': function (el) {
      const y = window.scrollY || 0;
      actions.toggle(el);
      try { window.scrollTo(0, y); } catch (e) { /* 某些环境不支持 */ }
    },

    'task-menu': function (el) {
      const uidKey = el.dataset.key;
      const dk = view.date;
      const day = CM.resolveDay(state, dk);
      const it = day.items.find(function (i) { return (i.uidKey || i.key) === uidKey; });
      if (!it) return;
      const key = it.uidKey || it.key;
      openSheet('事项', '' +
        '<div style="font-family:var(--serif);font-size:16px;line-height:1.6;margin-bottom:6px">' + esc(it.text) + '</div>' +
        (it.carried ? '<div style="font-size:12px;color:var(--shu)">原计划 ' + CM.mdText(it.originDate) + '，已顺延 ' + it.carryDays + ' 天</div>' : '') +
        '<div class="field" style="margin-top:16px"><label>修改内容（仅今日）</label>' +
          '<input type="text" id="mText" value="' + esc(it.text) + '"></div>' +
        '<div class="field"><label>当天时间（仅今日，留空为不设时间）</label>' +
          '<input type="text" id="mSlot" inputmode="numeric" autocomplete="off" ' +
            'value="' + esc(CM.slotText({ start: it.start, end: it.end })) + '" placeholder="10:30-11:30">' +
          '<div class="hint" id="mSlotDur">' + (it.minutes ? '计入时长 ' + CM.humanMin(it.minutes) : '') + '</div></div>' +
        '<div class="btn-row">' +
          '<button class="btn" id="mSave">保存</button>' +
          '<button class="btn" id="mHide">今日移除</button>' +
        '</div>' +
        '<div class="btn-row"><button class="btn danger block" id="mDrop">不再跟进此项</button></div>' +
        '<div class="hint" style="margin-top:10px;font-size:11.5px;color:var(--ink-4);line-height:1.6">' +
          '「今日移除」只影响这一天，之后照常排期；「不再跟进」会让它从顺延队列里彻底消失。' +
        '</div>', function (root) {
          const slotInput = $('#mSlot', root);
          slotInput.addEventListener('input', function () {
            const ps = CM.parseSlot(slotInput.value);
            const m = ps ? CM.slotMinutes(ps) : 0;
            $('#mSlotDur', root).textContent = m ? '计入时长 ' + CM.humanMin(m) : '';
            $('#mSlotDur', root).style.color = (slotInput.value.trim() && !ps) ? 'var(--shu)' : '';
          });
          $('#mSave', root).onclick = function () {
            const v = $('#mText', root).value.trim();
            const d = ensureDay(dk);
            if (!d.renamed) d.renamed = {};
            d.renamed[key] = v || it.text;
            // 单日时间覆盖：写进 days[dk].times
            const rawSlot = slotInput.value.trim();
            if (!d.times) d.times = {};
            if (rawSlot) {
              const ps = CM.parseSlot(rawSlot);
              if (!ps) { toast('时间格式看不懂，试试 10:30-11:30'); return; }
              d.times[key] = ps;
            } else {
              delete d.times[key];
            }
            save(); closeSheet(); render(); toast('已更新');
          };
          $('#mHide', root).onclick = function () {
            const d = ensureDay(dk);
            if (!d.hidden) d.hidden = {};
            d.hidden[key] = 1;
            if (d.done) delete d.done[key];
            save(); closeSheet(); render(); toast('已从今日移除');
          };
          $('#mDrop', root).onclick = function () {
            if (!confirm('确认不再跟进「' + it.text + '」？\n它不会再出现在顺延队列中。')) return;
            if (!state.drops) state.drops = {};
            state.drops[key] = 1;
            if (state.days[dk]) {
              if (!state.days[dk].dropped) state.days[dk].dropped = {};
              state.days[dk].dropped[key] = 1;
              if (state.days[dk].done) delete state.days[dk].done[key];
            }
            save(); closeSheet(); render(); toast('已放弃此项');
          };
        });
    },

    'quote-menu': function () {
      const dk = view.date;
      const pool = (state.quotes && state.quotes.length) ? state.quotes : (window.CM_QUOTES || []);
      openSheet('今日金句', '' +
        '<div class="quote" style="margin-top:0"><span class="qmark">“</span><span class="qtext" id="qNow">' +
          esc(CM.quoteOfDay(state, dk) ? CM.quoteOfDay(state, dk).text : '') + '</span><span class="qmark end">”</span></div>' +
        '<div class="btn-row" style="margin-top:14px">' +
          '<button class="btn" id="qRnd">换一句</button>' +
          '<button class="btn" id="qToday">恢复今日默认</button>' +
        '</div>' +
        '<div class="btn-row"><button class="btn block" id="qLib">管理金句库（' + pool.length + ' 条）</button></div>' +
        '<div class="hint" style="margin-top:10px;font-size:11.5px;color:var(--ink-4);line-height:1.6">' +
          '每天自动从库里挑一句，同一天刷新不变。想固定用某一句，点「换一句」后会记住今天的选择。' +
        '</div>', function (root) {
          const show = function () {
            const q = CM.quoteOfDay(state, dk);
            $('#qNow', root).textContent = q ? q.text : '';
          };
          $('#qRnd', root).onclick = function () {
            if (!pool.length) return;
            const cur = CM.quoteOfDay(state, dk);
            const curIdx = cur ? cur.index : -1;
            const rest = [];
            for (let k = 0; k < pool.length; k++) if (k !== curIdx) rest.push(k);
            const i = rest.length ? rest[Math.floor(Math.random() * rest.length)] : 0;
            if (!state.settings.quotePick) state.settings.quotePick = {};
            state.settings.quotePick[dk] = i;
            save();
            const q = CM.quoteOfDay(state, dk);
            $('#qNow', root).textContent = q ? q.text : '';
            // 首页金句同步（弹层关闭后不用再刷新）
            const hq = document.querySelector('.quote .qtext');
            if (hq && q) hq.textContent = q.text;
          };
          $('#qToday', root).onclick = function () {
            if (state.settings.quotePick) delete state.settings.quotePick[dk];
            save(); show();
            const q = CM.quoteOfDay(state, dk);
            const hq = document.querySelector('.quote .qtext');
            if (hq && q) hq.textContent = q.text;
            toast('已恢复默认');
          };
          $('#qLib', root).onclick = function () { closeSheet(); quoteLibrary(); };
        });
    },

    'add-extra': function () {
      const dk = view.date;
      openSheet('添加临时事项', '' +
        '<div class="field"><label>内容</label><input type="text" id="exText" placeholder="例如：给客户回电话"></div>' +
        '<div class="btn-row"><button class="btn primary block" id="exAdd">添加到当天</button></div>' +
        '<div class="hint" style="margin-top:10px;font-size:11.5px;color:var(--ink-4);line-height:1.6">临时事项只属于这一天，不会写回模板，也不会重复出现。</div>',
        function (root) {
          const input = $('#exText', root);
          input.focus();
          const go = function () {
            const v = input.value.trim();
            if (!v) return;
            const d = ensureDay(dk);
            d.extra.push({ id: CM.uid('x'), text: v, group: '临时' });
            save(); closeSheet(); render(); toast('已添加');
          };
          $('#exAdd', root).onclick = go;
          input.onkeydown = function (e) { if (e.key === 'Enter') go(); };
        });
    },

    'skip-day': function () {
      const dk = view.date;
      const d = ensureDay(dk);
      d.skip = true;
      save(); render(); toast('已标记为休息日');
    },
    unskip: function () {
      const d = ensureDay(view.date);
      d.skip = false;
      save(); render(); toast('已恢复');
    },
    'carry-preview': function () {
      const dk = view.date;
      const list = CM.carryIns(state, dk);
      const head = '<div style="font-size:12.5px;line-height:1.75;color:var(--ink-2);margin-bottom:12px">' +
        '顺延只搬运「今天及更早」没完成的事项。勾选即视为完成；也可以主动放弃，让它彻底退出队列。</div>';
      if (!list.length) {
        openSheet('顺延清单', head + '<div class="empty" style="padding:22px 0">没有需要顺延的事项</div>');
        return;
      }
      openSheet('顺延清单', head + list.map(function (it) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line)">' +
          '<div style="flex:1;min-width:0"><div style="font-size:13.5px;word-break:break-word">' + esc(it.text) + '</div>' +
          '<div style="font-size:11px;color:var(--ink-4);margin-top:2px">原计划 ' + CM.mdText(it.originDate) + '</div></div>' +
          '<span class="tag shu">' + it.carryDays + ' 天</span>' +
          '<button class="btn sm" data-act="drop-carry" data-key="' + esc(it.uidKey || it.key) + '" data-date="' + esc(it.originDate) + '">放弃</button></div>';
      }).join(''));
    },
    'drop-carry': function (el) {
      const uidKey = el.dataset.key;
      if (!state.drops) state.drops = {};
      state.drops[uidKey] = 1;
      save(true); closeSheet(); render(); toast('已放弃，不再顺延');
    },
    'day-menu': function () {
      const dk = view.date;
      openSheet('这一天', '' +
        '<div class="btn-row" style="margin-top:0"><button class="btn block" id="dmNote">切换休息状态</button></div>' +
        '<div class="btn-row"><button class="btn danger block" id="dmClear">清除当日勾选</button></div>' +
        '<div class="hint" style="margin-top:10px;font-size:11.5px;color:var(--ink-4);line-height:1.6">清除勾选会取消这一天所有完成记录（不影响其他日期）。</div>',
        function (root) {
          $('#dmNote', root).onclick = function () {
            const d = ensureDay(dk); d.skip = !d.skip; save(); closeSheet(); render();
          };
          $('#dmClear', root).onclick = function () {
            const d = ensureDay(dk); d.done = {}; save(); closeSheet(); render(); toast('已清除');
          };
        });
    },

    'tpl-menu': function (el) {
      const id = el.dataset.tpl;
      if (state.planExpanded === id) { state.planExpanded = null; render(); return; }
      state.planExpanded = id;
      render();
    },
    'tpl-new': function () { templateEditor(null); },
    'tpl-edit': function (el) { templateEditor(el.dataset.tpl); },
    'tpl-sec-add': function (el) { templateEditor(el.dataset.tpl, true); },
    'tpl-use-sample': function (el) {
      const tpl = state.templates.find(function (t) { return t.id === el.dataset.tpl; });
      if (!tpl) return;
      if (!state.lists.length) { toast('请先在「清单」里新建一个清单'); return; }
      const l = state.lists[0];
      tpl.sections = [
        { id: CM.uid('sec'), label: '团队学习', count: 1, perSlot: 2, source: { type: 'list', mode: 'cycle', listId: l.id, text: '' } },
        { id: CM.uid('sec'), label: '例行事务', count: 2, perSlot: 1, source: { type: 'fixed', mode: 'workday', listId: null, text: '邮件与消息清理\n昨日复盘' } }
      ];
      tpl.basis = 'week';
      tpl.weekdays = [1, 5];
      tpl.kind = 'weekly';
      tpl.name = tpl.name || '周一/周五 团队学习';
      save(); render(); toast('已套用示例配置');
    },

    'list-new': function () { listEditor(null); },
    'list-open': function (el) { listEditor(el.dataset.list); },

    score: function (el) {
      const today = CM.todayKey();
      if (!state.reviews[today]) state.reviews[today] = {};
      state.reviews[today].score = Number(el.dataset.n);
      save(); render();
    },
    'drop-debt': function (el) {
      const uidKey = el.dataset.key;
      if (!confirm('确认放弃这项？它将不再顺延。')) return;
      if (!state.drops) state.drops = {};
      state.drops[uidKey] = 1;
      save(); render(); toast('已放弃');
    },

    autoCarry: function () { state.settings.autoCarry = !state.settings.autoCarry; save(); render(); },
    quoteToggle: function () {
      state.settings.showQuote = state.settings.showQuote === false;
      save(); render();
    },
    'quote-shuffle': function () {
      const pool = (state.quotes && state.quotes.length) ? state.quotes : (window.CM_QUOTES || []);
      if (!pool.length) { toast('金句库是空的，先添加几句'); return; }
      const dk = CM.todayKey();
      const cur = CM.quoteOfDay(state, dk);
      const curIdx = cur ? cur.index : -1;
      // 排除当前这句，保证"换"了一定换掉（库里只剩一句时只能原地）
      const pool2 = [];
      for (let k = 0; k < pool.length; k++) if (k !== curIdx) pool2.push(k);
      const pick = pool2.length ? pool2[Math.floor(Math.random() * pool2.length)] : 0;
      if (!state.settings.quotePick) state.settings.quotePick = {};
      state.settings.quotePick[dk] = pick;
      save(); render();
      toast('换好了');
    },
    'prog-open': function (el) {
      const p = CM.listProgress(state, el.dataset.list, CM.todayKey());
      if (!p) return;
      const doneSet = {};
      p.doneItems.forEach(function (x) { doneSet[x.index] = x; });
      const list = CM.listOf(state, p.listId);
      const items = list ? list.items : [];
      const rows = items.map(function (txt, i) {
        const got = doneSet[i];
        return '<div class="pl-row' + (got ? ' on' : '') + '">' +
          '<span class="pl-idx">' + (i + 1) + '</span>' +
          '<span class="pl-txt">' + esc(txt) + '</span>' +
          (got ? '<span class="pl-day">' + CM.mdText(got.day) + '</span>' : '') +
        '</div>';
      }).join('');
      openSheet(p.name + ' · ' + p.done + '/' + p.total, '' +
        '<div class="prog-bar" style="margin:0 0 12px"><i style="width:' + Math.round(p.rate * 100) + '%"></i></div>' +
        '<div class="hint" style="font-size:11.5px;color:var(--ink-4);line-height:1.7;margin-bottom:10px">' +
          '打勾的是已完成条目，右侧是它第一次被排到的日期。' +
        '</div>' +
        '<div class="pl-list">' + rows + '</div>');
    },
    'quote-lib': function () { quoteLibrary(); },    'quote-shuffle': function () {
      const pool = quotePool();
      if (!pool.length) return;
      const dk = CM.todayKey();
      const cur = CM.quoteOfDay(state, dk);
      let i = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && cur && i === cur.index) i = (i + 1) % pool.length;
      if (!state.settings.quotePick) state.settings.quotePick = {};
      state.settings.quotePick[dk] = i;
      save(); render(); toast('已换');
    },
    carryModeTop: function () {
      state.settings.carryMode = state.settings.carryMode === 'insert' ? 'append' : 'insert';
      save(); render();
    },

    'export-json': function () { exportJSON(); },
    'import-json': function () { $('#fileInput').click(); },
    'export-md': function () { exportMarkdown(); },
    'copy-backup': function () { copyBackup(); },
    'reset-demo': function () { if (confirm('载入示例会覆盖当前数据，继续？')) { loadDemo(); } },
    'load-baby': function () {
      if (!window.CM_BABY_DATA) { alert('没有找到预设计划数据（js/baby-plan.js）'); return; }
      if (!confirm('载入「宝宝启蒙打卡计划」会覆盖当前的模板、清单与完成记录。\n建议先取消，去「导出备份」存一份再回来。\n\n确定继续？')) return;
      const d = JSON.parse(JSON.stringify(window.CM_BABY_DATA));
      // 周期基准日永远锚到"本周一"，保证从本周开始排，而不是补一堆历史欠账
      d.settings.weekAnchor = CM.weekStart(CM.todayKey());
      // 本周一起到今天之前：还没开工，标成休息日 —— 周表看得到排期，但不进顺延队列
      const today = CM.todayKey();
      let k = d.settings.weekAnchor;
      let guard = 0;
      while (k < today && guard++ < 14) {
        d.days[k] = Object.assign({ done: {}, extra: [] }, d.days[k] || {}, { skip: true });
        k = CM.addDays(k, 1);
      }
      state = CM.normalize(d);
      save(true);
      view.tab = 'today'; view.date = CM.todayKey();
      render();
      toast('已载入宝宝启蒙计划');
    },
    'reset-all': function () {
      if (!confirm('清空全部数据？此操作不可恢复，建议先导出备份。')) return;
      if (!confirm('再确认一次：真的要清空吗？')) return;
      state = CM.normalize(CM.defaultState());
      save(true); render(); toast('已清空');
    }
  };

  /* ---------------- 编辑器 ---------------- */

  function templateEditor(tplId, addSection) {
    const isNew = !tplId;
    const tpl = isNew
      ? {
        id: CM.uid('tpl'), name: '新计划', kind: 'weekly', basis: 'week',
        weekdays: [1, 5], skipWeekdays: [], color: 'qing', enabled: true,
        sections: [{ id: CM.uid('sec'), label: '主要事项', count: 1, perSlot: 1, source: { type: 'fixed', mode: 'cycle', text: '' } }]
      }
      : state.templates.find(function (t) { return t.id === tplId });

    const listOptions = state.lists.map(function (l) {
      return '<option value="' + l.id + '">' + esc(l.name) + '（' + l.items.length + '项）</option>';
    }).join('');

    const body = '' +
      '<div class="field"><label>模板名称</label><input type="text" id="tName" value="' + esc(tpl.name) + '"></div>' +
      '<div class="field"><label>排期方式</label>' +
        '<div class="chip-row" id="tKind">' +
          '<button class="chip' + (tpl.kind === 'weekly' ? ' on' : '') + '" data-v="weekly">每周固定几天</button>' +
          '<button class="chip' + (tpl.kind === 'daily' ? ' on' : '') + '" data-v="daily">每天</button>' +
        '</div></div>' +
      '<div class="field" id="tDays"><label>哪几天</label><div class="chip-row">' +
        [1, 2, 3, 4, 5, 6, 0].map(function (w) {
          return '<button class="chip' + (tpl.weekdays.indexOf(w) >= 0 ? ' on' : '') + '" data-w="' + w + '">' + CM.WD_SHORT[w] + '</button>';
        }).join('') + '</div></div>' +
      '<div class="field"><label>内容推进基准</label>' +
        '<div class="chip-row" id="tBasis">' +
          '<button class="chip' + (tpl.basis === 'week' ? ' on' : '') + '" data-v="week">按周推进</button>' +
          '<button class="chip' + (tpl.basis === 'workday' ? ' on' : '') + '" data-v="workday">按工作日推进</button>' +
        '</div>' +
        '<div class="hint">按周推进：同一周内各天内容一致，跨周滚动（团队学习场景）；<br>按工作日推进：每个工作日往下取一项，周末冻结。</div></div>' +
      '<div class="section-title" style="margin-top:18px"><h2>内容分组</h2></div>' +
      '<div id="tSecs"></div>' +
      '<button class="quick-add" id="addSec" style="margin-top:8px">＋ 增加一组</button>' +
      '<div class="btn-row" style="margin-top:18px">' +
        '<button class="btn primary" id="tSave">保存模板</button>' +
        (isNew ? '' : '<button class="btn danger" id="tDel">删除</button>') +
      '</div>';

    openSheet(isNew ? '新建模板' : '编辑模板', body, function (root) {
      const secsHost = $('#tSecs', root);
      let sections = JSON.parse(JSON.stringify(tpl.sections));

      function drawSecs() {
        secsHost.innerHTML = sections.map(function (sec, i) {
          const isList = sec.source.type === 'list';
          const slots = Array.isArray(sec.slots) ? sec.slots : [];
          // 时间段行：按"每日条目数"逐条给出输入框
          let slotRows = '';
          for (let s = 0; s < sec.count; s++) {
            const v = slots[s] ? CM.slotText(slots[s]) : '';
            slotRows += '<div class="slot-row">' +
              '<span class="slot-no">第 ' + (s + 1) + ' 条</span>' +
              '<input type="text" data-f="slot" data-i="' + i + '" data-s="' + s + '" value="' + esc(v) + '" ' +
                'placeholder="10:30-11:30" inputmode="numeric" autocomplete="off">' +
              '<span class="slot-dur">' + (slots[s] && CM.slotMinutes(slots[s]) ? CM.humanMin(CM.slotMinutes(slots[s])) : '') + '</span>' +
            '</div>';
          }
          return '<div class="card" style="padding:12px 13px;margin-bottom:9px">' +
            '<div class="inline" style="margin-bottom:9px">' +
              '<input type="text" data-f="label" data-i="' + i + '" value="' + esc(sec.label) + '" placeholder="分组名称" style="flex:1">' +
              '<button class="btn sm" data-del="' + i + '" style="flex-shrink:0">删</button>' +
            '</div>' +
            '<div class="inline" style="margin-bottom:9px">' +
              '<div style="flex:1"><div style="font-size:11px;color:var(--ink-3);margin-bottom:4px">每日条目数</div>' +
                '<input type="number" min="1" max="30" data-f="count" data-i="' + i + '" value="' + sec.count + '"></div>' +
              '<div style="flex:1"><div style="font-size:11px;color:var(--ink-3);margin-bottom:4px">每条含几项</div>' +
                '<input type="number" min="1" max="3" data-f="perSlot" data-i="' + i + '" value="' + (sec.perSlot || 1) + '"></div>' +
            '</div>' +
            '<div class="slot-block">' +
              '<div class="slot-head">时间段<span class="hint-i">可留空；填了会在任务上显示，并计入回望时长</span></div>' +
              slotRows +
            '</div>' +
            '<div class="chip-row" style="margin-bottom:9px">' +
              '<button class="chip' + (!isList ? ' on' : '') + '" data-src="fixed" data-i="' + i + '">固定内容</button>' +
              '<button class="chip' + (isList ? ' on' : '') + '" data-src="list" data-i="' + i + '">引用清单</button>' +
            '</div>' +
            (isList
              ? '<select data-f="listId" data-i="' + i + '" style="margin-bottom:8px"><option value="">— 选择清单 —</option>' +
                  state.lists.map(function (l) {
                    return '<option value="' + l.id + '"' + (sec.source.listId === l.id ? ' selected' : '') + '>' + esc(l.name) + '（' + l.items.length + '项）</option>';
                  }).join('') + '</select>' +
                '<div class="chip-row">' +
                  '<button class="chip' + (sec.source.mode === 'random' ? ' on' : '') + '" data-mode="random" data-i="' + i + '">每4周随机不重复</button>' +
                '</div>'
              : '<textarea data-f="text" data-i="' + i + '" rows="3" placeholder="一行一项，循环取用">' + esc(sec.source.text || '') + '</textarea>') +
          '</div>';
        }).join('');
      }

      drawSecs();

      secsHost.addEventListener('input', function (e) {
        const t = e.target;
        const i = Number(t.dataset.i);
        if (isNaN(i) || i < 0) return;
        const f = t.dataset.f;
        if (f === 'label') sections[i].label = t.value;
        else if (f === 'count') {
          const old = sections[i].count;
          sections[i].count = CM.clamp(Number(t.value) || 1, 1, 30);
          if (sections[i].count !== old) {
            // 条目数变了：同步 slots 长度（只补/删尾部，不动已有输入）。
            // 不立即重绘——会把输入框重建导致失焦；改为失焦时再重画整块。
            if (!Array.isArray(sections[i].slots)) sections[i].slots = [];
            while (sections[i].slots.length < sections[i].count) sections[i].slots.push(null);
            sections[i].slots = sections[i].slots.slice(0, sections[i].count);
            t.dataset.dirty = '1';
          }
        }
        else if (f === 'perSlot') sections[i].perSlot = CM.clamp(Number(t.value) || 1, 1, 3);
        else if (f === 'text') sections[i].source.text = t.value;
        else if (f === 'listId') sections[i].source.listId = t.value || null;
        else if (f === 'slot') {
          const s = Number(t.dataset.s);
          if (!Array.isArray(sections[i].slots)) sections[i].slots = [];
          const val = t.value.trim();
          sections[i].slots[s] = val ? CM.parseSlot(val) : null;
          // 实时更新时长提示，不重绘（保焦点）
          const dur = t.parentNode ? t.parentNode.querySelector('.slot-dur') : null;
          if (dur) {
            const m = sections[i].slots[s] ? CM.slotMinutes(sections[i].slots[s]) : 0;
            dur.textContent = m ? CM.humanMin(m) : '';
            dur.classList.toggle('bad', !!val && !sections[i].slots[s]);
          }
        }
      });

      // 条目数改完、离开输入框时重画（补出/收掉对应的时间段输入行）
      secsHost.addEventListener('change', function (e) {
        const t = e.target;
        if (t.dataset && t.dataset.f === 'count' && t.dataset.dirty === '1') {
          t.dataset.dirty = '';
          drawSecs();
        }
      });

      secsHost.addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.del != null) { sections.splice(Number(b.dataset.del), 1); drawSecs(); return; }
        if (b.dataset.src) {
          const i = Number(b.dataset.i);
          sections[i].source.type = b.dataset.src;
          if (b.dataset.src === 'list' && !sections[i].source.listId && state.lists[0]) sections[i].source.listId = state.lists[0].id;
          drawSecs();
        }
        if (b.dataset.mode) {
          const i = Number(b.dataset.i);
          sections[i].source.mode = b.dataset.mode;
          drawSecs();
        }
      });

      $('#addSec', root).onclick = function () {
        sections.push({ id: CM.uid('sec'), label: '新分组', count: 1, perSlot: 1, source: { type: 'fixed', mode: 'cycle', text: '' } });
        drawSecs();
      };

      // 顶部控件
      let kind = tpl.kind, basis = tpl.basis, weekdays = tpl.weekdays.slice();
      $('#tKind', root).addEventListener('click', function (e) {
        const b = e.target.closest('[data-v]'); if (!b) return;
        kind = b.dataset.v;
        $$('#tKind .chip', root).forEach(function (c) { c.classList.toggle('on', c.dataset.v === kind); });
        $('#tDays', root).style.display = kind === 'daily' ? 'none' : '';
      });
      if (kind === 'daily') $('#tDays', root).style.display = 'none';
      $('#tDays', root).addEventListener('click', function (e) {
        const b = e.target.closest('[data-w]'); if (!b) return;
        const w = Number(b.dataset.w);
        const idx = weekdays.indexOf(w);
        if (idx >= 0) weekdays.splice(idx, 1); else weekdays.push(w);
        b.classList.toggle('on');
      });
      $('#tBasis', root).addEventListener('click', function (e) {
        const b = e.target.closest('[data-v]'); if (!b) return;
        basis = b.dataset.v;
        $$('#tBasis .chip', root).forEach(function (c) { c.classList.toggle('on', c.dataset.v === basis); });
      });

      $('#tSave', root).onclick = function () {
        const name = $('#tName', root).value.trim() || '未命名';
        if (!sections.length) { toast('至少需要一组内容'); return; }
        if (kind === 'weekly' && !weekdays.length) { toast('请选择一周中的哪几天'); return; }
        const data = {
          id: tpl.id, name: name, kind: kind, basis: basis,
          weekdays: weekdays.slice().sort(), skipWeekdays: kind === 'daily' ? tpl.skipWeekdays || [] : [],
          color: tpl.color || 'qing', enabled: true,
          sections: sections.map(function (s) {
            const cnt = CM.clamp(Number(s.count) || 1, 1, 30);
            const slots = [];
            for (let k = 0; k < cnt; k++) {
              const v = Array.isArray(s.slots) ? s.slots[k] : null;
              slots.push(v && CM.slotValid(v) ? { start: v.start, end: v.end || '' } : null);
            }
            return {
              id: s.id, label: s.label || '事项', count: cnt,
              perSlot: CM.clamp(Number(s.perSlot) || 1, 1, 3),
              slots: slots,
              source: {
                type: s.source.type, mode: s.source.mode || 'cycle',
                listId: s.source.listId || null, text: s.source.text || ''
              }
            };
          })
        };
        if (isNew) state.templates.push(data);
        else {
          const i = state.templates.findIndex(function (t) { return t.id === tpl.id; });
          state.templates[i] = data;
        }
        save(true); closeSheet(); view.tab = 'plan'; render(); toast('已保存');
      };

      if (!isNew) {
        $('#tDel', root).onclick = function () {
          if (!confirm('删除模板「' + tpl.name + '」？已产生的历史记录不受影响。')) return;
          state.templates = state.templates.filter(function (t) { return t.id !== tpl.id; });
          save(true); closeSheet(); render(); toast('已删除');
        };
      }
    });
  }

  function listEditor(listId) {
    const isNew = !listId;
    const list = isNew ? { id: CM.uid('lst'), name: '', items: [] } : CM.listOf(state, listId);
    const cov = isNew ? null : CM.coverageWeeks(state, listId);

    const body = '' +
      '<div class="field"><label>清单名称</label><input type="text" id="lName" value="' + esc(list.name) + '" placeholder="例如：团队学习清单"></div>' +
      '<div class="field"><label>项目内容</label>' +
        '<textarea id="lItems" rows="14" style="font-size:13px;line-height:1.7" placeholder="一行一项，直接粘贴即可：&#10;- 第 1 项内容&#10;- 第 2 项内容&#10;1. 也支持有序列表&#10;## 也可以用小标题分组">' + esc(list.items.join('\n')) + '</textarea>' +
        '<div class="hint" id="lCount">' + list.items.length + ' 项</div>' +
      '</div>' +
      (cov ? '<div class="card" style="padding:11px 13px;margin-bottom:12px;font-size:12px;line-height:1.7;color:var(--ink-2)">' +
        '每周消耗 <b>' + cov.perWeek + '</b> 项 · 约可支撑 <b>' + (cov.weeks || 0) + '</b> 周' +
        (cov.exhaustedAt ? '（排到 ' + CM.fullText(cov.exhaustedAt) + '）' : '') +
      '</div>' : '') +
      '<div class="btn-row"><button class="btn primary" id="lSave">保存</button>' +
        (isNew ? '' : '<button class="btn danger" id="lDel">删除</button>') + '</div>';

    openSheet(isNew ? '新建清单' : '编辑清单', body, function (root) {
      const ta = $('#lItems', root);
      const cnt = $('#lCount', root);
      ta.addEventListener('input', function () {
        const n = CM.cleanListItems(CM.parseList(ta.value)).length;
        cnt.textContent = n + ' 项';
      });
      $('#lSave', root).onclick = function () {
        const name = $('#lName', root).value.trim() || '未命名清单';
        const items = CM.cleanListItems(CM.parseList(ta.value));
        if (!items.length) { toast('清单内容不能为空'); return; }
        const data = { id: list.id, name: name, items: items, color: 'qing' };
        if (isNew) state.lists.push(data);
        else {
          const i = state.lists.findIndex(function (l) { return l.id === list.id; });
          state.lists[i] = data;
        }
        save(true); closeSheet(); render(); toast('已保存 ' + items.length + ' 项');
      };
      if (!isNew) {
        $('#lDel', root).onclick = function () {
          if (!confirm('删除清单「' + list.name + '」？引用它的模板将取不到内容。')) return;
          state.lists = state.lists.filter(function (l) { return l.id !== list.id; });
          save(true); closeSheet(); render(); toast('已删除');
        };
      }
    });
  }

  /* ---------------- 导入导出 ---------------- */

  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  function exportJSON() {
    const payload = {
      app: 'chengming-plan',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state
    };
    const d = new Date();
    const stamp = d.getFullYear() + CM.pad(d.getMonth() + 1) + CM.pad(d.getDate()) + '-' + CM.pad(d.getHours()) + CM.pad(d.getMinutes());
    download('柚柚今天学什么-' + stamp + '.json', JSON.stringify(payload, null, 2));
    toast('已导出备份文件');
  }

  function exportMarkdown() {
    const today = CM.todayKey();
    let out = '# 柚柚今天学什么 · 备份\n\n导出时间：' + CM.fullText(today) + '\n\n';
    out += '## 周期模板\n\n';
    state.templates.forEach(function (t) {
      out += '### ' + t.name + '（' + (t.kind === 'daily' ? '每天' : t.weekdays.map(function (w) { return CM.WD_NAME[w]; }).join('、')) + ' | ' + (t.basis === 'week' ? '按周推进' : '按工作日推进') + '）\n';
      t.sections.forEach(function (s) {
        const slots = (s.slots || []).map(function (v) { return v ? CM.slotText(v) : ''; }).filter(Boolean);
        out += '- ' + s.label + '：' + s.count + ' 条 × ' + (s.perSlot || 1) + ' 项，来源 ' +
          (s.source.type === 'fixed' ? '固定内容' : (CM.listOf(state, s.source.listId) || {}).name || '已失效清单') +
          (slots.length ? '，时段 ' + slots.join(' / ') : '') + '\n';
      });
      out += '\n';
    });
    out += '## 清单\n\n';
    state.lists.forEach(function (l) {
      const p = CM.listProgress(state, l.id, CM.todayKey());
      out += '### ' + l.name + '（' + l.items.length + ' 项' + (p ? '，已完成 ' + p.done + ' 项，' + Math.round(p.rate * 100) + '%' : '') + '）\n';
      l.items.forEach(function (it, i) { out += (i + 1) + '. ' + it + '\n'; });
      out += '\n';
    });

    // 累计投入
    const tstats = CM.allTemplateStats(state, state.settings.weekAnchor, CM.todayKey());
    if (tstats.length) {
      out += '## 累计投入\n\n';
      tstats.forEach(function (t) {
        out += '- ' + t.name + '：完成 ' + t.times + ' 次' + (t.minutes ? '，累计 ' + CM.humanMin(t.minutes) : '') + '\n';
      });
      out += '\n';
    }

    out += '## 完成记录\n\n';
    Object.keys(state.days).sort().forEach(function (k) {
      const ov = state.days[k];
      const done = Object.keys(ov.done || {}).length;
      if (!done && !ov.note) return;
      out += '- ' + k + '：完成 ' + done + ' 项' + (ov.note ? '；备注：' + ov.note : '') + '\n';
    });
    download('柚柚今天学什么-' + today + '.md', out, 'text/markdown;charset=utf-8');
    toast('已导出 Markdown');
  }

  function copyBackup() {
    const txt = JSON.stringify({ app: 'chengming-plan', version: 1, data: state });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast('备份 JSON 已复制'); },
        function () { fallbackCopy(txt); });
    } else fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败，请用导出文件'); }
    document.body.removeChild(ta);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const obj = JSON.parse(String(reader.result));
        const data = obj.data || obj;
        if (!data || (!data.templates && !data.days)) throw new Error('格式不符');
        const mode = confirm('点击「确定」= 覆盖当前数据；点击「取消」= 合并（保留现有完成记录）');
        const incoming = CM.normalize(data);
        if (mode) {
          state = incoming;
        } else {
          // 合并：清单/模板按 id 去重追加，days 浅合并（现有优先）
          incoming.lists.forEach(function (l) {
            if (!state.lists.some(function (x) { return x.id === l.id; })) state.lists.push(l);
          });
          incoming.templates.forEach(function (t) {
            if (!state.templates.some(function (x) { return x.id === t.id; })) state.templates.push(t);
          });
          Object.keys(incoming.days).forEach(function (k) {
            if (!state.days[k]) state.days[k] = incoming.days[k];
          });
          Object.keys(incoming.reviews || {}).forEach(function (k) {
            if (!state.reviews[k]) state.reviews[k] = incoming.reviews[k];
          });
        }
        save(true); render(); toast('导入完成');
      } catch (e) {
        alert('导入失败：' + e.message);
      }
    };
    reader.readAsText(file);
  }

  /* ---------------- 示例数据 ---------------- */

  /* ---------------- 金句库 ---------------- */

  function quotePool() {
    return (state.quotes && state.quotes.length) ? state.quotes : (window.CM_QUOTES || []);
  }

  function quoteLibrary() {
    const isCustom = !!(state.quotes && state.quotes.length);
    const pool = quotePool();

    openSheet('金句库', '' +
      '<div class="hint" style="font-size:12px;color:var(--ink-3);line-height:1.7;margin-bottom:12px">' +
        '共 <b>' + pool.length + '</b> 条 · ' + (isCustom ? '当前使用你的自定义版本' : '当前使用内置 100 条') +
        '<br>一行一条，随时可改。清空全部内容会退回内置版本。' +
      '</div>' +
      '<textarea id="qText" rows="12" style="font-size:13px;line-height:1.85" ' +
        'placeholder="一行一条金句">' + esc(pool.join('\n')) + '</textarea>' +
      '<div class="inline" style="justify-content:space-between;margin-top:8px">' +
        '<span id="qCount" style="font-size:11.5px;color:var(--ink-4)">' + pool.length + ' 条</span>' +
        '<button class="btn sm" id="qRestore">恢复内置 100 条</button>' +
      '</div>' +
      '<div class="btn-row"><button class="btn primary block" id="qSave">保存</button></div>',
      function (root) {
        const ta = $('#qText', root);
        const cnt = $('#qCount', root);
        ta.addEventListener('input', function () {
          const n = CM.cleanListItems(CM.parseList(ta.value)).length;
          cnt.textContent = n + ' 条' + (n === 0 ? '（将使用内置）' : '');
          cnt.style.color = n === 0 ? 'var(--shu)' : 'var(--ink-4)';
        });
        $('#qRestore', root).onclick = function () {
          ta.value = (window.CM_QUOTES || []).join('\n');
          ta.dispatchEvent(new Event('input'));
        };
        $('#qSave', root).onclick = function () {
          const list = CM.cleanListItems(CM.parseList(ta.value));
          if (!list.length) {
            state.quotes = [];
            save(true); closeSheet(); render(); toast('已恢复内置金句');
            return;
          }
          state.quotes = list;
          save(true); closeSheet(); render(); toast('已保存 ' + list.length + ' 条');
        };
      });
  }

  function loadDemo() {
    const base = CM.normalize(CM.defaultState());
    const anchor = CM.weekStart(CM.todayKey());
    base.settings.weekAnchor = anchor;

    const learnItems = [
      '需求评审流程与判据', '接口契约设计规范', '单元测试覆盖率要求', '代码评审清单',
      '性能压测方法', '日志规范与排查路径', '灰度发布流程', '故障复盘模板',
      '数据埋点方案设计', 'A/B 实验设计要点', '用户访谈技巧', '竞品分析方法',
      '需求优先级排序（RICE）', '迭代节奏与看板管理', '技术债管理机制', '架构决策记录（ADR）',
      '服务降级与限流策略', '缓存设计常见陷阱', '分库分表评估要点', '异步任务与重试机制',
      '消息队列选型对比', '分布式锁的实现取舍', '幂等设计清单', '一致性哈希原理',
      'CAP 与业务取舍', '监控指标四大黄金信号', '告警分级与值班制度', '容量规划方法',
      '成本优化思路', '安全编码基线', '依赖漏洞治理', '权限模型设计（RBAC/ABAC）',
      '密钥管理与轮换', '数据脱敏规则', '多租户隔离方案', '离线任务调度设计',
      '实时计算链路拆解', '数据质量校验规则', '指标口径治理', '报表自助化实践',
      '移动端性能优化要点', '弱网与断网体验设计', '首屏加载优化路径', '图片与资源策略',
      '交互一致性规范', '无障碍设计基础', '设计走查清单', '组件库维护机制',
      '跨端复用策略', '版本兼容与升级策略', '接口版本演进规范', '兼容性测试矩阵',
      '自动化测试分层', '测试环境治理', '发布清单与回滚预案', '线上问题分级响应',
      '文档写作规范', '技术方案评审要点', '需求澄清会议主持', '项目风险识别',
      '跨团队协作机制', '向上沟通与预期管理', '目标拆解（OKR）实践', '复盘会引导方法',
      '知识沉淀与分享机制', '新人上手路径设计', '招聘面试评价维度', '绩效反馈技巧',
      '时间管理：重要与紧急', '深度工作环境搭建', '会议效率提升', '异步沟通规范',
      '写作：结论先行', '汇报材料结构', '数据可视化表达', '演讲控场技巧',
      '用户增长漏斗分析', '留存曲线解读', '付费转化路径', '渠道归因方法',
      '定价策略基础', '客户成功分层运营', '需求池清洗方法', '产品路线图规划',
      'MVP 验证思路', '可用性测试执行', '信息架构设计', '导航与检索设计',
      '表单设计规范', '空状态与错误提示', '动效使用原则', '设计系统落地',
      '前端工程化实践', '构建产物分析', '微前端取舍', '服务端渲染与静态化',
      '边缘计算适用场景', '容器化与镜像规范', 'K8s 资源配额实践', 'CI/CD 流水线设计'
    ];

    base.lists = [
      { id: 'lst_learn', name: '团队学习清单', items: learnItems, color: 'qing' },
      {
        id: 'lst_focus', name: '重点推进事项', items: [
          '梳理本周核心目标，明确优先次序', '完成 A 模块联调与自测', '输出 B 需求技术方案初稿', '整理 C 数据口径并同步相关人',
          '推进 D 项目里程碑验收', '完成 E 问题的根因分析与修复', '撰写 F 方案评审材料', '跟进 G 供应商交付进度',
          '复盘上周遗留问题并收敛', '梳理 H 系统的容量与瓶颈', '完成 I 模块的性能基线测试', '整理 J 客户反馈并分类',
          '输出 K 指标周报', '完成 L 功能灰度发布', '梳理 M 流程的自动化机会', '整理 N 团队的知识文档',
          '推进 O 需求的澄清与拆解', '完成 P 环境的稳定性治理', '梳理 Q 模块的技术债清单', '输出 R 方案的对比结论'
        ], color: 'shu'
      },
      {
        id: 'lst_check', name: '每日检视项', items: [
          '今日三件最重要的事已确定', '昨日遗留项已处理或明确延后', '关键结论已同步给相关人',
          '风险与阻塞已上报', '明日首要任务已写下'
        ], color: 'hu'
      }
    ];

    base.templates = [
      {
        id: 'tpl_learn', name: '团队学习（周一 / 周五）', kind: 'weekly', basis: 'week',
        weekdays: [1, 5], skipWeekdays: [], color: 'qing', enabled: true,
        sections: [
          { id: 'sec_learn', label: '团队学习', count: 1, perSlot: 1, slots: ['10:30-11:30'],
            source: { type: 'list', mode: 'cycle', listId: 'lst_learn', text: '' } }
        ]
      },
      {
        id: 'tpl_daily', name: '日常推进', kind: 'daily', basis: 'workday',
        weekdays: [1], skipWeekdays: [0, 6], color: 'ink', enabled: true,
        sections: [
          { id: 'sec_focus', label: '核心推进', count: 2, perSlot: 1, slots: ['09:00-10:00', '14:00-15:30'],
            source: { type: 'list', mode: 'workday', listId: 'lst_focus', text: '' } },
          { id: 'sec_check', label: '例行检视', count: 1, perSlot: 1, slots: ['17:30-17:50'],
            source: { type: 'list', mode: 'workday', listId: 'lst_check', text: '' } }
        ]
      }
    ];
    state = CM.normalize(base);
    save(true);
    view.tab = 'today'; view.date = CM.todayKey();
    render();
    toast('示例已载入：团队学习 100 项，每周一/五 10:30-11:30');
  }

  /* ---------------- 启动 ---------------- */

  function boot() {
    state = load();
    prune();

    // 首次使用自动载入示例，避免空白
    if (!localStorage.getItem(KEY + '.seeded')) {
      localStorage.setItem(KEY + '.seeded', '1');
      loadDemo();
    } else {
      render();
    }

    // 全局事件委托
    document.addEventListener('click', function (e) {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      const fn = actions[act];
      if (fn) { e.preventDefault(); fn(el, e); }
    });

    $('#mask').addEventListener('click', closeSheet);
    $('#sheetClose').addEventListener('click', closeSheet);

    document.addEventListener('input', function (e) {
      const t = e.target;
      if (t.dataset.input === 'note') {
        const d = ensureDay(view.date);
        d.note = t.value;
        save();
      }
      if (t.dataset.review) {
        const today = CM.todayKey();
        if (!state.reviews[today]) state.reviews[today] = {};
        state.reviews[today][t.dataset.review] = t.value;
        save();
      }
      if (t.dataset.setting) {
        const k = t.dataset.setting;
        let v = t.value;
        if (k === 'maxCarryLookback' || k === 'keepHistory') v = CM.clamp(Number(v) || 1, 1, 720);
        state.settings[k] = v;
        save();
      }
    });

    document.addEventListener('change', function (e) {
      if (e.target.id === 'fileInput') {
        const f = e.target.files[0];
        if (f) importJSON(f);
        e.target.value = '';
      }
    });

    // 每天跨日时自动刷新（手机长时间挂后台）
    let lastDay = CM.todayKey();
    setInterval(function () {
      const now = CM.todayKey();
      if (now !== lastDay) {
        lastDay = now;
        view.date = now;
        render();
      }
    }, 30000);

    // 首次进入提示备份
    const lastExport = Number(localStorage.getItem(KEY + '.lastExport') || 0);
    window.addEventListener('beforeunload', function () {
      if (saveTimer) { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
