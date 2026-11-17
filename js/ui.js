/* =====================================================================
   MÓDULO DE INTERFACE, MODAIS, LIVRO FÍSICO, MAPAS, GPS E NAVEGAÇÃO GLOBAL
   Gerencia toda a camada de apresentação DOM e interações pedagógicas
   ===================================================================== */
(function(global) {
  "use strict";

  var $ = function(id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function ic(name, extraCls) {
    return '<svg class="px-ic' + (extraCls ? ' ' + extraCls : '') + '" aria-hidden="true"><use href="#px-' + name + '"/></svg>';
  }

  var tt = null;
  var TY = { on: false, t: null, txt: "", n: 0, v: "" };
  var BS = { seq: [], pos: 0, round: 0, busy: false, tok: 0, shuf: [], answered: false };
  var PV = ["lo", "sl", "bell"];
  var GP = { t: null, iv: null };
  var CI = 0;
  var BP = 0;          /* Página atual do Livro de Memórias (0 a totalPages-1) */
  var BFlip = "";      /* Direção da animação de página: 'flip-next' | 'flip-prev' | '' */
  var activeModalId = "";
  var prevModalId = "";
  var IP = "";
  var MGon = true;

  try { MGon = localStorage.getItem("cdm2g") !== "0"; } catch (e) {}

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(tt);
    tt = setTimeout(function() { t.classList.remove("on"); }, 2600);
  }

  function hud() {
    var CDM = global.CDM;
    var c = CDM.cnt(CDM.st.mi), t = CDM.tot();
    $("mapName").textContent = CDM.cur().nome;
    $("count").textContent = "Mapa " + c[0] + "/" + c[1] + " · Livro " + t[0] + "/" + t[1] + " · Selos " + CDM.sealsCount() + "/" + CDM.MAPS.length;
  }

  function closeModals(keepHistory) {
    var CDM = global.CDM;
    BS.tok++;
    if (CDM && CDM.stopAll) CDM.stopAll();
    $("book").classList.remove("book-shell");
    ["mCred", "mMenu", "mGps", "mBoss", "mIntro", "mBook", "mMaps", "mConfirmHome", "mConfirmNew"].forEach(function(id) {
      var el = $(id);
      if (el) el.classList.remove("on");
    });
    if (!keepHistory) {
      activeModalId = "";
      prevModalId = "";
      if (CDM && CDM.isTitle && CDM.isTitle() && CDM.exitFs) CDM.exitFs();
    }
    if (CDM.st.mode === "modal") CDM.st.mode = "play";
  }

  /* Ação distinta do botão Voltar (↩): retorna ao modal anterior se veio de outro modal, ou ao Menu Inicial */
  function goBackFromModal() {
    if (prevModalId && prevModalId !== activeModalId) {
      var target = prevModalId;
      prevModalId = "";
      toggle(target, true);
      return;
    }
    if (global.CDM.isTitle()) {
      global.CDMAudio.sfx("close");
      closeModals();
    } else {
      requestReturnHome(false);
    }
  }

  /* Barra de navegação global equilibrada com ícones e rótulos curtos (.modal-nav-bar) */
  function globalNavBar(currentModal) {
    var CDM = global.CDM;
    var inTitle = CDM.isTitle();
    var h = '<nav class="modal-nav-bar" aria-label="Navegação rápida">';
    if (!inTitle) {
      h += '<button type="button" class="nav-pill-btn home" data-nav="home" data-tip="Voltar ao Menu Inicial" aria-label="Menu Inicial">' + ic("home") + '<span>Início</span></button>';
    }
    if (currentModal !== "mMaps") {
      h += '<button type="button" class="nav-pill-btn" data-nav="mMaps" data-tip="Mapas e Lugares de Memória" aria-label="Mapas">' + ic("map") + '<span>Mapas</span></button>';
    }
    if (currentModal !== "mBook") {
      h += '<button type="button" class="nav-pill-btn" data-nav="mBook" data-tip="Livro de Memórias" aria-label="Livro de Memórias">' + ic("book") + '<span>Livro</span></button>';
    }
    if (currentModal !== "mMenu") {
      h += '<button type="button" class="nav-pill-btn" data-nav="mMenu" data-tip="Configurações" aria-label="Configurações">' + ic("cog") + '<span>Config</span></button>';
    }
    h += '<button type="button" class="nav-pill-btn resume" data-nav="close" data-tip="' + (inTitle ? 'Voltar ao Menu Inicial' : 'Retomar exploração no mapa') + '" aria-label="' + (inTitle ? 'Voltar' : 'Continuar jogando') + '">' + ic(inTitle ? "back" : "play") + '<span>' + (inTitle ? 'Voltar' : 'Jogar') + '</span></button>';
    h += '</nav>';
    return h;
  }

  function bindGlobalNav(container) {
    container.querySelectorAll("[data-nav]").forEach(function(btn) {
      btn.onclick = function() {
        var target = btn.getAttribute("data-nav");
        if (target === "close") {
          global.CDMAudio.sfx("close");
          closeModals();
        } else if (target === "home") {
          requestReturnHome(false);
        } else {
          toggle(target);
        }
      };
    });
  }

  /* Solicita retorno ao Menu Inicial com confirmação quando em partida ou desafio ativo */
  function requestReturnHome(skipConfirm) {
    var CDM = global.CDM;
    if (CDM.isTitle()) {
      closeModals();
      return;
    }
    var bossActive = $("mBoss").classList.contains("on") && (BS.round > 0 || BS.seq.length > 0);
    if (!skipConfirm && (bossActive || CDM.st.mode === "play" || activeModalId)) {
      var prev = activeModalId;
      closeModals(true);
      prevModalId = prev;
      activeModalId = "mConfirmHome";
      CDM.st.mode = "modal";
      $("mConfirmHome").classList.add("on");
      focusFirstInModal("mConfirmHome");
      global.CDMAudio.sfx("open");
      return;
    }
    closeModals();
    CDM.goHome();
  }

  function toggle(id, isBackNav) {
    var CDM = global.CDM;
    if (CDM.st.mode === "dlg") return;
    var el = $(id), was = el.classList.contains("on");
    var lastActive = activeModalId;
    closeModals(true);
    if (was) {
      activeModalId = "";
      prevModalId = "";
      if (CDM.isTitle() && CDM.exitFs) CDM.exitFs();
      global.CDMAudio.sfx("close");
      return;
    }
    if (!isBackNav && lastActive && lastActive !== id) {
      prevModalId = lastActive;
    } else if (!lastActive) {
      prevModalId = "";
    }
    activeModalId = id;
    if (CDM.enterFs) CDM.enterFs();
    global.CDMAudio.sfx("open");
    if (id === "mBook") {
      BFlip = "";
      renderBook();
    } else if (id === "mMenu") {
      renderMenu();
    } else if (id === "mGps") {
      renderGps();
    } else if (id === "mMaps") {
      renderMaps();
    }
    el.classList.add("on");
    if (id === "mMaps") drawMaps();
    CDM.st.mode = "modal";
    focusFirstInModal(id);
  }

  /* ===================== DIÁLOGOS ===================== */
  function tyDone() {
    clearInterval(TY.t);
    TY.on = false;
    $("dSay").textContent = TY.txt;
  }

  function formatSpeech(c, rawText, isMe) {
    var trimmed = String(rawText || "").trim();
    if (!trimmed) return "";
    if (isMe || c.t === "n") {
      if (trimmed.charAt(0) !== "“" && trimmed.charAt(0) !== '"') {
        return "“" + trimmed + "”";
      }
    }
    return trimmed;
  }

  function showLine() {
    var CDM = global.CDM;
    var d = CDM.st.dlg, c = d.c, L = d.lines[d.i], me = typeof L === "object";
    var rawTxt = me ? L.t : L;
    var txt = formatSpeech(c, rawTxt, me);
    if (!d.pf) {
      global.CDMWorld.face($("pL"), c);
      global.CDMWorld.face($("pR"), { pl: 1 });
      d.pf = 1;
    }
    $("dWho").textContent = me ? "AYỌ̀BÁMI" : c.n;
    $("dTag").textContent = me
      ? "Jovem curador da exposição"
      : (c.role || (c.t === "n" ? "Guardião da memória" : "Marco histórico documental"));
    $("dlg").className = "on " + (me ? "r" : "l") + (d.lines.some(function(x) { return typeof x === "object"; }) ? " two" : "");
    clearInterval(TY.t);
    TY.txt = txt; TY.n = 0; TY.on = true; TY.v = me ? "p" : c.id;
    $("dSay").textContent = "";
    TY.t = setInterval(function() {
      TY.n++;
      $("dSay").textContent = txt.slice(0, TY.n);
      if (TY.n % 2 === 0 && txt.charAt(TY.n - 1) !== " ") global.CDMAudio.voice(TY.v);
      if (TY.n >= txt.length) tyDone();
    }, 24);
  }

  function showDlg() {
    showLine();
    $("dlg").classList.add("on");
  }

  function advDlg() {
    var CDM = global.CDM, d = CDM.st.dlg;
    if (TY.on) { tyDone(); return; }
    d.i++;
    if (d.i < d.lines.length) { showDlg(); return; }
    $("dlg").classList.remove("on");
    CDM.st.mode = "play";
    CDM.st.dlg = null;
    if (!CDM.st.found[d.c.id]) {
      CDM.st.found[d.c.id] = true;
      CDM.save();
      hud();
      global.CDMAudio.sfx("found");
      toast("Novo registro: " + d.c.e.ti);
      var c = CDM.cnt(CDM.st.mi), m = CDM.cur();
      if (c[0] === c[1]) {
        setTimeout(function() {
          toast(!CDM.st.seals[m.id]
            ? "A névoa avança pelo lugar… vá ao portal enfrentar o desafio."
            : "Mapa concluído. Abra Mapas para seguir viagem.");
        }, 2400);
      }
    }
  }

  /* ===================== LIVRO DE MEMÓRIAS FÍSICO (Seção 4 — Papel Pólen & Editorial) ===================== */
  function getBookTotalPages() {
    return 1 + global.CDM.MAPS.length + 2;
  }

  function turnBookPage(newPage) {
    var total = getBookTotalPages();
    if (newPage < 0 || newPage >= total || newPage === BP) return;
    BFlip = newPage > BP ? "flip-next" : "flip-prev";
    BP = newPage;
    global.CDMAudio.sfx("open");
    renderBook();
  }

  function renderLinksChunk(startIdx, endIdx) {
    var CDM = global.CDM, h = "";
    for (var i = startIdx; i < endIdx && i < CDM.LINKS.length; i++) {
      var l = CDM.LINKS[i];
      if (!(CDM.st.found[l.a] && CDM.st.found[l.b])) {
        h += '<div class="book-entry-locked">' +
          '<span>' + ic("lock", "sm") + ' <b>' + esc(CDM.E[l.a].ti) + ' ↔ ' + esc(CDM.E[l.b].ti) + '</b></span>' +
          '<span class="meta">Registros pendentes</span>' +
        '</div>';
        continue;
      }
      var head = '<p style="margin:0 0 4px"><b>' + esc(CDM.E[l.a].ti) + ' ↔ ' + esc(CDM.E[l.b].ti) + '</b></p>';
      if (CDM.st.solved[i]) {
        h += '<div class="link done">' +
          head +
          '<p style="margin:0">' + ic("check", "sm") + ' ' + esc(l.ok) + '</p>' +
          '<div class="book-entry-src" style="margin-top:6px">' + ic("source", "sm") + ' ' + esc(l.ref) + '</div>' +
        '</div>';
      } else {
        h += '<div class="link">' + head + '<p style="margin:0 0 6px">' + esc(l.q) + '</p>';
        CDM.st.shuf[i].forEach(function(o) {
          h += '<button class="opt" data-l="' + i + '" data-o="' + (o === l.ok ? 1 : 0) + '">' + esc(o) + '</button>';
        });
        h += '</div>';
      }
    }
    return h;
  }

  function renderBook() {
    var CDM = global.CDM;
    var el = $("book");
    el.classList.add("book-shell");

    var totalPages = getBookTotalPages();
    if (BP < 0) BP = 0;
    if (BP >= totalPages) BP = totalPages - 1;

    var pgNum = BP + 1;
    var seal = { d: "Documentado", o: "Tradição Oral" };
    var tCount = CDM.tot();
    var sCount = CDM.sealsCount();
    var cCount = Object.keys(CDM.st.solved).length;

    var h = '<div class="book-ribbon"></div>' +
      '<div class="book-top-bar">' +
        '<div class="book-top-left">' +
          '<button type="button" class="close" id="bBookBack" aria-label="Voltar" data-tip="Voltar">' + ic("back") + '</button>' +
          (BP !== 0 ? '<button type="button" class="close" id="bBookSum" aria-label="Sumário" data-tip="Sumário">' + ic("list") + '</button>' : '') +
        '</div>' +
        '<div class="book-top-title">' + ic("book") + ' <span>LIVRO DE MEMÓRIAS</span></div>' +
        '<div class="book-top-actions">' +
          '<button type="button" class="close" id="bBookMaps" aria-label="Mapas e Eras" data-tip="Mapas">' + ic("map") + '</button>' +
          '<button type="button" class="close" id="xB" aria-label="Fechar Livro" data-tip="Fechar">' + ic("close") + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="book-viewport">';

    if (BP === 0) {
      /* PÁGINA 1: FOLHA DE ROSTO & SUMÁRIO */
      h += '<div class="book-page is-cover ' + BFlip + '" id="bPageArea">' +
        '<div class="page-header">' +
          '<span class="page-chapter">Sumário Geral</span>' +
          '<span class="page-num-top">' + pgNum + '</span>' +
        '</div>' +
        '<div class="book-cover-frame">' +
          '<div class="meta" style="letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Exposição · 20 de Novembro</div>' +
          '<h2 class="book-cover-emblem">CAMINHOS DE MEMÓRIA</h2>' +
          '<p class="book-cover-sub">Caderno de Campo e Registros Historiográficos</p>' +
          '<div class="book-stats-grid">' +
            '<div class="book-stat-box"><b>' + tCount[0] + '/' + tCount[1] + '</b><span>Registros</span></div>' +
            '<div class="book-stat-box"><b>' + sCount + '/' + CDM.MAPS.length + '</b><span>Selos</span></div>' +
            '<div class="book-stat-box"><b>' + cCount + '/' + CDM.LINKS.length + '</b><span>Conexões</span></div>' +
          '</div>' +
          '<div class="book-index-list">';
      CDM.MAPS.forEach(function(m, idx) {
        var mc = CDM.cnt(idx);
        h += '<button type="button" class="book-idx-btn" data-bp="' + (idx + 1) + '">' +
          '<span>' + (idx + 1) + '. ' + esc(m.nome) + ' (' + mc[0] + '/' + mc[1] + ')' + (CDM.st.seals[m.id] ? ' ✔' : '') + '</span>' +
          '<span class="book-idx-pg">' + (idx + 2) + '</span>' +
        '</button>';
      });
      h += '<button type="button" class="book-idx-btn" data-bp="' + (CDM.MAPS.length + 1) + '">' +
             '<span>Conexões I (1–3)</span><span class="book-idx-pg">' + (CDM.MAPS.length + 2) + '</span>' +
           '</button>' +
           '<button type="button" class="book-idx-btn" data-bp="' + (CDM.MAPS.length + 2) + '">' +
             '<span>Conexões II (4–6)</span><span class="book-idx-pg">' + (CDM.MAPS.length + 3) + '</span>' +
           '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    } else if (BP >= 1 && BP <= CDM.MAPS.length) {
      /* PÁGINAS 2 A 8: CAPÍTULOS DE CADA ERA */
      var mIdx = BP - 1;
      var m = CDM.MAPS[mIdx];
      var mc = CDM.cnt(mIdx);
      h += '<div class="book-page ' + BFlip + '" id="bPageArea">' +
        '<div class="page-header">' +
          '<span class="page-chapter">Era ' + (mIdx + 1) + ' · ' + esc(m.epoca) + '</span>' +
          '<span class="page-num-top">' + pgNum + '</span>' +
        '</div>' +
        '<div class="chapter-bar">' +
          '<div class="chapter-bar-titles">' +
            '<h2>' + esc(m.nome) + '</h2>' +
          '</div>' +
          '<div class="chapter-bar-badges">' +
            '<span class="seal">' + mc[0] + '/' + mc[1] + ' Registros</span>' +
            (CDM.st.seals[m.id]
              ? '<span class="seal d">' + ic("check", "sm") + ' Selo</span>'
              : '<span class="seal">Selo pendente</span>') +
          '</div>' +
        '</div>' +
        '<div class="book-entries-grid">';

      m.coisas.forEach(function(c) {
        if (!CDM.st.found[c.id]) {
          h += '<div class="book-entry-locked">' +
            '<span>' + ic("lock", "sm") + ' <b>' + esc(c.n) + '</b></span>' +
            '<span>Não lido</span>' +
          '</div>';
          return;
        }
        var x = c.e;
        var whoLabel = c.role ? (esc(c.n) + ' · ' + esc(c.role)) : esc(c.n);
        h += '<article class="book-entry">' +
          '<div>' +
            '<div class="book-entry-top">' +
              '<span class="book-entry-title">' + esc(x.ti) + '</span>' +
              '<span class="seal ' + x.s + '">' + seal[x.s] + '</span>' +
            '</div>' +
            '<div class="book-entry-who">' + whoLabel + '</div>' +
            '<p class="book-entry-body">' + esc(x.tx) + '</p>' +
          '</div>' +
          '<div class="book-entry-src">' +
            ic("source", "sm") + ' ' + esc(x.src) +
            (x.nt ? '<div style="margin-top:2px;font-style:italic">' + esc(x.nt) + '</div>' : '') +
          '</div>' +
        '</article>';
      });

      h += '</div>';
      if (CDM.st.seals[m.id] && CDM.BOSS_DATA[m.id]) {
        h += '<div class="fb-box" style="margin-top:10px;padding:8px 10px">' +
          '<b>' + ic("check", "sm") + ' Portal Superado: ' + esc(CDM.BOSS_DATA[m.id].nome) + '</b>' +
          '<p style="margin:0;font-size:var(--fs-1)">' + esc(CDM.BOSS_DATA[m.id].win) + '</p>' +
        '</div>';
      }
      h += '</div>';
    } else if (BP === CDM.MAPS.length + 1) {
      /* PÁGINA 9: CONEXÕES HISTÓRICAS (1 A 3) */
      h += '<div class="book-page ' + BFlip + '" id="bPageArea">' +
        '<div class="page-header">' +
          '<span class="page-chapter">Caderno de Síntese · Parte I</span>' +
          '<span class="page-num-top">' + pgNum + '</span>' +
        '</div>' +
        '<h2 style="margin-bottom:8px">Conexões entre Registros (1 a 3)</h2>' +
        renderLinksChunk(0, 3) +
      '</div>';
    } else {
      /* PÁGINA 10: CONEXÕES HISTÓRICAS (4 A 6) + SÍNTESE FINAL */
      h += '<div class="book-page ' + BFlip + '" id="bPageArea">' +
        '<div class="page-header">' +
          '<span class="page-chapter">Caderno de Síntese · Parte II</span>' +
          '<span class="page-num-top">' + pgNum + '</span>' +
        '</div>' +
        '<h2 style="margin-bottom:8px">Conexões entre Registros (4 a 6)</h2>' +
        renderLinksChunk(3, 6);

      if (cCount === CDM.LINKS.length) {
        h += '<div class="final" style="margin-top:12px;padding:12px">' +
          '<b>' + ic("check", "sm") + ' Mapa de conexões completo</b>' +
          '<p style="margin:6px 0;font-style:italic;font-size:var(--fs-1)">“A história de um povo não começa com sua escravização, não termina com sua libertação e não pode ser contada apenas por aqueles que tentaram dominá-lo.”</p>' +
          '<label for="bookNote" style="display:block;font-weight:700;margin:6px 0 4px;font-size:var(--fs-1)">O que você levaria desta jornada para o seu presente?</label>' +
          '<textarea id="bookNote" aria-label="Sua síntese" placeholder="Registre aqui sua reflexão...">' + esc(CDM.st.note || "") + '</textarea>' +
        '</div>';
      }
      h += '</div>';
    }

    h += '</div>'; /* Fim de .book-viewport */

    /* Rodapé de Paginação Simplificada e Direta ("1", "2", "3"...) */
    h += '<div class="book-footer">' +
      '<button type="button" class="book-nav-btn" id="bPrevPg" aria-label="Página anterior" data-tip="Anterior"' + (BP <= 0 ? ' disabled' : '') + '>' + ic("prev") + '</button>' +
      '<div class="book-page-indicator" role="navigation" aria-label="Páginas do livro">';
    for (var p = 0; p < totalPages; p++) {
      h += '<button type="button" class="book-page-num-btn' + (p === BP ? ' on' : '') + '" data-pg="' + p + '" aria-label="Página ' + (p + 1) + '"' + (p === BP ? ' aria-current="page"' : '') + '>' + (p + 1) + '</button>';
    }
    h += '</div>' +
      '<button type="button" class="book-nav-btn" id="bNextPg" aria-label="Próxima página" data-tip="Próxima"' + (BP >= totalPages - 1 ? ' disabled' : '') + '>' + ic("next") + '</button>' +
    '</div>';

    el.innerHTML = h;
    BFlip = "";

    $("xB").onclick = function() { global.CDMAudio.sfx("close"); closeModals(); };
    $("bBookBack").onclick = function() { goBackFromModal(); };
    if ($("bBookSum")) $("bBookSum").onclick = function() { turnBookPage(0); };
    $("bBookMaps").onclick = function() { toggle("mMaps"); };
    $("bPrevPg").onclick = function() { turnBookPage(BP - 1); };
    $("bNextPg").onclick = function() { turnBookPage(BP + 1); };

    el.querySelectorAll("[data-pg]").forEach(function(btn) {
      btn.onclick = function() { turnBookPage(+btn.getAttribute("data-pg")); };
    });
    el.querySelectorAll("[data-bp]").forEach(function(btn) {
      btn.onclick = function() { turnBookPage(+btn.getAttribute("data-bp")); };
    });

    if ($("bookNote")) {
      $("bookNote").oninput = function() {
        CDM.st.note = this.value;
        CDM.save();
      };
    }
    el.querySelectorAll(".opt").forEach(function(b) {
      b.onclick = function() {
        if (b.getAttribute("data-o") === "1") {
          CDM.st.solved[b.getAttribute("data-l")] = true;
          CDM.save();
          global.CDMAudio.sfx("ok");
          renderBook();
        } else {
          global.CDMAudio.sfx("no");
          b.classList.add("bad");
          b.disabled = true;
        }
      };
    });

    /* Gesto de swipe suave para virar páginas em telas sensíveis ao toque */
    var pgArea = $("bPageArea"), sx0 = null, sy0 = null;
    if (pgArea) {
      pgArea.addEventListener("pointerdown", function(e) {
        if (e.target && (e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON")) return;
        sx0 = e.clientX; sy0 = e.clientY;
      });
      pgArea.addEventListener("pointerup", function(e) {
        if (sx0 === null) return;
        var dx = e.clientX - sx0, dy = e.clientY - sy0;
        sx0 = null; sy0 = null;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          if (dx < 0) turnBookPage(BP + 1);
          else turnBookPage(BP - 1);
        }
      });
      pgArea.addEventListener("pointercancel", function() { sx0 = null; sy0 = null; });
    }
  }

  /* ===================== DESAFIOS / BOSSES ===================== */
  function bossOpen() {
    var CDM = global.CDM, m = CDM.cur(), bd = CDM.BOSS_DATA[m.id];
    if (!bd) return;
    CDM.st.mode = "modal";
    BS.round = 0; BS.seq = []; BS.pos = 0; BS.busy = false; BS.answered = false; BS.tok++;
    if (bd.type === "quiz") prepQuiz(bd);
    bossRender("");
    $("mBoss").classList.add("on");
    focusFirstInModal("mBoss");
  }

  function prepQuiz(bd) {
    var step = bd.steps[BS.round];
    if (!step) return;
    BS.answered = false;
    var opts = [step.ok].concat(step.bad);
    for (var j = opts.length - 1; j > 0; j--) {
      var r = Math.floor(Math.random() * (j + 1)), t = opts[j];
      opts[j] = opts[r]; opts[r] = t;
    }
    BS.shuf = opts;
  }

  function bossWin() {
    var CDM = global.CDM, m = CDM.cur();
    CDM.st.seals[m.id] = true;
    CDM.save();
    hud();
    global.CDMAudio.sfx("found");
    toast("Selo da Era " + (CDM.st.mi + 1) + " conquistado!");
    bossRender("", true);
  }

  function flash(p) {
    var b = document.querySelectorAll(".pad")[p];
    if (!b) return;
    b.classList.add("fl");
    setTimeout(function() { b.classList.remove("fl"); }, 340);
    if (global.CDMAudio.AU.c) global.CDMAudio.hit(PV[p], global.CDMAudio.AU.c.currentTime, 0.9, true);
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function bossPlay() {
    global.CDMAudio.snd();
    var tk = ++BS.tok;
    BS.pos = 0;
    if (!BS.seq.length) {
      for (var i = 0; i < BS.round + 3; i++) BS.seq.push(Math.floor(Math.random() * 3));
    }
    BS.busy = true;
    $("bMsg").textContent = "Observe e ouça a sequência…";
    BS.seq.forEach(function(p, i) {
      setTimeout(function() {
        if (tk !== BS.tok) return;
        flash(p);
        if (i === BS.seq.length - 1) {
          setTimeout(function() {
            if (tk === BS.tok) { BS.busy = false; $("bMsg").textContent = "Sua vez: toque nos registros na mesma ordem."; }
          }, 500);
        }
      }, 650 + i * 650);
    });
  }

  function bossTap(p) {
    if (BS.busy || !BS.seq.length) return;
    global.CDMAudio.snd();
    flash(p);
    if (BS.seq[BS.pos] !== p) {
      BS.pos = 0;
      global.CDMAudio.sfx("no");
      $("bMsg").textContent = "Ordem incorreta. Toque em 'Ouvir / Ver ritmo' para tentar de novo.";
      return;
    }
    BS.pos++;
    if (BS.pos < BS.seq.length) return;
    BS.round++;
    BS.seq = [];
    BS.pos = 0;
    if (BS.round >= 3) bossWin();
    else bossRender("Sequência correta! Prepare-se para a rodada " + (BS.round + 1) + "/3.");
  }

  function bossRender(msg, win) {
    var CDM = global.CDM, m = CDM.cur(), bd = CDM.BOSS_DATA[m.id], el = $("boss");
    var subTitle = bd.sub || ("Guardião do Portal · " + m.nome);
    var h = '<div class="modal-hdr">' +
              '<span class="hdr-spacer"></span>' +
              '<h2>' + esc(bd.nome) + '</h2>' +
              '<button type="button" class="hdr-icon-btn close" id="xBo" aria-label="Fechar Desafio" data-tip="Fechar">' + ic("close") + '</button>' +
            '</div>' +
            '<div class="screen-body">' +
            '<p class="meta" style="font-style:italic;text-align:center;margin-top:0">' + esc(subTitle) + ' · Era ' + (CDM.st.mi + 1) + '</p>';

    if (win) {
      h += '<div class="link done" style="margin:14px 0"><p><b>' + ic("check", "sm") + ' ' + esc(bd.win) + '</b></p>' +
           '<p style="margin-top:6px">Selo da Era ' + (CDM.st.mi + 1) + ' registrado no seu Livro de Memórias.</p>' +
           (bd.ref ? '<div class="meta" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)">' + ic("source", "sm") + ' ' + esc(bd.ref) + '</div>' : '') +
           '</div>' +
           '<div class="modal-nav-row">' +
             '<button class="mc" id="bWinBook">' + ic("book") + '<span>Ver no Livro</span></button>' +
             '<button class="mc pri" id="bEnd">' + ic("map") + '<span>Selecionar Próxima Era</span>' + ic("next", "sm") + '</button>' +
           '</div>';
    } else if (bd.type === "rhythm") {
      h += '<p>' + esc(bd.desc) + '</p>' +
           '<div class="bar"><i style="width:' + Math.round(BS.round / 3 * 100) + '%"></i></div><div class="pads">';
      bd.pads.forEach(function(id, idx) {
        h += '<button class="pad"><b>[' + (idx + 1) + ']</b> ' + esc(CDM.E[id].ti) + '</button>';
      });
      h += '</div><p class="meta" id="bMsg">' + esc(msg || "Toque no botão abaixo para iniciar a rodada " + (BS.round + 1) + "/3.") + '</p>' +
           '<button class="mc pri" id="bGo">' + ic("sound") + '<span>Ouvir / Ver ritmo</span></button>';
    } else {
      var stp = bd.steps[BS.round];
      var pct = Math.round(((BS.round + (BS.answered ? 1 : 0)) / bd.steps.length) * 100);
      h += '<p>' + esc(bd.desc) + '</p>' +
           '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
           '<p><b>Etapa ' + (BS.round + 1) + '/' + bd.steps.length + ': ' + esc(stp.q) + '</b></p><div>';
      BS.shuf.forEach(function(o) {
        var isOk = (o === stp.ok);
        var cls = "opt" + (BS.answered ? (isOk ? " ok-ans" : " bad") : "");
        h += '<button class="' + cls + '" data-ok="' + (isOk ? 1 : 0) + '"' + (BS.answered ? ' disabled' : '') + '>' + (BS.answered && isOk ? ic("check", "sm") + ' ' : '') + esc(o) + '</button>';
      });
      h += '</div>';
      if (BS.answered) {
        h += '<div class="fb-box">' +
             '<b>' + ic("check", "sm") + ' Resposta correta!</b>' +
             '<p>' + esc(stp.exp) + '</p>' +
             '<div class="meta">' + ic("source", "sm") + ' Referência: ' + esc(stp.ref) + '</div>' +
             '</div>' +
             '<button class="mc pri" id="bNextStep" style="margin-top:10px">' +
             (BS.round + 1 >= bd.steps.length
               ? ic("check") + '<span>Concluir Desafio e Receber Selo</span>'
               : '<span>Próxima Etapa</span>' + ic("next", "sm")) +
             '</button>';
      } else {
        h += '<p class="meta" id="bMsg">' + esc(msg || "Selecione a alternativa historicamente correta.") + '</p>';
      }
    }

    h += '</div>';
    el.innerHTML = h;
    $("xBo").onclick = function() { closeModals(); };
    if (win) {
      $("bWinBook").onclick = function() {
        BP = CDM.st.mi + 1;
        toggle("mBook");
      };
      $("bEnd").onclick = function() {
        closeModals();
        CI = (CDM.st.mi + 1) % CDM.MAPS.length;
        $("mMaps").classList.add("on");
        CDM.st.mode = "modal";
        drawMaps();
      };
      return;
    }
    if (bd.type === "rhythm") {
      $("bGo").onclick = bossPlay;
      el.querySelectorAll(".pad").forEach(function(b, i) { b.onclick = function() { bossTap(i); }; });
    } else if (BS.answered) {
      $("bNextStep").onclick = function() {
        BS.round++;
        if (BS.round >= bd.steps.length) bossWin();
        else { prepQuiz(bd); bossRender(""); }
      };
    } else {
      el.querySelectorAll(".opt").forEach(function(b) {
        b.onclick = function() {
          if (b.getAttribute("data-ok") === "1") {
            global.CDMAudio.sfx("ok");
            BS.answered = true;
            bossRender("");
          } else {
            global.CDMAudio.sfx("no");
            b.classList.add("bad");
            b.disabled = true;
            $("bMsg").textContent = "Essa alternativa não corresponde às fontes históricas coletadas neste mapa. Tente outra opção.";
          }
        };
      });
    }
  }

  /* ===================== MENU, GPS, MINIMAPA E NAVEGAÇÃO DE ERAS (Itens 3 e 5) ===================== */
  function makeSwitch(id, checked, labelId) {
    return '<button type="button" class="px-switch" id="' + id + '" role="switch" aria-checked="' + (checked ? 'true' : 'false') + '"' + (labelId ? ' aria-labelledby="' + labelId + '"' : '') + '>' +
      '<span class="px-switch-state">' + (checked ? 'SIM' : 'NÃO') + '</span>' +
      '<span class="px-switch-track"><span class="px-switch-thumb"></span></span>' +
    '</button>';
  }

  function updateSwitch(btn, isChecked) {
    if (!btn) return;
    btn.setAttribute("aria-checked", isChecked ? "true" : "false");
    var stSpan = btn.querySelector(".px-switch-state");
    if (stSpan) stSpan.textContent = isChecked ? "SIM" : "NÃO";
  }

  function makeRange(id, min, max, val, suffix) {
    var pct = Math.round(((val - min) / (max - min)) * 100);
    return '<input type="range" class="px-range" id="' + id + '" min="' + min + '" max="' + max + '" value="' + val + '" style="--pct:' + pct + '%" data-suf="' + (suffix || '%') + '">';
  }

  function bindRange(id, badgeId, onChangeFn) {
    var inp = $(id), bdg = $(badgeId);
    if (!inp) return;
    inp.oninput = function() {
      var min = +this.min || 0, max = +this.max || 100, val = +this.value;
      var pct = Math.round(((val - min) / (max - min)) * 100);
      this.style.setProperty("--pct", pct + "%");
      if (bdg) bdg.textContent = val + (this.getAttribute("data-suf") || "%");
      onChangeFn(val);
    };
  }

  function openNewGameModal() {
    closeModals();
    global.CDM.st.mode = "modal";
    $("mConfirmNew").classList.add("on");
    focusFirstInModal("mConfirmNew");
    global.CDMAudio.sfx("open");
  }

  function resetBookAndMapState() {
    BP = 0;
    CI = 0;
    BFlip = "";
    GP.t = null;
  }

  function renderMenu() {
    var CDM = global.CDM, AU = global.CDMAudio.AU, CFG = CDM.CFG;
    var inTitle = CDM.isTitle();
    var vSens = Math.round(CFG.sens * 100);
    var vSpd  = Math.round(CFG.spd * 100);
    var vVol  = Math.round(CFG.vol * 100);
    var vMus  = Math.round(AU.mv * 100);
    var vFx   = Math.round(AU.fv * 100);
    var fsOn  = CDM.isFs ? CDM.isFs() : false;

    var h = '<div class="modal-hdr">' +
        '<button type="button" class="hdr-icon-btn" id="bMeBack" aria-label="Voltar" data-tip="Voltar">' + ic("back") + '</button>' +
        '<h2>Configurações</h2>' +
        '<button type="button" class="hdr-icon-btn close" id="xMe" aria-label="Fechar Configurações" data-tip="Fechar">' + ic("close") + '</button>' +
      '</div>' +
      '<div class="screen-body">' +
      '<p class="meta" style="text-align:center;margin-top:0">Ajuste os controles, a interface e o volume do áudio.</p>' +

      '<h3>Jogabilidade e Interface</h3>' +
      '<div class="cfg-group">' +
        '<div class="cfg-row">' +
          '<div class="cfg-row-inline">' +
            '<label class="cfg-label" for="rS">Sensibilidade do direcional</label>' +
            '<span class="cfg-val" id="vS">' + vSens + '%</span>' +
          '</div>' +
          makeRange("rS", 60, 140, vSens, "%") +
        '</div>' +
        '<div class="cfg-row">' +
          '<div class="cfg-row-inline">' +
            '<label class="cfg-label" for="rV">Velocidade de caminhada</label>' +
            '<span class="cfg-val" id="vV">' + vSpd + '%</span>' +
          '</div>' +
          makeRange("rV", 70, 130, vSpd, "%") +
        '</div>' +
        '<div class="cfg-row">' +
          '<div class="cfg-row-inline">' +
            '<span class="cfg-label" id="lblMini">Exibir minimapa na tela</span>' +
            makeSwitch("tMini", MGon, "lblMini") +
          '</div>' +
        '</div>' +
        '<div class="cfg-row">' +
          '<div class="cfg-row-inline">' +
            '<span class="cfg-label" id="lblFs">Modo Tela Cheia</span>' +
            makeSwitch("tFs", fsOn, "lblFs") +
          '</div>' +
        '</div>' +
      '</div>' +

      '<h3>Áudio</h3>' +
      '<div class="cfg-group">' +
        '<div class="cfg-row">' +
          '<div class="cfg-row-inline">' +
            '<label class="cfg-label" for="rG">Volume geral</label>' +
            '<span class="cfg-val" id="vG">' + vVol + '%</span>' +
          '</div>' +
          makeRange("rG", 0, 100, vVol, "%") +
        '</div>' +
        '<div class="cfg-row">' +
          '<div class="cfg-row-inline">' +
            '<span class="cfg-label" id="lblMus">Música de fundo</span>' +
            makeSwitch("tM", AU.on, "lblMus") +
          '</div>' +
          '<div class="cfg-row-inline" style="margin-top:4px">' +
            '<span class="meta">Volume da música</span>' +
            '<span class="cfg-val" id="vM">' + vMus + '%</span>' +
          '</div>' +
          makeRange("rM", 0, 100, vMus, "%") +
        '</div>' +
        '<div class="cfg-row">' +
          '<div class="cfg-row-inline">' +
            '<span class="cfg-label" id="lblFx">Efeitos sonoros e vozes</span>' +
            makeSwitch("tF", AU.fxOn, "lblFx") +
          '</div>' +
          '<div class="cfg-row-inline" style="margin-top:4px">' +
            '<span class="meta">Volume dos efeitos</span>' +
            '<span class="cfg-val" id="vF">' + vFx + '%</span>' +
          '</div>' +
          makeRange("rF", 0, 100, vFx, "%") +
        '</div>' +
      '</div>';

    if (!inTitle) {
      h += '<h3>Partida</h3>' +
           '<div class="modal-nav-row">' +
             '<button class="mc" id="bGoTitle">' + ic("home") + '<span>Menu Inicial</span></button>' +
             '<button class="mc danger" id="bResetFromCfg">' + ic("reset") + '<span>Novo Jogo</span></button>' +
           '</div>';
    }

    h += '<p class="meta" style="margin-top:12px;text-align:center">Atalhos: WASD andam (Shift corre) · Setas navegam na interface · Enter confirma · Espaço interage · B Livro · M Mapas · G Minimapa · F Tela Cheia · Esc Config.</p>' +
         '</div>' + globalNavBar("mMenu");

    $("menu").innerHTML = h;
    $("xMe").onclick = function() { global.CDMAudio.sfx("close"); closeModals(); };
    $("bMeBack").onclick = function() { goBackFromModal(); };
    bindGlobalNav($("menu"));

    bindRange("rS", "vS", function(v) { CFG.sens = v / 100; CDM.cfgSave(); });
    bindRange("rV", "vV", function(v) { CFG.spd = v / 100; CDM.cfgSave(); });
    bindRange("rG", "vG", function(v) { CFG.vol = v / 100; global.CDMAudio.sset(); });
    bindRange("rM", "vM", function(v) { AU.mv = v / 100; global.CDMAudio.sset(); });
    bindRange("rF", "vF", function(v) { AU.fv = v / 100; global.CDMAudio.sset(); });

    $("tMini").onclick = function() {
      gpsTog();
      updateSwitch(this, MGon);
    };
    $("tFs").onclick = function() {
      if (CDM.toggleFs) CDM.toggleFs();
    };
    $("tM").onclick = function() {
      AU.on = !AU.on;
      global.CDMAudio.sset();
      updateSwitch(this, AU.on);
    };
    $("tF").onclick = function() {
      AU.fxOn = !AU.fxOn;
      global.CDMAudio.sset();
      updateSwitch(this, AU.fxOn);
    };

    if ($("bGoTitle")) {
      $("bGoTitle").onclick = function() { requestReturnHome(true); };
    }
    if ($("bResetFromCfg")) {
      $("bResetFromCfg").onclick = function() { openNewGameModal(); };
    }
  }

  function renderGps() {
    var CDM = global.CDM, m = CDM.cur();
    $("gps").innerHTML = '<div class="modal-hdr">' +
      '<button type="button" class="hdr-icon-btn" id="bGpsBack" aria-label="Voltar" data-tip="Voltar">' + ic("back") + '</button>' +
      '<h2>GPS · ' + esc(m.nome) + '</h2>' +
      '<button type="button" class="hdr-icon-btn close" id="xG" aria-label="Fechar GPS" data-tip="Fechar">' + ic("close") + '</button>' +
    '</div><div class="screen-body" style="text-align:center"><canvas id="gpsC"></canvas><p id="gpsT"><b></b></p><p class="meta">Dourado: falta descobrir · Verde: descoberto · Azul: portal · Branco: você. Toque num item abaixo para traçar rota.</p><div id="gpsL"></div></div>' + globalNavBar("mGps");
    $("xG").onclick = function() { global.CDMAudio.sfx("close"); closeModals(); };
    $("bGpsBack").onclick = function() { goBackFromModal(); };
    bindGlobalNav($("gps"));
    var L = "";
    m.all.forEach(function(c) {
      if (c.t === "p") return;
      L += '<button class="mp gl" data-id="' + c.id + '">' + (CDM.st.found[c.id] ? ic("check", "sm") + " " : "• ") + esc(c.n) + '</button>';
    });
    $("gpsL").innerHTML = L;
    $("gpsL").querySelectorAll(".gl").forEach(function(b) {
      b.onclick = function() { GP.t = b.getAttribute("data-id"); gpsDraw(); };
    });
    clearInterval(GP.iv);
    GP.iv = setInterval(function() {
      if (!$("mGps").classList.contains("on")) { clearInterval(GP.iv); return; }
      gpsDraw();
    }, 80);
    gpsDraw();
  }

  function gpsDraw() {
    var CDM = global.CDM, m = CDM.cur(), cvs = $("gpsC"), T = global.CDMWorld.T;
    if (!cvs) return;
    global.CDMWorld.build(m);
    var s = Math.max(4, Math.floor(Math.min((innerWidth - 64) / m.w, innerHeight * 0.36 / m.h)));
    cvs.width = m.w * s;
    cvs.height = m.h * s;
    var g = cvs.getContext("2d"), fr = Date.now() / 300;
    g.imageSmoothingEnabled = false;
    if (m.cache) g.drawImage(m.cache, 0, 0, cvs.width, cvs.height);
    g.fillStyle = "rgba(10,6,14,.35)";
    g.fillRect(0, 0, cvs.width, cvs.height);
    var tg = null, px = (CDM.st.x + 8) / T, py = (CDM.st.y + 8) / T, bd = 1e9;
    m.all.forEach(function(c) {
      if (c.t === "p" || CDM.st.found[c.id]) return;
      var d = Math.hypot(c.x + 0.5 - px, c.y + 0.5 - py);
      if (GP.t === c.id) { tg = c; bd = -1; }
      else if (bd >= 0 && d < bd) { bd = d; tg = c; }
    });
    if (GP.t && !tg) {
      var c0 = m.all.filter(function(c) { return c.id === GP.t; })[0];
      if (c0) tg = c0;
    }
    if (!tg) tg = m.all[m.all.length - 1];
    if (tg) {
      g.setLineDash([s, s]);
      g.strokeStyle = "#e6a23c";
      g.lineWidth = Math.max(2, s / 3);
      g.beginPath();
      g.moveTo(px * s, py * s);
      g.lineTo((tg.x + 0.5) * s, (tg.y + 0.5) * s);
      g.stroke();
      g.setLineDash([]);
    }
    m.all.forEach(function(c) {
      var cx = (c.x + 0.5) * s, cy = (c.y + 0.5) * s, r = s * 0.85;
      if (c.t === "p") {
        g.fillStyle = "#5cc0b8";
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
      } else if (CDM.st.found[c.id]) {
        g.fillStyle = "#7bd39a";
        g.beginPath(); g.arc(cx, cy, r * 0.8, 0, 6.3); g.fill();
      } else {
        g.strokeStyle = "#e6a23c"; g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cy, r * (1 + 0.35 * Math.sin(fr + c.x)), 0, 6.3); g.stroke();
        g.fillStyle = "#e6a23c";
        g.beginPath(); g.arc(cx, cy, r * 0.5, 0, 6.3); g.fill();
      }
    });
    g.fillStyle = "#fff"; g.strokeStyle = "#1d1420"; g.lineWidth = 2;
    g.beginPath(); g.arc(px * s, py * s, s * 0.75, 0, 6.3); g.fill(); g.stroke();
    var ck = CDM.cnt(CDM.st.mi);
    $("gpsT").textContent = (ck[0] === ck[1] && !CDM.st.seals[m.id])
      ? "Todos os registros lidos! Siga até o Portal (quadrado azul) para o desafio da Era."
      : (tg ? "Destino: " + tg.n + " · " + Math.round(Math.hypot(tg.x + 0.5 - px, tg.y + 0.5 - py)) + " passos" : "Mapa completo.");
  }

  function gpsTog() {
    MGon = !MGon;
    $("mini").style.display = MGon ? "block" : "none";
    try { localStorage.setItem("cdm2g", MGon ? "1" : "0"); } catch (e) {}
  }

  function drawMini() {
    var CDM = global.CDM;
    if (!CDM.MAPS.length) return;
    var m = CDM.cur(), T = global.CDMWorld.T;
    if (!MGon || !m || !m.g || CDM.isTitle()) return;
    var mg = $("mini").getContext("2d");
    var s = 5, px = (CDM.st.x + 8) / T, py = (CDM.st.y + 8) / T, fr = Date.now() / 300;
    mg.fillStyle = "#120c18";
    mg.fillRect(0, 0, 125, 125);
    if (m.cache) {
      mg.imageSmoothingEnabled = false;
      mg.drawImage(m.cache, Math.round(62.5 - px * s), Math.round(62.5 - py * s), m.w * s, m.h * s);
    }
    m.all.forEach(function(c) {
      var x = 62.5 + (c.x + 0.5 - px) * s, y = 62.5 + (c.y + 0.5 - py) * s;
      if (x < 2 || y < 2 || x > 123 || y > 123) return;
      if (c.t === "p") { mg.fillStyle = "#5cc0b8"; mg.fillRect(x - 3, y - 3, 6, 6); }
      else if (CDM.st.found[c.id]) { mg.fillStyle = "#7bd39a"; mg.fillRect(x - 2, y - 2, 4, 4); }
      else { mg.fillStyle = Math.sin(fr + c.x) > 0 ? "#e6a23c" : "#fff2c0"; mg.fillRect(x - 3, y - 3, 6, 6); }
    });
    mg.fillStyle = "#fff"; mg.fillRect(60, 60, 5, 5);
    mg.strokeStyle = "#1d1420"; mg.lineWidth = 1; mg.strokeRect(60, 60, 5, 5);
  }

  function thumb(cvs, m, s) {
    global.CDMWorld.build(m);
    cvs.width = m.w * s;
    cvs.height = m.h * s;
    var g = cvs.getContext("2d");
    g.imageSmoothingEnabled = false;
    if (m.cache) g.drawImage(m.cache, 0, 0, cvs.width, cvs.height);
    m.all.forEach(function(c) {
      var cx = (c.x + 0.5) * s, cy = (c.y + 0.5) * s, r = Math.max(2, s * 0.45);
      if (c.t === "p") {
        g.fillStyle = "#5cc0b8";
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
      } else {
        g.fillStyle = global.CDM.st.found[c.id] ? "#7bd39a" : "#e6a23c";
        g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
      }
    });
  }

  function renderMaps() {
    CI = global.CDM.st.mi;
    drawMaps();
  }

  function moveMapSelection(delta) {
    var n = global.CDM.MAPS.length;
    if (!n) return;
    CI = (CI + delta + n) % n;
    global.CDMAudio.sfx("tap");
    drawMaps();
  }

  function activateSelectedMap() {
    var CDM = global.CDM;
    /* Se o jogador estava na Tela Inicial e acionou Play em um mapa, inicia a partida diretamente nele */
    if (CDM.isTitle()) {
      closeModals();
      CDM.startFromMap(CI);
      return;
    }
    /* Se já está neste mapa, apenas fecha o modal e retoma a exploração sem recarregar nem simular nova transição */
    if (CI === CDM.st.mi) {
      global.CDMAudio.sfx("close");
      closeModals();
      return;
    }
    CDM.go(CI);
  }

  function drawMaps() {
    var CDM = global.CDM, m = CDM.MAPS[CI], c = CDM.cnt(CI), n = CDM.MAPS.length, hasSeal = !!CDM.st.seals[m.id];
    var isCurrent = (!CDM.isTitle() && CI === CDM.st.mi);
    var bossReady = (isCurrent && c[0] === c[1] && !hasSeal);
    var pct = c[1] ? Math.round((c[0] / c[1]) * 100) : 0;
    var bd = CDM.BOSS_DATA[m.id];

    var playAria = isCurrent
      ? "Continuar exploração em " + m.nome
      : "Entrar no mapa " + m.nome;

    var backTitle = prevModalId
      ? "Voltar à tela anterior"
      : (CDM.isTitle() ? "Voltar ao Menu Inicial" : "Ir para o Menu Inicial");

    /* Lista de registros/personagens disponíveis nesta Era */
    var itemsHtml = '<div class="map-items-grid" role="list" aria-label="Registros desta Era">';
    m.coisas.forEach(function(item) {
      var done = !!CDM.st.found[item.id];
      var typeLbl = item.t === "n" ? (item.role || "Personagem") : (item.role || "Marco documental");
      itemsHtml += '<div class="map-item-chip' + (done ? ' done' : '') + '" role="listitem">' +
        '<span class="map-item-ic">' + (done ? ic("check", "sm") : '•') + '</span>' +
        '<div class="map-item-txt">' +
          '<b>' + esc(item.n) + '</b>' +
          '<span>' + esc(done ? item.e.ti : typeLbl) + '</span>' +
        '</div>' +
      '</div>';
    });
    if (bd) {
      itemsHtml += '<div class="map-item-chip portal-chip' + (hasSeal ? ' done' : (c[0] === c[1] ? ' ready' : '')) + '" role="listitem">' +
        '<span class="map-item-ic">' + (hasSeal ? ic("check", "sm") : ic("portal", "sm")) + '</span>' +
        '<div class="map-item-txt">' +
          '<b>Portal: ' + esc(bd.nome) + '</b>' +
          '<span>' + (hasSeal ? 'Selo conquistado' : (c[0] === c[1] ? 'Desafio liberado!' : 'Leia todos os registros para liberar')) + '</span>' +
        '</div>' +
      '</div>';
    }
    itemsHtml += '</div>';

    var h = '<div class="modal-hdr">' +
        '<button type="button" class="hdr-icon-btn" id="mBackBtn" aria-label="' + esc(backTitle) + '" data-tip="Voltar">' + ic("back") + '</button>' +
        '<h2>Mapas · Lugares de Memória</h2>' +
        '<button type="button" class="hdr-icon-btn close" id="xM" aria-label="Fechar Mapas" data-tip="Fechar">' + ic("close") + '</button>' +
      '</div>' +
      '<div class="map-car">' +
        '<button type="button" class="map-nv" id="mP" aria-label="Mapa anterior" data-tip="Anterior">' + ic("prev", "lg") + '</button>' +
        '<div class="map-card' + (isCurrent ? ' is-current' : '') + '" id="mCard">' +
          '<div class="map-col-visual">' +
            '<div class="map-preview-wrap" id="mStage" title="' + esc(playAria) + '">' +
              '<canvas id="mTh"></canvas>' +
              '<button type="button" class="map-play-overlay' + (isCurrent ? ' is-current-play' : '') + '" id="mPlayBtn" aria-label="' + esc(playAria) + '" data-tip="' + esc(isCurrent ? 'Continuar exploração' : 'Jogar nesta Era') + '">' +
                ic("play", "lg") +
              '</button>' +
            '</div>' +
            (isCurrent
              ? (bossReady
                  ? '<button type="button" class="map-status-banner boss-ready" id="mBossTrigger">' + ic("portal", "sm") + ' <span>Enfrentar Desafio do Portal</span></button>'
                  : '<div class="map-status-banner">' + ic("gps", "sm") + ' <span>Você está neste mapa · Toque em ▶ para continuar</span></div>')
              : '<button type="button" class="map-status-banner play-cta" id="mEnterBtn">' + ic("play", "sm") + ' <span>Entrar em ' + esc(m.nome) + '</span></button>') +
          '</div>' +
          '<div class="map-col-details">' +
            '<div class="map-card-top">' +
              '<div class="map-BadgeRow">' +
                '<span class="era-pill">Era ' + (CI + 1) + ' de ' + n + '</span>' +
                (isCurrent ? '<span class="era-pill cur">Mapa Atual</span>' : '') +
                (hasSeal
                  ? '<span class="era-pill seal-ok">' + ic("check", "sm") + ' Selo</span>'
                  : '<span class="era-pill seal-pend">Selo Pendente</span>') +
              '</div>' +
              '<div class="map-title">' + esc(m.nome) + '</div>' +
              '<div class="map-epoca">' + esc(m.epoca) + '</div>' +
            '</div>' +
            '<div class="map-progress-row">' +
              '<div class="map-progress-stats">' +
                '<span>Progresso da Era: ' + c[0] + '/' + c[1] + ' registros</span>' +
                '<span>' + pct + '%</span>' +
              '</div>' +
              '<div class="map-progress-bar"><i style="width:' + pct + '%"></i></div>' +
            '</div>' +
            itemsHtml +
          '</div>' +
        '</div>' +
        '<button type="button" class="map-nv" id="mN" aria-label="Próximo mapa" data-tip="Próximo">' + ic("next", "lg") + '</button>' +
      '</div>' +
      '<div class="map-footer-bar">' +
        '<div class="map-thumbs" role="tablist" aria-label="Atalhos das Eras">';

    CDM.MAPS.forEach(function(mp, i) {
      var mc = CDM.cnt(i);
      h += '<button type="button" class="map-dot' + (i === CI ? ' on' : '') + (CDM.st.seals[mp.id] ? ' done' : '') + '" data-mi="' + i + '" data-tip="Era ' + (i + 1) + ': ' + esc(mp.nome) + '" aria-label="Era ' + (i + 1) + ': ' + esc(mp.nome) + '">' +
        '<span>' + (i + 1) + '<span class="dot-lbl">. ' + esc(mp.nome.split(" ")[0]) + '</span></span>' +
        (mc[0] === mc[1] ? ' ' + ic("star", "sm") : '') +
      '</button>';
    });

    h += '</div>' +
      globalNavBar("mMaps") +
      '</div>';

    $("maps").innerHTML = h;
    $("xM").onclick = function() { global.CDMAudio.sfx("close"); closeModals(); };
    $("mBackBtn").onclick = function() { goBackFromModal(); };
    bindGlobalNav($("maps"));

    var stageEl = $("mStage");
    var sw = (stageEl && stageEl.clientWidth > 40) ? (stageEl.clientWidth - 8) : Math.min(innerWidth * 0.45, 520);
    var sh = (stageEl && stageEl.clientHeight > 40) ? (stageEl.clientHeight - 8) : Math.min(innerHeight * 0.45, 360);
    var bestScale = Math.max(4, Math.floor(Math.min(sw / m.w, sh / m.h)));
    thumb($("mTh"), m, bestScale);

    $("mP").onclick = function() { moveMapSelection(-1); };
    $("mN").onclick = function() { moveMapSelection(1); };
    $("mPlayBtn").onclick = function(e) { e.stopPropagation(); activateSelectedMap(); };
    $("mStage").onclick = function() { activateSelectedMap(); };
    if ($("mEnterBtn")) $("mEnterBtn").onclick = function() { activateSelectedMap(); };
    if ($("mBossTrigger")) {
      $("mBossTrigger").onclick = function() {
        closeModals();
        bossOpen();
      };
    }

    $("maps").querySelectorAll("[data-mi]").forEach(function(b) {
      b.onclick = function() {
        CI = +b.getAttribute("data-mi");
        global.CDMAudio.sfx("tap");
        drawMaps();
      };
    });

    /* Suporte a gesto de deslizar (swipe) em dispositivos móveis */
    var x0 = null, y0 = null, cd = $("mCard");
    cd.addEventListener("pointerdown", function(e) {
      x0 = e.clientX;
      y0 = e.clientY;
    });
    cd.addEventListener("pointerup", function(e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null; y0 = null;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) moveMapSelection(1);
        else moveMapSelection(-1);
      }
    });
    cd.addEventListener("pointercancel", function() { x0 = null; y0 = null; });
  }

  /* Retorna os elementos interativos visíveis dentro de um container */
  function getFocusableElements(container) {
    if (!container) return [];
    var nodes = container.querySelectorAll('button:not(:disabled), input[type="range"]:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
    var list = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0) {
        list.push(el);
      }
    }
    return list;
  }

  function focusFirstInModal(modalId) {
    setTimeout(function() {
      var modal = $(modalId);
      if (!modal || !modal.classList.contains("on")) return;
      var pref = null;
      if (modalId === "mMaps") pref = $("mPlayBtn");
      else if (modalId === "mIntro") pref = $("xI");
      else if (modalId === "mConfirmHome") pref = $("bCancelHome");
      else if (modalId === "mConfirmNew") pref = $("bCancelNew");
      else if (modalId === "mBoss") pref = modal.querySelector(".mc.pri, .opt:not(:disabled), .pad:not(:disabled)");
      else if (modalId === "mBook") pref = modal.querySelector(".opt:not(:disabled), .book-idx-btn, #bNextPg:not(:disabled), #bPrevPg:not(:disabled)");
      else if (modalId === "mMenu") pref = $("rS");
      if (pref && !pref.disabled) {
        pref.focus();
        return;
      }
      var list = getFocusableElements(modal);
      if (list.length) list[0].focus();
    }, 20);
  }

  function getActiveModal() {
    var ids = ["mConfirmNew", "mConfirmHome", "mBoss", "mIntro", "mCred", "mBook", "mMaps", "mMenu", "mGps"];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el && el.classList.contains("on")) return el;
    }
    return null;
  }

  /* Navegação Completa da Interface pelas Setas Direcionais (Arrow Keys) + Enter */
  function handleModalKey(k) {
    var isArrow = (k === "arrowup" || k === "arrowdown" || k === "arrowleft" || k === "arrowright");
    if (!isArrow && k !== "enter") return false;

    var CDM = global.CDM;
    var activeModal = getActiveModal();

    /* 1. Se houver uma tela/modal aberto */
    if (activeModal) {
      var cur = document.activeElement;

      /* Se o foco estiver num slider (input range) e o jogador pressionar Esquerda/Direita, ajusta o valor */
      if (cur && cur.tagName === "INPUT" && cur.type === "range" && (k === "arrowleft" || k === "arrowright")) {
        var step = 5;
        var min = +cur.min || 0, max = +cur.max || 100, val = +cur.value;
        var nextVal = k === "arrowright" ? Math.min(max, val + step) : Math.max(min, val - step);
        cur.value = nextVal;
        if (typeof cur.oninput === "function") cur.oninput();
        global.CDMAudio.sfx("tap");
        return true;
      }

      /* Comportamento dedicado na Tela de Mapas (#mMaps): Esquerda/Direita troca o mapa (a menos que esteja navegando na barra inferior) */
      if (activeModal.id === "mMaps" && (k === "arrowleft" || k === "arrowright")) {
        var inNavOrDots = cur && (cur.closest(".modal-nav-bar") || cur.closest(".modal-hdr"));
        if (!inNavOrDots) {
          moveMapSelection(k === "arrowright" ? 1 : -1);
          if ($("mPlayBtn")) $("mPlayBtn").focus();
          return true;
        }
      }

      /* Comportamento dedicado no Livro de Memórias (#mBook): Esquerda/Direita vira a página (a menos que esteja nos botões do topo) */
      if (activeModal.id === "mBook" && (k === "arrowleft" || k === "arrowright")) {
        var inTopBar = cur && cur.closest(".book-top-bar");
        if (!inTopBar) {
          turnBookPage(BP + (k === "arrowright" ? 1 : -1));
          return true;
        }
      }

      var list = getFocusableElements(activeModal);
      if (!list.length) return false;

      if (k === "enter") {
        if (cur && activeModal.contains(cur) && typeof cur.click === "function") {
          cur.click();
          return true;
        }
        if (activeModal.id === "mMaps") {
          activateSelectedMap();
          return true;
        }
        list[0].click();
        return true;
      }

      var idx = list.indexOf(cur);
      var delta = (k === "arrowdown" || k === "arrowright") ? 1 : -1;
      var nextIdx = idx < 0 ? 0 : (idx + delta + list.length) % list.length;
      list[nextIdx].focus();
      if (list[nextIdx].scrollIntoView) {
        list[nextIdx].scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      global.CDMAudio.sfx("tap");
      return true;
    }

    /* 2. Se estiver no Menu Inicial (#title) */
    if (CDM.isTitle()) {
      var tBtns = getFocusableElements($("tMenu"));
      if (!tBtns.length) return false;
      var curT = document.activeElement;
      if (k === "enter") {
        if (curT && $("tMenu").contains(curT)) curT.click();
        else tBtns[0].click();
        return true;
      }
      var tIdx = tBtns.indexOf(curT);
      var tDelta = (k === "arrowdown" || k === "arrowright") ? 1 : -1;
      var nextT = tIdx < 0 ? 0 : (tIdx + tDelta + tBtns.length) % tBtns.length;
      tBtns[nextT].focus();
      global.CDMAudio.sfx("tap");
      return true;
    }

    /* 3. Se estiver em Gameplay no Mapa: Setas navegam pelos botões da HUD superior (#top) */
    if (CDM.st.mode === "play") {
      var hudBtns = getFocusableElements($("top"));
      if (!hudBtns.length) return false;
      var curH = document.activeElement;
      var hIdx = hudBtns.indexOf(curH);
      if (k === "enter") {
        if (hIdx >= 0) {
          hudBtns[hIdx].click();
          return true;
        }
        return false;
      }
      var hDelta = (k === "arrowdown" || k === "arrowright") ? 1 : -1;
      var nextH = hIdx < 0 ? 0 : (hIdx + hDelta + hudBtns.length) % hudBtns.length;
      hudBtns[nextH].focus();
      global.CDMAudio.sfx("tap");
      return true;
    }

    return false;
  }

  function ipUpd() {
    var CDM = global.CDM;
    if (!CDM.MAPS.length) return;
    var m = CDM.cur();
    var n = (CDM.st.mode === "play" && !CDM.isTitle()) ? global.CDMWorld.nearest(m, CDM.st.x, CDM.st.y) : null;
    var t = "";
    if (n) {
      var ck = CDM.cnt(CDM.st.mi);
      if (n.t === "p") {
        t = (!CDM.st.seals[m.id] && ck[0] === ck[1]) ? "Desafio: " + CDM.BOSS_DATA[m.id].nome : "Portal de memória";
      } else {
        t = (n.t === "n" ? "Falar com " : "Ler ") + n.n;
      }
    }
    if (t !== IP) {
      IP = t;
      if (t) $("ipt").textContent = (document.body.classList.contains("touch") ? "Botão A" : "Espaço") + " · " + t;
      $("ipt").className = t ? "on" : "";
    }
  }

  function initUI() {
    $("mini").width = 125;
    $("mini").tabIndex = 0;
    $("mini").height = 125;
    $("mini").style.display = MGon ? "block" : "none";
    $("mini").addEventListener("click", function() { toggle("mGps"); });
    $("bHome").addEventListener("click", function() { requestReturnHome(false); });
    $("bBook").addEventListener("click", function() { toggle("mBook"); });
    $("bMaps").addEventListener("click", function() { toggle("mMaps"); });
    $("bMenu").addEventListener("click", function() { toggle("mMenu"); });
    if ($("bFs")) $("bFs").addEventListener("click", function() { if (global.CDM.toggleFs) global.CDM.toggleFs(); });
    $("bCancelHome").addEventListener("click", function() {
      if (prevModalId && prevModalId !== "mConfirmHome") {
        var ret = prevModalId;
        prevModalId = "";
        toggle(ret, true);
      } else {
        global.CDMAudio.sfx("close");
        closeModals();
      }
    });
    $("bConfirmHome").addEventListener("click", function() {
      requestReturnHome(true);
    });
    $("bCancelNew").addEventListener("click", function() {
      global.CDMAudio.sfx("close");
      closeModals();
    });
    $("bConfirmNew").addEventListener("click", function() {
      closeModals();
      global.CDM.resetAllProgress();
    });
    addEventListener("resize", function() {
      if ($("mMaps").classList.contains("on")) drawMaps();
      else if ($("mGps").classList.contains("on")) gpsDraw();
    });
  }

  global.CDMUI = {
    openNewGameModal: openNewGameModal,
    focusFirstInModal: focusFirstInModal,
    resetBookAndMapState: resetBookAndMapState,
    initUI: initUI,
    toast: toast,
    hud: hud,
    closeModals: closeModals,
    toggle: toggle,
    showDlg: showDlg,
    advDlg: advDlg,
    bossOpen: bossOpen,
    gpsTog: gpsTog,
    drawMini: drawMini,
    ipUpd: ipUpd,
    handleModalKey: handleModalKey,
    requestReturnHome: requestReturnHome
  };
})(window);
