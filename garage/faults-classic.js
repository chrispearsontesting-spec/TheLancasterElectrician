window.FAULTS=(window.FAULTS||[]).concat([
{k:["toyota","celica"],y0:1970,y1:1977,name:"Toyota Celica A20 / A30 (1970-77)",engine:"1.6 / 2.0 petrol",
 faults:[
  {s:"high",t:"Sills, arches and floor pans",d:"First-gen cars rot in the usual Toyota places plus the battery tray. Lift the carpets."},
  {s:"high",t:"Cooling and head gasket",d:"These engines overheat if the radiator is original. Look for mayo and a sweet smell."},
  {s:"med",t:"Carburettor and vacuum pipes",d:"Flat spots and a hunting idle usually mean perished pipes, not a rebuild."},
  {s:"med",t:"Kingpins / steering joints",d:"Wander at speed. Jack it and feel for play."},
  {s:"low",t:"Parts and import paperwork",d:"Confirm it is a UK car or a documented import. Lights and speedo matter on an MOT."}
 ],due:["Cooling system","Structural rust weld check","Brake pipes and flexi hoses"]},
{k:["toyota","celica"],y0:1977,y1:1981,name:"Toyota Celica A40 (1977-81)",engine:"1.6 / 2.0 petrol",
 faults:[
  {s:"high",t:"Rear arches and strut tops",d:"The bubble-back rusts around the rear lights and strut towers."},
  {s:"med",t:"Timing chain rattle",d:"Listen from cold. A worn tensioner is cheaper than a jumped chain."},
  {s:"med",t:"Soft brake hoses and seized calipers",d:"Age, not mileage."},
  {s:"med",t:"Sunroof drains",d:"If fitted, blocked drains soak the floors."}
 ],due:["Strut-top inspection","Brake hydraulics","Chain tensioner"]},
{k:["toyota","celica"],y0:1981,y1:1985,name:"Toyota Celica A60 (1981-85)",engine:"2.0 petrol",
 faults:[
  {s:"high",t:"Rear wheel arches and sills",d:"Very common on UK A60s. Probe the lip, do not just look."},
  {s:"med",t:"2.0 18R / 21R oil leaks",d:"Rocker cover and sump gasket first."},
  {s:"med",t:"Front wishbone bushes",d:"Wander and a knock over ridges."},
  {s:"low",t:"Pop-up lights if fitted on later related cars",d:"Slow lamps usually mean dry hinges, not a dead motor."}
 ],due:["Arch and sill repair proof","Front bushes","Coolant change"]},
{k:["toyota","celica"],y0:1985,y1:1989,name:"Toyota Celica T160 (1985-89)",engine:"1.6 / 2.0 petrol",
 faults:[
  {s:"high",t:"Front wings and slam panel",d:"The 4th-gen rusts at the wing-to-scuttle join."},
  {s:"high",t:"ST165 GT-Four if it is one",d:"Transfer box and turbo plumbing. Confirm it is a real GT-Four."},
  {s:"med",t:"Power-steering leaks",d:"Rack and high-pressure hose."},
  {s:"med",t:"Idle control / AFM",d:"Hunting idle after a hot soak."}
 ],due:["Wings and scuttle","PAS pipes","Cambelt if that engine uses one"]},
{k:["toyota","celica"],y0:1989,y1:1993,name:"Toyota Celica T180 (1989-93)",engine:"1.6 / 2.0 petrol",
 faults:[
  {s:"high",t:"Rear arches and fuel-filler surround",d:"Classic T180 rot."},
  {s:"med",t:"ST185 GT-Four turbo and viscous coupling",d:"Boost leaks and a binding 4WD system on neglected cars."},
  {s:"med",t:"Pop-up headlamp motors",d:"They seize. Work both lamps several times."},
  {s:"med",t:"ABS and rusty brake pipes",d:"Pipes along the floor."}
 ],due:["Arch repair","Brake pipes","Pop-up lamps working"]},
{k:["toyota","celica"],y0:1993,y1:1999,name:"Toyota Celica T200 (1993-99)",engine:"1.8 / 2.0 petrol",
 faults:[
  {s:"high",t:"Rear wheel arches",d:"Still the first place these rot."},
  {s:"med",t:"ST205 GT-Four if claimed",d:"Verify the engine code and history. Fakes exist."},
  {s:"med",t:"Electric hood / sunroof drains",d:"Water in the cabin."},
  {s:"low",t:"Age-hardened bushes",d:"Not expensive, but the car will feel sloppy until they are done."}
 ],due:["Rear arches","Drain tubes","Suspension bushes"]},
{k:["toyota","celica"],y0:1999,y1:2006,name:"Toyota Celica T230 (1999-2006)",engine:"1.8 VVT-i / VVTL-i petrol",
 faults:[
  {s:"high",t:"Oil use on early 140 VVT-i",d:"Pre-facelift 140 can drink a litre every 600 miles. Check the dipstick cold."},
  {s:"high",t:"VVTL-i lift on T-Sport 190",d:"From about 6200rpm it should pick up. If not, lift bolts or blocked filters."},
  {s:"med",t:"Rear subframe and brake pipes",d:"2000s UK cars still rot here. MOT favourite."},
  {s:"med",t:"Wheel bearings",d:"Rear hum is often a complete hub."},
  {s:"low",t:"Timing chain",d:"Chain engine. Regular oil matters more than a belt stamp."}
 ],due:["Regular oil-change proof","Rear subframe","T-Sport lift working if it is a 190"]}
]);

window.FAULT_ERA={
 pre92:{name:"Older car (about 1970-1991)",engine:"pre-cat / early-cat era",
  faults:[
   {s:"high",t:"Structural rust — sills, jacking points, floors",d:"Jacking points and inner sills first. A pretty wing means nothing if the sill is paper."},
   {s:"high",t:"Chassis rails, spring seats, subframe mounts",d:"Push on the spring seat. Flakes or holes here is a walk-away unless you want a welder."},
   {s:"high",t:"Brake pipes, flexi hoses and fuel lines",d:"Metal pipes rust along the floor. Rubber hoses perish even on a garage queen."},
   {s:"high",t:"Cooling system and head gasket",d:"Original radiators clog. White mayonnaise, sweet coolant smell, or a heater that never gets hot."},
   {s:"med",t:"Cambelt if it has one",d:"Plenty of 80s engines are belts at 40-60k or 4-5 years. No invoice = budget a kit before you drive it far."},
   {s:"med",t:"Carbs, vacuum pipes and idle",d:"Perished vacuum pipe is more common than a dead engine. Hunting idle, flat spots, black smoke."},
   {s:"med",t:"Steering joints and kingpins",d:"Jack a front wheel and rock it at 12/6 and 9/3. Play is a fail waiting to happen."},
   {s:"med",t:"Earths and a rotten fusebox",d:"Random dead lamps and a weak heater fan are usually brown earths, not a loom rewrite."},
   {s:"med",t:"Tyre age, not just tread",d:"Read the DOT date. A 15-year-old tyre with 6mm of tread is still scrap."},
   {s:"low",t:"Sunroof and heater matrix",d:"Wet carpets and a sweet mist on the screen."}
  ],
  due:["Brake pipes and flexis","Coolant and thermostat","Cambelt if belt-driven","Structural rust report","Fresh oil and filter"]},
 nineties:{name:"1990s car",engine:"early injection / early diesel",
  faults:[
   {s:"high",t:"Sills, arches and rear subframe",d:"1990s cars rust where you cannot see from a kerb. Rear beam and subframe mounts."},
   {s:"high",t:"Brake pipes and ABS rings",d:"Pipes along the floor; reluctor rings crack and upset ABS."},
   {s:"high",t:"Cambelt + water pump",d:"Most 90s petrol and diesel belts are due every 4-5 years whether it has covered 20k or 120k."},
   {s:"med",t:"Head gasket / oil cooler seals",d:"Mayo, milky oil, or a heater that never gets hot."},
   {s:"med",t:"Idle control, AFM / MAF, vacuum leaks",d:"A lumpy idle after a hot start is usually air leaks, not a rebuild."},
   {s:"med",t:"Early diesels: injector pump, glow plugs, leak-off pipes",d:"Hard cold starts and a rattle that will not quieten. No DPF on these — do not treat it like a 2012 TDI."},
   {s:"med",t:"Electric windows, sunroof drains, fusebox",d:"Water in the spare-wheel well is a blocked drain, not a mystery leak."},
   {s:"low",t:"Perished bushes and tired engine mounts",d:"Clunks over driveways. Cheap, but the test drive will feel sloppy until they are done."}
  ],
  due:["Cambelt kit + water pump","Brake pipes","Rear subframe rust check","Coolant change"]}
};

window.VIEW_CHECKS_CLASSIC=[
"Cold start. Blue smoke = oil, white that does not clear = head gasket, black = mixture / pump.",
"Leave it ticking over. Listen for chain rattle, a knocking bottom end, or a belt that sounds dry.",
"Heater must get properly hot. Lukewarm usually means a head gasket or a clogged radiator.",
"Oil cap and dipstick: no mayonnaise, no glitter, level not vanishingly low.",
"Jacking points, inner sills and spring seats with a screwdriver — gently. Flake is rust, hole is a project.",
"Brake pipes along the floor and into each arch. Flexi hoses should not be cracked.",
"Rock each wheel at 12 and 9 o'clock. Play is joints or a bearing.",
"Tyre wall DOT date. Over 10 years old is a no, even with tread left.",
"Carpets and spare well. Wet means drains or a screen leak.",
"Every lamp, heater fan, wiper and a clean cold-start. Random electrics are earths.",
"V5C name, VIN on the plate and the stamping, and a mileage that matches old MOTs.",
"Ask for cambelt invoice, welding invoices and who last welded the sills — not a verbal 'it's solid'."
];
