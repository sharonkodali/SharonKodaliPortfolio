/* garden.js: shared flower engine for the inner pages.
   Every flower is drawn with canvas paths on a hidden canvas, then redrawn as a grid of characters
   (like the home pond) or as cross-stitch Xs. A toggle in the nav switches styles and remembers the choice.
   - Elements with [data-flower] become flower scenes that bloom when scrolled into view.
   - The hero flower ([data-hero]) tilts toward the cursor and re-blooms with a petal burst on click.
   - One fixed canvas (#petals) drops petal characters that scatter when the cursor moves through them.
*/
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uid = 0;

  // petal outlines, drawn pointing up from the flower center (0,0)
  var PATH = {
    lily:   'M0 0 C-15 -18 -19 -58 0 -90 C19 -58 15 -18 0 0Z',
    std:    'M0 0 C-20 -14 -27 -52 -11 -76 C-5 -84 5 -84 11 -76 C27 -52 20 -14 0 0Z',
    fall:   'M0 0 C-27 -10 -38 -58 -17 -86 C-7 -98 7 -98 17 -86 C38 -58 27 -10 0 0Z',
    cosmos: 'M0 0 C-17 -18 -24 -58 -15 -80 L-8 -72 L0 -83 L8 -72 L15 -80 C24 -58 17 -18 0 0Z',
    poppy:  'M0 0 C-60 -6 -64 -82 -10 -86 C-3 -88 3 -88 10 -86 C64 -82 60 -6 0 0Z',
    daisy:  'M0 0 C-7 -22 -8 -64 0 -74 C8 -64 7 -22 0 0Z',
    sepal:  'M0 0 C-17 -14 -21 -60 0 -80 C21 -60 17 -14 0 0Z',
    lat:    'M0 0 C-46 -14 -54 -72 0 -78 C54 -72 46 -14 0 0Z',
    lip:    'M0 0 C-22 8 -30 40 -10 56 C-4 60 4 60 10 56 C30 40 22 8 0 0Z',
    tulip:  'M0 0 C-32 -8 -38 -72 -7 -100 C-2 -103 2 -103 7 -100 C38 -72 32 -8 0 0Z'
  };
  // each flower: a list of petals [path, angle, scale, colorBase, colorTip, layer] + a center
  function ring(n, path, off, s, c0, c1, extra){ var a = []; for(var i = 0; i < n; i++) a.push({ p: path, a: off + i*360/n, s: s, c: [c0, c1], x: extra }); return a; }
  var SPEC = {
    lily:   { petals: ring(6, 'lily', 30, .9, '#f6d2e4', '#b82c66').concat(ring(6, 'lily', 0, 1, '#fde8f1', '#d4478a')),
              center: { r: 9, c: ['#f6c95a', '#e58a2e'], stamens: 6, len: 48 } },
    iris:   { petals: ring(3, 'fall', 60, 1.05, '#f3e2a2', '#5b2a95', 'beard').concat(ring(3, 'std', 0, .9, '#efe0fb', '#8a4fb8')),
              center: { r: 6, c: ['#f6c95a', '#c2b13a'] } },
    cosmos: { petals: ring(8, 'cosmos', 0, 1, '#fde6f2', '#d4478a'),
              center: { r: 16, c: ['#f6c95a', '#e58a2e'], dots: 26 } },
    poppy:  { petals: ring(4, 'poppy', 45, .96, '#3a0a16', '#e58a2e').concat(ring(4, 'poppy', 0, .78, '#4a0d18', '#f2a54c')),
              center: { r: 14, c: ['#3a2a10', '#160b0f'], dots: 18, dotc: '#c2b13a' } },
    daisy:  { petals: ring(20, 'daisy', 9, .88, '#cdb3e0', '#9a6aa6').concat(ring(20, 'daisy', 0, 1, '#faf3fc', '#e6d2f0')),
              center: { r: 16, c: ['#ecd650', '#c2b13a'], dots: 34 } },
    orchid: { petals: [
                { p: 'sepal', a: 0, s: 1, c: ['#f8e6f6', '#a77bb0'] }, { p: 'sepal', a: 128, s: .95, c: ['#f8e6f6', '#a77bb0'] }, { p: 'sepal', a: -128, s: .95, c: ['#f8e6f6', '#a77bb0'] },
                { p: 'lat', a: 64, s: .95, c: ['#fbeefa', '#c48ad0'] }, { p: 'lat', a: -64, s: .95, c: ['#fbeefa', '#c48ad0'] },
                { p: 'lip', a: 0, s: 1, c: ['#f6c95a', '#c42b6b'], x: 'lip' } ],
              center: { r: 6, c: ['#fff4d0', '#e58a2e'] } },
    tulip:  { petals: [
                { p: 'tulip', a: -24, s: .95, c: ['#5a1225', '#a62a6a'] }, { p: 'tulip', a: 24, s: .95, c: ['#5a1225', '#a62a6a'] },
                { p: 'tulip', a: 0, s: 1, c: ['#7a1a3a', '#c94a8a'] },
                { p: 'tulip', a: -11, s: .9, c: ['#8a2048', '#e07aa8'] }, { p: 'tulip', a: 11, s: .9, c: ['#8a2048', '#e07aa8'] } ],
              center: null, cup: true }
  };

  // ---------- style: 'ascii' (characters, like the home pond) or 'stitch' (cross-stitch Xs) ----------
  var MODE = 'ascii';
  try { MODE = localStorage.getItem('gardenMode') || 'ascii'; } catch(e) {}
  var RAMP = '.,:-=+*o#%@', FLICK = '*+o%';

  function clamp(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x){ x = clamp(x); return 1 - Math.pow(1 - x, 3); }
  function easeBack(x){ x = clamp(x); var c = 1.5; return 1 + (c + 1)*Math.pow(x - 1, 3) + c*Math.pow(x - 1, 2); }
  function mix(a, b, t){
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255)*(1 - t) + ((pb >> 16) & 255)*t), g = Math.round(((pa >> 8) & 255)*(1 - t) + ((pb >> 8) & 255)*t), bl = Math.round((pa & 255)*(1 - t) + (pb & 255)*t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  function rand(a, b){ return a + Math.random()*(b - a); }

  var P2D = {};
  function path(k){ return P2D[k] || (P2D[k] = new Path2D(PATH[k])); }
  var STEM = new Path2D('M0 12 C10 90 -14 180 4 340'), STEMLEN = 345;
  var LEAF1 = new Path2D('M2 230 C-40 200 -92 196 -112 150 C-70 150 -24 170 2 230Z');
  var LEAF2 = new Path2D('M0 290 C40 250 96 250 116 196 C70 200 22 230 0 290Z');

  // ---------- one flower, drawn with canvas paths in model units (head at 0,0; stem down to y=340) ----------
  function Flower(o){
    this.type = o.type; this.sp = SPEC[o.type] || SPEC.lily; this.stem = !!o.stem;
    this.x = 0; this.y = 0; this.k = 1; this.xFrac = o.xFrac; this.h = o.h;
    this.open = 0; this.openT = 0; this.grow = this.stem ? 0 : 1; this.growT = this.grow;
    this.spread = 0; this.spreadT = 0; this.turn = 0; this.turnT = 0; this.ph = rand(0, 6.28); this.half = !!o.half;
    if(reduce){ this.grow = this.growT = 1; }
  }
  Flower.prototype.step = function(dt){
    var openRate = this.openT > this.open ? .62 : 2.2;
    this.open += Math.max(-openRate*dt, Math.min(openRate*dt, this.openT - this.open));
    this.grow += Math.max(-dt, Math.min(.75*dt, this.growT - this.grow));
    this.spread += (this.spreadT - this.spread)*Math.min(1, dt*7);
    this.turn += (this.turnT - this.turn)*Math.min(1, dt*4);
    if(reduce){ this.open = this.openT; this.grow = this.growT; }
  };
  Flower.prototype.draw = function(c, t){
    var sp = this.sp;
    c.save(); c.translate(this.x, this.y); c.scale(this.k, this.k);
    if(this.stem){
      if(!reduce){ c.translate(0, 340); c.rotate(Math.sin(t*.9 + this.ph)*.03); c.translate(0, -340); }
      c.lineCap = 'round'; c.lineWidth = 7; c.strokeStyle = '#7d9a3e';
      c.setLineDash([STEMLEN, STEMLEN]); c.lineDashOffset = -STEMLEN*(1 - this.grow);
      c.stroke(STEM); c.setLineDash([]);
      var lg = ease((this.grow - .45)/.4);
      if(lg > 0){
        var g = c.createLinearGradient(-110, 150, 110, 300); g.addColorStop(0, '#a8b445'); g.addColorStop(1, '#46642f');
        c.fillStyle = g;
        c.save(); c.translate(2, 230); c.scale(lg, lg); c.translate(-2, -230); c.fill(LEAF1); c.restore();
        var lg2 = ease((this.grow - .55)/.4);
        c.save(); c.translate(0, 290); c.scale(lg2, lg2); c.translate(0, -290); c.fill(LEAF2); c.restore();
      }
    }
    if(!this.stem || this.grow > .82){
      c.save();
      if(sp.cup) c.translate(0, 40);
      c.rotate(this.turn);
      var br = reduce ? 1 : 1 + .025*Math.sin(t*.8 + this.ph); c.scale(br, br);
      var n = sp.petals.length, op = this.open, spr = this.spread;
      for(var i = 0; i < n; i++){
        var pt = sp.petals[i];
        var pi = easeBack(op*1.35 - i/n*.35);
        var ang = pt.a*(.1 + .9*pi)*(1 + .07*spr)*Math.PI/180;
        var sc = pt.s*(.16 + .84*pi)*(1 + .07*spr);
        c.save(); c.rotate(ang); c.scale(sc, sc);
        if(pt.x === 'lip') c.rotate(Math.PI);
        var pg = c.createLinearGradient(0, 0, 0, -90);
        pg.addColorStop(0, pt.c[0]); pg.addColorStop(.55, mix(pt.c[0], pt.c[1], .7)); pg.addColorStop(1, pt.c[1]);
        var P = path(pt.p);
        c.fillStyle = pg; c.fill(P);
        c.save(); c.scale(.42, .82); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill(P); c.restore();
        c.strokeStyle = 'rgba(50,8,40,.42)'; c.lineWidth = 2.2;
        var vs = pt.p === 'daisy' ? [0] : [-7, 7];
        for(var v = 0; v < vs.length; v++){ c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(vs[v]*1.6, -40, vs[v]*2.2, pt.x === 'lip' ? 0 : -62); c.stroke(); }
        if(pt.x === 'beard'){ c.strokeStyle = '#f6c95a'; c.lineWidth = 9; c.beginPath(); c.moveTo(0, -10); c.lineTo(0, -46); c.stroke(); }
        if(pt.x === 'lip'){ c.fillStyle = '#f6c95a'; c.beginPath(); c.arc(0, -30, 7, 0, 6.28); c.fill(); }
        c.restore();
      }
      var ce = sp.center;
      if(ce){
        var cp = ease((op - .3)/.45);
        if(cp > 0){
          c.save(); c.scale(cp, cp);
          var rg = c.createRadialGradient(0, 0, 0, 0, 0, ce.r); rg.addColorStop(0, ce.c[0]); rg.addColorStop(1, ce.c[1]);
          c.fillStyle = rg; c.beginPath(); c.arc(0, 0, ce.r, 0, 6.28); c.fill();
          if(ce.dots){
            c.fillStyle = ce.dotc || 'rgba(90,30,10,.6)';
            for(var d = 0; d < ce.dots; d++){ var a = d*2.399 + t*.05, rr = Math.sqrt((d + .5)/ce.dots)*ce.r*.85; c.beginPath(); c.arc(Math.cos(a)*rr, Math.sin(a)*rr, 1.8, 0, 6.28); c.fill(); }
          }
          c.restore();
        }
        if(ce.stamens){
          var sg = ease((op - .5)/.4);
          for(var s = 0; s < ce.stamens && sg > 0; s++){
            c.save(); c.rotate((s*360/ce.stamens + 15)*Math.PI/180); c.scale(sg, sg);
            c.strokeStyle = '#f3d9a0'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(4, -ce.len*.5, 0, -ce.len); c.stroke();
            c.fillStyle = '#c0581e'; c.beginPath(); c.ellipse(0, -ce.len, 4, 7, 0, 0, 6.28); c.fill();
            c.restore();
          }
        }
      }
      c.restore();
    }
    c.restore();
  };

  // ---------- turning a full-resolution drawing into characters or stitches ----------
  var small = document.createElement('canvas'), sctx = small.getContext('2d', { willReadFrequently: true });
  function cellSize(H, override){
    if(override) return override;
    if(MODE === 'stitch') return H > 320 ? 8 : H > 140 ? 6 : 4;
    return H > 320 ? 10 : H > 140 ? 7 : 5;
  }
  // src: a canvas drawn at scale ss (src px = css px * ss); dst: the visible 2D context (already dpr-scaled)
  function cells(src, ss, dst, W, H, opts){
    opts = opts || {};
    var ch = cellSize(H, opts.cell), cw = MODE === 'stitch' ? ch : ch*.6;
    var cols = Math.ceil(W/cw), rows = Math.ceil(H/ch);
    if(small.width !== cols || small.height !== rows){ small.width = cols; small.height = rows; }
    sctx.clearRect(0, 0, cols, rows);
    sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, 0, 0, W*ss, H*ss, 0, 0, cols, rows);
    var data = sctx.getImageData(0, 0, cols, rows).data;
    dst.clearRect(0, 0, W, H);
    var thr = opts.threshold || 18;
    if(MODE === 'stitch'){
      if(opts.fabric){
        dst.fillStyle = 'rgba(238,223,243,.07)';
        for(var fr = 0; fr <= rows; fr += 1) for(var fc = 0; fc <= cols; fc += 1) dst.fillRect(fc*cw - .6, fr*ch - .6, 1.2, 1.2);
      }
      dst.lineCap = 'round'; dst.lineWidth = Math.max(1, cw*.3);
      var pad = cw*.2;
      for(var r = 0; r < rows; r++) for(var c = 0; c < cols; c++){
        var i = (r*cols + c)*4, a = data[i + 3];
        if(a < thr) continue;
        var R = data[i], G = data[i + 1], B = data[i + 2], al = Math.min(1, a/200);
        var x0 = c*cw + pad, y0 = r*ch + pad, x1 = (c + 1)*cw - pad, y1 = (r + 1)*ch - pad;
        dst.strokeStyle = 'rgba(' + (R*.68|0) + ',' + (G*.68|0) + ',' + (B*.68|0) + ',' + al + ')';
        dst.beginPath(); dst.moveTo(x0, y0); dst.lineTo(x1, y1); dst.stroke();
        dst.strokeStyle = 'rgba(' + R + ',' + G + ',' + B + ',' + al + ')';
        dst.beginPath(); dst.moveTo(x1, y0); dst.lineTo(x0, y1); dst.stroke();
      }
    } else {
      dst.font = ch + 'px "Geist Mono", ui-monospace, monospace'; dst.textBaseline = 'top';
      var last = '';
      for(var r2 = 0; r2 < rows; r2++) for(var c2 = 0; c2 < cols; c2++){
        var j = (r2*cols + c2)*4, a2 = data[j + 3];
        if(a2 < thr) continue;
        var R2 = data[j], G2 = data[j + 1], B2 = data[j + 2];
        var lum = (.299*R2 + .587*G2 + .114*B2)/255, cov = a2/255;
        var k = Math.min(RAMP.length - 1, Math.max(0, Math.round((lum*.75 + cov*.35)*(RAMP.length - 1))));
        var chr = (!reduce && Math.random() < .008) ? FLICK.charAt((Math.random()*FLICK.length)|0) : RAMP.charAt(k);
        var f = .55 + .45*lum;
        var col = 'rgba(' + Math.min(255, R2/f*.95|0) + ',' + Math.min(255, G2/f*.95|0) + ',' + Math.min(255, B2/f*.95|0) + ',' + Math.min(1, cov*1.3).toFixed(2) + ')';
        if(col !== last){ dst.fillStyle = col; last = col; }
        dst.fillText(chr, c2*cw, r2*ch);
      }
    }
  }

  // ---------- a scene: one canvas holding one or more flowers ----------
  var scenes = [];
  var SS = .6; // the hidden drawing is made at 60% size; it gets averaged down to cells anyway
  function Scene(el, opts){
    var self = this;
    this.el = el; this.opts = opts || {}; this.flowers = []; this.visible = false;
    this.cv = document.createElement('canvas'); this.cv.setAttribute('aria-hidden', 'true');
    this.cv.style.cssText = 'width:100%;height:100%;display:block';
    el.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.src = document.createElement('canvas'); this.sx = this.src.getContext('2d');
    this.resize();
    scenes.push(this);
    if('IntersectionObserver' in window) new IntersectionObserver(function(es){ self.visible = es[0].isIntersecting; if(self.visible && self.onShow) { var f = self.onShow; self.onShow = null; f(); } }, { rootMargin: '80px' }).observe(el);
    else this.visible = true;
    // hover and click on the canvas itself
    this.cv.addEventListener('pointermove', function(e){ self.hover(e); });
    this.cv.addEventListener('pointerleave', function(){ self.flowers.forEach(function(f){ f.spreadT = 0; if(f.half) f.openT = .55; }); });
    this.cv.addEventListener('click', function(e){ self.click(e); });
  }
  Scene.prototype.resize = function(){
    var r = this.el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.cv.width = this.W*dpr; this.cv.height = this.H*dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.src.width = Math.ceil(this.W*SS); this.src.height = Math.ceil(this.H*SS);
    this.layout();
  };
  Scene.prototype.layout = function(){
    var W = this.W, H = this.H, self = this;
    this.flowers.forEach(function(f){
      if(f.xFrac !== undefined){ f.k = f.h/470; f.x = f.xFrac*W; f.y = H - 345*f.k + 6; }
      else if(f.stem){ f.k = Math.min(H/470, W/260); f.x = W/2; f.y = H - 345*f.k; }
      else { f.k = Math.min(W, H)/(self.opts.tight ? 200 : 235); f.x = W/2; f.y = H/2 - (f.sp.cup ? 40*f.k : 0); }
    });
  };
  Scene.prototype.add = function(o){ var f = new Flower(o); this.flowers.push(f); this.layout(); return f; };
  Scene.prototype.bloom = function(f, delay){
    var self = this;
    (f ? [f] : this.flowers).forEach(function(fl){
      setTimeout(function(){
        fl.growT = 1;
        setTimeout(function(){ fl.openT = fl.half ? .55 : 1; }, fl.stem && !reduce ? 1000 : 0);
      }, delay || 0);
    });
  };
  Scene.prototype.near = function(e){
    var r = this.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 1e9;
    this.flowers.forEach(function(f){ var d = Math.hypot(x - f.x, y - (f.y + (f.sp.cup ? 40*f.k : 0))); if(d < bd){ bd = d; best = f; } });
    return best && bd < 115*best.k ? best : null;
  };
  Scene.prototype.hover = function(e){
    if(this.opts.rootHover) return;
    var n = this.near(e);
    this.flowers.forEach(function(f){ f.spreadT = f === n ? 1 : 0; if(f.half) f.openT = f === n ? 1 : .55; });
  };
  Scene.prototype.click = function(e){
    var f = this.near(e);
    if(!f || this.opts.noClick) return;
    f.openT = 0; setTimeout(function(){ f.openT = 1; }, 560);
    Garden.burst(e.clientX, e.clientY, 14);
  };
  Scene.prototype.render = function(t){
    if(!this.visible) return;
    var sx = this.sx;
    sx.setTransform(SS, 0, 0, SS, 0, 0); sx.clearRect(0, 0, this.W, this.H);
    for(var i = 0; i < this.flowers.length; i++) this.flowers[i].draw(sx, t);
    cells(this.src, SS, this.ctx, this.W, this.H, { cell: this.opts.cell, fabric: this.opts.fabric });
  };

  // one shared animation loop for every scene
  var T = 0, prev = performance.now();
  function loop(now){
    var dt = Math.min(.1, (now - prev)/1000); prev = now; T += dt;
    for(var i = 0; i < scenes.length; i++){ var s = scenes[i]; s.flowers.forEach(function(f){ f.step(dt); }); s.render(T); }
    requestAnimationFrame(loop);
  }
  var rt;
  window.addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ scenes.forEach(function(s){ s.resize(); }); }, 150); });

  // ---------- [data-flower] elements become scenes ----------
  function mount(el){
    var hoverMode = el.dataset.bloom === 'hover';
    var root = el.closest('[data-hover-root]');
    var sc = new Scene(el, { fabric: el.hasAttribute('data-hero'), rootHover: !!root, noClick: hoverMode, cell: +el.dataset.cell || 0, tight: hoverMode });
    var f = sc.add({ type: el.dataset.flower, stem: el.dataset.stem === '1', half: hoverMode });
    if(root){
      root.addEventListener('mouseenter', function(){ f.spreadT = 1; if(f.half) f.openT = 1; });
      root.addEventListener('mouseleave', function(){ f.spreadT = 0; if(f.half) f.openT = .55; });
      root.addEventListener('focusin', function(){ f.spreadT = 1; if(f.half) f.openT = 1; });
      root.addEventListener('focusout', function(){ f.spreadT = 0; if(f.half) f.openT = .55; });
    }
    var delay = +el.dataset.delay || 0;
    if(el.hasAttribute('data-hero')){ sc.bloom(f, 300 + delay); heroTilt(el, sc, f); }
    else sc.onShow = function(){ sc.bloom(f, delay); };
    el.__scene = sc;
    return sc;
  }
  function heroTilt(el, sc, f){
    if(reduce) return;
    var wrap = el.closest('.hero-flower') || el;
    window.addEventListener('pointermove', function(e){
      var r = wrap.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height*.35;
      var dx = (e.clientX - cx)/window.innerWidth, dy = (e.clientY - cy)/window.innerHeight;
      sc.cv.style.transform = 'rotateX(' + (-dy*12).toFixed(2) + 'deg) rotateY(' + (dx*18).toFixed(2) + 'deg)';
      f.turnT = dx*.35;
    }, { passive: true });
    sc.cv.style.transition = 'transform .5s cubic-bezier(.2,.9,.25,1)';
  }

  // ---------- falling petals, drawn as characters or tiny stitches ----------
  var petalsAPI = { burst: function(){} };
  function petals(){
    var cv = document.getElementById('petals');
    if(!cv || reduce) return;
    var ctx = cv.getContext('2d'), W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var COLS = ['#d4478a', '#a77bb0', '#8a4fb8', '#e07aa8', '#c42b6b', '#e58a2e', '#efe0fb'], GL = '*+o%@~';
    var list = [], mouse = { x: -1e4, y: -1e4, vx: 0, vy: 0 };
    function size(){ W = innerWidth; H = innerHeight; cv.width = W*dpr; cv.height = H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    function make(x, y, burst){
      return { x: x, y: y, vx: burst ? (Math.random() - .5)*7 : (Math.random() - .5)*.4, vy: burst ? -Math.random()*6 - 1 : Math.random()*.6 + .35,
        r: Math.random()*6 + 7, rot: Math.random()*6.28, vr: (Math.random() - .5)*.04, ph: Math.random()*6.28,
        col: COLS[(Math.random()*COLS.length)|0], g: GL.charAt((Math.random()*GL.length)|0), burst: !!burst, life: 1 };
    }
    size(); addEventListener('resize', size);
    var base = W < 700 ? 14 : 30;
    for(var i = 0; i < base; i++) list.push(make(Math.random()*W, Math.random()*H));
    addEventListener('pointermove', function(e){ mouse.vx = e.clientX - mouse.x; mouse.vy = e.clientY - mouse.y; mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    petalsAPI.burst = function(x, y, n){ for(var i = 0; i < n; i++) list.push(make(x, y, true)); };
    function tick(){
      ctx.clearRect(0, 0, W, H);
      mouse.vx *= .9; mouse.vy *= .9;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineCap = 'round';
      for(var i = list.length - 1; i >= 0; i--){
        var p = list[i];
        var dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if(d < 130){ var f = (1 - d/130); p.vx += mouse.vx*.04*f + dx/d*.25*f; p.vy += mouse.vy*.04*f + dy/d*.25*f; p.vr += (Math.random() - .5)*.02*f; }
        p.ph += .045; p.rot += p.vr;
        p.vx += Math.sin(p.ph*.5)*.012; p.vx *= .985;
        p.vy += p.burst ? .12 : .004; p.vy = Math.min(p.vy, p.burst ? 4 : 1.3);
        p.x += p.vx; p.y += p.vy;
        if(p.burst){ p.life -= .004; if(p.life <= 0 || p.y > H + 30){ list.splice(i, 1); continue; } }
        else if(p.y > H + 20 || p.x < -40 || p.x > W + 40){ p.x = Math.random()*W; p.y = -20; p.vy = Math.random()*.6 + .35; p.vx = 0; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = .7*p.life;
        if(MODE === 'stitch'){
          var s = p.r*.35; ctx.lineWidth = 2; ctx.strokeStyle = p.col;
          ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.stroke();
        } else {
          ctx.font = (p.r*1.5|0) + 'px "Geist Mono", monospace'; ctx.fillStyle = p.col; ctx.fillText(p.g, 0, 0);
        }
        ctx.restore();
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  // ---------- style toggle in the nav ----------
  function modeToggle(){
    var ul = document.querySelector('.nav ul');
    if(!ul) return;
    var li = document.createElement('li'), b = document.createElement('button');
    b.className = 'l mode'; b.type = 'button';
    function label(){ b.innerHTML = MODE === 'stitch' ? '✕<span class="mt"> stitch</span>' : '⌗<span class="mt"> ascii</span>'; b.title = 'Switch the flowers to ' + (MODE === 'stitch' ? 'ASCII characters' : 'cross-stitch'); b.setAttribute('aria-label', b.title); }
    label();
    b.addEventListener('click', function(){
      MODE = MODE === 'stitch' ? 'ascii' : 'stitch';
      try { localStorage.setItem('gardenMode', MODE); } catch(e) {}
      label(); document.documentElement.dataset.mode = MODE;
    });
    li.appendChild(b); ul.insertBefore(li, ul.lastElementChild);
    document.documentElement.dataset.mode = MODE;
  }

  function splitWords(h){
    var i = 0;
    h.querySelectorAll('[data-split]').forEach(function(el){
      el.innerHTML = el.innerHTML.split(' ').map(function(w){ return '<span class="w" style="animation-delay:' + (200 + (i++)*110) + 'ms">' + w + '</span>'; }).join(' ');
    });
  }
  function cardGlow(){
    document.querySelectorAll('.card').forEach(function(c){
      c.addEventListener('pointermove', function(e){ var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    });
  }
  var revealIO = 'IntersectionObserver' in window ? new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); revealIO.unobserve(e.target); } });
  }, { threshold: .2 }) : null;

  var Garden = window.Garden = {
    scene: function(el, opts){ return new Scene(el, opts); },
    cells: cells,
    mode: function(){ return MODE; },
    burst: function(x, y, n){ petalsAPI.burst(x, y, n || 14); }
  };

  document.addEventListener('DOMContentLoaded', function(){
    modeToggle();
    petals();
    splitWords(document);
    document.querySelectorAll('[data-flower]').forEach(mount);
    document.querySelectorAll('.reveal').forEach(function(el){ if(revealIO && !reduce) revealIO.observe(el); else el.classList.add('in'); });
    cardGlow();
    requestAnimationFrame(loop);
  });
})();
