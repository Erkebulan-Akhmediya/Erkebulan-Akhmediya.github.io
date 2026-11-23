/* Олимп-5: тренажёр к олимпиаде по математике для 5 класса */
(() => {
  "use strict";

  const KEY = "olymp5_v1";
  const GOAL_SEC = 5 * 3600;
  const app = document.getElementById("app");

  /* ---------- Состояние ---------- */
  const fresh = () => ({
    v: 1, name: "", onboarded: false, xp: 0, streak: 0, bestStreak: 0,
    probs: {}, islands: {}, badges: {}, time: 0, fixed: 0,
    blitz: { best: 0, plays: 0 },
    exam: { startedAt: null, answers: {}, submitted: false, score: null, best: null, tries: 0 },
    settings: { sound: true, unlockAll: false }
  });
  let S = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(fresh(), JSON.parse(raw));
    } catch (e) { /* приватный режим — работаем без сохранения */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pid = (tid, i) => `${tid}-${i}`;
  const topicById = id => TOPICS.find(t => t.id === id);
  const probRec = id => (S.probs[id] = S.probs[id] || { w: 0, h: 0 });
  const isResolved = id => S.probs[id] && (S.probs[id].s === "solved" || S.probs[id].s === "revealed");

  /* ---------- Ранги ---------- */
  const RANKS = [
    [0, "Новичок", "🌱"], [80, "Ученик", "📘"], [200, "Знаток", "🔍"], [350, "Мыслитель", "🧠"],
    [550, "Мастер задач", "🥋"], [800, "Олимпиец", "🏅"], [1100, "Гроссмейстер", "👑"]
  ];
  function rankOf(xp) {
    let i = 0;
    while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
    const next = RANKS[i + 1];
    return { i, title: RANKS[i][1], icon: RANKS[i][2], from: RANKS[i][0], to: next ? next[0] : null, nextTitle: next ? next[1] : null };
  }

  /* ---------- Награды ---------- */
  const BADGES = [
    { id: "first", icon: "🚀", title: "Первый шаг", desc: "Реши первую задачу" },
    { id: "streak5", icon: "🔥", title: "В ударе", desc: "5 задач подряд с первой попытки" },
    { id: "streak10", icon: "☄️", title: "Неудержимый", desc: "10 задач подряд с первой попытки" },
    { id: "perfect", icon: "💎", title: "Идеально", desc: "Пройди остров без ошибок и подсказок" },
    { id: "logic", icon: "🧠", title: "Логик", desc: "Пройди остров «Логика»" },
    { id: "half", icon: "🗺️", title: "Полпути", desc: "Пройди 5 островов" },
    { id: "all", icon: "🏝️", title: "Покоритель островов", desc: "Пройди все 10 островов" },
    { id: "hour1", icon: "⏱️", title: "Первый час", desc: "Занимайся 1 час" },
    { id: "hour5", icon: "🕔", title: "Пять часов", desc: "Полная подготовка — 5 часов" },
    { id: "blitz15", icon: "⚡", title: "Молния", desc: "Набери 15 очков в блице" },
    { id: "fix3", icon: "🔁", title: "Работа над ошибками", desc: "Исправь 3 задачи" },
    { id: "stars25", icon: "⭐", title: "Звездочёт", desc: "Собери 25 звёзд" },
    { id: "diploma", icon: "📜", title: "Призёр", desc: "Получи диплом пробной олимпиады" },
    { id: "champion", icon: "🥇", title: "Чемпион", desc: "Диплом I степени" }
  ];
  function award(id) {
    if (S.badges[id]) return;
    S.badges[id] = Date.now();
    const b = BADGES.find(x => x.id === id);
    save();
    toast(`${b.icon} Новая награда: <b>${b.title}</b>`);
    sound("badge");
  }
  const totalStars = () => TOPICS.reduce((s, t) => s + ((S.islands[t.id] && S.islands[t.id].stars) || 0), 0);
  const doneCount = () => TOPICS.filter(t => S.islands[t.id] && S.islands[t.id].done).length;
  function checkBadges() {
    if (Object.values(S.probs).some(p => p.s === "solved")) award("first");
    if (S.bestStreak >= 5) award("streak5");
    if (S.bestStreak >= 10) award("streak10");
    if (S.islands.logic && S.islands.logic.done) award("logic");
    if (doneCount() >= 5) award("half");
    if (doneCount() >= TOPICS.length) award("all");
    if (S.time >= 3600) award("hour1");
    if (S.time >= GOAL_SEC) award("hour5");
    if (S.blitz.best >= 15) award("blitz15");
    if (S.fixed >= 3) award("fix3");
    if (totalStars() >= 25) award("stars25");
    if (S.exam.best !== null && S.exam.best >= 21) award("diploma");
    if (S.exam.best !== null && S.exam.best >= 35) award("champion");
  }

  function addXP(n) {
    if (n <= 0) return;
    const before = rankOf(S.xp).i;
    S.xp += n;
    const r = rankOf(S.xp);
    if (r.i > before) {
      setTimeout(() => { toast(`${r.icon} Новое звание: <b>${r.title}</b>!`); confetti(140); sound("level"); }, 700);
    }
  }

  /* ---------- Звук, вибрация, конфетти, тосты ---------- */
  let actx = null;
  function sound(kind) {
    if (!S.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      const seq = {
        ok: [[660, 0], [880, 0.09]], bad: [[220, 0], [180, 0.12]], tap: [[520, 0]],
        level: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]], badge: [[784, 0], [988, 0.1], [1319, 0.2]],
        done: [[523, 0], [784, 0.12], [1047, 0.24]]
      }[kind] || [];
      const t0 = actx.currentTime;
      seq.forEach(([f, dt]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = kind === "bad" ? "square" : "triangle";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + dt);
        g.gain.exponentialRampToValueAtTime(kind === "tap" ? 0.05 : 0.18, t0 + dt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + (kind === "tap" ? 0.05 : 0.16));
        o.connect(g).connect(actx.destination);
        o.start(t0 + dt); o.stop(t0 + dt + 0.2);
      });
    } catch (e) { }
  }
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function confetti(n = 80) {
    if (reduceMotion) return;
    const c = document.createElement("canvas");
    c.className = "confetti";
    document.body.appendChild(c);
    const ctx = c.getContext("2d");
    const W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
    const colors = ["#6C4CF1", "#FFB020", "#22B573", "#F2545B", "#2F80ED", "#E0569B"];
    const parts = Array.from({ length: n }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
      vx: (Math.random() - 0.5) * 18 * devicePixelRatio, vy: (-Math.random() * 16 - 6) * devicePixelRatio,
      s: (6 + Math.random() * 6) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0]
    }));
    let frame = 0;
    (function tick() {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        p.vy += 0.6 * devicePixelRatio; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      });
      if (++frame < 110) requestAnimationFrame(tick); else c.remove();
    })();
  }

  function toast(html) {
    let box = document.querySelector(".toasts");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = html;
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  function modal(html, buttons) {
    const m = document.createElement("div");
    m.className = "modal-back";
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}<div class="modal-btns">${buttons.map((b, i) =>
      `<button class="btn ${b.cls || "btn-ghost"}" data-mi="${i}">${b.label}</button>`).join("")}</div></div>`;
    m.addEventListener("click", e => {
      const b = e.target.closest("[data-mi]");
      if (b) { m.remove(); const fn = buttons[+b.dataset.mi].fn; fn && fn(); }
      else if (e.target === m) m.remove();
    });
    document.body.appendChild(m);
  }

  /* ---------- Учёт времени занятий ---------- */
  let lastActive = Date.now();
  ["pointerdown", "keydown", "touchstart", "scroll"].forEach(ev =>
    addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
  setInterval(() => {
    if (document.visibilityState !== "visible" || Date.now() - lastActive > 300000) return;
    S.time++;
    if (S.time % 15 === 0) save();
    if (S.time % 60 === 0) {
      checkBadges();
      const el = document.getElementById("time-label");
      if (el) { el.textContent = fmtTime(S.time); document.getElementById("time-bar").style.width = pct(S.time, GOAL_SEC) + "%"; }
    }
  }, 1000);
  document.addEventListener("visibilitychange", save);

  const pct = (a, b) => Math.max(0, Math.min(100, Math.round(a / b * 100)));
  function fmtTime(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    return h ? `${h} ч ${String(m).padStart(2, "0")} мин` : `${m} мин`;
  }
  const plural = (n, a, b, c) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c);
  };

  /* ---------- Острова и блокировки ---------- */
  const islandDone = tid => !!(S.islands[tid] && S.islands[tid].done);
  function islandUnlocked(idx) {
    return S.settings.unlockAll || idx === 0 || islandDone(TOPICS[idx - 1].id);
  }
  const examUnlocked = () => S.settings.unlockAll || doneCount() >= TOPICS.length;
  const reviewList = () => {
    const out = [];
    TOPICS.forEach(t => t.problems.forEach((p, i) => {
      const r = S.probs[pid(t.id, i)];
      if (r && (r.s === "revealed" || (r.s === "solved" && !r.clean)) && !r.fixed) out.push({ t, p, i });
    }));
    return out;
  };

  function nextStep() {
    for (let i = 0; i < TOPICS.length; i++) {
      if (!islandDone(TOPICS[i].id)) {
        if (!islandUnlocked(i)) break;
        return { href: `#/t/${TOPICS[i].id}`, label: `Остров ${i + 1}: ${TOPICS[i].title}`, emoji: TOPICS[i].emoji };
      }
    }
    if (doneCount() >= TOPICS.length) {
      if (!S.exam.submitted) return { href: "#/exam", label: "Пробная олимпиада", emoji: "🏆" };
      if (reviewList().length) return { href: "#/review", label: "Работа над ошибками", emoji: "🔁" };
      return { href: "#/blitz", label: "Блиц-тренировка", emoji: "⚡" };
    }
    return { href: "#/t/" + TOPICS[0].id, label: "Остров 1", emoji: TOPICS[0].emoji };
  }

  /* ---------- Роутер ---------- */
  let view = { name: "" };
  let blitzTimer = null, examTimer = null;

  function route() {
    clearInterval(blitzTimer); clearInterval(examTimer);
    blitzTimer = examTimer = null;
    const h = location.hash.replace(/^#\/?/, "");
    const [a, b] = h.split("/");
    if (!S.onboarded) return renderOnboard();
    if (a === "t" && topicById(b)) return openIsland(b);
    if (a === "r" && b) return openSingle(b, "review");
    if (a === "p" && b) return openSingle(b, "practice");
    if (a === "blitz") return renderBlitzIntro();
    if (a === "review") return renderReview();
    if (a === "badges") return renderBadges();
    if (a === "exam") return renderExam();
    if (a === "settings") return renderSettings();
    if (a === "about") return renderAbout();
    renderHome();
  }
  addEventListener("hashchange", route);
  const go = href => { if (location.hash === href) route(); else location.hash = href; };

  function paint(html, cls = "") {
    app.className = cls;
    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  const topbar = (title, back = "#/", right = "") => `
    <header class="topbar">
      <a class="icon-btn" href="${back}" aria-label="Назад">←</a>
      <div class="topbar-title">${title}</div>
      <div class="topbar-right">${right}</div>
    </header>`;
  const xpChip = () => `<span class="chip chip-xp">⚡ ${S.xp}</span>`;

  /* ---------- Знакомство ---------- */
  function renderOnboard() {
    paint(`
      <section class="onboard">
        <div class="mascot big">🐆</div>
        <h1>Привет! Я Барыс.</h1>
        <p class="lead">Помогу подготовиться к олимпиаде по математике за <b>5 часов</b>. Будет интересно!</p>
        <ul class="how">
          <li><span>🏝️</span> Проходи острова — на каждом новая тема и 6 задач</li>
          <li><span>⭐</span> Решай с первой попытки — получай звёзды и очки</li>
          <li><span>🏆</span> В конце — пробная олимпиада и диплом</li>
        </ul>
        <label class="field">
          <span>Как тебя зовут?</span>
          <input id="name" maxlength="20" autocomplete="given-name" placeholder="Твоё имя" value="${esc(S.name)}">
        </label>
        <button class="btn btn-primary btn-big" data-act="start">Поехали! 🚀</button>
      </section>`, "screen-onboard");
    const inp = document.getElementById("name");
    inp.addEventListener("keydown", e => { if (e.key === "Enter") act.start(); });
  }

  /* ---------- Главная ---------- */
  function renderHome() {
    const r = rankOf(S.xp);
    const nx = nextStep();
    const rev = reviewList().length;
    const tip = TIPS[Math.floor(Date.now() / 3.6e6) % TIPS.length];
    const lessons = [
      { n: 1, items: [0, 1, 2] }, { n: 2, items: [3, 4, 5] }, { n: 3, items: [6, 7, 8] },
      { n: 4, items: [9, "review", "blitz"] }, { n: 5, items: ["exam"] }
    ];
    const node = item => {
      if (typeof item === "number") {
        const t = TOPICS[item], st = S.islands[t.id] || {}, open = islandUnlocked(item);
        const solved = t.problems.filter((_, i) => isResolved(pid(t.id, i))).length;
        const stars = st.done ? "★".repeat(st.stars) + "☆".repeat(3 - st.stars) : "☆☆☆";
        const cur = open && !st.done && nx.href === `#/t/${t.id}`;
        return `<a class="node ${st.done ? "done" : ""} ${open ? "" : "locked"} ${cur ? "current" : ""}" ${open ? `href="#/t/${t.id}"` : `data-act="locked"`} style="--c:${t.color}">
          <span class="node-dot">${open ? t.emoji : "🔒"}</span>
          <span class="node-body">
            <span class="node-kicker">Остров ${item + 1} · ≈${t.minutes} мин</span>
            <span class="node-title">${t.title}</span>
            <span class="node-meta"><span class="stars">${stars}</span>${!st.done && solved ? `<span class="muted">${solved}/6</span>` : ""}</span>
          </span>
          ${cur ? `<span class="node-go">СТАРТ</span>` : ""}
        </a>`;
      }
      if (item === "review") return `<a class="node side" href="#/review" style="--c:#8E7CC3">
          <span class="node-dot">🔁</span>
          <span class="node-body"><span class="node-kicker">≈20 мин</span><span class="node-title">Работа над ошибками</span>
          <span class="node-meta">${rev ? `<span class="pill-warn">${rev} ${plural(rev, "задача", "задачи", "задач")}</span>` : `<span class="muted">ошибок нет</span>`}</span></span></a>`;
      if (item === "blitz") return `<a class="node side" href="#/blitz" style="--c:#FFB020">
          <span class="node-dot">⚡</span>
          <span class="node-body"><span class="node-kicker">≈20 мин · раунды по 60 сек</span><span class="node-title">Блиц: устный счёт</span>
          <span class="node-meta"><span class="muted">рекорд: ${S.blitz.best}</span></span></span></a>`;
      const open = examUnlocked();
      return `<a class="node boss ${open ? "" : "locked"} ${S.exam.submitted ? "done" : ""}" ${open ? `href="#/exam"` : `data-act="lockedExam"`} style="--c:#FFB020">
          <span class="node-dot">${open ? "🏆" : "🔒"}</span>
          <span class="node-body"><span class="node-kicker">Финал · 60 мин</span><span class="node-title">Пробная олимпиада</span>
          <span class="node-meta">${S.exam.best !== null ? `<span class="muted">лучший результат: ${S.exam.best} из ${EXAM.problems.length * EXAM.points}</span>` : `<span class="muted">6 задач · диплом</span>`}</span></span></a>`;
    };
    paint(`
      <header class="hero">
        <div class="hero-top">
          <div class="avatar" aria-hidden="true">${r.icon}</div>
          <div class="hero-who">
            <div class="hello">Привет, ${esc(S.name || "олимпиец")}!</div>
            <div class="rank">${r.title}</div>
          </div>
          <a class="icon-btn light" href="#/settings" aria-label="Настройки">⚙️</a>
        </div>
        <div class="stats">
          <div class="stat"><b>⚡ ${S.xp}</b><span>очков</span></div>
          <div class="stat"><b>⭐ ${totalStars()}</b><span>из 30 звёзд</span></div>
          <div class="stat"><b>🔥 ${S.streak}</b><span>серия</span></div>
          <a class="stat" href="#/badges"><b>🏅 ${Object.keys(S.badges).length}</b><span>наград</span></a>
        </div>
        <div class="bars">
          <div class="bar-label"><span>Время подготовки</span><span><b id="time-label">${fmtTime(S.time)}</b> из 5 ч</span></div>
          <div class="bar"><i id="time-bar" style="width:${pct(S.time, GOAL_SEC)}%"></i></div>
          <div class="bar-label"><span>До звания «${r.nextTitle || r.title}»</span><span>${r.to ? `${S.xp - r.from} / ${r.to - r.from}` : "максимум!"}</span></div>
          <div class="bar bar-xp"><i style="width:${r.to ? pct(S.xp - r.from, r.to - r.from) : 100}%"></i></div>
        </div>
      </header>
      <main class="wrap">
        <a class="btn btn-primary btn-big continue" href="${nx.href}">
          <span class="continue-emoji">${nx.emoji}</span>
          <span><small>Продолжить</small>${nx.label}</span>
        </a>
        <div class="tip"><span class="mascot">🐆</span><p><b>Совет Барыса:</b> ${tip}</p></div>
        <h2 class="section-title">Карта подготовки · 5 занятий по 1 часу</h2>
        <div class="trail">
          ${lessons.map(l => `
            <div class="lesson">
              <div class="lesson-head"><span>Занятие ${l.n}</span><span class="muted">≈ 1 час</span></div>
              ${l.items.map(node).join("")}
            </div>`).join("")}
        </div>
        <p class="foot"><a href="#/about">О задачах и сайте</a> · <a href="#/badges">Награды</a> · <a href="#/settings">Настройки</a></p>
      </main>`, "screen-home");
  }

  /* ---------- Остров ---------- */
  function openIsland(tid) {
    const idx = TOPICS.findIndex(t => t.id === tid);
    if (!islandUnlocked(idx)) { go("#/"); return; }
    const t = TOPICS[idx];
    const touched = t.problems.some((_, i) => S.probs[pid(t.id, i)]);
    if (islandDone(tid)) return renderIslandSummary(t, idx);
    if (!touched) return renderTheory(t, idx);
    const i = t.problems.findIndex((_, k) => !isResolved(pid(t.id, k)));
    if (i === -1) { finishIsland(t); return renderIslandSummary(t, idx, true); }
    renderProblem({ t, idx, i, mode: "island" });
  }

  function renderTheory(t, idx) {
    view = { name: "theory", t, idx };
    paint(`
      ${topbar(`${t.emoji} ${t.title}`, "#/", xpChip())}
      <main class="wrap">
        <div class="card theory" style="--c:${t.color}">
          <div class="theory-head"><span class="mascot">🐆</span><div><small>Остров ${idx + 1}</small><h2>Шпаргалка Барыса</h2></div></div>
          ${t.theory}
          <div class="example"><b>Пример.</b> ${t.example}</div>
        </div>
        <button class="btn btn-primary btn-big" data-act="toProblems">Понятно, к задачам! →</button>
      </main>`, "screen-island");
  }

  function dots(t, cur) {
    return `<div class="dots">${t.problems.map((_, i) => {
      const r = S.probs[pid(t.id, i)];
      const cls = r && r.s === "solved" ? (r.clean ? "ok" : "ok2") : r && r.s === "revealed" ? "seen" : "";
      return `<span class="dot ${cls} ${i === cur ? "cur" : ""}"></span>`;
    }).join("")}</div>`;
  }

  function keypad(okLabel = "✓") {
    return `<div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-act="key" data-k="${n}">${n}</button>`).join("")}
      <button data-act="key" data-k="back" class="k-fn" aria-label="Стереть">⌫</button>
      <button data-act="key" data-k="0">0</button>
      <button data-act="key" data-k="ok" class="k-ok">${okLabel}</button></div>`;
  }

  function answerArea(p, selected, input) {
    if (p.type === "choice") {
      return `<div class="choices">${p.options.map((o, k) =>
        `<button class="choice ${selected === k ? "sel" : ""}" data-act="choose" data-k="${k}"><span class="letter">${"АБВГДЕЖ"[k]}</span>${o}</button>`).join("")}</div>
        <button class="btn btn-primary btn-big" data-act="check" ${selected === null ? "disabled" : ""}>Проверить</button>`;
    }
    return `<div class="answer-box" aria-live="polite"><span class="ans-label">Ответ:</span><span class="ans-val ${input ? "" : "empty"}">${input || "?"}</span></div>${keypad()}`;
  }

  const diff = d => `<span class="diff" title="Сложность">${"★".repeat(d)}${"☆".repeat(3 - d)}</span>`;

  function renderProblem(v) {
    const { t, idx, i, mode } = v;
    const p = t.problems[i];
    const id = pid(t.id, i);
    const rec = S.probs[id] || { w: 0, h: 0 };
    view = Object.assign({ name: "problem", input: "", selected: null, result: null, showSol: false, wrongMsg: "" }, v, { p, id });
    const hintsShown = mode === "island" ? (rec.h || 0) : (view.hintsShown || 0);
    view.hintsShown = hintsShown;
    const back = mode === "island" ? "#/" : mode === "review" ? "#/review" : `#/t/${t.id}`;
    const head = mode === "island" ? dots(t, i) : `<div class="mode-tag">${mode === "review" ? "🔁 Работа над ошибками · +5 ⚡" : "👀 Повторение · без очков"}</div>`;
    paint(`
      ${topbar(`${t.emoji} ${t.title}`, back, xpChip())}
      <main class="wrap problem-wrap">
        ${head}
        <div class="card problem" style="--c:${t.color}">
          <div class="problem-top"><span>Задача ${i + 1} из ${t.problems.length}</span>${diff(p.d)}</div>
          <div class="problem-text">${p.text}</div>
          ${p.svg ? `<div class="figure">${p.svg}</div>` : ""}
          <div id="hints">${p.hints.slice(0, hintsShown).map((h, k) => `<div class="hint"><b>💡 Подсказка ${k + 1}.</b> ${h}</div>`).join("")}</div>
          <div id="solution"></div>
        </div>
        <div id="answer">${answerArea(p, null, "")}</div>
        <div class="wrong-msg" id="wrong-msg" aria-live="assertive"></div>
        <div class="helpers">
          <button class="btn btn-ghost ${rec.w >= 2 && hintsShown < p.hints.length ? "pulse" : ""}" data-act="hint" ${hintsShown >= p.hints.length ? "disabled" : ""}>💡 Подсказка${mode === "island" ? " <small>−3</small>" : ""}</button>
          <button class="btn btn-ghost" data-act="reveal">📖 Решение</button>
        </div>
        <button class="link-btn" data-act="showTheory">📘 Открыть шпаргалку</button>
      </main>
      <div id="sheet"></div>`, "screen-problem");
  }

  function updateAnswer() {
    const el = document.querySelector(".ans-val");
    if (el) { el.textContent = view.input || "?"; el.classList.toggle("empty", !view.input); }
  }

  function check() {
    const v = view, p = v.p;
    if (v.result) return;
    let ok;
    if (p.type === "choice") { if (v.selected === null) return; ok = v.selected === p.answer; }
    else { if (!v.input) return; ok = parseInt(v.input, 10) === p.answer; }
    if (ok) onCorrect(); else onWrong();
  }

  function onWrong() {
    const v = view;
    sound("bad"); buzz(120);
    if (v.mode === "island") {
      const rec = probRec(v.id);
      rec.w = (rec.w || 0) + 1;
      S.streak = 0;
      save();
      if (rec.w >= 2) document.querySelector('[data-act="hint"]:not([disabled])')?.classList.add("pulse");
    }
    const msgs = ["Не совсем. Попробуй ещё раз!", "Почти! Подумай ещё 🙂", "Не сдавайся! Подсказка поможет 💡", "Проверь вычисления ещё раз."];
    const m = document.getElementById("wrong-msg");
    m.textContent = msgs[Math.floor(Math.random() * msgs.length)];
    shake(document.querySelector(".answer-box, .choices"));
    if (v.p.type === "num") { v.input = ""; updateAnswer(); }
    else { v.selected = null; document.querySelectorAll(".choice").forEach(b => b.classList.remove("sel")); document.querySelector('[data-act="check"]').disabled = true; }
  }

  function onCorrect() {
    const v = view;
    let gained = 0, bonus = "";
    if (v.mode === "island") {
      const rec = probRec(v.id);
      rec.s = "solved";
      rec.clean = !rec.w && !rec.h;
      gained = Math.max(2, 10 - 2 * (rec.w || 0) - 3 * (rec.h || 0));
      rec.xp = gained;
      if (rec.clean) {
        S.streak++;
        S.bestStreak = Math.max(S.bestStreak, S.streak);
        if (S.streak % 3 === 0) { gained += 5; bonus = `<div class="bonus">🔥 Серия ${S.streak}! +5 ⚡</div>`; }
      } else S.streak = 0;
      addXP(gained);
      if (nextUnresolved() === -1) finishIsland(v.t);
    } else if (v.mode === "review") {
      const rec = probRec(v.id);
      if (!rec.fixed) { rec.fixed = true; S.fixed++; gained = 5; addXP(5); }
    }
    save();
    sound("ok"); confetti(60);
    v.result = "ok";
    const praise = ["Отлично!", "Верно!", "Супер!", "Так держать!", "Блестяще!", "Ты молодец!"][Math.floor(Math.random() * 6)];
    document.getElementById("answer").innerHTML = `<div class="answer-done">✅ Ответ: <b>${answerText(v.p)}</b></div>`;
    document.querySelector(".helpers").remove();
    document.getElementById("wrong-msg").textContent = "";
    refreshHeader();
    showSheet("ok", `<div class="sheet-title">🎉 ${praise}${gained ? ` <span class="gain">+${gained} ⚡</span>` : ""}</div>${bonus}`);
    checkBadges();
  }

  const answerText = p => p.type === "choice" ? p.options[p.answer] : p.answer;

  function refreshHeader() {
    const chip = document.querySelector(".chip-xp");
    if (chip) chip.textContent = `⚡ ${S.xp}`;
    const d = document.querySelector(".dots");
    if (d && view.mode === "island") d.outerHTML = dots(view.t, view.i);
  }
  function shake(el) {
    if (!el) return;
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    setTimeout(() => el.classList.remove("shake"), 450);
  }

  function showSheet(kind, html) {
    const v = view;
    const nextLabel = v.mode === "island" ? (nextUnresolved() === -1 ? "Итоги острова 🏁" : "Дальше →") : "Готово";
    document.getElementById("sheet").innerHTML = `
      <div class="sheet ${kind}">
        ${html}
        <div class="sheet-btns">
          <button class="btn btn-ghost" data-act="toggleSol">${document.getElementById("solution").innerHTML ? "🙈 Скрыть" : "📖 Решение"}</button>
          <button class="btn ${kind === "ok" ? "btn-success" : "btn-primary"}" data-act="next">${nextLabel}</button>
        </div>
      </div>`;
    document.querySelector(".problem-wrap").classList.add("with-sheet");
  }

  function nextUnresolved() {
    const t = view.t;
    for (let k = 1; k <= t.problems.length; k++) {
      const j = (view.i + k) % t.problems.length;
      if (!isResolved(pid(t.id, j))) return j;
    }
    return -1;
  }

  function showSolution() {
    const el = document.getElementById("solution");
    const btn = document.querySelector('[data-act="toggleSol"]');
    if (el.innerHTML) { el.innerHTML = ""; if (btn) btn.textContent = "📖 Решение"; return; }
    if (btn) btn.textContent = "🙈 Скрыть";
    el.innerHTML = `<div class="solution"><b>📖 Решение.</b> ${view.p.solution}<div class="sol-ans">Ответ: <b>${answerText(view.p)}</b></div></div>`;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }

  function finishIsland(t) {
    if (islandDone(t.id)) return;
    const pts = t.problems.reduce((s, _, i) => s + ((S.probs[pid(t.id, i)] || {}).xp || 0), 0);
    const stars = pts >= 54 ? 3 : pts >= 40 ? 2 : 1;
    const perfect = t.problems.every((_, i) => (S.probs[pid(t.id, i)] || {}).clean);
    S.islands[t.id] = { done: true, stars, pts, perfect };
    addXP(stars * 5);
    if (perfect) award("perfect");
    save();
    checkBadges();
  }

  function renderIslandSummary(t, idx, isNew) {
    const st = S.islands[t.id];
    if (isNew) setTimeout(() => { sound("done"); confetti(160); }, 150);
    const next = TOPICS[idx + 1];
    const lines = ["Хорошее начало! Загляни в «Работу над ошибками».", "Здорово! Ещё немного — и будет 3 звезды.", "Великолепно! Ты настоящий олимпиец!"];
    paint(`
      ${topbar(`${t.emoji} ${t.title}`, "#/", xpChip())}
      <main class="wrap">
        <div class="card summary" style="--c:${t.color}">
          <div class="mascot big">🐆</div>
          <h2>${isNew ? "Остров пройден!" : `Остров ${idx + 1} пройден`}</h2>
          <div class="big-stars">${[1, 2, 3].map(k => `<span class="${k <= st.stars ? "on" : ""}" style="animation-delay:${k * 0.25}s">★</span>`).join("")}</div>
          <p>${lines[st.stars - 1]}</p>
          <p class="muted">Очки за задачи: ${st.pts} из 60 · бонус за звёзды: +${st.stars * 5} ⚡</p>
        </div>
        ${next ? `<a class="btn btn-primary btn-big" href="#/t/${next.id}">Следующий остров: ${next.emoji} ${next.title} →</a>`
        : `<a class="btn btn-primary btn-big" href="#/">На карту → Финал близко! 🏆</a>`}
        <h3 class="section-title">Задачи острова</h3>
        <div class="plist">
          ${t.problems.map((p, i) => {
            const r = S.probs[pid(t.id, i)] || {};
            const icon = r.s === "solved" ? (r.clean ? "✅" : "☑️") : "👀";
            return `<a class="pitem" href="#/p/${pid(t.id, i)}"><span>${icon}</span><span class="ptext">${i + 1}. ${strip(p.text)}</span><span class="muted">${r.xp || 0} ⚡</span></a>`;
          }).join("")}
        </div>
        <button class="btn btn-ghost btn-wide" data-act="showTheoryFor" data-t="${t.id}">📘 Шпаргалка острова</button>
        <a class="btn btn-ghost btn-wide" href="#/">← На карту</a>
      </main>`, "screen-island");
  }
  const strip = html => { const d = document.createElement("div"); d.innerHTML = html; const s = d.textContent; return s.length > 70 ? s.slice(0, 68) + "…" : s; };

  function openSingle(id, mode) {
    const [tid, si] = id.split("-");
    const t = topicById(tid), i = +si;
    if (!t || !t.problems[i]) return go("#/");
    renderProblem({ t, idx: TOPICS.indexOf(t), i, mode });
  }

  /* ---------- Работа над ошибками ---------- */
  function renderReview() {
    const list = reviewList();
    paint(`
      ${topbar("🔁 Работа над ошибками", "#/", xpChip())}
      <main class="wrap">
        <div class="tip"><span class="mascot">🐆</span><p>Здесь задачи, где были ошибки, подсказки или подсмотренное решение. Реши каждую заново — и получи <b>+5 ⚡</b> за каждую!</p></div>
        ${list.length ? `<div class="plist">${list.map(({ t, p, i }) =>
          `<a class="pitem" href="#/r/${pid(t.id, i)}" style="--c:${t.color}"><span>${t.emoji}</span><span class="ptext">${strip(p.text)}</span><span class="chev">›</span></a>`).join("")}</div>`
        : `<div class="card empty"><div class="mascot big">🎯</div><h3>Ошибок нет!</h3><p class="muted">${Object.keys(S.probs).length ? "Ты всё исправил(а). Так держать!" : "Сначала пройди пару островов — сюда попадут задачи, которые стоит повторить."}</p></div>`}
        <p class="muted center">Исправлено задач: ${S.fixed}</p>
      </main>`, "screen-review");
  }

  /* ---------- Награды ---------- */
  function renderBadges() {
    const r = rankOf(S.xp);
    paint(`
      ${topbar("🏅 Награды", "#/", xpChip())}
      <main class="wrap">
        <div class="card rank-card">
          <div class="avatar xl">${r.icon}</div>
          <div><small class="muted">Твоё звание</small><h2>${r.title}</h2>
          <p class="muted">${r.to ? `До «${r.nextTitle}» — ещё ${r.to - S.xp} ⚡` : "Ты достиг(ла) вершины!"}</p></div>
        </div>
        <div class="badges">${BADGES.map(b => `
          <div class="badge ${S.badges[b.id] ? "got" : ""}">
            <div class="b-icon">${S.badges[b.id] ? b.icon : "🔒"}</div>
            <div class="b-title">${b.title}</div>
            <div class="b-desc">${b.desc}</div>
          </div>`).join("")}</div>
        <h3 class="section-title">Звания</h3>
        <div class="ranks">${RANKS.map(([xp, t, ic], k) => `<div class="rank-row ${k <= r.i ? "got" : ""}"><span>${ic}</span><b>${t}</b><span class="muted">${xp} ⚡</span></div>`).join("")}</div>
      </main>`, "screen-badges");
  }

  /* ---------- Блиц ---------- */
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function blitzQ() {
    const k = rnd(0, 7);
    let a, b;
    switch (k) {
      case 0: a = rnd(12, 89); b = rnd(12, 89); return { q: `${a} + ${b}`, a: a + b };
      case 1: a = rnd(40, 150); b = rnd(11, a - 5); return { q: `${a} − ${b}`, a: a - b };
      case 2: a = rnd(3, 9); b = rnd(3, 12); return { q: `${a} · ${b}`, a: a * b };
      case 3: b = rnd(2, 9); a = rnd(2, 12); return { q: `${a * b} : ${b}`, a };
      case 4: a = rnd(11, 19); b = rnd(2, 6); return { q: `${a} · ${b}`, a: a * b };
      case 5: a = rnd(2, 9) * 25; return { q: `${a} · 4`, a: a * 4 };
      case 6: a = rnd(101, 999); return { q: `${a} + 99`, a: a + 99 };
      default: a = rnd(2, 40) * 2; return { q: `Половина от ${a}`, a: a / 2 };
    }
  }
  function renderBlitzIntro(last) {
    view = { name: "blitzIntro" };
    paint(`
      ${topbar("⚡ Блиц", "#/", xpChip())}
      <main class="wrap">
        <div class="card center blitz-intro">
          <div class="mascot big">⚡</div>
          ${last ? `<h2>Результат: ${last.score}</h2>
            <p>${last.record ? "🎉 Новый рекорд!" : `Рекорд: ${S.blitz.best}`}</p>
            <p class="muted">Ошибок: ${last.miss} · получено +${Math.min(last.score, 30)} ⚡</p>`
          : `<h2>60 секунд устного счёта</h2>
            <p>Решай примеры как можно быстрее. Правильный ответ засчитывается сразу, как только ты его наберёшь.</p>
            <p class="muted">Рекорд: ${S.blitz.best} · сыграно раундов: ${S.blitz.plays}</p>`}
        </div>
        <button class="btn btn-primary btn-big" data-act="blitzStart">${last ? "Ещё раунд! 🔄" : "Старт! ⚡"}</button>
        <a class="btn btn-ghost btn-wide" href="#/">← На карту</a>
      </main>`, "screen-blitz");
  }
  function startBlitz() {
    view = { name: "blitz", score: 0, miss: 0, input: "", q: blitzQ(), ends: Date.now() + 60000 };
    paint(`
      ${topbar("⚡ Блиц", "#/blitz", `<span class="chip">🎯 <b id="bscore">0</b></span>`)}
      <main class="wrap blitz">
        <div class="timer-bar"><i id="btime"></i></div>
        <div class="blitz-q" id="bq">${view.q.q} = ?</div>
        <div class="answer-box"><span class="ans-val empty">?</span></div>
        ${keypad("✓")}
      </main>`, "screen-blitz");
    blitzTimer = setInterval(() => {
      const left = view.ends - Date.now();
      const el = document.getElementById("btime");
      if (el) el.style.width = pct(left, 60000) + "%";
      if (left <= 0) endBlitz();
    }, 200);
  }
  function blitzKey(k) {
    const v = view;
    if (k === "back") v.input = v.input.slice(0, -1);
    else if (k === "ok") { if (v.input) blitzJudge(parseInt(v.input, 10) === v.q.a); return; }
    else if (v.input.length < 5) v.input += k;
    updateAnswer();
    if (v.input && parseInt(v.input, 10) === v.q.a) blitzJudge(true);
    else if (v.input.length >= String(v.q.a).length) blitzJudge(false);
  }
  function blitzJudge(ok) {
    const v = view;
    if (ok) { v.score++; sound("tap"); } else { v.miss++; sound("bad"); buzz(60); shake(document.querySelector(".answer-box")); }
    v.q = blitzQ(); v.input = "";
    document.getElementById("bq").textContent = `${v.q.q} = ?`;
    document.getElementById("bscore").textContent = v.score;
    updateAnswer();
  }
  function endBlitz() {
    clearInterval(blitzTimer); blitzTimer = null;
    const last = { score: view.score, miss: view.miss, record: view.score > S.blitz.best };
    S.blitz.plays++;
    const record = last.record;
    S.blitz.best = Math.max(S.blitz.best, last.score);
    addXP(Math.min(last.score, 30));
    save(); checkBadges();
    if (record) { confetti(120); sound("level"); } else sound("done");
    renderBlitzIntro(last);
  }

  /* ---------- Пробная олимпиада ---------- */
  const examMax = () => EXAM.problems.length * EXAM.points;
  function renderExam() {
    if (!examUnlocked()) return go("#/");
    const E = S.exam;
    if (E.submitted) return renderExamResult();
    if (!E.startedAt) {
      view = { name: "examIntro" };
      return paint(`
        ${topbar("🏆 Пробная олимпиада", "#/", xpChip())}
        <main class="wrap">
          <div class="card exam-intro">
            <div class="mascot big">🏆</div>
            <h2>Пробная олимпиада</h2>
            <ul class="rules">
              <li>⏱ <b>60 минут</b> на 6 задач — как на настоящей олимпиаде</li>
              <li>🚫 Подсказок нет, решения — только после сдачи</li>
              <li>✍️ Ответ можно менять сколько угодно до сдачи работы</li>
              <li>🎯 Каждая задача — <b>7 баллов</b>, максимум ${examMax()}</li>
              <li>📜 21+ баллов — диплом III степени, 28+ — II, 35+ — I степени</li>
            </ul>
            <p class="muted">Совет: держи рядом листок и ручку для черновика.</p>
          </div>
          <button class="btn btn-primary btn-big" data-act="examStart">Начать олимпиаду ⏱</button>
          <a class="btn btn-ghost btn-wide" href="#/">← На карту</a>
        </main>`, "screen-exam");
    }
    renderExamTask(view.name === "exam" ? view.i : 0);
  }

  function examLeft() { return S.exam.startedAt + EXAM.minutes * 60000 - Date.now(); }
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

  function renderExamTask(i) {
    clearInterval(examTimer);
    const p = EXAM.problems[i];
    const ans = S.exam.answers[i];
    view = { name: "exam", i, p, input: p.type === "num" && ans !== undefined ? String(ans) : "", selected: p.type === "choice" && ans !== undefined ? ans : null };
    paint(`
      <header class="topbar exam-bar">
        <a class="icon-btn" href="#/" aria-label="На карту">←</a>
        <div class="topbar-title">⏱ <b id="etime">${mmss(examLeft())}</b></div>
        <div class="topbar-right"><button class="btn btn-small btn-success" data-act="examSubmit">Сдать</button></div>
      </header>
      <main class="wrap problem-wrap">
        <div class="etabs">${EXAM.problems.map((_, k) => `<button class="etab ${k === i ? "cur" : ""} ${S.exam.answers[k] !== undefined ? "has" : ""}" data-act="examGo" data-k="${k}">${k + 1}</button>`).join("")}</div>
        <div class="card problem" style="--c:#FFB020">
          <div class="problem-top"><span>Задача ${i + 1} из ${EXAM.problems.length}</span><span class="muted">7 баллов</span></div>
          <div class="problem-text">${p.text}</div>
          ${p.svg ? `<div class="figure">${p.svg}</div>` : ""}
        </div>
        ${p.type === "choice"
          ? `<div class="choices">${p.options.map((o, k) => `<button class="choice ${view.selected === k ? "sel" : ""}" data-act="examChoose" data-k="${k}"><span class="letter">${"АБВГД"[k]}</span>${o}</button>`).join("")}</div>`
          : `<div class="answer-box"><span class="ans-label">Ответ:</span><span class="ans-val ${view.input ? "" : "empty"}">${view.input || "?"}</span></div>${keypad("→")}`}
        <div class="exam-nav">
          <button class="btn btn-ghost" data-act="examGo" data-k="${i - 1}" ${i === 0 ? "disabled" : ""}>← Назад</button>
          <button class="btn btn-ghost" data-act="examGo" data-k="${i + 1}" ${i === EXAM.problems.length - 1 ? "disabled" : ""}>Вперёд →</button>
        </div>
      </main>`, "screen-exam");
    examTimer = setInterval(() => {
      const left = examLeft();
      const el = document.getElementById("etime");
      if (el) { el.textContent = mmss(left); el.parentElement.classList.toggle("hurry", left < 5 * 60000); }
      if (left <= 0) { clearInterval(examTimer); submitExam(true); }
    }, 500);
  }

  function submitExam(auto) {
    const E = S.exam;
    let score = 0;
    EXAM.problems.forEach((p, k) => { if (E.answers[k] !== undefined && +E.answers[k] === p.answer) score += EXAM.points; });
    E.submitted = true; E.score = score; E.tries++;
    const first = E.best === null;
    E.best = Math.max(E.best || 0, score);
    if (first) addXP(score * 2);
    save(); checkBadges();
    if (auto) toast("⏱ Время вышло — работа сдана автоматически");
    if (score >= 21) { confetti(200); sound("level"); } else sound("done");
    go("#/exam");
  }

  function diplomaFor(score) {
    if (score >= 35) return { deg: "I степени", cls: "gold", icon: "🥇" };
    if (score >= 28) return { deg: "II степени", cls: "silver", icon: "🥈" };
    if (score >= 21) return { deg: "III степени", cls: "bronze", icon: "🥉" };
    return null;
  }

  function renderExamResult() {
    const E = S.exam, d = diplomaFor(E.score);
    const date = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    view = { name: "examResult" };
    paint(`
      ${topbar("🏆 Итоги олимпиады", "#/", xpChip())}
      <main class="wrap">
        <div class="diploma ${d ? d.cls : "plain"}">
          <div class="d-icon">${d ? d.icon : "🎖️"}</div>
          <div class="d-kind">${d ? "Диплом" : "Сертификат участника"}</div>
          ${d ? `<div class="d-deg">${d.deg}</div>` : ""}
          <div class="d-text">награждается</div>
          <div class="d-name">${esc(S.name || "Олимпиец")}</div>
          <div class="d-text">за ${d ? "успешное" : "участие в"} решени${d ? "е" : "и"} пробной олимпиады по математике для 5 класса</div>
          <div class="d-score">${E.score} из ${examMax()} баллов</div>
          <div class="d-foot">${date} · тренажёр «Олимп-5» 🐆</div>
        </div>
        <p class="center muted">${d ? "Поздравляем! Сделай скриншот диплома 📸" : "Нужно 21 балл для диплома. Повтори темы — и попробуй снова!"}${E.tries > 1 ? ` · Лучший результат: ${E.best}` : ""}</p>
        <h3 class="section-title">Разбор задач</h3>
        ${EXAM.problems.map((p, k) => {
          const a = E.answers[k], ok = a !== undefined && +a === p.answer;
          const shown = a === undefined ? "—" : p.type === "choice" ? p.options[a] : a;
          return `<details class="card review-item ${ok ? "ok" : "bad"}">
            <summary><span>${ok ? "✅" : "❌"} Задача ${k + 1}</span><span>${ok ? "+7" : "0"}</span></summary>
            <div class="problem-text">${p.text}</div>
            ${p.svg ? `<div class="figure">${p.svg}</div>` : ""}
            <p>Твой ответ: <b>${shown}</b> · Правильный: <b>${answerText(p)}</b></p>
            <div class="solution"><b>📖 Решение.</b> ${p.solution}</div>
          </details>`;
        }).join("")}
        <button class="btn btn-ghost btn-wide" data-act="examRetry">🔄 Пройти ещё раз</button>
        <a class="btn btn-primary btn-big" href="#/">На карту</a>
      </main>`, "screen-exam");
  }

  /* ---------- Настройки и «О сайте» ---------- */
  function renderSettings() {
    paint(`
      ${topbar("⚙️ Настройки", "#/")}
      <main class="wrap">
        <div class="card">
          <label class="field"><span>Имя (для приветствия и диплома)</span>
            <input id="sname" maxlength="20" value="${esc(S.name)}" placeholder="Твоё имя"></label>
          <button class="btn btn-primary btn-wide" data-act="saveName">Сохранить имя</button>
        </div>
        <div class="card">
          <label class="toggle"><input type="checkbox" data-act="toggleSound" ${S.settings.sound ? "checked" : ""}><span>🔊 Звуки</span></label>
          <label class="toggle"><input type="checkbox" data-act="toggleUnlock" ${S.settings.unlockAll ? "checked" : ""}><span>🔓 Открыть все острова и олимпиаду<br><small class="muted">для родителей и учителей</small></span></label>
        </div>
        <div class="card">
          <p class="muted">Прогресс хранится только на этом устройстве, в этом браузере.</p>
          <button class="btn btn-danger btn-wide" data-act="reset">Сбросить весь прогресс</button>
        </div>
      </main>`, "screen-settings");
  }

  function renderAbout() {
    paint(`
      ${topbar("ℹ️ О задачах", "#/")}
      <main class="wrap">
        <div class="card about">
          <h2>Что это за тренажёр</h2>
          <p>«Олимп-5» — бесплатный тренажёр для подготовки ученика 5 класса к городской олимпиаде по математике. Подготовка рассчитана на <b>5 часов</b>: 10 тематических островов (≈20 минут каждый), работа над ошибками, блиц и пробная олимпиада на 60 минут.</p>
          <h3>Откуда задачи</h3>
          <p>Темы и формат взяты из городских и областных олимпиад для 5–6 классов в Казахстане: логика, чётность, ребусы, принцип Дирихле, делимость, комбинаторика, геометрия, задачи на смекалку.</p>
          <p>Официальные варианты городской олимпиады Павлодара за прошлые годы в открытом доступе не опубликованы, поэтому здесь <b>тренировочные задачи того же типа</b>: классические олимпиадные сюжеты, переработанные для 5 класса. Это не задания с реальных туров. Все ответы проверены программой.</p>
          <p>Если у вас есть задания прошлых лет (их выдают в школе или в центре «Павлодар дарыны»), их можно добавить в файл <code>js/data.js</code>.</p>
          <h3>Как заниматься</h3>
          <ul>
            <li>5 занятий по 1 часу, лучше в разные дни.</li>
            <li>Держи рядом черновик и ручку.</li>
            <li>Сначала думай сам(а), подсказку бери после 2–3 минут раздумий.</li>
            <li>Работает на телефоне без интернета после первого открытия. Можно добавить на главный экран: в меню браузера выбери «Добавить на главный экран».</li>
          </ul>
        </div>
      </main>`, "screen-about");
  }

  /* ---------- Обработчики ---------- */
  const act = {
    start() {
      const n = (document.getElementById("name").value || "").trim().slice(0, 20);
      S.name = n; S.onboarded = true; save(); sound("done");
      go("#/");
    },
    locked() { toast("🔒 Сначала пройди предыдущий остров"); buzz(40); },
    lockedExam() { toast("🔒 Олимпиада откроется после всех 10 островов"); buzz(40); },
    toProblems() { const t = view.t; renderProblem({ t, idx: view.idx, i: 0, mode: "island" }); },
    showTheory() {
      const t = view.t;
      modal(`<h3>${t.emoji} Шпаргалка: ${t.title}</h3><div class="theory-modal">${t.theory}<div class="example"><b>Пример.</b> ${t.example}</div></div>`, [{ label: "Закрыть", cls: "btn-primary" }]);
    },
    showTheoryFor(el) {
      const t = topicById(el.dataset.t);
      modal(`<h3>${t.emoji} Шпаргалка: ${t.title}</h3><div class="theory-modal">${t.theory}<div class="example"><b>Пример.</b> ${t.example}</div></div>`, [{ label: "Закрыть", cls: "btn-primary" }]);
    },
    key(el) {
      const k = el.dataset.k;
      if (view.name === "blitz") return blitzKey(k);
      if (view.name === "exam") {
        if (k === "ok") { if (view.i < EXAM.problems.length - 1) renderExamTask(view.i + 1); return; }
        examInput(k); return;
      }
      if (view.name !== "problem" || view.result) return;
      if (k === "ok") return check();
      if (k === "back") view.input = view.input.slice(0, -1);
      else if (view.input.length < 6) view.input = (view.input === "0" ? "" : view.input) + k;
      document.getElementById("wrong-msg").textContent = "";
      updateAnswer();
    },
    choose(el) {
      if (view.result) return;
      view.selected = +el.dataset.k;
      document.querySelectorAll(".choice").forEach(b => b.classList.toggle("sel", b === el));
      document.querySelector('[data-act="check"]').disabled = false;
      document.getElementById("wrong-msg").textContent = "";
      sound("tap");
    },
    check,
    hint() {
      const v = view, p = v.p;
      if (v.hintsShown >= p.hints.length) return;
      v.hintsShown++;
      if (v.mode === "island" && !isResolved(v.id)) { const rec = probRec(v.id); rec.h = v.hintsShown; S.streak = 0; save(); }
      document.getElementById("hints").innerHTML = p.hints.slice(0, v.hintsShown).map((h, k) => `<div class="hint"><b>💡 Подсказка ${k + 1}.</b> ${h}</div>`).join("");
      const btn = document.querySelector('[data-act="hint"]');
      btn.classList.remove("pulse");
      if (v.hintsShown >= p.hints.length) btn.disabled = true;
      document.getElementById("hints").lastElementChild.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    },
    reveal() {
      const v = view;
      const doReveal = () => {
        if (v.mode === "island") {
          const rec = probRec(v.id); rec.s = "revealed"; rec.xp = 0; rec.clean = false; S.streak = 0; save();
          if (nextUnresolved() === -1) finishIsland(v.t);
        }
        v.result = "seen";
        document.getElementById("answer").innerHTML = `<div class="answer-done seen">👀 Ответ: <b>${answerText(v.p)}</b></div>`;
        document.querySelector(".helpers").remove();
        document.getElementById("wrong-msg").textContent = "";
        showSolution();
        refreshHeader();
        showSheet("seen", `<div class="sheet-title">Разберись в решении 🧐</div><p class="sheet-sub">${v.mode === "island" ? "Эта задача попадёт в «Работу над ошибками» — вернись к ней позже!" : "Попробуй потом решить её ещё раз."}</p>`);
      };
      if (v.mode === "practice") return doReveal();
      modal(`<h3>Показать решение?</h3><p>${v.mode === "island" ? "За эту задачу не будет очков. Может, сначала возьмёшь подсказку? 💡" : "Очки за исправление не начислятся."}</p>`,
        [{ label: "Ещё подумаю" }, { label: "Показать", cls: "btn-primary", fn: doReveal }]);
    },
    toggleSol: showSolution,
    next() {
      const v = view;
      document.querySelector(".problem-wrap")?.classList.remove("with-sheet");
      if (v.mode === "review") return go("#/review");
      if (v.mode === "practice") return go(`#/t/${v.t.id}`);
      const j = nextUnresolved();
      if (j === -1) { finishIsland(v.t); renderIslandSummary(v.t, v.idx, true); }
      else renderProblem({ t: v.t, idx: v.idx, i: j, mode: "island" });
    },
    blitzStart: startBlitz,
    examStart() { S.exam.startedAt = Date.now(); S.exam.answers = {}; save(); renderExamTask(0); },
    examGo(el) { const k = +el.dataset.k; if (k >= 0 && k < EXAM.problems.length) { clearInterval(examTimer); renderExamTask(k); } },
    examChoose(el) {
      const k = +el.dataset.k;
      S.exam.answers[view.i] = k; save(); sound("tap");
      document.querySelectorAll(".choice").forEach(b => b.classList.toggle("sel", b === el));
      document.querySelectorAll(".etab")[view.i].classList.add("has");
    },
    examSubmit() {
      const empty = EXAM.problems.length - Object.keys(S.exam.answers).length;
      modal(`<h3>Сдать работу?</h3><p>${empty ? `Без ответа: ${empty} ${plural(empty, "задача", "задачи", "задач")}. ` : "Все ответы записаны. "}После сдачи изменить ответы будет нельзя.</p>`,
        [{ label: "Ещё проверю" }, { label: "Сдать", cls: "btn-success", fn: () => { clearInterval(examTimer); submitExam(false); } }]);
    },
    examRetry() {
      modal(`<h3>Пройти ещё раз?</h3><p>Задачи будут те же. Лучший результат сохранится.</p>`,
        [{ label: "Отмена" }, { label: "Начать заново", cls: "btn-primary", fn: () => { Object.assign(S.exam, { startedAt: null, answers: {}, submitted: false, score: null }); save(); route(); } }]);
    },
    saveName() { S.name = (document.getElementById("sname").value || "").trim().slice(0, 20); save(); toast("✅ Имя сохранено"); },
    toggleSound(el) { S.settings.sound = el.checked; save(); sound("tap"); },
    toggleUnlock(el) { S.settings.unlockAll = el.checked; save(); toast(el.checked ? "🔓 Все острова открыты" : "🔒 Острова открываются по порядку"); },
    reset() {
      modal(`<h3>Сбросить прогресс?</h3><p>Очки, звёзды, награды и время подготовки будут удалены. Это нельзя отменить.</p>`,
        [{ label: "Отмена" }, { label: "Сбросить", cls: "btn-danger", fn: () => { S = fresh(); save(); go("#/"); } }]);
    }
  };

  function examInput(k) {
    const v = view;
    if (k === "back") v.input = v.input.slice(0, -1);
    else if (v.input.length < 6) v.input = (v.input === "0" ? "" : v.input) + k;
    if (v.input === "") delete S.exam.answers[v.i]; else S.exam.answers[v.i] = parseInt(v.input, 10);
    save();
    updateAnswer();
    document.querySelectorAll(".etab")[v.i].classList.toggle("has", v.input !== "");
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    if (el.tagName === "INPUT") return;
    const fn = act[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener("change", e => {
    const el = e.target.closest("input[data-act]");
    if (el && act[el.dataset.act]) act[el.dataset.act](el, e);
  });
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || document.querySelector(".modal-back")) return;
    if (!["problem", "blitz", "exam"].includes(view.name)) return;
    if (view.name === "exam" && view.p.type !== "num") return;
    if (view.name === "problem" && view.p.type === "choice") {
      if (e.key === "Enter" && view.selected !== null) check();
      return;
    }
    let k = null;
    if (/^[0-9]$/.test(e.key)) k = e.key;
    else if (e.key === "Backspace") k = "back";
    else if (e.key === "Enter") k = "ok";
    if (k) { e.preventDefault(); act.key({ dataset: { k } }); }
  });

  /* ---------- Запуск ---------- */
  checkBadges();
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { }));
  }
})();
