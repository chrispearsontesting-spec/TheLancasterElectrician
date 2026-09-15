window.JOB_ADVICE=[
{k:["wet belt","wet timing","ecoboost","puretech"],job:"beltwp",buy:"wet timing belt kit",
 interval:"Often 10 years or 150,000 miles — some Ford 1.0 EcoBoost and PSA 1.2 PureTech belts are sooner. Confirm the exact engine code.",
 detail:"The belt runs in engine oil. Missed changes can wreck the engine. Do not accept a verbal 'it's been done'. You want an invoice with the date, mileage and parts list (belt, oil pump belt if fitted, oil and filter)."},
{k:["timing belt","cambelt","belt kit"],job:"beltwp",buy:"timing belt kit water pump",
 interval:"Commonly 4–5 years or 40–60k on 80s/90s cars; 5–10 years / 60–150k on later engines. This pack's engine line is the clue.",
 detail:"Ask for the last belt + water pump invoice. A stamp with no parts list is weak. If there is no paper and the car is past the interval, budget the job before you buy — or walk away."},
{k:["timing chain","n47","chain rattle"],job:"full",buy:"timing chain kit",
 interval:"No fixed stamp like a belt. Listen from cold. A dry rattle in the first two seconds is the warning.",
 detail:"BMW N47 and some early TSI/TFSI chains stretch. A specialist inspection beats a polish. If it is already noisy, treat it as a big invoice."},
{k:["dpf","egr","soot"],job:"full",buy:"dpf",
 interval:"Not a scheduled part. Short trips clog it. Regeneration needs a proper motorway run.",
 detail:"Check the dash for DPF / engine lights. Ask how the car is used. Rising oil level on some diesels means fuel in the sump from failed regenerations."},
{k:["haldex","awd","4motion"],job:"service",buy:"haldex oil",
 interval:"Often every 20–40k miles. Widely skipped.",
 detail:"If the rear does not drive, or it growls on lock-up, the coupling oil was probably never done. Ask for the Haldex service invoice."},
{k:["dsg","powershift","dual-clutch","7g-dct","edc"],job:"service",buy:"dsg gearbox oil",
 interval:"Typically 40k miles for a DSG oil and filter. Powershift is a known weak box if jerky from rest.",
 detail:"A shudder pulling away is expensive. Get a test drive from cold in stop-start traffic, not just a bypass blast."},
{k:["head gasket","mayo","coolant"],job:"full",buy:"head gasket",
 interval:"Not scheduled. Age and overheating cause it.",
 detail:"Mayonnaise under the oil cap, a sweet smell, or a heater that never gets hot. Pressure-test if you are serious."},
{k:["air spring","air suspension"],job:"damp",buy:"air spring",
 interval:"Bags and compressors fail with age. The car must sit level after a night parked.",
 detail:"Look under the arches. A lean overnight is a compressor or a bag. Budget both ends if one has gone."},
{k:["clutch","flywheel","dual-mass"],job:"clutchdmf",buy:"clutch kit",
 interval:"Wear item. Judder from rest or a high biting point.",
 detail:"On diesels assume a dual-mass flywheel until a specialist says otherwise."},
{k:["brake pipe","flexi"],job:"fpads",buy:"brake pipes",
 interval:"Inspect at every MOT. Rubber flexis perish even on low-mile cars.",
 detail:"Follow the pipes along the floor into each arch. Surface rust is common; flakes or seeping unions are a fail."},
{k:["subframe","sill","jacking","spring seat","arch"],job:"full",buy:"sill repair",
 interval:"Structural. Not a service item — a deal-breaker if holed.",
 detail:"Probe jacking points and inner sills. A pretty respray over a paper sill is how people lose money."},
{k:["oil use","oil consumption","dipstick"],job:"full",buy:"oil",
 interval:"Some engines (early Celica 140, some VVT-i) drink oil by nature. Still check the level cold.",
 detail:"Over-full on a diesel can mean DPF regen dumping fuel. Glitter in the oil is a walk-away."},
{k:["charge","12v","ev range","phev"],job:"batt",buy:"12v battery",
 interval:"12V often 3–5 years. Traction battery is a health report, not a guess.",
 detail:"A dead 12V makes an EV look dead. Plug it in and confirm it actually charges."}
];
window.adviceFor=function(title,pack){
  var hay=(title+" "+(pack&&pack.name||"")+" "+(pack&&pack.engine||"")).toLowerCase();
  var list=window.JOB_ADVICE||[],i,j;
  for(i=0;i<list.length;i++){
    for(j=0;j<list[i].k.length;j++){
      if(hay.indexOf(list[i].k[j])>=0)return list[i];
    }
  }
  return {job:"full",buy:title||"service",interval:"Check the handbook or a specialist for this engine.",detail:"Ask for invoices with dates and mileage. When DVLA mileage is linked we can flag whether this job should already have been done."};
};
