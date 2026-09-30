(function(){
  if(window.__dipstickIcons) return;
  window.__dipstickIcons=true;
  var S={
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v3M16 3.5v3M4 10h16"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg>',
    wheel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="2.2"/><path d="M12 9.8V4.8M7.4 14.8L4.8 16.6M16.6 14.8l2.6 1.8"/></svg>',
    wrench:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4.5c2.2 0 4 1.8 4 4 0 .5-.1 1-.3 1.5L20 18l-2 2-8.1-8.3A4 4 0 1 1 8 4.5z"/><path d="M8 6.2v2.2H5.8"/><path d="M14.5 5.5l4 4M16.2 3.8l4 4"/></svg>',
    map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 4.5l7 2.2 4.5-1.7v14.5l-4.5 1.7-7-2.2-4.5 1.7V6.2z"/><path d="M8.5 4.5v14.3M15.5 6.7v14.3"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="6.2"/><path d="M16.2 16.2L21 21"/></svg>',
    cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 10.2l5-2.2v8.2l-5-2.2z"/></svg>',
    pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s6.2-6 6.2-11A6.2 6.2 0 0 0 5.8 10c0 5 6.2 11 6.2 11z"/><circle cx="12" cy="10" r="2.1"/></svg>',
    book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6a2.4 2.4 0 0 1 2.4-2.4H20v15.2H7.4A2.4 2.4 0 0 0 5 21.2z"/><path d="M5 6v15.2"/></svg>',
    back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>',
    save:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h11.2L20 8.8V20H5z"/><path d="M8 5v5h8M8 20v-6h8v6"/></svg>',
    play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M10 9.2l5.4 2.8L10 14.8z"/></svg>',
    box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.2L12 4.5l8.5 3.7L12 12z"/><path d="M3.5 8.2v8.2L12 20l8.5-3.6V8.2"/><path d="M12 12v8"/></svg>',
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.2" y="6" width="17.6" height="12" rx="2"/><path d="M4.2 8l7.8 5.4L19.8 8"/></svg>',
    phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.2 3.8h3.2l1.2 3.2-2 1.8a11 11 0 0 0 5 5l1.8-2 3.2 1.2v3.2A3.2 3.2 0 0 1 16.4 20 14.2 14.2 0 0 1 4 7.6a3.2 3.2 0 0 1 3.2-3.8z"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2l8 2.8v6.2c0 4.8-3.3 8-8 9.2-4.7-1.2-8-4.4-8-9.2V6z"/></svg>',
    star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.6l2.3 5.4 5.9.5-4.5 3.8 1.4 5.8L12 16.2 6.9 19.1l1.4-5.8L3.8 9.5l5.9-.5z"/></svg>',
    coin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.2v9.6"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M8.2 12.2l2.5 2.5 5.1-5.2"/></svg>',
    hist:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3.2 2"/></svg>'
  };
  function kind(el){
    var t=((el.getAttribute("data-ico")||"")+" "+(el.textContent||"")+" "+(el.getAttribute("href")||"")+" "+(el.id||"")).toLowerCase();
    if(/back|close|btnclose/.test(t)) return "back";
    if(/remind|calendar|diary/.test(t)) return "cal";
    if(/dashcam|record|camera/.test(t)) return "cam";
    if(/track journey|gps/.test(t)) return "pin";
    if(/drive(?! diary)/.test(t)) return "wheel";
    if(/service|wrench|estimate|clutch|repair/.test(t)) return "wrench";
    if(/route|map|trip|journey log/.test(t)) return "map";
    if(/buy|guide|look up|search/.test(t)) return "search";
    if(/youtube|how-to|play/.test(t)) return "play";
    if(/gsf|euro car|ebay|parts|haynes|where to buy/.test(t)) return "box";
    if(/email|gmail|mail/.test(t)) return "mail";
    if(/call|phone/.test(t)) return "phone";
    if(/policy|insur|shield/.test(t)) return "shield";
    if(/ncap|safety|star/.test(t)) return "star";
    if(/tax|cost|£|price|renew/.test(t)) return "coin";
    if(/save|saved/.test(t)) return "save";
    if(/history|mot record|official mot/.test(t)) return "hist";
    if(/book mot|book service|book change|view history/.test(t)) return "check";
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
  window.dipstickIcons=run;
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){run();});
  else run();
  document.addEventListener("click",function(){ setTimeout(run,30); });
})();
