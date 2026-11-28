#!/usr/bin/env python3
"""Build garage/data/mot-norms.js: first-time MOT pass rates by make + model + fuel + age band.

Source: DVSA anonymised MOT test data (results extract, one calendar year), from
https://www.data.gov.uk/dataset/e3939ef8-30c7-4ca8-9c7c-ad9475cc9b2f/anonymised-mot-test
Contains public sector information licensed under the Open Government Licence v3.0.
Needs: pip install duckdb (run in a venv). Usage:
  python3 build-mot-norms.py <dir with dft_test_result_extract_*.csv> [<dir with item extracts> <item lookups dir>] ../data/mot-norms.js

Counts class 4 (cars, small vans) normal tests only. "First-time pass" = Passed with
nothing fixed on the day; PRS (fixed at the station) and Failed both count as a miss,
which matches how DVSA reports initial failure rates. Groups with fewer than MIN tests are dropped.
"""
import sys, json, datetime, duckdb

MIN = 200
BANDS = "CASE WHEN age<3 THEN NULL WHEN age<6 THEN 'a' WHEN age<9 THEN 'b' WHEN age<12 THEN 'c' WHEN age<15 THEN 'd' WHEN age<20 THEN 'e' ELSE 'f' END"
FUEL = "CASE fuel_type WHEN 'PE' THEN 'P' WHEN 'DI' THEN 'D' WHEN 'HY' THEN 'H' WHEN 'EL' THEN 'E' ELSE 'O' END"

def main(res_dir, out, items_dir=None, lk_dir=None):
    con = duckdb.connect()
    con.execute("SET memory_limit='1500MB'; SET threads=4; SET preserve_insertion_order=false; SET temp_directory='/workspace/trac3-data/duck-tmp'")
    con.execute(f"""
      CREATE TABLE t AS
      SELECT test_id, upper(trim(make)) mk, upper(trim(model)) md, {FUEL} fu,
             {BANDS.replace('age', "date_diff('year', TRY_CAST(first_use_date AS DATE), TRY_CAST(test_date AS DATE))")} band,
             test_result r
      FROM read_csv('{res_dir}/dft_test_result_extract_*.csv', header=true, all_varchar=true, ignore_errors=true)
      WHERE test_class_id='4' AND test_type='NT' AND test_result IN ('P','F','PRS')
    """)
    con.execute("DELETE FROM t WHERE band IS NULL OR mk IS NULL OR mk='' OR md IS NULL OR md=''")
    total = con.execute("SELECT count(*), avg((r='P')::int) FROM t").fetchone()
    print("tests", total)
    def q(sql): return con.execute(sql).fetchall()
    uk = {b: [n, round(p, 4)] for b, n, p in q("SELECT band, count(*), avg((r='P')::int) FROM t GROUP BY band")}
    mk = q(f"SELECT mk, fu, band, count(*) n, avg((r='P')::int), avg((r='PRS')::int) FROM t GROUP BY ALL HAVING n>={MIN}")
    md = q(f"SELECT mk, md, fu, band, count(*) n, avg((r='P')::int), avg((r='PRS')::int) FROM t GROUP BY ALL HAVING n>={MIN}")
    faults = {}; ukf = {}
    if items_dir and lk_dir:
        # top failure areas by make + model (all ages): share of tests with a fail in that area
        con.execute(f"""CREATE TABLE grp AS
          WITH RECURSIVE g AS (
            SELECT test_item_id::INT id, test_class_id::INT cls, parent_id::INT parent, item_name nm FROM read_csv('{lk_dir}/dft_item_group_extract.csv', header=true, all_varchar=true) WHERE test_class_id='4'),
          up(id, top, nm) AS (SELECT id, id, nm FROM g WHERE parent=0 AND id<>0
            UNION ALL SELECT g.id, up.top, up.nm FROM g JOIN up ON g.parent=up.id)
          SELECT id, nm FROM up""")
        con.execute(f"""CREATE TABLE rfr AS SELECT d.rfr_id::INT rfr, grp.nm FROM read_csv('{lk_dir}/dft_item_detail_extract.csv', header=true, all_varchar=true) d
            JOIN grp ON grp.id=d.test_item_id::INT WHERE d.test_class_id='4'""")
        con.execute(f"""CREATE TABLE fi AS SELECT DISTINCT i.test_id, rfr.nm FROM read_csv('{items_dir}/*.csv', header=true, all_varchar=true, ignore_errors=true) i
            JOIN rfr ON rfr.rfr=TRY_CAST(i.rfr_id AS INT) WHERE i.rfr_type_code IN ('F','P')""")
        rows = q(f"""WITH base AS (SELECT mk, md, count(*) n FROM t GROUP BY ALL HAVING n>={MIN*5}),
            c AS (SELECT t.mk, t.md, fi.nm, count(*) k FROM fi JOIN t USING(test_id) GROUP BY ALL)
            SELECT c.mk, c.md, c.nm, c.k*1.0/base.n FROM c JOIN base USING(mk, md) ORDER BY c.mk, c.md, c.k DESC""")
        ukn = total[0]
        for nm, k in q("SELECT nm, count(*) FROM fi JOIN t USING(test_id) GROUP BY nm"):
            ukf[nm] = round(k / ukn, 3)
        for a, b, nm, sh in rows:
            l = faults.setdefault(a + "|" + b, [])
            if len(l) < 3: l.append([nm, round(sh, 3)])
    def pack(rows, keylen):
        o = {}
        for r in rows:
            o["|".join(r[:keylen])] = [r[keylen], round(r[keylen + 1], 3), round(r[keylen + 2], 3)]
        return o
    data = {"year": 2025, "bands": {"a": "3-5", "b": "6-8", "c": "9-11", "d": "12-14", "e": "15-19", "f": "20+"},
            "uk": uk, "make": pack(mk, 3), "model": pack(md, 4), "faults": faults, "ukFaults": ukf}
    head = ("/* First-time MOT pass rates for cars by make, model, fuel and age band, " + str(data["year"]) +
            " tests. Built from DVSA anonymised MOT test data. Contains public sector information licensed under the "
            "Open Government Licence v3.0. Keys: make|model|fuel(P,D,H,E,O)|band -> [tests, passRate, fixedOnDayRate]. "
            "faults: make|model -> top 3 failure areas [name, share of tests]; ukFaults: area -> UK share. Built " + datetime.date.today().isoformat() + " */\n")
    open(out, "w").write(head + "window.T3_MOTNORMS=" + json.dumps(data, separators=(",", ":")) + ";\n")
    print("make rows", len(mk), "model rows", len(md), "fault models", len(faults))

if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) == 4: main(a[0], a[3], a[1], a[2])
    else: main(a[0], a[1])
