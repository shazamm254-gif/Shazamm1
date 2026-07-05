#!/usr/bin/env python3
"""
niche_generator.py — discover and score new viral niches or sub-niches for
short-form content (YouTube Shorts / TikTok / Reels).

Combines a library of proven content categories ("parents") with content
"angles" (hook mechanics like What-If, Myth-Busting, POV Simulation) to mint
fresh niche/sub-niche combinations, then scores each one 0-100 on the five
things that actually predict whether a faceless Shorts channel takes off:

    hook strength       — does the format create an instant curiosity gap?
    audience demand     — is there a real built-in audience already searching?
    competition headroom — how uncontested is this specific combination?
    repeatability       — deep enough well of ideas to post for months?
    production feasibility — can an AI/faceless creator actually make it?

Works two ways:
  * Default: instant, free, offline — combinatorial generation from a curated
    niche/angle library with a transparent, reproducible scoring rubric.
  * --use-claude: creative, trend-aware niche ideas, self-scored by the model
    on the same 5 factors so results are comparable to the offline ones
    (needs ANTHROPIC_API_KEY).

Usage:
    python tools/niche_generator.py -n 10
    python tools/niche_generator.py -n 5 --parent "true crime"
    python tools/niche_generator.py -n 8 --use-claude
    python tools/niche_generator.py --list-parents

    # Drop the #1 (or any) result straight into the toolkit's niche format:
    python tools/niche_generator.py -n 8 --export 1 -o tools/niche_generated.json
"""

import argparse
import json
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Parent categories. Each is a proven short-form content space, rated 1-10 on
# demand (size of the built-in audience), competition (how saturated it is),
# evergreen (depth of source material), and feasibility (how doable it is as
# a faceless/AI channel with no filming or on-camera talent).
# ---------------------------------------------------------------------------
PARENTS = [
    {"key": "cosmic_horror", "name": "Cosmic & Space Horror", "tag": "Cosmic",
     "demand": 8, "competition": 7, "evergreen": 9, "feasibility": 9,
     "description": "The universe is vast, ancient, and mostly hostile to life — "
                     "cosmic facts that induce existential dread.",
     "vocab": ["a black hole", "a rogue planet", "the heat death of the universe",
               "a gamma-ray burst", "Sagittarius A*", "a magnetar",
               "the edge of the observable universe", "a dying star",
               "dark matter", "the Great Attractor"],
     "hashtags": ["#space", "#universe", "#cosmichorror", "#astronomy", "#blackhole", "#nasa"],
     "pillars": ["Space horror (black holes, dying stars)", "Cosmic scale (impossibly big/old things)",
                 "The far future (heat death, entropy)", "Unexplained anomalies",
                 "What-if cosmic disasters"]},
    {"key": "true_crime", "name": "True Crime", "tag": "True Crime",
     "demand": 9, "competition": 9, "evergreen": 8, "feasibility": 6,
     "description": "Real unsolved cases, forensic breakthroughs, and criminal "
                     "psychology — one of the most reliably watched genres online.",
     "vocab": ["an unsolved disappearance", "a cold case", "a serial killer's pattern",
               "a wrongful conviction", "a forensic anomaly", "a killer's confession",
               "a missing piece of evidence", "a copycat crime", "a criminal profile",
               "a court transcript"],
     "hashtags": ["#truecrime", "#coldcase", "#unsolved", "#crimejunkie", "#forensics"],
     "pillars": ["Unsolved cases", "Forensic science breakthroughs", "Criminal psychology",
                 "Wrongful convictions", "Courtroom twists"]},
    {"key": "mind_psych", "name": "Mind & Psychology", "tag": "Mind",
     "demand": 8, "competition": 7, "evergreen": 9, "feasibility": 9,
     "description": "How the brain tricks, manipulates, and rewires itself — psychology "
                     "facts that make viewers question their own head.",
     "vocab": ["a cognitive bias", "a manipulation tactic", "a childhood trauma pattern",
               "a personality trait", "a memory distortion", "a dark psychology trick",
               "an attachment style", "a subconscious habit", "a persuasion technique",
               "a mental health symptom"],
     "hashtags": ["#psychology", "#mindset", "#darkpsychology", "#mentalhealth", "#selfimprovement"],
     "pillars": ["Cognitive biases", "Dark psychology & manipulation", "Trauma & attachment",
                 "Persuasion & influence", "Disorders explained"]},
    {"key": "ancient_history", "name": "Ancient History & Archaeology", "tag": "Ancient",
     "demand": 7, "competition": 6, "evergreen": 9, "feasibility": 8,
     "description": "Lost civilizations, impossible ruins, and archaeological finds "
                     "that rewrite the timeline.",
     "vocab": ["a lost city", "an ancient artifact", "a forbidden tomb",
               "a civilization that vanished", "an undeciphered script",
               "a megalithic structure", "a burial ritual", "an ancient prophecy",
               "a looted relic", "a construction technique we can't replicate"],
     "hashtags": ["#ancienthistory", "#archaeology", "#history", "#lostcivilization", "#mystery"],
     "pillars": ["Lost civilizations", "Impossible ruins & engineering", "Ancient mysteries",
                 "Archaeological discoveries", "Rewriting the timeline"]},
    {"key": "mythology", "name": "Mythology & Folklore", "tag": "Mythic",
     "demand": 6, "competition": 5, "evergreen": 9, "feasibility": 9,
     "description": "Gods, monsters, and folk legends from every culture — timeless "
                     "stories retold for a scroll-first audience.",
     "vocab": ["a forgotten god", "a folk monster", "a creation myth", "a cursed object",
               "a trickster legend", "an underworld myth", "a village folk tale",
               "a monster's origin", "a mythic prophecy", "a banished deity"],
     "hashtags": ["#mythology", "#folklore", "#legends", "#mythicalcreatures", "#foryou"],
     "pillars": ["Gods & pantheons", "Monsters & cryptids", "Creation myths",
                 "Cursed objects & rituals", "Regional folklore"]},
    {"key": "survival", "name": "Survival & Disaster Scenarios", "tag": "Survival",
     "demand": 7, "competition": 6, "evergreen": 8, "feasibility": 7,
     "description": "What it actually takes to survive the worst-case scenario — "
                     "practical, high-stakes, adrenaline-coded.",
     "vocab": ["a plane crash in the wilderness", "a grid-down blackout", "a flash flood",
               "being lost at sea", "a wildfire evacuation", "an avalanche",
               "a desert stranding", "a nuclear fallout scenario", "a home invasion",
               "a shipwreck"],
     "hashtags": ["#survival", "#preparedness", "#disaster", "#bushcraft", "#whatwouldyoudo"],
     "pillars": ["Wilderness survival", "Urban disaster scenarios", "Gear & preparedness myths",
                 "Real survivor stories", "Worst-case walkthroughs"]},
    {"key": "money_psych", "name": "Money & Financial Psychology", "tag": "Money",
     "demand": 8, "competition": 8, "evergreen": 8, "feasibility": 9,
     "description": "Why smart people make dumb money decisions — behavioral finance "
                     "and wealth psychology.",
     "vocab": ["a spending trigger", "a wealth psychology trap", "a scarcity mindset habit",
               "a lifestyle-inflation trap", "an investing bias", "a get-rich-quick scheme",
               "a millionaire habit", "a debt spiral", "a pricing psychology trick",
               "a hidden fee"],
     "hashtags": ["#money", "#personalfinance", "#wealthmindset", "#investing", "#financialfreedom"],
     "pillars": ["Behavioral finance traps", "Wealth-building habits", "Pricing & marketing psychology",
                 "Debt & scarcity mindset", "Rich vs. broke mindset"]},
    {"key": "deep_sea", "name": "Ocean & Deep Sea", "tag": "Deep-Sea",
     "demand": 7, "competition": 5, "evergreen": 9, "feasibility": 8,
     "description": "The ocean is less explored than Mars — deep-sea creatures and "
                     "abyssal phenomena that feel alien.",
     "vocab": ["a deep-sea creature", "the Mariana Trench", "a bioluminescent predator",
               "an underwater sinkhole", "a giant squid encounter",
               "a hydrothermal vent ecosystem", "a shipwreck at depth",
               "an unexplained sonar ping", "a pressure-crushed object", "a sea monster legend"],
     "hashtags": ["#ocean", "#deepsea", "#thalassophobia", "#marinebiology", "#cryptid"],
     "pillars": ["Deep-sea creatures", "Unexplored trenches & vents", "Shipwrecks & sonar mysteries",
                 "Thalassophobia-inducing facts", "Sea monster legends vs. reality"]},
    {"key": "human_body", "name": "Human Body Oddities", "tag": "Body",
     "demand": 7, "competition": 6, "evergreen": 9, "feasibility": 9,
     "description": "The body does things that sound fake but aren't — medical "
                     "oddities, rare conditions, and biological limits.",
     "vocab": ["a rare medical condition", "a biological limit", "a surgical case",
               "a genetic mutation", "a survival record", "a parasite's life cycle",
               "an organ transplant fact", "a pain-tolerance case", "a sleep disorder",
               "a body's healing mechanism"],
     "hashtags": ["#medicine", "#humanbody", "#biology", "#rarecondition", "#medicaltiktok"],
     "pillars": ["Rare medical conditions", "Biological extremes & records",
                 "Surgery & medical history", "Genetic oddities", "How the body actually works"]},
    {"key": "dark_tech", "name": "Dark Tech & AI", "tag": "Dark Tech",
     "demand": 8, "competition": 6, "evergreen": 7, "feasibility": 9,
     "description": "The unsettling side of AI, surveillance, and emerging tech — "
                     "where innovation gets creepy.",
     "vocab": ["an AI model behaving unexpectedly", "a surveillance technology",
               "a deepfake case", "a data-harvesting practice", "a rogue algorithm",
               "a leaked internal AI test", "a predictive-policing tool",
               "a social-media dark pattern", "an AI safety incident", "a robotics failure"],
     "hashtags": ["#ai", "#technology", "#futuretech", "#privacy", "#blackmirror"],
     "pillars": ["AI going wrong", "Surveillance & privacy", "Deepfakes & misinformation",
                 "Dark patterns in tech", "Real Black-Mirror-style cases"]},
    {"key": "military", "name": "Military & Declassified Ops", "tag": "Ops",
     "demand": 7, "competition": 6, "evergreen": 8, "feasibility": 7,
     "description": "Declassified missions, secret weapons, and military history "
                     "stranger than fiction.",
     "vocab": ["a declassified mission", "a secret weapons program", "a covert operation",
               "a Cold War incident", "a failed military experiment", "a black-budget project",
               "a wartime deception tactic", "a near-miss nuclear incident",
               "a special-forces operation", "a leaked military document"],
     "hashtags": ["#military", "#history", "#declassified", "#coldwar", "#specialforces"],
     "pillars": ["Declassified operations", "Secret weapons programs", "Cold War close calls",
                 "Military deception tactics", "Special forces history"]},
    {"key": "hidden_history", "name": "Conspiracy & Hidden History", "tag": "Hidden History",
     "demand": 7, "competition": 7, "evergreen": 8, "feasibility": 8,
     "description": "Suppressed history and contested official narratives — "
                     "investigated critically, not credulously.",
     "vocab": ["a censored historical event", "a cover-up", "a suppressed document",
               "a disputed official story", "a whistleblower account", "a redacted report",
               "an erased historical figure", "a banned book's claims",
               "a corporate cover-up", "a government experiment"],
     "hashtags": ["#hiddenhistory", "#conspiracy", "#declassified", "#documentary", "#history"],
     "pillars": ["Cover-ups & suppressed events", "Whistleblower stories",
                 "Redacted documents examined", "Disputed official narratives",
                 "Government experiments"]},
    {"key": "extreme_weather", "name": "Extreme Weather & Natural Disasters", "tag": "Extreme Weather",
     "demand": 6, "competition": 5, "evergreen": 9, "feasibility": 8,
     "description": "The planet's most violent weather events — scale and destruction "
                     "that's hard to comprehend.",
     "vocab": ["a supercell tornado", "a megaflood", "a volcanic supereruption",
               "a heat dome", "a hundred-year storm", "a megatsunami", "a firestorm",
               "an ice age tipping point", "a record-breaking hurricane",
               "a sudden climate shift"],
     "hashtags": ["#weather", "#naturaldisaster", "#stormchasing", "#climate", "#tornado"],
     "pillars": ["Record-breaking storms", "Volcanic & seismic events", "Megafloods & tsunamis",
                 "Climate tipping points", "Historical disaster case studies"]},
    {"key": "animal_extremes", "name": "Animal Kingdom Extremes", "tag": "Animal",
     "demand": 7, "competition": 6, "evergreen": 9, "feasibility": 9,
     "description": "Nature's most extreme survival adaptations and brutal "
                     "predator-prey dynamics.",
     "vocab": ["a predator's hunting strategy", "an extreme survival adaptation",
               "a venom's effect", "a parasitic takeover", "a brutal mating ritual",
               "an apex predator showdown", "a de-extinction candidate",
               "a record-holding animal", "a symbiotic relationship",
               "an animal's defense mechanism"],
     "hashtags": ["#animals", "#nature", "#wildlife", "#natureismetal", "#animalfacts"],
     "pillars": ["Extreme adaptations", "Predator vs. prey showdowns", "Venom & parasites",
                 "Record-holding animals", "Bizarre mating & survival rituals"]},
    {"key": "sleep_dreams", "name": "Sleep & Dreams", "tag": "Dream",
     "demand": 6, "competition": 4, "evergreen": 8, "feasibility": 9,
     "description": "The unexplained science of sleep, dreams, and the sleeping "
                     "brain — relatable to literally everyone.",
     "vocab": ["a lucid dreaming technique", "a sleep paralysis case",
               "a recurring nightmare pattern", "a dream-interpretation theory",
               "a sleep disorder", "a circadian rhythm disruption",
               "an unexplained sleep phenomenon", "a near-death sleep experience",
               "a dream recall trick", "a microsleep incident"],
     "hashtags": ["#sleep", "#dreams", "#luciddreaming", "#sleepparalysis", "#psychology"],
     "pillars": ["Lucid dreaming & dream control", "Sleep paralysis & parasomnias",
                 "Dream interpretation theories", "Sleep science & disorders",
                 "Unexplained sleep phenomena"]},
    {"key": "linguistics", "name": "Language & Linguistics Oddities", "tag": "Language",
     "demand": 5, "competition": 3, "evergreen": 9, "feasibility": 9,
     "description": "Untranslatable words, dying languages, and the weird rules hiding "
                     "inside every language — low competition, high curiosity.",
     "vocab": ["an untranslatable word", "a dying language", "a linguistic rule everyone breaks",
               "a language isolate", "a lost alphabet", "a false cognate",
               "a language with no numbers", "a secret trade language",
               "a word that changed meaning", "an invented language"],
     "hashtags": ["#linguistics", "#language", "#etymology", "#words", "#learnontiktok"],
     "pillars": ["Untranslatable words", "Dying & endangered languages", "Weird grammar rules",
                 "Etymology deep dives", "Invented & secret languages"]},
    {"key": "dark_botany", "name": "Dark Botany", "tag": "Dark Botany",
     "demand": 7, "competition": 4, "evergreen": 9, "feasibility": 9,
     "description": "Plants as characters in dark stories — poison, medicine, and the history "
                     "connecting them, told as science and storytelling, never as a remedy to try.",
     "vocab": ["a deadly nightshade berry", "an aconite root", "a castor bean's ricin",
               "a water hemlock stalk", "a foxglove leaf's digoxin",
               "willow bark's aspirin lineage", "a Madagascar periwinkle's chemo compound",
               "the opium wars", "an ergot-poisoned harvest", "a radium-laced patent tonic",
               "quinine and the age of empire", "a mandrake root legend"],
     "hashtags": ["#darkbotany", "#poisonousplants", "#planthistory", "#toxicology",
                  "#plantlore", "#darkhistory"],
     "pillars": ["Poison garden: kill mechanisms of deadly plants",
                 "Plants that became medicine: folk remedy to real pharmacology",
                 "Plants that changed history: wars, witch trials, empires",
                 "Botanical myth-busting: did grandma's remedy actually work?",
                 "Plant folklore & superstition"],
     # Never frame these as "this herb cures X" — history/science storytelling only,
     # to stay clear of YouTube's medical-claims policy.
     "sample_hooks": [
         "This flower killed more Roman emperors than war did.",
         "Aspirin started as tree bark. Nobody tells you that part.",
         "A witch trial and a moldy loaf of bread have more in common than you'd think.",
         "This houseplant is one bite away from a coroner's report."]},
]

# ---------------------------------------------------------------------------
# Angles: the hook mechanic / format applied to a parent category to produce
# a sub-niche. Each hook template must contain exactly one {x} placeholder,
# filled from the parent's vocab list.
# ---------------------------------------------------------------------------
ANGLES = [
    {"key": "what_if", "label": "What-If Scenarios", "name_template": "{tag} What-Ifs",
     "hook_strength": 9, "repeatability": 9, "feasibility": 9,
     "description": "Poses a vivid hypothetical and answers it — one of the most reliable "
                     "curiosity-gap formats because it promises a payoff in the first sentence.",
     "hook_templates": [
         "What if {x} happened tomorrow? Here's what would actually happen.",
         "What if {x}? Scientists ran the numbers.",
         "This is what {x} would actually look like.",
         "Nobody's ready for what happens if {x}.",
         "Here's exactly what happens when {x}."]},
    {"key": "forbidden", "label": "Forbidden / Banned Facts", "name_template": "Forbidden {tag}",
     "hook_strength": 9, "repeatability": 7, "feasibility": 8,
     "description": "Frames the fact as secret or suppressed knowledge — taps directly into "
                     "curiosity and distrust; needs real sourcing to stay credible.",
     "hook_templates": [
         "They don't want you to know about {x}.",
         "The story of {x} was buried for decades.",
         "{x} was classified. Here's why.",
         "You were never supposed to hear about {x}.",
         "The truth about {x} almost got erased."]},
    {"key": "debunk", "label": "Myth-Busting", "name_template": "{tag} Myths, Busted",
     "hook_strength": 8, "repeatability": 8, "feasibility": 8,
     "description": "Corrects a widely-believed misconception — triggers an ego-driven need "
                     "to know if you've been wrong, a proven Shorts hook.",
     "hook_templates": [
         "Everything you believe about {x} is wrong.",
         "The truth about {x} isn't what you were taught.",
         "{x} is a myth. Here's what's real.",
         "Stop believing this about {x}.",
         "This 'fact' about {x} is completely false."]},
    {"key": "countdown", "label": "Ranked Countdowns", "name_template": "Ranking {tag}",
     "hook_strength": 7, "repeatability": 8, "feasibility": 8,
     "description": "Ranked/list format gives viewers a reason to watch to the end — reliable "
                     "retention driver, easy to batch-produce from a single research pass.",
     "hook_templates": [
         "The most extreme {x} ever recorded.",
         "Ranking the wildest cases of {x}.",
         "Number one will change how you see {x}.",
         "These are the most insane examples of {x}.",
         "Only a few {x} cases make this list."]},
    {"key": "hidden_history_angle", "label": "Hidden/Secret History", "name_template": "The Hidden History of {tag}",
     "hook_strength": 8, "repeatability": 8, "feasibility": 8,
     "description": "Reframes known history as incomplete or hidden — strong for evergreen "
                     "topics since the 'untold story' angle applies to almost any fact.",
     "hook_templates": [
         "The real story of {x} was never taught in school.",
         "History left out this part of {x}.",
         "What really happened with {x} was covered up.",
         "The textbook version of {x} isn't the full story.",
         "This part of {x} was erased from history."]},
    {"key": "pov_sim", "label": "POV Simulation", "name_template": "{tag}: Lived Through It",
     "hook_strength": 9, "repeatability": 7, "feasibility": 7,
     "description": "Second-person framing puts the viewer inside the stakes instead of "
                     "describing them from a distance — high engagement, needs strong visuals.",
     "hook_templates": [
         "You wake up inside {x}. This is what happens next.",
         "POV: you're experiencing {x} right now.",
         "You have 10 seconds before {x}. What do you do?",
         "Imagine surviving {x}. Most people don't.",
         "This is what it feels like to go through {x}."]},
    {"key": "worst_case", "label": "Worst-Case Breakdown", "name_template": "Worst-Case {tag}",
     "hook_strength": 8, "repeatability": 7, "feasibility": 8,
     "description": "Escalates a real risk to its logical extreme — taps fear-based curiosity "
                     "while staying grounded in real mechanics.",
     "hook_templates": [
         "Here's the actual worst-case version of {x}.",
         "This is how bad {x} can really get.",
         "{x}, at its absolute worst.",
         "Most people underestimate how bad {x} can be.",
         "This is the nightmare scenario for {x}."]},
    {"key": "deep_dive", "label": "60-Second Deep Dive", "name_template": "{tag} Explained in 60 Seconds",
     "hook_strength": 7, "repeatability": 9, "feasibility": 9,
     "description": "Positions the channel as the trustworthy explainer — lower viral ceiling "
                     "per video, but the most repeatable format and builds subscriber trust fastest.",
     "hook_templates": [
         "Here's the one thing nobody explains about {x}.",
         "{x}, explained properly, in under a minute.",
         "The part of {x} that actually matters.",
         "This finally explains {x} in plain English.",
         "Everyone gets {x} wrong. Here's the real explanation."]},
    {"key": "compare_extremes", "label": "Extreme Comparisons", "name_template": "{tag}: Biggest vs. Smallest",
     "hook_strength": 7, "repeatability": 7, "feasibility": 8,
     "description": "Uses scale and comparison to create a visceral 'my brain can't process "
                     "this' reaction — pairs well with visual, numeric topics.",
     "hook_templates": [
         "This {x} makes every record book obsolete.",
         "Compare the biggest and smallest {x} — the gap is absurd.",
         "Nothing prepares you for how extreme {x} gets.",
         "{x} pushed past every known limit.",
         "The scale of {x} doesn't make sense to the human brain."]},
    {"key": "investigation", "label": "Case Investigation", "name_template": "{tag}: The Case Files",
     "hook_strength": 8, "repeatability": 8, "feasibility": 6,
     "description": "Structures the fact as an open case with evidence to weigh — strong "
                     "completion rate because it promises a resolution.",
     "hook_templates": [
         "This case involving {x} was never officially closed.",
         "The evidence around {x} doesn't add up.",
         "Investigators still can't fully explain {x}.",
         "Here's every piece of evidence on {x}.",
         "This {x} case has a detail nobody talks about."]},
    {"key": "time_capsule", "label": "Future Time Capsule", "name_template": "{tag} in 100 Years",
     "hook_strength": 7, "repeatability": 7, "feasibility": 8,
     "description": "Projects a topic decades or centuries forward — taps curiosity and mild "
                     "anxiety about change; works well for tech, climate, and finance niches.",
     "hook_templates": [
         "This is what {x} looks like in 100 years.",
         "In a century, {x} won't exist. Here's why.",
         "Scientists predict {x} will look completely different by 2150.",
         "{x} is quietly changing forever — here's the timeline.",
         "This is the future of {x}, and it's sooner than you think."]},
    {"key": "expert_reveal", "label": "Expert Reveals", "name_template": "{tag}: What Experts Actually Know",
     "hook_strength": 8, "repeatability": 8, "feasibility": 7,
     "description": "Positions the content as insider knowledge from practitioners — builds "
                     "authority while keeping the curiosity-gap hook.",
     "hook_templates": [
         "Experts on {x} know something the public doesn't.",
         "Here's what professionals actually think about {x}.",
         "Insiders don't talk about {x} like this in public.",
         "This is the part of {x} only specialists understand.",
         "What actually happens behind the scenes of {x}."]},
]

WEIGHTS = {"hook": 2.5, "demand": 2.0, "headroom": 2.0, "repeat": 2.0, "feasibility": 1.5}


def tier_for(score):
    if score >= 85:
        return "S-TIER — build this channel today"
    if score >= 70:
        return "A-TIER — strong, defensible pick"
    if score >= 55:
        return "B-TIER — viable, needs a sharp angle"
    return "C-TIER — risky: too saturated or too thin"


def bucket(value, high, mid, low, hi_thresh=8, mid_thresh=5):
    if value >= hi_thresh:
        return high
    if value >= mid_thresh:
        return mid
    return low


def explain(item, headroom, score):
    """Build the 'why this niche works' bullets from the 5 scored factors."""
    hook, demand = item["hook_strength"], item["demand"]
    repeat, feas = item["repeatability"], item["feasibility"]
    bullets = [item.get("blurb", "")] if item.get("blurb") else []

    bullets.append(bucket(
        hook,
        f"Strong hook mechanics ({hook}/10): the '{item['angle_label']}' format creates "
        f"an instant curiosity gap — that's what decides swipe-away vs. watch in the first 2 seconds.",
        f"Decent hook mechanics ({hook}/10): works, but needs punchy copywriting to stand out.",
        f"Weak hook mechanics ({hook}/10): more informational than curiosity-driven — expect "
        f"lower average view duration unless the topic itself is shocking."))

    bullets.append(bucket(
        demand,
        f"High built-in audience demand ({demand}/10): a large, already-engaged audience "
        f"actively searches this space.",
        f"Moderate audience demand ({demand}/10): a real but not massive built-in audience.",
        f"Small built-in audience ({demand}/10): fewer people are searching for this, but "
        f"that's also why competition is low."))

    bullets.append(bucket(
        headroom,
        f"Low competition ({headroom}/10 headroom): this combination is still underexplored "
        f"relative to demand — real room to become a top result.",
        f"Moderate competition ({headroom}/10 headroom): established channels exist, but a "
        f"sharper hook or faster cadence can still break through.",
        f"Saturated ({headroom}/10 headroom): this space is crowded — you'll need a genuinely "
        f"different angle or higher output to compete.",
        hi_thresh=7, mid_thresh=4))

    bullets.append(bucket(
        repeat,
        f"Deep content well ({repeat}/10): near-endless source material — you won't run out "
        f"of ideas for months of consistent posting.",
        f"Solid content well ({repeat}/10): enough material for consistent posting; plan to "
        f"rotate angles every few weeks.",
        f"Thin content well ({repeat}/10): you'll exhaust the obvious ideas fast — budget time "
        f"to keep finding new source material."))

    bullets.append(bucket(
        feas,
        f"Fully faceless/AI-producible ({feas}/10): script + voiceover + AI/stock visuals — "
        f"no filming or on-camera talent needed.",
        f"Mostly faceless-friendly ({feas}/10): doable with AI/stock visuals, though some "
        f"videos may benefit from real footage or specific expertise.",
        f"Production-heavy ({feas}/10): expect to need real footage, interviews, or specialist "
        f"knowledge — harder to run as a pure faceless AI channel."))

    bullets.append(f"Overall: {score}/100 — {tier_for(score)}.")
    return [b for b in bullets if b]


def score_niche(item):
    headroom = 11 - item["competition"]
    raw = (item["hook_strength"] * WEIGHTS["hook"] + item["demand"] * WEIGHTS["demand"]
           + headroom * WEIGHTS["headroom"] + item["repeatability"] * WEIGHTS["repeat"]
           + item["feasibility"] * WEIGHTS["feasibility"])
    score = max(0, min(100, round(raw)))
    return score, tier_for(score), explain(item, headroom, score)


def slugify(name):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


def generate_offline(n, parent_filter, rng):
    parents = PARENTS
    if parent_filter:
        f = parent_filter.lower()
        parents = [p for p in parents if f in p["name"].lower() or f in p["key"]]
        if not parents:
            sys.exit(f"No parent category matches --parent {parent_filter!r}. "
                      f"Run --list-parents to see options.")

    combos = [(p, a) for p in parents for a in ANGLES]
    rng.shuffle(combos)
    if len(combos) < n:
        # not enough unique combos — allow repeats of parents with different angles first,
        # then just repeat with re-shuffled angle order
        while len(combos) < n:
            combos += [(p, a) for p in parents for a in ANGLES]
        rng.shuffle(combos)

    results = []
    for parent, angle in combos[:n]:
        name = angle["name_template"].format(tag=parent["tag"])
        vocab_pick = rng.choice(parent["vocab"])
        hook_template = rng.choice(angle["hook_templates"])
        hook_example = hook_template.replace("{x}", vocab_pick)
        hook_example = hook_example[0].upper() + hook_example[1:]
        one_liner = (f"{parent['description']} This sub-niche runs it through "
                      f"{angle['label'].lower()}.")

        item = {
            "name": name,
            "parent": parent["name"],
            "angle": angle["label"],
            "angle_label": angle["label"],
            "one_liner": one_liner,
            "hook_example": hook_example,
            "blurb": parent["description"],
            "hook_strength": angle["hook_strength"],
            "demand": parent["demand"],
            "competition": parent["competition"],
            "repeatability": round((parent["evergreen"] + angle["repeatability"]) / 2),
            "feasibility": round((parent["feasibility"] + angle["feasibility"]) / 2),
            "_parent": parent,
            "_angle": angle,
        }
        score, tier, why = score_niche(item)
        item.update(score=score, tier=tier, why=why)
        results.append(item)

    results.sort(key=lambda r: r["score"], reverse=True)
    return results


CLAUDE_SCHEMA_HINT = """Return ONLY a JSON array (no prose, no markdown fences). Each element:
{
  "name": "catchy sub-niche/channel name",
  "parent_category": "broad category this belongs to",
  "angle": "the hook mechanic/format used (e.g. What-If, Myth-Busting, POV Simulation)",
  "one_liner": "1-2 sentence pitch for the sub-niche",
  "hook_example": "one example first-line hook for a Short in this sub-niche",
  "reasoning": "2-3 sentences on why this specific combination works right now",
  "hook_strength": 1-10,
  "demand": 1-10,
  "competition": 1-10 (10 = extremely saturated),
  "repeatability": 1-10,
  "feasibility": 1-10 (10 = fully doable with AI voiceover + AI/stock visuals, no filming),
  "pillars": ["4-5 recurring content pillar strings"],
  "hashtags": ["5-8 hashtags, no #shorts"],
  "vocab": ["8-12 short topic phrases usable to fill a hook template's blank"],
  "hook_templates": ["4-5 hook sentence templates, each containing exactly one {x} placeholder"]
}"""


def generate_claude(n, parent_filter, theme):
    try:
        import anthropic
    except ImportError:
        print("--use-claude needs the anthropic package:  pip install anthropic")
        return None
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("--use-claude needs ANTHROPIC_API_KEY (see .env.example).")
        return None

    client = anthropic.Anthropic()
    focus_line = f"\nFocus on the broad category/theme: {parent_filter}\n" if parent_filter else ""
    theme_line = f"\nLean into this current trend/theme: {theme}\n" if theme else ""
    prompt = (
        f"You are a short-form content strategist finding new viral niches and sub-niches "
        f"for faceless YouTube Shorts / TikTok / Reels channels (AI voiceover + AI or stock "
        f"visuals, no on-camera talent).\n"
        f"{focus_line}{theme_line}\n"
        f"Generate {n} distinct, specific sub-niche ideas — combine a content category with "
        f"a hook mechanic/format to make something more specific than 'true crime' or 'space "
        f"facts'. Favor ideas with real, honest tradeoffs: rate them candidly, don't inflate "
        f"scores. Score each on the 1-10 scales described below.\n\n"
        f"{CLAUDE_SCHEMA_HINT}"
    )
    msg = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4000,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if b.type == "text")
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        print("Claude didn't return parseable JSON. Raw output:\n" + text)
        return None
    try:
        raw_items = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        print(f"Couldn't parse Claude's JSON ({e}). Raw output:\n" + text)
        return None

    results = []
    for r in raw_items:
        item = {
            "name": r.get("name", "Untitled niche"),
            "parent": r.get("parent_category", ""),
            "angle": r.get("angle", ""),
            "angle_label": r.get("angle", "this format"),
            "one_liner": r.get("one_liner", ""),
            "hook_example": r.get("hook_example", ""),
            "blurb": r.get("reasoning", ""),
            "hook_strength": int(r.get("hook_strength", 5)),
            "demand": int(r.get("demand", 5)),
            "competition": int(r.get("competition", 5)),
            "repeatability": int(r.get("repeatability", 5)),
            "feasibility": int(r.get("feasibility", 5)),
            "pillars": r.get("pillars", []),
            "hashtags": r.get("hashtags", []),
            "vocab": r.get("vocab", []),
            "hook_templates": r.get("hook_templates", []),
        }
        score, tier, why = score_niche(item)
        item.update(score=score, tier=tier, why=why)
        results.append(item)

    results.sort(key=lambda r: r["score"], reverse=True)
    return results


def print_report(results, label):
    print(f"\n  Viral Niche Generator — {label}")
    print("  " + "=" * 64)
    for i, r in enumerate(results, 1):
        print(f"\n  {i}. {r['name']}  —  {r['score']}/100  ({r['tier']})")
        print("  " + "-" * 64)
        if r.get("parent") or r.get("angle"):
            print(f"   Category: {r['parent']}   Angle: {r['angle']}")
        if r.get("one_liner"):
            print(f"   {r['one_liner']}")
        if r.get("hook_example"):
            print(f"   Sample hook: \"{r['hook_example']}\"")
        print("   Why it works:")
        for b in r["why"]:
            print(f"     - {b}")
    print()


def export_niche(item, output_path):
    parent = item.get("_parent")
    angle = item.get("_angle")
    if parent and angle:
        pillars = parent["pillars"]
        hashtags = parent["hashtags"]
        vocab = parent["vocab"]
        hook_templates = angle["hook_templates"]
        audience = f"Audience already engaged with {parent['name'].lower()} content."
        tone = f"{angle['label']} — {angle['description']}"
    else:
        pillars = item.get("pillars") or [item["one_liner"]]
        hashtags = item.get("hashtags") or []
        vocab = item.get("vocab") or []
        hook_templates = item.get("hook_templates") or []
        audience = item.get("one_liner", "")
        tone = item.get("blurb", "")

    niche_doc = {
        "channel_name": item["name"],
        "handle": "@" + slugify(item["name"]).replace("-", ""),
        "one_line": item.get("one_liner", ""),
        "pillars": pillars,
        "audience": audience,
        "tone": tone,
        "core_hashtags": hashtags[:5],
        "extra_hashtags": hashtags[5:] + ["#shorts"],
        "hook_templates": hook_templates,
        "title_keywords": [v.split(" ", 1)[-1] if v.startswith(("a ", "an ", "the "))
                            else v for v in vocab][:12],
        "fillers": {"x": vocab},
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(niche_doc, f, indent=2)
        f.write("\n")
    print(f"\n  Exported {item['name']!r} -> {output_path}")
    print(f"  Copy it over tools/niche.json (or point --niche-file at it, if your tools "
          f"support that) to retune the rest of the toolkit to this niche.\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-n", "--count", type=int, default=8)
    ap.add_argument("--parent", default="", help="Filter/focus on one category "
                    "(substring match, e.g. 'true crime' or 'cosmic')")
    ap.add_argument("--use-claude", action="store_true")
    ap.add_argument("--theme", default="", help="Optional current trend/theme to lean into (Claude only)")
    ap.add_argument("--seed", type=int, default=None, help="Random seed for reproducible offline runs")
    ap.add_argument("--list-parents", action="store_true", help="List available parent categories and exit")
    ap.add_argument("--json", action="store_true", help="Print raw JSON instead of the pretty report")
    ap.add_argument("--export", type=int, metavar="RANK", help="Export the Nth-ranked result "
                    "(1-based) as a niche.json-compatible file")
    ap.add_argument("-o", "--output", default=os.path.join(HERE, "niche_generated.json"),
                    help="Output path for --export (default: tools/niche_generated.json, "
                         "never overwrites niche.json)")
    args = ap.parse_args()

    if args.list_parents:
        print("\n  Available parent categories (use with --parent):\n")
        for p in PARENTS:
            print(f"   - {p['name']}  (demand {p['demand']}/10, competition {p['competition']}/10)")
        print()
        return

    if args.use_claude:
        results = generate_claude(args.count, args.parent, args.theme)
        if results is None:
            sys.exit(1)
        label = "Claude-generated"
    else:
        rng = random.Random(args.seed)
        results = generate_offline(args.count, args.parent, rng)
        label = "offline"

    if args.json:
        printable = [{k: v for k, v in r.items() if not k.startswith("_")} for r in results]
        print(json.dumps(printable, indent=2))
    else:
        print_report(results, label)

    if args.export:
        if not (1 <= args.export <= len(results)):
            sys.exit(f"--export {args.export} is out of range (generated {len(results)} niches).")
        export_niche(results[args.export - 1], args.output)


if __name__ == "__main__":
    main()
