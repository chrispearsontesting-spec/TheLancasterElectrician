/* Trac3 launch splash: James May option 06 sequential outline → fill (5.50s).
   Traced wordmark (not a font) + EVERYTHING AUTO in Geist Mono, #7dd3fc, no full stop.
   Shown only on a cold launch from the home-screen / app icon:
     - installed PWA: manifest start_url carries ?launch=1, or display-mode standalone with no in-app referrer;
     - Capacitor Android app: first page of the app process.
   Never on reloads, back/forward, in-app navigation (sessionStorage "t3.splash"), deep links (#...) or public pages
   (only home.html includes this file). Tap skips; reduced motion shows a short static lock-up; a safety timer always
   removes it. The app loads underneath at the same time.
   Timeline (s): 0.12-1.00 logo outline draws | 0.96-1.24 logo fills | 1.42-2.32 tagline outline draws (#7dd3fc) |
   2.24-2.58 tagline fills | hold to 5.10 | 5.10-5.35 lock-up fades to #0b0c0e | 5.35-5.50 overlay clears to the app.
   Logo paths are the approved traced master (logo/trac3-wordmark.svg). Logo is 880px / 81.5% of the 1080 canvas. */
(function(){
  "use strict";
  var W = window, D = document, BG = "#0b0c0e", TAGC = "#7dd3fc", KEY = "t3.splash";
  var TEXT = "EVERYTHING AUTO";
  var NS = "http://www.w3.org/2000/svg";

  function hideNative(){
    if(W.__t3NativeHidden) return; W.__t3NativeHidden = true;
    try{ var P = W.Capacitor && W.Capacitor.Plugins && W.Capacitor.Plugins.SplashScreen;
      if(P && P.hide) P.hide({fadeOutDuration:200}).catch(function(){}); }catch(e){}
  }
  W.Trac3HideNativeSplash = hideNative;

  function isNative(){ try{ return !!(W.Capacitor && W.Capacitor.isNativePlatform && W.Capacitor.isNativePlatform()); }catch(e){ return false; } }
  function standalone(){
    try{ return W.navigator.standalone === true || ["standalone","fullscreen","minimal-ui","window-controls-overlay"].some(function(m){ return W.matchMedia("(display-mode: " + m + ")").matches; }); }catch(e){ return false; }
  }
  function navType(){
    try{ var n = performance.getEntriesByType("navigation")[0]; if(n && n.type) return n.type; }catch(e){}
    try{ return ["navigate","reload","back_forward"][performance.navigation.type] || "navigate"; }catch(e){ return "navigate"; }
  }
  function decide(){
    var q, flag = false;
    try{ q = new URLSearchParams(location.search); flag = q.get("launch") === "1"; }catch(e){}
    if(flag){
      try{ q.delete("launch"); var s = q.toString();
        history.replaceState(history.state, "", location.pathname + (s ? "?" + s : "") + location.hash);
      }catch(e){}
    }
    var seen = false;
    try{ seen = sessionStorage.getItem(KEY) === "1"; sessionStorage.setItem(KEY, "1"); }catch(e){ seen = true; }
    if(seen || location.hash) return false;
    var t = navType(); if(t === "reload" || t === "back_forward") return false;
    if(isNative() || flag) return true;
    var ref = ""; try{ ref = D.referrer ? new URL(D.referrer).origin : ""; }catch(e){}
    return standalone() && ref !== location.origin;
  }

  var show = false;
  try{ show = decide(); }catch(e){ show = false; }
  if(!show){
    if(isNative()){ if(D.readyState === "loading") D.addEventListener("DOMContentLoaded", hideNative); else hideNative(); }
    return;
  }

  if(!D.getElementById("t3-splash-font")){
    var face = D.createElement("style");
    face.id = "t3-splash-font";
    face.textContent = '@font-face{font-family:"Geist Mono";src:url("./fonts/GeistMono.ttf") format("truetype");font-weight:100 900;font-display:block}';
    (D.head || D.documentElement).appendChild(face);
  }

  var SC = 880 / 1076, LX = (1080 - 880) / 2, LY = 910 - 102.6 * SC;
  var BASE = "translate(" + LX + " " + LY + ") scale(" + SC + ")";
  var FILLS =
    '<g id="t3s-rest"><path d="M28.41 0.00H228.00L199.59 42.40H137.75V205.20H90.25V42.40H0.00L28.41 0.00Z" fill="#ffffff" fill-rule="evenodd"/><g transform="translate(-25.90 0)"><path d="M271.90 205.20V106.40C271.90 59.60 304.30 34.40 343.90 34.40H417.40L386.91 79.90H357.40C334.60 79.90 319.40 93.20 319.40 108.40V205.20Z" fill="#ffffff" fill-rule="evenodd"/></g><g transform="translate(413.50 0)"><path d="M 178.00 34.40 H 71.67 C 24.37 34.40 0.00 63.43 0.00 119.80 C 0.00 176.17 24.37 205.20 71.67 205.20 H 178.00 Z M 130.50 69.69 V 169.91 H 86.91 C 45.40 169.91 32.29 157.88 32.29 119.80 C 32.29 81.72 45.40 69.69 86.91 69.69 Z" fill="#ffffff" fill-rule="evenodd"/></g><g transform="translate(617.50 0)"><path d="M85.40 34.40H96.60C152.96 34.40 182.00 63.44 182.00 119.80V119.80C182.00 176.16 152.96 205.20 96.60 205.20H85.40C29.04 205.20 0.00 176.16 0.00 119.80V119.80C0.00 63.44 29.04 34.40 85.40 34.40ZM85.40 76.80H96.60C129.28 76.80 139.60 87.12 139.60 119.80V119.80C139.60 152.48 129.28 162.80 96.60 162.80H85.40C52.72 162.80 42.40 152.48 42.40 119.80V119.80C42.40 87.12 52.72 76.80 85.40 76.80ZM172.50 72.83C178.81 85.44 182.00 101.12 182.00 119.80C182.00 138.48 178.81 154.16 172.50 166.77L123.75 158.23C135.37 152.48 139.60 140.72 139.60 119.80C139.60 98.88 135.37 87.12 123.75 81.37Z" fill="#ffffff" fill-rule="evenodd"/></g></g>' +
    '<g id="t3s-plate"><g transform="translate(72.00 0)"><path d="M790,-20 H982 Q1004,-20 1004,2 V203 Q1004,225 982,225 H748 Q738,225 741,215 Z" fill="#0061B0"/><path d="M813.50 0.00H923.40C953.50 0.00 977.90 24.40 977.90 54.50V68.20C977.90 90.00 957.60 100.90 951.60 100.90C957.60 100.90 981.20 112.12 981.20 134.56V149.10C981.20 180.08 956.08 205.20 925.10 205.20H758.10L786.51 162.80H917.00C926.22 162.80 933.70 155.32 933.70 146.10V140.53C933.70 131.30 926.22 123.83 917.00 123.83H810.64L838.20 82.70H913.70C922.92 82.70 930.40 75.22 930.40 66.00V59.10C930.40 49.88 922.92 42.40 913.70 42.40H785.09Z" fill="#ffffff" fill-rule="evenodd"/></g></g>';
  var STROKES =
    '<path d="M28.41 0.00H228.00L199.59 42.40H137.75V205.20H90.25V42.40H0.00L28.41 0.00Z" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>' +
    '<g transform="translate(-25.90 0)"><path d="M271.90 205.20V106.40C271.90 59.60 304.30 34.40 343.90 34.40H417.40L386.91 79.90H357.40C334.60 79.90 319.40 93.20 319.40 108.40V205.20Z" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></g>' +
    '<g transform="translate(413.50 0)"><path d="M 178.00 34.40 H 71.67 C 24.37 34.40 0.00 63.43 0.00 119.80 C 0.00 176.17 24.37 205.20 71.67 205.20 H 178.00 Z M 130.50 69.69 V 169.91 H 86.91 C 45.40 169.91 32.29 157.88 32.29 119.80 C 32.29 81.72 45.40 69.69 86.91 69.69 Z" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></g>' +
    '<g transform="translate(617.50 0)"><path d="M85.40 34.40H96.60C152.96 34.40 182.00 63.44 182.00 119.80V119.80C182.00 176.16 152.96 205.20 96.60 205.20H85.40C29.04 205.20 0.00 176.16 0.00 119.80V119.80C0.00 63.44 29.04 34.40 85.40 34.40ZM85.40 76.80H96.60C129.28 76.80 139.60 87.12 139.60 119.80V119.80C139.60 152.48 129.28 162.80 96.60 162.80H85.40C52.72 162.80 42.40 152.48 42.40 119.80V119.80C42.40 87.12 52.72 76.80 85.40 76.80ZM172.50 72.83C178.81 85.44 182.00 101.12 182.00 119.80C182.00 138.48 178.81 154.16 172.50 166.77L123.75 158.23C135.37 152.48 139.60 140.72 139.60 119.80C139.60 98.88 135.37 87.12 123.75 81.37Z" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></g>' +
    '<g transform="translate(72.00 0)"><path d="M790,-20 H982 Q1004,-20 1004,2 V203 Q1004,225 982,225 H748 Q738,225 741,215 Z" fill="none" stroke="#7dd3fc" stroke-width="2.4" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/><path d="M813.50 0.00H923.40C953.50 0.00 977.90 24.40 977.90 54.50V68.20C977.90 90.00 957.60 100.90 951.60 100.90C957.60 100.90 981.20 112.12 981.20 134.56V149.10C981.20 180.08 956.08 205.20 925.10 205.20H758.10L786.51 162.80H917.00C926.22 162.80 933.70 155.32 933.70 146.10V140.53C933.70 131.30 926.22 123.83 917.00 123.83H810.64L838.20 82.70H913.70C922.92 82.70 930.40 75.22 930.40 66.00V59.10C930.40 49.88 922.92 42.40 913.70 42.40H785.09Z" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></g>';

  var el = D.createElement("div");
  el.id = "t3-splash";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Trac3. Everything Auto");
  el.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:" + BG + ";margin:0;padding:0;touch-action:none;-webkit-tap-highlight-color:transparent;contain:strict";
  el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%" aria-hidden="true">' +
    '<g id="t3s-root">' +
    '<g id="t3s-logo" opacity="0" transform="' + BASE + '">' + FILLS + '</g>' +
    '<g id="t3s-out" opacity="0" transform="' + BASE + '">' + STROKES + '</g>' +
    '<g id="t3s-tagS" opacity="1" fill="none" stroke="' + TAGC + '" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round" font-family="Geist Mono" font-size="33" font-weight="400"></g>' +
    '<g id="t3s-tagF" opacity="1" fill="' + TAGC + '" font-family="Geist Mono" font-size="33" font-weight="400"></g>' +
    '</g></svg>';
  (D.body || D.documentElement).appendChild(el);
  hideNative();

  function $(id){ return D.getElementById(id); }
  var root = $("t3s-root"), logo = $("t3s-logo"), out = $("t3s-out"), tS = $("t3s-tagS"), tF = $("t3s-tagF");
  var outP = out.querySelectorAll("path");
  var chars = [], outlineChars = [];
  for(var i = 0; i < TEXT.length; i++){
    var ch = TEXT[i];
    var te = D.createElementNS(NS, "text");
    te.setAttribute("xml:space", "preserve");
    te.textContent = ch === " " ? "\u00a0" : ch;
    tF.appendChild(te);
    chars.push(te);
    var oe = D.createElementNS(NS, "text");
    oe.setAttribute("xml:space", "preserve");
    oe.textContent = ch === " " ? "\u00a0" : ch;
    tS.appendChild(oe);
    outlineChars.push(oe);
  }
  var advance = 19.8, dashLens = outlineChars.map(function(){ return 140; }), fontReady = false;

  function seg(t, a, b){ return Math.max(0, Math.min(1, (t - a) / (b - a))); }
  function smooth(x){ return x * x * (3 - 2 * x); }
  function op(n, v){ n.setAttribute("opacity", v.toFixed(4)); }
  function dash(list, v){ for(var j = 0; j < list.length; j++) list[j].setAttribute("stroke-dashoffset", v.toFixed(4)); }

  function measureFont(){
    try{
      var canvas = D.createElement("canvas"), ctx = canvas.getContext("2d");
      ctx.font = '400 33px "Geist Mono"';
      advance = ctx.measureText("M").width || 19.8;
      dashLens = outlineChars.map(function(node){
        var w = Math.max(advance * 0.35, (node.getComputedTextLength && node.getComputedTextLength()) || advance);
        return Math.max(110, w * 3.4);
      });
      fontReady = true;
    }catch(e){ fontReady = true; }
  }

  function placeTagRow(amount){
    var gap = 33 * 0.22, width = advance * TEXT.length + gap * (TEXT.length - 1), x0 = 540 - width / 2, y = 1075;
    for(var k = 0; k < chars.length; k++){
      var x = (x0 + k * (advance + gap)).toFixed(3);
      chars[k].setAttribute("x", x); chars[k].setAttribute("y", y);
      op(chars[k], amount);
      outlineChars[k].setAttribute("x", x); outlineChars[k].setAttribute("y", y);
    }
  }

  function drawTagOutlineFill(t, drawStart, drawEnd, fillStart, fillEnd){
    var q = smooth(seg(t, drawStart, drawEnd));
    var outlineVis = (t >= drawStart ? 1 : 0) * (1 - smooth(seg(t, fillStart, fillEnd)));
    var fillAmt = smooth(seg(t, fillStart, fillEnd));
    placeTagRow(fillAmt);
    for(var k = 0; k < chars.length; k++){
      var len = dashLens[k];
      op(outlineChars[k], outlineVis);
      outlineChars[k].setAttribute("stroke-dasharray", String(len));
      outlineChars[k].setAttribute("stroke-dashoffset", ((1 - q) * len).toFixed(3));
      if(TEXT[k] === " "){
        op(outlineChars[k], 0);
        op(chars[k], fillAmt);
      }
    }
  }

  function renderAt(t){
    t = Math.max(0, Math.min(5.5, t));
    var logoDraw = smooth(seg(t, 0.12, 1.00));
    op(out, (t >= 0.12 ? 1 : 0) * (1 - smooth(seg(t, 0.96, 1.24))));
    dash(outP, 1 - logoDraw);
    op(logo, smooth(seg(t, 0.96, 1.24)));
    if(t < 1.38){
      placeTagRow(0);
      for(var k = 0; k < outlineChars.length; k++) op(outlineChars[k], 0);
    }else{
      drawTagOutlineFill(t, 1.42, 2.32, 2.24, 2.58);
    }
    op(root, 1 - smooth(seg(t, 5.10, 5.35)));
    el.style.opacity = String(1 - smooth(seg(t, 5.35, 5.50)));
  }

  var done = false, raf = 0, t0 = 0, END = 5.5;
  function finish(){
    if(done) return; done = true;
    cancelAnimationFrame(raf); clearTimeout(safety);
    try{ el.remove(); }catch(e){ if(el.parentNode) el.parentNode.removeChild(el); }
    try{ D.dispatchEvent(new CustomEvent("trac3:splashdone")); }catch(e){}
  }
  function skip(e){
    if(done) return; if(e && e.cancelable) e.preventDefault();
    cancelAnimationFrame(raf); el.style.transition = "opacity .18s linear"; el.style.opacity = "0";
    setTimeout(finish, 200);
  }
  var reduce = false; try{ reduce = W.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}
  var safety = setTimeout(finish, reduce ? 2500 : 7500);
  el.addEventListener("pointerdown", skip); el.addEventListener("click", skip);
  D.addEventListener("keydown", function k(){ D.removeEventListener("keydown", k); skip(); });

  var fontP = Promise.resolve();
  try{
    fontP = (D.fonts && D.fonts.load) ? D.fonts.load('400 33px "Geist Mono"').then(function(){ measureFont(); }, function(){ measureFont(); }) : Promise.resolve().then(measureFont);
  }catch(e){ fontP = Promise.resolve().then(measureFont); }

  W.Trac3Splash = {renderAt: renderAt, el: el, ready: fontP};

  fontP.then(function(){
    if(done) return;
    try{
      if(reduce){ renderAt(3.0); setTimeout(skip, 900); return; }
      if(/[?&]splashpause=1/.test(location.search)){ renderAt(0); return; }
      renderAt(0);
      raf = requestAnimationFrame(function tick(now){
        if(done) return;
        if(!t0) t0 = now;
        var t = (now - t0) / 1000;
        if(t >= END){ finish(); return; }
        renderAt(t); raf = requestAnimationFrame(tick);
      });
    }catch(e){ finish(); }
  });
})();
