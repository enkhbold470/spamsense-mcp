import asyncio
import json
import os
import re
import sys
from typing import Dict, Any

from dedalus_labs import AsyncDedalus, DedalusRunner
from dotenv import load_dotenv


load_dotenv()


def _normalize_number(raw: str) -> Dict[str, Any]:
    digits = re.sub(r"\D+", "", raw or "")
    country_code = None
    national = None
    e164 = None
    valid = False

    if len(digits) == 11 and digits.startswith("1"):
        country_code = "+1"
        national = digits[1:]
        valid = True
    elif len(digits) == 10:
        country_code = "+1"
        national = digits
        valid = True
    else:
        # Fallback: attempt to build E.164 with unknown country
        national = digits

    if country_code and national:
        e164 = f"{country_code}{national}"

    return {
        "raw": raw,
        "digits": digits,
        "country_code": country_code,
        "national_number": national,
        "e164": e164,
        "valid": valid,
    }


def _has_repeated_digits(digits: str, n: int = 6) -> bool:
    return bool(re.search(rf"(\d)\1{{{n-1},}}", digits))


def _has_sequence(digits: str, run: int = 4) -> bool:
    for i in range(len(digits) - run + 1):
        window = digits[i : i + run]
        if window in "0123456789":
            # Strictly increasing simple run like 0123, 1234
            if all(int(window[j + 1]) - int(window[j]) == 1 for j in range(len(window) - 1)):
                return True
        # Decreasing run like 9876
        if all(int(window[j]) - int(window[j + 1]) == 1 for j in range(len(window) - 1)):
            return True
    return False


def lookup_phone_number(number: str) -> Dict[str, Any]:
    meta = _normalize_number(number)
    digits = meta["digits"]
    area = None
    exchange = None
    if meta["national_number"] and len(meta["national_number"]) == 10:
        area = meta["national_number"][:3]
        exchange = meta["national_number"][3:6]

    suspicious_area_codes = {
        # Some NANP codes often seen in callback scams (non-exhaustive)
        "809",
        "876",
        "284",
        "473",
        "649",
        "664",
        "721",
        "758",
        "784",
        "868",
        "869",
        "441",
    }
    toll_free_area_codes = {"800", "833", "844", "855", "866", "877", "888"}

    signals = {
        "invalid_length": not meta["valid"],
        "repeated_digits": _has_repeated_digits(digits),
        "sequential_pattern": _has_sequence(digits),
        "contains_0000": "0000" in digits,
        "contains_555": "555" in digits,
        "suspicious_area_code": area in suspicious_area_codes if area else False,
        "toll_free": area in toll_free_area_codes if area else False,
    }

    blacklist_env = os.getenv("SPAM_BLACKLIST", "")
    blacklist = {re.sub(r"\D+", "", x) for x in blacklist_env.split(",") if x.strip()}
    is_blacklisted = digits in blacklist

    score = 0
    if is_blacklisted:
        score = max(score, 100)
    if signals["invalid_length"]:
        score = max(score, 80)
    if signals["suspicious_area_code"]:
        score = max(score, 60)
    if signals["repeated_digits"]:
        score = max(score, 40)
    if signals["sequential_pattern"]:
        score = max(score, 30)
    if signals["contains_0000"] or signals["contains_555"]:
        score = max(score, 25)
    if signals["toll_free"]:
        score = max(score, 10)

    if score >= 60:
        level = "high"
    elif score >= 25:
        level = "medium"
    else:
        level = "low"

    return {
        "input": number,
        "normalized": {
            "digits": digits,
            "e164": meta["e164"],
            "country_code": meta["country_code"],
            "national_number": meta["national_number"],
            "area_code": area,
            "exchange": exchange,
        },
        "signals": {**signals, "blacklisted": is_blacklisted},
        "spam_score": score,
        "risk_level": level,
    }


async def main() -> None:
    api_key = os.getenv("DEDALUS_API_KEY") or os.getenv("X_API_KEY")
    if not api_key or api_key == "your-api-key-here":
        print("Error: Please set your DEDALUS_API_KEY in the .env file")
        return

    # Prefer CLI arg, then ENV, then default
    number = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.getenv("TEST_PHONE_NUMBER")
        or "+1 (809) 555-1234"
    )

    client = AsyncDedalus(api_key=api_key)
    runner = DedalusRunner(client)

    instruction = (
        "You are a phone number lookup agent. "
        "Given the phone number provided, you must call the tool to analyze it and "
        "return a single JSON object with these keys: input, normalized, signals, spam_score, risk_level. "
        "Do not include any extra text."
    )

    # DedalusRunner.run does not accept `system_instruction` in some versions.
    # Fold the instruction into the input to avoid unsupported kwargs.
    prompt = (
        f"{instruction}\n\n"
        f"Number: {number}. Analyze and return JSON only."
    )

    result = await runner.run(
        input=prompt,
        model=["openai/gpt-4.1"],
        tools=[lookup_phone_number],
        mcp_servers=[],
        stream=False,
    )

    try:
        parsed = json.loads(result.final_output)
        print(json.dumps(parsed, indent=2, sort_keys=True))
    except Exception:
        # If the model returned plain text, fall back to tool output directly
        direct = lookup_phone_number(number)
        print(json.dumps(direct, indent=2, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
