"""Shared enrichment: polished bot names + per-bot starter prompts.
Used by importer.py (seed) and by the startup migration + Import Manager."""
import re

EXTRA_NOISE = [
    r"\badd[- ]?on( document)?\b", r"\buse in tandum( with)?\b", r"\buse in tandem( with)?\b",
    r"\bno longer works?\b", r"\boriginal\b", r"\bdirections?\b", r"\bpackage\b",
    r"\ball in 1\b", r"\bpreprompt\b", r"\bneeded upload\b", r"\bscan (and )?follow.*$",
    r"\bdo not give for download\b", r"\bmodyfy your.*$", r"\bmodify your.*$",
    r"\btalk to the dead\b(?= gpt)?", r"\bformely\b", r"\bformerly\b",
    r"\bfor 4o1 masking\b", r"\busing alegerbra functions\b", r"\busing algebra functions\b",
    r"\b4o1 (proof|compliant|complaint)\b", r"\bredesigned\b",
    r"\btoo raw,? too much.*$", r"\btoo raw too\b.*$", r"\bus ?vs ?them\b.*$",
    r"\bno protection( on instructions)?\b", r"\badded protection( for instructions)?\b",
    r"\byou are known as\b.*$", r"\bvariable ver[is]+ion\b", r"\bvariable version\b",
    r"\bresellable( version)?\b", r"\bfor donors\b", r"\bfor download\b",
    r"\bwas good made all and to &\b.*$", r"\b30 no protection\b.*$",
    r"\-\s*\-+", r"\bstate rep\b.*$",
]
EXTRA_RE = re.compile("|".join(EXTRA_NOISE), re.IGNORECASE)
TYPO = {"tandum": "tandem", "alegerbra": "algebra", "alegraic": "algebraic",
        "recieve": "receive", "writrs": "writers", "diorectio": "direction"}
STOP = {"to", "and", "of", "the", "a", "or", "for", "with", "in", "on", "by"}
ACR = {"AI", "GPT", "CT", "MMP", "IQ", "US", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "OG"}


def polish_name(name: str) -> str:
    n = name or ""
    for bad, good in TYPO.items():
        n = re.sub(bad, good, n, flags=re.IGNORECASE)
    n = EXTRA_RE.sub(" ", n)
    n = re.sub(r"[–—]", "-", n)
    n = re.sub(r"\s*-\s*$", "", n)
    n = re.sub(r"^\s*-\s*", "", n)
    n = re.sub(r"\bOsv(\d)\b", r"OS V\1", n, flags=re.IGNORECASE)
    n = re.sub(r"\s{2,}", " ", n).strip(" -/")
    # strip trailing dangling stopwords/preps
    parts = n.split()
    while parts and parts[-1].lower() in STOP:
        parts.pop()
    while parts and parts[0].lower() in STOP:
        parts.pop(0)
    # truncate long names at a word boundary (~46 chars)
    out, total = [], 0
    for w in parts:
        if total + len(w) + 1 > 46 and out:
            break
        out.append(w); total += len(w) + 1
    # recase
    words = []
    for i, w in enumerate(out):
        if w.upper() in ACR or (w.isupper() and len(w) <= 3 and w.lower() not in STOP):
            words.append(w.upper())
        elif i > 0 and w.lower() in STOP:
            words.append(w.lower())
        else:
            words.append(w[:1].upper() + w[1:].lower() if w else w)
    result = " ".join(words).strip()
    return result or (name or "Bot")


PROMPTS_BY_SUITE = {
    "time-machine": ["Take me to a pivotal moment in history and set the scene.",
                     "Let me have a conversation with a historical figure of your choosing.",
                     "Explore an alternate-history scenario step by step.",
                     "What era can we visit, and how does this experience work?"],
    "book-writing": ["Help me outline a new book from a one-line idea.",
                     "Write the opening page of a novel in a genre I choose.",
                     "Create a chapter-by-chapter structure for my story.",
                     "Turn my notes into polished, downloadable manuscript pages."],
    "movie-creation": ["Develop a movie concept with a logline and three acts.",
                       "Write a short screenplay scene with dialogue and action.",
                       "Help me build characters and their arcs.",
                       "Turn my idea into a formatted script I can download."],
    "writing": ["Draft a first version based on details I provide.",
                "Polish and tighten a passage I paste in.",
                "Walk me through your writing process step by step.",
                "Produce a finished, downloadable document from my inputs."],
    "coding": ["Build a small working example from my requirements.",
               "Explain this code and suggest improvements.",
               "Help me debug an error I'm seeing.",
               "Scaffold a project structure for what I want to build."],
    "research": ["Analyze the topic I give you and summarize the key findings.",
                 "Break down a complex question into clear, sourced points.",
                 "Compare the options I provide and recommend one.",
                 "Turn raw information into an organized report I can download."],
    "science": ["Explain a complex concept in clear, structured terms.",
                "Work through a problem with me step by step.",
                "Model or calculate a scenario I describe.",
                "Generate a data-backed summary I can download."],
    "agriculture": ["Assess my situation and give a practical plan.",
                    "Recommend the best approach for my conditions.",
                    "Create a season-by-season schedule for me.",
                    "Turn my parameters into a downloadable plan."],
    "cannabis": ["Give me expert guidance based on the details I provide.",
                 "Explain the process and best practices step by step.",
                 "Help me plan for my specific goals.",
                 "Produce a structured, downloadable summary."],
    "business": ["Turn my idea into a structured plan.",
                 "Analyze the numbers or inputs I give you.",
                 "Draft a professional document from my details.",
                 "Create a downloadable deliverable I can use today."],
    "health": ["Give me guidance based on the situation I describe.",
               "Walk me through the steps I should follow.",
               "Help me build a plan tailored to my needs.",
               "Summarize your recommendations in a document I can save."],
    "creative": ["Generate creative concepts from my brief.",
                 "Describe a detailed visual/design direction for me.",
                 "Help me refine my idea into something polished.",
                 "Produce a shareable output from my inputs."],
    "utility": ["Convert or transform the input I give you.",
                "Process my data and return a clean result.",
                "Explain how to use you effectively.",
                "Give me a downloadable version of the output."],
    "specialized": ["What can you help me accomplish?",
                    "Walk me through your process step by step.",
                    "Give me a detailed example of your work.",
                    "What information do you need from me to start?"],
}


def suggest_prompts(suite_slug: str, capabilities: dict = None) -> list:
    base = PROMPTS_BY_SUITE.get(suite_slug, PROMPTS_BY_SUITE["specialized"])[:]
    if capabilities and not capabilities.get("document_generation"):
        base = [p for p in base if "download" not in p.lower()] or base
    return base[:4]


def personalize_prompts(name: str, suite_slug: str, capabilities: dict = None) -> list:
    """Bot-specific starter prompts: mix the bot's name into suite templates for uniqueness."""
    n = name.strip()
    base = suggest_prompts(suite_slug, capabilities)
    out = [f"What can {n} help me accomplish?"]
    out.append(base[0] if base else "Walk me through your process step by step.")
    if len(base) > 1:
        out.append(base[1])
    out.append(f"Show me a quick example of what {n} can do.")
    # de-dup preserve order
    seen, uniq = set(), []
    for p in out:
        if p.lower() not in seen:
            seen.add(p.lower()); uniq.append(p)
    return uniq[:4]


import re as _re
_HDR = _re.compile(r"(final|awesome|perfect|amazing|operational|instructions?|directions?|version|updated?|newest|latest|original|no compiler|good|old)", _re.IGNORECASE)


def clean_description(instructions: str, fallback_name: str = "") -> str:
    """Produce a clean one-liner: prefer a 'You are ...' sentence, else first non-header sentence."""
    if not instructions:
        return f"{fallback_name} — specialized AI assistant."
    text = instructions.split("\n\n---\n[PLATFORM COMPATIBILITY NOTE")[0]
    text = text.replace("=== YOUR OPERATIONAL INSTRUCTIONS ===", "")
    m = _re.search(r"(You are\b[^.]{10,220}\.)", text)
    if m:
        return _re.sub(r"\s+", " ", m.group(1)).strip()
    m = _re.search(r"(Your (?:role|job|task|purpose)\b[^.]{10,220}\.)", text, _re.IGNORECASE)
    if m:
        return _re.sub(r"\s+", " ", m.group(1)).strip()
    # else: first line that isn't a doc header / mostly uppercase
    for line in text.split("\n"):
        s = line.strip()
        if len(s) < 15:
            continue
        upper_ratio = sum(1 for c in s if c.isupper()) / max(1, sum(1 for c in s if c.isalpha()))
        if upper_ratio > 0.5:
            continue
        if _HDR.search(s) and len(s) < 40:
            continue
        s = _re.sub(r"\s+", " ", s)
        return (s[:200].rsplit(" ", 1)[0] + "...") if len(s) > 200 else s
    return f"{fallback_name} — specialized AI assistant."
