#!/usr/bin/env python3
"""Build garage/data/recalls-uk.js from the official DVSA recalls CSV.

Source: https://www.check-vehicle-recalls.service.gov.uk/documents/RecallsFile.csv
Licence: Open Government Licence v3.0 (Crown copyright, DVSA).
Usage: python3 build-recalls.py RecallsFile.csv ../data/recalls-uk.js

Keeps vehicle recalls (R/...) for car makes, one row per campaign + model,
with the widest build-year range. Campaign data only: it does not say whether
a given car was fixed (the MOT API hasOutstandingRecall flag does that).
"""
import csv, json, re, sys, datetime

MAKES = [  # (prefix in the CSV make field, app make key)
    ("ABARTH","ABARTH"),("ALFA","ALFA ROMEO"),("ASTON","ASTON MARTIN"),("AUDI","AUDI"),("BENTLEY","BENTLEY"),
    ("BMW","BMW"),("BYD","BYD"),("CITROEN","CITROEN"),("CUPRA","CUPRA"),("DACIA","DACIA"),("DS ","DS"),("DS AUTOMOBILES","DS"),
    ("FIAT","FIAT"),("FORD","FORD"),("GENESIS","GENESIS"),("HONDA MOTOR","HONDA"),("HONDA (UK)","HONDA"),("HONDA","HONDA"),("HYUNDAI","HYUNDAI"),
    ("INFINITI","INFINITI"),("JAGUAR","JAGUAR"),("JEEP","JEEP"),("KIA","KIA"),("LAND ROVER","LAND ROVER"),("LEXUS","LEXUS"),
    ("MAZDA","MAZDA"),("MERCEDES-BENZ CARS","MERCEDES-BENZ"),("MERCEDES BENZ UK","MERCEDES-BENZ"),("MERCEDES-BENZ UK","MERCEDES-BENZ"),
    ("MG","MG"),("MINI","MINI"),("MITSUBISHI","MITSUBISHI"),("NISSAN","NISSAN"),("PEUGEOT","PEUGEOT"),("POLESTAR","POLESTAR"),
    ("PORSCHE","PORSCHE"),("RENAULT","RENAULT"),("SEAT","SEAT"),("SKODA","SKODA"),("SMART","SMART"),("SSANGYONG","SSANGYONG"),
    ("SUBARU","SUBARU"),("SUZUKI","SUZUKI"),("TESLA","TESLA"),("TOYOTA","TOYOTA"),("VAUXHALL","VAUXHALL"),("VOLKSWAGEN","VOLKSWAGEN"),
    ("VW","VOLKSWAGEN"),("VOLVO CAR","VOLVO"),("CHRYSLER","CHRYSLER"),("CHEVROLET","CHEVROLET"),("SAAB","SAAB"),("ROVER","ROVER"),("MG ROVER","ROVER"),
]
SKIP = re.compile(r"TRUCK|BUS|VANS|MOTORCYCLE|COMMERCIAL|TRAILER|COACH", re.I)
CATS = [  # first match wins; plain-English groups the app shows
    ("fire", r"\bfire\b|burn|thermal event"),
    ("airbag", r"air ?bag|srs|seat ?belt|beltminder|restraint"),
    ("brakes", r"brake|abs\b|esp\b"),
    ("steering", r"steer|epas|power assist"),
    ("battery", r"high.?voltage|hv battery|traction battery|48v|12v battery|mhev|phev|charg|battery"),
    ("software", r"software|ecu|pcm|module|telematic|ecall|sync|update|camera|display|screen"),
    ("gearbox", r"gearbox|transmission|clutch|driveshaft|drive shaft|dsg|cvt"),
    ("engine", r"engine|turbo|timing|oil|coolant|fuel pump|injector|dpf|particulate|egr|cylinder|stall|lose power|loss of power"),
    ("fuel", r"\bfuel\b|leak"),
    ("electrics", r"wiring|loom|electric|fuse|alternator|lamp|light|wiper"),
    ("suspension", r"suspension|knuckle|hub|wheel|tyre|axle|spring"),
]
def norm_make(m):
    u = m.strip().upper()
    if SKIP.search(u): return None
    for pre, key in MAKES:
        if u.startswith(pre): return key
    return None
def year(s):
    try: return datetime.datetime.strptime(s.strip(), "%d/%m/%Y").year
    except Exception: return None
def cat(text):
    t = text.lower()
    for k, rx in CATS:
        if re.search(rx, t): return k
    return "other"
def clean_concern(s):
    s = re.sub(r"\s+", " ", s.replace("\u00e2\u0080\u0093", "-")).strip().strip(".")
    s = re.sub(r"^\d+[A-Z]\d+\s*[-–]?\s*", "", s)  # drop maker refs like 24C21
    if s.isupper(): s = s.capitalize()
    if len(s) > 90: s = s[:88].rsplit(" ", 1)[0].rstrip(",;:-") + "…"
    return s

def main(src, out):
    rows = list(csv.DictReader(open(src, encoding="latin-1")))
    agg = {}
    for r in rows:
        num = (r.get("Recalls Number") or "").strip()
        if not num.startswith("R/"): continue
        mk = norm_make(r.get("Make") or "")
        if not mk: continue
        model = re.sub(r"\s+", " ", (r.get("Model") or r.get("Recalls Model Information") or "").upper()).strip()
        if not model: continue
        b0, b1 = year(r.get("Build Start") or ""), year(r.get("Build End") or "")
        ly = year(r.get("Launch Date") or "")
        k = (num, mk, model)
        concern = clean_concern(r.get("Concern") or "")
        a = agg.get(k)
        if not a:
            a = agg[k] = {"n": num, "mk": mk, "md": model, "y": ly, "c": concern,
                          "g": (cat(concern) if cat(concern) != "other" else cat(r.get("Defect") or "")), "b0": b0, "b1": b1}
        else:
            if b0 and (not a["b0"] or b0 < a["b0"]): a["b0"] = b0
            if b1 and (not a["b1"] or b1 > a["b1"]): a["b1"] = b1
    out_rows = []
    for a in agg.values():
        if not a["b0"] and not a["b1"]: continue  # no build range: can't place a car
        out_rows.append([a["mk"], a["md"], a["b0"] or a["b1"], a["b1"] or a["b0"], a["n"], a["y"] or 0, a["g"], a["c"]])
    out_rows.sort(key=lambda x: (x[0], x[1], x[2], x[4]))
    head = ("/* UK vehicle safety recalls by make + model + build years. Built from the DVSA recalls CSV "
            "(check-vehicle-recalls.service.gov.uk), Crown copyright, Open Government Licence v3.0. "
            "Campaigns only, not whether a car was fixed. Built " + datetime.date.today().isoformat() +
            ". Fields: make, model, buildFrom, buildTo, recallNo, launchYear, group, concern */\n")
    with open(out, "w") as f:
        f.write(head + "window.T3_RECALLS=" + json.dumps(out_rows, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print(len(rows), "rows ->", len(out_rows), "campaign rows")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
