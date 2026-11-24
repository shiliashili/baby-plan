/* ============================================================
 * 柚柚今天学什么
 * core.js —— 纯逻辑层（无 DOM 依赖）
 *
 * 不存储"每一天的计划"，而存储三样东西：
 *   1) 周期模板  templates —— 条目按周重复
 *   2) 内容清单  lists     —— 有顺序的项目池
 *   3) 稀疏覆盖  days      —— 只记录被改动/勾选的那几天
 * 任意一天 = 模板骨架 + 按周期序号推导出的清单切片 + 覆盖层 + 结转层
 * ============================================================ */
(function (root) {
  'use strict';

  /* ---------------- 日期工具 ---------------- */

  const DAY = 86400000;
  const WD_NAME = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const WD_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(s) {
    const p = String(s).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }
  function todayKey() { return toKey(new Date()); }
  function addDays(key, n) {
    const d = fromKey(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
  }
  function diffDays(a, b) { return Math.round((fromKey(b) - fromKey(a)) / DAY); }
  function weekday(key) { return fromKey(key).getDay(); }
  function mdText(key) {
    const d = fromKey(key);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function fullText(key) {
    const d = fromKey(key);
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  /** 同年只显示"月日"，跨年补上年份——窄屏下更省地方 */
  function smartDate(key) {
    const d = fromKey(key);
    const now = fromKey(todayKey());
    return (d.getFullYear() === now.getFullYear() ? '' : d.getFullYear() + '年') +
      (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function weekStart(key) {
    const w = weekday(key);
    return addDays(key, -(w === 0 ? 6 : w - 1));
  }
  function cycleIndex(dayKey, anchorKey) {
    return Math.floor(diffDays(weekStart(anchorKey), weekStart(dayKey)) / 7);
  }
  function isoWeekNo(key) {
    const d = fromKey(key);
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayNum = (t.getDay() + 6) % 7;
    t.setDate(t.getDate() - dayNum + 3);
    const firstThursday = new Date(t.getFullYear(), 0, 4);
    const fDayNum = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - fDayNum + 3);
    return 1 + Math.round((t - firstThursday) / (7 * DAY));
  }

  /* ---------------- 时间段 ---------------- */

  /** "10:30" / "10:30-11:30" / "10:30~11:30" / "10.30-11.30" → {start:'10:30', end:'11:30'} */
  function parseSlot(str) {
    const s = String(str == null ? '' : str).trim().replace(/[：]/g, ':').replace(/[．。]/g, '.');
    if (!s) return null;
    const m = s.match(/^(\d{1,2})[:.]?(\d{2})?\s*(?:[-~—–至到]\s*(\d{1,2})[:.]?(\d{2})?)?$/);
    if (!m) return null;
    const h1 = Number(m[1]), m1 = Number(m[2] || 0);
    if (h1 > 23 || m1 > 59) return null;
    const start = pad(h1) + ':' + pad(m1);
    if (m[3] == null) return { start: start, end: '' };
    const h2 = Number(m[3]), m2 = Number(m[4] || 0);
    if (h2 > 23 || m2 > 59) return null;
    return { start: start, end: pad(h2) + ':' + pad(m2) };
  }

  /** 'HH:MM' → 分钟数 */
  function toMin(hm) {
    if (!hm) return null;
    const p = String(hm).split(':');
    const h = Number(p[0]), m = Number(p[1] || 0);
    if (isNaN(h)) return null;
    return h * 60 + (isNaN(m) ? 0 : m);
  }

  /** 时段是否有效（有开始时间即有效；有结束时间才算得出时长） */
  function slotValid(slot) {
    return !!(slot && slot.start);
  }

  /** 时段时长（分钟）；缺结束时间返回 0 */
  function slotMinutes(slot) {
    if (!slotValid(slot) || !slot.end) return 0;
    const a = toMin(slot.start), b = toMin(slot.end);
    if (a == null || b == null) return 0;
    const d = b - a;
    return d > 0 ? d : 0;
  }

  /** 分钟 → "1 小时 30 分" / "45 分钟" / "2 小时" */
  function humanMin(min) {
    const n = Math.round(Number(min) || 0);
    if (n <= 0) return '';
    const h = Math.floor(n / 60), m = n % 60;
    if (!h) return m + ' 分钟';
    if (!m) return h + ' 小时';
    return h + ' 小时 ' + m + ' 分';
  }

  /** 时段展示："10:30-11:30" / "10:30" / '' */
  function slotText(slot) {
    if (!slotValid(slot)) return '';
    return slot.end ? slot.start + '-' + slot.end : slot.start;
  }

  /** 分组下第 slot 条对应的时间段 */
  function sectionSlot(sec, slot) {
    const arr = sec && Array.isArray(sec.slots) ? sec.slots : null;
    if (!arr) return null;
    const v = arr[slot];
    return slotValid(v) ? v : null;
  }

  /* ---------------- 每日金句 ---------------- */

  /**
   * 取当天金句。
   *  - state.settings.quotePick = { '2026-11-24': 12 } 时优先用人工指定
   *  - 否则用 日期 + 偏移 的 hash 稳定选取（同一天刷新不变，次日自动换）
   */
  function quoteOfDay(state, dayKey) {
    const pool = (state.quotes && state.quotes.length) ? state.quotes : (root.CM_QUOTES || []);
    if (!pool.length) return null;
    const dk = dayKey || todayKey();
    const pick = state.settings && state.settings.quotePick;
    if (pick && pick[dk] != null) {
      const i = Number(pick[dk]);
      if (i >= 0 && i < pool.length) return { text: pool[i], index: i, manual: true };
    }
    const seed = hashStr('quote:' + dk + ':' + (state.settings && state.settings.quoteSalt || ''));
    const idx = seed % pool.length;
    return { text: pool[idx], index: idx, manual: false };
  }

  /* ---------------- 小工具 ---------------- */

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function shuffle(arr, rnd) {
    const a = arr.slice();
    const r = rnd || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function rngFrom(seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /** 极简 Markdown：支持列表项与「## 」小标题 */
  function parseList(text) {    const lines = String(text || '').split(/\r?\n/);
    const items = [];
    let section = '';
    lines.forEach(function (raw) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) return;
      const head = line.match(/^#{1,4}\s+(.*)$/);
      if (head) { section = head[1].trim(); return; }
      const bullet = line.match(/^\s*(?:[-*•·]|\d{1,3}[.)、])\s+(.*)$/);
      const content = (bullet ? bullet[1] : line).trim();
      if (!content) return;
      items.push(section ? section + ' · ' + content : content);
    });
    return items;
  }

  function cleanListItems(items) {
    const seen = {};
    const out = [];
    (items || []).forEach(function (it) {
      const v = String(it == null ? '' : it).trim();
      if (!v || seen[v]) return;
      seen[v] = 1;
      out.push(v);
    });
    return out;
  }

  /* ---------------- 默认数据 ---------------- */

  function defaultState() {
    return {
      version: 2,
      settings: {
        weekAnchor: weekStart(todayKey()),
        autoCarry: true,
        maxCarryLookback: 14,
        carryMode: 'insert',
        keepHistory: 120,
        showQuote: true,
        quotePick: {},
        quoteSalt: ''
      },
      templates: [],
      lists: [],
      days: {},
      reviews: {},
      // 空数组表示"用内置 100 条"；用户一旦编辑就变成独立副本
      quotes: [],
      createdAt: Date.now()
    };
  }

  function normalize(state) {
    const base = defaultState();
    const s = Object.assign({}, base, state || {});
    s.settings = Object.assign({}, base.settings, s.settings || {});
    s.templates = Array.isArray(s.templates) ? s.templates : [];
    s.lists = Array.isArray(s.lists) ? s.lists : [];
    s.days = s.days && typeof s.days === 'object' ? s.days : {};
    s.reviews = s.reviews && typeof s.reviews === 'object' ? s.reviews : {};
    s.drops = s.drops && typeof s.drops === 'object' ? s.drops : {};
    s.quotes = Array.isArray(s.quotes) ? cleanListItems(s.quotes) : [];
    if (!s.settings.quotePick || typeof s.settings.quotePick !== 'object') s.settings.quotePick = {};
    if (s.settings.showQuote == null) s.settings.showQuote = true;
    if (s.settings.quoteSalt == null) s.settings.quoteSalt = '';

    s.templates = s.templates.map(function (t) {
      const tpl = Object.assign({}, t);
      tpl.id = tpl.id || uid('tpl');
      tpl.name = tpl.name || '未命名模板';
      tpl.kind = tpl.kind === 'daily' ? 'daily' : 'weekly';
      tpl.basis = tpl.basis === 'week' ? 'week' : 'workday';
      tpl.weekdays = Array.isArray(tpl.weekdays) && tpl.weekdays.length
        ? tpl.weekdays.map(Number).filter(function (w) { return w >= 0 && w <= 6; })
        : [1];
      tpl.skipWeekdays = Array.isArray(tpl.skipWeekdays) ? tpl.skipWeekdays.map(Number) : [];
      tpl.enabled = tpl.enabled !== false;
      tpl.color = tpl.color || 'ink';
      tpl.sections = (Array.isArray(tpl.sections) ? tpl.sections : []).map(function (sec) {
        const o = Object.assign({}, sec);
        o.id = o.id || uid('sec');
        o.label = o.label || '事项';
        o.count = clamp(Number(o.count) || 1, 1, 30);
        o.perSlot = clamp(Number(o.perSlot) || 1, 1, 3);
        // 时间段：优先读 slots 数组；兼容旧的单值 time / times
        let rawSlots;
        if (Array.isArray(o.slots)) rawSlots = o.slots;
        else if (Array.isArray(o.times)) rawSlots = o.times;
        else if (o.time) rawSlots = [o.time];
        else rawSlots = [];
        o.slots = rawSlots.map(function (v) {
          if (!v) return null;
          if (typeof v === 'object') {
            const a = parseSlot(v.start);
            const b = parseSlot(v.end);
            if (!a) return null;
            return { start: a.start, end: b ? b.start : '' };
          }
          return parseSlot(v);
        });
        // 补齐到 count 长度，多余截断，保证 slots[slot] 一定能取到
        while (o.slots.length < o.count) o.slots.push(null);
        o.slots = o.slots.slice(0, o.count);
        const src = Object.assign({ type: 'fixed', mode: 'cycle', listId: null, text: '' }, o.source || {});
        src.type = src.type === 'list' ? 'list' : 'fixed';
        src.mode = src.mode === 'random' ? 'random' : 'cycle';
        o.source = src;
        return o;
      });
      return tpl;
    });

    s.lists = s.lists.map(function (l) {
      return {
        id: l.id || uid('lst'),
        name: l.name || '未命名清单',
        items: cleanListItems(l.items || []),
        color: l.color || 'qing'
      };
    });

    Object.keys(s.days).forEach(function (k) {
      const ov = s.days[k] || {};
      ov.done = ov.done || {};
      ov.extra = ov.extra || [];
      s.days[k] = ov;
    });
    return s;
  }

  /* ---------------- 排期基础 ---------------- */

  function appliesOn(tpl, dayKey) {
    if (!tpl.enabled) return false;
    const w = weekday(dayKey);
    if (tpl.kind === 'daily') return (tpl.skipWeekdays || []).indexOf(w) < 0;
    return (tpl.weekdays || []).indexOf(w) >= 0;
  }

  function hasSchedule(state, dayKey) {
    return state.templates.some(function (t) { return appliesOn(t, dayKey); });
  }

  function isWorkdayDate(key) {
    const w = weekday(key);
    return w >= 1 && w <= 5;
  }

  /** anchor 起算，dayKey 是第几个工作日（0 起，含当天） */
  function workdayOrdinal(dayKey, anchor) {
    if (dayKey < anchor) return 0;
    const n = diffDays(anchor, dayKey);
    let count = 0;
    const startW = weekday(anchor);
    for (let i = 0; i <= n; i++) {
      const w = (startW + i) % 7;
      if (w >= 1 && w <= 5) count++;
    }
    return Math.max(0, count - 1);
  }

  /** 模板在"一周内"的应用日数 */
  function dayOrdinalTotal(tpl) {
    if (tpl.kind === 'daily') return Math.max(1, 7 - (tpl.skipWeekdays || []).length);
    return Math.max(1, (tpl.weekdays || []).length);
  }

  /** 模板内第几个应用日（周一为 0 的次序） */
  function dayOrdinalIn(tpl, w) {
    if (tpl.kind === 'daily') {
      const seq = [1, 2, 3, 4, 5, 6, 0].filter(function (x) {
        return (tpl.skipWeekdays || []).indexOf(x) < 0;
      });
      const i = seq.indexOf(w);
      return i < 0 ? 0 : i;
    }
    const days = (tpl.weekdays || []).slice().sort(function (a, b) {
      return ((a + 6) % 7) - ((b + 6) % 7);
    });
    const i = days.indexOf(w);
    return i < 0 ? 0 : i;
  }

  /* ---------------- 单日推导 ---------------- */

  function listOf(state, id) {
    return state.lists.filter(function (l) { return l.id === id; })[0] || null;
  }

  function sliceAt(items, start, n, sec) {
    if (!items.length) return '';
    const got = [];
    const k = Math.min(n || 1, items.length);
    for (let i = 0; i < k; i++) {
      got.push(items[(((start + i) % items.length) + items.length) % items.length]);
    }
    const text = got.join(' / ');
    return sec.suffix ? text + ' ' + sec.suffix : text;
  }

  function resolveSlot(state, sec, slotNo, ord, ci) {
    const src = sec.source || {};
    const per = sec.perSlot || 1;

    if (src.type === 'fixed') {
      const items = parseList(src.text);
      if (!items.length) return '';
      if (src.mode === 'random') {
        const round = Math.floor(ci / 4);
        return sliceAt(shuffle(items, rngFrom(hashStr(sec.id + ':' + round + ':' + ord))), slotNo * per, per, sec);
      }
      return sliceAt(items, slotNo * per, per, sec);
    }

    const list = listOf(state, src.listId);
    if (!list) return '';
    const items = list.items || [];
    if (!items.length) return '';

    if (src.mode === 'random') {
      // 每 4 周一轮，随机不重复，同一周期稳定可复现
      const round = Math.floor(ci / 4);
      const perDay = Math.max(1, sec.count) * per;
      const rnd = rngFrom(hashStr(sec.id + ':' + round + ':' + ord));
      const pool = shuffle(items, rnd).slice(0, Math.min(perDay * 5, items.length));
      return sliceAt(pool, slotNo * per, per, sec);
    }
    return sliceAt(items, slotNo * per, per, sec);
  }

  /**
   * 某天的"原生"计划（不含人工增删与结转）
   *
   * 游标口径：
   *   week    —— ci × 本周应用日数 + 本周第几个应用日（跨周连续、周内每日推进）
   *   workday —— 工作日序号（周末冻结）
   */
  function nativeItems(state, dayKey, dayOffset) {
    const out = [];
    const w = weekday(dayKey);
    const anchor = state.settings.weekAnchor;
    // 起算日之前不产生任何排期，否则会把"系统启用前"的历史日也算成欠账
    if (dayKey < anchor) return out;
    const ci = Math.max(0, cycleIndex(dayKey, anchor));
    const off = dayOffset || 0;

    state.templates.forEach(function (tpl) {
      if (!appliesOn(tpl, dayKey)) return;
      const ord = dayOrdinalIn(tpl, w);
      const base = tpl.basis === 'week'
        ? ci * dayOrdinalTotal(tpl) + ord
        : workdayOrdinal(dayKey, anchor);

      tpl.sections.forEach(function (sec) {
        for (let slot = 0; slot < sec.count; slot++) {
          const slotNo = (base + off) * sec.count + slot;
          const text = resolveSlot(state, sec, slotNo, ord, ci);
          if (!text) continue;
          const key = 'n:' + tpl.id + ':' + sec.id + ':' + slot;
          const tm = sectionSlot(sec, slot);
          out.push({
            key: key,
            uidKey: dayKey + '|' + key,
            text: text,
            sectionId: sec.id,
            sectionLabel: sec.label,
            templateId: tpl.id,
            slot: slot,
            start: tm ? tm.start : '',
            end: tm ? tm.end : '',
            minutes: tm ? slotMinutes(tm) : 0
          });
        }
      });
    });
    return out;
  }

  /* ---------------- 覆盖层 ---------------- */

  function resolveDay(state, dayKey, opts) {
    opts = opts || {};
    const ov = state.days[dayKey] || {};
    const items = nativeItems(state, dayKey);

    (ov.extra || []).forEach(function (x) {
      items.push({ key: x.id, uidKey: dayKey + '|' + x.id, text: x.text, sectionId: 'extra', sectionLabel: x.group || '临时', extra: true });
    });

    let out = items.filter(function (it) {
      if (ov.hidden && (ov.hidden[it.uidKey] || ov.hidden[it.key])) return false;
      if (state.drops && (state.drops[it.uidKey] || state.drops[dayKey + '|' + it.key])) return false;
      return true;
    }).map(function (it) {
      let o = it;
      if (ov.renamed && ov.renamed[it.key]) o = Object.assign({}, o, { text: ov.renamed[it.key] });
      // 单日时间覆盖（days[dk].times[key]）
      const tk = (o.uidKey || it.key);
      const ovd = ov.times && (ov.times[tk] || ov.times[it.key]);
      if (ovd) {
        const ps = parseSlot(slotText(ovd));
        if (ps) {
          o = Object.assign({}, o, {
            start: ps.start, end: ps.end || '',
            minutes: slotMinutes(ps),
            timeOverridden: true
          });
        }
      }
      return o;
    });

    if (opts.carry !== false && state.settings.autoCarry && !ov.skip) {
      const seen = {};
      // keepDone: 今天已勾掉的顺延项仍然留在列表里显示为"已完成"，避免卡片凭空消失
      const carried = carryIns(state, dayKey, { keepDone: true }).filter(function (c) {
        if (ov.hidden && (ov.hidden[c.uidKey] || ov.hidden[c.key])) return false;
        if (state.drops && (state.drops[c.uidKey] || state.drops[c.key + '@' + c.originDate])) return false;  // 被主动放弃
        if (seen[c.uidKey]) return false;                                    // 同一欠账只出现一次
        seen[c.uidKey] = 1;
        return true;
      });
      if (state.settings.carryMode === 'insert') out = carried.concat(out);
      else out = out.concat(carried);
    }
    return { date: dayKey, items: out, note: ov.note || '', skip: !!ov.skip };
  }

  /**
   * 结转项：更早日子里尚未完成的事项
   *  - 欠账只从「今天及更早」产生，未来日期的计划不会被提前算作欠账
   *  - 休息日、无排期日、被主动放弃的项不计入
   *  - 若某条欠账在"其原生日期之后、今天之前"被勾选过（同一段连续工作日内），视为了结
   *  - 按时间正序：欠得最久的排在最前面
   */
  function carryIns(state, dayKey, opts) {
    opts = opts || {};
    if (!state.settings.autoCarry) return [];
    const today = todayKey();
    const effTo = dayKey < today ? dayKey : today;
    const look = state.settings.maxCarryLookback || 14;
    const todayDone = ((state.days[today] || {}).done) || {};
    const open = [];

    // 关键：key 必须带上"所属日期"。模板条目在不同日期的 key 相同，
    // 若只用 key 去重，就会把"今天刚勾掉的同一条目"误当作历史上欠的那一条。
    for (let i = look; i >= 1; i--) {
      const dk = addDays(effTo, -i);
      const ov = state.days[dk] || {};
      if (ov.skip) continue;
      if (!hasSchedule(state, dk)) continue;
      const nat = nativeItems(state, dk).slice();
      (ov.extra || []).forEach(function (x) {
        nat.push({ key: x.id, text: x.text, sectionId: 'extra', sectionLabel: x.group || '临时', extra: true, extraId: x.id });
      });
      nat.forEach(function (it) {
        const uidKey = it.uidKey || (dk + '|' + it.key);
        if (ov.done && (ov.done[uidKey] || ov.done[it.key])) return;
        if (ov.hidden && (ov.hidden[uidKey] || ov.hidden[it.key])) return;
        if (ov.dropped && (ov.dropped[uidKey] || ov.dropped[it.key])) return;
        if (state.drops && (state.drops[uidKey] || state.drops[dk + '|' + it.key])) return;   // 已放弃（跨日生效）
        open.push({ uidKey: uidKey, key: it.key, item: it, originDate: dk });
      });
    }

    const out = [];
    open.forEach(function (c) {
      // 这条在今天已被勾掉（原生项或顺延项都算），说明已经处理过。
      // keepDone：界面需要把"今天刚勾掉的顺延项"仍显示为已完成，而不是让卡片凭空消失。
      if (!opts.keepDone && (todayDone[c.uidKey] || todayDone[c.key])) return;
      if (closedAfter(state, c)) return;
      out.push(Object.assign({}, c.item, {
        carried: true,
        originDate: c.originDate,
        carryDays: diffDays(c.originDate, dayKey),
        uidKey: c.uidKey
      }));
    });
    return out;
  }

  /**
   * 该事项是否已在"原生日期之后"被勾选过。
   *
   * 模板条目的 key 在不同日期会复用（同一条目每天都是同一个 key），
   * 因此需要按"清单内容 + 时间顺序"判断：若后续某天出现了与之相同的原文
   * 并且那天被勾选，则视为这条任务后来补上了。周末/休息日会截断这段关系（不跨周追责）。
   */
  function closedAfter(state, c) {
    const originDate = c.originDate;
    const key = c.key;
    const nat = nativeItems(state, originDate).filter(function (it) { return it.key === key; })[0];
    if (!nat) return false;
    const text = nat.text;

    const tpl = state.templates.filter(function (t) { return t.id === nat.templateId; })[0];
    if (!tpl) return false;

    // 只在"本模板排期的连续日子里"往后看；跨过本模板的休息日即终止（历史任务不跨周追责）
    let j = diffDays(originDate, todayKey());
    while (j >= 1) {
      const d2 = addDays(originDate, j);
      if (!appliesOn(tpl, d2)) return false;
      const ov = state.days[d2] || {};
      if (ov.done) {
        const later = nativeItems(state, d2).filter(function (it) { return it.templateId === nat.templateId; });
        if (later.some(function (it) { return (ov.done[it.uidKey] || ov.done[it.key]) && it.text === text; })) return true;
      }
      j--;
    }
    return false;
  }

  function isDone(state, dayKey, itemKey) {
    const ov = state.days[dayKey];
    return !!(ov && ov.done && ov.done[itemKey]);
  }

  /** 用界面上的唯一标识（顺延项为 uidKey）判断完成 */
  function isDoneBy(state, dayKey, item) {
    const ov = state.days[dayKey];
    if (!ov || !ov.done) return false;
    return !!(ov.done[item.uidKey] || ov.done[item.key]);
  }

  /* ---------------- 统计 ---------------- */

  function weekDays(anyKey) {
    const start = weekStart(anyKey);
    const out = [];
    for (let i = 0; i < 7; i++) out.push(addDays(start, i));
    return out;
  }

  function dayStats(state, dayKey) {
    const d = resolveDay(state, dayKey);
    let done = 0;
    d.items.forEach(function (it) { if (isDoneBy(state, dayKey, it)) done++; });
    return {
      total: d.items.length,
      done: done,
      open: d.items.length - done,
      rate: d.items.length ? done / d.items.length : 0
    };
  }

  /** 某天"原生排期"的总时长（分钟）：只看模板排出来的，不含顺延项 */
  function dayMinutes(state, dayKey) {
    return nativeItems(state, dayKey).reduce(function (a, it) {
      return a + (Number(it.minutes) || 0);
    }, 0);
  }

  /**
   * 遍历 [from, to] 之间每一天的已办事项（含结转项）
   * 用于回望页聚合统计。cb(dayKey, item, originDate)
   */
  function eachDone(state, from, to, cb) {
    let k = from;
    let guard = 0;
    while (k <= to && guard++ < 1200) {
      const d = resolveDay(state, k);
      d.items.forEach(function (it) {
        if (!isDoneBy(state, k, it)) return;
        if (cb) cb(k, it, it.originDate || k);
      });
      k = addDays(k, 1);
    }
  }

  /**
   * 每个清单的"完成进度"：在清单总条目中，有多少条已经被排到并勾选完成
   *
   * 做法：扫描实际排期（按模板游标推导），把「某条清单内容 → 哪一天被排上 → 有没有勾掉」串起来。
   * 返回 { listId, name, total, scheduled（已排到过的条数）, done（其中已勾选的条数）, rate }
   */
  function listProgress(state, listId, upToKey) {
    const list = listOf(state, listId);
    if (!list) return null;
    const items = list.items || [];
    const total = items.length;
    if (!total) {
      return { listId: listId, name: list.name, total: 0, scheduled: 0, done: 0, rate: 0, doneItems: [] };
    }

    const seenIdx = {};   // itemIndex -> { scheduled:true, done:bool, firstDay }
    const to = upToKey || todayKey();
    const from = state.settings.weekAnchor;
    if (!from) return { listId: listId, name: list.name, total: total, scheduled: 0, done: 0, rate: 0, doneItems: [] };

    // 逐日推导排期，找出引用该清单的条目落在清单的第几项
    let k = from;
    let guard = 0;
    while (k <= to && guard++ < 1200) {
      state.templates.forEach(function (tpl) {
        if (!appliesOn(tpl, k)) return;
        const w = weekday(k);
        const anchor = state.settings.weekAnchor;
        const ci = Math.max(0, cycleIndex(k, anchor));
        const ord = dayOrdinalIn(tpl, w);
        const base = tpl.basis === 'week'
          ? ci * dayOrdinalTotal(tpl) + ord
          : workdayOrdinal(k, anchor);

        tpl.sections.forEach(function (sec) {
          const src = sec.source || {};
          if (src.type !== 'list' || src.listId !== listId) return;
          const per = sec.perSlot || 1;
          for (let slot = 0; slot < sec.count; slot++) {
            const slotNo = (base) * sec.count + slot;
            const start = src.mode === 'random' ? null : slotNo * per;
            if (start == null) continue;   // 随机模式下无法稳定映射到清单下标，跳过
            for (let j = 0; j < per; j++) {
              const idx = (((start + j) % total) + total) % total;
              const key = 'n:' + tpl.id + ':' + sec.id + ':' + slot;
              const uidKey = k + '|' + key;
              if (!seenIdx[idx]) seenIdx[idx] = { scheduled: true, done: false, firstDay: k, key: key };
              const ov = state.days[k] || {};
              if (ov.done && (ov.done[uidKey] || ov.done[key])) seenIdx[idx].done = true;
            }
          }
        });
      });
      k = addDays(k, 1);
    }

    const doneItems = [];
    Object.keys(seenIdx).forEach(function (i) {
      if (seenIdx[i].done) doneItems.push({ index: Number(i), text: items[Number(i)], day: seenIdx[i].firstDay });
    });
    doneItems.sort(function (a, b) { return a.index - b.index; });

    const scheduled = Object.keys(seenIdx).length;
    const done = doneItems.length;
    return {
      listId: listId,
      name: list.name,
      total: total,
      scheduled: scheduled,
      done: done,
      rate: total ? done / total : 0,
      doneItems: doneItems
    };
  }

  /**
   * 模板累计执行情况：被勾选的条目次数 + 总时长（按时段累加）
   * 返回 { templateId, name, times, minutes, lastDay }
   */
  function templateStats(state, templateId, fromKey, toKey) {
    const tpl = state.templates.filter(function (t) { return t.id === templateId; })[0];
    const from = fromKey || state.settings.weekAnchor;
    const to = toKey || todayKey();
    let times = 0, minutes = 0, lastDay = '';
    eachDone(state, from, to, function (k, it) {
      if (it.templateId !== templateId) return;
      times++;
      minutes += Number(it.minutes) || 0;
      if (k > lastDay) lastDay = k;
    });
    return {
      templateId: templateId,
      name: tpl ? tpl.name : '已删除模板',
      times: times,
      minutes: minutes,
      lastDay: lastDay
    };
  }

  /** 全部模板的汇总 */
  function allTemplateStats(state, fromKey, toKey) {
    return state.templates.map(function (t) {
      return templateStats(state, t.id, fromKey, toKey);
    }).filter(function (x) { return x.times > 0; })
      .sort(function (a, b) { return b.times - a.times; });
  }

  /** 某段时间内完成的条目总时长（分钟） */
  function minutesBetween(state, from, to) {
    let m = 0;
    eachDone(state, from, to, function (k, it) { m += Number(it.minutes) || 0; });
    return m;
  }

  /** 连续达标天数：完成率 ≥ 60% 达标；休息日与空白日跳过 */
  function streak(state, untilKey) {    let n = 0;
    let k = untilKey || todayKey();
    const today = todayKey();
    for (let i = 0; i < 365; i++) {
      const ov = state.days[k] || {};
      if (ov.skip) { k = addDays(k, -1); continue; }
      const st = dayStats(state, k);
      if (!st.total) { k = addDays(k, -1); continue; }
      if (st.rate >= 0.6) n++;
      else if (k < today) break;
      k = addDays(k, -1);
    }
    return n;
  }

  /**
   * 单个模板的「连续打卡」次数：从今天往回数，该模板排期的日子里全部勾完的连续段。
   * 只统计模板自己的应用日（一三五的模板，跳过周二周四），今天没做完不打断。
   */
  function templateStreak(state, templateId, untilKey) {
    const tpl = state.templates.filter(function (t) { return t.id === templateId; })[0];
    if (!tpl) return 0;
    const today = todayKey();
    let k = untilKey || today;
    let n = 0;
    for (let i = 0; i < 400; i++) {
      if (!appliesOn(tpl, k)) { k = addDays(k, -1); continue; }
      const ov = state.days[k] || {};
      const mine = nativeItems(state, k).filter(function (it) { return it.templateId === templateId; });
      if (!mine.length) { k = addDays(k, -1); continue; }
      const allDone = mine.every(function (it) {
        return !!(ov.done && (ov.done[it.uidKey] || ov.done[it.key]));
      });
      if (allDone) n++;
      else if (k < today) break;         // 今天还没做完不算断
      k = addDays(k, -1);
    }
    return n;
  }

  /** 到 dayKey 为止，该清单已消耗条数（含当天） */  function consumedAt(state, dayKey, listId) {
    const anchor = state.settings.weekAnchor;
    let maxUsed = 0;
    const ci = Math.max(0, cycleIndex(dayKey, anchor));

    state.templates.forEach(function (tpl) {
      const used = tpl.sections.filter(function (sec) {
        return sec.source && sec.source.type === 'list' && sec.source.listId === listId;
      });
      if (!used.length) return;

      used.forEach(function (sec) {
        let ords = 0;
        // 每条实际消耗 sec.perSlot 项清单内容，算续航时必须一起算进去
        const per = sec.perSlot || 1;
        const ws = weekStart(dayKey);
        for (let i = 0; i < 7; i++) {
          const d = addDays(ws, i);
          if (d > dayKey) break;
          if (appliesOn(tpl, d)) ords++;
        }
        if (tpl.basis === 'week') {
          maxUsed = Math.max(maxUsed, (ci * dayOrdinalTotal(tpl) + ords) * sec.count * per);
        } else {
          // 工作日基准：把 dayKey 之前（含）的工作日数按"工作日内第几个应用日"折算
          let wd = workdayOrdinal(dayKey, anchor);
          if (isWorkdayDate(dayKey) && appliesOn(tpl, dayKey)) wd++;
          maxUsed = Math.max(maxUsed, wd * sec.count * per);
        }
      });
    });
    return maxUsed;
  }

  /** 清单还能支撑多久 */
  function coverageWeeks(state, listId) {
    const list = listOf(state, listId);
    if (!list || !list.items.length) return null;
    const anchor = state.settings.weekAnchor;
    const today = todayKey();
    const startKey = anchor > today ? anchor : weekStart(today);

    let perWeek = 0;
    state.templates.forEach(function (tpl) {
      if (!tpl.enabled) return;
      const appDays = tpl.kind === 'daily'
        ? Math.max(1, 7 - (tpl.skipWeekdays || []).length)
        : Math.max(1, (tpl.weekdays || []).length);
      tpl.sections.forEach(function (sec) {
        if (!sec.source || sec.source.type !== 'list' || sec.source.listId !== listId) return;
        perWeek += sec.count * (sec.perSlot || 1) * (tpl.basis === 'week' ? appDays : Math.min(appDays, 5));
      });
    });
    if (!perWeek) return null;

    const need = list.items.length;
    let exhaustedAt = null;
    for (let i = 0; i < 1100; i++) {
      const d = addDays(startKey, i);
      if (consumedAt(state, d, listId) > need) { exhaustedAt = d; break; }
    }
    return {
      perWeek: perWeek,
      total: need,
      exhaustedAt: exhaustedAt,
      weeks: exhaustedAt ? Math.max(0, Math.round(diffDays(weekStart(today), weekStart(exhaustedAt)) / 7)) : null
    };
  }

  root.CM = {
    DAY, WD_NAME, WD_SHORT,
    pad, toKey, fromKey, todayKey, addDays, diffDays, weekday, mdText, fullText, smartDate,
    parseSlot, toMin, slotValid, slotMinutes, humanMin, slotText, sectionSlot,
    weekStart, cycleIndex, isoWeekNo,
    uid, clamp, hashStr, rngFrom, parseList, cleanListItems, shuffle,
    defaultState, normalize, listOf,
    appliesOn, hasSchedule, isWorkdayDate, workdayOrdinal, dayOrdinalTotal, dayOrdinalIn,
    nativeItems, resolveDay, carryIns, closedAfter, isDone, isDoneBy, weekDays,
    dayStats, dayMinutes, streak, consumedAt, coverageWeeks, templateStreak,
    eachDone, listProgress, templateStats, allTemplateStats, minutesBetween, quoteOfDay
  };
})(typeof window !== 'undefined' ? window : globalThis);
