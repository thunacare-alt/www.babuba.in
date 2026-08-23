/* BABUBA //GATEWAY - agent orchestration canvas v2
 * Per-page choreography variants, chosen via data-variant on <canvas class="agent-canvas">:
 *   parallel (index)    - one task fans out to 4 agents, results merge into one answer
 *   classify (agents)   - router scores intent and dispatches to the single best agent
 *   pipeline (platform) - task flows through gateway -> agents -> tools -> data -> answer
 *   audit (security)    - request passes RBAC/guardrail/approval gates; some get denied
 *   meter (pricing)     - seat/license tick, metered usage, one answer
 * Self-contained. No deps. Respects prefers-reduced-motion (static frame).
 */
(function () {
  "use strict";

  var REDUCE =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var HEX = { volt: "#C9F24B", cyan: "#7DD3FC", teal: "#5EEAD4", red: "#F87171", text: "#E8E8E2" };
  function rgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  var COLS = {
    grid: "rgba(232,232,226,0.05)",
    edge: "rgba(232,232,226,0.13)",
    node: "#111113",
    nodeStroke: "rgba(232,232,226,0.16)",
    text: "#E8E8E2",
    faint: "#82827B",
    dim: "rgba(232,232,226,0.55)",
    bg: "#0A0A0B"
  };

  function clamp01(u) { return u < 0 ? 0 : u > 1 ? 1 : u; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function easeInOut(u) {
    u = clamp01(u);
    return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  }
  function bez(p0, p1, p2, u) {
    var iu = 1 - u;
    return {
      x: iu * iu * p0.x + 2 * iu * u * p1.x + u * u * p2.x,
      y: iu * iu * p0.y + 2 * iu * u * p1.y + u * u * p2.y
    };
  }
  function dirOf(E, u) {
    var p0 = bez(E.a, E.c, E.b, Math.max(0, u - 0.01));
    var p1 = bez(E.a, E.c, E.b, Math.min(1, u + 0.01));
    var dx = p1.x - p0.x, dy = p1.y - p0.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }
  function edge(a, b) {
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    var bow = Math.min(30, len * 0.16);
    return { a: a, c: { x: mx + (-dy / len) * bow, y: my + (dx / len) * bow }, b: b };
  }
  function pkt(tt, start, dur, E) {
    if (tt < start) return null;
    var u = (tt - start) / dur;
    if (u > 1) return null;
    u = easeInOut(u);
    var p = bez(E.a, E.c, E.b, u);
    p.u = u;
    return p;
  }

  var MONO = "'JetBrains Mono', monospace";

  function drawGrid(ctx, W, H) {
    ctx.fillStyle = COLS.grid;
    var step = 26;
    for (var x = 0; x < W; x += step)
      for (var y = 0; y < H; y += step) ctx.fillRect(x, y, 1, 1);
  }

  function drawPort(ctx, N, side, label, W) {
    ctx.font = "600 9px " + MONO;
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLS.faint;
    if (side === "in") {
      ctx.textAlign = "left";
      ctx.fillText(label, 6, N.y - 16);
      ctx.textAlign = "left";
      ctx.fillText(">>", 6, N.y);
    } else {
      ctx.textAlign = "right";
      ctx.fillText(label, W - 6, N.y - 16);
      ctx.textAlign = "right";
      ctx.fillText("<<", W - 6, N.y);
    }
    ctx.strokeStyle = COLS.dim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(N.x - (side === "in" ? 14 : 0), N.y);
    ctx.lineTo(N.x, N.y);
    ctx.stroke();
  }

  function traceEdge(ctx, E, color, alpha, lw) {
    ctx.beginPath();
    ctx.moveTo(E.a.x, E.a.y);
    ctx.quadraticCurveTo(E.c.x, E.c.y, E.b.x, E.b.y);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawNode(ctx, n, tt, opts) {
    var r = n.r * (1 + 0.05 * Math.sin(tt / 320 + (n.ph || 0)));
    var stroke = opts.stroke || COLS.nodeStroke;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = opts.fill || COLS.node;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = opts.lw || 1.2;
    ctx.stroke();
    ctx.fillStyle = opts.text || COLS.text;
    ctx.font = (opts.fs || 9.5) + "px " + MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.label, n.x, n.y + (n.labelDy || 0));
  }

  function drawStatus(ctx, n, txt, color, alpha) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.font = "600 9.5px " + MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(txt, n.x, n.y - n.r - 8);
    ctx.globalAlpha = 1;
  }

  function drawPkt(ctx, p, dir, color, label, W, H) {
    var g = ctx.createLinearGradient(p.x - dir.x * 20, p.y - dir.y * 20, p.x, p.y);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, 0.5));
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x - dir.x * 20, p.y - dir.y * 20);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = rgba(color, 0.45);
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (label) {
      ctx.fillStyle = color;
      ctx.font = "600 9.5px " + MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      var lx = Math.max(64, Math.min(p.x, W - 64));
      ctx.fillText(label, lx, Math.max(14, p.y - 10));
    }
  }

  function ring(ctx, tt, start, dur, g, r0, r1, color) {
    if (tt < start || tt > start + dur) return;
    var u = (tt - start) / dur;
    ctx.beginPath();
    ctx.arc(g.x, g.y, lerp(r0, r1, u), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(color, 0.5 * (1 - u));
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* ------------------------------------------------ variants */

  var VARIANTS = {
    parallel: {
      T: 8000,
      gwR: 34, agR: 22,
      agents: [
        { id: "FIN", label: "FINANCE", statuses: ["parse", "validate", "matched"] },
        { id: "OPS", label: "OPS", statuses: ["check", "verify", "done"] },
        { id: "MIS", label: "MIS", statuses: ["build", "rollup", "done"] },
        { id: "ADM", label: "ADMIN", statuses: ["audit", "gate", "approved"] }
      ],
      colors: { main: HEX.volt, deny: HEX.red }
    },
    classify: {
      T: 8000,
      gwR: 32, agR: 20,
      agents: [
        { id: "FIN", label: "FINANCE", statuses: ["intent scored", "route matched", "dispatched"] },
        { id: "OPS", label: "OPS", statuses: ["intent scored", "route matched", "dispatched"] },
        { id: "MIS", label: "MIS", statuses: ["intent scored", "route matched", "dispatched"] },
        { id: "ADM", label: "ADMIN", statuses: ["intent scored", "route matched", "dispatched"] }
      ],
      colors: { main: HEX.volt, scan: HEX.cyan }
    },
    pipeline: {
      T: 8000,
      gwR: 30, agR: 18, toolR: 16,
      agents: [
        { id: "FIN", label: "FINANCE", statuses: ["parse", "validate", "matched"] },
        { id: "OPS", label: "OPS", statuses: ["parse", "validate", "matched"] },
        { id: "MIS", label: "MIS", statuses: ["parse", "validate", "matched"] },
        { id: "ADM", label: "ADMIN", statuses: ["parse", "validate", "matched"] }
      ],
      tools: [
        { label: "SHEETS", op: "read" },
        { label: "DB", op: "query" },
        { label: "MAIL", op: "send" },
        { label: "API", op: "call" }
      ],
      colors: { main: HEX.volt, tool: HEX.teal }
    },
    audit: {
      T: 8000,
      gwR: 30, gateR: 18, agR: 22, reqR: 20,
      gates: [
        { label: "RBAC", ok: "rbac ok" },
        { label: "GUARDRAIL", ok: "policy ok" },
        { label: "APPROVAL", ok: "approved" }
      ],
      agents: [{ id: "AUD", label: "AUDITOR", statuses: ["audit", "logged"] }],
      colors: { main: HEX.volt, deny: HEX.red }
    },
    meter: {
      T: 8000,
      gwR: 30, licR: 20, agR: 24,
      agents: [{ id: "SEA", label: "AGENT", statuses: ["verify key", "license ok", "metered"] }],
      colors: { main: HEX.volt }
    }
  };

  /* ------------------------------------------------ engines */

  var engines = [];

  function buildScene(v, W, H) {
    var gw = { x: W * 0.5, y: H * 0.5, r: v.gwR, label: "BABUBA//GATEWAY", ph: 0 };
    var S = { gw: gw };

    if (v.variant === "parallel") {
      S.agents = [
        { x: W * 0.26, y: H * 0.2, r: v.agR, label: "FINANCE", ph: 1 },
        { x: W * 0.74, y: H * 0.2, r: v.agR, label: "OPS", ph: 2 },
        { x: W * 0.26, y: H * 0.8, r: v.agR, label: "MIS", ph: 3 },
        { x: W * 0.74, y: H * 0.8, r: v.agR, label: "ADMIN", ph: 4 }
      ];
      S.in = { x: 16, y: H * 0.5 };
      S.out = { x: W - 16, y: H * 0.5 };
      S.inEdge = edge(S.in, S.gw);
      S.fan = S.agents.map(function (a) { return edge(S.gw, a); });
      S.res = S.agents.map(function (a) { return edge(a, S.gw); });
      S.outEdge = edge(S.gw, S.out);
      return S;
    }

    if (v.variant === "classify") {
      S.agents = [
        { x: W * 0.8, y: H * 0.14, r: v.agR, label: "FINANCE", ph: 1 },
        { x: W * 0.8, y: H * 0.38, r: v.agR, label: "OPS", ph: 2 },
        { x: W * 0.8, y: H * 0.62, r: v.agR, label: "MIS", ph: 3 },
        { x: W * 0.8, y: H * 0.86, r: v.agR, label: "ADMIN", ph: 4 }
      ];
      S.gw.x = W * 0.36;
      S.in = { x: 16, y: H * 0.5 };
      S.out = { x: W - 16, y: H * 0.5 };
      S.inEdge = edge(S.in, S.gw);
      S.links = S.agents.map(function (a) { return edge(S.gw, a); });
      S.exits = S.agents.map(function (a) { return edge(a, S.out); });
      return S;
    }

    if (v.variant === "pipeline") {
      var ax = [0.2, 0.4, 0.6, 0.8];
      S.agents = ax.map(function (fx, i) {
        return { x: W * fx, y: H * 0.52, r: v.agR, label: ["FINANCE", "OPS", "MIS", "ADMIN"][i], ph: i + 1 };
      });
      S.tools = ax.map(function (fx, i) {
        return { x: W * fx, y: H * 0.86, r: v.toolR, label: v.tools[i].label, ph: i + 1 };
      });
      S.gw.x = W * 0.5; S.gw.y = H * 0.3;
      S.in = { x: 16, y: H * 0.5 };
      S.out = { x: W - 16, y: H * 0.5 };
      S.inEdge = edge(S.in, S.gw);
      S.fan = S.agents.map(function (a) { return edge(S.gw, a); });
      S.down = S.agents.map(function (a, i) { return edge(a, S.tools[i]); });
      S.up = S.tools.map(function (t, i) { return edge(t, S.agents[i]); });
      S.back = S.agents.map(function (a) { return edge(a, S.gw); });
      S.outEdge = edge(S.gw, S.out);
      return S;
    }

    if (v.variant === "audit") {
      S.req = { x: W * 0.1, y: H * 0.5, r: v.reqR, label: "REQUEST", ph: 0 };
      S.gw.x = W * 0.3;
      S.gates = [
        { x: W * 0.56, y: H * 0.22, r: v.gateR, label: "RBAC", ph: 1 },
        { x: W * 0.56, y: H * 0.5, r: v.gateR, label: "GUARDRAIL", ph: 2 },
        { x: W * 0.56, y: H * 0.78, r: v.gateR, label: "APPROVAL", ph: 3 }
      ];
      S.agents = [{ x: W * 0.84, y: H * 0.5, r: v.agR, label: "AUDITOR", ph: 4 }];
      S.in = { x: 16, y: H * 0.5 };
      S.out = { x: W - 16, y: H * 0.5 };
      S.inEdge = edge(S.req, S.gw);
      S.chain = [edge(S.gw, S.gates[0]), edge(S.gates[0], S.gates[1]), edge(S.gates[1], S.gates[2])];
      S.toAgent = edge(S.gates[2], S.agents[0]);
      S.outEdge = edge(S.agents[0], S.out);
      S.denyBack = S.gates.map(function (g) { return edge(g, S.req); });
      S.denyOut = edge(S.req, S.in);
      return S;
    }

    if (v.variant === "meter") {
      S.lic = { x: W * 0.14, y: H * 0.5, r: v.licR, label: "LICENSE", ph: 0 };
      S.gw.x = W * 0.45;
      S.agents = [{ x: W * 0.72, y: H * 0.5, r: v.agR, label: "AGENT", ph: 1 }];
      S.in = { x: 16, y: H * 0.5 };
      S.out = { x: W - 16, y: H * 0.5 };
      S.inEdge = edge(S.lic, S.gw);
      S.toAgent = edge(S.gw, S.agents[0]);
      S.outEdge = edge(S.agents[0], S.out);
      return S;
    }

    return S;
  }

  function makeEngine(cv, variant) {
    var v = VARIANTS[variant] || VARIANTS.parallel;
    v.variant = variant;
    var ctx = cv.getContext("2d");
    var W = 0, H = 0, dpr = 1;
    var S = null, tt = 0, cycle = 0, last = 0, running = false, visible = true;
    var denyGate = -1, denyCycle = -1, denyCount = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth || 900;
      H = cv.clientHeight || 430;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = buildScene(v, W, H);
      if (REDUCE || !running) drawStatic();
    }

    function drawStatic() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = COLS.bg;
      ctx.fillRect(0, 0, W, H);
      drawGrid(ctx, W, H);
      drawEdgesFaint();
      drawNodes(0);
      drawPorts(0);
    }

    function drawPorts(tt) {
      var labels = {
        parallel: ["IN", "OUT"],
        classify: ["TASK", "OUT"],
        pipeline: ["TASK", "ANSWER"],
        audit: ["REQ", "OUT"],
        meter: ["SEAT", "OUT"]
      }[v.variant] || ["IN", "OUT"];
      drawPort(ctx, S.in, "in", labels[0], W);
      drawPort(ctx, S.out, "out", labels[1], W);
    }

    function allEdges() {
      var E = [];
      if (S.inEdge) E.push(S.inEdge);
      if (S.outEdge) E.push(S.outEdge);
      (S.fan || []).forEach(function (e) { E.push(e); });
      (S.res || []).forEach(function (e) { E.push(e); });
      (S.links || []).forEach(function (e) { E.push(e); });
      (S.exits || []).forEach(function (e) { E.push(e); });
      (S.down || []).forEach(function (e) { E.push(e); });
      (S.up || []).forEach(function (e) { E.push(e); });
      (S.back || []).forEach(function (e) { E.push(e); });
      (S.chain || []).forEach(function (e) { E.push(e); });
      if (S.toAgent) E.push(S.toAgent);
      (S.denyBack || []).forEach(function (e) { E.push(e); });
      if (S.denyOut) E.push(S.denyOut);
      return E;
    }

    function drawEdgesFaint() {
      var E = allEdges();
      for (var i = 0; i < E.length; i++) traceEdge(ctx, E[i], COLS.edge, 1, 1);
    }

    function drawNodes(tt) {
      if (S.gw) drawNode(ctx, S.gw, tt, {});
      (S.agents || []).forEach(function (n, i) {
        drawNode(ctx, n, tt, { stroke: i === activeAgent() ? rgba(v.colors.main, 0.9) : COLS.nodeStroke, lw: i === activeAgent() ? 2 : 1.2 });
      });
      (S.tools || []).forEach(function (n) {
        drawNode(ctx, n, tt, { stroke: rgba(v.colors.tool || HEX.volt, 0.55), text: rgba(v.colors.tool || HEX.volt, 0.9), fs: 8.5 });
      });
      (S.gates || []).forEach(function (n) {
        drawNode(ctx, n, tt, {});
      });
      if (S.req) drawNode(ctx, S.req, tt, {});
      if (S.lic) drawNode(ctx, S.lic, tt, {});
    }

    var _active = -1;
    function activeAgent() {
      if (v.variant === "classify") return _active;
      if (v.variant === "audit") return denyCycle === cycle ? -1 : 0;
      if (v.variant === "meter") return 0;
      return -1;
    }

    function inRange(tt, a, b) { return tt >= a && tt <= b; }

    function statusFor(tt, seq, n) {
      // seq: array of {t, txt} relative windows; return text or null
      for (var i = 0; i < seq.length; i++) {
        if (tt >= seq[i].t && tt <= seq[i].t + 900) return { txt: seq[i].txt, u: (tt - seq[i].t) / 900 };
      }
      return null;
    }

    function drawFrame(tt, cycle) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = COLS.bg;
      ctx.fillRect(0, 0, W, H);
      drawGrid(ctx, W, H);
      drawEdgesFaint();

      var C = v.colors;
      var c0 = cycle % 4;

      if (v.variant === "parallel") {
        drawPorts(tt);
        // faint agent statuses always drawn when idle
        drawNodes(tt);
        var pk;
        pk = pkt(tt, 0, 1000, S.inEdge);
        if (pk) drawPkt(ctx, pk, dirOf(S.inEdge, pk.u), C.main, "TASK: RECONCILE", W, H);
        for (var i = 0; i < 4; i++) {
          var fs = 1000 + i * 160, fr = 4800 + i * 160;
          pk = pkt(tt, fs, 380, S.fan[i]);
          if (pk) drawPkt(ctx, pk, dirOf(S.fan[i], pk.u), C.main, null, W, H);
          if (inRange(tt, fs + 200, fs + 200 + 2600)) {
            var idx = Math.floor((tt - fs - 200) / 900);
            if (idx < 3) drawStatus(ctx, S.agents[i], v.agents[i].statuses[idx], C.main, 1);
          }
          pk = pkt(tt, fr, 380, S.res[i]);
          if (pk) drawPkt(ctx, pk, dirOf(S.res[i], pk.u), C.main, null, W, H);
        }
        ring(ctx, tt, 1000, 700, S.gw, S.gw.r, S.gw.r + 34, C.main);
        ring(ctx, tt, 4800, 700, S.gw, S.gw.r, S.gw.r + 34, C.main);
        pk = pkt(tt, 6400, 800, S.outEdge);
        if (pk) drawPkt(ctx, pk, dirOf(S.outEdge, pk.u), C.main, "ANSWER: 47/47 MATCHED", W, H);
        return;
      }

      if (v.variant === "classify") {
        _active = c0;
        drawPorts(tt);
        drawNodes(tt);
        pk = pkt(tt, 0, 900, S.inEdge);
        if (pk) drawPkt(ctx, pk, dirOf(S.inEdge, pk.u), C.main, "TASK: RECONCILE", W, H);
        // scan sweep
        if (inRange(tt, 950, 1500)) {
          var su = (tt - 950) / 550;
          var sx = lerp(W * 0.5, W * 0.9, su);
          var grad = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
          grad.addColorStop(0, rgba(C.scan, 0));
          grad.addColorStop(0.5, rgba(C.scan, 0.7));
          grad.addColorStop(1, rgba(C.scan, 0));
          ctx.fillStyle = grad;
          ctx.fillRect(sx - 30, H * 0.06, 60, H * 0.88);
          ctx.fillStyle = C.scan;
          ctx.font = "600 9.5px " + MONO;
          ctx.textAlign = "center";
          ctx.fillText("SCORE", sx, H * 0.04);
          ctx.fillStyle = rgba(C.scan, 0.5);
          ctx.fillRect(sx - 0.5, H * 0.06, 1, H * 0.88);
        }
        // chosen agent link bright
        var link = S.links[c0], exit = S.exits[c0];
        traceEdge(ctx, link, rgba(C.main, 0.45), 1, 1.5);
        pk = pkt(tt, 1500, 500, link);
        if (pk) drawPkt(ctx, pk, dirOf(link, pk.u), C.main, "AGENT: " + v.agents[c0].id, W, H);
        if (inRange(tt, 2100, 2100 + 2700)) {
          var idx2 = Math.floor((tt - 2100) / 900);
          if (idx2 < 3) drawStatus(ctx, S.agents[c0], v.agents[c0].statuses[idx2], C.main, 1);
        }
        traceEdge(ctx, exit, rgba(C.main, 0.45), 1, 1.5);
        pk = pkt(tt, 5000, 600, exit);
        if (pk) drawPkt(ctx, pk, dirOf(exit, pk.u), C.main, "DISPATCHED", W, H);
        ring(ctx, tt, 1500, 500, S.gw, S.gw.r, S.gw.r + 30, C.main);
        return;
      }

      if (v.variant === "pipeline") {
        drawPorts(tt);
        drawNodes(tt);
        pk = pkt(tt, 0, 800, S.inEdge);
        if (pk) drawPkt(ctx, pk, dirOf(S.inEdge, pk.u), C.main, "TASK", W, H);
        for (i = 0; i < 4; i++) {
          pk = pkt(tt, 900 + i * 130, 420, S.fan[i]);
          if (pk) drawPkt(ctx, pk, dirOf(S.fan[i], pk.u), C.main, null, W, H);
          if (inRange(tt, 1600 + i * 130, 1600 + i * 130 + 1200)) {
            var j = Math.floor((tt - 1600 - i * 130) / 400);
            if (j < 3) drawStatus(ctx, S.agents[i], v.agents[i].statuses[j], C.main, 1);
          }
          pk = pkt(tt, 2300 + i * 130, 420, S.down[i]);
          if (pk) drawPkt(ctx, pk, dirOf(S.down[i], pk.u), C.tool, null, W, H);
          if (inRange(tt, 2750 + i * 130, 2750 + i * 130 + 900)) {
            drawStatus(ctx, S.tools[i], v.tools[i].op, C.tool, 1);
            ring(ctx, tt, 2750 + i * 130, 500, S.tools[i], S.tools[i].r, S.tools[i].r + 22, C.tool);
          }
          pk = pkt(tt, 3700 + i * 130, 420, S.up[i]);
          if (pk) drawPkt(ctx, pk, dirOf(S.up[i], pk.u), C.tool, null, W, H);
          pk = pkt(tt, 4200 + i * 130, 420, S.back[i]);
          if (pk) drawPkt(ctx, pk, dirOf(S.back[i], pk.u), C.main, null, W, H);
        }
        ring(ctx, tt, 900, 800, S.gw, S.gw.r, S.gw.r + 30, C.main);
        ring(ctx, tt, 4200, 700, S.gw, S.gw.r, S.gw.r + 30, C.main);
        pk = pkt(tt, 5200, 700, S.outEdge);
        if (pk) drawPkt(ctx, pk, dirOf(S.outEdge, pk.u), C.main, "ANSWER", W, H);
        return;
      }

      if (v.variant === "audit") {
        drawPorts(tt);
        var deny = (cycle % 3 === 1);
        if (deny && denyCycle !== cycle) { denyCycle = cycle; denyGate = denyCount % 3; denyCount++; }
        var dg = deny ? denyGate : -1;
        drawNodes(tt);
        // request into gateway
        pk = pkt(tt, 0, 700, S.inEdge);
        if (pk) drawPkt(ctx, pk, dirOf(S.inEdge, pk.u), C.main, "REQUEST", W, H);
        // chain: request passes gates in order; a deny halts it
        var gateTimes = [800, 1300, 1800];
        for (i = 0; i < 3; i++) {
          var gT = gateTimes[i];
          if (dg >= 0 && i >= dg) {
            if (i === dg) {
              pk = pkt(tt, gT + 300, 500, S.denyBack[i]);
              if (pk) drawPkt(ctx, pk, dirOf(S.denyBack[i], pk.u), C.deny, "DENY", W, H);
              ring(ctx, tt, gT + 300, 600, S.gates[i], S.gates[i].r, S.gates[i].r + 26, C.deny);
              if (inRange(tt, gT + 300, gT + 1200)) drawStatus(ctx, S.gates[i], "blocked", C.deny, 1);
            }
            continue;
          }
          pk = pkt(tt, gT, 400, S.chain[i]);
          if (pk) drawPkt(ctx, pk, dirOf(S.chain[i], pk.u), C.main, null, W, H);
          if (inRange(tt, gT + 450, gT + 1350)) drawStatus(ctx, S.gates[i], v.gates[i].ok, C.main, 1);
        }
        if (deny) {
          pk = pkt(tt, 3300, 500, S.denyOut);
          if (pk) drawPkt(ctx, pk, dirOf(S.denyOut, pk.u), C.deny, "DENIED", W, H);
          ring(ctx, tt, 3300, 500, S.req, S.req.r, S.req.r + 24, C.deny);
        } else {
          pk = pkt(tt, 2400, 400, S.toAgent);
          if (pk) drawPkt(ctx, pk, dirOf(S.toAgent, pk.u), C.main, null, W, H);
          if (inRange(tt, 2900, 2900 + 1800)) {
            var st = statusFor(tt, [{ t: 2900, txt: "audit" }, { t: 3900, txt: "logged" }], null);
            if (st) drawStatus(ctx, S.agents[0], st.txt, C.main, 1);
          }
          pk = pkt(tt, 5000, 600, S.outEdge);
          if (pk) drawPkt(ctx, pk, dirOf(S.outEdge, pk.u), C.main, "APPROVED", W, H);
          ring(ctx, tt, 5000, 600, S.out, 6, 26, C.main);
        }
        return;
      }

      if (v.variant === "meter") {
        drawPorts(tt);
        drawNodes(tt);
        pk = pkt(tt, 0, 800, S.inEdge);
        if (pk) drawPkt(ctx, pk, dirOf(S.inEdge, pk.u), C.main, "SEAT: 12", W, H);
        pk = pkt(tt, 900, 450, S.toAgent);
        if (pk) drawPkt(ctx, pk, dirOf(S.toAgent, pk.u), C.main, "LICENSE OK", W, H);
        if (inRange(tt, 1400, 1400 + 3400)) {
          var m = Math.floor((tt - 1400) / 1150);
          if (m < 3) drawStatus(ctx, S.agents[0], v.agents[0].statuses[m], C.main, 1);
        }
        pk = pkt(tt, 5200, 600, S.outEdge);
        if (pk) drawPkt(ctx, pk, dirOf(S.outEdge, pk.u), C.main, "ANSWER", W, H);
        ring(ctx, tt, 900, 500, S.gw, S.gw.r, S.gw.r + 28, C.main);
        // counter
        var n = 1204 + cycle;
        ctx.fillStyle = COLS.faint;
        ctx.font = "600 9.5px " + MONO;
        ctx.textAlign = "center";
        ctx.fillText("PROCESSED: " + n.toLocaleString("en-US"), W * 0.45, H - 12);
        return;
      }
    }

    function frame(now) {
      if (!visible) { running = false; return; }
      if (!last) last = now;
      tt += now - last;
      last = now;
      if (tt >= v.T) { tt -= v.T; cycle++; }
      drawFrame(tt, cycle);
      if (!REDUCE) requestAnimationFrame(frame);
    }

    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !running && !REDUCE) {
        running = true; last = 0;
        requestAnimationFrame(frame);
      } else if (!visible) {
        running = false;
      }
    }, { threshold: 0.1 });

    var ro = new ResizeObserver(function () { resize(); });
    ro.observe(cv);
    io.observe(cv);

    resize();
    if (REDUCE) drawStatic();
    else { running = true; last = 0; requestAnimationFrame(frame); }
  }

  function boot() {
    var cvs = document.querySelectorAll("canvas.agent-canvas");
    for (var i = 0; i < cvs.length; i++) {
      var variant = cvs[i].getAttribute("data-variant") || "parallel";
      makeEngine(cvs[i], variant);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
