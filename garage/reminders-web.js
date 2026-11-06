/* Web alerts can run only while Driv3 is open. The Android app schedules them on-phone when closed. */
(function(){
  "use strict";
  if(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())return;
  var R=window.D3Rem,nav=navigator,busy=false;
  if(!R||!nav.serviceWorker||!window.Notification)return;
  function garage(){try{return JSON.parse(localStorage.getItem("gt.garage")||"null")}catch(e){return null}}
  async function check(){
    if(busy||Notification.permission!=="granted")return;busy=true;
    try{
      var now=new Date(),mid=new Date(now.getFullYear(),now.getMonth(),now.getDate()),seen={};
      try{seen=JSON.parse(localStorage.getItem("gt.webRemindersSeen")||"{}")||{}}catch(e){}
      var list=R.upcoming(garage(),R.load(),new Date(mid.getTime()-1),2).filter(function(n){return n.fireAt>=mid&&n.fireAt<=now&&!seen[n.id+"|"+n.due]});
      if(!list.length)return;
      var reg=await nav.serviceWorker.getRegistration();if(!reg||!reg.active)return;
      for(var n of list){
        await reg.showNotification(n.title,{body:n.body,tag:"driv3-"+n.id,icon:"./icon-192.png",actions:n.actions,data:n.extra});
        seen[n.id+"|"+n.due]=now.getTime();
      }
      Object.keys(seen).forEach(function(k){if(seen[k]<now.getTime()-31*86400000)delete seen[k]});
      localStorage.setItem("gt.webRemindersSeen",JSON.stringify(seen));
    }catch(e){/* Permission and platform restrictions must never interrupt the app. */}
    finally{busy=false}
  }
  window.driv3CheckWebReminders=check;
  var btn=document.getElementById("enableAlerts");
  if(btn){btn.hidden=false;btn.onclick=async function(){var status=document.getElementById("alertsStatus");try{
    var permission=await Notification.requestPermission();
    status.textContent=permission==="granted"?"Alerts enabled while Driv3 is open. For reminders when closed, use the Android app.":"Alerts are off. You can still book from a reminder card or Home.";
    check();
  }catch(e){status.textContent="Alerts are unavailable on this phone. You can still book from Home."}}}
  window.addEventListener("pageshow",check);window.addEventListener("storage",check);
  document.addEventListener("visibilitychange",function(){if(!document.hidden)check()});
  document.addEventListener("d3reminderschanged",check);setInterval(check,60000);check();
})();
