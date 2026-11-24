/* Trac3 Drive diary: every entry opens its own page (event.html, see ev-url.js).
   - Day sheet cards (journeys, runs, work, mechanic uploads, notes, saved routes, reminders): tap the card. Buttons, links,
     photos and the MPG editor inside a card keep doing what they did.
   - Calendar dots: tap the dots under a day. One entry opens straight away; more than one shows that day's list.
   - Recent / Maintenance / Journeys lists: handled in cal-lists.js (rows carry data-ev). */
(function(){
  var list=document.getElementById("list"), grid=document.getElementById("grid");
  function chev(){ return "<span class='evChev' aria-hidden='true'></span>"; }
  function decorate(){
    list.querySelectorAll("[data-ev]").forEach(function(c){ if(!c.getAttribute("data-ev")) return; c.classList.add("evCard");
      var t=c.querySelector("b.title"); if(t&&!t.querySelector(".evChev")) t.insertAdjacentHTML("beforeend",chev());
      if(!c.hasAttribute("tabindex")){ c.setAttribute("tabindex","0"); c.setAttribute("role","link"); c.setAttribute("aria-label",(t?t.textContent.trim():"Entry")+": open details"); } });
  }
  var orig=window.render; window.render=function(){ orig.apply(this,arguments); try{ decorate(); }catch(e){ console.warn(e); } };
  decorate();
  function go(u){ if(u) location.href=u; }
  list.addEventListener("click",function(e){ var c=e.target.closest("[data-ev]"); if(!c||!list.contains(c)) return;
    var inner=e.target.closest("button,a,input,textarea,select,label,img,video,.edit"); if(inner&&c.contains(inner)&&inner!==c) return;
    go(c.getAttribute("data-ev")); });
  list.addEventListener("keydown",function(e){ if(e.key!=="Enter"&&e.key!==" ") return; var c=e.target.closest&&e.target.closest("[data-ev]"); if(c&&c===e.target){ e.preventDefault(); go(c.getAttribute("data-ev")); } });
  grid.addEventListener("click",function(e){ var d=e.target.closest(".dots"); if(!d||!d.querySelector(".dot")) return;
    setTimeout(function(){ var ev=[].slice.call(list.querySelectorAll("[data-ev]")).map(function(c){ return c.getAttribute("data-ev"); }).filter(Boolean);
      if(ev.length===1) go(ev[0]); else if(ev.length) list.scrollIntoView({behavior:"smooth",block:"start"}); },0); });
})();
