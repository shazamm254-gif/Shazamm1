"""
Elaborate Scam Mechanics -- hand-written scripts for ranks 1-5.

Preserved verbatim from the original single-file overrides module; these
have already been render-tested. See _helpers.py for the fact-check policy.
"""

from ._helpers import NEG as _NEG, register as _register

# ===========================================================================
# Elaborate Scam Mechanics -- ranks 1-5
# ===========================================================================

_PALETTE_1 = "Near-black background, phone-glow blue, alert red, warm skin-tone accent"

_LINES_1 = [
    "This isn't your grandson's voice. It's three seconds of it, cloned.",
    "Scammers pull that clip from something he posted online — a birthday video, anything with his voice in it.",
    "Feed it into an AI model, and it can say anything. In his exact voice.",
    "Then the phone rings. It's him. Crying. He's been in an accident. He needs bail money right now — don't tell mom and dad.",
    "The panic does the rest. Nobody fact-checks a voice they've heard their whole life.",
    "Families have wired thousands of dollars in under ten minutes, certain they just heard their own child.",
    "Here's the tell: hang up. Call him back on the number you already have saved.",
    "A cloned voice can't answer a phone that isn't real. That's the one thing it can never fake.",
    "Save this for whoever in your family is most likely to pick up that call.",
]

_IMAGES_1 = [
    ("Extreme close-up of a smartphone screen glowing in a pitch-black room, illuminating the edge of "
     "an elderly hand's fingers wrapped around the phone, thin red audio waveform line animating "
     f"faintly across the bottom third of the frame, {_PALETTE_1}, shallow depth of field, cinematic "
     f"documentary style, {_NEG}.", "push_in"),
    ("Smartphone screen close-up showing a vertical social video paused mid-scrub, a glowing blue "
     "selection bracket highlighting a three-second segment of the waveform beneath it, dark room, "
     f"{_PALETTE_1}, over-the-shoulder framing, {_NEG}.", "pan_left_right"),
    ("Abstract visualization of a jagged audio waveform flowing into a glowing blue geometric "
     "neural-network grid, emerging on the other side as a smooth synthetic waveform, near-black "
     f"background, cold blue glow with one alert-red pulse at the transformation point, minimalist "
     f"technical-diagram style, {_NEG}, no people.", "push_in"),
    ("Smartphone screen lighting up a dark room with an incoming call notification, soft glow "
     "catching the silhouette of an elderly person's hand and shoulder gripping the phone tightly in "
     f"a dim kitchen doorway, tense posture, {_PALETTE_1}, low-key cinematic lighting, {_NEG}.",
     "hard_zoom_then_push_in"),
    ("Close silhouette of an elderly person's head bowed low, phone pressed tightly to their ear in a "
     f"dark room, faint rapid red waveform pulsing beside the phone, {_PALETTE_1}, intimate framing, "
     f"{_NEG}.", "static_drift"),
    ("Smartphone screen close-up showing a bank-transfer confirmation interface with a large dollar "
     "figure and a 'Sent' status indicator, glowing against a near-black room, cold blue screen light, "
     "single alert-red accent on the confirmation checkmark, no readable account details, no real bank "
     f"branding, {_NEG}.", "pull_out"),
    ("Smartphone screen close-up showing a contacts list, a thumb hovering over an existing saved "
     "entry, warm skin-tone accent on the thumb, cold blue interface glow, near-black background, a "
     f"subtle gold highlight ring around the correct contact, clean minimalist UI-illustration style, "
     f"{_NEG}.", "push_in"),
    ("Abstract split composition: one side a glowing synthetic waveform icon fading and glitching, "
     "the other a solid steady phone-ringing icon glowing gold and stable, near-black background, cold "
     "blue on the glitching side, warm gold on the stable side, minimalist symbolic illustration, high "
     f"contrast, {_NEG}, no people.", "pan_left_right"),
    ("Wide shot of a phone resting calmly on a table in a softly lit room, warm lamp light replacing "
     "the earlier cold tones, elderly hand relaxed beside it, near-black vignette at the edges, warm "
     f"gold and skin-tone palette, calm resolved mood, cinematic style, {_NEG}.", "pull_out"),
]

_THUMB_1 = ("Elderly hand gripping a glowing smartphone in a dark room, bold red audio waveform glowing "
            f"behind it, {_PALETTE_1}, high-contrast, single clear focal point, dramatic lighting, {_NEG}.")

_PALETTE_2 = "Navy, slate grey, alert red, screen-glow white"

_LINES_2 = [
    "The CEO approved the transfer. On camera. It still wasn't him.",
    "Scammers used real footage of the CEO from interviews and earnings calls to train a deepfake model.",
    "Then they joined a live video call with the finance team — as him, in real time.",
    "He asked for an urgent wire transfer, mid-quarter, told them to skip the usual approval chain.",
    "Everyone on that call could see his face and hear his voice. Nobody questioned it.",
    "One employee at a company in Hong Kong wired twenty-five million dollars after a call exactly like this.",
    "Here's the glitch that gives it away: deepfakes still struggle with natural head turns and blinking under pressure.",
    "If a video call ever asks you to bypass a normal process, hang up and call back on a known number.",
    "Face and voice aren't proof anymore. Verification is.",
]

_IMAGES_2 = [
    ("Flat corporate illustration of a video-call grid with six silhouette tiles, one tile glitching "
     f"into static and scan lines, {_PALETTE_2}, minimalist vector style, {_NEG}, no people's faces.",
     "push_in"),
    ("Flat corporate illustration of a stack of video-thumbnail frames (interview and conference-call "
     "style, no readable content) feeding into a glowing processing icon, navy background, slate grey "
     f"accents, {_NEG}, no people.", "pan_left_right"),
    ("Flat corporate illustration of a video-call grid with one tile's connection line animating in "
     f"and locking into place, screen-glow white highlight, {_PALETTE_2}, minimalist vector style, "
     f"{_NEG}.", "push_in"),
    ("Flat corporate illustration of a video-call interface with an urgent transfer-request overlay "
     f"icon and a bright alert-red 'skip approval' highlight, navy and slate grey background, {_NEG}.",
     "hard_zoom_then_push_in"),
    ("Flat corporate illustration of a full calm video-call grid, all silhouette tiles steady and "
     f"unaware, navy background, screen-glow white light, wide symmetrical composition, {_NEG}.",
     "static_drift"),
    ("Flat corporate illustration of a wire-transfer confirmation interface with a large dollar figure "
     f"glowing alert red, navy background, no readable account numbers, no real bank branding, {_NEG}.",
     "pull_out"),
    ("Flat corporate illustration, extreme close-up on a glitching video-call tile with scan-line "
     "distortion exactly where a head-turn should be, diagnostic-style thin white annotation lines, "
     f"navy and alert-red palette, {_NEG}.", "push_in"),
    ("Flat corporate illustration of a hand silhouette reaching toward a glowing 'end call' button, "
     f"steady navy and screen-glow white lighting, calm confident composition, {_NEG}.", "push_in"),
    ("Flat corporate illustration of a video-call grid fading to black around a single steady gold "
     f"checkmark icon glowing in the center, {_PALETTE_2}, minimalist, {_NEG}, no people.", "pull_out"),
]

_THUMB_2 = ("Flat corporate illustration of a video-call grid with one tile glitching into static and scan "
            f"lines, {_PALETTE_2}, high-contrast, single clear focal point, dramatic lighting, {_NEG}.")

_PALETTE_3 = "Money green, dark charcoal, warm phone-glow amber"

_LINES_3 = [
    "She talked to him every day for four months before asking for a single dollar.",
    "It started with a wrong-number text, an easy apology, and a conversation that kept going.",
    "Every morning, a good-morning message. Every evening, a check-in. No mention of money at all.",
    "Then, casually, he mentioned a crypto app that was working well for him lately.",
    "The first deposit was small. The dashboard showed it growing daily, right on schedule.",
    "Every time she tried to withdraw, there was a reason to wait — a tax, a fee, one more deposit.",
    "By the time she stopped hearing back, she'd sent over eighty thousand dollars.",
    "The dashboard, the growth, the support chat — none of it was ever connected to a real exchange.",
    "If a relationship and an investment opportunity arrive from the same person, that's the whole scam.",
]

_IMAGES_3 = [
    ("Smartphone screen close-up showing a long warm-toned chat thread scrolling upward, glowing "
     f"amber, silhouette hand holding the phone in a dim room, {_PALETTE_3}, intimate framing, {_NEG}.",
     "push_in"),
    ("Smartphone screen close-up showing the first two messages of a chat thread, one bubble subtly "
     f"highlighted as an unexpected first contact, soft warm amber glow, dark charcoal background, "
     f"{_NEG}.", "static_drift"),
    ("Smartphone screen showing a repeating grid pattern of small chat bubbles labeled by time of day, "
     f"warm amber tones on dark charcoal, calm rhythmic composition, {_NEG}.", "pan_left_right"),
    ("Smartphone screen close-up of a chat bubble transitioning into a small glowing green crypto-app "
     f"icon appearing inline, warm amber chat glow beside cool green accent, {_PALETTE_3}, {_NEG}.",
     "push_in"),
    ("Crypto trading app dashboard mockup glowing money green, a small upward-trending line chart and "
     f"a modest deposit figure, dark charcoal background, {_NEG}.", "push_in"),
    ("Crypto trading app dashboard mockup with a 'withdrawal pending' overlay notice, a thin alert-red "
     f"crack of color creeping into the green interface, dark charcoal background, {_NEG}.",
     "hard_zoom_then_push_in"),
    ("Crypto trading app dashboard mockup, screen frozen and desaturated, a chat thread beside it "
     f"showing unanswered messages, large dollar total visible, {_PALETTE_3}, {_NEG}.", "pull_out"),
    ("Abstract diagram showing a glowing fake dashboard icon connected by a broken dotted line to a "
     f"distant real-exchange icon, dark charcoal background, money green and warm amber accents, "
     f"minimalist technical style, {_NEG}, no people.", "push_in"),
    ("Wide calm shot of a phone lying face-down on a wooden desk, warm lamp light, a faint chat "
     f"notification glow fading out, dark charcoal vignette at the edges, {_NEG}.", "pull_out"),
]

_THUMB_3 = ("Smartphone screen close-up showing a warm-toned chat thread beside a glowing green crypto "
            f"balance ticking upward, {_PALETTE_3}, high-contrast, single clear focal point, dramatic "
            f"lighting, {_NEG}.")

_PALETTE_4 = "Dark navy, alert red, cold white screen-glow"

_LINES_4 = [
    "Your phone just went dead. That's the whole attack.",
    "Somewhere, a scammer just called your phone carrier pretending to be you.",
    "With a few personal details — often bought online — they convince support to move your number to their SIM card.",
    "The moment that transfer finishes, your phone loses signal, and theirs lights up with your texts and calls.",
    "Every two-factor code meant for you now lands on a phone they control.",
    "From there, they reset your email, then your bank login, one account at a time.",
    "The only warning most people get is a phone that suddenly says 'No Service.'",
    "A PIN on your carrier account — one that isn't your birthday — stops this cold.",
    "If your phone loses signal out of nowhere, that's not a glitch. Call your carrier immediately.",
]

_IMAGES_4 = [
    ("Smartphone screen close-up showing 'No Service' in cold white text on a dark navy background, "
     f"a subtle alert-red pulse at the empty signal bars, {_NEG}.", "push_in"),
    ("Silhouette of a call-center headset figure at a desk, phone screen glowing cold white, dark navy "
     f"background, {_NEG}, no visible face.", "static_drift"),
    ("Abstract diagram of scattered generic document and ID icons flowing toward a call-center "
     f"headset silhouette, dark navy background, cold white connecting lines, {_NEG}, no real personal "
     f"data.", "pan_left_right"),
    ("Split composition: one phone screen going dark with 'No Service' on the left, a second unknown "
     f"phone lighting up with full signal bars on the right, dark navy background, alert-red divider "
     f"line down the center, {_NEG}.", "hard_zoom_then_push_in"),
    ("Close-up of an unfamiliar phone screen glowing with a two-factor verification code interface, "
     f"cold white glow, dark navy background, {_NEG}, no readable real code.", "push_in"),
    ("Three stacked generic app icons (mail, bank, account) lighting up one after another in alert "
     f"red against a dark navy background, minimalist sequence illustration, {_NEG}.", "pull_out"),
    ("Smartphone screen close-up showing 'No Service' beside a cracking alert-red padlock icon, dark "
     f"navy background, cold white highlight, {_NEG}.", "push_in"),
    ("Phone settings screen mockup showing a PIN-entry lock icon glowing steady cold white and gold, "
     f"dark navy background, calm confident composition, {_NEG}.", "push_in"),
    ("Wide calm shot of a phone with full signal bars restored, steady cold white glow, dark navy "
     f"background, {_NEG}.", "pull_out"),
]

_THUMB_4 = ("Smartphone screen close-up showing a 'No Service' signal indicator beside a cracking alert-red "
            f"padlock icon, {_PALETTE_4}, high-contrast, single clear focal point, dramatic lighting, {_NEG}.")

_PALETTE_5 = "Aged cream, sepia brown, brass gold, ink black"

_LINES_5 = [
    "He never actually bought a single postal coupon. He didn't need to.",
    "In 1920, Charles Ponzi promised investors fifty percent returns in ninety days, off a real but obscure trade.",
    "International reply coupons could technically be bought cheap abroad and resold at a profit in the U.S.",
    "The margins were real. The volume needed to make millions from them was not.",
    "So Ponzi paid his early investors with money from new investors, and called the difference profit.",
    "Word spread fast. At his peak, he was pulling in a million dollars a week.",
    "The math only worked as long as new money kept arriving faster than old money left.",
    "A newspaper investigation asked one simple question: how many coupons would this actually require? The answer was more than existed in the world.",
    "The scheme collapsed in months. The name is the only thing that outlasted it.",
]

_IMAGES_5 = [
    ("Vintage sepia illustration of an empty 1920s office desk with a single postal coupon lying on "
     f"it beside a stack of unopened envelopes, {_PALETTE_5}, period documentary illustration style, "
     f"{_NEG}, no people.", "push_in"),
    ("Vintage sepia illustration of a 1920s Boston office exterior with an ornate promotional sign, "
     f"brass gold window light, {_PALETTE_5}, period illustration style, {_NEG}.", "static_drift"),
    ("Vintage sepia illustration of international postal reply coupons and old-world paper currency "
     f"laid out side by side on a wooden desk, {_PALETTE_5}, period still-life style, {_NEG}, no people.",
     "pan_left_right"),
    ("Vintage sepia illustration of a small stack of coupons dwarfed beside an enormous open ledger "
     f"book full of numbers, dramatic ink-black shadow contrast, {_PALETTE_5}, {_NEG}, no people.",
     "push_in"),
    ("Vintage sepia illustration of two silhouetted hands in period clothing exchanging cash across a "
     f"teller counter, warm brass gold light, {_PALETTE_5}, {_NEG}.", "hard_zoom_then_push_in"),
    ("Vintage sepia illustration of a long line of people in period dress outside a 1920s office "
     f"building, brass gold window glow, {_PALETTE_5}, wide composition, {_NEG}, no visible faces.",
     "pull_out"),
    ("Vintage sepia illustration of stacked cash and envelopes balanced precariously on an old brass "
     f"scale, tipping to one side, dramatic ink-black shadow, {_PALETTE_5}, {_NEG}, no people.",
     "static_drift"),
    ("Vintage sepia illustration of an antique magnifying glass held over a ledger page of numbers, "
     f"a blank period-style newspaper masthead faintly visible behind it, {_PALETTE_5}, dramatic "
     f"lighting, {_NEG}, no readable text.", "push_in"),
    ("Vintage sepia illustration of an abandoned 1920s office desk with papers scattered, fading to a "
     f"single warm brass-gold light in an otherwise dim room, {_PALETTE_5}, {_NEG}, no people.",
     "pull_out"),
]

_THUMB_5 = ("Vintage sepia illustration of a stack of postal envelopes with cash spilling out onto a 1920s "
            f"office desk, {_PALETTE_5}, high-contrast, single clear focal point, dramatic period lighting, "
            f"{_NEG}.")



_register(1, "Grandparent Emergency Voice-Clone Scam", _LINES_1, _IMAGES_1, _THUMB_1)
_register(2, "Deepfake Video-Call CEO Wire Transfer", _LINES_2, _IMAGES_2, _THUMB_2)
_register(3, "Pig-Butchering: The Long-Con Crypto Romance Scam", _LINES_3, _IMAGES_3, _THUMB_3)
_register(4, "SIM Swap: How They Steal Your Number in Minutes", _LINES_4, _IMAGES_4, _THUMB_4)
_register(5, "The Grandfather of All Ponzi Schemes", _LINES_5, _IMAGES_5, _THUMB_5)
