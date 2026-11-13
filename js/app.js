
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const passages = [
    "The rhythm of typing becomes a melody when your fingers find their flow.",
    "Small steps each day can build a skill that lasts for a lifetime.",
    "Clear thoughts become useful ideas when we take the time to write them well.",
    "Practice with patience, focus on accuracy, and let speed improve naturally."
  ];

  const codePassages = {
    React: "function Greeting() { return <h1>Hello, world!</h1>; }",
    JS: "const numbers = [1, 2, 3]; numbers.map((number) => number * 2);",
    Python: "def greet(name): print(f'Hello, {name}!')",
    SQL: "SELECT name, score FROM learners WHERE score > 80 ORDER BY score DESC;"
  };

  const prompt = $("#prompt-text");
  const input = $("#typing-input");

  if (!prompt || !input) return;

  let passageIndex = 0;
  let startedAt = 0;
  let timerId = null;
  let duration = 15;
  let elapsed = 0;

  let typed = "";
  let correct = 0;
  let finished = false;
  let customMode = false;
  let currentMode = "normal";
  let trend = [];

  const status = $("#practice-status");

  function setStatus(message) {
    status.textContent = message;
  }

  function setPassage(text) {
    clearInterval(timerId);
    timerId = null;
    startedAt = 0;
    elapsed = 0;

    typed = "";
    correct = 0;
    finished = false;
    input.value = "";

    prompt.textContent = text;

    updateStats();
    renderPrompt();
    highlightKey();

    setStatus("New passage ready. Start typing when you are ready.");
  }

  function getPassage() {
    return currentMode === "code"
      ? codePassages[$(".code-choice.active")?.dataset.code || "React"]
      : passages[passageIndex % passages.length];
  }

  function renderPrompt() {
    const chars = [...prompt.textContent];

    prompt.innerHTML = chars.map((char, index) => {

      // FIX: Normal spaces allow text to wrap naturally.
      const safe = char
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

      let cls = "";

      if (index < typed.length) {
        cls = typed[index] === chars[index] ? "correct" : "incorrect";
      } else if (index === typed.length) {
        cls = "current";
      }

      return `<span class="${cls}">${safe}</span>`;

    }).join("");

    const percent = Math.min(
      100,
      Math.round(typed.length / chars.length * 100)
    );

    $("#progress-fill").style.width = percent + "%";
    $("#progress-track").setAttribute("aria-valuenow", String(percent));
    $("#progress-label").textContent = percent + "%";
  }

  function updateStats() {
    const minutes = Math.max(
      (Date.now() - startedAt) / 60000,
      1 / 60
    );

    const wpm = startedAt
      ? Math.round((correct / 5) / minutes)
      : 0;

    const accuracy = typed.length
      ? Math.round(correct / typed.length * 100)
      : 100;

    $("#wpm").textContent = wpm;
    $("#keyboard-wpm").textContent = wpm;

    $("#accuracy").textContent = accuracy + "%";
    $("#keyboard-accuracy").textContent = accuracy + "%";

    $("#char-count").textContent = typed.length;
    $("#trend-wpm").textContent = wpm + " WPM";

    trend.push(wpm);

    if (trend.length > 8) trend.shift();
  }

  function highlightKey() {
    $$(".key").forEach(key => {
      key.classList.remove("expected");
    });

    const next = prompt.textContent[typed.length];

    if (!next) return;

    const normalized =
      next.toUpperCase() === " "
        ? "SPACE"
        : next.toUpperCase();

    const key = $$(".key").find(el =>
      el.textContent.trim().toUpperCase() === normalized
    );

    if (key) key.classList.add("expected");
  }

  function startClock() {
    if (startedAt || finished) return;

    startedAt = Date.now();

    timerId = setInterval(() => {
      elapsed = Math.floor((Date.now() - startedAt) / 1000);

      updateStats();

      if (duration && elapsed >= duration) {
        finish("Time is up. Your result is shown above.");
      }

    }, 250);
  }

  function finish(message) {
    finished = true;

    clearInterval(timerId);
    timerId = null;

    updateStats();
    setStatus(message);
  }

  input.addEventListener("input", () => {
    if (finished) return;

    const chars = [...prompt.textContent];

    typed = [...input.value].slice(0, chars.length).join("");
    input.value = typed;

    if (typed.length) startClock();

    correct = [...typed].reduce((sum, char, i) => {
      return sum + (char === chars[i] ? 1 : 0);
    }, 0);

    renderPrompt();
    updateStats();
    highlightKey();

    if (typed.length >= chars.length) {
      finish("Passage completed. Great practice!");
    }
  });

  $("#start-btn").addEventListener("click", () => {
    input.focus();
    setStatus("Typing area focused. Start typing to begin.");
  });

  $("#reset-btn").addEventListener("click", () => {
    setPassage(prompt.textContent);
  });

  $("#new-text-btn").addEventListener("click", () => {
    currentMode = "normal";
    customMode = false;
    passageIndex++;

    setPassage(getPassage());
  });

  $$(".choice[data-seconds]").forEach(button => {
    button.addEventListener("click", () => {

      $$(".choice[data-seconds]").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");

      duration = Number(button.dataset.seconds);

      setPassage(getPassage());

      setStatus(
        `${duration}-second test selected. Start typing to begin.`
      );
    });
  });

  $$(".code-choice").forEach(button => {
    button.addEventListener("click", () => {

      $$(".code-choice").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });

      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");

      currentMode = "code";
      customMode = false;

      setPassage(getPassage());
    });
  });

  function useCustom() {
    const value = $("#custom-text").value.trim();

    if (!value) {
      $("#custom-text").focus();
      setStatus("Enter some text before starting a custom drill.");
      return;
    }

    currentMode = "custom";
    customMode = true;

    setPassage(value);
    input.focus();
  }

  $("#custom-submit").addEventListener("click", useCustom);

  $("#custom-text").addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      useCustom();
    }
  });

  $("#quote-card").addEventListener("click", event => {
    if (!event.target.closest("button")) {
      input.focus();
    }
  });

  const menuButton = $(".menu-toggle");
  const nav = $("#primary-nav");

  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";

    menuButton.setAttribute("aria-expanded", String(open));

    menuButton.setAttribute(
      "aria-label",
      open ? "Close navigation menu" : "Open navigation menu"
    );

    nav.classList.toggle("open", open);
  });

  $$("#primary-nav a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");

      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation menu");
    });
  });

  $("#year").textContent = new Date().getFullYear();

  // Local-only streak tracking.
  try {
    const key = "typoprac-last-practice";

    const now = new Date();

    const today =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (localStorage.getItem(key) === today) {
      $$(".streak-day")[0]?.classList.add("done");
    }

    input.addEventListener("input", () => {
      if (typed.length >= 10) {
        localStorage.setItem(key, today);
        $$(".streak-day")[0]?.classList.add("done");
      }
    });

  } catch (_) {
    // Practice still works if local storage is disabled.
  }

  setPassage(passages[0]);

})();
