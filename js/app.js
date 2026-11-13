(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const prompt = $("#prompt-text");
  const input = $("#typing-input");
  if (!prompt || !input) return;

  const passages = [
    "The rhythm of typing becomes a melody when your fingers find their flow.",
    "Small steps each day can build a skill that lasts for a lifetime.",
    "Clear thoughts become useful ideas when we take the time to write them well.",
    "Practice with patience, focus on accuracy, and let speed improve naturally.",
    "A steady pace beats a rushed one, because every mistake costs more time than it saves.",
    "Good habits grow quietly, one calm session after another."
  ];

  const codePassages = {
    React: "function Greeting() { return <h1>Hello, world!</h1>; }",
    JS: "const numbers = [1, 2, 3]; numbers.map((number) => number * 2);",
    Python: "def greet(name): print(f'Hello, {name}!')",
    SQL: "SELECT name, score FROM learners WHERE score > 80 ORDER BY score DESC;"
  };

  // Shifted symbols map to the key that produces them, for keyboard highlighting.
  const SHIFTED = {
    "{": "[", "}": "]", "(": "9", ")": "0", "<": ",", ">": ".", "!": "1", "?": "/", ":": ";",
    '"': "'", "_": "-", "+": "=", "|": "\\", "$": "4", "%": "5", "&": "7", "*": "8", "@": "2", "#": "3", "^": "6"
  };

  const STREAK_KEY = "typoprac-streak";
  const STATS_KEY = "typoprac-stats";

  // ---------- Local storage helpers (practice still works if storage is blocked) ----------
  const load = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" ? { ...fallback, ...value } : { ...fallback };
    } catch (_) {
      return { ...fallback };
    }
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* ignore */ }
  };

  const dayKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const dayGap = (a, b) => {
    const toUtc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((toUtc(b) - toUtc(a)) / 86400000);
  };

  // ---------- State ----------
  let passageIndex = 0;
  let baseText = "";
  let target = "";
  let typed = "";
  let correct = 0;
  let startedAt = 0;
  let endedAt = 0;
  let timerId = null;
  let duration = 15;
  let finished = false;
  let mode = "normal"; // normal | code | custom
  let streak = load(STREAK_KEY, { last: "", count: 0, best: 0 });
  let stats = load(STATS_KEY, { words: 0, best: 0, bestAcc: 0, accBadge: false });

  const status = $("#practice-status");
  const resultCard = $("#result-card");
  const setStatus = (message) => { status.textContent = message; };

  const elapsedMs = () => (startedAt ? (endedAt || Date.now()) - startedAt : 0);
  const getAccuracy = () => (typed.length ? Math.round((correct / typed.length) * 100) : 100);
  const getWpm = () => {
    if (!startedAt) return 0;
    const minutes = Math.max(elapsedMs(), 3000) / 60000; // avoid inflated speeds in the first seconds
    return Math.round(correct / 5 / minutes);
  };

  // ---------- Rendering ----------
  function renderPrompt() {
    const chars = [...target];
    prompt.innerHTML = chars.map((char, index) => {
      const safe = char.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      let cls = "";
      if (index < typed.length) cls = typed[index] === char ? "correct" : "incorrect";
      else if (index === typed.length && !finished) cls = "current";
      return `<span class="${cls}">${safe}</span>`;
    }).join("");
  }

  function updateStats() {
    const wpm = getWpm();
    const accuracy = getAccuracy();
    $("#wpm").textContent = wpm;
    $("#keyboard-wpm").textContent = wpm;
    $("#accuracy").textContent = accuracy + "%";
    $("#keyboard-accuracy").textContent = accuracy + "%";
    $("#char-count").textContent = typed.length;

    const remaining = Math.max(0, Math.ceil(duration - elapsedMs() / 1000));
    $("#time-left").textContent = remaining + "s";

    const percent = mode === "normal"
      ? (startedAt ? Math.min(100, Math.round(elapsedMs() / (duration * 10))) : 0)
      : Math.min(100, Math.round((typed.length / Math.max(target.length, 1)) * 100));
    $("#progress-fill").style.width = percent + "%";
    $("#progress-track").setAttribute("aria-valuenow", String(percent));
    $("#progress-label").textContent = percent + "%";
  }

  function highlightKey() {
    $$(".key").forEach((key) => key.classList.remove("expected"));
    if (finished) return;
    const next = target[typed.length];
    if (!next) return;
    const wanted = next === " " ? "SPACE" : (SHIFTED[next] || next).toUpperCase();
    const key = $$(".key").find((el) => el.textContent.trim().toUpperCase() === wanted);
    if (key) key.classList.add("expected");
  }

  function renderBest() {
    $("#trend-wpm").textContent = stats.best + " WPM";
    $("#you-wpm").textContent = stats.best ? stats.best : "–";
    $("#you-acc").textContent = stats.best ? stats.bestAcc + "%" : "–";
  }

  // ---------- Streak and achievements ----------
  function currentStreak() {
    if (!streak.last) return 0;
    return dayGap(streak.last, dayKey(new Date())) <= 1 ? streak.count : 0;
  }

  function renderStreak() {
    const today = dayKey(new Date());
    const n = currentStreak();
    const doneToday = streak.last === today;
    const filled = n ? ((n - 1) % 8) + 1 : 0;
    const firstDay = n ? n - filled + 1 : 1;

    $$(".streak-day").forEach((cell, i) => {
      const done = i < filled;
      cell.classList.toggle("done", done);
      $("small", cell).textContent = "DAY " + (firstDay + i);
      $("span", cell).textContent = done ? "🔥" : "○";
      $("strong", cell).textContent = done ? "Practised" : (i === filled && !doneToday ? "Today" : "Keep going");
    });

    const days = (v) => `${v} ${v === 1 ? "day" : "days"}`;
    $("#streak-summary").textContent = n
      ? `Current streak: ${days(n)}. Best streak: ${days(streak.best)}. ${doneToday ? "You have practised today." : "Practise today to keep it going."}`
      : "Practise today to start your streak.";
  }

  function recordPractice() {
    const today = dayKey(new Date());
    if (streak.last === today) return;
    const gap = streak.last ? dayGap(streak.last, today) : Infinity;
    streak.count = gap === 1 ? streak.count + 1 : 1;
    streak.last = today;
    streak.best = Math.max(streak.best, streak.count);
    save(STREAK_KEY, streak);
    renderStreak();
    renderAchievements();
  }

  function renderAchievements() {
    const done = { words: stats.words >= 100, accuracy: stats.accBadge, streak: streak.best >= 3 };
    const text = {
      words: [`Type 100 correct words in finished tests (${Math.min(100, Math.floor(stats.words))}/100).`, "Unlocked. You have typed over 100 words."],
      accuracy: ["Finish a test of 20+ characters at 95% accuracy or better.", "Unlocked. Accurate typing pays off."],
      streak: ["Practise three days in a row.", "Unlocked. Three days in a row, nice work."]
    };
    $$(".achievement").forEach((el) => {
      const key = el.dataset.achievement;
      if (!text[key]) return;
      el.classList.toggle("unlocked", done[key]);
      $("span", el).textContent = text[key][done[key] ? 1 : 0];
    });
  }

  // ---------- Test flow ----------
  function setPassage(text) {
    clearInterval(timerId);
    timerId = null;
    baseText = target = text;
    typed = "";
    correct = 0;
    startedAt = 0;
    endedAt = 0;
    finished = false;
    input.value = "";
    resultCard.hidden = true;
    renderPrompt();
    updateStats();
    highlightKey();
    setStatus("New passage ready. Start typing when you are ready.");
  }

  function nextPassage() {
    mode = "normal";
    setPressed($$(".code-choice"), null);
    passageIndex++;
    setPassage(passages[passageIndex % passages.length]);
  }

  function startClock() {
    if (startedAt || finished) return;
    startedAt = Date.now();
    timerId = setInterval(() => {
      updateStats();
      if (elapsedMs() >= duration * 1000) finish("time");
    }, 250);
  }

  function finish(reason) {
    if (finished) return;
    finished = true;
    clearInterval(timerId);
    timerId = null;
    endedAt = reason === "time" ? startedAt + duration * 1000 : Date.now();
    renderPrompt();
    updateStats();
    highlightKey();
    showResult(reason);
  }

  function showResult(reason) {
    const wpm = getWpm();
    const accuracy = getAccuracy();
    let note = reason === "time" ? "Time is up." : "Passage complete.";

    if (typed.length >= 10) {
      stats.words += correct / 5;
      if (wpm > stats.best) {
        stats.best = wpm;
        stats.bestAcc = accuracy;
        note += " New personal best!";
      } else {
        note += ` Your best is ${stats.best} WPM.`;
      }
      if (accuracy >= 95 && typed.length >= 20) stats.accBadge = true;
      save(STATS_KEY, stats);
      renderBest();
      renderAchievements();
    } else {
      note += " Type a little more next time to record a result.";
    }

    $("#result-wpm").textContent = wpm;
    $("#result-acc").textContent = accuracy + "%";
    $("#result-chars").textContent = typed.length;
    $("#result-best").textContent = stats.best;
    $("#result-note").textContent = note;
    resultCard.hidden = false;
    resultCard.focus();
    setStatus(`${note} ${wpm} words per minute at ${accuracy}% accuracy.`);
  }

  input.addEventListener("input", () => {
    if (finished) return;
    let chars = [...target];
    typed = [...input.value].slice(0, chars.length).join("");
    input.value = typed;

    if (typed.length) startClock();
    if (typed.length >= 10) recordPractice();

    // In timed practice, keep adding text so a fast typist never runs out before time is up.
    if (typed.length >= chars.length && mode === "normal" && elapsedMs() < duration * 1000) {
      passageIndex++;
      target += " " + passages[passageIndex % passages.length];
      chars = [...target];
    }

    correct = [...typed].reduce((sum, char, i) => sum + (char === chars[i] ? 1 : 0), 0);
    renderPrompt();
    updateStats();
    highlightKey();

    if (typed.length >= chars.length) finish("complete");
  });

  input.addEventListener("paste", (event) => event.preventDefault());

  // ---------- Controls ----------
  function setPressed(buttons, active) {
    buttons.forEach((b) => {
      const on = b === active;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  $("#start-btn").addEventListener("click", () => {
    if (finished) setPassage(baseText);
    input.focus();
    setStatus("Typing area focused. Start typing to begin.");
  });
  $("#reset-btn").addEventListener("click", () => setPassage(baseText));
  $("#new-text-btn").addEventListener("click", nextPassage);
  $("#again-btn").addEventListener("click", () => { setPassage(baseText); input.focus(); });
  $("#next-btn").addEventListener("click", () => { nextPassage(); input.focus(); });

  $$(".choice[data-seconds]").forEach((button) => {
    button.addEventListener("click", () => {
      setPressed($$(".choice[data-seconds]"), button);
      duration = Number(button.dataset.seconds);
      setPassage(baseText);
      setStatus(`${duration}-second test selected. Start typing to begin.`);
    });
  });

  $$(".code-choice").forEach((button) => {
    button.addEventListener("click", () => {
      setPressed($$(".code-choice"), button);
      mode = "code";
      setPassage(codePassages[button.dataset.code]);
    });
  });

  function useCustom() {
    const field = $("#custom-text");
    const value = field.value.trim();
    if (!value) {
      field.focus();
      setStatus("Enter some text before starting a custom drill.");
      return;
    }
    mode = "custom";
    setPressed($$(".code-choice"), null);
    setPassage(value);
    input.focus();
  }

  $("#custom-submit").addEventListener("click", useCustom);
  $("#custom-text").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      useCustom();
    }
  });

  $("#quote-card").addEventListener("click", () => input.focus());

  // ---------- Navigation ----------
  const menuButton = $(".menu-toggle");
  const nav = $("#primary-nav");

  function setMenu(open) {
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    nav.classList.toggle("open", open);
  }

  menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  $$("#primary-nav a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("open")) {
      setMenu(false);
      menuButton.focus();
    }
  });

  // ---------- Dark mode ----------
  const root = document.documentElement;
  const themeButton = $("#theme-toggle");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#12161f" : "#f7f9fc");
    if (!themeButton) return;
    themeButton.setAttribute("aria-pressed", String(theme === "dark"));
    themeButton.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    themeButton.firstElementChild.textContent = theme === "dark" ? "☀" : "☾";
  }

  applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
  if (themeButton) {
    themeButton.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("typoprac-theme", next); } catch (_) { /* ignore */ }
    });
  }

  // ---------- Init ----------
  $("#year").textContent = new Date().getFullYear();
  renderStreak();
  renderAchievements();
  renderBest();
  setPassage(passages[0]);
})();