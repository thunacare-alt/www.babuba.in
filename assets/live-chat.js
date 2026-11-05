/* ============================================================
   Babuba — live chat widget (floating, every page)
   Talks to the public demo endpoint. The page and the endpoint
   are different origins, so the endpoint sends CORS headers.
   A stranger can only talk: the endpoint has no tools at all.
   Usage: <script src="assets/live-chat.js" defer></script>
   ============================================================ */
(function () {
  "use strict";
  if (window.__babubaLiveChat) return;
  window.__babubaLiveChat = true;
  if (location.protocol === "file:") return;

  var ENDPOINT = "https://demo.ghostagents.in/demo";
  var WA = "https://wa.me/919497243925";

  // ---- theme: the homepage is paper collage, the inner pages are dark ----
  var cs = getComputedStyle(document.documentElement);
  function token(n, fb) { var v = (cs.getPropertyValue(n) || "").trim(); return v || fb; }
  var isPaper = !!token("--paper", "");
  var C = isPaper
    ? { bg: token("--paper2", "#FAF6ED"), ink: token("--ink", "#1A1714"), line: "rgba(26,23,20,.28)", mine: token("--ink", "#1A1714"), mineInk: token("--paper2", "#FAF6ED"), dim: "rgba(26,23,20,.62)", accent: token("--red", "#CB3428") }
    : { bg: token("--panel", "#121214"), ink: token("--ink", "#E8E8E2"), line: token("--line", "#26262B"), mine: token("--volt", "#C9F24B"), mineInk: "#0A0A0B", dim: token("--dim", "#8B8B84"), accent: token("--volt", "#C9F24B") };
  var MONO = isPaper ? "'JBM',ui-monospace,monospace" : "'JetBrains Mono',ui-monospace,monospace";
  var BODY = isPaper ? "'WS',system-ui,sans-serif" : "'Inter',system-ui,sans-serif";

  var css = ""
    + ".blc-fab{position:fixed;right:20px;bottom:20px;z-index:9998;display:flex;align-items:center;gap:9px;"
    + "padding:12px 16px;border:1px solid " + C.line + ";border-radius:2px;cursor:pointer;font:600 12px/1 " + MONO + ";"
    + "letter-spacing:.10em;text-transform:uppercase;background:" + C.bg + ";color:" + C.ink + ";"
    + "box-shadow:4px 4px 0 " + C.accent + ";transition:transform 140ms ease,box-shadow 140ms ease}"
    + ".blc-fab:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 " + C.accent + "}"
    + ".blc-fab .dot{width:7px;height:7px;border-radius:50%;background:" + C.accent + ";animation:blcPulse 1.8s infinite}"
    + "@keyframes blcPulse{0%,100%{opacity:1}50%{opacity:.25}}"
    + ".blc-wrap{position:fixed;right:20px;bottom:20px;z-index:9999;width:min(370px,calc(100vw - 32px));height:min(540px,calc(100vh - 90px));"
    + "display:none;flex-direction:column;background:" + C.bg + ";color:" + C.ink + ";border:1px solid " + C.line + ";border-radius:2px;"
    + "box-shadow:8px 8px 0 " + C.accent + ";overflow:hidden}"
    + ".blc-wrap.on{display:flex}"
    + ".blc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;border-bottom:1px solid " + C.line + ";"
    + "font:700 11px/1.2 " + MONO + ";letter-spacing:.12em;text-transform:uppercase}"
    + ".blc-head span.b{color:" + C.accent + "}"
    + ".blc-x{background:none;border:0;color:" + C.ink + ";font:400 18px/1 " + MONO + ";cursor:pointer;padding:0 2px;opacity:.7}"
    + ".blc-x:hover{opacity:1}"
    + ".blc-log{flex:1;overflow-y:auto;padding:14px 13px;display:flex;flex-direction:column;gap:10px;font:400 14px/1.5 " + BODY + "}"
    + ".blc-m{max-width:88%;padding:8px 11px;border-radius:2px;white-space:pre-wrap;word-break:break-word}"
    + ".blc-m.a{align-self:flex-start;background:transparent;border:1px solid " + C.line + "}"
    + ".blc-m.u{align-self:flex-end;background:" + C.mine + ";color:" + C.mineInk + "}"
    + ".blc-m.e{align-self:flex-start;color:" + C.accent + ";border:1px dashed " + C.accent + "}"
    + ".blc-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 13px 10px}"
    + ".blc-chip{font:400 11.5px/1 " + MONO + ";padding:7px 9px;border:1px solid " + C.line + ";border-radius:2px;background:transparent;"
    + "color:" + C.ink + ";cursor:pointer;opacity:.85}"
    + ".blc-chip:hover{opacity:1;border-color:" + C.accent + "}"
    + ".blc-form{display:flex;gap:7px;padding:10px 13px;border-top:1px solid " + C.line + "}"
    + ".blc-in{flex:1;min-width:0;background:transparent;border:1px solid " + C.line + ";border-radius:2px;color:" + C.ink + ";"
    + "font:400 13.5px/1.3 " + BODY + ";padding:9px 10px;outline:none}"
    + ".blc-in:focus{border-color:" + C.accent + "}"
    + ".blc-go{background:" + C.mine + ";color:" + C.mineInk + ";border:1px solid " + C.mine + ";border-radius:2px;cursor:pointer;"
    + "font:700 11px/1 " + MONO + ";letter-spacing:.1em;text-transform:uppercase;padding:0 13px}"
    + ".blc-go:disabled{opacity:.45;cursor:default}"
    + ".blc-foot{padding:0 13px 11px;font:400 10.5px/1.5 " + MONO + ";color:" + C.dim + "}"
    + ".blc-foot a{color:" + C.accent + ";text-decoration:none}"
    + "@media(max-width:520px){.blc-fab{right:14px;bottom:14px}.blc-wrap{right:14px;bottom:14px}}";

  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var fab = document.createElement("button");
  fab.className = "blc-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Chat with the Babuba agent");
  fab.innerHTML = '<span class="dot"></span>Chat with the agent';

  var wrap = document.createElement("div");
  wrap.className = "blc-wrap";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-label", "Babuba live agent chat");
  wrap.innerHTML = ''
    + '<div class="blc-head"><span><span class="b">●</span> Babuba agent · live</span>'
    + '<button class="blc-x" type="button" aria-label="Close chat">×</button></div>'
    + '<div class="blc-log" id="blcLog"></div>'
    + '<div class="blc-chips" id="blcChips"></div>'
    + '<form class="blc-form"><input class="blc-in" type="text" maxlength="240" placeholder="Ask anything about Babuba…" autocomplete="off" aria-label="Your message"><button class="blc-go" type="submit">Send</button></form>'
    + '<div class="blc-foot">Demo agent — it has no hands. The real one does: <a href="' + WA + '" target="_blank" rel="noopener">WhatsApp</a></div>';

  document.body.appendChild(fab);
  document.body.appendChild(wrap);

  var log = wrap.querySelector("#blcLog");
  var chips = wrap.querySelector("#blcChips");
  var form = wrap.querySelector("form");
  var input = wrap.querySelector(".blc-in");
  var go = wrap.querySelector(".blc-go");
  var history = [];
  var busy = false;
  var opened = false;

  function bubble(text, cls) {
    var d = document.createElement("div");
    d.className = "blc-m " + cls;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function greet() {
    if (opened) return;
    opened = true;
    bubble("Hi — I'm the agent on this site. Ask me what Babuba does, what it costs, or how fast an agent goes live in your business.", "a");
    ["What is Babuba?", "What does it cost?", "How fast can an agent go live?"].forEach(function (t) {
      var b = document.createElement("button");
      b.className = "blc-chip";
      b.type = "button";
      b.textContent = t;
      b.addEventListener("click", function () {
        chips.innerHTML = "";
        send(t);
      });
      chips.appendChild(b);
    });
  }

  // the endpoint takes one string and remembers nothing, so the last turn or
  // two travels with the question — trimmed to stay inside its 400-char cap
  function withContext(q) {
    var tail = history.slice(-2).map(function (h) {
      return (h.role === "u" ? "Me: " : "You: ") + h.text.replace(/\s+/g, " ").slice(0, 80);
    }).join(" | ");
    var room = 380 - q.length - (tail ? tail.length + 8 : 0);
    if (tail && room < 40) tail = "";
    return tail ? tail + " || Now: " + q : q;
  }

  function send(text) {
    var q = String(text || "").trim();
    if (!q || busy) return;
    chips.innerHTML = "";
    bubble(q, "u");
    input.value = "";
    busy = true;
    go.disabled = true;
    var waiting = bubble("…", "a");
    var echo = document.createElement("span");
    echo.style.cssText = "display:inline-block;animation:blcPulse 1.4s infinite";
    echo.textContent = "thinking";
    waiting.textContent = "";
    waiting.appendChild(echo);

    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 60000);

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: withContext(q).slice(0, 400) }),
      signal: ctl.signal
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var out = (j && (j.answer || j.error)) || "";
        if (!out) out = "I did not get an answer for that. The team is on WhatsApp: " + WA;
        waiting.className = "blc-m " + (j && j.ok ? "a" : "e");
        waiting.textContent = out;
        history.push({ role: "u", text: q });
        history.push({ role: "a", text: out });
      })
      .catch(function () {
        waiting.className = "blc-m e";
        waiting.textContent = "I could not reach my head just now. The team is on WhatsApp: " + WA;
      })
      .then(function () {
        clearTimeout(timer);
        busy = false;
        go.disabled = false;
        log.scrollTop = log.scrollHeight;
        try { input.focus(); } catch (e) {}
      });
  }

  function open() {
    fab.style.display = "none";
    wrap.classList.add("on");
    greet();
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
  }
  function close() {
    wrap.classList.remove("on");
    fab.style.display = "";
  }

  fab.addEventListener("click", open);
  wrap.querySelector(".blc-x").addEventListener("click", close);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    send(input.value);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && wrap.classList.contains("on")) close();
  });
})();
