# Driv3 jobs database (jobs-data.js) — sources & method

Updated 3 Nov 2026. All prices GBP inc VAT. `cls[class].p` = aftermarket/OE-equivalent parts range (retail, GSF/ECP/Autodoc level);
`h` = labour hours (book-time style). Garage price = p + h × rate. `fixed` jobs are all-in prices (no labour calc).
Legacy `hrs/plo/phi` = the `family` class. `null` class = not applicable (e.g. cambelt on an EV, wet belt on a Hilux).

## Labour rates (LABOUR)
- What Car? 2023 survey of 279 IGA independents: UK avg £76/hr; inside M25 £105; SW London £141; Huddersfield £47 (Autocar report).
- Garage Hive "Garage Industry Trends" Dec 2024 (1m+ invoices): £75.87 avg; England £77.66, Scotland £82.04, Wales £69.43 (aftermarketonline.net).
- 2025 trade survey (GSNL Sept 2025): independents £66/hr ex VAT, franchised dealers £125/hr ex VAT.
- CarOkay 2026 regional model: North West £50-£80; London & SE £75-£120; dealers 30-50% above indies.
- Chosen: indie £60-£90 (default £75), dealer £120-£190, mobile £45-£70, North West/Lancaster £55-£80.

## Price-guide anchors used to calibrate (garage totals)
- Cambelt+water pump: FixMyCar avg £469 (Ford £438, BMW £540, Vauxhall £412); OpenPrice £470 (£400-£700); Mr Clutch fixed £345-£525 belt only.
- Clutch: FixMyCar £671 (Aug 2025), clutch+DMF £1,083; BookMyGarage 2026 £586 (£278-£1,183); ClickMechanic Fiesta £450-£750, Golf £550-£900, 3 Series £700-£1,100, Qashqai £550-£900.
- Front pads+discs: BookMyGarage £278; OpenPrice £230 (£190-£290); rear £248 (BMG). Renault dealer list £365-£399.
- DPF clean: on-car regen £90-£150, off-car £200-£350 (DPFGuide 2025); FixMyCar £227.50; OpenPrice £250.
- MOT: DVSA cap £54.85 (Class 4).
- Wet belt Ford 1.0 EcoBoost: £850-£1,200 indie, £1,600-£2,000+ dealer (HBM); TGPP fixed £1,100.
- AdBlue: pump £600-£900 indie / £900-£1,500 dealer; heater £200-£400; NOx sensor £300-£700 (ifixadblue).
- Others from OpenPrice 2026 / FixMyCar 2024: alternator £527-£535, starter £250-£387, battery £150-£227, full service £200, interim £140, re-gas £70, windscreen £450, turbo £1,000, cat £425, EGR £372, bearing £200, coil springs £284-£320, back box £185, dampers pair £235.
- Hybrid/EV: Renault UK dealer price list (12V battery, EV service, coolant).

## Estimation basis
Family-class parts/hours set so p + h×£75 lands inside the guide ranges above. Other classes use consistent
per-category multipliers (see jobs-db-gen notes in commit) unless a job has explicit figures (cambelt, clutch, brakes,
tyres, battery, wet belt etc. were set individually). Hours are typical, not manufacturer-specific book times —
real book times vary by engine (e.g. transverse V6 plugs, N47 rear chain). Treat as guide estimates.

## Revision 2 (3 Nov 2026) — verification pass
Regenerate: `node garage/tools/gen-jobs.js garage/jobs-data.js` (edit the generator, not the output).
New optional top-level `MODELS` array: `{id,match:[model substrings],years:[from,to],fuel,cls,label,facts:{timing,tyres,brakes,...},jobs:{jobId:{gbp?:[lo,hi] real quote, src?, warn?}}}`.

Family-class totals (parts mid + hours × £75) were compared with OpenPrice 2026 typical prices, FixMyCar, BookMyGarage
for 40 common jobs; anything more than 15% out was corrected:
belt only, alternator, oil change, air-con regas, windscreen, timing chain, back box, cat-back, front dampers,
gearbox oil, brake fluid, coolant, mirror, rear pads+discs, turbo, alloy refurb. Wet belt raised to specialist
pricing (Ford 1.0 EcoBoost £850-£1,200 indie, HBM; TGPP fixed £1,100; 2.0 EcoBlue £1,000-£1,400).
Pickup clutch / clutch+DMF / cambelt hand-set from Fixter L200 data (clutch £677-£1,403; belt £346-£701, 4.75-5.3 h).

### Chris's cars
- Volvo XC60 SB61 (2011) — 5-cyl D5244 diesel (D5/D4/D3): cambelt drives the water pump; 108k miles/10 yrs; aux belt 54k.
  Quotes: indie ~£400 (genuine parts), Volvo dealer £555-£575 (Volvo Owners Club). Haynes: belt kit + pump 5-6 h.
  Known: aux belt/AC pulley failure taking the cambelt, P2015 swirl-flap linkage, EGR clogging, DPF/oil dilution, injector seals.
  Tyres 235/65 R17 or 235/60 R18 (R-Design). Source: vin-service-planner.com, carsales spec, Garage Wire/Dayco guide.
- Mitsubishi L200: generation not confirmed. Series 4 KB (2006-15) 2.5 DI-D 4D56 = belt + balancer belt, interference,
  ~62.5k/5 yrs (GetCarWise; Gates/PMM for the procedure). Series 5 KL (2015-19) 2.4 4N15 and Series 6 (2019+) 2.2 = chain.
  Known: DMF ~80k, injectors, leaf spring fracture, chassis rot, rear drums.

### Low confidence (no direct UK guide found; scaled/estimated)
Class multipliers for body panels, lighting, interior; EV-specific jobs (OBC, heat pump, module repair, charge port);
mechatronic, gearbox recon, subframe, heater matrix, ECU, ABS module, air suspension; van/premium hours generally.
