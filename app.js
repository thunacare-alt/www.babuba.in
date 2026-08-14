/* Babuba web chat widget — talks to the Babuba gateway via admin-chat API */
const GATEWAY = "https://rhode-header-beef-mouth.trycloudflare.com"; // quick tunnel (dies on restart) — TODO: stable https://babuba.chaya.in via named tunnel + CNAME

const $ = (s) => document.querySelector(s);
const state = { sessionId: null, busy: false };

/* ── Create a chat session ─────────────────────────── */
async function ensureSession() {
  if (state.sessionId) return state.sessionId;
  const visitorId = "web-" + Math.random().toString(36).slice(2, 10);
  const res = await fetch(GATEWAY + "/api/admin-chat/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "super-admin", userId: visitorId, channel: "web-chat" }),
  });
  if (!res.ok) throw new Error("session failed: " + res.status);
  const data = await res.json();
  state.sessionId = data.sessionId;
  return state.sessionId;
}

/* ── Send a message and stream the reply (SSE) ─────── */
async function sendMessage(text) {
  const sessionId = await ensureSession();
  const res = await fetch(GATEWAY + "/api/admin-chat/send?session=" + encodeURIComponent(sessionId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }),
  });
  if (!res.ok) throw new Error("send failed: " + res.status);
  return res; // text/event-stream
}

function parseSSE(text) {
  let out = "";
  for (const line of text.split("\n")) {
    const m = line.match(/^data:\s?(.*)$/);
    if (m && m[1] !== "[DONE]") {
      try { const j = JSON.parse(m[1]); out += j.text || j.content || j.delta || ""; }
      catch { out += m[1] + "\n"; }
    }
  }
  return out.trim();
}

/* ── UI helpers ────────────────────────────────────── */
function addMsg(container, text, who) {
  const el = document.createElement("div");
  el.className = "msg " + (who === "user" ? "msg-user" : "msg-bot");
  el.textContent = text;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}
function typing(container) {
  const el = document.createElement("div");
  el.className = "msg msg-bot typing";
  el.textContent = "Babuba is typing…";
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

async function handleSend(input, container) {
  const text = input.value.trim();
  if (!text || state.busy) return;
  input.value = "";
  addMsg(container, text, "user");
  const t = typing(container);
  state.busy = true;
  try {
    const res = await sendMessage(text);
    const body = await res.text();
    const reply = parseSSE(body) || "I couldn't process that — the gateway may be offline.";
    t.remove();
    addMsg(container, reply, "bot");
  } catch (e) {
    t.remove();
    addMsg(container, "⚠️ Connection error: " + e.message, "bot");
  }
  state.busy = false;
}

/* ── Wire up demo + widget ─────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  // Inline demo chat
  const dInput = $("#demoInput"), dSend = $("#demoSend"), dChat = $("#demoChat");
  const doDemo = () => handleSend(dInput, dChat);
  dSend.addEventListener("click", doDemo);
  dInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doDemo(); });

  // Floating widget
  const fab = $("#fab"), widget = $("#widget"), wInput = $("#widgetInput"), wSend = $("#widgetSend"), wBody = $("#widgetBody");
  fab.addEventListener("click", () => { widget.hidden = !widget.hidden; if (!widget.hidden) wInput.focus(); });
  $("#widgetClose").addEventListener("click", () => { widget.hidden = true; });
  const doWidget = () => handleSend(wInput, wBody);
  wSend.addEventListener("click", doWidget);
  wInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doWidget(); });
});
