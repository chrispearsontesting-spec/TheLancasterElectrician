// Generator for garage/jobs-data.js. Family-class figures are the anchor; other classes derive from
// per-profile multipliers unless a job gives explicit overrides (o:{cls:[plo,phi,h]|null}).
const fs=require('fs');
const CL=['city','small','family','exec','premium','suv4x4','pickup','van','ev'];
const CLASSES=[
 {id:'city',label:'City car',examples:'Toyota Aygo, VW Up, Hyundai i10, Kia Picanto, Fiat 500'},
 {id:'small',label:'Small hatch',examples:'Ford Fiesta, Vauxhall Corsa, VW Polo, Toyota Yaris, Peugeot 208'},
 {id:'family',label:'Family car / crossover',examples:'Ford Focus, VW Golf, Skoda Octavia, Nissan Qashqai, Vauxhall Astra'},
 {id:'exec',label:'Executive',examples:'BMW 3 Series, Audi A4, Mercedes C-Class, Volvo S60/V60/XC60'},
 {id:'premium',label:'Premium / large luxury',examples:'BMW 5 Series, Mercedes E-Class, Range Rover, Volvo XC90, Porsche'},
 {id:'suv4x4',label:'SUV / 4x4',examples:'Ford Kuga, Hyundai Tucson, Toyota RAV4, Land Rover Discovery Sport'},
 {id:'pickup',label:'Pickup',examples:'Mitsubishi L200, Toyota Hilux, Ford Ranger, Nissan Navara'},
 {id:'van',label:'Van',examples:'Ford Transit/Transit Custom, Vauxhall Vivaro, Mercedes Sprinter, VW Transporter'},
 {id:'ev',label:'Electric car',examples:'Tesla Model 3/Y, VW ID.3, Nissan Leaf, Kia Niro EV, MG4'}];
// profile: [partsMult, hoursMult] per class
const PR={
 std:  {city:[.7,.85],small:[.8,.9],family:[1,1],exec:[1.4,1.2],premium:[1.9,1.4],suv4x4:[1.2,1.1],pickup:[1.25,1.15],van:[1.2,1.1],ev:[1.3,1]},
 serv: {city:[.75,.85],small:[.85,.9],family:[1,1],exec:[1.35,1.1],premium:[1.7,1.25],suv4x4:[1.15,1.05],pickup:[1.25,1.1],van:[1.25,1.1],ev:[.5,.6]},
 brake:{city:[.65,.9],small:[.8,.95],family:[1,1],exec:[1.4,1.1],premium:[2.1,1.25],suv4x4:[1.25,1.05],pickup:[1.2,1.1],van:[1.25,1.1],ev:[1.4,1.05]},
 susp: {city:[.7,.85],small:[.8,.9],family:[1,1],exec:[1.5,1.2],premium:[2.2,1.4],suv4x4:[1.3,1.15],pickup:[1.3,1.2],van:[1.25,1.1],ev:[1.5,1.1]},
 body: {city:[.7,.9],small:[.8,.95],family:[1,1],exec:[1.5,1.15],premium:[2.3,1.35],suv4x4:[1.3,1.1],pickup:[1.3,1.1],van:[1.15,1.05],ev:[1.6,1.15]},
 tyre: {city:[.6,1],small:[.75,1],family:[1,1],exec:[1.45,1],premium:[2.1,1.1],suv4x4:[1.4,1.05],pickup:[1.45,1.15],van:[1.3,1.1],ev:[1.5,1]},
 elec: {city:[.75,.85],small:[.85,.9],family:[1,1],exec:[1.5,1.25],premium:[2,1.5],suv4x4:[1.2,1.1],pickup:[1.15,1.1],van:[1.1,1.05],ev:[1.4,1.1]},
 eng:  {city:[.7,.8],small:[.8,.9],family:[1,1],exec:[1.4,1.3],premium:[1.9,1.6],suv4x4:[1.2,1.15],pickup:[1.3,1.2],van:[1.25,1.15],ev:null},
 dsl:  {city:null,small:[.85,.9],family:[1,1],exec:[1.35,1.25],premium:[1.8,1.5],suv4x4:[1.15,1.1],pickup:[1.2,1.15],van:[1.2,1.1],ev:null},
 pet:  {city:[.7,.8],small:[.8,.9],family:[1,1],exec:[1.4,1.3],premium:[1.9,1.6],suv4x4:[1.15,1.1],pickup:null,van:null,ev:null},
};
const r5=x=>Math.max(0,Math.round(x/5)*5), r1=x=>Math.round(x*10)/10;
const W=[];
// j(id,name,buy,cat,profile,[plo,phi],hrs,{diy,tools,interval,warn,note,o,fuel})
function j(id,name,buy,cat,pf,p,h,x){x=x||{};const cls={};const prof=PR[pf];
 CL.forEach(c=>{let v;if(x.o&&c in x.o){const o=x.o[c];v=o===null?null:{p:[o[0],o[1]],h:o[2]};}
  else{const m=prof[c];v=m?{p:[r5(p[0]*m[0]),r5(p[1]*m[0])],h:r1(h*m[1])}:null;}
  if(v===null&&x.na_ok!==false)cls[c]=null;else cls[c]=v;});
 if(x.fixed)CL.forEach(c=>{if(cls[c])cls[c]={p:x.fixed.slice(),h:0};});
 const f=cls.family||{p:x.fixed||p,h:x.fixed?0:h};
 const e={id,name,buy,cat,hrs:f.h,plo:f.p[0],phi:f.p[1],note:x.note||'',cls,diy:x.diy||{lvl:3,ok:true}};
 if(x.tools)e.tools=x.tools; if(x.interval)e.interval=x.interval; if(x.warn)e.warn=x.warn; if(x.fuel)e.fuel=x.fuel; if(x.fixed)e.fixed=x.fixed;
 W.push(e);}
const D=(lvl,ok)=>({lvl,ok});
const S='Servicing',ENG='Engine & timing',CG='Clutch & gearbox',DR='Driveline & 4x4',BR='Brakes',SU='Suspension & steering',EX='Exhaust & emissions',FU='Fuel & injection',IG='Ignition & sensors',CO='Cooling',EL='Electrical & starting',LI='Lighting',TY='Tyres & wheels',AC='Air con & heating',GL='Glass & wipers',BO='Body & panels',IN='Interior, locks & safety',HY='Hybrid & EV',MOT='MOT & checks';

// ---- MOT & checks
j('mot','MOT test','MOT',MOT,'std',[0,0],0,{fixed:[35,54.85],o:{city:[0,0,0],small:[0,0,0],family:[0,0,0],exec:[0,0,0],premium:[0,0,0],suv4x4:[0,0,0],pickup:[0,0,0],van:[0,0,0],ev:[0,0,0]},diy:D(5,false),interval:'Yearly from 3 years old',note:'Class 4 fee capped by DVSA at £54.85; many garages discount to £35-£45. Vans over 3,000kg are Class 7 (£58.60 cap).',warn:'Pickups/vans up to 3,000kg gross are Class 4.'});
j('diag','Diagnostic fault-code scan','diagnostic',MOT,'std',[0,0],0.75,{o:{premium:[0,0,1],exec:[0,0,1]},diy:D(1,true),tools:'OBD2 reader (£20+) for basic codes',note:'Typical garage charge £40-£80 (often 0.5-1 hr). Dealers charge ~1 hr at dealer rate.'});
j('mototest','MOT retest / pre-MOT check','pre MOT check',MOT,'std',[0,0],0.5,{diy:D(2,true),note:'Free retest within 10 working days if the car stays at the test centre.'});
j('health','Pre-purchase inspection','vehicle inspection',MOT,'std',[0,0],1.5,{diy:D(3,false),note:'AA/RAC inspections cost roughly £150-£250; a local independent 1-2 hrs.'});
// ---- Servicing
j('oil','Oil + filter change only','oil filter engine oil',S,'serv',[40,80],0.7,{diy:D(1,true),tools:'Filter wrench, drain pan, ramps/axle stands',interval:'Every 6-12k miles or 12 months',note:'Price-guide average ~£115 at a garage.',o:{ev:null},warn:'Use the exact oil spec (e.g. VW 504/507, Ford WSS-M2C948-B) — wrong oil kills wet belts and DPFs.'});
j('service','Interim service (oil + filter)','service kit',S,'serv',[40,95],1,{diy:D(2,true),interval:'Every 6k miles / 6 months (high mileage)',note:'Oil, filter, checks. Price guides: ~£140 typical (£85-£210).',o:{ev:[20,40,0.7]}});
j('full','Full service','full service kit',S,'serv',[70,160],1.5,{diy:D(2,true),interval:'Every 12k miles / 12 months',note:'Oil, oil/air/cabin filters, plugs or fuel filter as due. Price guides: ~£200 typical (£150-£280).',o:{ev:[25,60,1],van:[90,190,2.2],pickup:[90,190,2.2]},fuel:{diesel:{note:'Diesel fuel filter adds £15-£60 parts + 0.3-0.5 hr.'},hybrid:{note:'Hybrids: same engine items plus inverter coolant check; dealer hybrid service +£50-£100.'}}});
j('major','Major service','major service kit',S,'serv',[110,260],2.5,{diy:D(3,true),interval:'Every 24k miles / 2 years',note:'Full service plus plugs, fuel filter, brake fluid, coolant as due.',o:{ev:[40,100,1.5]}});
j('airfilter','Air filter','air filter',S,'serv',[8,30],0.3,{diy:D(1,true),interval:'Every 20-40k miles',o:{ev:null}});
j('cabin','Cabin / pollen filter','cabin filter',S,'serv',[8,35],0.3,{diy:D(1,true),interval:'Every 12k miles / 1 year',note:'Carbon or HEPA filters at the top end (Tesla HEPA ~£80+).',warn:'Behind the glovebox on most cars; under the scuttle on some Fords/VAG.'});
j('fuelfilter','Diesel fuel filter','diesel fuel filter',S,'dsl',[15,60],0.6,{diy:D(2,true),interval:'Every 20-40k miles / 2 years',warn:'Bleed the system afterwards; some Ford/PSA filters need priming bulbs.'});
j('coolant','Coolant flush + refill','antifreeze coolant',S,'serv',[15,40],0.6,{diy:D(2,true),interval:'Every 4-5 years (long-life OAT)',note:'Price guides ~£70 (£50-£90). EV coolant changes are dealer-priced (£200-£540 Renault list).',o:{ev:[30,80,1.5]},warn:'Never mix coolant colours/types (G12/G13 vs Ford/Toyota pink).'});
j('brakefluid','Brake fluid change','brake fluid',S,'brake',[8,18],0.6,{diy:D(2,true),tools:'Pressure bleeder; ABS pumps need a scan tool on some cars',interval:'Every 2 years',note:'Price guides ~£60 (£50-£85); dealer lists £90-£100.'});
j('gearbox','Gearbox oil change','gearbox oil',S,'std',[25,55],0.8,{diy:D(2,true),interval:'Manual: often “lifetime” — 60-100k miles is sensible',note:'Price guides ~£95 (£75-£130) for a manual.',o:{ev:[30,70,1]}});
j('dsg','DSG / auto gearbox service','DSG gearbox service kit',S,'std',[80,180],2,{diy:D(3,false),tools:'Scan tool for temperature-controlled fill level',interval:'DSG wet-clutch: every 40k miles; ZF 8HP: 60-80k miles',note:'Filter and oil. ZF 8-speed (BMW/JLR/Audi) kits with pan are £180-£350.',o:{city:[60,130,1.5],exec:[150,320,2.5],premium:[200,400,3],ev:null},warn:'Auto boxes must be filled at a set temperature — not a drain-and-guess job.'});
j('plugs','Spark plugs','spark plugs',S,'pet',[20,70],0.8,{diy:D(2,true),interval:'Every 36-60k miles / 4-6 years',note:'Price guides ~£120 per set fitted. Iridium/turbo plugs top end; V6/V8 or transverse V6 (rear bank) up to 3 hrs.',o:{premium:[60,180,2]},fuel:{hybrid:{note:'Hybrid plugs often 60-100k mile interval.'}}});
// ---- Engine & timing
j('beltwp','Timing belt + water pump','timing belt kit water pump',ENG,'eng',[90,220],3.5,{diy:D(5,false),tools:'Engine-specific locking tools',interval:'Typically 5-10 years / 60-120k miles (check maker)',warn:'Interference engines: a snapped belt usually wrecks the valves. Many cars use a chain instead — check before booking.',note:'FixMyCar avg £469 (Ford £438, BMW £540); OpenPrice £470 typical for a Focus-size car.',
 o:{city:[80,170,2.8],small:[80,180,3],exec:[130,280,4.5],premium:[160,380,6],suv4x4:[110,250,4],pickup:[120,260,4.8],van:[120,260,4.5]}});
j('belt','Timing belt only','timing belt kit',ENG,'eng',[90,200],3.5,{diy:D(5,false),tools:'Engine-specific locking tools',interval:'As timing belt + pump',warn:'Usually false economy not to do the pump if it is belt-driven.',o:{city:[80,160,2.8],small:[80,170,3],exec:[130,260,4.2],premium:[160,320,5.5],pickup:[110,230,4.6],van:[110,230,4.2]}});
j('wetbelt','Wet belt / belt-in-oil','wet belt kit',ENG,'eng',[180,420],8,{diy:D(5,false),tools:'Ford/PSA timing tools, sealant cure time',interval:'Ford 1.0 EcoBoost: 7-8 yrs/80k real-world; PSA 1.2 PureTech: ~6 yrs/60k',warn:'Ford 1.0 EcoBoost (pre-2018/19), 1.2 PureTech, 2.0 EcoBlue (Transit/Ranger). Belt debris blocks the oil pickup — oil starvation destroys the engine. Use the exact oil spec.',note:'Specialists: Ford 1.0 EcoBoost £850-£1,200 indie (fixed £1,100 Stevenage), £1,600-£2,000+ dealer; PureTech £750-£1,000; 2.0 EcoBlue £1,000-£1,400.',
 o:{city:null,small:[300,500,8],family:[300,550,8.5],exec:null,premium:null,suv4x4:[320,580,9.5],pickup:[300,600,10.5],van:[300,600,10.5]}});
j('chain','Timing chain kit','timing chain kit',ENG,'eng',[300,700],9,{diy:D(5,false),tools:'Locking tools; often engine/gearbox support',warn:'Rattle on cold start is the usual clue. Some BMW N47 diesels have the chain at the gearbox end — engine out.',note:'FixMyCar avg £1,023; OpenPrice £1,200 typical (£700-£2,000).',o:{city:[120,300,6],premium:[400,1000,14],exec:[300,700,11]}});
j('aux','Auxiliary belt + tensioner','auxiliary belt tensioner',ENG,'eng',[25,90],1.2,{diy:D(2,true),tools:'Tensioner tool',interval:'Every 60-80k miles or when cracked',o:{ev:null}});
j('headg','Head gasket','head gasket set',ENG,'eng',[80,250],12,{diy:D(5,false),warn:'Estimate only — head skim/pressure test and possible warpage add cost. Inspect first.',note:'Plus head skim £60-£150 machine shop.'});
j('rocker','Rocker cover gasket','rocker cover gasket',ENG,'eng',[10,40],1.2,{diy:D(2,true)});
j('sump','Sump gasket / sump','sump gasket',ENG,'eng',[15,80],2.5,{diy:D(3,true),note:'Subframe-drop on some cars.'});
j('pcv','PCV / oil separator','PCV valve',ENG,'eng',[25,120],1,{diy:D(3,true),warn:'Common on VAG 1.4 TSI / BMW N47 — whistle and oil leaks.'});
j('mount','Engine mount','engine mount',ENG,'eng',[30,120],1.4,{diy:D(3,true),tools:'Engine support bar',o:{ev:[60,180,1.5]}});
j('oilleak','Crank / cam oil seal','crankshaft oil seal',ENG,'eng',[10,40],2.5,{diy:D(4,false),note:'Front seals often done with the timing belt; rear main seal = gearbox off (clutch-level labour).'});
j('oilcool','Oil cooler / filter housing gasket','oil cooler gasket',ENG,'eng',[20,150],2.5,{diy:D(3,true),warn:'Classic leak on BMW N47/B47 and Vauxhall 1.4/1.6 — oil and coolant mixing.'});
j('carbonclean','Intake carbon clean (walnut blast)','walnut blasting',ENG,'pet',[20,40],2.5,{diy:D(4,false),interval:'Direct-injection petrols ~60-80k miles',warn:'Direct-injection petrols (VAG TSI, BMW N20, Ford EcoBoost) build carbon on the inlet valves.',note:'Specialist walnut blast typically £250-£450.'});
j('compression','Compression / leak-down test','compression test',ENG,'eng',[0,0],1,{diy:D(2,true),tools:'Compression gauge'});
// ---- Clutch & gearbox
j('clutch','Clutch kit','clutch kit',CG,'eng',[120,300],5,{diy:D(5,false),tools:'Gearbox jack, clutch alignment tool',interval:'Typically 60-120k miles',warn:'Dual-mass flywheel extra if worn — check before quoting.',note:'FixMyCar avg £671 (Aug 2025); BookMyGarage 2026 avg £586 (£278-£1,183); ClickMechanic Fiesta £450-£750, Golf £550-£900, 3 Series £700-£1,100.',
 o:{city:[100,220,4],small:[110,250,4.5],exec:[200,450,6.5],premium:[300,650,8],suv4x4:[180,400,6.5],pickup:[250,550,8],van:[220,480,6.5]}});
j('clutchdmf','Clutch + dual-mass flywheel','clutch kit dual mass flywheel',CG,'eng',[350,750],5.5,{diy:D(5,false),warn:'Common on diesels; judder or knock at idle means the DMF is going.',note:'FixMyCar avg £1,083 for clutch + DMF.',o:{city:null,small:[300,600,5],exec:[550,1100,7],premium:[700,1400,8.5],suv4x4:[500,950,7],pickup:[600,1200,8.5],van:[550,1100,7]}});
j('flywheel','Dual-mass flywheel only','dual mass flywheel',CG,'eng',[220,520],5,{diy:D(5,false),note:'Usually done with the clutch — fit a clutch at the same time.'});
j('slave','Clutch slave cylinder','clutch slave cylinder',CG,'eng',[30,90],1.5,{diy:D(3,true),warn:'Concentric (internal) slave cylinders need the gearbox off — clutch-level labour.'});
j('master','Clutch master cylinder','clutch master cylinder',CG,'eng',[30,90],1.5,{diy:D(3,true)});
j('clutchcable','Clutch cable','clutch cable',CG,'eng',[15,40],0.8,{diy:D(2,true),o:{exec:null,premium:null,pickup:null,van:null}});
j('gboxmount','Gearbox mount','gearbox mount',CG,'eng',[30,110],1.2,{diy:D(3,true)});
j('mechatronic','DSG mechatronic unit repair','DSG mechatronic',CG,'eng',[400,1200],4,{diy:D(5,false),warn:'VAG DQ200 7-speed dry DSG is the usual culprit; specialist repair/exchange often cheaper than dealer.',note:'Specialists ~£700-£1,500 exchange fitted; dealer £2,000+.',o:{city:null,small:[400,1100,4],pickup:null,van:null}});
j('gboxrecon','Gearbox replacement (recon)','reconditioned gearbox',CG,'eng',[500,1200],6,{diy:D(5,false),note:'Used/recon manual box; autos typically £1,500-£3,500.'});
j('gearlink','Gear linkage / selector cables','gear selector cable',CG,'eng',[30,120],1.5,{diy:D(3,true)});
// ---- Driveline & 4x4
j('shaft','Driveshaft (one side)','driveshaft',DR,'std',[90,240],2,{diy:D(3,true),tools:'Hub nut socket, ball-joint splitter',warn:'Clicking on full lock is the usual clue.',o:{ev:[150,400,2]}});
j('cvboot','CV gaiter','CV boot kit',DR,'std',[15,45],1.4,{diy:D(3,true),warn:'Split gaiter fails the MOT if grease is thrown.'});
j('cvjoint','Outer CV joint','CV joint',DR,'std',[30,90],1.8,{diy:D(3,true)});
j('propshaft','Propshaft centre bearing','propshaft centre bearing',DR,'std',[40,120],2,{diy:D(3,true),o:{city:null,small:null,family:[40,120,2],ev:null}});
j('uj','Propshaft universal joint','propshaft UJ',DR,'std',[20,60],1.5,{diy:D(3,true),o:{city:null,small:null,family:null,exec:[30,80,1.8],ev:null}});
j('haldex','Haldex / AWD coupling service','haldex filter oil',DR,'std',[40,110],1,{diy:D(3,true),interval:'Every 3 years / 40k miles',warn:'Worth doing on AWD Volvos, VAG 4Motion/quattro (transverse), Land Rover Freelander/Evoque/Disco Sport.',o:{city:null,small:null,pickup:null,van:null,ev:null}});
j('diffoil','Differential oil change','differential oil',DR,'std',[20,60],0.8,{diy:D(2,true),interval:'Every 40-60k miles (4x4s/pickups)',o:{city:null,small:null,family:null,ev:null}});
j('transfer','Transfer box oil','transfer box oil',DR,'std',[20,60],0.8,{diy:D(2,true),interval:'Every 40-60k miles',o:{city:null,small:null,family:null,exec:[20,60,0.8],ev:null}});
j('frontdiff','Front hub / freewheel actuator (4x4)','4wd actuator',DR,'std',[60,220],1.5,{diy:D(3,true),o:{city:null,small:null,family:null,exec:null,ev:null}});
// ---- Brakes
j('fpads','Front pads and discs','front brake pads discs',BR,'brake',[70,180],1.3,{diy:D(2,true),tools:'Piston wind-back tool, torque wrench',interval:'Pads 20-40k miles; discs every 2nd pad change',note:'BookMyGarage avg £278; OpenPrice £230 (£190-£290); Renault dealer list £365-£399.',
 o:{city:[50,110,1.2],small:[60,130,1.2],exec:[110,260,1.4],premium:[160,450,1.6],suv4x4:[90,230,1.4],pickup:[90,220,1.4],van:[100,240,1.4],ev:[110,280,1.4]}});
j('rpads','Rear pads and discs','rear brake pads discs',BR,'brake',[70,170],1.4,{diy:D(3,true),tools:'Rewind tool; scan tool for electric handbrake',warn:'Electric parking brakes need service mode via a scan tool.',note:'BookMyGarage avg £248.',o:{city:null,small:[55,130,1.3],pickup:null}});
j('pads','Front pads only','front brake pads',BR,'brake',[25,70],0.8,{diy:D(2,true),note:'OpenPrice £115 (£80-£150); AutoFixFair £80-£145 family hatch.'});
j('rearpads','Rear pads only','rear brake pads',BR,'brake',[20,60],0.8,{diy:D(2,true),warn:'Electric parking brake service mode needed on many cars.',note:'OpenPrice £100 (£70-£130).',o:{city:null,pickup:null}});
j('drums','Rear drums + shoes','brake drum shoes',BR,'brake',[50,130],1.5,{diy:D(3,true),note:'City/small cars and pickups/vans with drums.',o:{family:[50,130,1.5],exec:null,premium:null,suv4x4:null,ev:null,pickup:[80,180,1.8],van:[80,180,1.8]}});
j('caliper','Brake caliper (one)','brake caliper',BR,'brake',[50,160],1.4,{diy:D(3,true),note:'Includes bleed. Seized sliders are a cheaper fix (£30-£60 kit).'});
j('hoses','Brake hoses (pair)','brake hose',BR,'brake',[15,50],1.2,{diy:D(3,true)});
j('brakepipe','Brake pipe replacement','brake pipe',BR,'brake',[10,40],2,{diy:D(4,false),warn:'Corroded rear pipes are a common MOT fail on older UK cars; full re-pipe 4-6 hrs.'});
j('handbrake','Handbrake cable','handbrake cable',BR,'brake',[20,70],1.5,{diy:D(3,true),o:{ev:null}});
j('handbrakel','Electric handbrake motor','electric handbrake motor',BR,'brake',[80,260],1,{diy:D(3,true),tools:'Scan tool for EPB service mode',o:{city:null,pickup:null}});
j('abs','ABS sensor','ABS sensor',BR,'brake',[20,70],0.8,{diy:D(2,true)});
j('vacpump','Vacuum pump','brake vacuum pump',BR,'dsl',[80,220],1.8,{diy:D(3,true),note:'Mainly diesels and direct-injection petrols.'});
j('absmod','ABS pump / module','ABS module',BR,'brake',[150,480],2.5,{diy:D(4,false),warn:'Needs coding and bleed with scan tool. Module repair services £150-£300.'});
j('evbrakes','EV/hybrid brake service (clean + lube)','brake service kit',BR,'brake',[10,30],1.2,{diy:D(2,true),interval:'Yearly on EVs/hybrids — calipers seize from lack of use',o:{city:null,small:null,family:[10,30,1.2],exec:[10,30,1.3],premium:[10,30,1.5],suv4x4:[10,30,1.3],pickup:null,van:null,ev:[10,30,1.2]}});
// ---- Suspension & steering
j('damp','Pair of front dampers','shock absorbers',SU,'susp',[80,200],1.5,{diy:D(3,true),tools:'Spring compressors',note:'OpenPrice front pair £235 (£180-£320). Rear pair usually cheaper.',warn:'Air springs are a separate, dearer job.'});
j('rdamp','Pair of rear dampers','rear shock absorbers',SU,'susp',[60,180],1.2,{diy:D(2,true)});
j('spring','Coil spring (one)','coil spring',SU,'susp',[40,120],1.3,{diy:D(3,true),tools:'Spring compressors',note:'Front coil spring pair ~£284 avg (FixMyCar); OpenPrice per axle £320.',warn:'Broken springs are common on UK roads — replace in pairs.'});
j('topmount','Strut top mount','strut top mount',SU,'susp',[20,80],1.5,{diy:D(3,true)});
j('leaf','Leaf spring (one)','leaf spring',SU,'susp',[120,280],2,{diy:D(4,false),o:{city:null,small:null,family:null,exec:null,premium:null,suv4x4:null,ev:null,pickup:[120,280,2.2],van:[120,300,2]},warn:'Rear leaf springs on Hilux/Navara/L200/Transit corrode and snap; chassis rust on Navara D40/Hilux is a known issue.'});
j('bearing','Wheel bearing (one)','wheel bearing',SU,'susp',[35,120],1.8,{diy:D(3,true),tools:'Press or bearing puller kit',warn:'Growl that rises with speed.',note:'OpenPrice £200 per wheel (£100-£300).'});
j('hub','Wheel hub assembly','wheel hub',SU,'susp',[50,160],1.2,{diy:D(2,true)});
j('drop','Anti-roll drop link','drop link',SU,'susp',[10,35],0.6,{diy:D(2,true),warn:'Clunk over bumps.'});
j('arbbush','Anti-roll bar bushes','anti roll bar bush',SU,'susp',[10,40],1,{diy:D(2,true)});
j('track','Track-rod end','track rod end',SU,'susp',[15,45],0.8,{diy:D(2,true),warn:'Needs a tracking check afterwards.'});
j('innertrack','Inner track rod / rack end','inner tie rod',SU,'susp',[20,60],1.2,{diy:D(3,true)});
j('rack','Steering rack','steering rack',SU,'susp',[180,480],4,{diy:D(4,false),note:'Electric racks (EPAS) are dearer and may need coding.'});
j('pspump','Power steering pump','power steering pump',SU,'susp',[90,260],2,{diy:D(3,true),o:{ev:null,city:null}});
j('wishbone','Wishbone / lower arm','wishbone',SU,'susp',[50,180],1.5,{diy:D(3,true)});
j('balljoint','Ball joint','ball joint',SU,'susp',[20,70],1.2,{diy:D(3,true)});
j('bush','Control arm bushes','control arm bushes',SU,'susp',[20,80],2,{diy:D(4,false),tools:'Press'});
j('subframe','Subframe / chassis rust repair','subframe',SU,'susp',[150,500],6,{diy:D(5,false),warn:'Rear subframes rot on many older cars; Hilux/Navara chassis rot can write the vehicle off.'});
j('tracking','Front tracking (2-wheel)','wheel alignment',SU,'tyre',[0,0],0.5,{diy:D(5,false),note:'Typical £30-£50.'});
j('align','Four-wheel alignment','4 wheel alignment',SU,'tyre',[0,0],1,{diy:D(5,false),note:'OpenPrice £80 typical (£45-£150).'});
j('dampair','Air suspension bag','air suspension bag',SU,'susp',[120,350],2,{diy:D(3,true),warn:'Range Rover/Discovery/Audi/Merc Airmatic. Do pairs; compressor often fails after a leak.',o:{city:null,small:null,family:null,pickup:null}});
j('compair','Air suspension compressor','air suspension compressor',SU,'susp',[180,480],2,{diy:D(3,true),o:{city:null,small:null,family:null,pickup:null}});
// ---- Exhaust & emissions
j('exhaust','Centre exhaust section','exhaust centre section',EX,'eng',[60,180],1.2,{diy:D(2,true)});
j('backbox','Exhaust back box','exhaust back box',EX,'eng',[60,170],0.8,{diy:D(2,true),note:'OpenPrice £185 fitted (£100-£280) Focus-size.'});
j('catback','Full cat-back exhaust','exhaust system',EX,'eng',[200,500],2.2,{diy:D(3,true),note:'OpenPrice £525 typical (£350-£800).'});
j('downpipe','Downpipe','exhaust downpipe',EX,'eng',[80,260],1.8,{diy:D(3,true)});
j('flexi','Exhaust flexi pipe','exhaust flexi pipe',EX,'eng',[25,80],1.2,{diy:D(3,false),note:'Often welded in — exhaust centre job.'});
j('manifold','Exhaust manifold','exhaust manifold',EX,'eng',[80,260],3,{diy:D(4,false),warn:'Seized studs can double the time.'});
j('cat','Catalytic converter','catalytic converter',EX,'eng',[180,520],1.8,{diy:D(3,false),warn:'Theft target (Prius, Jazz, Auris hybrids especially) — fit a cat lock.',note:'OpenPrice £425 typical (£200-£700). OE cats on hybrids £1,000+.',fuel:{hybrid:{p:[400,1400]}}});
j('lambda','Lambda sensor','lambda sensor',EX,'eng',[40,140],0.9,{diy:D(2,true),tools:'Lambda socket'});
j('dpf','DPF clean','DPF clean',EX,'dsl',[0,0],2,{diy:D(3,false),note:'On-car forced regen £90-£150; off-car clean £200-£350 (DPFGuide 2025). FixMyCar avg £227.50; OpenPrice £250 typical.',warn:'Find out why it blocked (short trips, EGR, injectors, sensor) or it will block again.',fixed:[90,350]});
j('dpfr','DPF replacement','DPF diesel particulate filter',EX,'dsl',[350,900],2.5,{diy:D(3,false),note:'Aftermarket £400-£900; OE £1,000-£3,500. Removal is illegal and an MOT fail.',o:{premium:[800,2500,4],exec:[500,1500,3]}});
j('dpfsensor','DPF pressure sensor','DPF differential pressure sensor',EX,'dsl',[25,90],0.6,{diy:D(2,true)});
j('egt','Exhaust gas temperature sensor','EGT sensor',EX,'dsl',[30,100],0.8,{diy:D(2,true)});
j('egr','EGR valve','EGR valve',EX,'eng',[80,260],2,{diy:D(3,true),note:'OpenPrice £372 typical (£250-£500). Diesels mainly.',o:{city:null}});
j('egrcool','EGR cooler','EGR cooler',EX,'dsl',[120,320],3,{diy:D(4,false),warn:'BMW EGR cooler recall (N47/B47) — check if done.'});
j('adbluepump','AdBlue pump / module','AdBlue pump',EX,'dsl',[200,550],2.5,{diy:D(4,false),note:'Indie £600-£900, dealer £900-£1,500+ (ifixadblue). Often the whole tank/pump assembly on Peugeot/Citroen/Vauxhall.',warn:'AdBlue faults lead to a countdown to no-start. PSA BlueHDi tanks are a known failure.',o:{small:[250,600,2.5],van:[250,650,3]}});
j('adblueheater','AdBlue heater / level sensor','AdBlue heater',EX,'dsl',[80,250],1.5,{diy:D(3,false),note:'£200-£400 fitted typical.'});
j('adblueinj','AdBlue injector','AdBlue injector',EX,'dsl',[80,280],1.2,{diy:D(3,false),note:'£250-£500 fitted typical.'});
j('nox','NOx sensor','NOx sensor',EX,'dsl',[120,350],1,{diy:D(2,true),note:'£300-£700 fitted typical; OE sensors dear.'});
j('swirl','Swirl flaps / inlet clean','inlet manifold swirl flap',EX,'dsl',[50,250],3,{diy:D(4,false),warn:'BMW M47/M57 and some Vauxhall diesels: flaps can break off into the engine.'});
// ---- Fuel & injection
j('injector','Injector (one)','fuel injector',FU,'eng',[90,280],1.4,{diy:D(3,false),tools:'Injector puller; coding scan tool',warn:'Diesel injectors need coding (IMA/QR code) to the ECU.',fuel:{diesel:{p:[150,450],h:1.8,note:'Diesel common-rail: recon £150-£250, new £300-£450 each; seized injectors add hours.'},petrol:{p:[60,200],h:1}}});
j('glow','Glow plugs (set)','glow plugs',FU,'dsl',[40,120],1.2,{diy:D(3,false),warn:'Snapped glow plugs mean head drilling (£200-£600 extra). Warm the engine and use torque limits.'});
j('hpump','High pressure fuel pump','high pressure fuel pump',FU,'eng',[180,480],3,{diy:D(4,false),fuel:{diesel:{p:[300,800],h:3.5,note:'Bosch CP4 failures contaminate the whole system — injectors + rail too.'}}});
j('fuelpump','In-tank fuel pump','fuel pump',FU,'eng',[80,220],1.8,{diy:D(3,true),warn:'Under the rear seat on many cars; tank drop on others (pickups/vans).'});
j('throttle','Throttle body','throttle body',FU,'eng',[80,260],1.2,{diy:D(2,true),note:'Often just needs a clean and relearn.'});
j('inlet','Inlet manifold','inlet manifold',FU,'eng',[80,260],3,{diy:D(4,false)});
j('maf','MAF sensor','MAF sensor',FU,'eng',[50,180],0.5,{diy:D(1,true)});
j('map','MAP sensor','MAP sensor',FU,'eng',[30,90],0.5,{diy:D(1,true)});
j('turbo','Turbocharger','turbocharger',FU,'eng',[350,900],4.5,{diy:D(4,false),warn:'Replace oil feed pipe and filters, find the cause (oil starvation, DPF back-pressure).',note:'OpenPrice £1,000 typical (£500-£1,500).'});
j('turboact','Turbo actuator / boost solenoid','turbo actuator',FU,'eng',[40,300],1.5,{diy:D(3,true)});
j('inter','Intercooler','intercooler',FU,'eng',[80,260],1.8,{diy:D(3,true)});
j('boostpipe','Turbo / intercooler hose','intercooler hose',FU,'eng',[20,80],0.8,{diy:D(2,true)});
// ---- Ignition & sensors
j('coil','Coil pack','ignition coil',IG,'pet',[25,90],0.6,{diy:D(1,true),warn:'Misfire on one cylinder — swap coils to confirm before buying.'});
j('cam','Camshaft sensor','camshaft sensor',IG,'eng',[20,70],0.6,{diy:D(2,true)});
j('crank','Crankshaft sensor','crankshaft sensor',IG,'eng',[20,80],0.8,{diy:D(2,true)});
j('tstatsw','Coolant temperature sensor','coolant temperature sensor',IG,'eng',[10,40],0.6,{diy:D(2,true)});
j('oilpsw','Oil pressure switch','oil pressure switch',IG,'eng',[10,35],0.6,{diy:D(2,true)});
// ---- Cooling
j('thermo','Thermostat','thermostat',CO,'eng',[20,70],1.6,{diy:D(3,true)});
j('thermostath','Thermostat housing','thermostat housing',CO,'eng',[25,90],1.8,{diy:D(3,true),warn:'Plastic housings crack on VAG/BMW/Vauxhall.'});
j('rad','Radiator','radiator',CO,'std',[70,220],2,{diy:D(3,true)});
j('radfan','Radiator fan','radiator fan',CO,'std',[50,160],1.4,{diy:D(2,true)});
j('wpump','Water pump only','water pump',CO,'eng',[40,140],2.5,{diy:D(3,false),note:'OpenPrice £265 (£200-£370) Focus-size, done on its own. If belt-driven, do it with the cambelt.',fuel:{hybrid:{p:[150,450],note:'Electric pumps on hybrids/modern petrols: £300-£800 fitted.'}}});
j('hose','Coolant hose','coolant hose',CO,'std',[10,40],0.8,{diy:D(2,true)});
j('exp','Expansion tank','expansion tank',CO,'std',[20,70],0.8,{diy:D(2,true)});
// ---- Electrical & starting
j('batt','Battery','car battery',EL,'elec',[80,200],0.4,{diy:D(1,true),interval:'Typically 4-6 years',warn:'Stop-start cars need AGM/EFB and often battery registration (BMW, VAG, Ford).',note:'FixMyCar avg £227; OpenPrice £150 (£90-£400).',o:{city:[60,120,0.3],exec:[150,280,0.7],premium:[180,350,0.8],pickup:[100,200,0.4],van:[100,220,0.4],ev:[90,200,0.5]}});
j('alt','Alternator','alternator',EL,'eng',[180,450],2.2,{diy:D(3,true),note:'FixMyCar avg £527; OpenPrice £535 (£250-£750). Recon units at the low end.'});
j('start','Starter motor','starter motor',EL,'eng',[110,300],2,{diy:D(3,true),note:'FixMyCar avg £387; OpenPrice £250 (£135-£405).'});
j('glowrelay','Glow plug relay / module','glow plug relay',EL,'dsl',[30,120],0.6,{diy:D(2,true)});
j('ecu','ECU repair / swap','engine ECU',EL,'elec',[150,600],2,{diy:D(4,false),note:'Coding/immobiliser matching extra.'});
j('horn','Horn','car horn',EL,'elec',[10,40],0.5,{diy:D(1,true)});
j('washer','Washer pump','washer pump',EL,'elec',[8,30],0.6,{diy:D(2,true)});
j('windowreg','Window regulator','window regulator',EL,'body',[40,140],1.4,{diy:D(3,true)});
j('windowsw','Window switch','window switch',EL,'elec',[20,80],0.5,{diy:D(1,true)});
j('switch','Light switch','headlight switch',EL,'elec',[20,80],0.6,{diy:D(2,true)});
j('indicatorstk','Indicator stalk','indicator stalk',EL,'elec',[25,90],0.8,{diy:D(3,true)});
j('airbag','Clock spring / airbag squib','clock spring',EL,'elec',[30,120],1.2,{diy:D(4,false),warn:'Airbag work — disconnect battery and wait; MOT fail if the airbag light is on.'});
j('sensorp','Parking sensor','parking sensor',EL,'elec',[15,60],0.5,{diy:D(2,true)});
j('camera','Reversing camera','reversing camera',EL,'elec',[40,160],1,{diy:D(3,true)});
j('parasitic','Battery drain fault-finding','auto electrician',EL,'elec',[0,0],1.5,{diy:D(3,true),tools:'Multimeter / clamp meter'});
// ---- Lighting
j('headlight','Headlight unit','headlight',LI,'body',[80,350],1,{diy:D(2,true),warn:'LED/matrix units are £600-£1,500+ on exec/premium.',o:{exec:[150,700,1.2],premium:[250,1500,1.5]}});
j('taillight','Rear light cluster','rear light cluster',LI,'body',[40,180],0.6,{diy:D(1,true)});
j('fog','Fog light','fog light',LI,'body',[15,70],0.4,{diy:D(1,true)});
j('indicator','Indicator / repeater','indicator lamp',LI,'body',[8,40],0.3,{diy:D(1,true)});
j('bulb','Headlight bulb','headlight bulb',LI,'elec',[8,35],0.4,{diy:D(1,true),warn:'Some cars (e.g. Qashqai, Focus Mk3) need the bumper or arch liner off.'});
j('hid','Xenon / HID bulb','xenon hid bulb',LI,'elec',[30,90],0.5,{diy:D(2,true),o:{city:null}});
j('ballast','HID ballast','HID ballast',LI,'elec',[40,140],0.8,{diy:D(2,true),o:{city:null}});
j('numberplate','Number plate light','number plate light',LI,'elec',[5,20],0.3,{diy:D(1,true)});
j('lightresto','Headlight lens restoration','headlight restoration kit',LI,'body',[10,25],0.8,{diy:D(1,true),note:'Cloudy lenses can fail the MOT beam test.'});
// ---- Tyres & wheels
j('tyres2','Two tyres fitted','car tyres',TY,'tyre',[140,320],0.6,{diy:D(5,false),note:'Budget to mid-range pair, fitted. Fitting ~£15-£30/tyre (OpenPrice).',interval:'Legal minimum 1.6mm; replace ~3mm',o:{city:[90,180,0.6],small:[110,240,0.6],exec:[220,480,0.6],premium:[300,700,0.7],suv4x4:[200,440,0.7],pickup:[220,480,0.7],van:[180,380,0.7],ev:[220,500,0.6]},warn:'EVs wear tyres faster and need XL-load ratings.'});
j('tyres4','Four tyres fitted','car tyres',TY,'tyre',[280,640],1,{diy:D(5,false),note:'Budget to mid-range set, fitted.',o:{city:[180,360,1],small:[220,480,1],exec:[440,960,1],premium:[600,1400,1.2],suv4x4:[400,880,1.2],pickup:[440,960,1.2],van:[360,760,1.2],ev:[440,1000,1]}});
j('puncture','Puncture repair','puncture repair',TY,'tyre',[15,35],0,{diy:D(5,false),note:'FixMyCar avg £23. Run-flats usually cannot be repaired.',o:{city:[15,35,0],small:[15,35,0],family:[15,35,0],exec:[15,35,0],premium:[20,40,0],suv4x4:[15,35,0],pickup:[15,35,0],van:[15,35,0],ev:[20,40,0]}});
j('tpms','TPMS sensor','TPMS sensor',TY,'tyre',[25,70],0.5,{diy:D(4,false),tools:'TPMS programming tool',o:{city:null}});
j('alloyrefurb','Alloy wheel refurb (one)','alloy wheel refurbishment',TY,'tyre',[0,0],0,{diy:D(4,false),note:'OpenPrice £80 typical (£65-£100) per wheel; diamond-cut dearer.',fixed:[65,100]});
j('locknut','Locking wheel nut removal','locking wheel nut removal',TY,'tyre',[0,15],0.5,{diy:D(3,false)});
// ---- Air con & heating
j('acregas','Air-con re-gas','air con re gas',AC,'std',[20,45],0.5,{diy:D(5,false),note:'OpenPrice £70 (£50-£90). R1234yf cars (most 2017+) cost £80-£150.',warn:'Leak find is extra if it will not hold gas.',o:{ev:[50,120,0.6],exec:[40,110,0.6],premium:[50,130,0.6]}});
j('accomp','Air-con compressor','air con compressor',AC,'std',[180,480],3,{diy:D(4,false),o:{ev:[500,1500,3.5]}});
j('radiatorc','Air-con condenser','air con condenser',AC,'std',[70,220],1.8,{diy:D(3,false)});
j('acleak','Air-con leak test (UV dye)','air con leak test',AC,'std',[10,20],1,{diy:D(5,false)});
j('heater','Heater matrix','heater matrix',AC,'std',[40,140],6,{diy:D(4,false),warn:'Dash-out on many cars (up to 10+ hrs on premium).'});
j('blower','Blower motor / resistor','heater blower resistor',AC,'elec',[20,120],0.8,{diy:D(2,true),warn:'Fan only on max speed = resistor.'});
j('heatpump','EV heat pump / coolant valve','heat pump valve',AC,'std',[150,600],2,{diy:D(5,false),o:{city:null,small:null,family:null,exec:null,premium:null,suv4x4:null,pickup:null,van:null,ev:[150,600,2]},warn:'Model-specific (Tesla octovalve, Kia/Hyundai) — dealer or EV specialist.'});
// ---- Glass & wipers
j('windscreen','Windscreen','windscreen',GL,'body',[180,450],1.5,{diy:D(5,false),note:'OpenPrice £450 typical (£300-£700). Often claimed on glass insurance (excess £75-£125).',warn:'Cars with lane-keep/AEB cameras need ADAS calibration (£100-£250).'});
j('adas','ADAS camera calibration','ADAS calibration',GL,'std',[0,0],1,{diy:D(5,false),fixed:[100,250],note:'Static or dynamic calibration after a screen, alignment or bumper job.'});
j('chip','Windscreen chip repair','windscreen chip repair',GL,'std',[0,0],0,{diy:D(2,true),fixed:[40,80],note:'Often free on comprehensive cover.'});
j('rearglass','Rear screen','rear windscreen',GL,'body',[140,420],2,{diy:D(5,false)});
j('sideglass','Door window glass','door glass',GL,'body',[50,180],1.2,{diy:D(3,true)});
j('wipers','Wiper blades (pair)','wiper blades',GL,'std',[12,40],0.2,{diy:D(1,true),interval:'Every 12 months'});
j('wipermotor','Wiper motor','wiper motor',GL,'elec',[40,140],1.2,{diy:D(3,true)});
j('wiperlink','Wiper linkage','wiper linkage',GL,'elec',[30,110],1.2,{diy:D(3,true)});
// ---- Body & panels
j('wing','Front wing','front wing',BO,'body',[80,280],2,{diy:D(3,true),note:'Paint extra unless supplied painted (panel respray £150-£500).'});
j('wingr','Rear wing / quarter','rear wing',BO,'body',[150,450],4,{diy:D(5,false),note:'Welded panel — bodyshop job.'});
j('bonnet','Bonnet','bonnet',BO,'body',[120,380],1.5,{diy:D(3,true),note:'Paint extra unless supplied painted.'});
j('bootlid','Boot lid / tailgate','boot lid',BO,'body',[150,480],2,{diy:D(3,true)});
j('door','Door shell','car door',BO,'body',[150,480],2.5,{diy:D(4,false)});
j('bumperf','Front bumper','front bumper',BO,'body',[80,280],1.5,{diy:D(3,true),note:'Parking sensors/radar extra; paint extra.'});
j('bumperr','Rear bumper','rear bumper',BO,'body',[80,280],1.5,{diy:D(3,true)});
j('respray','Panel respray (one)','panel respray',BO,'body',[0,0],0,{diy:D(5,false),fixed:[150,500],note:'OpenPrice £300 typical (£150-£500). Metallic/pearl at top end.'});
j('smart','Bumper scuff SMART repair','bumper scuff repair',BO,'body',[0,0],0,{diy:D(4,false),fixed:[120,230],note:'OpenPrice £160 typical.'});
j('dent','Paintless dent removal','paintless dent repair',BO,'body',[0,0],0,{diy:D(4,false),fixed:[60,150]});
j('grille','Front grille','front grille',BO,'body',[30,140],0.6,{diy:D(2,true)});
j('arch','Wheel arch liner','wheel arch liner',BO,'body',[15,50],0.6,{diy:D(1,true)});
j('sill','Sill repair','sill panel',BO,'body',[40,160],4,{diy:D(4,false),warn:'Structural rust within 30cm of seat-belt/suspension mounts is an MOT fail. Bodyshop hours vary a lot.'});
j('mirror','Door mirror','door mirror',BO,'body',[70,220],0.6,{diy:D(2,true),note:'OpenPrice £200 typical fitted (£150-£260) heated electric unit.'});
j('mirrorg','Door mirror glass','door mirror glass',BO,'body',[10,40],0.3,{diy:D(1,true)});
j('bootstrut','Boot strut (pair)','boot strut',BO,'body',[20,60],0.3,{diy:D(1,true)});
j('bonnetstrut','Bonnet strut (pair)','bonnet strut',BO,'body',[15,50],0.3,{diy:D(1,true)});
j('underbody','Underbody wax / rust protection','underbody protection',BO,'body',[0,0],0,{diy:D(3,true),fixed:[150,600],note:'Worth it on pickups/4x4s used on salted northern roads.'});
// ---- Interior, locks & safety
j('handle','Door handle','door handle',IN,'body',[20,90],0.8,{diy:D(2,true)});
j('lock','Door lock actuator','door lock actuator',IN,'body',[40,140],1.2,{diy:D(3,true)});
j('key','Spare key / fob','car key fob',IN,'elec',[80,280],1,{diy:D(4,false),note:'Locksmith £100-£250 programmed; dealer £200-£500+ (BMW/Merc/Land Rover).',o:{premium:[200,500,1]}});
j('keybatt','Key fob battery','key fob battery',IN,'elec',[3,8],0.1,{diy:D(1,true)});
j('lockset','Ignition barrel','ignition barrel',IN,'elec',[40,140],1.5,{diy:D(3,false),o:{ev:null}});
j('seatbelt','Seatbelt','seatbelt',IN,'body',[40,140],1,{diy:D(3,true)});
// ---- Hybrid & EV
j('hv12v','12V battery (hybrid/EV)','12v auxiliary battery',HY,'elec',[90,200],0.5,{diy:D(2,true),note:'Renault dealer list: hybrid 12V £299-£340, EV £165-£210.',warn:'A flat 12V stops an EV or hybrid booting even with a full HV pack.',o:{city:null,pickup:null,van:null}});
j('hvcheck','HV battery health check','EV battery health check',HY,'std',[0,0],1,{diy:D(5,false),o:{pickup:null,van:null},note:'Independent EV specialists £60-£150.'});
j('hybridbatt','Hybrid battery recondition / replace','hybrid battery',HY,'std',[800,2500],3,{diy:D(5,false),o:{city:null,pickup:null,van:null,ev:null},warn:'Toyota Hybrid Service extends HV battery warranty to 15 years. Recon cells cheaper.',note:'Toyota Prius/Auris recon ~£1,000-£1,500 fitted; new OE £2,000-£3,500.'});
j('evmodule','EV battery module repair','EV battery module',HY,'std',[0,0],0,{diy:D(5,false),fixed:[1500,6000],o:{city:null,small:null,family:null,exec:null,premium:null,suv4x4:null,pickup:null,van:null,ev:[0,0,0]},note:'Module-level repair at an EV specialist; full pack replacement £5,000-£15,000+.'});
j('chargeport','Charge port / socket','charge port',HY,'std',[100,400],1.5,{diy:D(5,false),o:{city:null,small:null,family:null,exec:null,premium:null,suv4x4:null,pickup:null,van:null,ev:[100,400,1.5]}});
j('obc','On-board charger','on board charger',HY,'std',[500,1500],3,{diy:D(5,false),o:{city:null,small:null,family:null,exec:null,premium:null,suv4x4:null,pickup:null,van:null,ev:[500,1500,3]},warn:'Leaf/Ioniq OBC failures known; HV-qualified tech only.'});
j('inverterc','Inverter coolant change (hybrid)','inverter coolant',HY,'std',[20,50],1,{diy:D(3,false),interval:'Toyota: ~100k miles / 10 years',o:{city:null,pickup:null,van:null}});
j('evservice','EV service','EV service',HY,'std',[20,60],1,{diy:D(2,true),interval:'Every 1-2 years',note:'Cabin filter, brake check, fluid, tyres. Renault dealer list £160-£260.',o:{city:null,small:null,family:null,exec:null,premium:null,suv4x4:null,pickup:null,van:null,ev:[20,60,1]}});
const MODELS=[
 {id:'volvo-xc60-d5-2008-2017',match:['XC60'],years:[2008,2017],fuel:'diesel',cls:'exec',label:'Volvo XC60 Mk1 2.4 D5 / D4 / D3 (5-cyl D5244)',
  facts:{timing:'Belt (drives the water pump). Volvo interval 108,000 miles / 10 years; auxiliary belt 54,000 miles (post-2007).',tyres:'235/65 R17 (SE) or 235/60 R18 (R-Design); 20in on some.',brakes:'Front discs 328mm on 17in brakes.',gearbox:'Mostly Aisin TF-80SC 6-speed auto (AWD); 6-speed manual with DMF on some.'},
  jobs:{beltwp:{gbp:[400,575],src:'Volvo Owners Club: indie ~£400 genuine parts; dealer £555-£575; genuine kit ~£178; Haynes 5-6 h with pump',warn:'Change aux belts, tensioner and idlers with it — a failed aux belt/AC pulley can be dragged into the cambelt and wreck the engine.'},
   aux:{gbp:[100,200],src:'Volvo Owners Club (dealer ~£100 aux belt)',warn:'D5 aux belt/tensioner every 54k miles; AC compressor pulley bearing is a known failure.'},
   swirl:{warn:'P2015 swirl-flap linkage/actuator failure is common (link or kit repair).'},
   egr:{warn:'EGR valve/cooler soot clogging.'},
   dpf:{warn:'Short-trip D5s block the DPF and dilute the oil — watch for the oil level rising.'},
   dsg:{warn:'TF-80SC auto: fluid change ~60k miles is cheap insurance (Volvo says lifetime).'},
   haldex:{warn:'AWD Haldex: oil, filter and pump service every ~3 years; pump failure = FWD only.'},
   glow:{warn:'Glow plugs seize if never changed — warm engine, torque-limited removal.'},
   injector:{warn:'Injector seals leak (chuffing/tar); new seals and coding.'}}},
 {id:'mitsubishi-l200-kb-2006-2015',match:['L200'],years:[2006,2015],fuel:'diesel',cls:'pickup',label:'Mitsubishi L200 Series 4 (KB4T) 2.5 DI-D 4D56',
  facts:{timing:'Cam belt + balancer-shaft belt, hydraulic tensioner. Interference. Common advice 62,500 miles / 5 years; replace both belts, tensioner, idlers and water pump.',tyres:'245/70 R16 most trims; 205 R16C on 4Work.',brakes:'Front vented discs, rear drums.'},
  jobs:{beltwp:{gbp:[346,701],src:'Fixter L200 2.5 timing belt £346-£701, 4h45-5h20 labour; GetCarWise £400-£600'},
   clutch:{gbp:[677,1403],src:'Fixter L200 clutch kit £677-£1,403 (2.5 models £763-£1,245)',warn:'DMF often worn by ~80k miles — judder/rattle means price the DMF too.'},
   injector:{warn:'Denso injectors: code to ECU (MUT-III), renew seals; replace weak ones after a back-leak test.'},
   leaf:{warn:'Rear leaf springs crack/fracture (GetCarWise £300-£500).'},
   subframe:{warn:'Check chassis rails and rear spring hangers for rot.'},
   drums:{warn:'Rear drums/handbrake seize — common MOT advisory.'},
   frontdiff:{warn:'Front diff seal leaks and transfer case bearing whine are known.'}}},
 {id:'mitsubishi-l200-kl-2015-2019',match:['L200'],years:[2015,2019],fuel:'diesel',cls:'pickup',label:'Mitsubishi L200 Series 5 (KL) 2.4 DI-D 4N15',
  facts:{timing:'Timing chain — no belt interval.',tyres:'245/65 R17 or 205 R16C.',brakes:'Front discs, rear drums.'},
  jobs:{chain:{warn:'Listen for cold-start rattle on high mileage.'},dpf:{warn:'DPF fitted; short trips block it.'},egr:{warn:'EGR soot clogging.'}}},
 {id:'mitsubishi-l200-s6-2019',match:['L200'],years:[2019,2026],fuel:'diesel',cls:'pickup',label:'Mitsubishi L200 Series 6 2.2 DI-D 4N14',
  facts:{timing:'Timing chain. AdBlue (SCR) fitted.'},jobs:{adbluepump:{warn:'AdBlue system — keep topped with clean fluid.'}}}];
const out=['/* Driv3 jobs database. See jobs-db-notes.md for sources and method. Generated '+new Date().toISOString().slice(0,10)+'.',
' * Schema per job: id,name,buy,hrs,plo,phi,note (legacy = family class), cat, cls{class:{p:[lo,hi],h}|null (n/a)},',
' * diy{lvl 1-5,ok}, tools?, interval?, warn?, fuel?{diesel|petrol|hybrid:{p?,h?,note?}} overrides, fixed?[lo,hi] all-in garage price (no labour calc). */',
'var LABOUR='+JSON.stringify({indie:[60,90],dealer:[120,190],mobile:[45,70],def:75,nw:[55,80],london:[90,140],vat:'inc VAT',regionNote:'UK independent average ~£76/hr inc VAT (What Car? 2023, 279 IGA garages) and £75.87 (Garage Hive, Dec 2024); Lancaster / North West independents typically £55-£80; inside M25 avg £105, SW London up to £141; franchised dealers ~£125/hr ex VAT (~£150 inc) average, £140-£200 common.'})+';',
'var CLASSES='+JSON.stringify(CLASSES)+';',
'var MODELS='+JSON.stringify(MODELS)+';',
'var CATS='+JSON.stringify([...new Set(W.map(w=>w.cat))])+';',
'var WORK=[',W.map(w=>'  '+JSON.stringify(w)).join(',\n'),'];',''];
fs.writeFileSync(process.argv[2],out.join('\n'));
console.log(W.length,'jobs');
