/* =====================================================================
   EL MOVIMIENTO — site logic
   1. Load the per-section JSON files and render the page from them
        · fillText()    — text slots          [data-text]
        · renderCards() — modular card lists   [data-cards] + <template>
   2. Mobile nav toggle
   3. Active nav link on scroll
   4. Scroll-reveal animations
   5. Reading-progress bar
   ===================================================================== */

/* Each page section lives in its own data/sections/<name>.json file so that
   editors can work on different sections without colliding in git. To add a
   section, drop in a new file and list its name here. Every file has the
   shape { "text": { … }, "cards": { … } } (either key may be omitted). */
const SECTIONS = ["hero", "who", "cause", "voices", "flashpoints", "legacy", "footer"];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadContent();   // build the page first…
  initNav();             // …then wire up the (now-rendered) interactions
  initScrollSpy();
  initReveal();
  initProgress();
}

/* =====================================================================
   1. CONTENT
   ===================================================================== */
async function loadContent() {
  try {
    // Fetch every section file in parallel, then merge them back into the
    // single { text, cards } shape the renderers expect.
    const sections = await Promise.all(SECTIONS.map(loadSection));

    const text = {};
    const cards = {};
    sections.forEach(function (section) {
      Object.assign(text, section.text);
      Object.assign(cards, section.cards);
    });

    fillText(text);
    renderCards(cards);
  } catch (err) {
    showContentError(err);
  }
}

/* Fetch and parse one data/sections/<name>.json file. */
async function loadSection(name) {
  const res = await fetch("data/sections/" + name + ".json", { cache: "no-store" });
  if (!res.ok) throw new Error(name + ".json — HTTP " + res.status);
  return res.json();
}

/* Fill every [data-text="key"] element from content.text[key]. */
function fillText(text) {
  document.querySelectorAll("[data-text]").forEach(function (el) {
    const value = text[el.dataset.text];
    if (value != null && value !== "") el.innerHTML = value;
  });
}

/* For each [data-cards="name"] container, clone its <template> once per
   item in content.cards[name]. Adding/removing items changes the count. */
function renderCards(cards) {
  document.querySelectorAll("[data-cards]").forEach(function (container) {
    const items = cards[container.dataset.cards];
    const tpl = document.getElementById(container.dataset.template);
    if (!Array.isArray(items) || !tpl) return;

    container.innerHTML = "";
    items.forEach(function (item) {
      container.appendChild(buildCard(tpl, item));
    });
  });
}

/* Build one card node from a template + a data object. */
function buildCard(tpl, item) {
  const node = tpl.content.firstElementChild.cloneNode(true);

  // Optional blocks: remove unless the named field has a value.
  node.querySelectorAll("[data-show-if]").forEach(function (block) {
    if (!item[block.dataset.showIf]) block.remove();
  });

  // Fill remaining fields; drop any element whose field is empty/absent.
  node.querySelectorAll("[data-field]").forEach(function (el) {
    const value = item[el.dataset.field];
    if (value != null && value !== "") el.innerHTML = value;
    else el.remove();
  });

  // Optional per-card styling.
  if (item.bg) node.style.background = item.bg;
  if (item.color) node.style.color = item.color;

  return node;
}

/* Friendly message if the JSON can't be fetched (common on file://). */
function showContentError(err) {
  const banner = document.getElementById("error-banner");
  if (!banner) return;
  banner.hidden = false;
  banner.innerHTML =
    "<strong>Content didn’t load.</strong> Open this site through a local " +
    "web server (e.g. VS Code “Live Server”) rather than double-clicking the " +
    "file — browsers block the <code>data/sections/</code> files on <code>file://</code>. " +
    "<span class='error-banner__detail'>(" + err.message + ")</span>";
  console.error("Failed to load section content:", err);
}

/* =====================================================================
   2. Mobile nav toggle
   ===================================================================== */
function initNav() {
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", function () {
    const open = links.classList.toggle("is-open");
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      links.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* =====================================================================
   3. Active nav link while scrolling
   ===================================================================== */
function initScrollSpy() {
  const navLinks = Array.from(document.querySelectorAll(".nav__links a"));
  const sections = navLinks
    .map(function (a) {
      const id = a.getAttribute("href");
      return id && id.startsWith("#") ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  if (!("IntersectionObserver" in window) || !sections.length) return;

  const spy = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach(function (s) { spy.observe(s); });
}

/* =====================================================================
   4. Scroll-reveal (runs after cards are rendered)
   ===================================================================== */
function initReveal() {
  const targets = document.querySelectorAll(
    ".section__head, .who__lede, .facts__item, .goal, .leader, .event, .legacy__inner"
  );
  targets.forEach(function (el, i) {
    el.setAttribute("data-reveal", "");
    el.style.transitionDelay = (i % 6) * 60 + "ms";
  });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }

  const revealer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
  );
  targets.forEach(function (el) { revealer.observe(el); });
}

/* =====================================================================
   5. Reading-progress bar
   ===================================================================== */
function initProgress() {
  const bar = document.getElementById("progress-bar");
  if (!bar) return;

  let ticking = false;
  const update = function () {
    const doc = document.documentElement;
    const height = doc.scrollHeight - doc.clientHeight;
    bar.style.width = (height > 0 ? (doc.scrollTop / height) * 100 : 0) + "%";
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    },
    { passive: true }
  );
  update();
}
