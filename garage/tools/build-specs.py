#!/usr/bin/env python3
"""Build garage/data/specs-uk.js (power, torque, 0-60, top speed) from car-specs-full.csv
inside garage/car-specs-sheet-v2.zip.
Data sourced from cardata.wiki, available under CC BY 4.0.
Usage: python3 build-specs.py car-specs-full.csv ../data/specs-uk.js
"""
import csv, json, re, sys, datetime
BODY = r"\b(\d DOORS?|\d-DOOR|DOORS|HATCHBACK|HATCH|ESTATE|SALOON|COUPE|CABRIOLET|CABRIO|CONVERTIBLE|TOURER|SPORTBREAK|SPORTS TOURER|AVANT|SPORTBACK|ROADSTER|LIMOUSINE|LWB|SWB|FASTBACK|LIFTBACK|SW|ST|KOMBI|VAN|MPV|SUV|CROSSOVER|GRAN COUPE|GRAN TURISMO|TOURING|SHOOTING BRAKE|SPORTSWAGON|\(\w+\))\b"
FUEL = {"Petrol": "P", "Diesel": "D", "Electric": "E", "Hybrid Petrol": "H", "Hybrid Diesel": "H", "Plug In Hybrid": "H", "Lpg": "P"}
MAKE = {"MERCEDES BENZ": "MERCEDES-BENZ", "KGM": "SSANGYONG"}
def num(s, f=float):
    try: return f(float(s))
    except Exception: return None
def main(src, out):
    rows, seen = [], set()
    for r in csv.DictReader(open(src, encoding="utf-8")):
        bhp = num(r["bhp"], lambda x: int(round(x)))
        if not bhp: continue
        mk = r["make"].strip().upper(); mk = MAKE.get(mk, mk)
        md = r["model"].strip().upper()
        if md.startswith(mk + " "): md = md[len(mk) + 1:]
        md = re.sub(r"\([^)]*\)|\bLCI\b|[^\x00-\x7f]", " ", md)
        md = re.sub(r"\s+", " ", re.sub(BODY, " ", md)).strip(" -/")
        if not md: continue
        y0 = num(r["yearFrom"], int); y1 = num(r["yearTo"], int)
        if y1 and y1 < 1995: continue
        rec = [mk, md, (r["variant"] or "").strip()[:36], y0 or 0, y1 or 0, FUEL.get(r["fuel"], ""),
               num(r["cc"], int) or 0, bhp, num(r["nm"], int) or 0, num(r["s060"]) or 0, num(r["mph"], int) or 0]
        k = tuple(rec[:2] + rec[3:])
        if k in seen: continue
        seen.add(k); rows.append(rec)
    rows.sort(key=lambda x: (x[0], x[1], x[3], x[7]))
    head = ("/* Car performance specs by make + model (power bhp, torque Nm, 0-60 s, top speed mph). "
            "Data sourced from cardata.wiki, available under CC BY 4.0. Built " + datetime.date.today().isoformat() +
            ". Fields: make, model, variant, yearFrom, yearTo(0=on sale), fuel(P,D,E,H), cc, bhp, nm, s060, mph */\n")
    open(out, "w").write(head + "window.T3_SPECS=" + json.dumps(rows, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print(len(rows), "spec rows")
if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
