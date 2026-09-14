window.FAULTS=(window.FAULTS||[]).concat([
{k:["toyota","celica"],name:"Toyota Celica (T230, 1999-2006)",engine:"1.8 VVT-i / VVTL-i petrol",
 faults:[
  {s:"high",t:"Oil use on early 140 VVT-i",d:"Pre-facelift 1.8 140 can drink oil — a litre every 600 miles is quoted. Check the dipstick cold and look at the service file."},
  {s:"high",t:"VVTL-i lift on T-Sport 190",d:"From ~6200rpm it should pick up. If it does not, lift bolts or blocked filters are a known T-Sport fault."},
  {s:"med",t:"Rear subframe and underside rust",d:"2003 UK cars rot on the rear subframe, sills and brake pipes. This is an MOT favourite."},
  {s:"med",t:"Wheel bearings / brake pipes",d:"Rear hum is often a hub. Pipes corrode."},
  {s:"low",t:"Timing chain",d:"Chain engine if serviced. Fresh oil matters more than a belt change."}
 ],
 due:["Proof of regular oil changes","Rear subframe rust check","T-Sport lift working if it is a 190"]},
{k:["toyota","mr2"],name:"Toyota MR2",engine:"petrol",
 faults:[{s:"med",t:"Rear subframe rust / coolant pipes",d:"Mid-engine cars hide corrosion."},{s:"med",t:"Clutch and gear linkage",d:"Notchy shift on tired cables."}],due:["Underside rust","Coolant pipes"]},
{k:["toyota","supra"],name:"Toyota Supra",engine:"petrol",
 faults:[{s:"med",t:"Import history / rust",d:"Check the file and the arches."},{s:"med",t:"Turbo plumbing on 2JZ",d:"Boost leaks and tired hoses."}],due:["History file","Underside"]},
{k:["honda","integra"],name:"Honda Integra",engine:"petrol",
 faults:[{s:"med",t:"VTEC engagement / oil",d:"Must pick up cleanly."},{s:"med",t:"Rust and import paperwork",d:"Arches and a real V5."}],due:["Service file","Rust"]},
{k:["mazda","rx-8"],name:"Mazda RX-8",engine:"rotary petrol",
 faults:[{s:"high",t:"Compression / flood starts",d:"A compression test matters more than a polish."},{s:"high",t:"Apex seals and oil use",d:"These engines drink oil by design — and fail if starved."},{s:"med",t:"Coil packs / rust",d:"Misfire and rear arches."}],due:["Compression figures","Coil packs"]},
{k:["subaru","impreza"],name:"Subaru Impreza",engine:"boxer petrol",
 faults:[{s:"high",t:"Head gaskets / ring-land",d:"Coolant mayo and knock on tuned cars."},{s:"med",t:"Wheel bearings / rust",d:"UK roads."}],due:["Cooling system","Underside"]},
{k:["mitsubishi","evo"],name:"Mitsubishi Lancer Evo",engine:"petrol turbo",
 faults:[{s:"med",t:"Turbo / transfer box",d:"AWD clunks and boost leaks."},{s:"med",t:"Rust and import file",d:"Arches and a real history."}],due:["AWD oil","Rust"]},
{k:["nissan","skyline"],name:"Nissan Skyline",engine:"petrol",
 faults:[{s:"med",t:"Import history / rust",d:"File first."},{s:"med",t:"Turbo / ATTESA on GT-R",d:"AWD and boost leaks."}],due:["History","Underside"]},
{k:["bmw","e46"],name:"BMW 3 Series E46",engine:"petrol / diesel",
 faults:[{s:"high",t:"Rear subframe / rust",d:"A known E46 killer."},{s:"med",t:"Cooling system on petrols",d:"Water pump and radiator."}],due:["Subframe","Cooling system"]},
{k:["bmw","e36"],name:"BMW 3 Series E36",engine:"petrol / diesel",
 faults:[{s:"high",t:"Rust in sills and jacking points",d:"Walk away if rotten."},{s:"med",t:"Cooling system",d:"Age."}],due:["Rust","Coolant"]}
]);
