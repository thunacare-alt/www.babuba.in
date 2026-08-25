/* ============================================================
   Babuba Chat Widget — talk to the Babuba demo agent.
   Hosted on www.babuba.in (GitHub Pages), talks to the gateway
   over HTTPS at chat.babuba.in.
   Usage: <script src="chat-widget.js" data-agent="agent-sales-talk-to-babuba-demo" defer></script>
   ============================================================ */
(function () {
  "use strict";

  var GATEWAY = "https://chat.babuba.in";
  var AGENT_ID = "agent-sales-talk-to-babuba-demo";
  var SCRIPT = document.currentScript || (function () {
    var s = document.querySelectorAll('script[src*="chat-widget"]');
    return s[s.length - 1];
  })();
  if (SCRIPT && SCRIPT.getAttribute("data-agent")) AGENT_ID = SCRIPT.getAttribute("data-agent");
  if (SCRIPT && SCRIPT.getAttribute("data-gateway")) GATEWAY = SCRIPT.getAttribute("data-gateway").replace(/\/+$/, "");

  // ---- per-visitor id (persisted so a return visitor keeps their thread) ----
  var VISITOR_KEY = "babuba_visitor_id";
  function visitorId() {
    var id = null;
    try { id = localStorage.getItem(VISITOR_KEY); } catch (e) {}
    if (!id) {
      id = "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(VISITOR_KEY, id); } catch (e) {}
    }
    return id;
  }

  // ---- create a fresh gateway session, returns sessionId ----
  function createFreshSession(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", GATEWAY + "/api/admin-chat/create-session", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      try {
        var j = JSON.parse(xhr.responseText);
        if (j && j.sessionId) {
          try { sessionStorage.setItem("babuba_session", j.sessionId); } catch (e) {}
          cb(j.sessionId);
        } else {
          cb(null);
        }
      } catch (e) { cb(null); }
    };
    xhr.send(JSON.stringify({ agentId: AGENT_ID, userId: visitorId(), channel: "website-widget" }));
  }

  // ---- reuse a cached session ONLY if still valid; else create a fresh one.
  //      Gateway sessions die on restart, so a blindly-reused id shows "Link Expired". ----
  function ensureSession(cb) {
    var cached = null;
    try { cached = sessionStorage.getItem("babuba_session"); } catch (e) {}
    if (!cached) { createFreshSession(cb); return; }
    var vxhr = new XMLHttpRequest();
    vxhr.open("GET", GATEWAY + "/api/admin-chat/verify?session=" + encodeURIComponent(cached), true);
    vxhr.onreadystatechange = function () {
      if (vxhr.readyState !== 4) return;
      var ok = false;
      try { var vj = JSON.parse(vxhr.responseText); ok = !!(vj && vj.valid); } catch (e) { ok = false; }
      if (ok) { cb(cached); return; }
      try { sessionStorage.removeItem("babuba_session"); } catch (e) {}
      createFreshSession(cb);
    };
    vxhr.onerror = function () { createFreshSession(cb); };
    vxhr.send();
  }

  // ---- styles ----
  var css = "" +
    "#babuba-widget-btn{position:fixed;right:22px;bottom:64px;z-index:999999;width:60px;height:60px;border-radius:50%;" +
    "background:linear-gradient(135deg,#C9F24B,#9FD82F);border:none;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.45);" +
    "display:flex;align-items:center;justify-content:center;transition:transform .18s ease;}" +
    "#babuba-widget-btn:hover{transform:scale(1.08);}" +
    "#babuba-widget-label{position:fixed;right:94px;bottom:78px;z-index:999999;pointer-events:none;background:#121214;border:1px solid #26262B;" +
    "color:#E8E8E2;font:500 13px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:9px 14px;" +
    "border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.45);opacity:0;transform:translateX(8px);transition:opacity .25s ease,transform .25s ease;}" +
    "#babuba-widget-label.show{opacity:1;transform:none;}" +
    "#babuba-widget-label:after{content:'';position:absolute;right:-6px;top:50%;transform:translateY(-50%);" +
    "width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:6px solid #26262B;}" +
    "#babuba-widget-label b{color:#C9F24B;}" +
    "#babuba-widget-btn svg{width:30px;height:30px;fill:#0A0A0B;}" +
    "#babuba-widget-close{position:absolute;top:6px;right:6px;z-index:2;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border:none;border-radius:10px;color:#8B8B84;font-size:19px;cursor:pointer;line-height:1;transition:background .15s,color .15s;}" +
    "#babuba-widget-close:hover{background:rgba(255,255,255,.12);color:#E8E8E2;}" +
    "#babuba-widget-panel{position:fixed;right:22px;bottom:94px;z-index:999998;width:380px;max-width:calc(100vw - 44px);" +
    "height:560px;max-height:calc(100vh - 130px);background:#0A0A0B;border:1px solid #26262B;border-radius:16px;overflow:hidden;" +
    "box-shadow:0 16px 48px rgba(0,0,0,.55);display:none;flex-direction:column;}" +
    "#babuba-widget-panel.open{display:flex;}" +
    "#babuba-widget-head{display:flex;align-items:center;gap:10px;padding:12px 54px 12px 14px;background:#121214;" +
    "border-bottom:1px solid #26262B;flex-shrink:0;}" +
    "#babuba-widget-head .dot{width:10px;height:10px;border-radius:50%;background:#C9F24B;box-shadow:0 0 8px rgba(201,242,75,.8);flex-shrink:0;}" +
    "#babuba-widget-head .t{color:#E8E8E2;font:600 14px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}" +
    "#babuba-widget-head .s{color:#8B8B84;font:400 11px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-top:2px;}" +
    "#babuba-widget-frame{flex:1;border:none;width:100%;background:#0A0A0B;}" +
    "@media (max-width:520px){#babuba-widget-panel{right:8px;bottom:84px;width:calc(100vw - 16px);height:calc(100vh - 110px);max-width:none;}}" +
    "";

  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---- button ----
  var btn = document.createElement("button");
  btn.id = "babuba-widget-btn";
  btn.setAttribute("aria-label", "Chat with Babuba");
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3C6.48 3 2 6.94 2 11.8c0 2.6 1.26 4.94 3.26 6.53-.1.85-.48 2.14-1.26 3.17 0 0 2.43-.34 4.06-1.48.92.23 1.9.35 2.94.35 5.52 0 10-3.94 10-8.8S17.52 3 12 3zM7.5 13a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm4.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm4.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"/></svg>';
  document.body.appendChild(btn);

  // ---- panel ----
  var panel = document.createElement("div");
  panel.id = "babuba-widget-panel";
  panel.innerHTML = "" +
    '<div id="babuba-widget-head">' +
    '<span class="dot"></span>' +
    '<div><div class="t">Babuba · Demo Agent</div><div class="s">online — replies instantly</div></div>' +
    '</div>' +
    '<button id="babuba-widget-close" aria-label="Close chat">✕</button>' +
    '<iframe id="babuba-widget-frame" title="Chat with Babuba" allow="clipboard-write"></iframe>';
  document.body.appendChild(panel);

  // ---- "click here to talk to me" label ----
  var label = document.createElement("div");
  label.id = "babuba-widget-label";
  label.innerHTML = 'Click here to <b>talk to me</b>';
  document.body.appendChild(label);
  var labelTimer = null;
  function showLabel(keep) {
    label.classList.add("show");
    if (labelTimer) clearTimeout(labelTimer);
    if (!keep) labelTimer = setTimeout(function () { label.classList.remove("show"); }, 8000);
  }
  function hideLabel() { label.classList.remove("show"); if (labelTimer) clearTimeout(labelTimer); }
  setTimeout(function () { showLabel(false); }, 1200);
  btn.addEventListener("mouseenter", function () { showLabel(true); });
  btn.addEventListener("mouseleave", hideLabel);

  var frame = panel.querySelector("#babuba-widget-frame");
  var closeBtn = panel.querySelector("#babuba-widget-close");

  function openChat() {
    panel.classList.add("open");
    btn.style.display = "none";
    hideLabel();
    if (!frame.getAttribute("src")) {
      ensureSession(function (sid) {
        if (sid) {
          frame.setAttribute("src", GATEWAY + "/admin-chat/session/" + sid + "?theme=babuba");
        } else {
          frame.setAttribute("src", GATEWAY + "/admin-chat?theme=babuba");
        }
      });
    }
  }
  function closeChat() {
    panel.classList.remove("open");
    btn.style.display = "flex";
  }

  btn.addEventListener("click", openChat);
  closeBtn.addEventListener("click", closeChat);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) closeChat();
  });
})();
