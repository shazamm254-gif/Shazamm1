"""
Gym Rats -- The Good & The Bad -- hand-written scripts for ranks 1-5.

Preserved verbatim from the original single-file overrides module; these
have already been render-tested. See _helpers.py for the fact-check policy.
"""

from ._helpers import NEG as _NEG, register as _register

# ===========================================================================
# Gym Rats -- The Good & The Bad -- ranks 1-5
# ===========================================================================

_PALETTE_G1 = "Iron grey, chalk white, rubber-mat black, warm gym-light amber"

_LINES_G1 = [
    "This one idea is why you get stronger. It's also why half the gym is hurt right now.",
    "Progressive overload just means your body needs a reason to keep adapting — more weight, more reps, or better form than last time.",
    "Miss on that principle, and your body has no reason to change at all. You plateau.",
    "But most lifters only hear the first word: 'progressive.' So they add weight. Every single week. No matter what.",
    "Eventually the only thing progressing is how much their form breaks down to move it.",
    "That's how a program built for strength turns into a program for tendonitis.",
    "The fix isn't lifting heavier every week. It's increasing reps, or sets, or time under tension instead.",
    "Same principle. Completely different, safer path to the same result.",
    "Progress on purpose — just not always with the number on the bar.",
]

_IMAGES_G1 = [
    ("Extreme close-up on chalked hands gripping a barbell mid-lift, weight plates stacked in the "
     f"foreground, gym floor perspective, {_PALETTE_G1}, {_NEG}.", "push_in"),
    ("Close-up on a barbell with small incremental weight plates being added one at a time, iron grey "
     f"tones, chalk dust in the air, {_NEG}.", "pan_left_right"),
    ("A barbell resting untouched on a rack, stillness implied, dim gym light, faint dust in a single "
     f"light beam, {_PALETTE_G1}, {_NEG}.", "static_drift"),
    ("A gym rack showing a sequence of barbells with dramatically increasing plate loads left to right, "
     f"{_PALETTE_G1}, minimalist illustration style, {_NEG}.", "push_in"),
    ("Close-up on a barbell bending slightly under too much load, straining hands, a subtle alert-red "
     f"stress highlight along the bar, {_PALETTE_G1}, {_NEG}.", "hard_zoom_then_push_in"),
    ("Close-up on a wrapped, taped wrist resting near a barbell, dim clinical-adjacent lighting, muted "
     f"tones, {_NEG}.", "pull_out"),
    ("Close-up on a lighter barbell with a subtle rep-counter or time-under-tension diagram overlay, "
     f"calm iron grey and amber tones, {_NEG}.", "push_in"),
    ("Split image of two barbells, one heavy with few reps implied and one lighter with more reps "
     f"implied, a faint equals sign glowing between them, {_PALETTE_G1}, {_NEG}.", "pan_left_right"),
    ("Calm wide shot of a barbell resting steady on a rack, warm gym-light amber glow, peaceful "
     f"composition, {_NEG}.", "pull_out"),
]

_THUMB_G1 = ("A barbell loaded with plates on a gym floor, one plate glowing alert red as an overload "
             f"warning, {_PALETTE_G1}, high-contrast, single clear focal point, dramatic lighting, {_NEG}.")

_PALETTE_G2 = "Industrial grey, warm gym-light amber, chalk white, alert-red accent"

_LINES_G2 = [
    "He added forty pounds to impress no one in particular. His shoulder is still recovering.",
    "Ego lifting isn't about the weight. It's about who's watching when the weight goes on.",
    "The moment someone new walks up, the plates go on faster than the warm-up allows.",
    "Real strength comes from controlled, full-range reps. Ego lifts skip straight to whatever gets the bar moving.",
    "That usually means momentum, a shortened range, and joints absorbing the load muscles were supposed to.",
    "One bad rep under too much weight is often all it takes to tear something that takes months to heal.",
    "Here's the tell: watch the bar speed. A genuinely strong lift stays controlled all the way down.",
    "An ego lift jerks, wobbles, and drops. The form gives it away before the injury ever happens.",
    "The heaviest weight you can lift safely will always beat the heaviest weight you can barely move.",
]

_IMAGES_G2 = [
    ("Wide gym-floor shot of a heavily loaded barbell resting on the floor, a silhouette figure rubbing "
     f"their shoulder at a distance, {_PALETTE_G2}, {_NEG}.", "push_in"),
    ("Wide gym-floor shot, one silhouette glancing toward another figure approaching, a weight rack in "
     f"the foreground, {_PALETTE_G2}, {_NEG}.", "static_drift"),
    ("Close-up on plates being added rapidly to a barbell, hands moving quickly, warm amber gym "
     f"light, motion blur on the plates, {_NEG}.", "pan_left_right"),
    ("Diagram-style split image: one barbell path shown as a smooth controlled arc, another as a "
     f"jagged rushed arc, {_PALETTE_G2}, minimalist illustration, {_NEG}.", "push_in"),
    ("Close-up on a barbell mid-lift with visible momentum blur, strained grip, no visible face, "
     f"{_PALETTE_G2}, {_NEG}.", "push_in"),
    ("Close-up on a barbell bending slightly under load with a subtle alert-red stress-crack glow at "
     f"its center, {_PALETTE_G2}, {_NEG}.", "hard_zoom_then_push_in"),
    ("Close-up on a barbell descending slowly and controlled, a thin speed-line diagram overlay "
     f"showing a steady pace, {_PALETTE_G2}, {_NEG}.", "pull_out"),
    ("Wide gym-floor shot comparing two barbell paths side by side, one smooth and one jerky, "
     f"diagrammatic overlay, {_PALETTE_G2}, {_NEG}.", "pan_left_right"),
    ("Calm wide gym-floor shot of a barbell being lifted with clean, controlled form, warm amber "
     f"light, {_NEG}.", "pull_out"),
]

_THUMB_G2 = ("A barbell bending slightly under heavy load with a subtle alert-red stress-crack glow at its "
             f"center, {_PALETTE_G2}, high-contrast, single clear focal point, dramatic lighting, {_NEG}.")

_PALETTE_G3 = "Clinical white, molecule-diagram blue, alert-red accent, protein-shake cream"

_LINES_G3 = [
    "It's one of the most studied supplements on Earth. People still think it'll damage their kidneys.",
    "Creatine has been researched in hundreds of clinical trials since the 1990s, more than almost anything else on a supplement shelf.",
    "The kidney fear traces back to one case study, about one man, who was already taking ten times the normal dose.",
    "That single case got repeated so often it became common knowledge, even though the research never supported it broadly.",
    "In healthy people, creatine doesn't damage kidney function. What it does do is pull water into your muscle cells.",
    "That water retention is often the actual 'side effect' people notice, and mistake for something more serious.",
    "The one real caution: people with existing kidney disease should still check with a doctor first.",
    "Outside of that, it remains one of the cheapest, best-studied ways to support strength and muscle growth.",
    "The myth outlived the study that supposedly proved it.",
]

_IMAGES_G3 = [
    ("Supplement container and scoop close-up on a kitchen counter, a small alert-red kidney icon with "
     f"a question mark glowing faintly above it, {_PALETTE_G3}, {_NEG}.", "push_in"),
    ("A stack of abstract research-paper icons fanning out behind a supplement container, clinical "
     f"white background, molecule-diagram blue accents, {_NEG}, no readable text.", "pan_left_right"),
    ("A single highlighted document icon isolated among a faded stack, soft spotlight effect, clinical "
     f"tones, {_NEG}, no readable text.", "push_in"),
    ("Abstract diagram of one document icon repeating and multiplying across the frame, clinical white "
     f"and blue palette, {_NEG}, no readable text.", "static_drift"),
    ("Molecule-diagram overlay showing water droplets moving into a stylized muscle-cell illustration, "
     f"blue glow, clinical white background, {_NEG}, no people.", "hard_zoom_then_push_in"),
    ("Close-up on a glass of water beside a supplement scoop, calm clinical white lighting, "
     f"{_PALETTE_G3}, {_NEG}.", "pull_out"),
    ("A small clinical caution icon (simple medical cross) glowing softly beside a supplement "
     f"container, clinical white background, {_NEG}.", "push_in"),
    ("Supplement container beside a small price tag and a checkmark icon, clinical white and cream "
     f"tones, {_NEG}, no real brand logos.", "pan_left_right"),
    ("Supplement container resting calmly on a kitchen counter, soft clinical white light, molecule "
     f"diagram fading away in the background, {_NEG}.", "pull_out"),
]

_THUMB_G3 = ("A supplement scoop on a kitchen counter with a molecule diagram glowing above it and a small "
             f"alert-red kidney icon crossed out beside it, {_PALETTE_G3}, high-contrast, single clear focal "
             f"point, dramatic lighting, {_NEG}.")

_PALETTE_G4 = "Cool mirror-glass blue, locker-room grey, phone-glow white, warm skin-tone accent"

_LINES_G4 = [
    "He was one of the strongest guys in the gym. He still thought he looked small in every mirror.",
    "Muscle dysmorphia, sometimes called bigorexia, isn't about vanity. It's a real, diagnosable body image disorder.",
    "It often shows up in people who are already muscular, sometimes exceptionally so, by any outside measure.",
    "The distortion isn't in the mirror. It's in how the brain processes what the mirror shows.",
    "More muscle doesn't fix it, the same way losing weight doesn't fix anorexia. The target keeps moving.",
    "It can lead to compulsive training, disordered eating, and steroid misuse, chasing a version of 'enough' that isn't really about size.",
    "One clinical sign doctors look for: measurable, visible progress that the person genuinely cannot perceive in themselves.",
    "If that sounds familiar, for you or someone you train with, it's worth talking to a doctor, not just training harder.",
    "Strength should make you feel more like yourself. Not less.",
]

_IMAGES_G4 = [
    ("Gym mirror reflecting a strong, muscular silhouette, the reflection subtly smaller and more "
     f"uncertain than the real figure standing in front of it, {_PALETTE_G4}, {_NEG}.", "push_in"),
    ("A gym mirror with a small, respectful clinical diagram icon glowing faintly at its edge, cool "
     f"locker-room tones, {_PALETTE_G4}, {_NEG}.", "static_drift"),
    ("Gym mirror reflecting an evidently well-built silhouette with clear muscle definition, cool "
     f"locker-room lighting, {_PALETTE_G4}, {_NEG}.", "push_in"),
    ("Abstract split image: a mirror on one side, a softly stylized brain/perception diagram on the "
     f"other, cool blue glow, {_NEG}, no people.", "pan_left_right"),
    ("Two mirrors side by side, each reflecting a distorted silhouette in a slightly different way, "
     f"cool tones, {_PALETTE_G4}, {_NEG}.", "static_drift"),
    ("A locker shelf with a supplement bottle and a small clock face nearby, implying compulsive "
     f"training time, dim cool lighting, {_NEG}.", "hard_zoom_then_push_in"),
    ("A calm clipboard or chart icon glowing softly beside a gym mirror, cool clinical blue tones, "
     f"{_NEG}, no readable text.", "push_in"),
    ("A silhouette figure sitting calmly on a locker-room bench, a phone glowing gently nearby, warm "
     f"skin-tone accent light, {_PALETTE_G4}, {_NEG}.", "pull_out"),
    ("A calm gym mirror reflection, softly lit, warm skin-tone light replacing the earlier cool tones, "
     f"resolved and steady mood, {_NEG}.", "pull_out"),
]

_THUMB_G4 = ("A gym mirror reflecting a silhouette that appears smaller and more uncertain than the real "
             f"muscular figure standing in front of it, {_PALETTE_G4}, high-contrast, single clear focal "
             f"point, dramatic lighting, {_NEG}.")

_PALETTE_G5 = "Industrial grey, warm gym-light amber, chalk white, deep shadow black"

_LINES_G5 = [
    "The people most afraid to walk into a gym are the ones who'd benefit from it most.",
    "Gymtimidation is real enough that researchers study it — the fear of judgment that keeps beginners away entirely.",
    "It's not about the equipment. It's the fear of using a machine wrong in front of people who never seem to.",
    "Loud grunting, crowded free-weight areas, and unspoken rules all make that fear worse, whether anyone means to or not.",
    "Most experienced lifters don't even notice. They were beginners once too, a long time ago.",
    "Some gyms are fixing this on purpose, with beginner-only hours or staff who actually walk the floor to help.",
    "Here's what works: a staffed floor presence, proven to lower new-member dropout in the first month.",
    "It costs the gym almost nothing, and it's the biggest factor in whether a beginner comes back.",
    "If you're the confident one in the room, you're also the easiest person to make it less intimidating.",
]

_IMAGES_G5 = [
    ("Gym doorway looking in, a hesitant silhouette pausing at the threshold, warm gym light spilling "
     f"out into a dark hallway, {_PALETTE_G5}, {_NEG}.", "push_in"),
    ("Wide gym-floor shot with a subtle research-chart icon glowing faintly in the corner, industrial "
     f"grey tones, {_NEG}, no readable text.", "static_drift"),
    ("Close-up on an unfamiliar gym machine with a complex control panel implied, dim lighting, no "
     f"visible face, {_PALETTE_G5}, {_NEG}.", "push_in"),
    ("Wide gym-floor shot of a crowded free-weight area, silhouette figures close together, tense "
     f"composition, {_PALETTE_G5}, {_NEG}.", "pan_left_right"),
    ("A single silhouette figure standing calmly near a rack, warm amber light, relaxed confident "
     f"posture, {_NEG}.", "static_drift"),
    ("A gym floor with a staff silhouette actively helping another figure near a machine, warm amber "
     f"lighting, {_PALETTE_G5}, {_NEG}.", "push_in"),
    ("Abstract diagram showing a dropout-rate line improving next to a staffed-floor icon, industrial "
     f"grey and amber palette, {_NEG}, no readable text.", "hard_zoom_then_push_in"),
    ("A gym floor with a staff silhouette positioned centrally and visibly approachable, warm amber "
     f"glow, {_PALETTE_G5}, {_NEG}.", "pull_out"),
    ("Gym doorway shot, a silhouette now stepping confidently inside, warm light fully surrounding "
     f"them, {_NEG}.", "pull_out"),
]

_THUMB_G5 = ("A gym doorway with a hesitant silhouette pausing at the threshold, warm gym light spilling "
             f"out into a dark hallway, {_PALETTE_G5}, high-contrast, single clear focal point, dramatic "
             f"lighting, {_NEG}.")



_register(1, "Progressive Overload: The Principle and The Myth", _LINES_G1, _IMAGES_G1, _THUMB_G1)
_register(2, "Ego Lifting: The Confidence Boost That Tears Tendons", _LINES_G2, _IMAGES_G2, _THUMB_G2)
_register(3, "Creatine: The Most Proven Supplement, The Most Believed Myth", _LINES_G3, _IMAGES_G3, _THUMB_G3)
_register(4, "Muscle Dysmorphia: Never Big Enough", _LINES_G4, _IMAGES_G4, _THUMB_G4)
_register(5, "Gymtimidation: The Fear Gyms Never Fixed", _LINES_G5, _IMAGES_G5, _THUMB_G5)
