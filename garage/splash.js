/* Trac3 launch splash: clean fade-in of the final wordmark (variant C 'a', even spacing) + EVERYTHING AUTO.
   Shown only on a cold launch from the home-screen / app icon:
     - installed PWA: manifest start_url carries ?launch=1, or display-mode standalone with no in-app referrer;
     - Capacitor Android app: first page of the app process.
   Never on reloads, back/forward, in-app navigation (sessionStorage "t3.splash"), deep links (#...) or public pages
   (only home.html includes this file). Tap skips; reduced motion shows a short static lock-up; a safety timer always
   removes it. The app loads underneath at the same time.
   Why it is built this way: the old outline-draw + cross-fade was driven by a per-frame JS loop that rewrote ~50
   SVG attributes while the app was booting, so on a phone it stuttered and the thin outline / half-opaque fill showed as
   grey halos and stray lines between the letters. Now: static vector layers (no stroke paths, no filters, no blur,
   no masks), animated with the Web Animations API on opacity + a tiny translateY only, so the compositor does the work
   off the main thread. The overlay is solid #0b0c0e from the first paint and the glyphs are never scaled, so they stay
   pixel-sharp at any screen density. Will-change is dropped when the fade finishes so the final frame re-rasterises crisp.
   Timeline (s): 0.15-0.95 logo fades in (ease-out) | 0.80-1.50 tagline fades in | hold to 2.80 |
   2.80-3.10 lock-up fades to the app | 3.10 overlay removed.
   Logo paths are the approved traced master (garage/trac3-wordmark.svg, variant C 'a'). Logo is 880px / 81.5% of the 1080 canvas. */
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

  var SC = 880 / 1092, LX = (1080 - 880) / 2, LY = 910 - 102.6 * SC;
  var BASE = "translate(" + LX + " " + LY + ") scale(" + SC + ")";
  var FILLS =
    '<g id="t3s-rest"><path d="M28.41 0.00H228.00L199.59 42.40H137.75V205.20H90.25V42.40H0.00L28.41 0.00Z" fill="#ffffff" fill-rule="evenodd"/><g transform="translate(-25.90 0)"><path d="M271.90 205.20V106.40C271.90 59.60 304.30 34.40 343.90 34.40H417.40L386.91 79.90H357.40C334.60 79.90 319.40 93.20 319.40 108.40V205.20Z" fill="#ffffff" fill-rule="evenodd"/></g><g transform="translate(413.50 0)"><path d="M162.00 34.40 H75.67 C28.37 34.40 4.00 63.43 4.00 119.80 C4.00 176.17 28.37 205.20 75.67 205.20 H183.50 C184.88 205.20 186.00 204.08 186.00 202.70 V189.70 C186.00 188.32 184.88 187.20 183.50 187.20 H174.00 V46.40 C174.00 39.77 168.63 34.40 162.00 34.40 Z M126.50 93.69 V159.91 C126.50 165.43 122.02 169.91 116.50 169.91 H90.91 C49.40 169.91 36.29 157.88 36.29 119.80 C36.29 81.72 49.40 69.69 90.91 69.69 H102.50 C115.75 69.69 126.50 80.44 126.50 93.69 Z" fill="#ffffff" fill-rule="evenodd"/></g><g transform="translate(633.50 0)"><path d="M172.49 72.83L123.75 81.37C117.22 78.14 108.36 76.8 96.6 76.8L85.4 76.8C52.72 76.8 42.4 87.12 42.4 119.8C42.4 152.48 52.72 162.8 85.4 162.8L96.6 162.8C108.36 162.8 117.22 161.46 123.75 158.23L172.49 166.77C159.75 192.22 134.28 205.2 96.6 205.2L85.4 205.2C29.04 205.2 0 176.16 0 119.8C0 63.44 29.04 34.4 85.4 34.4L96.6 34.4C134.28 34.4 159.75 47.38 172.49 72.83Z" fill="#ffffff" fill-rule="evenodd"/></g></g>' +
    '<g id="t3s-plate"><g transform="translate(88.00 0)"><path d="M790,-20 H982 Q1004,-20 1004,2 V203 Q1004,225 982,225 H748 Q738,225 741,215 Z" fill="#0061B0"/><path d="M813.50 0.00H923.40C953.50 0.00 977.90 24.40 977.90 54.50V68.20C977.90 90.00 957.60 100.90 951.60 100.90C957.60 100.90 981.20 112.12 981.20 134.56V149.10C981.20 180.08 956.08 205.20 925.10 205.20H758.10L786.51 162.80H917.00C926.22 162.80 933.70 155.32 933.70 146.10V140.53C933.70 131.30 926.22 123.83 917.00 123.83H810.64L838.20 82.70H913.70C922.92 82.70 930.40 75.22 930.40 66.00V59.10C930.40 49.88 922.92 42.40 913.70 42.40H785.09Z" fill="#ffffff" fill-rule="evenodd"/></g></g>';

  var LOGO_IN = [0.15, 0.95], TAG_IN = [0.80, 1.50], OUT_AT = [2.80, 3.10], END = 3.10;
  var EASE = "cubic-bezier(0.22,0.61,0.36,1)";
  var reduce = false; try{ reduce = W.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}

  var css = D.createElement("style");
  css.id = "t3-splash-css";
  css.textContent = "#t3-splash{position:fixed;inset:0;z-index:2147483600;background:" + BG + ";margin:0;padding:0;touch-action:none;" +
    "-webkit-tap-highlight-color:transparent;contain:strict;overflow:hidden}" +
    "#t3-splash svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block;opacity:0;" +
    "shape-rendering:geometricPrecision;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased;" +
    "backface-visibility:hidden;will-change:opacity,transform}" +
    "#t3-splash.t3-static svg{opacity:1}";
  (D.head || D.documentElement).appendChild(css);

  var el = D.createElement("div");
  el.id = "t3-splash";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Trac3. Everything Auto");
  var SVGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">';
  el.innerHTML = SVGO + '<g transform="' + BASE + '">' + FILLS + '</g></svg>' +
    SVGO + '<g id="t3s-tag" fill="' + TAGC + '" font-family="Geist Mono" font-size="33" font-weight="400"></g></svg>';
  (D.body || D.documentElement).appendChild(el);
  hideNative();

  var logoSvg = el.firstChild, tagSvg = el.lastChild, tagG = tagSvg.firstChild;
  var advance = 19.8;
  function measureFont(){
    try{
      var ctx = D.createElement("canvas").getContext("2d");
      ctx.font = '400 33px "Geist Mono"';
      advance = ctx.measureText("M").width || 19.8;
    }catch(e){}
  }
  function placeTag(){
    while(tagG.firstChild) tagG.removeChild(tagG.firstChild);
    var gap = 33 * 0.22, width = advance * TEXT.length + gap * (TEXT.length - 1), x0 = 540 - width / 2, y = 1075;
    for(var k = 0; k < TEXT.length; k++){
      if(TEXT[k] === " ") continue;
      var te = D.createElementNS(NS, "text");
      te.setAttribute("x", (x0 + k * (advance + gap)).toFixed(3)); te.setAttribute("y", y);
      te.textContent = TEXT[k];
      tagG.appendChild(te);
    }
  }

  var done = false, anims = [], safety = 0;
  function finish(){
    if(done) return; done = true;
    clearTimeout(safety);
    try{ anims.forEach(function(a){ a.cancel(); }); }catch(e){}
    try{ el.remove(); }catch(e){ if(el.parentNode) el.parentNode.removeChild(el); }
    try{ css.remove(); }catch(e){}
    try{ D.dispatchEvent(new CustomEvent("trac3:splashdone")); }catch(e){}
  }
  function skip(e){
    if(done) return; if(e && e.cancelable) e.preventDefault();
    try{ anims.forEach(function(a){ a.cancel(); }); }catch(e2){}
    logoSvg.style.opacity = tagSvg.style.opacity = "1";
    el.style.transition = "opacity .18s linear"; el.style.opacity = "0";
    setTimeout(finish, 200);
  }
  safety = setTimeout(finish, reduce ? 2500 : 6000);
  el.addEventListener("pointerdown", skip); el.addEventListener("click", skip);
  D.addEventListener("keydown", function k(){ D.removeEventListener("keydown", k); skip(); });

  function ms(s){ return Math.round(s * 1000); }
  function build(){
    var T = ms(END);
    function fade(node, a, b, dy){
      var fromO = 0, d = ms(b - a), startF = a / END, endF = b / END;
      var kf = [
        {offset: 0, opacity: 0, transform: "translate3d(0," + dy + "px,0)"},
        {offset: startF, opacity: 0, transform: "translate3d(0," + dy + "px,0)", easing: EASE},
        {offset: endF, opacity: 1, transform: "translate3d(0,0,0)"},
        {offset: 1, opacity: 1, transform: "translate3d(0,0,0)"}
      ];
      return node.animate(kf, {duration: T, fill: "both", easing: "linear"});
    }
    anims.push(fade(logoSvg, LOGO_IN[0], LOGO_IN[1], 10));
    anims.push(fade(tagSvg, TAG_IN[0], TAG_IN[1], 6));
    var o = el.animate([
      {offset: 0, opacity: 1}, {offset: OUT_AT[0] / END, opacity: 1, easing: "ease-in-out"},
      {offset: OUT_AT[1] / END, opacity: 0}, {offset: 1, opacity: 0}
    ], {duration: T, fill: "both", easing: "linear"});
    anims.push(o);
    return o;
  }

  function renderAt(t){
    t = Math.max(0, Math.min(END, t));
    if(!anims.length) build();
    anims.forEach(function(a){ a.pause(); a.currentTime = ms(t); });
  }

  var fontP = Promise.resolve();
  try{
    fontP = (D.fonts && D.fonts.load) ? D.fonts.load('400 33px "Geist Mono"').then(measureFont, measureFont) : Promise.resolve().then(measureFont);
  }catch(e){ fontP = Promise.resolve().then(measureFont); }

  W.Trac3Splash = {renderAt: renderAt, el: el, ready: fontP};

  fontP.then(function(){
    if(done) return;
    try{
      placeTag();
      if(reduce || !el.animate){ el.classList.add("t3-static"); setTimeout(skip, reduce ? 900 : 1800); return; }
      if(/[?&]splashpause=1/.test(location.search)){ renderAt(0); return; }
      var last = build();
      last.onfinish = function(){ finish(); };
      // drop the layer hints once everything has settled so the final frame is rasterised crisp at device resolution
      anims[0].onfinish = anims[1].onfinish = function(){};
      setTimeout(function(){ if(!done){ logoSvg.style.willChange = "auto"; } }, ms(TAG_IN[1]) + 60);
    }catch(e){ finish(); }
  });
})();
