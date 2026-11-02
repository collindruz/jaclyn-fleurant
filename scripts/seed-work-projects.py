#!/usr/bin/env python3
"""One-shot helper used to author lib/work-projects.json. Safe to re-run."""
from __future__ import annotations

import json
import os
import re
from urllib.parse import quote

ROOT = os.path.join(os.path.dirname(__file__), "..")
WORK = os.path.join(ROOT, "public", "images", "work")
OUT = os.path.join(ROOT, "lib", "work-projects.json")

SECTION_FOLDERS = {
    "editorial": "editorial",
    "costumeDesign": "costume-design",
    "advertising": "advertising",
    "musicVideos": "music-videos",
    "events": "events",
}


def pub(section_key: str, name: str) -> str:
    folder = SECTION_FOLDERS[section_key]
    return "/images/work/" + quote(folder, safe="") + "/" + quote(name, safe="")


def img_num(name: str):
    m = re.match(r"IMG_(\d+)\.", name, re.I)
    return int(m.group(1)) if m else None


def site_num(name: str):
    m = re.match(r"site-(\d+)\.", name, re.I)
    return int(m.group(1)) if m else None


def list_files(section_key: str):
    folder = os.path.join(WORK, SECTION_FOLDERS[section_key])
    return sorted(
        [f for f in os.listdir(folder) if not f.startswith(".")],
        key=lambda s: s.lower(),
    )


assigned = set()
projects = []


def add(p):
    for a in p["assets"]:
        assigned.add(a)
    projects.append(p)


# --- Named, evidenced projects ---

add(
    {
        "id": "ed-ugg-season",
        "title": "UGG Season",
        "section": "editorial",
        "releaseDate": None,
        "datePrecision": None,
        "dateSource": None,
        "assets": [pub("editorial", "IMG_1182.jpg"), pub("editorial", "IMG_1183.jpg")],
        "coverAsset": pub("editorial", "IMG_1182.jpg"),
        "provisional": False,
        "notes": "Bus livery reads UGG SEASON. Public publication date not verified.",
    }
)

add(
    {
        "id": "ed-pink-puffer",
        "title": "Untitled",
        "section": "editorial",
        "releaseDate": None,
        "datePrecision": None,
        "dateSource": None,
        "assets": [
            pub("editorial", "IMG_6249.JPG"),
            pub("editorial", "IMG_6250.JPG"),
            pub("editorial", "IMG_6252.JPG"),
            pub("editorial", "IMG_6253.JPG"),
            pub("editorial", "site-004.jpg"),
        ],
        "coverAsset": pub("editorial", "IMG_6249.JPG"),
        "provisional": True,
        "notes": "Same pink puffer hood look across camera roll IMG_6249–6253 and site-004. Shoot/publication name not verified.",
    }
)

add(
    {
        "id": "ed-olive-studio",
        "title": "Untitled",
        "section": "editorial",
        "releaseDate": None,
        "datePrecision": None,
        "dateSource": None,
        "assets": [pub("editorial", "IMG_6913.JPG"), pub("editorial", "site-001.jpg")],
        "coverAsset": pub("editorial", "site-001.jpg"),
        "provisional": True,
        "notes": "Same redhead olive-studio sitting as IMG_6913 / site-001. Title and date unknown.",
    }
)

# Costume: local live clips share @S3LKCUB watermark and green tour looks.
mariah_live = [f for f in list_files("costumeDesign") if f.lower().endswith(".mp4")]
add(
    {
        "id": "cd-hss-live",
        "title": "Hearts Sold Separately — live",
        "section": "costumeDesign",
        "releaseDate": "2026",
        "datePrecision": "year",
        "dateSource": "Visual match to Hearts Sold Separately tour wardrobe (green looks, pink stand, @S3LKCUB). Tour announced 2026 (JamBase 2025-09-17). Specific show date unknown.",
        "assets": [pub("costumeDesign", f) for f in mariah_live],
        "coverAsset": pub("costumeDesign", "6a075460084e41c09a0079d890591614.MP4"),
        "provisional": True,
        "notes": "All local costume MP4s share the same live staging/watermark. Treated as one performance group; venue/date not verified. Review if any clip is a different night.",
    }
)

add(
    {
        "id": "cd-bet-awards-2026",
        "title": "BET Awards 2026",
        "section": "costumeDesign",
        "releaseDate": "2026-06-28",
        "datePrecision": "day",
        "dateSource": "Wikipedia BET Awards 2026; setlist.fm; Vibe 2026-06-28. Don Toliver performed E85 and Body.",
        "assets": ["https://www.youtube.com/watch?v=fxSmTkcOvcM"],
        "provisional": False,
        "notes": None,
    }
)

add(
    {
        "id": "cd-wim-2026",
        "title": "Billboard Women in Music 2026",
        "section": "costumeDesign",
        "releaseDate": "2026-04-29",
        "datePrecision": "day",
        "dateSource": "Billboard: Hollywood Palladium, 2026-04-29. Mariah the Scientist with Kali Uchis.",
        "assets": ["https://www.youtube.com/watch?v=eVib1QhV86I"],
        "provisional": False,
        "notes": None,
    }
)

add(
    {
        "id": "cd-fallon-2025",
        "title": "The Tonight Show Starring Jimmy Fallon",
        "section": "costumeDesign",
        "releaseDate": "2025-09-16",
        "datePrecision": "day",
        "dateSource": "TheTVDB original air date 2025-09-16; Rolling Stone 2025-09-17; Wikipedia Fallon 2025 episode list.",
        "assets": ["https://www.youtube.com/shorts/-p83jyXsL_k"],
        "provisional": False,
        "notes": "Emailed short is the Fallon Rainy Days clip. Rolling Stone also notes Burning Blue in the same medley.",
    }
)

add(
    {
        "id": "cd-homecoming-trailer",
        "title": "Homecoming: A Film By Beyoncé",
        "section": "costumeDesign",
        "releaseDate": "2019-04-08",
        "datePrecision": "day",
        "dateSource": "NPR 2019-04-08 trailer coverage. Film itself launched on Netflix 2019-04-17.",
        "assets": ["https://www.youtube.com/watch?v=fB8qvx0HOlI"],
        "provisional": False,
        "notes": "Kept in Costume Design per emailed category. Date is trailer publication, not Coachella 2018.",
    }
)

add(
    {
        "id": "cd-burning-blue-link",
        "title": "Burning Blue",
        "section": "costumeDesign",
        "releaseDate": "2025-05-08",
        "datePrecision": "day",
        "dateSource": "YouTube publish date for Jx9h3iWudTU (official MV) 2025-05-08; Billboard/MixtapeChick 2025-05-12. This emailed link (RihnnP1k1rw) is a separate upload in Costume Design.",
        "assets": ["https://www.youtube.com/watch?v=RihnnP1k1rw"],
        "provisional": True,
        "notes": "Different YouTube ID than the Music Videos official MV. Left in Costume Design. Confirm whether this is the official video or a performance cut.",
    }
)

# Advertising videos
add(
    {
        "id": "ad-clorox-scentiva",
        "title": "Clorox Scentiva Cherry Blossom & Peach",
        "section": "advertising",
        "releaseDate": "2026-06-03",
        "datePrecision": "day",
        "dateSource": "abancommercials.com lists this spot 2026-06-03 (YouTube g4N97ZjaErk).",
        "assets": ["https://www.youtube.com/watch?v=g4N97ZjaErk"],
        "provisional": False,
        "notes": None,
    }
)

add(
    {
        "id": "ad-reebok-born-classic",
        "title": "Reebok Born Classic. Worn for Life. — London",
        "section": "advertising",
        "releaseDate": "2026-02-18",
        "datePrecision": "day",
        "dateSource": "Footwear Magazine: SS26 Garment Leather / Workout Plus collection launch 2026-02-18. London hub 27 Feb–1 Mar 2026 (TheIndustry.fashion 2026-02-26).",
        "assets": ["https://www.youtube.com/watch?v=sRRUl9sJZtQ"],
        "provisional": False,
        "notes": "Spot is the London Workout Plus film; collection launch used as campaign date.",
    }
)

add(
    {
        "id": "ad-reebok-floatzig",
        "title": "Reebok FloatZig 1 Running Hacks",
        "section": "advertising",
        "releaseDate": "2024-03-01",
        "datePrecision": "day",
        "dateSource": "Reebok newsroom 2024-03-01 announcing FloatZig 1 with the Running Hacks campaign. Individual YouTube spots remain separate playable assets in this campaign group.",
        "assets": [
            "https://www.youtube.com/watch?v=m8khk9vB86k",
            "https://www.youtube.com/watch?v=PBP0NPpHcMw",
            "https://www.youtube.com/watch?v=ctvMtHp74rY",
            "https://www.youtube.com/watch?v=BdESXmQ-nGA",
        ],
        "provisional": False,
        "notes": "Related Reebok spots grouped as one campaign; each video stays playable. Later 2025 chapter dates exist but campaign launch is 2024-03-01.",
    }
)

add(
    {
        "id": "ad-reebok-through-the-fire",
        "title": "Reebok Through the Fire",
        "section": "advertising",
        "releaseDate": None,
        "datePrecision": None,
        "dateSource": None,
        "assets": ["https://vimeo.com/1027075641"],
        "provisional": False,
        "notes": "Director's Cut on Vimeo. Not treated as the 2013 Live With Fire campaign without a matching credit for this cut.",
    }
)

add(
    {
        "id": "ad-hearts-sold-separately",
        "title": "Hearts Sold Separately",
        "section": "advertising",
        "releaseDate": "2025-08-22",
        "datePrecision": "day",
        "dateSource": "Album release 2025-08-22 (Wikipedia; Epic Records; Spotify). Artwork/campaign stills use the green toy-soldier / pink set.",
        "assets": [
            pub("advertising", "site-003.webp"),
            pub("advertising", "site-119.jpg"),
            pub("advertising", "site-122.webp"),
        ],
        "coverAsset": pub("advertising", "site-003.webp"),
        "provisional": False,
        "notes": "Packaging/campaign stills only in Advertising. Other advertising stills not visually confirmed as this campaign.",
    }
)

add(
    {
        "id": "ad-calvin-klein-jeans",
        "title": "Calvin Klein Jeans",
        "section": "advertising",
        "releaseDate": None,
        "datePrecision": None,
        "dateSource": None,
        "assets": [
            pub("advertising", "site-256.jpg"),
            pub("advertising", "site-257.jpg"),
        ],
        "coverAsset": pub("advertising", "site-256.jpg"),
        "provisional": False,
        "notes": "CK Jeans lockup visible on site-256. site-257 same 800×1120 frame size. Campaign launch date not verified. site-259 not included (different dimensions).",
    }
)

# Music videos
add(
    {
        "id": "mv-a-good-day",
        "title": "A Good Day",
        "section": "musicVideos",
        "releaseDate": "2026-09-16",
        "datePrecision": "day",
        "dateSource": "AndersonPaakVEVO 2026-09-16; Stereogum 2026-09-16; Raw Drive 2026-09-16.",
        "assets": ["https://www.youtube.com/watch?v=8zxzlAyMg2U"],
        "provisional": False,
        "notes": None,
    }
)

add(
    {
        "id": "mv-e85",
        "title": "E85",
        "section": "musicVideos",
        "releaseDate": "2026-05-13",
        "datePrecision": "day",
        "dateSource": "Billboard 2026-05-13; Atlantic announcement 2026-05-14.",
        "assets": ["https://www.youtube.com/watch?v=rVD-zV6ctoM"],
        "provisional": False,
        "notes": None,
    }
)

add(
    {
        "id": "mv-excavator",
        "title": "Excavator",
        "section": "musicVideos",
        "releaseDate": "2026-01-31",
        "datePrecision": "day",
        "dateSource": "IMVDb official video 2026-01-31 (YouTube _SrosL0WdOQ).",
        "assets": ["https://www.youtube.com/watch?v=_SrosL0WdOQ"],
        "provisional": False,
        "notes": "Visualizer published Jan 29; official video date used.",
    }
)

add(
    {
        "id": "mv-is-it-a-crime",
        "title": "Is It a Crime",
        "section": "musicVideos",
        "releaseDate": "2025-10-02",
        "datePrecision": "day",
        "dateSource": "YouTube premiere 2025-10-02; Wikipedia music-video section; FEMMUSIC 2025-10-02.",
        "assets": ["https://www.youtube.com/watch?v=L5agl9ioLRM"],
        "provisional": False,
        "notes": "Song released 2025-07-31; this date is the official video.",
    }
)

add(
    {
        "id": "mv-burning-blue",
        "title": "Burning Blue",
        "section": "musicVideos",
        "releaseDate": "2025-05-08",
        "datePrecision": "day",
        "dateSource": "YouTube published 2025-05-08 (Jx9h3iWudTU); MixtapeChick 2025-05-12; AntiMusic 2025-05-10.",
        "assets": [
            "https://www.youtube.com/watch?v=Jx9h3iWudTU",
            pub("musicVideos", "site-183.jpg"),
        ],
        "coverAsset": "https://www.youtube.com/watch?v=Jx9h3iWudTU",
        "provisional": False,
        "notes": "site-183 is a VEVO still of the same military-blue look. Other music-video stills not attached.",
    }
)

# Runway stills 356–367
runway = [f for f in list_files("costumeDesign") if site_num(f) and 356 <= site_num(f) <= 367]
add(
    {
        "id": "cd-runway-356",
        "title": "Untitled",
        "section": "costumeDesign",
        "releaseDate": None,
        "datePrecision": None,
        "dateSource": None,
        "assets": [pub("costumeDesign", f) for f in runway],
        "coverAsset": pub("costumeDesign", "site-356.jpg"),
        "provisional": True,
        "notes": "Consecutive site-356–367, identical 1366×2048 runway frames. Show name/season not verified.",
    }
)


def remaining_files(section_key: str):
    out = []
    for name in list_files(section_key):
        src = pub(section_key, name)
        if src not in assigned:
            out.append(name)
    return out


def cluster_img(names):
    items = [(img_num(n), n) for n in names if img_num(n) is not None]
    items.sort()
    clusters = []
    cur = []
    prev = None
    for num, name in items:
        if prev is None or num - prev <= 5:
            cur.append(name)
        else:
            clusters.append(cur)
            cur = [name]
        prev = num
    if cur:
        clusters.append(cur)
    return clusters


n = 1
for section in ["editorial", "costumeDesign", "advertising", "musicVideos", "events"]:
    rem = remaining_files(section)
    img_names = [x for x in rem if img_num(x)]
    other = [x for x in rem if not img_num(x)]
    for cluster in cluster_img(img_names):
        pid = f"{section[:2]}-roll-{cluster[0].split('.')[0].lower()}"
        add(
            {
                "id": pid.lower().replace("_", "-"),
                "title": "Untitled",
                "section": section,
                "releaseDate": None,
                "datePrecision": None,
                "dateSource": None,
                "assets": [pub(section, f) for f in cluster],
                "coverAsset": pub(section, cluster[0]),
                "provisional": True,
                "notes": f"Camera-roll cluster {cluster[0]}–{cluster[-1]}. Same shoot inferred from consecutive IMG numbers. Title and date unknown.",
            }
        )
    # leftover stills: one provisional bucket per section (may mix shoots — split after review)
    if other:
        prefix = {
            "editorial": "ed",
            "costumeDesign": "cd",
            "advertising": "ad",
            "musicVideos": "mv",
            "events": "ev",
        }[section]
        add(
            {
                "id": f"{prefix}-unidentified-stills",
                "title": "Untitled stills",
                "section": section,
                "releaseDate": None,
                "datePrecision": None,
                "dateSource": None,
                "assets": [pub(section, f) for f in other],
                "coverAsset": pub(section, other[0]),
                "provisional": True,
                "notes": (
                    f"Unidentified {section} stills without a verified shoot/campaign match. "
                    "Kept together at the end so nothing is hidden; split into real projects after review. "
                    f"Files: {', '.join(other)}"
                ),
            }
        )

# sanity: every on-disk file assigned
missing = []
for section, folder in SECTION_FOLDERS.items():
    for name in list_files(section):
        src = pub(section, name)
        if src not in assigned:
            missing.append(src)

payload = {
    "version": 1,
    "notes": "Editable Work project metadata. Catalog generator reads this file and preserves membership/order. Do not use file mtimes as dates. projectOrder is an optional explicit override (lower = earlier).",
    "projects": projects,
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(payload, f, indent=2)
    f.write("\n")

print(f"Wrote {len(projects)} projects to {OUT}")
print(f"Unassigned on-disk files: {len(missing)}")
for m in missing:
    print("  ", m)
