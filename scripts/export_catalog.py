#!/usr/bin/env python3
"""Export the compact subset of the ALS IV FITS table used by the web map.

This intentionally uses only Python's standard library so the map can be rebuilt
on a machine that does not have Astropy installed.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "Data/catalouge/selected"
TARGET = ROOT / "Map/public/catalog.json"
EXTRA_TARGET = ROOT / "Map/public/catalog-extra.json"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        help="FITS de entrada; si se omite, se usa el als_iv_FECHA_final.fits más reciente",
    )
    return parser.parse_args()


def latest_final_source() -> Path:
    candidates = []
    for path in SOURCE_DIR.glob("als_iv_*_final.fits"):
        match = re.fullmatch(r"als_iv_(\d+)_final\.fits", path.name)
        if match:
            candidates.append((int(match.group(1)), path))
    if not candidates:
        raise FileNotFoundError(
            f"No se encontró ningún als_iv_FECHA_final.fits en {SOURCE_DIR}"
        )
    return max(candidates, key=lambda item: (item[0], item[1].name))[1]


def read_header(handle):
    cards = []
    while True:
        block = handle.read(2880)
        if len(block) != 2880:
            raise ValueError("Unexpected end of FITS header")
        for start in range(0, 2880, 80):
            card = block[start : start + 80].decode("ascii")
            cards.append(card)
            if card.startswith("END"):
                values = {}
                for item in cards:
                    if item[8:10] != "= ":
                        continue
                    raw = item[10:].split("/", 1)[0].strip()
                    if raw.startswith("'"):
                        value = raw.strip("'").strip()
                    elif raw in ("T", "F"):
                        value = raw == "T"
                    else:
                        try:
                            value = int(raw)
                        except ValueError:
                            try:
                                value = float(raw)
                            except ValueError:
                                value = raw
                    values[item[:8].strip()] = value
                return values


def form_width(form: str) -> int:
    match = re.fullmatch(r"(\d*)([A-Z])", form.strip())
    if not match:
        raise ValueError(f"Unsupported TFORM: {form}")
    count = int(match.group(1) or 1)
    sizes = {"A": 1, "L": 1, "B": 1, "I": 2, "J": 4, "K": 8, "E": 4, "D": 8}
    return count * sizes[match.group(2)]


def clean_text(raw: bytes) -> str:
    return raw.decode("ascii", "replace").strip().replace("\x00", "")


def identifier_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def finite_number(value: float, *, sentinel=True):
    if not math.isfinite(value) or (sentinel and value <= -90):
        return None
    return round(value, 7)


def main(source: Path | None):
    source = latest_final_source() if source is None else source
    if not source.is_absolute():
        source = (Path.cwd() / source).resolve()
    if not source.is_file():
        raise FileNotFoundError(f"No existe el catálogo FITS: {source}")

    print(f"Using source: {source}")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    with source.open("rb") as handle:
        primary = read_header(handle)
        primary_bytes = int(primary.get("NAXIS1", 0)) * int(primary.get("NAXIS2", 0))
        if primary_bytes:
            handle.seek(((primary_bytes + 2879) // 2880) * 2880, 1)
        header = read_header(handle)
        row_size = int(header["NAXIS1"])
        rows = int(header["NAXIS2"])
        columns = []
        offset = 0
        for index in range(1, int(header["TFIELDS"]) + 1):
            name = str(header[f"TTYPE{index}"]).strip()
            form = str(header[f"TFORM{index}"]).strip()
            width = form_width(form)
            columns.append((name, form, offset, width))
            offset += width
        if offset != row_size:
            raise ValueError(f"Column width {offset} != FITS row width {row_size}")

        wanted = {
            "id_als", "ra", "dec", "id_dr3_gaia", "parallax_corr_gaia",
            "parallax_error_corr_gaia", "pmra_corr_gaia", "pmdec_corr_gaia",
            "pmra_error_corr_gaia", "pmdec_error_corr_gaia", "ruwe_gaia",
            "main_id_simbad", "id_simbad", "otype_simbad", "sp_type_simbad", "g_syn",
            "bp_rp_syn", "g_source", "bp_rp_source", "Sample", "Notes",
            "g_mag_corr_gaia", "g_mag_error_gaia", "bp_mag_gaia",
            "bp_mag_error_gaia", "rp_mag_gaia", "rp_mag_error_gaia",
            "U_zh", "e_U_zh", "B_zh", "e_B_zh", "u_psf_smss",
            "e_u_psf_smss", "v_psf_smss", "e_v_psf_smss", "Jpmag_vista",
            "e_Jpmag_vista", "Kspmag_vista", "e_Kspmag_vista", "j_2mass",
            "j_err_2mass", "k_2mass", "k_err_2mass", "F336W_hubble",
            "e_F336W_hubble", "F555W_hubble", "e_F555W_hubble",
            "F775W_hubble", "e_F775W_hubble",
            "SG_var", "SSG_var", "SBP_var", "SSBP_var", "SRP_var", "SSRP_var",
        }
        layout = {name: (form, start, width) for name, form, start, width in columns}
        extra_columns = [(name, form) for name, form, _, _ in columns if name not in wanted]

        def unpack(row: bytes, name: str):
            form, start, width = layout[name]
            raw = row[start : start + width]
            kind = form[-1]
            if kind == "A":
                return clean_text(raw)
            if kind == "D":
                return struct.unpack(">d", raw)[0]
            if kind == "K":
                return struct.unpack(">q", raw)[0]
            raise ValueError(form)

        output = []
        simbad_aliases = []
        simbad_ids = []
        extra_output = []
        sample_counts = {}
        rejected_distances = 0
        positive_distances = 0
        for _ in range(rows):
            row = handle.read(row_size)
            if len(row) != row_size:
                raise ValueError("Unexpected end of FITS table")
            parallax = finite_number(unpack(row, "parallax_corr_gaia"))
            parallax_error = finite_number(unpack(row, "parallax_error_corr_gaia"))
            if parallax and parallax_error and parallax > 0 and parallax_error > 0:
                distance = 1.0 / parallax
                distance_kind = "1/ϖ corrected"
                positive_distances += 1
            else:
                rejected_distances += 1
                distance = None
                distance_kind = "unavailable"
            sample = unpack(row, "Sample")
            sample_counts[sample] = sample_counts.get(sample, 0) + 1
            gaia_id = unpack(row, "id_dr3_gaia")
            gaia_text = str(gaia_id) if gaia_id > 0 else ""
            main_simbad = unpack(row, "main_id_simbad")
            seen_identifiers = {
                identifier_key(main_simbad),
                identifier_key(f"Gaia DR3 {gaia_text}") if gaia_text else "",
            }
            searchable_aliases = []
            original_simbad_ids = unpack(row, "id_simbad")
            for alias in original_simbad_ids.split("|"):
                key = identifier_key(alias)
                if key and key not in seen_identifiers and alias != "-99":
                    seen_identifiers.add(key)
                    searchable_aliases.append(alias)
            notes = unpack(row, "Notes")
            if notes == "-99":
                notes = ""

            output.append([
                unpack(row, "id_als"),
                round(unpack(row, "ra"), 7),
                round(unpack(row, "dec"), 7),
                finite_number(unpack(row, "g_syn")),
                finite_number(unpack(row, "bp_rp_syn")),
                parallax,
                parallax_error,
                finite_number(unpack(row, "pmra_corr_gaia")),
                finite_number(unpack(row, "pmdec_corr_gaia")),
                finite_number(unpack(row, "ruwe_gaia")),
                sample,
                gaia_text,
                main_simbad,
                unpack(row, "otype_simbad"),
                unpack(row, "sp_type_simbad"),
                unpack(row, "g_source"),
                unpack(row, "bp_rp_source"),
                round(distance, 4) if distance is not None else None,
                distance_kind,
                notes,
                finite_number(unpack(row, "pmra_error_corr_gaia")),
                finite_number(unpack(row, "pmdec_error_corr_gaia")),
                finite_number(unpack(row, "SG_var")),
                finite_number(unpack(row, "SSG_var")),
                finite_number(unpack(row, "SBP_var")),
                finite_number(unpack(row, "SSBP_var")),
                finite_number(unpack(row, "SRP_var")),
                finite_number(unpack(row, "SSRP_var")),
                finite_number(unpack(row, "g_mag_corr_gaia")),
                finite_number(unpack(row, "g_mag_error_gaia")),
                finite_number(unpack(row, "bp_mag_gaia")),
                finite_number(unpack(row, "bp_mag_error_gaia")),
                finite_number(unpack(row, "rp_mag_gaia")),
                finite_number(unpack(row, "rp_mag_error_gaia")),
                finite_number(unpack(row, "U_zh")),
                finite_number(unpack(row, "e_U_zh")),
                finite_number(unpack(row, "B_zh")),
                finite_number(unpack(row, "e_B_zh")),
                finite_number(unpack(row, "u_psf_smss")),
                finite_number(unpack(row, "e_u_psf_smss")),
                finite_number(unpack(row, "v_psf_smss")),
                finite_number(unpack(row, "e_v_psf_smss")),
                finite_number(unpack(row, "j_2mass")),
                finite_number(unpack(row, "j_err_2mass")),
                finite_number(unpack(row, "k_2mass")),
                finite_number(unpack(row, "k_err_2mass")),
                finite_number(unpack(row, "Jpmag_vista")),
                finite_number(unpack(row, "e_Jpmag_vista")),
                finite_number(unpack(row, "Kspmag_vista")),
                finite_number(unpack(row, "e_Kspmag_vista")),
                finite_number(unpack(row, "F336W_hubble")),
                finite_number(unpack(row, "e_F336W_hubble")),
                finite_number(unpack(row, "F555W_hubble")),
                finite_number(unpack(row, "e_F555W_hubble")),
                finite_number(unpack(row, "F775W_hubble")),
                finite_number(unpack(row, "e_F775W_hubble")),
            ])
            simbad_aliases.append("|".join(searchable_aliases))
            simbad_ids.append(original_simbad_ids)
            extra_row = []
            for name, form in extra_columns:
                value = unpack(row, name)
                if form[-1] == "D":
                    value = finite_number(value)
                elif form[-1] == "K" and value <= -90:
                    value = None
                extra_row.append(value)
            extra_output.append(extra_row)

    payload = {
        "version": source.stem.replace("als_iv_", "ALS IV ").replace("_", " "),
        "source": str(source.relative_to(ROOT)) if source.is_relative_to(ROOT) else str(source),
        "count": len(output),
        "sampleCounts": sample_counts,
        "parallaxDistanceCount": positive_distances,
        "rejectedDistanceCount": rejected_distances,
        "maxParallaxSnr": round(max(star[5] / star[6] for star in output if star[5] and star[6] and star[5] > 0 and star[6] > 0), 2),
        "simbadAliases": simbad_aliases,
        "simbadIds": simbad_ids,
        "columns": [
            "id", "ra", "dec", "g", "bpRp", "parallax", "parallaxError", "pmRa",
            "pmDec", "ruwe", "sample", "gaiaId", "simbadId", "objectType", "spectralType",
            "gSource", "colorSource", "distance", "distanceKind", "notes",
            "pmRaError", "pmDecError",
            "variabilityG", "variabilityGError", "variabilityBp", "variabilityBpError",
            "variabilityRp", "variabilityRpError",
            "gaiaG", "gaiaGError", "gaiaBp", "gaiaBpError", "gaiaRp", "gaiaRpError",
            "zhU", "zhUError", "zhB", "zhBError", "smssU", "smssUError",
            "smssV", "smssVError", "twoMassJ", "twoMassJError", "twoMassKs",
            "twoMassKsError", "vistaJ", "vistaJError", "vistaKs", "vistaKsError",
            "hubbleF336W", "hubbleF336WError", "hubbleF555W", "hubbleF555WError",
            "hubbleF775W", "hubbleF775WError",
        ],
        "stars": output,
    }
    with TARGET.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    extra_payload = {
        "count": len(extra_output),
        "columns": [
            {"name": name, "numeric": form[-1] in {"D", "K"}}
            for name, form in extra_columns
        ],
        "rows": extra_output,
    }
    with EXTRA_TARGET.open("w", encoding="utf-8") as handle:
        json.dump(extra_payload, handle, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    print(f"Wrote {len(output):,} stars to {TARGET} ({TARGET.stat().st_size / 1e6:.1f} MB)")
    print(f"Wrote {len(extra_columns)} deferred columns to {EXTRA_TARGET} ({EXTRA_TARGET.stat().st_size / 1e6:.1f} MB)")
    print("Samples:", sample_counts)
    print("Positive corrected parallaxes with valid errors:", positive_distances)
    print("Rejected because parallax/error is invalid:", rejected_distances)


if __name__ == "__main__":
    main(parse_args().source)
