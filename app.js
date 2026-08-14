/* Babuba web chat widget — talks to the Babuba gateway via admin-chat API */
const GATEWAY = "https://rhode-header-beef-mouth.trycloudflare.com"; // quick tunnel (dies on restart) — TODO: stable https://babuba.chaya.in via named tunnel + CNAME
const AGENT_ID = "agent-sales--marketing-babuba-sales"; // dedicated sales agent — talks ONLY about Babuba

const $ = (s) => document.querySelector(s);
const state = { sessionId: null, busy: false };

/* ── Create a chat session ─────────────────────────── */
async function ensureSession() {
  if (state.sessionId) return state.sessionId;
  const visitorId = "web-" + Math.random().toString(36).slice(2, 10);
  const res = await fetch(GATEWAY + "/api/admin-chat/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: AGENT_ID, userId: visitorId, channel: "web-chat" }),
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

/* ── UI helpers ────────────────────────────────────── */
function addMsg(container, text, who) {
  const el = document.createElement("div");
  el.className = "msg " + (who === "user" ? "msg-user" : "msg-bot");
  el.innerHTML = text;
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
  addMsg(container, escapeHtml(text), "user");
  const t = typing(container);
  state.busy = true;
  let replyEl = null;
  let got = false;
  try {
    const res = await sendMessage(text);
    if (!res.ok || !res.body) throw new Error("gateway error " + res.status);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let j; try { j = JSON.parse(payload); } catch { continue; }
        if (j.type === "progress") continue; // skip tool-progress noise
        const piece = j.text || j.delta || j.content || "";
        if (!piece) continue;
        if (!got) { t.remove(); replyEl = addMsg(container, "", "bot"); got = true; }
        replyEl.textContent += piece;
        container.scrollTop = container.scrollHeight;
      }
    }
    if (!got) { t.remove(); addMsg(container, "Hmm, I didn't get a reply — the gateway may be busy. Try again!", "bot"); }
  } catch (e) {
    t.remove();
    addMsg(container, "⚠️ Connection error: " + escapeHtml(e.message), "bot");
  }
  state.busy = false;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ── Wire up demo + widget ─────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const dInput = $("#demoInput"), dSend = $("#demoSend"), dChat = $("#demoChat");
  const doDemo = () => handleSend(dInput, dChat);
  dSend.addEventListener("click", doDemo);
  dInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doDemo(); });

  const fab = $("#fab"), widget = $("#widget"), wInput = $("#widgetInput"), wSend = $("#widgetSend"), wBody = $("#widgetBody");
  fab.addEventListener("click", () => { widget.hidden = !widget.hidden; if (!widget.hidden) wInput.focus(); });
  $("#widgetClose").addEventListener("click", () => { widget.hidden = true; });
  const doWidget = () => handleSend(wInput, wBody);
  wSend.addEventListener("click", doWidget);
  wInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doWidget(); });
});
