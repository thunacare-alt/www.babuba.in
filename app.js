/* ═══════════════════════════════════════════════════════════
   BABUBA — Site motion & interactions (vanilla JS, no deps)
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Scroll progress + nav state ─────────────────────────── */
  const progress = $("#scrollProgress");
  const nav = $("#nav");
  function onScroll() {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    nav.classList.toggle("scrolled", h.scrollTop > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── Mobile nav ──────────────────────────────────────────── */
  const burger = $("#navBurger");
  const links = $("#navLinks");
  burger.addEventListener("click", () => links.classList.toggle("open"));
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") links.classList.remove("open");
  });

  /* ── Scroll reveals ──────────────────────────────────────── */
  const revealEls = $$(".reveal");
  if (reduced) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            const delay = parseInt(en.target.dataset.delay || "0", 10);
            en.target.style.setProperty("--d", delay + "ms");
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ── Stat counters ───────────────────────────────────────── */
  const counters = $$(".stat-num");
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    const dur = 1200;
    const t0 = performance.now();
    function tick(t) {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(dec) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if (counters.length) {
    if (reduced) {
      counters.forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || "")));
    } else if ("IntersectionObserver" in window) {
      const cio = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              animateCount(en.target);
              cio.unobserve(en.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach((el) => cio.observe(el));
    } else {
      counters.forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || "")));
    }
  }

  /* ── Marquee: duplicate track for seamless loop ──────────── */
  const track = $("#marqueeTrack");
  if (track) {
    track.innerHTML += track.innerHTML;
  }

  /* ── Before/after slider ─────────────────────────────────── */
  const baRange = $("#baRange");
  const baBefore = $("#baBefore");
  if (baRange && baBefore) {
    function updateBA() { baBefore.style.width = baRange.value + "%"; }
    baRange.addEventListener("input", updateBA);
    updateBA();
  }

  /* ── Ops console demo loop ───────────────────────────────── */
  const consoleEl = $("#opsConsole");
  if (consoleEl) {
    const incomingCol = $("#incomingCol");
    const agentState = $("#agentState");
    const tableBody = $("#afrTable tbody");
    const approveBtn = $("#approveBtn");
    const approveCount = $("#approveCount");

    const messages = [
      { from: "Unit A", qty: "23.5 MT", no: "INV-1041" },
      { from: "Unit B", qty: "18.2 MT", no: "INV-1042" },
      { from: "Unit C", qty: "31.6 MT", no: "INV-1043" },
      { from: "Unit D", qty: "12.9 MT", no: "INV-1044" }
    ];
    const agentStates = ["parsing", "validating", "reconciling", "matching GST", "ready"];
    const rows = messages.map((m, i) => ({
      no: m.no,
      qty: m.qty,
      ok: i !== 2
    }));

    let running = false;

    function clearConsole() {
      incomingCol.querySelectorAll(".msg").forEach((n) => n.classList.remove("in"));
      tableBody.querySelectorAll("tr").forEach((r) => r.classList.remove("in"));
      approveBtn.classList.remove("ready");
      approveCount.textContent = "0";
      agentState.textContent = "idle";
    }

    function runSequence() {
      clearConsole();
      let t = 0;
      const step = 900;
      messages.forEach((m, i) => {
        setTimeout(() => {
          const el = incomingCol.querySelectorAll(".msg")[i];
          requestAnimationFrame(() => el.classList.add("in"));
        }, t + i * step);
      });
      agentState.textContent = "parsing";
      const stateTimes = [1200, 2300, 3400, 4500];
      agentStates.slice(0, 4).forEach((s, i) => setTimeout(() => (agentState.textContent = s), stateTimes[i]));
      rows.forEach((r, i) => {
        setTimeout(() => {
          const tr = tableBody.rows[i];
          requestAnimationFrame(() => tr.classList.add("in"));
        }, 1500 + i * step);
      });
      setTimeout(() => {
        agentState.textContent = "ready";
        approveBtn.classList.add("ready");
        approveCount.textContent = rows.length - 1;
      }, 5200);
      t = 5200 + 3500;
      setTimeout(runSequence, t);
    }

    if (reduced) {
      // static filled state for reduced-motion users
      incomingCol.querySelectorAll(".msg").forEach((n) => n.classList.add("in"));
      tableBody.querySelectorAll("tr").forEach((r) => r.classList.add("in"));
      agentState.textContent = "ready";
      approveBtn.classList.add("ready");
      approveCount.textContent = rows.length - 1;
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting && !running) {
              running = true;
              setTimeout(runSequence, 600);
              io.disconnect();
            }
          });
        },
        { threshold: 0.3 }
      );
      io.observe(consoleEl);
    }
  }

  /* ── Desk clock ──────────────────────────────────────────── */
  const deskClock = $("#deskClock");
  if (deskClock) {
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      deskClock.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ── Demo chat sequence ──────────────────────────────────── */
  const demo = $("#demoChat");
  if (demo) {
    const msgs = $(".demo-msg", demo);
    if (reduced) {
      msgs.forEach((m) => m.classList.add("in"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              msgs.forEach((m, i) => setTimeout(() => m.classList.add("in"), 400 + i * 1100));
              io.disconnect();
            }
          });
        },
        { threshold: 0.4 }
      );
      io.observe(demo);
    }
  }

  /* ── First-load boot overlay ─────────────────────────────── */
  const bootOv = $("#bootOv");
  if (bootOv && !reduced && !sessionStorage.getItem("babuba_booted")) {
    sessionStorage.setItem("babuba_booted", "1");
    const dismiss = () => {
      bootOv.classList.add("hide");
      bootOv.removeEventListener("click", dismiss);
      setTimeout(() => bootOv.remove(), 500);
    };
    bootOv.addEventListener("click", dismiss);
    setTimeout(dismiss, 1400);
  } else if (bootOv) {
    bootOv.remove();
  }

  /* ── Scroll-spy: highlight active section in nav ─────────── */
  const navAnchors = document.querySelectorAll(".nav-links a");
  const sections = document.querySelectorAll("section[id]");
  if (navAnchors.length && sections.length && "IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const id = en.target.id;
          navAnchors.forEach((a) => {
            a.classList.toggle("active", a.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ── Back-to-top ─────────────────────────────────────────── */
  const toTop = $("#toTop");
  if (toTop) {
    const onSc = () => toTop.classList.toggle("show", (document.documentElement.scrollTop || document.body.scrollTop) > 600);
    window.addEventListener("scroll", onSc, { passive: true });
    onSc();
    toTop.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });
  }
})();
