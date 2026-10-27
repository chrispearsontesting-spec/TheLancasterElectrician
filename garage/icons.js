(function(){
  if(window.__dipstickIcons) return;
  window.__dipstickIcons=true;
  var S={
    tick:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/><path d="M8 12.2l2.4 2.4 5.6-5.6"/></svg>',
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v3M16 3.5v3M4 10h16"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg>',
    turbo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15.5c0-3.5 2.8-6.2 6.2-6.2 1.8 0 3.4.8 4.5 2"/><path d="M5.5 12.5c1.5-3.2 4.8-5.2 8.4-5.2 4 0 7.2 3 7.2 6.8"/><circle cx="9.2" cy="16.2" r="1.8"/><path d="M15.2 9.5l2.6-1.8M17.2 8.2l.8 2.2"/></svg>',
    wheel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="2.6"/><path d="M12 3.2v6.2"/><path d="M4.8 16.4l4.4-2.6"/><path d="M19.2 16.4l-4.4-2.6"/></svg>',
    wrench:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5c2.8 0 5 2.2 5 5 0 .6-.1 1.2-.4 1.7L19 18.2l-2.8 2.8-7.9-7.9A5 5 0 1 1 6.5 3.5z"/><path d="M6.5 5.2v2.6H3.9"/></svg>',
    map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 4.5l7 2.2 4.5-1.7v14.5l-4.5 1.7-7-2.2-4.5 1.7V6.2z"/><path d="M8.5 4.5v14.3M15.5 6.7v14.3"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="6.2"/><path d="M16.2 16.2L21 21"/></svg>',
    cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 10.2l5-2.2v8.2l-5-2.2z"/></svg>',
    pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s6.2-6 6.2-11A6.2 6.2 0 0 0 5.8 10c0 5 6.2 11 6.2 11z"/><circle cx="12" cy="10" r="2.1"/></svg>',
    book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h6.5a3 3 0 0 1 3 3V19.5a2.2 2.2 0 0 0-2.2-2.2H5z"/><path d="M19 4.5h-6.5a3 3 0 0 0-3 3V19.5a2.2 2.2 0 0 1 2.2-2.2H19z"/></svg>',
    doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5"/><path d="M8.5 12.5h7M8.5 15.5h7M8.5 9.5h3"/></svg>',
    box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
    yt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6.5" width="18" height="11" rx="3"/><path d="M10.5 9.5l5 2.5-5 2.5z"/></svg>',
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7l8 6 8-6"/></svg>',
    phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 3.8h3.2l1.2 3-2 1.2a12 12 0 0 0 5.1 5.1l1.2-2 3 1.2v3.2c0 .8-.7 1.5-1.5 1.5A15.5 15.5 0 0 1 6 5.3c0-.8.7-1.5 1.5-1.5z"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l7.5 3v6.2c0 4.2-3.1 7.2-7.5 8.3-4.4-1.1-7.5-4.1-7.5-8.3V6.5z"/><path d="M9 12.2l2 2 4-4"/></svg>',
    star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.2 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8z"/></svg>',
    coin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.2v9.6"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M8.2 12.2l2.5 2.5 5.1-5.2"/></svg>',
    hist:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3.2 2"/></svg>'
  };
  function kind(el){
    var forced=el.getAttribute("data-ico");
    if(forced && S[forced]) return forced;
    var t=((el.textContent||"")+" "+(el.getAttribute("href")||"")+" "+(el.id||"")).toLowerCase();
    if(/youtube/.test(t)) return "yt";
    if(/back|close|btnclose/.test(t)) return "back";
    if(/remind/.test(t)) return "tick";
    if(/calendar|diary/.test(t)) return "cal";
    if(/dashcam|record|camera/.test(t)) return "cam";
    if(/track journey|gps/.test(t)) return "pin";
    if(/\bdrive\b/.test(t) && !/diary/.test(t)) return "wheel";
    if(/service cost|wrench|repair|maintenance/.test(t)) return "wrench";
    if(/route cost|journey log|\bmap\b/.test(t)) return "map";
    if(/where to buy|gsf|euro car|ebay|haynes|parts/.test(t)) return "box";
    if(/how-to|how to/.test(t)) return "play";
    if(/buying guide|look up/.test(t)) return "search";
    if(/email|gmail|mail/.test(t)) return "mail";
    if(/call|phone/.test(t)) return "phone";
    if(/policy|insur/.test(t)) return "shield";
    if(/ncap|safety/.test(t)) return "star";
    if(/renew|tax/.test(t)) return "coin";
    if(/\bsave\b/.test(t)) return "save";
    if(/history|mot record/.test(t)) return "hist";
    if(/book mot|book service|book change/.test(t)) return "check";
    return "";
  }
  function decorate(el){
    if(!el || el.getAttribute("data-iconed")) return;
    var k=kind(el);
    if(!k||!S[k]) return;
    el.setAttribute("data-iconed","1");
    var i=document.createElement("span");
    i.className="ico";
    i.innerHTML=S[k];
    if(el.firstChild) el.insertBefore(i,el.firstChild);
    else el.appendChild(i);
  }
  function run(root){
    (root||document).querySelectorAll("a.btn,button.btn,a.wide,button.wide,.accBtn,.sug").forEach(decorate);
  }
  window.dipstickIcons=run; window.dipstickIconSvg=S;
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){run();});
  else run();
  document.addEventListener("click",function(){ setTimeout(run,30); });
})();
