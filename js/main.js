/* =====================================================================
   MOTOR PRINCIPAL, ESTADO, ENTRADA E NAVEGAÇÃO ENTRE TELAS
   Carrega data/content.json (com fallback local), gerencia input e loop
   ===================================================================== */
(function(global) {
  "use strict";

  var $ = function(id) { return document.getElementById(id); };
  var cv = $("cv"), ctx = cv.getContext("2d");
  var T = global.CDMWorld.T;

  var S = 3, vw = 320, vh = 240;
  var frame = 0, VX = 0, VY = 0, SD = 0, lastStep = 0;
  var J = { x: 0, y: 0, m: 0 };
  var LT = performance.now(), TT = true, BLK = false, rotDismissed = false;
  var keys = {};

  var CFG = { walk: 52, run: 88, accel: 9, decel: 16, dead: 0.16, sens: 1, spd: 1, vol: 1 };
  try {
    var cq = JSON.parse(localStorage.getItem("cdm2c") || "null");
    if (cq) {
      CFG.sens = cq.s || 1;
      CFG.spd = cq.v || 1;
      CFG.vol = cq.g == null ? 1 : cq.g;
    }
  } catch (e) {}

  function cfgSave() {
    try {
      localStorage.setItem("cdm2c", JSON.stringify({ s: CFG.sens, v: CFG.spd, g: CFG.vol }));
    } catch (e) {}
  }

  var st = { mi: 0, found: {}, solved: {}, seals: {}, x: 0, y: 0, mode: "play", dlg: null, shuf: {}, intro: false, note: "" };
  try {
    var sv = JSON.parse(localStorage.getItem("cdm2") || "null");
    if (sv) {
      st.found = sv.found || {};
      st.solved = sv.solved || {};
      st.mi = sv.mi || 0;
      st.intro = !!sv.intro;
      st.seals = sv.seals || {};
      st.note = sv.note || "";
    }
  } catch (e) {}

  function save() {
    try {
      localStorage.setItem("cdm2", JSON.stringify({
        found: st.found, solved: st.solved, mi: st.mi, intro: st.intro ? 1 : 0, seals: st.seals, note: st.note || ""
      }));
    } catch (e) {}
  }

  var CDM = {
    MAPS: [],
    LINKS: [],
    BOSS_DATA: {},
    E: {},
    st: st,
    CFG: CFG,
    cfgSave: cfgSave,
    save: save,
    cur: function() { return CDM.MAPS[st.mi]; },
    cnt: function(i) {
      var n = 0, t = 0;
      CDM.MAPS[i].coisas.forEach(function(c) { t++; if (st.found[c.id]) n++; });
      return [n, t];
    },
    tot: function() {
      var n = 0, t = 0;
      CDM.MAPS.forEach(function(_, i) { var c = CDM.cnt(i); n += c[0]; t += c[1]; });
      return [n, t];
    },
    sealsCount: function() {
      var n = 0;
      CDM.MAPS.forEach(function(m) { if (st.seals[m.id]) n++; });
      return n;
    },
    isTitle: function() { return TT; },
    place: place,
    go: go,
    goHome: goHome,
    startFromMap: startFromMap,
    resetAllProgress: resetAllProgress,
    stopAll: stopAll,
    enterFs: enterFs,
    exitFs: exitFs,
    toggleFs: toggleFs,
    isFs: isFs
  };
  global.CDM = CDM;

  function fit() {
    S = Math.max(2, Math.min(6, Math.round(Math.min(innerHeight / (T * 10), innerWidth / (T * 11)))));
    vw = Math.ceil(innerWidth / S);
    vh = Math.ceil(innerHeight / S);
    cv.width = vw;
    cv.height = vh;
    cv.style.width = vw * S + "px";
    cv.style.height = vh * S + "px";
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener("resize", fit);
  if (matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) document.body.classList.add("touch");

  function place(i) {
    st.mi = Math.min(Math.max(0, i), CDM.MAPS.length - 1);
    var m = CDM.cur();
    global.CDMWorld.build(m);
    st.x = m.spawn[0] * T;
    st.y = m.spawn[1] * T;
    if (global.CDMWorld.blocked(m, st.x, st.y)) st.y = m.spawn[1] * T + T;
    save();
    global.CDMUI.hud();
  }

  function go(i) {
    global.CDMUI.closeModals();
    if (i === st.mi) return;
    global.CDMAudio.sfx("portal");
    cv.classList.add("fade");
    setTimeout(function() {
      place(i);
      cv.classList.remove("fade");
      global.CDMUI.toast(CDM.cur().nome);
    }, 260);
  }

  function refreshTitleButtons() {
    var has = Object.keys(st.found).length > 0 || st.intro;
    var playSpan = $("tPlayTxt") || $("tPlay");
    playSpan.textContent = has ? "Continuar (" + CDM.cur().nome + ")" : "Jogar";
    $("tNew").style.display = has ? "" : "none";
  }

  function goHome() {
    stopAll();
    $("dlg").classList.remove("on");
    st.dlg = null;
    st.mode = "play";
    global.CDMUI.closeModals();
    TT = true;
    exitFs();
    refreshTitleButtons();
    $("title").classList.add("on");
    setTimeout(function() { if ($("tPlay")) $("tPlay").focus(); }, 20);
    global.CDMAudio.sfx("close");
  }

  function startFromMap(i) {
    place(i);
    TT = false;
    $("title").classList.remove("on");
    lockLand();
    global.CDMAudio.snd();
    global.CDMAudio.sfx("portal");
    if (!st.intro) {
      introShow();
    } else {
      st.mode = "play";
      global.CDMUI.toast(CDM.cur().nome);
    }
  }

  function shuffleLinks() {
    CDM.LINKS.forEach(function(l, i) {
      var o = [l.ok].concat(l.bad);
      for (var j = o.length - 1; j > 0; j--) {
        var r = Math.floor(Math.random() * (j + 1)), t = o[j];
        o[j] = o[r]; o[r] = t;
      }
      st.shuf[i] = o;
    });
  }

  function resetAllProgress() {
    stopAll();
    $("dlg").classList.remove("on");
    st.found = {};
    st.solved = {};
    st.seals = {};
    st.intro = false;
    st.note = "";
    st.dlg = null;
    st.mi = 0;
    shuffleLinks();
    try { localStorage.removeItem("cdm2"); } catch (e) {}
    if (global.CDMUI.resetBookAndMapState) global.CDMUI.resetBookAndMapState();
    place(0);
    refreshTitleButtons();
    TT = false;
    $("title").classList.remove("on");
    lockLand();
    global.CDMAudio.snd();
    global.CDMAudio.sfx("found");
    introShow();
    global.CDMUI.toast("Novo jogo iniciado!");
  }

  function act() {
    if (TT || BLK || !CDM.MAPS.length) return;
    if (st.mode === "dlg") { global.CDMUI.advDlg(); return; }
    if (st.mode !== "play") return;
    var m = CDM.cur();
    var c = global.CDMWorld.nearest(m, st.x, st.y);
    if (!c) return;
    if (c.t === "p") {
      var ck = CDM.cnt(st.mi);
      if (!st.seals[m.id] && ck[0] === ck[1]) { global.CDMUI.bossOpen(); return; }
      global.CDMUI.toggle("mMaps");
      return;
    }
    st.dlg = { c: c, i: 0, lines: (c.say || [c.e.tx].concat(c.e.nt ? [c.e.nt] : [])) };
    st.mode = "dlg";
    global.CDMAudio.sfx("tap");
    global.CDMUI.showDlg();
  }

  /* ===================== ENTRADA E JOYSTICK ===================== */
  addEventListener("keydown", function(e) {
    if (e.target && e.target.tagName === "TEXTAREA") return;
    var k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter"].indexOf(k) >= 0) e.preventDefault();

    /* WASD exclusivos para movimentação do personagem no mapa */
    if (st.mode === "play" && !TT && !BLK && (k === "w" || k === "a" || k === "s" || k === "d" || k === "shift")) {
      keys[k] = true;
      if (document.activeElement && $("top").contains(document.activeElement)) {
        document.activeElement.blur();
      }
    }

    /* Setas direcionais (e Enter em botões focados) exclusivas para movimentar e selecionar a interface */
    if (["arrowup", "arrowdown", "arrowleft", "arrowright"].indexOf(k) >= 0) {
      if (global.CDMUI.handleModalKey && global.CDMUI.handleModalKey(k)) return;
    }

    if (e.repeat) return;
    if (k === "enter" && st.mode !== "dlg") {
      if (global.CDMUI.handleModalKey && global.CDMUI.handleModalKey(k)) return;
    }
    if (k === " " || k === "enter" || k === "e") act();
    if (k === "b") global.CDMUI.toggle("mBook");
    if (k === "m") global.CDMUI.toggle("mMaps");
    if (k === "g" && !TT) global.CDMUI.gpsTog();
    if (k === "f" && !TT) toggleFs();
    if (k === "escape") {
      if ($("mCred").classList.contains("on")) { $("mCred").classList.remove("on"); return; }
      if (st.mode === "modal") global.CDMUI.closeModals();
      else if (st.mode === "play" && !TT) global.CDMUI.toggle("mMenu");
    }
  });
  addEventListener("keyup", function(e) {
    keys[e.key.toLowerCase()] = false;
  });

  $("btnA").addEventListener("pointerdown", function(e) { e.preventDefault(); act(); });
  $("dlg").addEventListener("click", act);

  var jy = $("joy"), kn = $("knob");
  function jset(a, b) { J.x = a; J.y = b; J.m = Math.hypot(a, b); }
  function jmove(e) {
    var r = jy.getBoundingClientRect();
    var a = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    var b = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    var d = Math.hypot(a, b) || 1, k = Math.min(1, d);
    var maxR = r.width * 0.28;
    kn.style.transform = "translate(" + (a / d * k * maxR) + "px," + (b / d * k * maxR) + "px)";
    jset(a / d * k, b / d * k);
  }
  jy.addEventListener("pointerdown", function(e) { e.preventDefault(); jy.setPointerCapture(e.pointerId); jmove(e); });
  jy.addEventListener("pointermove", function(e) { if (jy.hasPointerCapture(e.pointerId)) jmove(e); });
  ["pointerup", "pointercancel"].forEach(function(v) {
    jy.addEventListener(v, function() { kn.style.transform = ""; jset(0, 0); });
  });

  function stopAll() {
    for (var k in keys) keys[k] = false;
    J.x = J.y = J.m = 0; VX = VY = 0; kn.style.transform = "";
  }
  addEventListener("blur", stopAll);
  document.addEventListener("visibilitychange", function() { if (document.hidden) stopAll(); });

  /* ===================== ORIENTAÇÃO E TELA INICIAL ===================== */
  var rq = matchMedia("(orientation: portrait) and (pointer: coarse) and (max-width: 600px)");
  function rotChk() {
    if (rotDismissed) { BLK = false; $("rot").classList.remove("on"); return; }
    var b = rq.matches || ("ontouchstart" in window && innerWidth <= 600 && innerHeight > innerWidth);
    BLK = b;
    $("rot").classList.toggle("on", b);
    var AU = global.CDMAudio.AU;
    if (b) { stopAll(); if (AU.c) AU.c.suspend(); }
    else if (AU.c && AU.on) AU.c.resume();
  }
  $("bRotSkip").onclick = function() { rotDismissed = true; rotChk(); };
  if (rq.addEventListener) rq.addEventListener("change", rotChk);
  addEventListener("resize", rotChk);
  addEventListener("orientationchange", rotChk);
  rotChk();

  function isFs() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function updFsIcon() {
    var u = $("uFsIcon");
    if (u) u.setAttribute("href", isFs() ? "#px-fs-exit" : "#px-fs");
    var sw = $("tFs");
    if (sw) {
      sw.setAttribute("aria-checked", isFs() ? "true" : "false");
      var stSpan = sw.querySelector(".px-switch-state");
      if (stSpan) stSpan.textContent = isFs() ? "SIM" : "NÃO";
    }
  }

  function enterFs() {
    try {
      var el = document.documentElement;
      if (!isFs()) {
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
          var p = req.call(el);
          if (p && p.catch) p.catch(function() {});
        }
      }
    } catch (e) {}
  }

  function exitFs() {
    try {
      if (isFs()) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) {
          var p = ex.call(document);
          if (p && p.catch) p.catch(function() {});
        }
      }
    } catch (e) {}
  }

  function toggleFs() {
    if (isFs()) exitFs();
    else enterFs();
  }

  document.addEventListener("fullscreenchange", updFsIcon);
  document.addEventListener("webkitfullscreenchange", updFsIcon);

  function lockLand() {
    enterFs();
    try {
      var o = screen.orientation;
      if (o && o.lock) { var p = o.lock("landscape"); if (p && p.catch) p.catch(function() {}); }
    } catch (e) {}
  }

  var tCanvas = $("tcv"), tCtx = tCanvas.getContext("2d");
  function rsTitle() {
    tCanvas.width = Math.ceil(innerWidth / 4);
    tCanvas.height = Math.ceil(innerHeight / 4);
  }
  rsTitle();
  addEventListener("resize", rsTitle);

  function renderTitleBg() {
    var W = tCanvas.width, H = tCanvas.height, t = Date.now() / 1000;
    var gr = tCtx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#2b1a3d"); gr.addColorStop(0.55, "#b5541c"); gr.addColorStop(1, "#e6a23c");
    tCtx.fillStyle = gr; tCtx.fillRect(0, 0, W, H);
    tCtx.fillStyle = "#fff2c0";
    tCtx.beginPath(); tCtx.arc(W * 0.72, H * 0.5 + Math.sin(t / 4) * 2, H * 0.12, 0, 6.3); tCtx.fill();
    for (var i = 0; i < 30; i++) {
      tCtx.fillStyle = "rgba(255,242,192," + (0.4 + 0.4 * Math.sin(t * 2 + i)) + ")";
      tCtx.fillRect((i * 53) % W, (i * 29) % (H * 0.4), 1, 1);
    }
    function rd(col, base, amp, sp, off) {
      tCtx.fillStyle = col; tCtx.beginPath(); tCtx.moveTo(0, H);
      for (var x = 0; x <= W; x += 2) tCtx.lineTo(x, base + Math.sin((x + off + t * sp) / (amp * 3)) * amp);
      tCtx.lineTo(W, H); tCtx.fill();
    }
    rd("#7a3a1c", H * 0.62, 5, 2, 0);
    tCtx.fillStyle = "#9a5a2a";
    [[0.15, 18], [0.28, 12]].forEach(function(p) {
      var x = W * p[0], y = H * 0.64;
      tCtx.beginPath(); tCtx.moveTo(x - p[1], y); tCtx.lineTo(x, y - p[1]); tCtx.lineTo(x + p[1], y); tCtx.fill();
    });
    rd("#4a2414", H * 0.74, 4, 4, 40);
    var bx = W * 0.84, by = H * 0.8;
    tCtx.fillStyle = "#2a1a12";
    tCtx.fillRect(bx - 4, by - 26, 8, 26);
    tCtx.fillRect(bx - 14, by - 34, 28, 6);
    [-12, -4, 6, 13].forEach(function(o) { tCtx.fillRect(bx + o, by - 40, 3, 7); });
    rd("#1f1218", H * 0.86, 3, 6, 90);
    for (var x = 0; x < W; x += 8) {
      tCtx.fillStyle = (x / 8) % 2 ? "#3a2a1e" : "#46331f";
      tCtx.fillRect(x, H * 0.92, 8, H);
    }
    var px = W * 0.5 + Math.sin(t / 3) * W * 0.06, py = H * 0.92 - 12 + Math.abs(Math.sin(t * 6)) * -1;
    tCtx.fillStyle = "#1f7a7a"; tCtx.fillRect(px - 3, py + 5, 6, 7);
    tCtx.fillStyle = "#8d5a3a"; tCtx.fillRect(px - 3, py - 1, 6, 6);
    tCtx.fillStyle = "#1d1420"; tCtx.fillRect(px - 3, py - 2, 6, 2);
  }

  function introShow() {
    $("mIntro").classList.add("on");
    st.mode = "modal";
    if (global.CDMUI.focusFirstInModal) global.CDMUI.focusFirstInModal("mIntro");
    $("xI").onclick = function() {
      $("mIntro").classList.remove("on");
      st.mode = "play";
      st.intro = true;
      save();
      refreshTitleButtons();
    };
    if ($("xIHome")) {
      $("xIHome").onclick = function() {
        $("mIntro").classList.remove("on");
        goHome();
      };
    }
  }

  function titleInit() {
    refreshTitleButtons();
    $("tPlay").onclick = function() {
      TT = false;
      $("title").classList.remove("on");
      lockLand();
      global.CDMAudio.snd();
      if (!st.intro) introShow();
      else st.mode = "play";
    };
    $("tEras").onclick = function() { global.CDMUI.toggle("mMaps"); };
    $("tBook").onclick = function() { global.CDMUI.toggle("mBook"); };
    $("tCfg").onclick = function() { global.CDMUI.toggle("mMenu"); };
    $("tCred").onclick = function() { $("mCred").classList.add("on"); st.mode = "modal"; if (global.CDMUI.focusFirstInModal) global.CDMUI.focusFirstInModal("mCred"); };
    $("xCr").onclick = function() { $("mCred").classList.remove("on"); st.mode = "play"; };

    $("tNew").onclick = function() {
      global.CDMUI.openNewGameModal();
    };
  }

  /* ===================== GAME LOOP PRINCIPAL UNIFICADO ===================== */
  function loop() {
    frame++;
    var now = performance.now(), dt = Math.min(0.05, (now - LT) / 1000);
    LT = now;

    if (TT) {
      renderTitleBg();
      requestAnimationFrame(loop);
      return;
    }

    if (st.mode !== "play" || BLK) { VX = VY = 0; }
    if (st.mode === "play" && !BLK && CDM.MAPS.length) {
      var m = CDM.cur();
      var kx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
      var ky = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
      var kb = kx || ky, ix = kb ? kx : J.x, iy = kb ? ky : J.y, mag = Math.hypot(ix, iy);
      var an = kb ? 1 : Math.min(1, J.m * CFG.sens);
      var run = !!keys.shift || (!kb && an > 0.85);
      if (!kb && J.m < CFG.dead) mag = 0;
      var sp = (run ? CFG.run : CFG.walk) * CFG.spd * (kb || run ? 1 : Math.min(1, an / 0.85));
      VX = mag ? ix / mag * sp : 0;
      VY = mag ? iy / mag * sp : 0;
      var mx = VX * dt, my = VY * dt, movedX = 0, movedY = 0;
      if (mx) {
        if (!global.CDMWorld.blocked(m, st.x + mx, st.y)) { st.x += mx; movedX = mx; }
        else {
          var sx = Math.sign(mx);
          while (Math.abs(mx) >= 0.5) {
            if (!global.CDMWorld.blocked(m, st.x + sx * 0.5, st.y)) { st.x += sx * 0.5; movedX += sx * 0.5; mx -= sx * 0.5; }
            else break;
          }
          VX = 0;
        }
      }
      if (my) {
        if (!global.CDMWorld.blocked(m, st.x, st.y + my)) { st.y += my; movedY = my; }
        else {
          var sy = Math.sign(my);
          while (Math.abs(my) >= 0.5) {
            if (!global.CDMWorld.blocked(m, st.x, st.y + sy * 0.5)) { st.y += sy * 0.5; movedY += sy * 0.5; my -= sy * 0.5; }
            else break;
          }
          VY = 0;
        }
      }
      var dist = Math.hypot(movedX, movedY);
      if (dist > 0) {
        SD += dist;
        if (SD - lastStep >= (run ? 14 : 10)) { lastStep = SD; global.CDMAudio.sfx("step"); }
      } else {
        SD = 0; lastStep = 0;
      }
    }
    global.CDMUI.ipUpd();
    if (frame % 4 === 0) global.CDMUI.drawMini();
    if (CDM.MAPS.length) {
      var curMap = CDM.cur(), ck = CDM.cnt(st.mi);
      var sealPending = !st.seals[curMap.id] && ck[0] === ck[1];
      global.CDMWorld.renderScene(ctx, vw, vh, curMap, st, frame, Math.hypot(VX, VY) > 6, SD, sealPending);
    }
    requestAnimationFrame(loop);
  }

  /* ===================== INICIALIZAÇÃO DE DADOS (JSON + FALLBACK) ===================== */
  function initWithData(data) {
    CDM.MAPS = data.maps || [];
    CDM.LINKS = data.links || [];
    CDM.BOSS_DATA = data.bosses || {};
    CDM.E = {};

    CDM.MAPS.forEach(function(m, i) {
      m.i = i;
      m.coisas.forEach(function(c) {
        c.e.m = i;
        CDM.E[c.id] = c.e;
      });
    });

    CDM.LINKS.forEach(function(l, i) {
      var o = [l.ok].concat(l.bad);
      for (var j = o.length - 1; j > 0; j--) {
        var r = Math.floor(Math.random() * (j + 1)), t = o[j];
        o[j] = o[r]; o[r] = t;
      }
      st.shuf[i] = o;
    });

    fit();
    global.CDMUI.initUI();
    place(st.mi);
    titleInit();
    loop();
  }

  fetch("data/content.json")
    .then(function(res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function(data) {
      initWithData(data);
    })
    .catch(function() {
      if (global.CDM_FALLBACK_DATA) {
        initWithData(global.CDM_FALLBACK_DATA);
      } else {
        console.error("Falha ao carregar data/content.json e nenhum fallback disponível.");
      }
    });
})(window);
