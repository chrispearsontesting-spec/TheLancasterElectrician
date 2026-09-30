(function(){
  if(window.__dipstickIcons) return;
  window.__dipstickIcons=true;
  var S={
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3.5v3M16 3.5v3M3.5 10h17"/></svg>',
    wheel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5M12 15v5M4 12h5M15 12h5"/></svg>',
    wrench:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 7a4 4 0 0 1-5.7 3.6L4 15v4h4l4.4-4.3A4 4 0 1 1 14 7z"/><path d="M16.5 16.5l3 3"/></svg>',
    map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 4l6 2 5-2v16l-5 2-6-2-5 2V6z"/><path d="M9 4v16M15 6v16"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
    cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 10l5-2v8l-5-2z"/></svg>',
    pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s6-6.2 6-11a6 6 0 1 0-12 0c0 4.8 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></svg>',
    book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 5.5v16"/></svg>',
    back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 6l-6 6 6 6"/></svg>',
    save:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 5h11l3 3v11H5z"/><path d="M8 5v5h8M8 19v-6h8v6"/></svg>',
    play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M10 9l6 3-6 3z"/></svg>',
    box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/></svg>',
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M4 8l8 6 8-6"/></svg>',
    phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 3.5h3.5L12 7l-2 2a12 12 0 0 0 5 5l2-2 3.5 1.5V17A3.5 3.5 0 0 1 17 20.5 14.5 14.5 0 0 1 3.5 7 3.5 3.5 0 0 1 7 3.5z"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l8 3v6c0 5-3.4 8.2-8 9.5C7.4 20.2 4 17 4 12V6z"/></svg>',
    star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3.5l2.4 5.6 6.1.6-4.6 4 1.4 6-5.3-3.2-5.3 3.2 1.4-6-4.6-4 6.1-.6z"/></svg>',
    coin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.2c.6-.8 1.5-1.2 2.5-1.2 1.7 0 2.7 1 2.7 2.2 0 2.8-5.4 1.6-5.4 4.2 0 1.2 1.1 2.2 2.8 2.2 1.1 0 2-.4 2.6-1.2"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M8 12.2l2.6 2.6L16 9.5"/></svg>',
    hist:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>'
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
