/* ═══════════ Babuba SaaS — app.js ═══════════
 * Landing page animations + the guided onboarding wizard:
 * questions → answers → plan → payment → provisioning
 */
(function () {
  "use strict";

  /* ── hero canvas: agent network animation ── */
  const cv = document.getElementById("hero-canvas");
  const ctx = cv.getContext("2d");
  let W, H, nodes = [], particles = [];
  function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
  resize(); addEventListener("resize", resize);

  const NODE_COUNT = 26;
  function spawnNodes() {
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
        r: 3 + Math.random() * 4,
        hue: Math.random() > .5 ? "0,229,160" : "77,124,254",
      });
    }
  }
  spawnNodes(); addEventListener("resize", spawnNodes);

  function drawNet() {
    ctx.clearRect(0, 0, W, H);
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 150) {
          ctx.strokeStyle = `rgba(${a.hue},${(1 - d / 150) * .35})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    for (const n of nodes) {
      ctx.fillStyle = `rgba(${n.hue},.7)`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
    }
    // floating particles
    if (particles.length < 40) particles.push({ x: Math.random() * W, y: H + 10, s: 1 + Math.random() * 2, o: Math.random() * .5 + .2 });
    particles = particles.filter(p => p.y > -20);
    for (const p of particles) { p.y -= p.s; ctx.fillStyle = `rgba(0,229,160,${p.o})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, 7); ctx.fill(); }
    requestAnimationFrame(drawNet);
  }
  drawNet();

  /* ── wizard state ── */
  const answers = {};
  let plan = null, plans = [], testMode = true;
  let step = 0, payResolved = false;

  const $ = (id) => document.getElementById(id);
  const chat = $("wiz-chat"), textInput = $("wiz-text"), sendBtn = $("wiz-send");

  /* ── wizard flow definition ── */
  const FLOW = [
    {
      q: "Hi! 👋 I'm Babuba's Setup Concierge. I'll build your AI agent in about 2 minutes.\n\nFirst — what's your company name?",
      key: "company", type: "text", next: "auto",
    },
    {
      q: () => `Nice to meet you, ${answers.company || "friend"}! 🎉\n\nWhat should your agent be called? (or type "same" to use ${answers.company || "your company name"})`,
      key: "agentName", type: "text",
      transform: (v) => (v.toLowerCase() === "same" ? answers.company : v),
      next: "auto",
    },
    {
      q: "What should your agent primarily do for your business?",
      key: "purpose", type: "chips", multi: false,
      options: [
        "Customer support & FAQs",
        "Sales & lead qualification",
        "HR & employee services",
        "Finance & invoice processing",
        "IT & operations automation",
        "General business assistant",
      ],
      next: "auto",
    },
    {
      q: "Give me a bit more detail — what does a typical day look like for this agent?",
      key: "description", type: "text", next: "auto",
    },
    {
      q: "Which department does this agent belong to?",
      key: "department", type: "chips", multi: false,
      options: ["hr", "finance", "it", "legal", "egc", "general", "customer-support", "sales"],
      next: "auto",
    },
    {
      q: "Which channels should your agent live on? (select all that apply)",
      key: "channels", type: "chips", multi: true,
      options: ["WhatsApp", "Telegram", "Gmail", "Slack", "Website chat"],
      next: "auto",
    },
    {
      q: "🛡️ Now governance. How strict should your agent's risk threshold be?",
      key: "riskThreshold", type: "chips", multi: false,
      options: [
        { label: "Low — strict (block sensitive topics)", value: "low" },
        { label: "Medium — balanced (warn on sensitive)", value: "medium" },
        { label: "High — permissive (allow with review)", value: "high" },
      ],
      next: "auto",
    },
    {
      q: "Are there any topics your agent should NEVER touch? (select all — leave empty to skip)",
      key: "guardrails", type: "chips", multi: true,
      options: [
        "PII / personal data",
        "Financial advice",
        "Medical / health advice",
        "Legal advice",
        "Confidential internal data",
        "Pricing & discounts",
        "Contract negotiations",
      ],
      next: "auto",
    },
    {
      q: "Guardrail mode — what should happen when a topic is hit?",
      key: "guardrailsMode", type: "chips", multi: false,
      options: [
        { label: "Deny — refuse to answer", value: "deny" },
        { label: "Warn — answer with a warning", value: "warn" },
        { label: "Handoff — route to a human", value: "handoff" },
      ],
      next: "auto",
    },
    {
      q: "Any compliance standards to enforce? (select all — empty to skip)",
      key: "compliance", type: "chips", multi: true,
      options: ["GDPR", "SOX", "HIPAA", "None"],
      next: "auto",
    },
    {
      q: "🔐 Access control. Who should be the admin of this agent? (name + phone/WhatsApp number, e.g. \"Rahul — +91 98765 43210\")",
      key: "adminContact", type: "text", next: "auto",
    },
    {
      q: "Should sensitive actions (payments, deletions, exports) require human approval?",
      key: "approvals", type: "chips", multi: false,
      options: [
        { label: "Yes — always require approval", value: "yes" },
        { label: "Only for high-risk actions", value: "high-risk" },
        { label: "No — agent acts autonomously", value: "no" },
      ],
      next: "auto",
    },
    {
      q: "What language should your agent primarily respond in?",
      key: "language", type: "chips", multi: false,
      options: ["English", "Hindi", "Malayalam", "Tamil", "Hinglish (mixed)", "Other"],
      next: "auto",
    },
    {
      q: "Last one before payment 💳 — what's the best email for your dashboard login?",
      key: "email", type: "text", next: "auto",
    },
    {
      q: "And your phone number (for WhatsApp admin access)?",
      key: "phone", type: "text", next: "pay",
    },
  ];

  const TOTAL = FLOW.length;

  /* ── helpers ── */
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function botMsg(html) { const m = el("div", "msg bot", html); chat.appendChild(m); scroll(); return m; }
  function userMsg(html) { const m = el("div", "msg user", html); chat.appendChild(m); scroll(); return m; }
  function typing() { const m = el("div", "msg bot typing", "<span></span><span></span><span></span>"); chat.appendChild(m); scroll(); return m; }
  function scroll() { chat.scrollTop = chat.scrollHeight; }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function evalStr(s) { return typeof s === "function" ? s() : s; }

  async function say(q) {
    const t = typing();
    await sleep(500 + Math.random() * 400);
    t.outerHTML = `<div class="msg bot">${evalStr(q)}</div>`;
    scroll();
  }

  function showChips(opts, multi, onPick) {
    const wrap = el("div", "chips");
    const state = new Set();
    opts.forEach((o) => {
      const label = typeof o === "string" ? o : o.label;
      const value = typeof o === "string" ? o : o.value;
      const c = el("button", "chip", label);
      c.onclick = () => {
        if (multi) {
          if (state.has(value)) { state.delete(value); c.classList.remove("sel"); }
          else { state.add(value); c.classList.add("sel"); }
        } else {
          state.clear(); state.add(value);
          [...wrap.children].forEach((x) => x.classList.remove("sel"));
          c.classList.add("sel");
        }
      };
      wrap.appendChild(c);
    });
    const okBtn = el("button", "chip", multi ? "✓ Done" : "✓ Select");
    okBtn.style.borderColor = "var(--acc)";
    okBtn.style.color = "var(--acc)";
    okBtn.onclick = () => onPick([...state]);
    wrap.appendChild(okBtn);
    chat.appendChild(wrap); scroll();
    return wrap;
  }

  /* ── run flow ── */
  async function runFlow() {
    await sleep(600);
    await say(FLOW[0].q);
    textInput.focus();
  }

  function advance() {
    step++;
    const pct = Math.min(100, Math.round((step / TOTAL) * 100));
    $("wiz-progress").style.width = pct + "%";
    if (step >= TOTAL) { showPay(); return; }
    const f = FLOW[step];
    setTimeout(async () => {
      await say(f.q);
      if (f.type === "chips") {
        const wrap = showChips(f.options, f.multi, (vals) => {
          wrap.remove();
          answers[f.key] = vals;
          userMsg(vals.length ? vals.join(", ") : "— skip —");
          advance();
        });
      } else {
        textInput.focus();
      }
    }, 600);
  }

  /* ── input handling ── */
  function handleText() {
    const v = textInput.value.trim();
    if (!v) return;
    textInput.value = "";
    const f = FLOW[step];
    if (!f || f.type !== "text") return;
    const val = f.transform ? f.transform(v) : v;
    answers[f.key] = val;
    userMsg(v);
    advance();
  }
  sendBtn.onclick = handleText;
  textInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleText(); });

  /* ── pricing & payment ── */
  async function loadPlans() {
    try {
      const r = await fetch("/api/plans");
      const j = await r.json();
      plans = j.plans || [];
      testMode = !!j.testMode;
      $("pay-note").textContent = testMode ? "🔧 Test mode — no real charge (no payment keys configured yet)" : "Secured by Razorpay";
    } catch (e) { /* offline fallback */ }
  }

  async function showPay() {
    await loadPlans();
    if (!plan) plan = plans.find((p) => p.id === "growth") || plans[1] || { name: "Growth", price: 3999, currency: "INR" };
    const sum = $("pay-summary");
    sum.innerHTML = `
      <div class="row"><span>Company</span><b>${escapeHtml(answers.company || "—")}</b></div>
      <div class="row"><span>Agent</span><b>${escapeHtml(answers.agentName || "—")}</b></div>
      <div class="row"><span>Channels</span><b>${(answers.channels || []).join(", ") || "—"}</b></div>
      <div class="row"><span>Plan</span><b>${plan.name} · ${plan.agents} agent${plan.agents > 1 ? "s" : ""}</b></div>
      <div class="row total"><span>Total</span><b>₹${plan.price.toLocaleString("en-IN")}/mo</b></div>`;
    textInput.closest(".wizard-input").hidden = true;
    $("wiz-pay").hidden = false;
  }

  $("pay-btn").onclick = async () => {
    if (payResolved) return;
    payResolved = true;
    const btn = $("pay-btn");
    btn.textContent = "Processing…";
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, company: answers.company, email: answers.email }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || "checkout failed");
      // In test mode: provision directly. In live mode: Razorpay Checkout would open here.
      if (j.testMode || !window.Razorpay) {
        btn.textContent = "Provisioning your agent…";
        const p = await fetch("/api/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wizard: answers, planId: plan.id, orderId: j.order?.id }),
        });
        const pr = await p.json();
        if (!pr.success) throw new Error(pr.error || "provision failed");
        finish(pr);
      } else {
        const rzp = new window.Razorpay({
          key: j.keyId, amount: j.order.amount, currency: j.order.currency,
          order_id: j.order.id, name: "Babuba", description: plan.name + " plan",
          handler: async (res) => {
            const p = await fetch("/api/provision", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ wizard: answers, planId: plan.id, orderId: res.razorpay_order_id, paymentId: res.razorpay_payment_id }),
            });
            finish(await p.json());
          },
          modal: { ondismiss: () => { payResolved = false; btn.textContent = "Pay now"; } },
        });
        rzp.open();
      }
    } catch (e) {
      payResolved = false;
      btn.textContent = "Pay now";
      toast("Payment failed: " + e.message, "err");
    }
  };

  function finish(pr) {
    $("wiz-pay").hidden = true;
    chat.innerHTML = "";
    const ok = el("div", "msg bot",
      `🎉 <b>Your agent is live!</b>\n\n` +
      `- Agent: <b>${escapeHtml(pr.agent?.name || answers.agentName)}</b>\n` +
      `- ID: <code>${pr.agent?.id || "agent-" + (answers.agentName || "x").toLowerCase().replace(/\\s+/g, "-")}</code>\n` +
      `- Tenant: <b>${pr.tenant ? pr.tenant.slug + " (port " + pr.tenant.port + ")" : "main gateway"}</b>\n` +
      `- Dashboard: <a href="${pr.dashboardUrl || "/admin"}" target="_blank" style="color:var(--acc)">${pr.dashboardUrl || "/admin"}</a>\n\n` +
      `Our team has been notified. You'll receive login credentials at <b>${escapeHtml(answers.email || "your email")}</b> shortly. Welcome to Babuba! 🚀`
    );
    chat.appendChild(ok); scroll();
    toast("🎉 Agent provisioned successfully!", "ok");
  }

  /* ── toast ── */
  function toast(msg, type) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast " + (type || "");
    t.hidden = false;
    setTimeout(() => { t.hidden = true; }, 6000);
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ── open wizard ── */
  function openWizard() {
    $("wizard").hidden = false;
    document.body.style.overflow = "hidden";
    if (!chat.children.length) runFlow();
  }
  function closeWizard() {
    $("wizard").hidden = true;
    document.body.style.overflow = "";
  }
  $("wiz-close").onclick = closeWizard;
  $("nav-launch").onclick = (e) => { e.preventDefault(); openWizard(); };
  $("hero-launch").onclick = (e) => { e.preventDefault(); openWizard(); };
  document.querySelectorAll("[data-choose]").forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      plan = plans.find((p) => p.id === a.dataset.choose) || null;
      openWizard();
    };
  });
  $("wizard").addEventListener("click", (e) => { if (e.target === $("wizard")) closeWizard(); });

  /* ── init ── */
  loadPlans();
})();
