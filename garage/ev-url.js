/* Trac3 Drive diary: link to one event's own page (event.html). Types:
   j = journey (gt.driveLog), run = Performance run (driv3-runs / gt.driveLog), diy = work done (gt.diy),
   mech = mechanic upload (dipstick-uploads), note = old History note (dipstick-history), route = saved route (gt.loggedTrips),
   rem = MOT / tax / insurance / service / belt / tyres due (gt.garage via D3Rem). */
(function(){
  window.D3Ev={ url:function(t,id,day,extra){ return "event.html?t="+encodeURIComponent(t)+"&id="+encodeURIComponent(id==null?"":id)+(day?"&d="+encodeURIComponent(day):"")+(extra||""); } };
})();
