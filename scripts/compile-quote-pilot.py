"""Compile an immutable private catalog from the reconciled Cotador FM export.

No remote access, credentials, or customer data. All business source fields are
retained in detail/network shards; monetary arithmetic uses source decimals.
"""
import argparse
import collections
import decimal
import gzip
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()

def read(name):
    return json.loads((args.source / name).read_text(encoding="utf-8"))

def packed(value):
    return gzip.compress(json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(), mtime=0)

plans = read("full-plans/plans.json")
prices = {p["id"]: p for p in read("full-plans/normalized/prices.json")}
details = {p["id"]: p["plano_detalhes"] for p in read("plan-details/plans.json")}
network_manifest = read("networks/manifest.json")
reference = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (args.source / "reference/eligibility").glob("*.json")}
net_counts = {p["id"]: p["rows"] for p in network_manifest["plans"]}
assert len(plans) == len(details) == len(net_counts) == 4922
assert len(prices) == 61952
assert sum(map(len, details.values())) == 61741
assert sum(net_counts.values()) == 2228042
fingerprint = hashlib.sha256()
fingerprint.update(b"quote-pilot-compiler-v2")
for value in [plans, details, reference]:
    fingerprint.update(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode())
for p in sorted(plans, key=lambda item: item["id"]):
    fingerprint.update(hashlib.sha256((args.source / "networks/raw" / f"{p['id']}-2000-1.json.gz").read_bytes()).digest())
digest = fingerprint.hexdigest()
release = "cotadorfm-2026-11-11-" + digest[:12]
out = args.output / release
out.mkdir(parents=True, exist_ok=True)
hashes, sizes = {}, {}

def write(name, value):
    data = packed(value)
    assert len(gzip.decompress(data)) <= 96 * 1024 * 1024, name
    path = out / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    hashes[name] = hashlib.sha256(data).hexdigest()
    sizes[name] = len(data)

groups = collections.defaultdict(list)
for p in plans:
    groups[p["id"][:2]].append(p)

index_plans = []
unit_ids = set()
for prefix, group in sorted(groups.items()):
    write(f"details/{prefix}.json.gz", {p["id"]: {"plan": p, "details": details[p["id"]]} for p in group})
    network = {}
    for p in group:
        id = p["id"]
        # The final reconciled capture supersedes exploratory paginated captures.
        file = args.source / "networks/raw" / f"{id}-2000-1.json.gz"
        assert file.exists(), id
        raw = json.loads(gzip.decompress(file.read_bytes()))
        data = raw["data"]
        assert len(data["unidades"]) == net_counts[id], id
        unit_ids.update(unit["id"] for unit in data["unidades"])
        # Keep provenance alongside the complete source response.
        data["_capture"] = {k: v for k, v in raw.items() if k != "data"}
        network[id] = data
        ps = []
        for price in p["precos"]:
            exact = decimal.Decimal(prices[price["id"]]["_valor_decimal"]) * 100
            assert exact == exact.to_integral_value(), price["id"]
            band = price["faixas_etarias"]
            ps.append(dict(id=price["id"], cents=int(exact), min=band["idade_minima"], max=band["idade_maxima"], active=price["ativo"],
                           to=price.get("vigencia_fim"), priority=price.get("prioridade_vigencia") or 0, lives=price.get("vidas"), **{"from": price.get("vigencia_inicio")}))
        index_plans.append(dict(id=id, name=p["nome"], code=p.get("codigo_plano") or "", operator=p["operadoras"]["nome"], operatorId=p["operadora_id"],
            administrator=(p.get("administradoras") or {}).get("nome", ""), modality=p["modalidade_cotacao"], accommodation=p.get("acomodacao") or "",
            coparticipation=p.get("coparticipacao") or "", coverage=p.get("abrangencia") or "", entity=p.get("entidade") or p.get("entidades") or "",
            cities=p.get("municipios_comercializacao") or [], businessProfiles=p.get("perfis_cnpj") or [], dental=p.get("odontologico_incluso"),
            minAge=p.get("idade_minima_aceita"), maxAge=p.get("idade_maxima_aceita"), holderMin=p.get("idade_minima_titular"), holderMax=p.get("idade_maxima_titular"),
            dependentMin=p.get("idade_minima_dependente"), dependentMax=p.get("idade_maxima_dependente"), minLives=p.get("vidas_minimas_aceitas"), maxLives=p.get("vidas_maximas_aceitas"),
            minHolders=p.get("titulares_minimos_aceitos"), ageConfirmed=p.get("regra_idade_confirmada") is True, eligibilityConfirmed=p.get("regra_elegibilidade_confirmada") is True,
            businessConfirmed=p.get("perfis_cnpj_confirmado") is True, prices=ps, networkCount=len(data["unidades"]), detailCount=len(details[id]),
            to=p.get("vigencia_fim"), **{"from": p.get("vigencia_inicio")}))
    write(f"network/{prefix}.json.gz", network)
    print(f"Compiled {prefix}: {len(group)} plans", flush=True)

write("references.json.gz", reference)
assert len(unit_ids) == 7483
index = dict(schemaVersion=1, sourceDate="2026-11-11", release=release, plans=index_plans, shardHashes=dict(hashes),
             options=dict(professions=[dict(value=v["value"], label=v["value"].replace("_", " ")) for v in reference["perfisAdesao"]], businessProfiles=sorted({v for p in plans for v in (p.get("perfis_cnpj") or [])}),
                          cities=sorted({v for p in plans for v in (p.get("municipios_comercializacao") or [])})),
             counts=dict(plans=len(plans), prices=len(prices), details=sum(map(len, details.values())), networkMemberships=sum(net_counts.values()), units=len(unit_ids)))
write("index.json.gz", index)
(out / "manifest.json").write_text(json.dumps(dict(release=release, indexHash=hashes["index.json.gz"], hashes=hashes, sizes=sizes, counts=index["counts"]), indent=2), encoding="utf-8")
print(json.dumps(dict(release=release, files=len(hashes), bytes=sum(sizes.values()), counts=index["counts"])))
