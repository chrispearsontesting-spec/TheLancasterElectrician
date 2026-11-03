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
