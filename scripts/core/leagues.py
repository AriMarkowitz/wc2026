"""
Resolve a clean domestic-league name from an ESPN team slug.

ESPN team slugs are prefixed with a country/competition code, e.g.
    "eng.arsenal"  -> English Premier League
    "esp.real_madrid" -> Spanish LALIGA
    "bra.flamengo" -> Brazilian Serie A
    "team.al-sadd" -> (gulf clubs have no country code) -> looked up by club name

This is far more reliable than ESPN's `groups[].name`, which returns the
player's current *competition context* ("Grand Final", "2026", "Promotion
Final", "2025-26 LALIGA") rather than a stable league name.
"""

# Country-code prefix -> top-flight league display name.
# Codes match the slugs documented in the Public ESPN API soccer reference.
SLUG_PREFIX_LEAGUE = {
    "eng": "English Premier League",
    "esp": "Spanish LALIGA",
    "ger": "German Bundesliga",
    "ita": "Italian Serie A",
    "fra": "French Ligue 1",
    "ned": "Dutch Eredivisie",
    "por": "Portuguese Primeira Liga",
    "sco": "Scottish Premiership",
    "bel": "Belgian Pro League",
    "tur": "Turkish Super Lig",
    "aut": "Austrian Bundesliga",
    "gre": "Greek Super League",
    "den": "Danish Superliga",
    "nor": "Norwegian Eliteserien",
    "swe": "Swedish Allsvenskan",
    "sui": "Swiss Super League",
    "cze": "Czech First League",
    "rus": "Russian Premier League",
    "ukr": "Ukrainian Premier League",
    "cro": "Croatian HNL",
    "srb": "Serbian SuperLiga",
    "rou": "Romanian Liga I",
    "hun": "Hungarian NB I",
    "pol": "Polish Ekstraklasa",
    "cyp": "Cypriot First Division",
    "slo": "Slovenian PrvaLiga",
    "svk": "Slovak Super Liga",
    "bul": "Bulgarian First League",
    "irl": "Irish Premier Division",
    "usa": "MLS",
    "mex": "Liga MX",
    "can": "Canadian Premier League",
    "bra": "Brazilian Serie A",
    "arg": "Argentine Primera Division",
    "chi": "Chilean Primera Division",
    "col": "Colombian Primera A",
    "par": "Paraguayan Primera Division",
    "per": "Peruvian Liga 1",
    "uru": "Uruguayan Primera Division",
    "bol": "Bolivian Primera Division",
    "ecu": "Ecuadorian LigaPro",
    "ven": "Venezuelan Primera Division",
    "rsa": "South African Premiership",
    "nga": "Nigerian Professional League",
    "gha": "Ghanaian Premier League",
    "egy": "Egyptian Premier League",
    "mar": "Moroccan Botola",
    "tun": "Tunisian Ligue 1",
    "alg": "Algerian Ligue 1",
    "ksa": "Saudi Pro League",
    "qat": "Qatar Stars League",
    "uae": "UAE Pro League",
    "jpn": "Japanese J.League",
    "kor": "K League 1",
    "chn": "Chinese Super League",
    "aus": "Australian A-League",
    "ind": "Indian Super League",
    "tha": "Thai League 1",
}

# Gulf/other clubs whose slug is "team.*" (no country code) — map by club name.
CLUB_NAME_LEAGUE = {
    "Al Sadd": "Qatar Stars League",
    "Al Duhail": "Qatar Stars League",
    "Al Gharafa": "Qatar Stars League",
    "Al Rayyan": "Qatar Stars League",
    "Al Arabi": "Qatar Stars League",
    "Al Wakrah": "Qatar Stars League",
    "Al Ahli": "Saudi Pro League",
    "Al Hilal": "Saudi Pro League",
    "Al Nassr": "Saudi Pro League",
    "Al Ittihad": "Saudi Pro League",
    "Al Ettifaq": "Saudi Pro League",
    "Al Qadsiah": "Saudi Pro League",
    "Al Ain": "UAE Pro League",
    "Al Wahda": "UAE Pro League",
    "Al Jazira": "UAE Pro League",
    "Esperance Sportive de Tunis": "Tunisian Ligue 1",
    "Club Sportif Sfaxien": "Tunisian Ligue 1",
    "Mamelodi Sundowns": "South African Premiership",
    "Orlando Pirates": "South African Premiership",
    "Kaizer Chiefs": "South African Premiership",
    # Clubs whose ESPN slug lacks a country prefix
    "Slavia Prague": "Czech First League",
    "Sparta Prague": "Czech First League",
    "Viktoria Plzen": "Czech First League",
    "Kasimpasa": "Turkish Super Lig",
    "Rijeka": "Croatian HNL",
    "Pafos": "Cypriot First Division",
    "AEL": "Cypriot First Division",
    "Universitatea Cluj": "Romanian Liga I",
    "Red Star Belgrade": "Serbian SuperLiga",
    "Union St.-Gilloise": "Belgian Pro League",
    "Jagiellonia Bialystok": "Polish Ekstraklasa",
    "Al Ahly": "Egyptian Premier League",
    "Zamalek": "Egyptian Premier League",
    "Pyramids FC": "Egyptian Premier League",
    "Persepolis": "Iranian Pro League",
    "Esteghlal": "Iranian Pro League",
    "Sepahan": "Iranian Pro League",
    "Tractor": "Iranian Pro League",
    "Auckland FC": "Australian A-League",
    "Wellington Phoenix": "Australian A-League",
}


def league_from_slug(slug: str | None, club_name: str | None = None) -> str | None:
    """Return a clean league name from a team slug, falling back to club name."""
    if slug:
        prefix = slug.split(".", 1)[0] if "." in slug else slug
        if prefix in SLUG_PREFIX_LEAGUE:
            return SLUG_PREFIX_LEAGUE[prefix]
    if club_name and club_name in CLUB_NAME_LEAGUE:
        return CLUB_NAME_LEAGUE[club_name]
    return None
