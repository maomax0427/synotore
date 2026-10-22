'use strict';
// シノトレ：シノニム（=の後ろ）から英単語を答える練習。記録は localStorage `synotore:v1`。

const KEY = 'synotore:v1';
const TEST_DEFAULT = '2026-10-29';
const ALL = SETS.flatMap(s => s.words);
const BY = Object.fromEntries(ALL.map(w => [w.id, w]));
const SET = Object.fromEntries(SETS.map(s => [s.id, s]));
const MASTER = 3; // このレベル以上で「習得」

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => ymd(new Date());
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysUntil = s => Math.round((parseYmd(s) - parseYmd(today())) / 864e5);
const WD = '日月火水木金土';
const mdw = s => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => s.trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function fmtMin(sec) { const m = Math.round(sec / 60); return m < 60 ? `${m}<small>分</small>` : `${Math.floor(m / 60)}<small>時間</small>${m % 60}<small>分</small>`; }
const fmtClock = sec => `${Math.floor(sec / 60)}:${pad2(sec % 60)}`;

/* ---------- 保存 ---------- */
function blank() {
  return {
    v: 1, w: {}, day: {}, tests: {},
    cfg: { testDate: TEST_DEFAULT, sets: SETS.map(s => s.id), style: 'auto', prompt: 'syn', order: 'weak', count: 10, autoSpeak: false },
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) { const b = blank(); return Object.assign(b, s, { cfg: Object.assign(b.cfg, s.cfg) }); }
  } catch (e) { /* 読めなければ新規 */ }
  return blank();
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('保存できませんでした'); } }

// 単語ごとの記録：lv 0〜4（入力で正解すると3以上＝習得）, c 正解数, x ミス数, t 最終回答, ok 最後の正誤, star 要チェック
const st = id => S.w[id] || { lv: 0, c: 0, x: 0 };
const day = (d = today()) => S.day[d] || (S.day[d] = { s: 0, n: 0, k: 0, m: 0 });
function status(id) {
  const s = st(id);
  if (s.star || (s.x > 0 && s.lv < MASTER)) return 'weak';
  if (!s.t) return 'new';
  return s.lv >= MASTER ? 'done' : 'learn';
}
const STATUS = { done: ['習得', 'ok'], learn: ['覚え中', 'ac'], weak: ['苦手', 'ng'], new: ['未学習', ''] };
function counts(ws) {
  const c = { done: 0, learn: 0, weak: 0, new: 0 };
  ws.forEach(w => c[status(w.id)]++);
  return c;
}
const pct = ws => Math.round(ws.reduce((a, w) => a + Math.min(st(w.id).lv, MASTER), 0) / (ws.length * MASTER) * 100);
const weakWords = () => ALL.filter(w => status(w.id) === 'weak').sort((a, b) => (st(b.id).ok === false) - (st(a.id).ok === false) || st(b.id).x - st(a.id).x);

function record(id, ok, kind) {
  const s = S.w[id] || (S.w[id] = { lv: 0, c: 0, x: 0 });
  const first = !s.t;
  const before = s.lv;
  s.t = Date.now(); s.ok = ok;
  if (ok) {
    s.c++;
    // 4択・カードでは「覚え中」まで。習得には本番と同じ入力で正解が必要
    // 一度も間違えていない単語は入力2回の正解で習得
    s.lv = kind === 'type' ? Math.min(4, s.lv + (s.x === 0 ? 2 : 1)) : (s.lv < MASTER - 1 ? s.lv + 1 : s.lv);
  } else if (!(kind === 'card' && first)) {
    s.x++; s.lv = 0;
  }
  const d = day();
  d.n++; if (ok) d.k++;
  if (before < MASTER && s.lv >= MASTER) d.m++;
  save();
}

/* ---------- 勉強時間（出題画面を開いていて、操作が90秒以内のときだけ数える） ---------- */
let lastAct = Date.now();
['pointerdown', 'keydown', 'input'].forEach(e => addEventListener(e, () => { lastAct = Date.now(); }, true));
setInterval(() => {
  if (!Q || document.hidden || Date.now() - lastAct > 90000) return;
  day().s++; Q.sec++;
  if (Q.sec % 10 === 0) save();
  const t = $('#qtime'); if (t) t.textContent = fmtClock(Q.sec);
}, 1000);
addEventListener('visibilitychange', () => { if (document.hidden) save(); });

function studyDays() { return Object.keys(S.day).filter(d => S.day[d].n > 0 || S.day[d].s >= 30).sort(); }
function streak() {
  const set = new Set(studyDays());
  const d = new Date();
  if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const totalSec = () => Object.values(S.day).reduce((a, d) => a + d.s, 0);

/* ---------- アイコン ---------- */
const sv = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC = {
  home: sv('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  play: sv('<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor"/>'),
  weak: sv('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>'),
  book: sv('<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 21V5M8 7h7"/>'),
  x: sv('<path d="M6 6l12 12M18 6L6 18"/>', 2.6),
  chev: sv('<path d="M9 5l7 7-7 7"/>', 2.4),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>', 1.7),
  spk: sv('<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>'),
};

/* ---------- 発音 ---------- */
function speak(text) {
  if (!('speechSynthesis' in window)) return toast('この端末は読み上げに対応していません');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.9;
  const v = speechSynthesis.getVoices().find(v => v.lang === 'en-US');
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
const spkBtn = w => `<button class="spk tap" data-a="speak" data-w="${esc(w)}" aria-label="発音を聞く">${IC.spk}</button>`;

/* ---------- タブ ---------- */
const TABS = [['home', 'ホーム', IC.home], ['practice', '練習', IC.play], ['weak', '苦手', IC.weak], ['words', '単語', IC.book]];
let tab = 'home';
const UI = { q: '', set: 'all', hide: false };

function render() {
  const nw = weakWords().length;
  $('#tabbar').innerHTML = TABS.map(([id, label, ic]) =>
    `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${ic}<span>${label}</span>${id === 'weak' && nw ? `<span class="dot">${nw}</span>` : ''}</button>`).join('');
  $('#main').innerHTML = ({ home: homeHTML, practice: practiceHTML, weak: weakHTML, words: wordsHTML })[tab]();
  if (tab === 'words') bindSearch();
}

/* ---------- ホーム ---------- */
function ring(p) {
  const r = 36, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 84 84"><circle class="bg" cx="42" cy="42" r="${r}"/><circle class="fg" cx="42" cy="42" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"/><text x="42" y="42">${p}%</text></svg>`;
}
function segBar(c, n) {
  return `<div class="seg">${['done', 'learn', 'weak'].map(k => `<i class="s-${k}" style="width:${c[k] / n * 100}%"></i>`).join('')}</div>`;
}
function homeHTML() {
  const c = counts(ALL), p = pct(ALL), left = daysUntil(S.cfg.testDate);
  const td = day(), dn = studyDays().length, sk = streak();
  const remain = ALL.length - c.done;
  const perDay = left > 0 ? Math.ceil((remain + td.m) / left) : remain;
  const goalP = perDay ? Math.min(100, td.m / perDay * 100) : 100;
  const nw = c.weak;
  const countTxt = left > 0 ? `<div class="d num">${left}<small>日</small></div><div class="grow"><div class="bold">テストまで あと${left}日</div><div class="small muted">${mdw(S.cfg.testDate)} がテスト日</div></div>`
    : left === 0 ? `<div class="d">🔥</div><div class="grow"><div class="bold">今日がテスト！</div><div class="small muted">苦手だけ最後に見直そう</div></div>`
      : `<div class="d">✓</div><div class="grow"><div class="bold">テスト日（${mdw(S.cfg.testDate)}）を過ぎました</div><div class="small muted">右上の⚙︎で次のテスト日を設定できます</div></div>`;
  return `
  <div class="page-h"><h1>シノトレ</h1><button class="icbtn tap" data-a="settings" aria-label="設定">${IC.gear}</button></div>
  <div class="card count">${countTxt}</div>

  <div class="card hero mt12">
    ${ring(p)}
    <div class="grow">
      <div class="small muted bold">進み具合</div>
      <div class="big num">${c.done}<small>/ ${ALL.length}語 習得</small></div>
      ${segBar(c, ALL.length)}
      <div class="legend"><span class="l-done">習得 <b>${c.done}</b></span><span class="l-learn">覚え中 <b>${c.learn}</b></span><span class="l-weak">苦手 <b>${c.weak}</b></span><span>未学習 <b>${c.new}</b></span></div>
    </div>
  </div>

  <button class="go tap mt12" data-a="quick">
    <div class="k">スキマ時間に（約2分）</div>
    <div class="t">クイック10問 ▶︎</div>
    <div class="s">苦手・まだ覚えていない単語から優先して出ます</div>
  </button>
  <div class="grid2 mt12">
    <button class="card tile tap ${nw ? 'alert' : ''}" data-a="weakgo"><span class="ic">🎯</span><span class="t">苦手を復習</span><span class="s">${nw ? `${nw}語 あります` : '今はありません'}</span></button>
    <button class="card tile tap" data-a="tab" data-tab="practice"><span class="ic">📝</span><span class="t">本番形式テスト</span><span class="s">セットごとに25問を入力</span></button>
  </div>

  <div class="sec-h">勉強の記録</div>
  <div class="card kpis">
    <div><b class="num">${fmtMin(td.s)}</b><span>今日（${td.n}問）</span></div>
    <div><b class="num">${fmtMin(totalSec())}</b><span>合計の勉強時間</span></div>
    <div><b class="num">${dn}<small>日</small></b><span>勉強した日数</span>${sk > 1 ? `<span class="streak">🔥${sk}日連続</span>` : ''}</div>
  </div>
  ${left > 0 && remain > 0 ? `<div class="card goal mt12">
    <div class="small"><b>今日の目標：${perDay}語を習得</b> <span class="muted">（いま ${td.m}語）</span></div>
    <div class="bar"><i class="g" style="width:${goalP}%"></i></div>
    <div class="tiny muted mt8">残り${remain}語 ÷ ${left}日。入力（本番形式）で正解すると「習得」になります</div>
  </div>` : ''}
  ${chartHTML()}

  <div class="sec-h">セットごとの進み具合</div>
  <div class="card list">${SETS.map(setRow).join('')}</div>
  <p class="tiny muted center mt16">記録はこの端末のブラウザに保存されます</p>`;
}
function chartHTML() {
  // テスト日が2週間以内なら、テスト日までを右端に並べる（先の日は空欄）
  const t = today(), left = daysUntil(S.cfg.testDate);
  const d = left > 0 && left <= 13 ? parseYmd(S.cfg.testDate) : new Date();
  d.setDate(d.getDate() - 13);
  const days = [];
  for (let i = 0; i < 14; i++) { days.push(ymd(d)); d.setDate(d.getDate() + 1); }
  const mins = days.map(k => Math.round((S.day[k]?.s || 0) / 60));
  const max = Math.max(10, ...mins);
  const w0 = new Date(); w0.setDate(w0.getDate() - 6);
  const week = Object.keys(S.day).filter(k => k >= ymd(w0)).reduce((a, k) => a + S.day[k].s, 0);
  const label = (k, i) => {
    if (k === t) return '今日';
    if (k === S.cfg.testDate) return '本番';
    const x = parseYmd(k);
    return i === 0 || x.getDate() === 1 ? `${x.getMonth() + 1}/${x.getDate()}` : x.getDate();
  };
  return `<div class="card chart mt12">
    <div class="chart-h"><span class="small bold">毎日の勉強時間（分）</span><span class="tiny muted">直近7日 ${Math.round(week / 60)}分</span></div>
    <div class="bars">${days.map((k, i) => `<div class="c ${k === t ? 'today' : ''}">${mins[i] ? `<span class="v">${mins[i]}</span>` : ''}<div class="b ${mins[i] ? 'has' : ''} ${k > t ? 'fut' : ''}" style="height:${k > t ? 100 : mins[i] / max * 92}%"></div></div>`).join('')}</div>
    <div class="days">${days.map((k, i) => `<span class="${k === t ? 'today' : k === S.cfg.testDate ? 'test' : ''}">${label(k, i)}</span>`).join('')}</div>
  </div>`;
}
function setRow(s) {
  const c = counts(s.words), n = s.words.length;
  const best = (S.tests[s.id] || []).reduce((a, r) => Math.max(a, r.s), -1);
  return `<button class="li tap" data-a="set" data-set="${s.id}">
    <div class="grow">
      <div class="ttl">${s.name} <span class="small muted">${esc(s.words.slice(0, 3).map(w => w.w).join(', '))} …</span></div>
      <div class="bar"><i class="g" style="width:${c.done / n * 100}%"></i><i style="width:${c.learn / n * 100}%"></i><i class="r" style="width:${c.weak / n * 100}%"></i></div>
      <div class="badges"><span class="pill ok">習得 ${c.done}/${n}</span>${c.weak ? `<span class="pill ng">苦手 ${c.weak}</span>` : ''}${best >= 0 ? `<span class="pill gd">テスト最高 ${best}/25</span>` : ''}</div>
    </div>
    <span class="chev">${IC.chev}</span>
  </button>`;
}

/* ---------- 練習 ---------- */
const STYLE = [['auto', 'おまかせ'], ['mc', '4択'], ['type', '入力'], ['card', 'カード']];
const PROMPT = [['syn', 'シノニム'], ['both', 'シノニム＋日本語'], ['ja', '日本語']];
const ORDER = [['weak', '苦手優先'], ['rand', 'ランダム'], ['seq', '番号順']];
const COUNT = [[10, '10問'], [25, '25問'], [50, '50問'], [0, '全部']];
const KIND = { mc: '4択', type: '入力', card: 'カード' };
const segCtl = (key, opts) => `<div class="seg-ctl">${opts.map(([v, l]) => `<button class="${S.cfg[key] === v ? 'on' : ''}" data-a="cfg" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
const selIds = () => SETS.filter(s => S.cfg.sets.includes(s.id)).flatMap(s => s.words.map(w => w.id));

function practiceHTML() {
  const ids = selIds();
  const n = S.cfg.count ? Math.min(S.cfg.count, ids.length) : ids.length;
  const allOn = S.cfg.sets.length === SETS.length;
  return `
  <div class="page-h"><h1>練習</h1></div>
  <div class="opt-h">範囲</div>
  <div class="chips">
    <button class="chip ${allOn ? 'on' : ''}" data-a="sets" data-v="all">全部</button>
    <button class="chip" data-a="sets" data-v="c">Coreだけ</button>
    <button class="chip" data-a="sets" data-v="b">Basicだけ</button>
  </div>
  <div class="chips mt8">${SETS.map(s => `<button class="chip ${S.cfg.sets.includes(s.id) ? 'on' : ''}" data-a="toggleset" data-set="${s.id}">${s.name}</button>`).join('')}</div>

  <div class="opt-h">答え方</div>
  ${segCtl('style', STYLE)}
  <p class="note">${{
    auto: 'はじめての単語はカード → 4択 → 入力と、覚え具合に合わせて変わります',
    mc: '4つの中から選びます。4択の正解は「覚え中」まで',
    type: '本番と同じく英単語を入力。正解を重ねると「習得」になります',
    card: 'カードをめくって、覚えたかどうかを自分で判定します',
  }[S.cfg.style]}</p>

  <div class="opt-h">問題文</div>
  ${segCtl('prompt', PROMPT)}
  <p class="note">テスト本番はシノニムから答えます。日本語は答えたあとに毎回表示されます</p>

  <div class="opt-h">出題順</div>
  ${segCtl('order', ORDER)}
  <div class="opt-h">問題数</div>
  ${segCtl('count', COUNT)}

  <button class="btn primary block mt16" data-a="start" ${ids.length ? '' : 'disabled'}>スタート（${n}問）</button>

  <div class="sec-h">本番形式テスト（1セット25問・番号順・入力）</div>
  <div class="card list">${SETS.map(setRow).join('')}</div>`;
}

/* ---------- 苦手 ---------- */
function weakHTML() {
  const ws = weakWords();
  if (!ws.length) {
    const any = Object.keys(S.w).length;
    return `<div class="page-h"><h1>苦手</h1></div>
    <div class="card empty"><div class="e">${any ? '🎉' : '🌱'}</div><p>${any ? '今は苦手な単語はありません！' : 'まだ問題を解いていません'}</p><p class="small">間違えた単語や★をつけた単語がここに集まり、<br>入力で続けて正解すると卒業します</p></div>
    <button class="btn primary block mt16" data-a="quick">クイック10問をやる</button>`;
  }
  return `<div class="page-h"><h1>苦手</h1><span class="pill ng">${ws.length}語</span></div>
  <div class="row2">
    <button class="btn primary" data-a="weakgo">苦手を練習（${Math.min(ws.length, 20)}問）</button>
    <button class="btn soft" data-a="weakmc">4択でやさしく</button>
  </div>
  <p class="note">入力（本番形式）で2〜3回続けて正解すると「習得」になり、リストから外れます</p>
  <div class="card list wl mt12">${ws.map(w => wordRow(w, true)).join('')}</div>`;
}

/* ---------- 単語 ---------- */
function wordRow(w, showSet) {
  const s = st(w.id), [label, cls] = STATUS[status(w.id)];
  return `<button class="li tap" data-a="word" data-id="${w.id}">
    <span class="no">${w.n}</span>
    <div class="grow">
      <div class="en"><span class="w">${esc(w.w)}</span><span class="pos">${w.pos}</span></div>
      <div class="syn">= ${esc(w.syn)}</div>
      <div class="ja">${esc(w.ja)}</div>
      <div class="badges"><span class="pill ${cls}">${label}</span>${s.star ? '<span class="pill gd">★</span>' : ''}${s.x ? `<span class="pill">✕${s.x}</span>` : ''}${showSet ? `<span class="pill">${SET[w.set].name}</span>` : ''}</div>
    </div>
  </button>`;
}
function wordsHTML() {
  return `<div class="page-h"><h1>単語</h1></div>
  <input class="search" id="q" type="search" placeholder="英単語・シノニム・日本語で検索" value="${esc(UI.q)}" autocomplete="off" autocapitalize="off" spellcheck="false">
  <div class="toolbar">
    <select id="setSel">
      <option value="all">全セット（${ALL.length}語）</option>
      ${SETS.map(s => `<option value="${s.id}" ${UI.set === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
    </select>
    <button class="toggle ${UI.hide ? 'on' : ''}" data-a="hide">英単語をかくす</button>
  </div>
  <div id="wl">${wordListHTML()}</div>`;
}
function wordListHTML() {
  const q = norm(UI.q);
  const groups = SETS.filter(s => UI.set === 'all' || UI.set === s.id).map(s => [s, s.words.filter(w => !q || w.w.includes(q) || w.syn.toLowerCase().includes(q) || w.ja.includes(UI.q.trim()))]).filter(g => g[1].length);
  if (!groups.length) return '<div class="card empty mt12"><p>見つかりませんでした</p></div>';
  return groups.map(([s, ws]) => `<div class="sec-h">${s.name}</div><div class="card list wl ${UI.hide ? 'hide' : ''}">${ws.map(w => wordRow(w, false)).join('')}</div>`).join('') +
    (UI.hide ? '<p class="note center">タップで答えを表示・長押しで詳細</p>' : '');
}
function bindSearch() {
  $('#q').addEventListener('input', e => { UI.q = e.target.value; $('#wl').innerHTML = wordListHTML(); });
  $('#setSel').addEventListener('change', e => { UI.set = e.target.value; $('#wl').innerHTML = wordListHTML(); });
}

/* ---------- シート ---------- */
function openSheet(html) {
  $('#sheet').innerHTML = `<div class="grab"></div><div class="in">${html}</div>`;
  $('#sheet').hidden = false; $('#sheetBack').hidden = false; document.body.classList.add('lock');
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetBack').hidden = true; if (!Q) document.body.classList.remove('lock'); }

function wordSheet(id) {
  const w = BY[id], s = st(id), [label, cls] = STATUS[status(id)];
  openSheet(`
    <div class="small muted bold">${SET[w.set].name} · ${w.n}</div>
    <div class="fb-w"><b>${esc(w.w)}</b>${spkBtn(w.w)}<span class="pill">${w.pos}</span><span class="pill ${cls}">${label}</span></div>
    <div class="card pad mt12">
      <div class="small muted bold">シノニム（テストで出る形）</div>
      <div class="qsyn" style="margin:4px 0 0;font-size:18px">(= ${esc(w.syn)})</div>
      ${w.hint ? `<div class="small mt8">頭文字ヒント <span class="pill gd">${w.hint}</span></div>` : ''}
      <div class="small muted bold mt12">日本語の意味</div>
      <div>${esc(w.ja)}</div>
    </div>
    <div class="card pad mt12 small">正解 ${s.c}回 ・ ミス ${s.x}回 ${s.t ? `・ 最後は${s.ok ? '◯' : '✕'}` : ''}</div>
    <div class="row2 mt12">
      <button class="btn ${s.star ? 'gray' : 'soft'}" data-a="star" data-id="${id}">${s.star ? '★ 要チェックを外す' : '☆ 要チェックにする'}</button>
      <button class="btn gray" data-a="close">閉じる</button>
    </div>`);
}
function setSheet(id) {
  const s = SET[id], c = counts(s.words), hist = (S.tests[id] || []).slice().reverse();
  openSheet(`
    <h2>${s.name}</h2>
    <div class="small muted">進み具合 ${pct(s.words)}% ・ 習得 ${c.done}/25 ・ 苦手 ${c.weak}</div>
    ${segBar(c, 25)}
    <button class="btn primary block mt16" data-a="settest" data-set="${id}">本番形式テスト（25問・入力）</button>
    <div class="row2 mt8">
      <button class="btn soft" data-a="setpractice" data-set="${id}">このセットを練習</button>
      <button class="btn gray" data-a="setwords" data-set="${id}">単語を見る</button>
    </div>
    <div class="sec-h">テストの記録（Date / Score）</div>
    <div class="card pad">${hist.length ? `<table class="hist"><tr><th>日付</th><th>時間</th><th style="text-align:right">Score</th></tr>${hist.map(r => `<tr><td>${mdw(r.d)}</td><td class="muted">${fmtClock(r.sec || 0)}</td><td class="r">${r.s}/25</td></tr>`).join('')}</table>` : '<div class="small muted">まだ記録はありません。本番形式テストの点数がここに残ります</div>'}</div>`);
}
function settingsSheet() {
  openSheet(`
    <h2>設定</h2>
    <div class="card list mt12">
      <label class="field"><span>テストの日</span><input type="date" id="testDate" value="${S.cfg.testDate}"></label>
      <div class="field"><span>答えたあと自動で発音する</span><button class="sw ${S.cfg.autoSpeak ? 'on' : ''}" data-a="autospeak" aria-label="自動で発音"></button></div>
    </div>
    <div class="card pad mt12 small">
      <b>習得のしくみ</b><br>
      正解するとレベルが上がり、4択・カードでは「覚え中」まで。本番と同じ入力で正解を重ねると「習得」です。間違えるとレベル0に戻り「苦手」に入ります。
    </div>
    <button class="btn danger block mt16" data-a="reset">記録をすべて消す</button>
    <button class="btn gray block mt8" data-a="close">閉じる</button>`);
  $('#testDate').addEventListener('change', e => { if (e.target.value) { S.cfg.testDate = e.target.value; save(); render(); } });
}

/* ---------- 出題 ---------- */
let Q = null;

function pick(ids, n, order) {
  const ws = ids.map(id => BY[id]);
  if (order === 'seq') return ws.slice(0, n);
  if (order === 'rand') return shuffle(ws).slice(0, n);
  const now = Date.now();
  const pr = w => {
    const s = st(w.id);
    let p = Math.random() * 30;
    if (s.star) p += 60;
    if (s.ok === false) p += 120;
    if (s.x > 0 && s.lv < MASTER) p += 70 + s.x * 8;
    if (!s.t) p += 50;
    else p += (4 - s.lv) * 15 + Math.min(40, (now - s.t) / 864e5 * 15);
    return p;
  };
  return shuffle(ws.map(w => [pr(w), w]).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]));
}
function kindFor(w, style) {
  if (style !== 'auto') return style;
  const s = st(w.id);
  if (!s.t) return 'card';
  return s.lv < 2 ? 'mc' : 'type';
}
function startSession(o) {
  const n = o.n || o.ids.length;
  const ws = pick(o.ids, n, o.order);
  if (!ws.length) return toast('出題できる単語がありません');
  Q = { o, items: ws.map(w => ({ w, kind: o.test ? 'type' : kindFor(w, o.style) })), i: 0, sec: 0, test: !!o.test };
  closeSheet();
  $('#ov').hidden = false; document.body.classList.add('lock');
  renderQ();
}
const quick = () => startSession({ title: 'クイック10問', ids: ALL.map(w => w.id), n: 10, order: 'weak', style: 'auto', prompt: S.cfg.prompt });
const weakSession = style => startSession({ title: '苦手の復習', ids: weakWords().map(w => w.id), n: 20, order: 'weak', style, prompt: S.cfg.prompt });

function hintText(word) { return word.split('').map((ch, i) => i === 0 || ch === ' ' || ch === '-' ? ch : '_').join(' ') + `　（${word.replace(/[ -]/g, '').length}文字）`; }

function renderQ() {
  const it = Q.items[Q.i], w = it.w;
  const p = Q.o.prompt || 'syn';
  const showSyn = p !== 'ja', jaTop = p !== 'syn';
  $('#ov').innerHTML = `<div class="ov-in">
    <div class="qtop">
      <button class="x tap" data-a="quit" aria-label="やめる">${IC.x}</button>
      <div class="qprog"><i style="width:${Q.i / Q.items.length * 100}%"></i></div>
      <span class="num small bold">${Q.i + 1}/${Q.items.length}</span>
      <span class="num small muted" id="qtime">${fmtClock(Q.sec)}</span>
    </div>
    <div class="card qcard">
      <div class="qmeta"><span class="pill">${SET[w.set].name} · ${w.n}</span><span class="pill">${w.pos}</span>${w.hint ? `<span class="pill gd">${w.hint}</span>` : ''}${Q.test ? '<span class="pill ac">本番形式</span>' : `<span class="pill ac">${KIND[it.kind]}</span>`}</div>
      ${showSyn ? `<div class="qsyn"><span class="eq">(=</span> ${esc(w.syn)}<span class="eq">)</span></div>` : ''}
      ${jaTop ? `<div class="qja big">${esc(w.ja)}</div>` : ''}
      ${Q.test || it.kind === 'card' ? '' : `<div class="peeks">
        ${jaTop ? '' : '<button class="peek tap" data-a="peekja">日本語を見る</button>'}
        <button class="peek tap" data-a="hint">ヒント（頭文字）</button>
      </div>
      <div class="qja" id="qja" hidden>${esc(w.ja)}</div>
      <div class="hintv" id="hintv" hidden>${esc(hintText(w.w))}</div>`}
    </div>
    <div id="ans">${ansHTML(it)}</div>
  </div>`;
  $('#ov').scrollTop = 0;
  const ti = $('#ti'); if (ti) ti.focus();
}
function ansHTML(it) {
  if (it.kind === 'mc') {
    const others = shuffle(SET[it.w.set].words.filter(x => x.id !== it.w.id)).slice(0, 3);
    it.opts = shuffle([it.w, ...others]);
    return `<div class="opts">${it.opts.map(o => `<button class="opt tap" data-a="mc" data-id="${o.id}">${esc(o.w)}</button>`).join('')}</div>`;
  }
  if (it.kind === 'type') {
    return `<form class="tform" id="tf"><input id="ti" type="text" placeholder="英単語を入力" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"><button class="btn primary">${Q.test ? '次へ' : '答え合わせ'}</button></form>
    ${Q.test ? '' : '<div class="sub-acts"><span></span><button class="link tap small" data-a="giveup">わからない</button></div>'}`;
  }
  return `<button class="btn primary block mt16" data-a="reveal">答えを見る</button>`;
}
function wordInfo(w) {
  const s = st(w.id);
  return `<div class="fb-w"><b>${esc(w.w)}</b>${spkBtn(w.w)}<span class="pill">${w.pos}</span></div>
    <div class="fb-ja">${esc(w.ja)}</div>
    <div class="small muted mt8">(= ${esc(w.syn)})</div>
    ${s.t ? `<div class="tiny muted mt8">これまで ◯${s.c}回 ✕${s.x}回 ・ ${STATUS[status(w.id)][0]}</div>` : ''}`;
}
function answer(ok, given) {
  const it = Q.items[Q.i];
  if (it.done) return;
  it.done = true; it.ok = ok; it.given = given;
  record(it.w.id, ok, it.hinted ? 'mc' : it.kind);
  if (Q.test) return next();
  if (S.cfg.autoSpeak) speak(it.w.w);
  const near = !ok && given && lev(norm(given), it.w.w) <= 2;
  const ans = $('#ans');
  $$('.peeks', $('#ov')).forEach(e => e.remove());
  $('#qja')?.remove(); $('#hintv')?.remove();
  if (it.kind === 'type') { const ti = $('#ti'); ti.disabled = true; ti.blur(); $('#tf .btn').remove(); $('.sub-acts')?.remove(); ti.style.borderColor = ok ? 'var(--green)' : 'var(--red)'; }
  ans.insertAdjacentHTML('beforeend', `
    <div class="card fb ${ok ? '' : 'ng'}">
      <div class="fb-h">${ok ? '◯ 正解！' : '✕ ざんねん'}${near ? '<span class="small">　おしい！つづりを確認しよう</span>' : ''}</div>
      ${!ok && given ? `<div class="small muted">あなたの答え：<s>${esc(given)}</s></div>` : ''}
      ${wordInfo(it.w)}
    </div>
    <button class="btn primary block mt12" data-a="next" id="nextBtn">${Q.i + 1 < Q.items.length ? '次へ' : '結果を見る'}</button>`);
  $('#nextBtn').focus({ preventScroll: true });
  $('#nextBtn').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function next() {
  Q.i++;
  if (Q.i >= Q.items.length) return renderResult();
  renderQ();
}
function renderResult() {
  save();
  const items = Q.items.filter(i => i.done);
  const n = items.length, k = items.filter(i => i.ok).length;
  const wrong = items.filter(i => !i.ok);
  const full = n === Q.items.length;
  if (Q.test && full) { (S.tests[Q.o.setId] || (S.tests[Q.o.setId] = [])).push({ d: today(), s: k, sec: Q.sec }); save(); }
  const r = n ? k / n : 0;
  const msg = !n ? 'また今度！' : r === 1 ? 'パーフェクト！🎉' : r >= .8 ? 'いい調子！' : r >= .5 ? 'あと少し！間違えた単語を見直そう' : '苦手を中心にくり返そう';
  $('#ov').innerHTML = `<div class="ov-in">
    <div class="qtop"><button class="x tap" data-a="closeov" aria-label="閉じる">${IC.x}</button><div class="grow bold">${esc(Q.o.title)}</div></div>
    <div class="card res">
      <div class="sc num">${k}<small> / ${n}</small></div>
      <div class="msg">${msg}</div>
      <div class="small muted mt8">勉強時間 ${fmtClock(Q.sec)} ・ 進み具合 ${pct(ALL)}%${Q.test && !full ? ' ・ 途中でやめたので点数は記録していません' : ''}</div>
    </div>
    ${Q.test ? `<div class="sec-h">答案（${SET[Q.o.setId].name}）</div><div class="card sheetgrid">${Q.items.map(i => `<div class="${i.ok ? 'ok' : 'ng'}">${i.w.n}. ${i.done ? (i.ok ? `<b>◯</b> ${esc(i.w.w)}` : `<b>✕</b> ${i.given ? `<s>${esc(i.given)}</s> → ` : ''}${esc(i.w.w)}`) : `<span class="muted">${esc(i.w.w)}</span>`}</div>`).join('')}</div>` : ''}
    ${wrong.length ? `<div class="sec-h">間違えた単語（${wrong.length}）</div><div class="card list wl">${wrong.map(i => wordRow(i.w, !Q.test)).join('')}</div>` : ''}
    <div class="mt16">
      ${wrong.length ? `<button class="btn primary block" data-a="retrywrong">間違えた${wrong.length}語をもう一度</button>` : ''}
      <button class="btn ${wrong.length ? 'soft' : 'primary'} block mt8" data-a="again">${Q.test ? 'もう一度テスト' : '続けてもう1セット'}</button>
      <button class="btn gray block mt8" data-a="closeov">ホームへ</button>
    </div>
  </div>`;
  $('#ov').scrollTop = 0;
}
function closeOv() {
  save();
  Q = null;
  $('#ov').hidden = true; $('#ov').innerHTML = '';
  document.body.classList.remove('lock');
  render();
}

/* ---------- 操作 ---------- */
document.addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]');
  if (tb && !e.target.closest('[data-a]')) { tab = tb.dataset.tab; render(); scrollTo(0, 0); return; }
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a;
  const it = Q && Q.items[Q.i];
  switch (a) {
    case 'tab': tab = b.dataset.tab; render(); scrollTo(0, 0); break;
    case 'quick': quick(); break;
    case 'weakgo': weakWords().length ? weakSession('auto') : toast('苦手な単語はまだありません'); break;
    case 'weakmc': weakSession('mc'); break;
    case 'settings': settingsSheet(); break;
    case 'close': closeSheet(); break;
    case 'set': setSheet(b.dataset.set); break;
    case 'word':
      if (UI.hide && tab === 'words' && !b.classList.contains('show')) { b.classList.add('show'); break; }
      wordSheet(b.dataset.id); break;
    case 'star': { const s = S.w[b.dataset.id] || (S.w[b.dataset.id] = { lv: 0, c: 0, x: 0 }); s.star = !s.star; save(); wordSheet(b.dataset.id); render(); break; }
    case 'speak': e.stopPropagation(); speak(b.dataset.w); break;
    case 'hide': UI.hide = !UI.hide; render(); break;
    case 'cfg': { const k = b.dataset.k; S.cfg[k] = k === 'count' ? Number(b.dataset.v) : b.dataset.v; save(); render(); break; }
    case 'sets': S.cfg.sets = SETS.map(s => s.id).filter(id => b.dataset.v === 'all' || id[0] === b.dataset.v); save(); render(); break;
    case 'toggleset': { const id = b.dataset.set; const on = S.cfg.sets.includes(id); S.cfg.sets = on ? S.cfg.sets.filter(x => x !== id) : [...S.cfg.sets, id]; save(); render(); break; }
    case 'start': startSession({ title: '練習', ids: selIds(), n: S.cfg.count, order: S.cfg.order, style: S.cfg.style, prompt: S.cfg.prompt }); break;
    case 'settest': startSession({ title: `${SET[b.dataset.set].name} 本番形式テスト`, ids: SET[b.dataset.set].words.map(w => w.id), order: 'seq', test: true, setId: b.dataset.set, prompt: 'syn' }); break;
    case 'setpractice': startSession({ title: SET[b.dataset.set].name, ids: SET[b.dataset.set].words.map(w => w.id), n: 25, order: 'weak', style: S.cfg.style, prompt: S.cfg.prompt }); break;
    case 'setwords': UI.set = b.dataset.set; UI.q = ''; tab = 'words'; closeSheet(); render(); scrollTo(0, 0); break;
    case 'autospeak': S.cfg.autoSpeak = !S.cfg.autoSpeak; save(); b.classList.toggle('on', S.cfg.autoSpeak); break;
    case 'reset':
      if (confirm('正解・ミスの記録、勉強時間、テストの点数をすべて消します。よろしいですか？')) { const cfg = S.cfg; S = blank(); S.cfg = cfg; save(); closeSheet(); render(); toast('記録を消しました'); }
      break;
    // 出題画面
    case 'peekja': $('#qja').hidden = false; b.remove(); break;
    case 'hint': $('#hintv').hidden = false; it.hinted = true; b.remove(); break;
    case 'mc': {
      if (it.done) break;
      const ok = b.dataset.id === it.w.id;
      $$('.opt').forEach(o => { o.disabled = true; if (o.dataset.id === it.w.id) o.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      answer(ok, ok ? '' : BY[b.dataset.id].w);
      break;
    }
    case 'giveup': answer(false, ''); break;
    case 'reveal':
      if (S.cfg.autoSpeak) speak(it.w.w);
      $('#ans').innerHTML = `<div class="card fb card-ans">${wordInfo(it.w)}</div>
        <div class="row2 mt12"><button class="btn red" data-a="cardng">✕ まだ</button><button class="btn green" data-a="cardok">◯ 覚えた</button></div>`;
      break;
    case 'cardok': case 'cardng':
      if (it.done) break;
      it.done = true; it.ok = a === 'cardok';
      record(it.w.id, it.ok, 'card');
      next();
      break;
    case 'next': next(); break;
    case 'quit':
      if (!Q.items.some(i => i.done)) { closeOv(); break; }
      if (confirm('ここで終わりにしますか？（答えた分の記録は保存されています）')) renderResult();
      break;
    case 'closeov': closeOv(); break;
    case 'retrywrong': {
      const ids = Q.items.filter(i => i.done && !i.ok).map(i => i.w.id);
      startSession({ title: '間違えた単語', ids, order: 'rand', style: Q.test ? 'type' : Q.o.style, prompt: Q.o.prompt });
      break;
    }
    case 'again': startSession(Q.o); break;
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'tf') return;
  e.preventDefault();
  const it = Q.items[Q.i], v = $('#ti').value;
  if (!v.trim() && !Q.test) return $('#ti').focus();
  const ok = [it.w.w, ...it.w.alt].includes(norm(v));
  answer(ok, v.trim());
});
// 単語リストで長押し → 詳細（かくすモードのとき）
let pressT = null;
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-a="word"]');
  if (!b || !UI.hide) return;
  pressT = setTimeout(() => { pressT = 'fired'; wordSheet(b.dataset.id); }, 550);
});
document.addEventListener('pointerup', () => { if (pressT && pressT !== 'fired') clearTimeout(pressT); setTimeout(() => { pressT = null; }, 0); });
document.addEventListener('click', e => { if (pressT === 'fired') { e.stopImmediatePropagation(); pressT = null; } }, true);
$('#sheetBack').addEventListener('click', closeSheet);

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2000); }

render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
