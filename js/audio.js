/* =====================================================================
   MÓDULO DE ÁUDIO PROCEDURAL (Web Audio API)
   Percussão sintetizada, efeitos de interface e vozes de diálogo
   ===================================================================== */
(function(global) {
  "use strict";

  var Z  = [0,0,0,0,0,0,0,0,0,0,0,0];
  var BL = [1,0,1,0,1,1,0,1,0,1,0,1];
  var LO = [1,0,0,0,0,0,1,0,0,0,0,0];
  var SL = [0,0,1,0,0,1,0,0,1,0,1,0];

  var RY = [
    { b: 100, bl: BL, lo: LO, sl: SL },
    { b: 84,  bl: [1,0,0,0,1,0,0,0,1,0,0,0], lo: LO, sl: Z },
    { b: 112, bl: BL, lo: LO, sl: SL },
    { b: 58,  bl: Z,  lo: [1,0,0,0,0,0,0,0,0,0,0,0], sl: Z },
    { b: 78,  bl: Z,  lo: LO, sl: [0,0,0,0,0,1,0,0,0,0,1,0] },
    { b: 104, bl: BL, lo: LO, sl: SL },
    { b: 90,  bl: [1,0,0,1,0,0,1,0,0,1,0,0], lo: LO, sl: Z }
  ];

  var SF = {
    tap:    [[660, 0.05, "square",   0.10, 0]],
    open:   [[392, 0.08, "triangle", 0.20, 0], [587, 0.10, "triangle", 0.20, 0.07]],
    close:  [[587, 0.08, "triangle", 0.20, 0], [392, 0.10, "triangle", 0.20, 0.07]],
    found:  [[523, 0.10, "square",   0.14, 0], [659, 0.10, "square",   0.14, 0.10], [784, 0.20, "square", 0.14, 0.20]],
    ok:     [[784, 0.10, "square",   0.14, 0], [1047, 0.18, "square",  0.14, 0.09]],
    no:     [[180, 0.20, "sawtooth", 0.14, 0]],
    portal: [[220, 0.45, "sine",     0.25, 0], [330, 0.45, "sine",     0.20, 0.12], [440, 0.50, "sine", 0.22, 0.24]],
    step:   [[120, 0.04, "triangle", 0.07, 0]]
  };

  var AU = {
    c: null, m: null, mus: null, fx: null,
    on: true, fxOn: true, mv: 0.7, fv: 0.8,
    n: 0, t: null, nx: 0, nb: null
  };

  try {
    var q = JSON.parse(localStorage.getItem("cdm2s2") || "null");
    if (q) {
      AU.on = q.m !== 0;
      AU.fxOn = q.f !== 0;
      AU.mv = q.mv == null ? 0.7 : q.mv;
      AU.fv = q.fv == null ? 0.8 : q.fv;
    }
  } catch (e) {}

  function hit(k, t, v, fx) {
    var c = AU.c;
    if (!c || (fx ? !AU.fxOn : !AU.on)) return;
    var g = c.createGain();
    g.connect(fx ? AU.fx : AU.mus);
    if (k === "lo") {
      var o = c.createOscillator();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.22);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.34);
    } else if (k === "sl") {
      var s = c.createBufferSource(), f = c.createBiquadFilter();
      s.buffer = AU.nb;
      f.type = "bandpass";
      f.frequency.value = 1700;
      g.gain.setValueAtTime(v * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      s.connect(f);
      f.connect(g);
      s.start(t);
    } else {
      var q = c.createOscillator();
      q.type = "triangle";
      q.frequency.value = 1250;
      g.gain.setValueAtTime(v * 0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      q.connect(g);
      q.start(t);
      q.stop(t + 0.16);
    }
  }

  function tick() {
    var c = AU.c;
    if (!c) return;
    var mi = (global.CDM && global.CDM.st) ? global.CDM.st.mi : 0;
    var r = RY[mi] || RY[0];
    while (AU.nx < c.currentTime + 0.15) {
      var i = AU.n % 12;
      if (r.lo[i]) hit("lo", AU.nx, 0.55);
      if (r.sl[i]) hit("sl", AU.nx, 0.50);
      if (r.bl[i]) hit("bell", AU.nx, 0.50);
      AU.n++;
      AU.nx += 60 / r.b / 3;
    }
  }

  function snd() {
    if (!AU.on && !AU.fxOn) return;
    var vol = (global.CDM && global.CDM.CFG) ? global.CDM.CFG.vol : 1;
    if (!AU.c) {
      var A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      AU.c = new A();
      AU.m = AU.c.createGain();
      AU.m.gain.value = 0.5 * vol;
      AU.m.connect(AU.c.destination);
      AU.mus = AU.c.createGain();
      AU.mus.gain.value = AU.mv;
      AU.mus.connect(AU.m);
      AU.fx = AU.c.createGain();
      AU.fx.gain.value = AU.fv;
      AU.fx.connect(AU.m);
      var nb = AU.c.createBuffer(1, 4410, 44100), d = nb.getChannelData(0);
      for (var i = 0; i < 4410; i++) d[i] = Math.random() * 2 - 1;
      AU.nb = nb;
    }
    AU.c.resume();
    if (AU.on && !AU.t) {
      AU.nx = AU.c.currentTime + 0.05;
      AU.t = setInterval(tick, 30);
    }
  }

  function sset() {
    if (global.CDM && global.CDM.cfgSave) global.CDM.cfgSave();
    var vol = (global.CDM && global.CDM.CFG) ? global.CDM.CFG.vol : 1;
    try {
      localStorage.setItem("cdm2s2", JSON.stringify({
        m: AU.on ? 1 : 0, f: AU.fxOn ? 1 : 0, mv: AU.mv, fv: AU.fv
      }));
    } catch (e) {}
    if (AU.mus) AU.mus.gain.value = AU.mv;
    if (AU.m) AU.m.gain.value = 0.5 * vol;
    if (AU.fx) AU.fx.gain.value = AU.fv;
    if (AU.on) snd();
    else if (AU.t) { clearInterval(AU.t); AU.t = null; }
  }

  function tn(f, d, ty, v, dl) {
    var c = AU.c;
    if (!c || !AU.fxOn) return;
    var t = c.currentTime + (dl || 0), o = c.createOscillator(), g = c.createGain();
    o.type = ty || "square";
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(v || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g);
    g.connect(AU.fx);
    o.start(t);
    o.stop(t + d + 0.02);
  }

  function sfx(n) {
    snd();
    (SF[n] || []).forEach(function(a) { tn(a[0], a[1], a[2], a[3], a[4]); });
  }

  function voice(id) {
    if (!AU.c || !AU.fxOn) return;
    var h = 0;
    for (var i = 0; i < id.length; i++) h += id.charCodeAt(i);
    var f = id === "p" ? 340 : 150 + (h % 6) * 32;
    tn(f * (1 + Math.random() * 0.08), 0.05, id === "p" ? "triangle" : "square", 0.09, 0);
  }

  ["pointerdown", "keydown"].forEach(function(v) { addEventListener(v, snd); });
  document.addEventListener("visibilitychange", function() {
    if (AU.c) {
      if (document.hidden) AU.c.suspend();
      else if (AU.on) AU.c.resume();
    }
  });
  document.addEventListener("click", function(e) {
    var b = e.target.closest && e.target.closest("button");
    if (b && !b.classList.contains("pad") && b.id !== "btnA") sfx("tap");
  });

  global.CDMAudio = {
    AU: AU,
    hit: hit,
    snd: snd,
    sset: sset,
    sfx: sfx,
    voice: voice
  };
})(window);
