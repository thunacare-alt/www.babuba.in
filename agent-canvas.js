/* BABUBA //GATEWAY — agent orchestration canvas
 * Self-contained: scans for <canvas class="agent-canvas"> and draws a looping
 * multi-agent routing visualization — one task in, the router fans it out to
 * four agents working in parallel (each shows its work), then results merge
 * into one answer. Pure canvas, no dependencies, no network calls.
 * Respects prefers-reduced-motion by rendering a single static frame.
 */
(function () {
  "use strict";

  var REDUCE =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var COL = {
    grid: "rgba(232,232,226,0.05)",
    edge: "rgba(232,232,226,0.13)",
    volt: "#C9F24B",
    voltSoft: "rgba(201,242,75,0.10)",
    glow: "rgba(201,242,75,0.45)",
    node: "#111113",
    nodeStroke: "rgba(232,232,226,0.16)",
    text: "#E8E8E2",
    faint: "#82827B",
    dim: "rgba(232,232,226,0.55)",
    bg: "#0A0A0B"
  };

  var AGENTS = [
    { id: "FIN", label: "FINANCE", statuses: ["parse", "validate", "matched"] },
    { id: "OPS", label: "OPS", statuses: ["check", "verify", "done"] },
    { id: "MIS", label: "MIS", statuses: ["build", "rollup", "done"] },
    { id: "ADM", label: "ADMIN", statuses: ["audit", "gate", "approved"] }
  ];

  var T = 8000; // full cycle ms
  var IN_START = 0, IN_DUR = 1000;
  var FAN_START = 1000, FAN_STAG = 160, FAN_DUR = 380;
  var RES_START = 4800, RES_STAG = 160, RES_DUR = 380;
  var OUT_START = 6400, OUT_DUR = 800;

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
    var dx = 2 * (1 - u) * (E.c.x - E.a.x) + 2 * u * (E.b.x - E.c.x);
    var dy = 2 * (1 - u) * (E.c.y - E.a.y) + 2 * u * (E.b.y - E.c.y);
    var l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function boot(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var W = 0, H = 0, running = false, raf = 0;
    var t0 = performance.now();

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth || canvas.parentNode.clientWidth || 800;
      H = canvas.clientHeight || canvas.parentNode.clientHeight || 420;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function nodes() {
      var s = Math.min(W, H);
      var gwR = clamp01(s / 900) * 10 + 26; // 26..36
      var agR = clamp01(s / 900) * 7 + 15; // 15..22
      return {
        gw: { x: W * 0.5, y: H * 0.5, r: gwR },
        agents: [
          { x: W * 0.26, y: H * 0.2, r: agR },
          { x: W * 0.74, y: H * 0.2, r: agR },
          { x: W * 0.26, y: H * 0.8, r: agR },
          { x: W * 0.74, y: H * 0.8, r: agR }
        ],
        in: { x: 16, y: H * 0.5 },
        out: { x: W - 16, y: H * 0.5 }
      };
    }

    function edge(N, i) {
      var a = N.gw, b = N.agents[i];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.hypot(dx, dy) || 1;
      var bow = Math.min(30, len * 0.16);
      var c = { x: mx + (-dy / len) * bow, y: my + (dx / len) * bow };
      return { a: a, c: c, b: b };
    }

    function traceEdge(E, color, alpha, lw) {
      ctx.beginPath();
      ctx.moveTo(E.a.x, E.a.y);
      ctx.quadraticCurveTo(E.c.x, E.c.y, E.b.x, E.b.y);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.globalAlpha = 1;
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

    function drawPkt(p, dir, label) {
      var g = ctx.createLinearGradient(
        p.x - dir.x * 20, p.y - dir.y * 20, p.x, p.y
      );
      g.addColorStop(0, "rgba(201,242,75,0)");
      g.addColorStop(1, "rgba(201,242,75,0.5)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - dir.x * 20, p.y - dir.y * 20);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = COL.volt;
      ctx.shadowColor = COL.glow;
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (label) {
        ctx.fillStyle = COL.volt;
        ctx.font = "600 9.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        var lx = Math.max(64, Math.min(p.x, W - 64));
        ctx.fillText(label, lx, Math.max(14, p.y - 10));
      }
    }

    function ring(tt, start, dur, g, r0, r1) {
      if (tt < start || tt > start + dur) return;
      var u = (tt - start) / dur;
      ctx.beginPath();
      ctx.arc(g.x, g.y, lerp(r0, r1, u), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(201,242,75," + (0.5 * (1 - u)).toFixed(3) + ")";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function drawGrid() {
      ctx.fillStyle = COL.grid;
      var step = 26;
      for (var x = 0; x < W; x += step) {
        for (var y = 0; y < H; y += step) ctx.fillRect(x, y, 1, 1);
      }
    }

    function drawPorts(N) {
      ctx.font = "600 9px 'JetBrains Mono', monospace";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COL.faint;
      ctx.textAlign = "left";
      ctx.fillText("IN", 6, N.in.y - 16);
      ctx.textAlign = "right";
      ctx.fillText("OUT", W - 6, N.out.y - 16);
      ctx.fillStyle = COL.dim;
      ctx.beginPath();
      ctx.moveTo(N.in.x, N.in.y - 5);
      ctx.lineTo(N.in.x, N.in.y + 5);
      ctx.lineTo(N.in.x + 8, N.in.y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(N.out.x, N.out.y - 5);
      ctx.lineTo(N.out.x, N.out.y + 5);
      ctx.lineTo(N.out.x - 8, N.out.y);
      ctx.closePath();
      ctx.fill();
    }

    function drawGateway(N, tt) {
      var g = N.gw;
      var w = Math.min(150, W * 0.34), h = 56;
      var hot =
        (tt >= 850 && tt <= 1500) ||
        (tt >= 5800 && tt <= 6600) ||
        tt < 1000 ||
        (tt >= 6400 && tt <= 7200);
      var breath = Math.sin(tt / 500) * 1.5;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r + 11 + breath, 0, Math.PI * 2);
      ctx.strokeStyle = hot ? "rgba(201,242,75,0.35)" : "rgba(232,232,226,0.07)";
      ctx.lineWidth = 1;
      ctx.stroke();
      roundRect(ctx, g.x - w / 2, g.y - h / 2, w, h, 2);
      ctx.fillStyle = hot ? "rgba(201,242,75,0.07)" : COL.node;
      ctx.fill();
      ctx.strokeStyle = hot ? COL.volt : "rgba(232,232,226,0.22)";
      ctx.lineWidth = hot ? 1.5 : 1;
      ctx.shadowColor = hot ? COL.glow : "transparent";
      ctx.shadowBlur = hot ? 16 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COL.text;
      ctx.font = "700 10px 'JetBrains Mono', monospace";
      ctx.fillText("BABUBA", g.x, g.y - 8);
      ctx.fillStyle = COL.volt;
      ctx.font = "700 9.5px 'JetBrains Mono', monospace";
      ctx.fillText("//GATEWAY", g.x, g.y + 9);
      ring(tt, 850, 500, g, 36, 70);
      ring(tt, 5800, 600, g, 42, 80);
    }

    function drawAgents(N, tt) {
      var fs = Math.min(W, H) < 420 ? 8.5 : 9.5;
      AGENTS.forEach(function (ag, i) {
        var p = N.agents[i];
        var actStart = FAN_START + i * FAN_STAG + FAN_DUR;
        var actEnd = RES_START + i * RES_STAG;
        var status, hot;
        if (tt < actStart) {
          status = "idle";
          hot = false;
        } else if (tt <= actEnd) {
          var idx = Math.floor((tt - actStart) / 620) % ag.statuses.length;
          status = ag.statuses[idx];
          hot = true;
        } else {
          status = ag.statuses[ag.statuses.length - 1] + " ✓";
          hot = tt < actEnd + RES_DUR + 400;
        }
        roundRect(ctx, p.x - p.r, p.y - p.r - 6, p.r * 2, p.r * 2, 2);
        ctx.fillStyle = hot ? COL.voltSoft : COL.node;
        ctx.fill();
        ctx.strokeStyle = hot ? COL.volt : COL.nodeStroke;
        ctx.lineWidth = hot ? 1.5 : 1;
        ctx.shadowColor = hot ? COL.glow : "transparent";
        ctx.shadowBlur = hot ? 12 : 0;
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (tt >= actStart && tt <= actEnd) {
          var prog = (tt - actStart) / (actEnd - actStart);
          ctx.beginPath();
          ctx.arc(p.x, p.y - 6, p.r + 4, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
          ctx.strokeStyle = COL.volt;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.fillStyle = hot ? COL.text : COL.dim;
        ctx.font = "600 " + (p.r >= 20 ? 9.5 : 8.5) + "px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ag.label, p.x, p.y - 6);
        ctx.fillStyle = hot ? COL.volt : COL.faint;
        ctx.font = "500 7.5px 'JetBrains Mono', monospace";
        ctx.fillText(ag.id, p.x, p.y + 7);
        ctx.fillStyle = hot ? COL.volt : COL.faint;
        ctx.font = "500 " + fs + "px 'JetBrains Mono', monospace";
        ctx.fillText(status, p.x, p.y + p.r + 20);
      });
    }

    function drawPackets(N, tt) {
      var Es = [0, 1, 2, 3].map(function (i) { return edge(N, i); });
      var inE = {
        a: N.in,
        c: { x: (N.in.x + N.gw.x) / 2, y: N.in.y },
        b: { x: N.gw.x - 42, y: N.gw.y }
      };
      var pin = pkt(tt, IN_START, IN_DUR, inE);
      if (pin) drawPkt(pin, dirOf(inE, pin.u), "TASK · RECONCILE");
      for (var i = 0; i < 4; i++) {
        var pf = pkt(tt, FAN_START + i * FAN_STAG, FAN_DUR, Es[i]);
        if (pf) drawPkt(pf, dirOf(Es[i], pf.u), null);
      }
      for (var j = 0; j < 4; j++) {
        var re = { a: N.agents[j], c: Es[j].c, b: { x: N.gw.x, y: N.gw.y } };
        var pr = pkt(tt, RES_START + j * RES_STAG, RES_DUR, re);
        if (pr) drawPkt(pr, dirOf(re, pr.u), "✓");
      }
      var outE = {
        a: { x: N.gw.x + 42, y: N.gw.y },
        c: { x: (N.gw.x + N.out.x) / 2, y: N.out.y },
        b: N.out
      };
      var po = pkt(tt, OUT_START, OUT_DUR, outE);
      if (po) drawPkt(po, dirOf(outE, po.u), "ANSWER · 47/47 MATCHED");
    }

    function drawTracers(N, tt) {
      for (var i = 0; i < 4; i++) {
        var E = edge(N, i);
        var ph = ((tt / 6000) + i * 0.25) % 1;
        var p = bez(E.a, E.c, E.b, ph);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(201,242,75," + (0.3 * Math.sin(Math.PI * ph)).toFixed(3) + ")";
        ctx.fill();
      }
    }

    function drawFrame(tt) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, W, H);
      drawGrid();
      var N = nodes();
      drawPorts(N);
      var Es = [0, 1, 2, 3].map(function (i) { return edge(N, i); });
      Es.forEach(function (E) { traceEdge(E, COL.edge, 1, 1); });
      drawTracers(N, tt);
      drawGateway(N, tt);
      drawAgents(N, tt);
      drawPackets(N, tt);
    }

    function loop(now) {
      drawFrame((now - t0) % T);
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (!running) { running = true; raf = requestAnimationFrame(loop); }
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    size();
    if (REDUCE) {
      drawFrame(5200);
      return;
    }
    drawFrame((performance.now() - t0) % T); // avoid blank frame
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) start(); else stop();
        });
      }, { threshold: 0.05 });
      io.observe(canvas);
    } else {
      start();
    }
    if ("ResizeObserver" in window) {
      new ResizeObserver(function () {
        size();
        if (!running) drawFrame((performance.now() - t0) % T);
      }).observe(canvas);
    } else {
      window.addEventListener("resize", function () {
        size();
        if (!running) drawFrame((performance.now() - t0) % T);
      });
    }
  }

  var cvs = document.querySelectorAll("canvas.agent-canvas");
  for (var i = 0; i < cvs.length; i++) boot(cvs[i]);
})();
