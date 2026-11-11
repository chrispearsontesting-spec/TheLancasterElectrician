/* Booking drafts and cycle acknowledgements stay in gt.garage, on this phone only. */
(function(){
  "use strict";
  var R=window.D3Rem,q=new URLSearchParams(location.search),type=q.get("job")||"mot";
  if(type==="tyre")type="tyres";
  var info=R.TYPES.filter(function(t){return t.type===type&&t.book})[0],key=q.get("car"),form=document.getElementById("booking"),timer;
  function el(id){return document.getElementById(id)}
  function read(){try{var g=JSON.parse(localStorage.getItem("gt.garage")||"null");return g&&Array.isArray(g.cars)?g:{i:0,cars:[]}}catch(e){return {i:0,cars:[]}}}
  function find(g){return g.cars.findIndex(function(c){return key?c.id===key||R.vrn(c.plate)===R.vrn(key):c===g.cars[g.i||0]})}
  var initial=read(),ci=find(initial),car=initial.cars[ci];
  function message(t,bad){el("status").textContent=t;el("status").classList.toggle("bad",!!bad)}
  if(!info||!car){el("missing").hidden=false;return}
  /* Always target the same car, even if another screen changes the selected car. */
  key=car.id||R.vrn(car.plate);
  var due=R.dueOf(car,type),draft=(car.garageBookingDrafts||{})[type]||{};
  if(draft.due!==due)draft={};
  form.hidden=false;el("jobTitle").textContent=info.label;el("dot").style.background=info.color;
  el("carTitle").textContent=(car.name||car.nick||"Car")+" · "+R.plate(car.plate);
  el("due").textContent=due?(type==="tyres"?"Estimated check / change: ":"Due: ")+R.niceDate(due):"No due date saved — you can still book.";
  if(type==="tyres")el("due").textContent+=" Estimate only; check tread and condition regularly.";
  el("preferredDate").min=R.iso(new Date());el("preferredDate").value=draft.preferredDate||"";
  el("comments").value=draft.comments||"";el("garageEmail").value=draft.email!=null?draft.email:car.motEmail||"";
  el("garageName").textContent=car.motName||"No garage name saved";
  el("emailSearch").href="https://www.google.com/search?q="+encodeURIComponent([car.motName||"garage",car.motPhone||"",car.motAddress||"","email"].filter(Boolean).join(" "));
  el("editGarage").href="home.html#garage="+encodeURIComponent(key);
  /* Pre-fill the garage email when none is saved: remembered contacts, then the garage website. */
  var autoEmail=car.motEmailAuto&&car.motEmail?car.motEmail:"";
  function showFound(t){el("emailFound").textContent=t||"";el("emailFound").hidden=!t}
  if(autoEmail&&el("garageEmail").value===autoEmail)showFound("Found automatically - please check");
  if(!el("garageEmail").value.trim()&&window.D3GarageContact&&D3GarageContact.needs(car)){
    showFound("Looking for their email…");
    D3GarageContact.find(car).then(function(r){
      var box=el("garageEmail");
      if(!r.email||(box.value.trim()&&box.value!==autoEmail)){if(el("emailFound").textContent==="Looking for their email…")showFound("");return}
      box.value=r.email;autoEmail=r.email;showFound(D3GarageContact.hint(r.source));
      try{update(function(c){if(!String(c.motEmail||"").trim()||c.motEmailAuto){c.motEmail=r.email;c.motEmailAuto=true}if(r.postcode&&!c.motPostcode){c.motPostcode=r.postcode;c.motTown=r.town||""}if(r.website&&!c.motWeb)c.motWeb=r.website})}catch(e){}
      preview();keepDraft();
    });
  }
  el("garageEmail").addEventListener("input",function(){if(el("garageEmail").value!==autoEmail)showFound("")});
  var tel=R.phone(car);el("callGarage").hidden=!tel;el("callGarage").href=tel?"tel:"+tel:"#";
  el("noContact").hidden=!!(tel||car.motEmail);
  function current(){var g=read(),i=find(g);if(i<0)throw new Error("This car is no longer saved. Go Home and choose a car.");return {g:g,c:g.cars[i]}}
  function update(fn){var x=current();fn(x.c);localStorage.setItem("gt.garage",JSON.stringify(x.g));car=x.c;return car}
  function options(){var last="";try{var work=JSON.parse(localStorage.getItem("gt.diy")||"[]");work.forEach(function(w){if(R.vrn(w.plate)===R.vrn(car.plate)&&w.kind==="service"&&w.date>last&&w.date<=R.iso(new Date()))last=w.date})}catch(e){}return {preferredDate:el("preferredDate").value,comments:el("comments").value,lastService:last}}
  function email(){var c=Object.assign({},car,{motEmail:el("garageEmail").value.trim()});return R.email(c,type,options())}
  function preview(){el("dateChosen").textContent=R.niceDate(el("preferredDate").value);var e=email();el("emailSubject").textContent=e.subject;el("emailBody").textContent=e.body}
  function cycleUI(){el("opened").hidden=el("askAgain").hidden=!R.opened(car,type)}
  function keepDraft(){clearTimeout(timer);try{update(function(c){c.garageBookingDrafts=c.garageBookingDrafts||{};c.garageBookingDrafts[type]={due:R.dueOf(c,type),preferredDate:el("preferredDate").value,comments:el("comments").value,email:el("garageEmail").value}})}catch(e){message("Could not save this draft on your phone. "+e.message,true)}}
  form.addEventListener("input",function(){preview();clearTimeout(timer);timer=setTimeout(keepDraft,250)});
  form.addEventListener("change",keepDraft);window.addEventListener("pagehide",keepDraft);
  el("askAgain").onclick=function(){try{update(function(c){if(c.garageBookings)delete c.garageBookings[type]});cycleUI();message("Booking prompts restored for this due date.")}catch(e){message(e.message,true)}};
  function external(url){return window.driv3OpenExternal?window.driv3OpenExternal(url):Promise.resolve().then(function(){location.href=url})}
  form.onsubmit=function(e){e.preventDefault();if(!form.reportValidity())return;
    var out,cycle;try{car=current().c;out=email();cycle=R.dueOf(car,type)}catch(err){message(err.message,true);return}if(!out.href){message("Please enter a valid garage email.",true);return}
    el("send").disabled=true;
    var typed=out.to!==autoEmail;
    try{keepDraft();update(function(c){var changed=String(c.motEmail||"").toLowerCase()!==out.to.toLowerCase();c.motEmail=out.to;c.motEmailAuto=!typed;if(typed&&changed&&window.D3GarageContact&&c.motPostcode)D3GarageContact.remember(c.motName,c.motPostcode,out.to)})}catch(err){message("Could not save the garage email. "+err.message,true);el("send").disabled=false;return}
    external(out.href).then(function(){
      update(function(c){c.garageBookings=c.garageBookings||{};c.garageBookings[type]={due:cycle,openedAt:Date.now(),preferredDate:el("preferredDate").value}});
      if(window.driv3Reschedule)window.driv3Reschedule();
      cycleUI();message("Email opened. Press Send there, then wait for your garage to confirm. Didn’t open? Check you have an email app.");
    }).catch(function(err){message("Could not open your email app. Check one is set up and try again. "+(err.message||""),true)}).finally(function(){el("send").disabled=false});
  };
  var Speech=window.SpeechRecognition||window.webkitSpeechRecognition,rec=null,listening=false,failed=false;
  function voiceHint(t){el("voiceHint").textContent=t}
  if(!Speech){el("mic").disabled=true;voiceHint("Use the microphone on your keyboard to speak, or type your comments. This phone does not support the separate mic button.")}
  else el("mic").onclick=function(){
    if(listening){rec.stop();return}
    try{rec=new Speech();rec.lang="en-GB";rec.interimResults=false;rec.continuous=false;failed=false;
      rec.onstart=function(){listening=true;el("mic").setAttribute("aria-pressed","true");el("micText").textContent="Stop listening";voiceHint("Listening… tap again to finish. Voice typing may use your phone’s speech service.")};
      rec.onresult=function(e){var said="";for(var i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)said+=e.results[i][0].transcript+" ";if(said.trim()){var box=el("comments");box.value=(box.value+(box.value.trim()?" ":"")+said.trim()).slice(0,4000);preview();keepDraft()}};
      rec.onerror=function(){failed=true;voiceHint("Could not use voice typing. Type instead, or use the microphone on your keyboard.")};
      rec.onend=function(){listening=false;el("mic").setAttribute("aria-pressed","false");el("micText").textContent="Speak your comments";if(!failed)voiceHint("Check your comments before sending. You can also use the microphone on your keyboard.")};
      rec.start();
    }catch(e){voiceHint("Voice typing is unavailable. Type instead, or use the microphone on your keyboard.")}
  };
  document.addEventListener("visibilitychange",function(){if(document.hidden&&rec&&listening)rec.stop()});
  preview();cycleUI();
  if(q.get("call")==="1"&&tel){message("Opening your phone. If it does not open, tap Call garage.");external("tel:"+tel).catch(function(){message("Tap Call garage to open your phone.")})}
})();
