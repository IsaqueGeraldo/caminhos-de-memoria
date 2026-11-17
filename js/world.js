/* =====================================================================
   MÓDULO DE MUNDO E RENDERIZAÇÃO (Canvas 2D + Offscreen Caching)
   Geração procedural de mapas, colisão espacial e desenho de entidades
   ===================================================================== */
(function(global) {
  "use strict";

  var T = 16;
  var SOLID = "~HTP";
  var SKIN = ["#6b4226", "#8d5a3a", "#7a4a2e"];
  var renderList = [];

  function hs(x, y) {
    return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100;
  }

  /* Geradores procedurais de terreno desacoplados do JSON de dados */
  var MAP_GENERATORS = {
    afr: function(x, y) {
      var r = 20 + Math.round(Math.sin(y / 2.5) * 1.5);
      if (Math.abs(x - r) <= 1) return (y === 8 || y === 9) ? "=" : "~";
      return hs(x, y) < 7 ? "T" : (hs(x + 9, y + 4) < 2 ? "H" : ".");
    },
    kem: function(x, y) {
      if (Math.abs(x - 13) <= 1) return (y === 8 || y === 9) ? "=" : "~";
      if (y >= 2 && y <= 4 && Math.abs(x - 21) <= y - 2) return "P";
      if (y >= 3 && y <= 4 && Math.abs(x - 4) <= y - 3) return "P";
      if ((x === 10 || x === 11 || x === 15 || x === 16) && hs(x, y) < 30) return "T";
      return ".";
    },
    oyo: function(x, y) {
      if (x >= 2 && x <= 23 && y >= 2 && y <= 15) {
        if (x === 2 || x === 23 || y === 2 || y === 15) {
          return ((x >= 12 && x <= 13 && y === 15) || (x === 2 && y >= 8 && y <= 9)) ? "." : "H";
        }
        if ((y >= 4 && y <= 5 || y >= 12 && y <= 13) && (x >= 4 && x <= 7 || x >= 18 && x <= 21)) return "H";
        return ".";
      }
      return hs(x, y) < 8 ? "T" : ".";
    },
    tra: function(x, y) {
      if (y === 5 && x >= 7 && x <= 9) return "H";
      if (y === 5 && (x === 12 || x === 17)) return "T";
      if (x >= 6 && x <= 19 && y >= 4 && y <= 11) return "=";
      return "~";
    },
    col: function(x, y) {
      if (y <= 1) return "~";
      if (y === 2) return "=";
      if ((y >= 5 && y <= 6 && (x >= 3 && x <= 5 || x >= 19 && x <= 22)) ||
          (y >= 11 && y <= 12 && (x >= 4 && x <= 6 || x >= 17 && x <= 19))) return "H";
      return ".";
    },
    qui: function(x, y) {
      if (x < 2 || y < 2 || x >= 24 || y >= 16) return "T";
      if ((y === 5 && (x === 6 || x === 7 || x === 19 || x === 20)) ||
          (y === 10 && (x === 4 || x === 5 || x === 21 || x === 22)) ||
          (y === 13 && (x === 12 || x === 13))) return "H";
      if (y >= 12 && y <= 14 && x >= 5 && x <= 10) return "=";
      return hs(x, y) < 9 ? "T" : ".";
    },
    pos: function(x, y) {
      var s = x % 8, v = y % 6;
      if (s === 3 || s === 4 || v === 3 || v === 4) return "=";
      return hs(x, y) < 88 ? "H" : ".";
    }
  };

  function drawStaticTile(g, m, ch, x, y) {
    var p = m.pal, px = x * T, py = y * T;
    var F = function(c, xx, yy, w, h) { g.fillStyle = c; g.fillRect(xx, yy, w, h); };
    if (ch === "~") { F(p.w, px, py, T, T); return; }
    if (ch === "=") {
      F(p.p, px, py, T, T);
      F(p.pl, px, py + 7, T, 1);
      F(p.pl, px, py + 15, T, 1);
      F(p.pl, px + 5, py, 1, 7);
      F(p.pl, px + 11, py + 8, 1, 7);
      return;
    }
    F(p.g, px, py, T, T);
    if ((x * 7 + y * 13) % 5 === 0) F(p.g2, px + 4, py + 6, 3, 2);
    if ((x * 11 + y * 3) % 7 === 0) F(p.g2, px + 10, py + 11, 2, 2);
    if (ch === "H") {
      var up = m.g[y - 1] && m.g[y - 1][x] === "H";
      if (!up) {
        F(p.r, px, py, T, T);
        F("rgba(0,0,0,.18)", px, py + T - 2, T, 2);
      } else {
        F(p.b, px, py, T, T);
        F("rgba(0,0,0,.12)", px, py, T, 1);
        if ((x + y) % 3 === 0) {
          F("#2b1d16", px + 5, py + 5, 6, 11);
          F("#e6a23c", px + 9, py + 10, 1, 1);
        } else {
          F("#5a86a6", px + 4, py + 4, 8, 6);
          F("#f1e7d3", px + 8, py + 4, 1, 6);
        }
      }
    } else if (ch === "T") {
      if (m.barrel) {
        F(p.b, px + 3, py + 2, 10, 13);
        F(p.r, px + 3, py + 5, 10, 1);
        F(p.r, px + 3, py + 10, 10, 1);
      } else {
        F("#3a2314", px + 7, py + 9, 2, 6);
        F(p.t, px + 3, py + 2, 10, 9);
        F("rgba(255,255,255,.12)", px + 4, py + 3, 4, 2);
      }
    } else if (ch === "P") {
      F(p.b, px, py, T, T);
      F("rgba(0,0,0,.18)", px + T / 2, py, T / 2, T);
      F("rgba(0,0,0,.14)", px, py + 7, T, 1);
      F("rgba(255,255,255,.16)", px, py, T, 1);
    }
  }

  function build(m) {
    if (m.g) return;
    var genFn = m.gen || MAP_GENERATORS[m.id] || function() { return "."; };
    m.g = [];
    for (var y = 0; y < m.h; y++) {
      m.g[y] = [];
      for (var x = 0; x < m.w; x++) m.g[y][x] = genFn(x, y);
    }
    var pts = m.coisas.map(function(c) { return [c.x, c.y]; });
    pts.push(m.spawn, m.portal);
    pts.forEach(function(p) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var xx = p[0] + dx, yy = p[1] + dy;
          if (xx >= 0 && yy >= 0 && xx < m.w && yy < m.h) m.g[yy][xx] = m.fl;
        }
      }
    });
    m.all = m.coisas.concat([{ t: "p", x: m.portal[0], y: m.portal[1], n: "Portal de memória" }]);
    m.water = [];
    m.cache = document.createElement("canvas");
    m.cache.width = m.w * T;
    m.cache.height = m.h * T;
    var cg = m.cache.getContext("2d");
    cg.imageSmoothingEnabled = false;
    for (var yy = 0; yy < m.h; yy++) {
      for (var xx = 0; xx < m.w; xx++) {
        var ch = m.g[yy][xx];
        drawStaticTile(cg, m, ch, xx, yy);
        if (ch === "~") m.water.push([xx, yy]);
      }
    }
  }

  function solid(m, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    return SOLID.indexOf(m.g[ty][tx]) >= 0;
  }

  function blocked(m, px, py) {
    var p = [[px + 3, py + 8], [px + 12, py + 8], [px + 3, py + 15], [px + 12, py + 15]];
    for (var i = 0; i < 4; i++) {
      if (solid(m, Math.floor(p[i][0] / T), Math.floor(p[i][1] / T))) return true;
    }
    for (var j = 0; j < m.all.length; j++) {
      var c = m.all[j], ix = c.x * T, iy = c.y * T;
      if (px + 12 > ix + 2 && px + 3 < ix + 14 && py + 15 > iy + 6 && py + 8 < iy + 16) return true;
    }
    return false;
  }

  function nearest(m, px, py) {
    var cx = px + 8, cy = py + 8, b = null, bd = 999;
    m.all.forEach(function(c) {
      var d = Math.hypot(c.x * T + 8 - cx, c.y * T + 8 - cy);
      if (d < bd) { bd = d; b = c; }
    });
    return bd <= 26 ? b : null;
  }

  function R(ctx, c, x, y, w, h) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function person(ctx, x, y, c, id, stepDist) {
    x = Math.round(x);
    y = Math.round(y);
    var sk = c.sk || SKIN[((id || "").length + ((id || "").charCodeAt(1) || 0)) % 3];
    var stp = c.walk ? Math.floor((stepDist || 0) / 4) % 2 : 0;
    R(ctx, "rgba(0,0,0,.25)", x + 3, y + 14, 10, 2);
    R(ctx, c.body, x + 4, y + 7, 8, 7);
    R(ctx, "#2b1d16", x + 4, y + 13 - (stp === 1 ? 1 : 0), 3, 2);
    R(ctx, "#2b1d16", x + 9, y + 13 - (stp === 0 && c.walk ? 1 : 0), 3, 2);
    R(ctx, sk, x + 4, y + 1, 8, 7);
    R(ctx, "#1d1420", x + 4, y + 1, 8, 2);
    if (c.hat) R(ctx, c.hat, x + 3, y, 10, 2);
    R(ctx, "#1d1420", x + 6, y + 4, 1, 1);
    R(ctx, "#1d1420", x + 9, y + 4, 1, 1);
    if (c.pl) R(ctx, "#e6a23c", x + 3, y + 9, 2, 4);
  }

  function thing(ctx, c, frame, foundMap) {
    var x = c.x * T, y = c.y * T;
    if (c.t === "p") {
      R(ctx, "#2b1d16", x + 1, y + 3, 14, 13);
      R(ctx, "#120c18", x + 3, y + 5, 10, 11);
      var g = Math.floor(frame / 10) % 3;
      R(ctx, ["#e6a23c", "#5cc0b8", "#c7402d"][g], x + 5, y + 7, 6, 9);
      R(ctx, "#f1e7d3", x + 7, y + 9, 2, 2);
      return;
    }
    if (c.t === "s") {
      R(ctx, "#5a3b22", x + 7, y + 8, 2, 8);
      R(ctx, "#5a3b22", x + 2, y + 2, 12, 9);
      R(ctx, "#f1e7d3", x + 3, y + 3, 10, 7);
      R(ctx, "#8a7050", x + 4, y + 5, 8, 1);
      R(ctx, "#8a7050", x + 4, y + 7, 6, 1);
    } else {
      person(ctx, x, y, { body: c.c, hat: c.h }, c.id, 0);
    }
    if (!foundMap[c.id] && Math.floor(frame / 25) % 2 === 0) {
      R(ctx, "#e6a23c", x + 7, y - 6, 2, 4);
      R(ctx, "#e6a23c", x + 7, y - 1, 2, 2);
    }
  }

  function face(cvs, c) {
    var x = cvs.getContext("2d");
    var f = function(o, a, b, w, h) { x.fillStyle = o; x.fillRect(a, b, w, h); };
    x.clearRect(0, 0, 16, 16);
    f("#2a1d2e", 0, 0, 16, 16);
    if (c.t === "s") {
      f("#5a3b22", 3, 3, 10, 11);
      f("#f1e7d3", 4, 4, 8, 9);
      f("#8a7050", 5, 6, 6, 1);
      f("#8a7050", 5, 8, 6, 1);
      f("#8a7050", 5, 10, 4, 1);
      return;
    }
    var pl = c.pl, id = pl ? "pl" : c.id;
    var sk = SKIN[(id.length + (id.charCodeAt(1) || 0)) % 3];
    f(pl ? "#1f7a7a" : c.c, 2, 11, 12, 5);
    f(sk, 4, 3, 8, 8);
    f("#1d1420", 4, 3, 8, 2);
    if (!pl && c.h) f(c.h, 3, 2, 10, 2);
    f("#1d1420", 6, 7, 1, 1);
    f("#1d1420", 9, 7, 1, 1);
    f("#e6a23c", 7, 9, 2, 1);
  }

  function renderScene(ctx, vw, vh, m, st, frame, isWalking, stepDist, sealPending) {
    var mw = m.w * T, mh = m.h * T;
    var rx = Math.round(st.x), ry = Math.round(st.y);
    var cx = mw <= vw ? -Math.floor((vw - mw) / 2) : Math.max(0, Math.min(mw - vw, rx + 8 - Math.floor(vw / 2)));
    var cy = mh <= vh ? -Math.floor((vh - mh) / 2) : Math.max(0, Math.min(mh - vh, ry + 8 - Math.floor(vh / 2)));

    R(ctx, "#120c18", 0, 0, vw, vh);
    ctx.save();
    ctx.translate(-cx, -cy);

    if (m.cache) ctx.drawImage(m.cache, 0, 0);

    var p = m.pal, wstep = Math.floor(frame / 24);
    ctx.fillStyle = p.wv;
    for (var i = 0; i < m.water.length; i++) {
      var wx = m.water[i][0], wy = m.water[i][1], px = wx * T, py = wy * T;
      if (px + T < cx || px > cx + vw || py + T < cy || py > cy + vh) continue;
      var o = (wstep + wx + wy) % 2;
      ctx.fillRect(px + 2 + o * 6, py + 5, 5, 1);
      ctx.fillRect(px + 8 - o * 4, py + 11, 5, 1);
    }

    renderList.length = 0;
    for (var j = 0; j < m.all.length; j++) renderList.push({ y: m.all[j].y * T, c: m.all[j] });
    renderList.push({ y: ry, p: 1 });
    renderList.sort(function(a, b) { return a.y - b.y; });

    for (var k = 0; k < renderList.length; k++) {
      var item = renderList[k];
      if (item.p) person(ctx, rx, ry, { body: "#1f7a7a", pl: 1, walk: isWalking }, "pl", stepDist);
      else thing(ctx, item.c, frame, st.found);
    }

    var n = nearest(m, st.x, st.y);
    if (n && st.mode === "play") {
      ctx.strokeStyle = "#e6a23c";
      ctx.lineWidth = 1;
      ctx.strokeRect(n.x * T + 0.5, n.y * T + 0.5, T - 1, T - 1);
    }
    ctx.restore();

    if (m.tint) R(ctx, m.tint, 0, 0, vw, vh);
    if (sealPending) R(ctx, "rgba(96,96,108,.42)", 0, 0, vw, vh);
  }

  global.CDMWorld = {
    T: T,
    build: build,
    blocked: blocked,
    nearest: nearest,
    face: face,
    renderScene: renderScene
  };
})(window);
