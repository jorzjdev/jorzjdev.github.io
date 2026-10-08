(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  var CX = 300, CY = 300, R = 238, GAP = 1.4;
  var SLICES = 8;
  var BITES = 3;          // укусов на кусок
  var BITE_MS = 170;      // длительность одного укуса
  var HOLD_MS = 120;      // пауза между укусами, чтобы каждый был виден
  var TOTAL_MS = BITES * BITE_MS + (BITES - 1) * HOLD_MS;
  var LEAVE_MS = 1200;    // шаг обратного отсчёта на салфетке

  var defs = document.getElementById('defs');
  var slicesG = document.getElementById('slices');
  var crumbsG = document.getElementById('crumbs');
  var hits = document.getElementById('hits');
  var pipsEl = document.getElementById('pips');
  var countEl = document.getElementById('count');
  var headEl = document.getElementById('head');
  var subEl = document.getElementById('sub');
  var takeEl = document.getElementById('take');
  var veilEl = document.getElementById('veil');
  var tickEl = document.getElementById('tick');
  var goEl = document.getElementById('go');
  var againEl = document.getElementById('again');

  var CRUMBS = [
    [168, 196, 3.4], [436, 232, 2.6], [392, 428, 3.8], [204, 414, 2.4],
    [300, 142, 3], [142, 318, 2.8], [470, 352, 3.2], [258, 470, 2.5]
  ];

  var slices = [];
  var pips = [];
  var started = [];   // timestamp клика, null — кусок целый
  var raf = null;
  var leaveTimer = null;
  var left = 3;

  // ---------- геометрия ----------
  function pt(r, deg) {
    var a = deg * Math.PI / 180;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  }

  function sector(r, d0, d1) {
    var p0 = pt(r, d0), p1 = pt(r, d1);
    return 'M ' + CX + ' ' + CY +
      ' L ' + p0.x.toFixed(1) + ' ' + p0.y.toFixed(1) +
      ' A ' + r + ' ' + r + ' 0 0 1 ' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1) + ' Z';
  }

  function arc(r, d0, d1) {
    var p0 = pt(r, d0), p1 = pt(r, d1);
    return 'M ' + p0.x.toFixed(1) + ' ' + p0.y.toFixed(1) +
      ' A ' + r + ' ' + r + ' 0 0 1 ' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1);
  }

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) { if (attrs.hasOwnProperty(k)) { n.setAttribute(k, attrs[k]); } }
    return n;
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  // ---------- сборка ----------
  function build() {
    for (var i = 0; i < SLICES; i++) {
      var d0 = i * 45 - 90 + GAP;
      var d1 = (i + 1) * 45 - 90 - GAP;
      var dm = (d0 + d1) / 2;
      var full = sector(R, d0, d1);

      // Откусанное вырезается маской: чёрные круги — то, что уже во рту.
      var maskId = 'm' + i, clipId = 'c' + i;
      var mask = el('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 600, height: 600 });
      mask.appendChild(el('rect', { x: 0, y: 0, width: 600, height: 600, fill: '#FFFFFF' }));

      var clip = el('clipPath', { id: clipId });
      clip.appendChild(el('path', { d: full }));

      var chomps = [];      // круги в маске
      var edges = [];       // обводка откуса
      var geo = [];
      for (var k = 0; k < BITES; k++) {
        var t = BITES === 1 ? 1 : k / (BITES - 1);
        var centre = R * (0.26 + 0.76 * t);
        var size = R * (0.40 + 0.22 * t);
        var c = pt(centre, dm + (k % 2 === 0 ? -3 : 3));
        geo.push({ x: c.x, y: c.y, r: size });

        var cut = el('circle', { cx: c.x.toFixed(1), cy: c.y.toFixed(1), r: 0, fill: '#000000' });
        mask.appendChild(cut);
        chomps.push(cut);

        var edge = el('circle', { cx: c.x.toFixed(1), cy: c.y.toFixed(1), r: 0, class: 'edge' });
        edges.push(edge);
      }

      defs.appendChild(mask);
      defs.appendChild(clip);

      // тесто, корочка и пепперони — внутри маски, их съедает тем же укусом
      var body = el('g', { mask: 'url(#' + maskId + ')' });
      body.appendChild(el('path', { d: full, class: 'dough' }));
      body.appendChild(el('path', { d: arc(R - 5, d0, d1), class: 'crust' }));

      var spec = [[0.34, -9], [0.58, 10], [0.80, -6]];
      for (var j = 0; j < spec.length; j++) {
        var p = pt(R * spec[j][0], dm + spec[j][1]);
        body.appendChild(el('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 16, class: 'pep' }));
        body.appendChild(el('circle', { cx: (p.x - 4.5).toFixed(1), cy: (p.y - 4.5).toFixed(1), r: 4.5, class: 'pep-hi' }));
      }

      // Обводка лежит ровно на краю маски — видна её внутренняя половина,
      // поэтому край получается рваный, как настоящий укус.
      var rim = el('g', { 'clip-path': 'url(#' + clipId + ')', mask: 'url(#' + maskId + ')' });
      edges.forEach(function (e) { rim.appendChild(e); });

      var group = el('g', {});
      group.appendChild(body);
      group.appendChild(rim);
      slicesG.appendChild(group);

      // область нажатия — весь сектор, в процентах от бокса
      var h0 = pt0(40, d0), hm = pt0(40, dm), h1 = pt0(40, d1);
      var poly = 'polygon(50% 50%, ' +
        h0.x.toFixed(1) + '% ' + h0.y.toFixed(1) + '%, ' +
        hm.x.toFixed(1) + '% ' + hm.y.toFixed(1) + '%, ' +
        h1.x.toFixed(1) + '% ' + h1.y.toFixed(1) + '%)';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.style.clipPath = poly;
      btn.style.webkitClipPath = poly;
      btn.setAttribute('aria-label', 'Кусок ' + (i + 1) + ' — съесть');
      btn.addEventListener('click', (function (idx) {
        return function () { eat(idx); };
      })(i));
      hits.appendChild(btn);

      slices.push({ group: group, chomps: chomps, edges: edges, geo: geo, btn: btn });
      started.push(null);

      var pip = document.createElement('li');
      pipsEl.appendChild(pip);
      pips.push(pip);
    }
  }

  // точка в процентах от бокса 600×600
  function pt0(rPercent, deg) {
    var a = deg * Math.PI / 180;
    return { x: 50 + rPercent * Math.cos(a), y: 50 + rPercent * Math.sin(a) };
  }

  // ---------- поедание ----------
  function eat(i) {
    if (started[i] !== null) { return; }
    started[i] = performance.now();
    slices[i].btn.disabled = true;
    slices[i].btn.setAttribute('aria-label', 'Кусок ' + (i + 1) + ' — съеден');
    if (raf === null) { raf = requestAnimationFrame(frame); }
  }

  function frame(now) {
    var busy = false;
    var eaten = 0;

    for (var i = 0; i < SLICES; i++) {
      var s = slices[i];
      if (started[i] === null) { setPip(i, 0); continue; }

      var e = now - started[i];
      if (e < TOTAL_MS) { busy = true; }

      var progress = 0;
      for (var k = 0; k < BITES; k++) {
        var kStart = k * (BITE_MS + HOLD_MS);
        var local = (e - kStart) / BITE_MS;
        if (local < 0) { local = 0; }
        if (local > 1) { local = 1; }
        progress += local;
        var r = s.geo[k].r * smooth(local);
        s.chomps[k].setAttribute('r', r.toFixed(1));
        s.edges[k].setAttribute('r', r > 0.6 ? r.toFixed(1) : 0);
      }

      if (e >= TOTAL_MS) {
        s.group.style.display = 'none';
        eaten++;
        setPip(i, 1);
      } else {
        setPip(i, progress / BITES);
      }
    }

    paintCrumbs(eaten);
    countEl.textContent = 'съедено ' + eaten + ' / 8';
    pipsEl.setAttribute('aria-label', 'съедено ' + eaten + ' / 8');
    headEl.textContent = eaten === 0 ? 'Опять пицца' : (eaten === SLICES ? 'Тарелка пустая' : 'Ещё немного');

    if (eaten === SLICES) {
      subEl.textContent = 'Осталось вытереть руки. Салфетка рядом.';
      takeEl.hidden = false;
    }

    if (busy) { raf = requestAnimationFrame(frame); }
    else { raf = null; }
  }

  function setPip(i, v) {
    var cls = v >= 1 ? 'full' : (v > 0 ? 'part' : '');
    if (pips[i].className !== cls) { pips[i].className = cls; }
  }

  function paintCrumbs(n) {
    while (crumbsG.childNodes.length > n) { crumbsG.removeChild(crumbsG.lastChild); }
    while (crumbsG.childNodes.length < n) {
      var c = CRUMBS[crumbsG.childNodes.length];
      crumbsG.appendChild(el('circle', { cx: c[0], cy: c[1], r: c[2], class: 'crumb' }));
    }
  }

  // ---------- салфетка ----------
  takeEl.addEventListener('click', function () {
    veilEl.hidden = false;
    left = 3;
    tickEl.textContent = 'переход на сайт через ' + left;
    goEl.focus();
    if (leaveTimer) { clearInterval(leaveTimer); }
    leaveTimer = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(leaveTimer);
        leaveTimer = null;
        tickEl.textContent = 'переходим…';
        window.location.href = '../';
        return;
      }
      tickEl.textContent = 'переход на сайт через ' + left;
    }, LEAVE_MS);
  });

  againEl.addEventListener('click', function () {
    if (leaveTimer) { clearInterval(leaveTimer); leaveTimer = null; }
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    veilEl.hidden = true;
    takeEl.hidden = true;
    subEl.textContent = 'Тебе нужно съесть эту пиццу. Один клик — и кусок уходит за три укуса. Съешь все восемь, и я дам тебе салфетку.';
    headEl.textContent = 'Опять пицца';
    countEl.textContent = 'съедено 0 / 8';
    paintCrumbs(0);

    for (var i = 0; i < SLICES; i++) {
      started[i] = null;
      var s = slices[i];
      s.group.style.display = '';
      s.btn.disabled = false;
      s.btn.setAttribute('aria-label', 'Кусок ' + (i + 1) + ' — съесть');
      for (var k = 0; k < BITES; k++) {
        s.chomps[k].setAttribute('r', 0);
        s.edges[k].setAttribute('r', 0);
      }
      setPip(i, 0);
    }
    takeEl.blur();
  });

  build();
})();
