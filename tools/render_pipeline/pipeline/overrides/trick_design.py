"""
Designed to Trick You -- hand-written scripts for all 50 ranks.

This sheet names real companies in narration, so every image prompt uses
NEG_BRAND: no branding or recognizable trade dress is ever rendered.

Ranks 1-5 were written and render-tested first and are preserved verbatim
below. Ranks 6-50 follow the same structure: 9 narration lines paired
one-to-one with 9 shots.

See _helpers.py for the fact-check policy that governs every line here.
Short version: no invented numbers, and nothing built on research with
known data-integrity problems.
"""

from ._helpers import (NEG_BRAND, P_AIRPORT, P_ATTRACTION, P_CASINO, P_MALL,
                       P_PERCEPTION, P_PRICING, P_RESTAURANT, P_RETAIL,
                       P_SENSORY, P_SUPERMARKET, P_URBAN, img, register, thumb)

# Bespoke palettes for ranks 1-5, kept from the original tested versions.
_PALETTE_T1 = "Blueprint blue, warm retail amber, cart-metal grey, alert-red path line"
_PALETTE_T2 = "Flat-pack yellow, showroom blue, blueprint white, alert-red shortcut marker"
_PALETTE_T3 = "Casino-carpet burgundy, neon accent, near-black, warm slot-glow gold"
_PALETTE_T4 = "Mall-tile cream, skylight white, storefront neon accents, wayfinding blue"
_PALETTE_T5 = "Retail amber, shelf-metal grey, gold highlight band, alert-red price tags"
_NEG_BRAND = NEG_BRAND


# ===========================================================================
# Ranks 1-5 -- render-tested, preserved verbatim
# ===========================================================================

register(1, "Why the Milk Is Always at the Back of the Store", [
    "The most-bought item in the store is deliberately placed as far from the door as physically possible.",
    "Milk, eggs, bread — the things almost everyone came for — sit at the very back wall.",
    "To reach them, you walk past produce, past the bakery, past the entire center of the store.",
    "That walk is the product. Every aisle you cross is another chance for something unplanned to land in the cart.",
    "The staples are the anchor. Everything else along the route is the actual business.",
    "Now, the honest part: there's a real logistics reason too. Refrigeration lives near the loading dock at the back.",
    "But stores have known about the traffic effect for decades, and they've never had a reason to fight the layout.",
    "Convenient for the trucks, profitable at the register, and you walk the length of the building either way.",
    "Next time, notice how far the milk actually is. That distance was a decision.",
], [
    ("Overhead architectural floor-plan diagram of a large supermarket, entrance at the bottom, a "
     "single small milk carton icon glowing at the far back wall, thin alert-red path line stretching "
     f"between them, {_PALETTE_T1}, clean technical blueprint style, {_NEG_BRAND}.", "push_in"),
    ("Overhead floor-plan diagram with three small staple-item icons (milk, eggs, bread) glowing along "
     f"the entire back wall, blueprint blue background, warm amber icon glow, {_NEG_BRAND}.",
     "pan_left_right"),
    ("Overhead supermarket floor-plan diagram, a red path line snaking from the entrance through "
     "produce and bakery zones toward the back, each zone softly lit in warm retail amber, "
     f"{_PALETTE_T1}, {_NEG_BRAND}.", "push_in"),
    ("Overhead floor-plan diagram with small product icons scattering into a shopping-cart icon along "
     f"a red path line, blueprint blue, warm amber, cart-metal grey, {_NEG_BRAND}.",
     "hard_zoom_then_push_in"),
    ("Overhead floor-plan diagram showing an anchor-pin icon at the back wall with concentric "
     f"influence rings radiating across the whole store map, {_PALETTE_T1}, minimalist technical style, "
     f"{_NEG_BRAND}.", "pull_out"),
    ("Architectural cross-section diagram of a store's back wall showing refrigeration units backing "
     "directly onto a loading dock with a truck bay outline, blueprint blue linework, cool grey "
     f"machinery, {_NEG_BRAND}, no people.", "static_drift"),
    ("Overhead floor-plan diagram with two overlaid annotation layers, one labeled with a truck icon "
     f"and one with a cart icon, both pointing at the same back-wall zone, {_PALETTE_T1}, {_NEG_BRAND}.",
     "push_in"),
    ("Overhead floor-plan diagram showing the same red path line with a small register icon at the end, "
     f"warm amber glow across the aisles it crosses, {_PALETTE_T1}, {_NEG_BRAND}.", "pan_left_right"),
    ("Wide overhead floor-plan diagram of the full store with the entire red path line lit end to end, "
     f"a distance-measurement bracket drawn along it, {_PALETTE_T1}, clean blueprint style, "
     f"{_NEG_BRAND}.", "pull_out"),
], ("Overhead supermarket floor-plan blueprint with a long glowing alert-red path line running "
    f"from the entrance to a single small milk carton icon in the far back corner, {_PALETTE_T1}, "
    f"high-contrast, single clear focal point, dramatic lighting, {_NEG_BRAND}."))

register(2, "The IKEA Maze: The One-Way Path You Can't Leave", [
    "You went in for one bookshelf. You walked past four hundred products to get to it.",
    "That wasn't bad luck, and it wasn't your sense of direction. The path only goes one way.",
    "The store is built as a single fixed route: showroom first, then marketplace, then the warehouse where the box actually is.",
    "There are no aisles cutting across the middle. To reach the end, you experience the whole thing.",
    "Along the way, every room is staged like a home, so you stop seeing products and start seeing your own living room.",
    "By the time you reach the checkout, the bookshelf you came for has company.",
    "Here's the part almost nobody uses: the shortcuts are real, and they're printed on the map.",
    "Marked doorways cut between departments. Staff will point you to them if you ask.",
    "The maze only works on people who assume there's no way out of it.",
], [
    ("Overhead architectural floor-plan diagram of a large two-level furniture store drawn as a "
     "winding one-way maze, a single small bookshelf icon glowing at the far end, blueprint white "
     f"linework on showroom blue, {_NEG_BRAND}.", "push_in"),
    ("Overhead maze floor-plan with a single directional arrow path and no branching routes, flat-pack "
     f"yellow arrow on blueprint white, {_PALETTE_T2}, {_NEG_BRAND}.", "static_drift"),
    ("Overhead floor-plan diagram divided into three sequential labeled zones flowing into one another, "
     f"showroom blue, flat-pack yellow, warehouse grey, clean technical style, {_NEG_BRAND}.",
     "pan_left_right"),
    ("Overhead floor-plan diagram showing solid walls where cross-aisles would be, the single path "
     f"forced around them, blueprint white on showroom blue, {_PALETTE_T2}, {_NEG_BRAND}.", "push_in"),
    ("Overhead floor-plan diagram with small staged room-vignette icons lining the path, each glowing "
     f"warm against the cool blue plan, {_PALETTE_T2}, {_NEG_BRAND}, no people.",
     "hard_zoom_then_push_in"),
    ("Overhead floor-plan diagram of a checkout zone with a cart icon holding several product icons "
     f"instead of one, flat-pack yellow accents, {_PALETTE_T2}, {_NEG_BRAND}.", "pull_out"),
    ("Overhead maze floor-plan with several small alert-red doorway markers glowing at the walls "
     f"between departments, {_PALETTE_T2}, clean blueprint style, {_NEG_BRAND}.", "push_in"),
    ("Close-up on a stylized folding store map illustration with small red shortcut symbols marked "
     f"along its printed route, blueprint white paper, {_PALETTE_T2}, {_NEG_BRAND}, no readable text.",
     "pan_left_right"),
    ("Wide overhead floor-plan of the full maze with one clean red line cutting straight through the "
     f"shortcut doors from entrance to exit, {_PALETTE_T2}, high contrast, {_NEG_BRAND}.", "pull_out"),
], ("Overhead blueprint of a furniture store drawn as a winding one-way maze, one glowing alert-red "
    f"shortcut door cutting through a wall, {_PALETTE_T2}, high-contrast, single clear focal point, "
    f"dramatic lighting, {_NEG_BRAND}."))

register(3, "Casino Design: No Clocks, No Windows, No Straight Lines", [
    "No clocks. No windows. No straight line to the exit. None of that is an accident.",
    "Classic casino floors were designed around a simple idea: make time and direction disappear.",
    "Without a window or a clock, there's no cue telling you it's two in the morning.",
    "The layout does the rest. Low ceilings, winding paths, and machine banks arranged so every route curves back inward.",
    "The exit is real, but it's never in front of you. You have to look for it.",
    "That design philosophy dominated the industry for decades, and it's why so many casinos feel identical.",
    "Then a competing theory showed up: open sightlines, natural light, high ceilings, easy landmarks.",
    "Comfortable spaces, it turned out, kept people staying longer than confusing ones did.",
    "The maze was never the point. Keeping you there was. The newer design just does it more pleasantly.",
], [
    ("Overhead architectural floor-plan diagram of a casino gaming floor with winding non-linear paths "
     "between dense machine-bank blocks, near-black background, warm slot-glow gold highlights, "
     f"{_NEG_BRAND}, no people.", "push_in"),
    ("Overhead casino floor-plan diagram with a small crossed-out clock icon and a crossed-out window "
     f"icon in the margin, burgundy and near-black, neon accent linework, {_NEG_BRAND}.",
     "static_drift"),
    ("Interior architectural rendering of a windowless low-ceilinged gaming room lit entirely by warm "
     f"artificial machine glow, no daylight anywhere, {_PALETTE_T3}, {_NEG_BRAND}, no people.",
     "push_in"),
    ("Overhead floor-plan diagram showing curved path lines that loop back toward the center of the "
     f"room instead of leading outward, neon accent path lines on near-black, {_PALETTE_T3}, "
     f"{_NEG_BRAND}.", "pan_left_right"),
    ("Overhead floor-plan diagram with a small exit icon tucked behind several machine blocks, a faint "
     f"dashed line indicating an indirect route to it, {_PALETTE_T3}, {_NEG_BRAND}.",
     "hard_zoom_then_push_in"),
    ("Grid of four nearly identical overhead casino floor-plan thumbnails side by side, showing the "
     f"same maze pattern repeated, burgundy and near-black, {_NEG_BRAND}.", "pull_out"),
    ("Interior architectural rendering of an open gaming space with high ceilings, skylights, clear "
     f"sightlines, and a visible landmark feature, warm natural light mixed with gold machine glow, "
     f"{_PALETTE_T3}, {_NEG_BRAND}, no people.", "push_in"),
    ("Split overhead diagram: a dense winding maze plan on one side, an open landmark-based plan on "
     f"the other, matched scale, {_PALETTE_T3}, clean technical style, {_NEG_BRAND}.",
     "pan_left_right"),
    ("Wide overhead casino floor-plan diagram fading toward the edges, a single warm gold glow at its "
     f"center, {_PALETTE_T3}, calm resolved composition, {_NEG_BRAND}, no people.", "pull_out"),
], ("Overhead casino floor-plan blueprint with winding paths, a small exit icon buried far from "
    f"the center, and a crossed-out clock in the corner, {_PALETTE_T3}, high-contrast, single "
    f"clear focal point, dramatic lighting, {_NEG_BRAND}."))

register(4, "The Gruen Transfer: The Moment a Mall Makes You Forget Why You Came", [
    "There's a name for the moment you forget what you came to the mall to buy.",
    "It's called the Gruen transfer, after the architect who designed the modern shopping mall.",
    "Victor Gruen's idea was a community hub — a covered public square with shops around the edges.",
    "What developers built instead was a machine for disorientation.",
    "Sightlines get broken on purpose. Landmarks repeat. Escalators sit at opposite ends of each floor.",
    "Lose your bearings for a few seconds, and browsing quietly replaces the errand you arrived with.",
    "That transition — focused shopper to aimless wanderer — is the entire commercial engine of the building.",
    "Here's the twist: Gruen spent his later years publicly disowning what his invention became.",
    "The man who invented the mall refused to take credit for it.",
], [
    ("Overhead architectural floor-plan diagram of a shopping mall atrium with a confused looping path "
     f"line drifting away from a single small target-store icon, {_PALETTE_T4}, clean technical style, "
     f"{_NEG_BRAND}.", "push_in"),
    ("Vintage-style architectural drawing of an early covered shopping-center concept, clean modernist "
     f"linework, mall-tile cream and wayfinding blue, {_NEG_BRAND}, no people.", "static_drift"),
    ("Architectural rendering of an open sunlit public square with a fountain and trees surrounded by "
     f"a simple colonnade, skylight white and cream tones, idealistic civic mood, {_NEG_BRAND}, no "
     f"people.", "pan_left_right"),
    ("Overhead mall floor-plan diagram that grows visibly more complex and enclosed, corridors "
     f"multiplying outward, {_PALETTE_T4}, {_NEG_BRAND}.", "push_in"),
    ("Overhead mall floor-plan diagram with sightline rays drawn stopping short at angled walls, and "
     f"escalator icons marked at opposite ends of each level, {_PALETTE_T4}, technical annotation "
     f"style, {_NEG_BRAND}.", "hard_zoom_then_push_in"),
    ("Overhead mall diagram with a straight purposeful path line dissolving into a wandering scribble "
     f"across the storefronts, storefront neon accents, {_PALETTE_T4}, {_NEG_BRAND}.", "pull_out"),
    ("Abstract split diagram: a straight arrow icon on one side, a looping tangled arrow on the other, "
     f"a transition gradient between them, {_PALETTE_T4}, minimalist symbolic style, {_NEG_BRAND}, no "
     f"people.", "push_in"),
    ("Vintage-style architectural drawing on a drafting table with a plan sheet turned face-down beside "
     f"a capped pen, warm desk lamp light, cream paper, {_NEG_BRAND}, no people, no readable text.",
     "static_drift"),
    ("Wide overhead mall floor-plan diagram fading out at the edges, the original civic-square sketch "
     f"faintly ghosted underneath it, {_PALETTE_T4}, contemplative mood, {_NEG_BRAND}.", "pull_out"),
], ("Overhead shopping-mall floor-plan blueprint with a purposeful straight path dissolving into a "
    f"wandering looping scribble among storefronts, {_PALETTE_T4}, high-contrast, single clear "
    f"focal point, dramatic lighting, {_NEG_BRAND}."))

register(5, "Eye-Level Is Buy-Level: The Shelf War You Never See", [
    "The shelf directly in front of your eyes is the most valuable real estate in the store. Brands pay for it.",
    "It's called slotting: manufacturers pay retailers for placement, and the best positions cost the most.",
    "Every shelf is mapped in advance on a diagram called a planogram. Nothing sits where it does by accident.",
    "Eye level goes to whatever the store earns the most from — usually the biggest brands, at the highest prices.",
    "Look down, and you'll find the store's own label and the bulk sizes, often cheaper per unit.",
    "Look up, and you'll find smaller brands that couldn't outbid anyone for the middle.",
    "Now check the cereal aisle, and drop your eyes about three feet.",
    "The cartoon characters are at a child's eye level. That placement is aimed at someone who isn't paying.",
    "The trick only works while you shop at one height. Look up and down, and the shelf stops choosing for you.",
], [
    ("Straight-on cross-section diagram of a supermarket shelf unit with a glowing gold horizontal band "
     f"highlighting the middle shelf at adult eye height, {_PALETTE_T5}, clean technical illustration, "
     f"{_NEG_BRAND}.", "push_in"),
    ("Shelf cross-section diagram with small currency icons flowing toward the highlighted middle "
     f"shelf band, retail amber and gold, shelf-metal grey, {_NEG_BRAND}.", "pan_left_right"),
    ("Flat technical planogram diagram: a grid of blank generic product rectangles mapped across shelf "
     f"rows with measurement guides, blueprint style, {_PALETTE_T5}, {_NEG_BRAND}, no readable text.",
     "static_drift"),
    ("Shelf cross-section diagram with the eye-level band glowing gold and alert-red price tags along "
     f"it, upper and lower shelves dimmed, {_PALETTE_T5}, {_NEG_BRAND}.", "push_in"),
    ("Shelf cross-section diagram with the bottom shelf lit and small value-tag icons highlighted "
     f"there, larger generic package shapes, {_PALETTE_T5}, {_NEG_BRAND}.", "pull_out"),
    ("Shelf cross-section diagram with the top shelf lit, smaller generic package shapes arranged "
     f"sparsely, retail amber glow, {_PALETTE_T5}, {_NEG_BRAND}.", "push_in"),
    ("Straight-on shelf diagram of a tall aisle with a height-measurement scale drawn vertically "
     f"beside it, {_PALETTE_T5}, technical annotation style, {_NEG_BRAND}.", "pan_left_right"),
    ("Shelf cross-section diagram with a low glowing band at roughly one meter height, a small "
     f"child-height sightline arrow pointing to it, {_PALETTE_T5}, {_NEG_BRAND}, no visible faces, no "
     f"recognizable characters.", "hard_zoom_then_push_in"),
    ("Wide straight-on shelf diagram with sightline arrows fanning up and down across every shelf row, "
     f"all rows evenly lit, {_PALETTE_T5}, calm resolved composition, {_NEG_BRAND}.", "pull_out"),
], ("Straight-on supermarket shelf cross-section with a glowing gold 'paid placement' band at adult "
    f"eye height and dimmed shelves above and below, {_PALETTE_T5}, high-contrast, single clear "
    f"focal point, dramatic lighting, {_NEG_BRAND}."))


# ===========================================================================
# Ranks 6-27
# ===========================================================================

register(6, "Exit Through the Gift Shop: The Route You Can't Refuse", [
    "Every museum, every theme park ride, every aquarium ends the same way. The exit is a store.",
    "You can't walk around it. The only path out leads through the merchandise.",
    "The placement isn't about convenience. It's about timing.",
    "You've just finished the experience. You're at the emotional high point, and you haven't come down yet.",
    "Psychologists call it the peak-end rule: we judge an experience by its most intense moment and its ending.",
    "Put a store at the ending, and you're selling to someone still inside the feeling.",
    "That's also why the merchandise is a picture of the thing you just did. You're not buying an object, you're buying the memory.",
    "And it works hardest on children, who've just experienced the whole thing at maximum intensity.",
    "The ride was the advertisement. The gift shop was the checkout.",
], [
    img("Overhead attraction floor-plan diagram, a single ride path funneling into a brightly lit "
        "gift-shop room before reaching the exit", "push_in", P_ATTRACTION),
    img("Overhead floor-plan showing solid walls with no bypass route around the shop, one forced "
        "path marked in red", "static_drift", P_ATTRACTION),
    img("Overhead diagram with a small clock icon marking the moment of transition from ride to shop",
        "pan_left_right", P_ATTRACTION),
    img("Abstract emotion-curve line graph rising to a peak exactly where a small shop icon sits on "
        "the timeline", "push_in", P_ATTRACTION),
    img("Simple line chart of an experience curve with the peak and the endpoint both circled and "
        "glowing", "hard_zoom_then_push_in", P_ATTRACTION),
    img("Overhead diagram of a shop interior placed directly at the emotional peak marker of a "
        "route line, warm glow radiating from it", "pull_out", P_ATTRACTION),
    img("Shelf display diagram of generic souvenir silhouettes that echo the shape of a ride vehicle",
        "push_in", P_ATTRACTION),
    img("Shelf cross-section with a low glowing band at child height lined with small plush-toy "
        "silhouettes", "push_in", P_ATTRACTION),
    img("Wide overhead attraction plan with the ride path and shop lit as one continuous connected "
        "route to the exit", "pull_out", P_ATTRACTION),
], thumb("Overhead attraction blueprint where a ride path funnels directly into a glowing gift-shop "
         "room before the exit", P_ATTRACTION))

register(7, "Menu Engineering: The Four Corners of Every Restaurant Menu", [
    "The dish the restaurant most wants to sell you is sitting exactly where your eyes land first.",
    "A menu isn't a list. It's a layout, designed the same way a store floor plan is.",
    "Eye-tracking research shows diners scan a menu in a predictable pattern, not top to bottom.",
    "The most profitable dishes get placed where that scan naturally lands, usually the upper area and the corners.",
    "Then there's the decoy: one dish priced far above everything else.",
    "Almost nobody orders it. Its job is to make the second-most-expensive dish feel reasonable.",
    "Watch for the currency symbol too. Many menus drop the dollar sign entirely.",
    "Written as a bare number, a price reads less like spending money and more like a label.",
    "The food is the product. The menu is the sales floor.",
], [
    img("Flat menu-page layout diagram with one dish block highlighted in gold at the primary "
        "eye-landing zone", "push_in", P_RESTAURANT),
    img("Flat menu-page diagram overlaid with a floor-plan style grid, drawing the parallel between "
        "layout and store aisles", "pan_left_right", P_RESTAURANT),
    img("Menu page with an eye-tracking heat map overlay showing a scan pattern, warm red-gold hot "
        "zones", "push_in", P_RESTAURANT),
    img("Menu layout diagram with margin-value markers placed on the hottest scan zones", "static_drift",
        P_RESTAURANT),
    img("Menu diagram with a single very high price block isolated at the top of a price column",
        "hard_zoom_then_push_in", P_RESTAURANT),
    img("Price-comparison diagram of three stacked price blocks, the middle one glowing as the "
        "apparent reasonable choice", "pull_out", P_RESTAURANT),
    img("Close-up on a menu line with the currency symbol faded away, leaving a bare numeral",
        "push_in", P_RESTAURANT),
    img("Split diagram comparing a price with a currency symbol against the same price without one",
        "pan_left_right", P_RESTAURANT),
    img("Wide flat menu-page diagram fully annotated with zone markers like an architectural plan",
        "pull_out", P_RESTAURANT),
], thumb("A restaurant menu page with a glowing eye-tracking heatmap showing exactly where diners "
         "look first", P_RESTAURANT))

register(8, "The Decompression Zone: The First Ten Feet of Every Store", [
    "Stores know you're basically blind for the first few steps after you walk in. So they don't sell you anything there.",
    "It's called the decompression zone: the transition strip just inside the entrance.",
    "Coming in from a parking lot, your eyes are adjusting, your pace is still fast, and your attention is on the doorway.",
    "Anything placed in that strip is effectively invisible. Signs go unread. Displays go unseen.",
    "So retailers leave it deliberately sparse. Carts, a mat, maybe a seasonal display nobody expects you to stop for.",
    "The selling starts the moment that strip ends, and that's where the good stuff waits.",
    "This is also why the entrance often opens onto produce or flowers: fresh, colorful, and low-commitment.",
    "It sets the tone before you've made a single decision.",
    "The store isn't wasting that space. It's spending it on getting you ready to shop.",
], [
    img("Overhead store-entrance floor-plan diagram with a shaded arc marking the first several feet "
        "inside the doors", "push_in", P_RETAIL),
    img("Overhead entrance diagram with the shaded transition strip labeled by a bracket measurement",
        "static_drift", P_RETAIL),
    img("Overhead diagram with a fast-moving path arrow and a small eye icon marked as adjusting",
        "pan_left_right", P_RETAIL),
    img("Overhead entrance diagram with faded ghosted display icons inside the shaded zone, drawn "
        "semi-transparent to read as unseen", "push_in", P_RETAIL),
    img("Overhead entrance diagram showing only carts and a floor mat inside the sparse zone",
        "static_drift", P_RETAIL),
    img("Overhead diagram where product displays begin abruptly at the edge of the shaded zone, lit "
        "in warm amber", "hard_zoom_then_push_in", P_RETAIL),
    img("Overhead diagram of an entrance opening onto a colorful produce and flower zone just past "
        "the transition strip", "push_in", P_RETAIL),
    img("Overhead diagram with a mood-gradient band running from cool grey at the door to warm amber "
        "in the store", "pan_left_right", P_RETAIL),
    img("Wide overhead store plan with the transition strip and the selling floor clearly delineated "
        "as two distinct zones", "pull_out", P_RETAIL),
], thumb("Overhead store-entrance blueprint with the first ten feet shaded and marked as a zone where "
         "nothing registers", P_RETAIL))

register(9, "$9.99: The Left-Digit Trick That Still Works on Everyone", [
    "You know the price is basically ten dollars. Your brain files it as nine anyway.",
    "It's called left-digit bias, and it survives you knowing about it.",
    "We read numbers left to right, and we form an impression before we finish reading.",
    "The leftmost digit anchors the whole price. Nine-point-nine-nine lands in the nine range, not the ten range.",
    "One cent buys an entire perceived price bracket.",
    "That's also why prices ending in nine cluster around thresholds: 19.99, 49.99, 99.99. Each one sits just under a mental wall.",
    "Now flip it. Look at how luxury brands price things.",
    "Round numbers, no cents, sometimes no currency symbol at all — because a price that looks calculated looks like a bargain, and bargain is the opposite of what they're selling.",
    "Ending in nine says deal. Ending in zero says quality. Both are telling you how to feel, not what it costs.",
], [
    img("Close-up price-tag diagram with the leading digit oversized and the trailing cents shrunk "
        "small", "push_in", P_PRICING),
    img("Price-tag diagram with a small brain icon beside it, an arrow reading only the first digit",
        "static_drift", P_PRICING),
    img("Diagram of a number being read left to right with a directional arrow and a stopping point "
        "before the end", "pan_left_right", P_PRICING),
    img("Two price tags side by side on a number line, one falling in a lower bracket band despite "
        "near-identical value", "push_in", P_PRICING),
    img("Number-line diagram with a one-cent gap marked by a bracket and a large bracket-labeled "
        "perception gap above it", "hard_zoom_then_push_in", P_PRICING),
    img("Column of stacked price tags all ending in nine, each sitting just below a horizontal "
        "threshold line", "pull_out", P_PRICING),
    img("Minimalist luxury price card with a clean round number, no cents, generous white space",
        "push_in", P_PRICING),
    img("Split comparison of a busy discount price tag against a spare minimalist luxury price card",
        "pan_left_right", P_PRICING),
    img("Wide diagram of two price tags at opposite ends of a spectrum bar labeled by tone rather "
        "than value", "pull_out", P_PRICING),
], thumb("A large price tag ending in ninety-nine cents with the leading digit glowing and the cents "
         "fading out", P_PRICING))

register(10, "The Checkout Gauntlet: The Most Expensive Aisle Per Square Foot", [
    "The candy at the register isn't there for convenience. That's the highest-earning floor space in the building.",
    "Think about what's true at the checkout that isn't true anywhere else in the store.",
    "You're standing still. You're facing a wall of products. And you can't leave.",
    "You've also just made dozens of decisions walking the aisles, which is the point.",
    "Decision fatigue is real: the more choices you've made, the worse your resistance gets to the next one.",
    "So the register lane is stocked with small, cheap, high-margin things that don't feel like a decision at all.",
    "Nothing there is worth comparison shopping, which is exactly why nobody does.",
    "And the lower shelves are stocked at the height of a child sitting in a cart.",
    "Several countries have passed rules for candy-free checkout lanes. That tells you how well this works.",
], [
    img("Overhead diagram of a narrow checkout lane walled on both sides by impulse racks",
        "push_in", P_SUPERMARKET),
    img("Overhead store plan with the checkout zone highlighted in gold against the rest of the floor",
        "static_drift", P_SUPERMARKET),
    img("Overhead lane diagram with a stationary figure marker and rack sightlines drawn on both "
        "sides", "pan_left_right", P_SUPERMARKET),
    img("Overhead store plan with many small decision markers scattered along an aisle path leading "
        "to the register", "push_in", P_SUPERMARKET),
    img("Line graph of a declining resistance curve running alongside a store path from entrance to "
        "checkout", "hard_zoom_then_push_in", P_SUPERMARKET),
    img("Checkout rack cross-section filled with small generic package silhouettes, warm amber lit",
        "pull_out", P_SUPERMARKET),
    img("Price-comparison diagram where two small items sit under a crossed-out comparison magnifier "
        "icon", "push_in", P_SUPERMARKET),
    img("Checkout rack cross-section with a low glowing band at seated-child height in a cart",
        "push_in", P_SUPERMARKET),
    img("Wide checkout lane diagram with one lane marked clear and empty of impulse racks",
        "pull_out", P_SUPERMARKET),
], thumb("Overhead diagram of a checkout lane walled in by glowing impulse racks with no way around",
         P_SUPERMARKET))

register(11, "Slot Machines and the Near-Miss: Losing Designed to Feel Like Winning", [
    "Two matching symbols and a blank isn't bad luck. The machine is built to show you almost-wins.",
    "Modern slot machines don't work the way the spinning reels suggest.",
    "The outcome is decided by a random number generator the instant you press the button. The animation is theater.",
    "That means the machine controls what a loss looks like, not just whether you lose.",
    "And a loss displayed as a near-miss — jackpot symbol landing just above or below the payline — doesn't feel like a loss.",
    "Brain imaging research has found near-misses activating reward-related circuits similar to actual wins.",
    "Which means a near-miss can encourage the next spin more effectively than an ordinary loss does.",
    "Regulators in several places have looked hard at whether deliberately engineered near-misses cross into deception.",
    "The reels stopped being random a long time ago. Only the outcome is.",
], [
    img("Close-up diagram of three slot reels frozen with matching symbols just above the payline",
        "push_in", P_CASINO),
    img("Cutaway diagram of a slot machine cabinet showing an electronic board where mechanical reels "
        "would be", "static_drift", P_CASINO),
    img("Technical flow diagram: a button press feeding a random-number block that then drives a reel "
        "animation block", "pan_left_right", P_CASINO),
    img("Diagram showing an outcome block connected by an arrow to several different possible reel "
        "display arrangements", "push_in", P_CASINO),
    img("Close-up of a reel display with a jackpot symbol sitting one position off the payline, "
        "glowing gold", "hard_zoom_then_push_in", P_CASINO),
    img("Abstract stylized brain diagram with a reward region glowing, connected to a near-miss reel "
        "icon", "pull_out", P_CASINO),
    img("Comparison diagram of two loss outcomes, one plain and one near-miss, with a larger "
        "continue-play arrow from the near-miss", "push_in", P_CASINO),
    img("Regulatory-document icon and a gavel silhouette beside a slot reel diagram, muted formal "
        "tones", "static_drift", P_CASINO),
    img("Wide diagram of a slot machine with the reels dimmed and the internal processor block lit",
        "pull_out", P_CASINO),
], thumb("A slot reel frozen one symbol away from the jackpot line, glowing gold like a win",
         P_CASINO))

register(12, "Supermarket Carts Kept Getting Bigger, and It Wasn't for You", [
    "The shopping cart has grown dramatically since it was invented. Grocery lists haven't.",
    "When the cart was first introduced in the 1930s, shoppers refused to use it.",
    "It looked like a baby carriage. Stores hired actors to push carts around until it looked normal.",
    "Once it caught on, the trend went one direction only: bigger.",
    "Here's why. A container sets an expectation of how full it should be.",
    "Six items in a small basket looks like a shop. The same six items in a large cart looks like you forgot something.",
    "That gap between what's in the cart and what the cart could hold is a quiet, constant prompt.",
    "It's the same reason bulk-size packaging and oversized dinner plates work the way they do.",
    "You're not filling a list anymore. You're filling a container someone else chose the size of.",
], [
    img("Side-by-side scale diagram of an early small shopping cart and a modern large one",
        "push_in", P_SUPERMARKET),
    img("Vintage-style technical patent drawing of a folding shopping cart, clean linework on aged "
        "paper", "static_drift", P_SUPERMARKET),
    img("Vintage illustration of an early cart beside a pram silhouette for shape comparison",
        "pan_left_right", P_SUPERMARKET),
    img("Timeline diagram of cart outlines growing progressively larger left to right", "push_in",
        P_SUPERMARKET),
    img("Diagram of an empty container outline with a dashed fill-line marked near the top",
        "static_drift", P_SUPERMARKET),
    img("Two containers of different sizes holding the identical small group of item icons, the large "
        "one looking sparse", "hard_zoom_then_push_in", P_SUPERMARKET),
    img("Cart diagram with the empty volume above the items shaded and marked with a prompt arrow",
        "pull_out", P_SUPERMARKET),
    img("Comparison row of an oversized package, a large plate outline, and a large cart, all marked "
        "with the same container principle", "push_in", P_SUPERMARKET),
    img("Wide diagram of a large cart outline with a small hand-written-style list icon beside it for "
        "scale", "pull_out", P_SUPERMARKET),
], thumb("Two shopping carts drawn to scale, decades apart, the same few items lost inside the modern "
         "one", P_SUPERMARKET))

register(13, "Scent Piping: The Bakery Smell That Isn't Coming From the Bakery", [
    "That fresh bread smell hits you at the door. The ovens are at the other end of the building.",
    "Scent is the only sense wired almost directly into the brain's memory and emotion centers.",
    "It bypasses the processing that sight and sound go through, which is why a smell can trigger a memory before you identify it.",
    "Retailers figured this out and industrialized it.",
    "Some stores duct real bakery air toward the entrance. Others use scent diffusers in the ventilation system entirely.",
    "The goal is appetite: a hungry shopper buys more food, and buys it faster, than a full one.",
    "It goes well beyond groceries. Hotels, casinos, and clothing chains commission signature scents the way they commission logos.",
    "You won't consciously notice it. That's the design specification, not a side effect.",
    "The building is talking to the oldest part of your brain, and it isn't using words.",
], [
    img("Store cross-section diagram with scent-flow arrows traveling from a back bakery area through "
        "ducts to the front entrance", "push_in", P_SENSORY),
    img("Stylized anatomical diagram of a scent pathway drawn as a short direct line into a brain "
        "outline", "static_drift", P_SENSORY),
    img("Comparison diagram of a short direct sensory pathway beside longer, more indirect ones",
        "pan_left_right", P_SENSORY),
    img("Technical diagram of a ventilation system with a small diffuser unit highlighted inline",
        "push_in", P_SENSORY),
    img("Cross-section of ductwork with warm golden scent swirls flowing toward a doorway",
        "hard_zoom_then_push_in", P_SENSORY),
    img("Store plan with warm scent swirls near the entrance and a cart path curving toward the food "
        "zone", "pull_out", P_SENSORY),
    img("Row of building-type icons — hotel, casino, retail — each with a distinct small scent-swirl "
        "motif above it", "push_in", P_SENSORY),
    img("Diagram of a person-silhouette outline with a faint scent swirl and no awareness indicator",
        "static_drift", P_SENSORY),
    img("Wide store cross-section with the full scent circulation loop drawn end to end", "pull_out",
        P_SENSORY),
], thumb("A store cross-section with golden scent swirls piped from a back bakery all the way to the "
         "front door", P_SENSORY))

register(14, "Store Music Tempo: The Soundtrack That Sets Your Walking Speed", [
    "Slow music in the supermarket. Fast music in the fast-food line. Your pace is being conducted.",
    "This is one of the older findings in retail research, and it's held up well.",
    "People unconsciously match their movement to the tempo of background music.",
    "Slow the music down, and shoppers walk more slowly. Walk more slowly, and you spend longer in the store.",
    "Longer in the store means more shelf-feet seen, and more chances for something unplanned.",
    "Now go somewhere that needs the opposite. A fast-food restaurant needs your table back.",
    "The music speeds up, and so does everyone eating under it.",
    "It goes further than tempo. A well-known study played French and German music in a wine aisle on alternating days.",
    "The music didn't change what wine was there. It changed which wine people picked.",
], [
    img("Split diagram: a slow-tempo waveform above a supermarket aisle plan, a fast-tempo waveform "
        "above a fast-food counter plan", "push_in", P_SENSORY),
    img("Vintage-style research-paper icon beside a waveform, muted archival tones", "static_drift",
        P_SENSORY),
    img("Diagram of footstep markers spaced to match the peaks of a waveform running beneath them",
        "pan_left_right", P_SENSORY),
    img("Two aisle paths with footstep markers spaced widely under a slow waveform and tightly under "
        "a fast one", "push_in", P_SENSORY),
    img("Store plan with a dwell-time meter and a path line covering more aisle length", "pull_out",
        P_SENSORY),
    img("Fast-food dining plan with a table-turnover stopwatch icon and a fast waveform overhead",
        "push_in", P_SENSORY),
    img("Diagram of dining-table icons cycling through occupancy states under a fast tempo waveform",
        "static_drift", P_SENSORY),
    img("Wine-aisle shelf diagram with two distinct musical-note motifs above alternating shelf "
        "sections", "hard_zoom_then_push_in", P_SENSORY),
    img("Wide shelf diagram with identical bottle silhouettes and two different selection-arrow "
        "patterns overlaid", "pull_out", P_SENSORY),
], thumb("Two waveforms over two store aisles, footsteps spaced wide under one and tight under the "
         "other", P_SENSORY))

register(15, "Fast-Food Seating Is Uncomfortable on Purpose", [
    "Those hard chairs and bright lights aren't a budget decision. They're a timer.",
    "A fast-food restaurant makes money on throughput: how many people move through a seat per hour.",
    "A table occupied for ninety minutes by one order is a table losing money.",
    "So the room is engineered to be pleasant enough to enter and unpleasant enough to linger in.",
    "Hard molded seating with no cushioning gets uncomfortable at a predictable point.",
    "Bright, even, high-color-temperature lighting keeps alertness up and intimacy down.",
    "Hard surfaces everywhere mean sound bounces, so the room stays loud and conversation stays effortful.",
    "Now compare that to a restaurant that wants you to order another round: soft seating, dim warm light, sound-absorbing fabric.",
    "Same industry, opposite instructions to your body, and neither one mentions it on the menu.",
], [
    img("Interior diagram of a fast-food dining area with hard molded seating and a stopwatch icon "
        "overlaid", "push_in", P_RESTAURANT),
    img("Diagram of seat icons cycling through occupancy states with a throughput counter beside them",
        "static_drift", P_RESTAURANT),
    img("Comparison diagram of one long-occupancy table against several short-occupancy tables",
        "pan_left_right", P_RESTAURANT),
    img("Interior plan annotated with comfort-duration markers at each seating position", "push_in",
        P_RESTAURANT),
    img("Cross-section of a hard molded seat with a discomfort-onset curve graphed beside it",
        "hard_zoom_then_push_in", P_RESTAURANT),
    img("Lighting diagram with a color-temperature scale marked toward the cool bright end",
        "push_in", P_RESTAURANT),
    img("Acoustic diagram of sound rays bouncing off hard surfaces in a dining room", "pull_out",
        P_RESTAURANT),
    img("Split interior comparison: hard bright fast-service room beside a soft dim lounge room",
        "pan_left_right", P_RESTAURANT),
    img("Wide comparison diagram of two dining rooms annotated with opposite dwell-time targets",
        "pull_out", P_RESTAURANT),
], thumb("A hard molded fast-food chair with a stopwatch glowing on its seat", P_RESTAURANT))

register(16, "The Endcap Illusion: The Aisle-End 'Deal' That Isn't Discounted", [
    "Products at the end of an aisle sell dramatically better than the same products mid-aisle. Most of them aren't on sale.",
    "The endcap is the display at the head of the aisle, facing the main walkway.",
    "Everyone walking the perimeter of the store passes it. Nobody has to turn down an aisle to see it.",
    "That visibility alone makes it the most contested space on the floor, and suppliers pay for it.",
    "Here's the illusion: shoppers have learned that endcaps are where deals go.",
    "So the display format itself signals discount, even when the price tag never moved.",
    "Bright sign, bulk stack, aisle-end position — the whole grammar of a sale, applied to an everyday price.",
    "The tell is on the shelf tag. A genuine markdown says so, usually with the old price shown for comparison.",
    "A plain tag on a dramatic display is just a plain price standing somewhere flattering.",
], [
    img("Overhead store plan with the aisle-end display positions highlighted along the main walkway",
        "push_in", P_SUPERMARKET),
    img("Overhead diagram of a single aisle with its head-end display block marked and facing the "
        "walkway", "static_drift", P_SUPERMARKET),
    img("Overhead plan with perimeter traffic flow arrows all passing the aisle-end positions",
        "pan_left_right", P_SUPERMARKET),
    img("Diagram of currency icons flowing toward a highlighted aisle-end display block", "push_in",
        P_SUPERMARKET),
    img("Display diagram with a bright sale-style sign above an unchanged price tag",
        "hard_zoom_then_push_in", P_SUPERMARKET),
    img("Close-up diagram of a plain price tag against a dramatic bulk-stack display behind it",
        "pull_out", P_SUPERMARKET),
    img("Diagram of the visual grammar of a sale display, annotated element by element", "push_in",
        P_SUPERMARKET),
    img("Two shelf-tag diagrams side by side, one showing a struck-through comparison price and one "
        "plain", "pan_left_right", P_SUPERMARKET),
    img("Wide overhead plan with a magnifier icon hovering over an aisle-end shelf tag", "pull_out",
        P_SUPERMARKET),
], thumb("An aisle-end display glowing like a sale with a magnifying glass revealing an ordinary "
         "everyday price tag", P_SUPERMARKET))

register(17, "Free Samples: The Cheapest Debt You'll Ever Owe", [
    "That free sample costs the store almost nothing. The feeling it creates is worth far more.",
    "Reciprocity is one of the most reliable findings in social psychology.",
    "When someone gives us something, we feel a pull to give something back. It operates below deliberate thought.",
    "It doesn't require us to like the person, or to have wanted the gift.",
    "A sample activates that pull with a bite of food and a toothpick.",
    "And the person handing it to you is standing right there, which makes walking away feel like a small social cost.",
    "That's why the sample table sits beside the product, not near the exit.",
    "The obligation is strongest at the moment the product is within arm's reach.",
    "You didn't owe anyone anything. But the feeling that you might is the entire point of the table.",
], [
    img("Diagram of a small sample tray on a stand positioned beside a product display block",
        "push_in", P_SUPERMARKET),
    img("Abstract diagram of two figures exchanging small tokens along a curved arrow loop",
        "static_drift", P_SUPERMARKET),
    img("Diagram of a give-and-return arrow loop drawn below a conscious-thought line", "pan_left_right",
        P_SUPERMARKET),
    img("Diagram of a reciprocity loop with a preference icon crossed out beside it", "push_in",
        P_SUPERMARKET),
    img("Close-up of a small sample cube on a toothpick casting a large product-shaped shadow",
        "hard_zoom_then_push_in", P_SUPERMARKET),
    img("Overhead diagram of a sample station with a staff silhouette and a shopper path passing "
        "directly beside it", "pull_out", P_SUPERMARKET),
    img("Overhead store plan with a sample station placed adjacent to its matching product display",
        "push_in", P_SUPERMARKET),
    img("Diagram of an arm's-reach radius circle drawn between a sample tray and a product shelf",
        "push_in", P_SUPERMARKET),
    img("Wide overhead plan with the sample station and product zone linked by a single short arrow",
        "pull_out", P_SUPERMARKET),
], thumb("A tiny sample cube on a toothpick casting a giant shadow shaped like a full product box",
         P_SUPERMARKET))

register(18, "'Limit 4 Per Customer': The Restriction That Sells More", [
    "The sign looks like it's protecting supply. It's planting a number in your head.",
    "Anchoring is the tendency to lean on the first number we're given, even an irrelevant one.",
    "Walk up with no quantity in mind, and a limit sign supplies one for free.",
    "Four stops being a ceiling and starts being a suggestion.",
    "The sign does a second job at the same time. A limit implies the item is scarce.",
    "Scarce implies desirable, and desirable implies you should decide now rather than later.",
    "Notice that most limits are set well above what a normal shopper would buy.",
    "A limit of two on something you'd buy one of isn't restricting anyone. It's just showing you the number two.",
    "The store isn't rationing. It's recommending, in the grammar of a restriction.",
], [
    img("Shelf-sign diagram showing a quantity limit notice above a row of generic product icons",
        "push_in", P_PRICING),
    img("Diagram of an anchor icon dropping onto a number line with a value marker settling near it",
        "static_drift", P_PRICING),
    img("Diagram of an empty thought-bubble outline beside a sign, then the same bubble containing "
        "the sign's numeral", "pan_left_right", P_PRICING),
    img("Diagram of a ceiling line reinterpreted as an upward-pointing target arrow", "push_in",
        P_PRICING),
    img("Shelf diagram with a limit sign and a small scarcity indicator glowing beside it",
        "hard_zoom_then_push_in", P_PRICING),
    img("Diagram linking a scarcity icon to a desirability icon to an urgency clock icon in sequence",
        "pull_out", P_PRICING),
    img("Bar comparison of a typical purchase quantity against a much higher posted limit value",
        "push_in", P_PRICING),
    img("Diagram of a single product icon beneath a limit sign showing a larger number", "push_in",
        P_PRICING),
    img("Wide shelf diagram with the limit sign reframed by an annotation bracket as a suggestion",
        "pull_out", P_PRICING),
], thumb("A shelf sign reading as a purchase limit with the numeral glowing like a recommendation",
         P_PRICING))

register(19, "Casino Chips: Money Designed Not to Feel Like Money", [
    "Nobody slides five hundred dollars across a table easily. A stack of clay discs? No problem.",
    "Every layer you put between a person and actual currency makes spending easier.",
    "Researchers call it the pain of paying: handing over cash produces genuine reluctance.",
    "Chips remove almost all of it. They're a different color, a different shape, and a different unit.",
    "You stop counting dollars and start counting reds and greens.",
    "The exchange happens once, at the start, when you're at your most optimistic.",
    "Everything after that is playing with tokens, not spending money.",
    "And this isn't only a casino trick. Gift cards, arcade tokens, in-game currencies, and tap-to-pay all work the same way.",
    "The easier a payment is to make, the less it feels like one. That's not a convenience feature. It's the mechanism.",
], [
    img("Diagram of a cash stack transforming into a stack of round chip tokens at a cage window",
        "push_in", P_CASINO),
    img("Layered diagram showing steps of abstraction between a currency icon and a spending action",
        "static_drift", P_CASINO),
    img("Meter diagram labeled by reluctance level, reading high beside a cash icon", "pan_left_right",
        P_CASINO),
    img("Comparison diagram of a currency note beside colored round tokens of differing shapes",
        "push_in", P_CASINO),
    img("Diagram of stacked colored tokens sorted by color rather than by numeric value",
        "hard_zoom_then_push_in", P_CASINO),
    img("Diagram of a single exchange point at the start of a timeline, with a long token-play "
        "stretch after it", "pull_out", P_CASINO),
    img("Diagram of a token flow along a table path with no currency icons anywhere in the sequence",
        "push_in", P_CASINO),
    img("Row of abstraction icons: gift card, arcade token, in-game coin, contactless card symbol",
        "pan_left_right", P_CASINO),
    img("Wide diagram of a friction scale sliding from high to low beside a spending-volume curve "
        "rising", "pull_out", P_CASINO),
], thumb("A currency note transforming into a casual stack of colorful clay chips", P_CASINO))

register(20, "The Racetrack Layout: Why Big Stores Loop You in a Circle", [
    "Some large stores are built as one long loop. Once you're on it, you see everything.",
    "It's called a racetrack or loop layout, and it's a deliberate alternative to a simple grid.",
    "A grid of parallel aisles lets you cut straight to what you need and leave.",
    "A loop doesn't. The main path curves through every department in sequence.",
    "Departments get arranged along it in an order designed to carry you forward, not to let you exit early.",
    "The measurement retailers care about is exposure: how many product-feet a shopper passes.",
    "A loop maximizes that number without adding a single square foot of building.",
    "You'll notice the exit usually isn't visible from most of the track, which is not an oversight.",
    "You didn't get lost. You completed a lap.",
], [
    img("Overhead store plan drawn as a single continuous loop path with departments arranged along "
        "it", "push_in", P_RETAIL),
    img("Comparison of two overhead plans, a parallel grid layout beside a loop layout", "static_drift",
        P_RETAIL),
    img("Overhead grid plan with a short direct path from entrance to a target and back", "pan_left_right",
        P_RETAIL),
    img("Overhead loop plan with a curving main path and no cross-cut shortcuts drawn", "push_in",
        P_RETAIL),
    img("Overhead loop plan with department blocks numbered in sequence along the track",
        "hard_zoom_then_push_in", P_RETAIL),
    img("Diagram of a path line with a distance counter and product-frontage markers accumulating "
        "along it", "pull_out", P_RETAIL),
    img("Two overhead plans of identical footprint, one grid and one loop, with different path "
        "lengths marked", "push_in", P_RETAIL),
    img("Overhead loop plan with sightline rays from several track positions, none reaching the exit",
        "push_in", P_RETAIL),
    img("Wide overhead loop plan with the full circuit lit end to end like a completed lap",
        "pull_out", P_RETAIL),
], thumb("An overhead store blueprint drawn as a literal racetrack loop with departments as pit stops",
         P_RETAIL))

register(21, "Anchor Products: The $8,000 Watch That Exists to Sell the $800 One", [
    "The most expensive thing in the display case isn't there to be bought. It's there to change what expensive means.",
    "Price anchoring works because we judge prices by comparison, not in isolation.",
    "There's no innate sense of what a watch should cost. There's only what's next to it.",
    "So put one extraordinary price at the top of the range, and everything beneath it recalibrates.",
    "The eight-thousand-dollar piece makes the eight-hundred-dollar piece read as sensible rather than expensive.",
    "It doesn't need to sell. It needs to be seen, which is why it gets the lighting and the center of the case.",
    "Menus do this with one dish. Software pricing pages do it with an enterprise tier most visitors will never choose.",
    "Three options, and the top one exists mostly to make the middle one comfortable.",
    "The anchor isn't for sale. It's for scale.",
], [
    img("Display-case diagram with one spotlit high-price item and several lower-priced items beside "
        "it", "push_in", P_PRICING),
    img("Diagram of two price values being compared by a balance scale rather than measured "
        "absolutely", "static_drift", P_PRICING),
    img("Diagram of a lone price tag with a question-mark icon and no reference points around it",
        "pan_left_right", P_PRICING),
    img("Number-line diagram with one extreme high anchor pulling a perceived-normal band upward",
        "push_in", P_PRICING),
    img("Two price tags side by side, the smaller one glowing as reasonable next to a much larger one",
        "hard_zoom_then_push_in", P_PRICING),
    img("Display-case diagram with the brightest lighting focused on the highest-priced position",
        "pull_out", P_PRICING),
    img("Row of comparison layouts: a menu column, a pricing-tier row, and a display case, each with "
        "a top anchor marked", "push_in", P_PRICING),
    img("Three-tier pricing diagram with the middle tier highlighted and the top tier dimmed",
        "pan_left_right", P_PRICING),
    img("Wide diagram of a measuring-scale graphic beside a price range, the anchor marked as a "
        "reference point", "pull_out", P_PRICING),
], thumb("A spotlit luxury item in a display case making the price tag beside it appear to shrink",
         P_PRICING))

register(22, "Theme Park Wait Times Are Inflated on Purpose", [
    "The sign said sixty minutes. You waited forty. That gap was designed, not lucky.",
    "Parks post wait times that run deliberately longer than the real queue.",
    "It sounds like bad service. It's the opposite, and it comes down to expectation.",
    "Satisfaction isn't about how long you waited. It's about how long you waited compared to how long you expected to.",
    "Wait forty minutes expecting thirty, and you're annoyed. Wait the same forty expecting sixty, and you feel like you got away with something.",
    "The wait didn't change. The reference point did.",
    "Parks also give you something to do inside the queue: themed rooms, story elements, interactive panels.",
    "Occupied time consistently feels shorter than empty time, which is why the queue is now part of the ride.",
    "They're not managing the line. They're managing your memory of it.",
], [
    img("Queue-entrance diagram with a posted wait-time sign beside a stopwatch showing a shorter "
        "actual duration", "push_in", P_ATTRACTION),
    img("Comparison bar diagram of a posted duration against a shorter true duration", "static_drift",
        P_ATTRACTION),
    img("Diagram of an expectation marker and an outcome marker on a satisfaction axis", "pan_left_right",
        P_ATTRACTION),
    img("Diagram of a satisfaction curve driven by the gap between expected and actual values",
        "push_in", P_ATTRACTION),
    img("Two identical duration bars with different expectation markers producing opposite mood icons",
        "hard_zoom_then_push_in", P_ATTRACTION),
    img("Diagram of a fixed duration bar with only the reference marker sliding along it", "pull_out",
        P_ATTRACTION),
    img("Overhead queue diagram with themed room blocks and interactive station icons along the path",
        "push_in", P_ATTRACTION),
    img("Comparison of two queue paths, one bare and one filled with activity markers, with different "
        "perceived-duration meters", "pan_left_right", P_ATTRACTION),
    img("Wide queue diagram annotated as a continuous part of the ride experience", "pull_out",
        P_ATTRACTION),
], thumb("A posted wait-time sign beside a stopwatch reading far less, with a satisfaction meter rising",
         P_ATTRACTION))

register(23, "Hidden Queues: Why You Can Never See How Long the Line Really Is", [
    "You committed to the line before you could see the line. That corner was the whole point.",
    "Queue design follows one rule above all others: never show a newcomer the full length of the wait.",
    "So the visible segment stays short. The rest folds away behind a wall, a corner, or a switchback field.",
    "By the time you can see the true scale, you've already invested minutes.",
    "That's sunk cost doing the work. Leaving now means the time you've already spent buys nothing.",
    "Planners have a term for the spot where people stop reconsidering. It's the commitment point.",
    "Everything before it is designed to look easy. Everything after it is designed to be endured.",
    "The switchback shape does something else too: it keeps you passing the same people repeatedly, which makes progress feel real.",
    "The line was never hidden from you. It was revealed on a schedule.",
], [
    img("Overhead queue diagram with a short visible entry segment and a large folded switchback "
        "field concealed behind a wall", "push_in", P_ATTRACTION),
    img("Overhead diagram with a sightline ray from the queue entrance stopping at a wall",
        "static_drift", P_ATTRACTION),
    img("Overhead diagram of a switchback field drawn compactly behind a barrier block",
        "pan_left_right", P_ATTRACTION),
    img("Queue diagram with an elapsed-time marker positioned partway along the path", "push_in",
        P_ATTRACTION),
    img("Diagram of an invested-time bar weighed against an exit arrow on a balance",
        "hard_zoom_then_push_in", P_ATTRACTION),
    img("Overhead queue diagram with a single marked threshold point along the path", "pull_out",
        P_ATTRACTION),
    img("Split queue diagram with the pre-threshold section lit easy and the post-threshold section "
        "dense", "push_in", P_ATTRACTION),
    img("Overhead switchback diagram with repeated adjacent path segments and progress markers",
        "push_in", P_ATTRACTION),
    img("Wide overhead queue diagram with the full concealed length finally drawn end to end",
        "pull_out", P_ATTRACTION),
], thumb("An overhead queue blueprint with a tiny visible line and an enormous hidden switchback maze "
         "behind a wall", P_ATTRACTION))

register(24, "Grocery Essentials Are Scattered on Purpose", [
    "Bread, eggs, milk, butter. Four things almost every shopper needs, placed in four different corners.",
    "That's not poor planning. It's the oldest trick in store layout.",
    "Staples are what retailers call destination items: things you'll cross the whole building for.",
    "Because you'll cross the building for them, they can be used as anchors to define your route.",
    "Put them adjacent, and a shopper walks a short line and leaves. Spread them out, and that same shopper walks the perimeter and cuts through the middle twice.",
    "Every extra aisle crossed is more exposure, and exposure is what converts into unplanned purchases.",
    "Here's the giveaway. Look at the same chain's online store.",
    "Milk, eggs, and bread are one click apart, because online there's no walk to monetize.",
    "The same company organizes the same products completely differently the moment the layout stops earning.",
], [
    img("Overhead supermarket plan with four staple-item icons pinned at widely separated corners",
        "push_in", P_SUPERMARKET),
    img("Overhead plan with a route line connecting the four staple pins across the whole floor",
        "static_drift", P_SUPERMARKET),
    img("Diagram of destination-item markers with long approach arrows drawn toward them",
        "pan_left_right", P_SUPERMARKET),
    img("Overhead plan with anchor pins defining the shape of a shopper path", "push_in",
        P_SUPERMARKET),
    img("Comparison of two overhead plans, one with clustered staples and a short path, one with "
        "scattered staples and a long path", "hard_zoom_then_push_in", P_SUPERMARKET),
    img("Overhead plan with aisle-crossing counters incrementing along a long route", "pull_out",
        P_SUPERMARKET),
    img("Split diagram of a physical store plan beside a simple vertical app-list layout", "push_in",
        P_SUPERMARKET),
    img("Diagram of a compact list layout with staple icons stacked adjacently", "pan_left_right",
        P_SUPERMARKET),
    img("Wide comparison diagram of two layouts of identical products with opposite spacing logic",
        "pull_out", P_SUPERMARKET),
], thumb("An overhead store blueprint with bread, milk, and eggs pinned at opposite corners and a long "
         "path between them", P_SUPERMARKET))

register(25, "Produce Misting: Freshness Theater That Rots Food Faster", [
    "The gentle mist on the vegetables makes them look farm-fresh. It also makes them spoil faster.",
    "Water on the surface of most produce accelerates decay rather than preventing it.",
    "Leafy greens genuinely benefit from humidity. Plenty of the other items under the same nozzles do not.",
    "So why mist everything? Because glistening produce sells.",
    "Freshness is judged visually, in a couple of seconds, and water reads as fresh even when it's doing the opposite.",
    "There's a second cost, and this one is literal.",
    "Produce is sold by weight, and the water clinging to it is part of that weight.",
    "It's a small amount per item. Across every shopper, every day, it isn't small at all.",
    "You're paying for freshness theater by the pound, then throwing it out sooner.",
], [
    img("Produce-display cross-section diagram with mist nozzles above and water droplets on generic "
        "vegetable shapes", "push_in", P_SUPERMARKET),
    img("Diagram of a decay-rate curve rising alongside a surface-moisture indicator", "static_drift",
        P_SUPERMARKET),
    img("Comparison diagram of leaf-type produce and non-leaf produce under identical misting nozzles",
        "pan_left_right", P_SUPERMARKET),
    img("Produce display diagram with a strong specular shine highlight across the surfaces",
        "push_in", P_SUPERMARKET),
    img("Diagram of a short judgment-time marker beside a freshness perception meter reading high",
        "hard_zoom_then_push_in", P_SUPERMARKET),
    img("Scale diagram with produce and visible water droplets both resting on the weighing platform",
        "pull_out", P_SUPERMARKET),
    img("Close-up diagram of a weighing scale readout with a small added-weight increment marked",
        "push_in", P_SUPERMARKET),
    img("Diagram of a small per-item increment multiplying across a long row of repeated item icons",
        "pan_left_right", P_SUPERMARKET),
    img("Wide produce-display diagram with a shine highlight and a small spoilage clock behind it",
        "pull_out", P_SUPERMARKET),
], thumb("Glistening misted vegetables under nozzles with a small spoilage clock ticking behind the "
         "shine", P_SUPERMARKET))

register(26, "Right-Turn Bias: The Direction Every Store Points You", [
    "Walk into a store and you'll probably drift right. Retailers have built around that for decades.",
    "The observation comes out of retail anthropology: watch enough entrances, and a directional pattern emerges.",
    "Most shoppers, in most countries that drive on the right, veer right and then travel counterclockwise.",
    "Whether that's driving habit, handedness, or something else is genuinely still argued.",
    "But retailers don't need the cause. They only need the pattern to be reliable.",
    "So the first display to the right of the entrance becomes prime real estate.",
    "High-margin and impulse categories go there. Necessities go deep, where you'll walk regardless.",
    "The interesting part: in countries that drive on the left, the bias reportedly tends to flip.",
    "Which means the store you're standing in may have been laid out around which side of the road you learned to drive on.",
], [
    img("Overhead store-entrance diagram with a thick traffic arrow curving to the right", "push_in",
        P_RETAIL),
    img("Overhead plan with multiple observed path lines overlaid, most bending the same direction",
        "static_drift", P_RETAIL),
    img("Overhead store plan with a counterclockwise circulation arrow around the perimeter",
        "pan_left_right", P_RETAIL),
    img("Diagram of several candidate cause icons connected by question-mark links to a directional "
        "arrow", "push_in", P_RETAIL),
    img("Overhead plan with the directional pattern marked as consistent across repeated observations",
        "static_drift", P_RETAIL),
    img("Overhead entrance diagram with the right-hand display zone highlighted in gold",
        "hard_zoom_then_push_in", P_RETAIL),
    img("Overhead plan with high-margin category blocks near the entrance and staples placed deep",
        "push_in", P_RETAIL),
    img("Mirrored pair of overhead plans with traffic arrows curving in opposite directions",
        "pan_left_right", P_RETAIL),
    img("Wide overhead plan with a road-direction icon in the margin linked to the store's "
        "circulation arrow", "pull_out", P_RETAIL),
], thumb("A store entrance blueprint with a large arrow bending right into a glowing premium display "
         "zone", P_RETAIL))

register(27, "Fitting Rooms: The Most Engineered Lighting in the Building", [
    "You looked better in the fitting room than you do at home. The room was doing part of the work.",
    "Fitting-room lighting is specified more carefully than almost any other lighting in a store.",
    "Overhead-only light casts hard downward shadows, which is unflattering on a face and a body.",
    "So good fitting rooms use softer, more diffuse light from multiple directions, often with a warmer color temperature.",
    "Warmer light flatters skin tones. Diffuse light fills in the shadows that harsh overheads create.",
    "Some rooms go further with dimmers, or with mirrors angled slightly back from vertical.",
    "A mirror tilted even a few degrees changes the proportions of the reflection.",
    "None of this is dishonest about the garment. It's honest about the garment under ideal conditions you'll never repeat.",
    "Then you get home, stand under a single ceiling bulb, and meet the same clothes in a different building.",
], [
    img("Fitting-room cross-section diagram with light sources marked at multiple positions",
        "push_in", P_PERCEPTION),
    img("Lighting-specification diagram with annotated fixture positions and beam angles",
        "static_drift", P_PERCEPTION),
    img("Diagram of a single overhead source casting hard downward shadow shapes", "pan_left_right",
        P_PERCEPTION),
    img("Diagram of multiple diffuse sources producing soft even illumination in a small room",
        "push_in", P_PERCEPTION),
    img("Color-temperature scale diagram with a warm point marked as the flattering range",
        "hard_zoom_then_push_in", P_PERCEPTION),
    img("Cross-section of a mirror mounted at a slight backward tilt with an angle measurement marked",
        "pull_out", P_PERCEPTION),
    img("Geometric diagram of how a tilted reflective plane alters reflected proportions", "push_in",
        P_PERCEPTION),
    img("Split comparison of a well-lit small room beside a plain room with one overhead fixture",
        "pan_left_right", P_PERCEPTION),
    img("Wide comparison diagram of two lighting environments annotated with their fixture counts",
        "pull_out", P_PERCEPTION),
], thumb("A fitting-room cross-section with warm angled lights and a subtly tilted mirror beside a "
         "plain single-bulb room", P_PERCEPTION))


# ===========================================================================
# Ranks 28-50
# ===========================================================================

register(28, "The Costco Treasure Hunt: No Signs, No Map, On Purpose", [
    "The warehouse store moves its stock constantly and refuses to label the aisles. Members love it.",
    "Most retailers spend enormous effort making products easy to find. This model does the opposite deliberately.",
    "The layout shifts. Seasonal and one-off items appear in the middle of walkways with no permanent home.",
    "The effect is that you can't shop a list efficiently. You have to survey the building.",
    "That survey is the point. It converts a targeted trip into a full-store browse.",
    "The rotating stock adds urgency on top. If an item might not be here next month, waiting has a cost.",
    "So the reasonable move becomes buying it now, which is exactly the behavior the layout is built to produce.",
    "Members describe it as a treasure hunt, and they mean it as a compliment.",
    "It's the rare case where the friction is the feature, and the customer is happy to be in the maze.",
], [
    img("Overhead warehouse-store plan with unlabeled aisle blocks and no signage markers", "push_in",
        P_RETAIL),
    img("Comparison of a conventional signed store plan beside an unsigned warehouse plan",
        "static_drift", P_RETAIL),
    img("Overhead plan with irregular pallet blocks placed in open walkway areas", "pan_left_right",
        P_RETAIL),
    img("Overhead plan with a wandering survey path covering most of the floor area", "push_in",
        P_RETAIL),
    img("Comparison of a short targeted path against a long full-coverage browse path",
        "hard_zoom_then_push_in", P_RETAIL),
    img("Diagram of a product icon with an availability timer and a fading indicator beside it",
        "pull_out", P_RETAIL),
    img("Decision diagram weighing buy-now against wait, with the wait branch marked as risky",
        "push_in", P_RETAIL),
    img("Overhead plan with discovery markers scattered along a browsing route", "push_in", P_RETAIL),
    img("Wide overhead warehouse plan with the full irregular route lit as a single circuit",
        "pull_out", P_RETAIL),
], thumb("An overhead warehouse-store blueprint with unlabeled aisles and products mid-shuffle between "
         "locations", P_RETAIL))

register(29, "Vegas Hotels: Your Room Is on the Far Side of the Casino", [
    "Check-in, the elevators, the restaurants, the exit. Every route runs across the gaming floor.",
    "In a casino resort, the gaming floor isn't a room in the building. It's the corridor system.",
    "Arrive from the parking garage, and the path to reception crosses it.",
    "Come down for breakfast, and the path to the restaurant crosses it again.",
    "That's not laziness in the floor plan. It's the floor plan's primary requirement.",
    "The metric is exposure: how many times a guest passes gaming during a stay, without ever intending to.",
    "Some resorts extend the walk deliberately, routing guests the long way past machines instead of the short way around.",
    "You'll also notice reception is rarely near the entrance, for exactly the same reason.",
    "You booked a hotel room. The building is arranged so you can't reach it privately.",
], [
    img("Overhead resort plan with a central gaming floor block and guest routes crossing through it",
        "push_in", P_CASINO),
    img("Overhead plan showing the gaming floor drawn as a circulation spine rather than a room",
        "static_drift", P_CASINO),
    img("Overhead plan with a parking-garage entry path crossing the gaming block toward reception",
        "pan_left_right", P_CASINO),
    img("Overhead plan with an elevator-to-restaurant path crossing the same central block",
        "push_in", P_CASINO),
    img("Overhead plan with every colored guest route converging over one shared central area",
        "hard_zoom_then_push_in", P_CASINO),
    img("Diagram of an exposure counter incrementing along a guest route over a stay timeline",
        "pull_out", P_CASINO),
    img("Comparison of a short direct route against a longer routed path past machine blocks",
        "push_in", P_CASINO),
    img("Overhead plan with the reception desk positioned deep inside rather than near the entrance",
        "push_in", P_CASINO),
    img("Wide overhead resort plan with all routes lit and the central floor glowing beneath them",
        "pull_out", P_CASINO),
], thumb("An overhead resort blueprint where every guest route crosses the same glowing central gaming "
         "floor", P_CASINO))

register(30, "Restaurant Lighting: Dim Enough to Order Dessert", [
    "The lights drop as the evening goes on, and so does your resistance to a third course.",
    "Lighting level changes how long people stay at a table and what they order while they're there.",
    "Bright light supports alertness and quick decisions. Dim light supports lingering.",
    "A lingering table orders more courses, and dessert is almost always a lingering order.",
    "Dim light also reduces the sense of being observed, which loosens self-monitoring around indulgent choices.",
    "Watch the same restaurant across a day and you'll see the strategy switch.",
    "Bright at lunch, when the goal is turning tables for a time-limited crowd.",
    "Dim at dinner, when the goal is a longer stay and a bigger check.",
    "Same room, same menu, same chairs. The dimmer switch is doing the selling.",
], [
    img("Dining-room cross-section diagram at two distinct brightness levels shown side by side",
        "push_in", P_RESTAURANT),
    img("Diagram of a brightness scale mapped against a dwell-duration curve", "static_drift",
        P_RESTAURANT),
    img("Comparison diagram of an alert-state icon under bright light and a relaxed icon under dim",
        "pan_left_right", P_RESTAURANT),
    img("Diagram of an order ticket lengthening as a dwell-time bar extends", "push_in", P_RESTAURANT),
    img("Diagram of a self-observation indicator dropping as a light level dims",
        "hard_zoom_then_push_in", P_RESTAURANT),
    img("Timeline diagram of one dining room at midday and at evening with different light levels",
        "pull_out", P_RESTAURANT),
    img("Midday dining plan with bright even lighting and a table-turnover counter", "push_in",
        P_RESTAURANT),
    img("Evening dining plan with warm dim pooled lighting and a longer dwell marker", "pan_left_right",
        P_RESTAURANT),
    img("Wide diagram of a dimmer control sliding down beside a rising check-total indicator",
        "pull_out", P_RESTAURANT),
], thumb("A dimmer switch sliding down while a dessert course glows brighter on the table below",
         P_RESTAURANT))

register(31, "Loud Bars Sell More Drinks", [
    "When the music gets louder, conversation dies and drink orders speed up. Bars know the decibel math.",
    "Field research done in real bars, not laboratories, found a consistent relationship between volume and consumption.",
    "Turn the music up, and people drink faster and order more rounds in the same span of time.",
    "There are two mechanisms, and they stack.",
    "First, loud music makes conversation effortful. When talking is hard, drinking fills the gap.",
    "Second, higher arousal from loud fast music speeds up behavior generally, including how quickly a glass empties.",
    "Notice that a bar's volume usually climbs as the night goes on rather than staying flat.",
    "That curve tracks the shift from a room of people talking to a room of people consuming.",
    "You can't hear your friend. That isn't a sound problem, it's the business model.",
], [
    img("Bar interior diagram with a decibel meter and a drinks-per-hour counter side by side",
        "push_in", P_SENSORY),
    img("Research-field icon beside a bar-room plan, indicating a real-world study setting",
        "static_drift", P_SENSORY),
    img("Diagram of a rising volume curve alongside a rising consumption-rate curve", "pan_left_right",
        P_SENSORY),
    img("Diagram of two stacked mechanism blocks feeding into one outcome arrow", "push_in", P_SENSORY),
    img("Diagram of two speech-bubble icons breaking apart under overlapping loud waveforms",
        "hard_zoom_then_push_in", P_SENSORY),
    img("Diagram of an arousal indicator rising beside a faster-emptying glass sequence", "pull_out",
        P_SENSORY),
    img("Timeline diagram of a venue's volume level climbing across evening hours", "push_in",
        P_SENSORY),
    img("Comparison of an early-evening conversational room against a late-night high-volume room",
        "pan_left_right", P_SENSORY),
    img("Wide bar diagram with a large waveform overlay and a drink counter beneath it", "pull_out",
        P_SENSORY),
], thumb("A decibel meter and a drink counter climbing together above a bar counter", P_SENSORY))

register(32, "'10 for $10': The Multiple-Unit Price Trick", [
    "You don't need ten. In most cases you can buy one at exactly the same unit price.",
    "The offer is real. The quantity in it usually isn't a requirement.",
    "Framing a price as a multiple does two things at once.",
    "It anchors a quantity you weren't considering, and it makes the unit price feel like a discount even when nothing changed.",
    "Ten for ten dollars is a dollar each. So is one for a dollar. Only one of those phrasings puts ten in your basket.",
    "This is why the sign is written in the multiple rather than the unit price, which would be simpler and clearer.",
    "The fine print usually confirms it. Look for a line noting that the price applies to single units too.",
    "When a multiple genuinely is required, the sign has to say so explicitly, and it will.",
    "Read the small line. Then buy the number you actually wanted.",
], [
    img("Shelf-sign diagram showing a large multiple-unit offer with a small footnote line beneath",
        "push_in", P_PRICING),
    img("Diagram of an offer block with the quantity requirement marked as optional", "static_drift",
        P_PRICING),
    img("Diagram of one framing block splitting into two separate effect arrows", "pan_left_right",
        P_PRICING),
    img("Diagram of a quantity anchor and a perceived-discount indicator side by side", "push_in",
        P_PRICING),
    img("Comparison of two mathematically identical unit prices with different basket outcomes",
        "hard_zoom_then_push_in", P_PRICING),
    img("Two sign layouts side by side, one written as a multiple and one as a simple unit price",
        "pull_out", P_PRICING),
    img("Close-up of a shelf tag with a small clarifying footnote line highlighted", "push_in",
        P_PRICING),
    img("Comparison of an optional-multiple sign against a genuinely required-multiple sign",
        "pan_left_right", P_PRICING),
    img("Wide shelf diagram with a basket holding a chosen quantity rather than the posted one",
        "pull_out", P_PRICING),
], thumb("A large multiple-unit price sign towering over a tiny footnote noting the single-unit price",
         P_PRICING))

register(33, "Airport Design: The Long Walk Past Every Single Shop", [
    "Security to gate used to be a short walk. Now it's a serpentine through a shopping centre.",
    "Airports make a large and growing share of their money from retail and concessions rather than from airlines.",
    "That changed what the terminal is for. It's no longer a corridor. It's a catchment.",
    "The design term is the golden hour: the stretch after security when passengers have cleared the stressful part and have time to spend.",
    "So the route out of security doesn't run straight to the gates.",
    "It winds through duty-free, often with no bypass lane, so the shop floor is the corridor.",
    "Departure boards get placed inside retail areas rather than outside them, giving you a reason to stand among the products.",
    "And gate numbers are frequently withheld until close to boarding, keeping you in the central zone instead of at your gate.",
    "You think you're waiting for a plane. Architecturally, you're shopping with a deadline.",
], [
    img("Overhead terminal plan with a passenger route winding through a retail zone between "
        "security and gates", "push_in", P_AIRPORT),
    img("Revenue-composition diagram with a retail segment sized against an aeronautical segment",
        "static_drift", P_AIRPORT),
    img("Comparison of a simple corridor plan against a retail-catchment terminal plan",
        "pan_left_right", P_AIRPORT),
    img("Timeline diagram with a marked window after a security checkpoint icon", "push_in",
        P_AIRPORT),
    img("Overhead plan with the post-security exit opening directly into a retail floor",
        "hard_zoom_then_push_in", P_AIRPORT),
    img("Overhead plan of a serpentine path through display blocks with no bypass route", "pull_out",
        P_AIRPORT),
    img("Terminal plan with departure-board icons positioned inside the retail zone", "push_in",
        P_AIRPORT),
    img("Terminal plan with gate markers dimmed and a central holding zone highlighted",
        "pan_left_right", P_AIRPORT),
    img("Wide terminal plan with the full route from security to gate lit through retail", "pull_out",
        P_AIRPORT),
], thumb("An airport blueprint where the security-to-gate path coils through a glowing duty-free zone",
         P_AIRPORT))

register(34, "The Elevator Mirror: Making the Wait Feel Shorter Without Making It Shorter", [
    "Complaints about slow elevators can vanish when a building adds mirrors. The elevators never get faster.",
    "This is the founding example of what's called perception management in queueing.",
    "The insight is that people don't experience waiting time objectively. They experience it as occupied or unoccupied.",
    "Unoccupied time crawls. Occupied time, even trivially occupied, passes far more easily.",
    "A mirror gives you something to do that requires no equipment and no explanation: look at yourself, and discreetly at everyone else.",
    "The same principle runs at airports. One famous fix moved arrival gates further from baggage claim.",
    "Passengers then spent most of the wait walking instead of standing at the belt, and complaints dropped even though total time rose.",
    "You'll see it in queue entertainment, in progress bars, and in the estimated-wait message on a support line.",
    "Nobody made anything faster. They made the emptiness go away.",
], [
    img("Elevator-lobby diagram with mirrored wall panels and a complaint-level indicator dropping",
        "push_in", P_PERCEPTION),
    img("Diagram of two clocks labeled as actual and perceived duration reading differently",
        "static_drift", P_PERCEPTION),
    img("Comparison bar diagram of occupied versus unoccupied time at identical durations",
        "pan_left_right", P_PERCEPTION),
    img("Diagram of a duration bar with an activity marker shortening its perceived length",
        "push_in", P_PERCEPTION),
    img("Lobby cross-section with mirror panels and sightline rays between waiting positions",
        "hard_zoom_then_push_in", P_PERCEPTION),
    img("Airport plan comparison with two arrival-gate positions at different distances from a "
        "baggage belt", "pull_out", P_PERCEPTION),
    img("Diagram of a total-duration bar split into a long walking segment and a short standing "
        "segment", "push_in", P_PERCEPTION),
    img("Row of waiting-context icons: a queue screen, a progress indicator, a phone hold symbol",
        "pan_left_right", P_PERCEPTION),
    img("Wide diagram of a fixed duration bar with the empty portion progressively filled in",
        "pull_out", P_PERCEPTION),
], thumb("Two clocks above an elevator lobby, real time unchanged while felt time shrinks in the mirror",
         P_PERCEPTION))

register(35, "Placebo Buttons: The Crosswalk Button That Isn't Connected", [
    "In many cities, the crosswalk button does nothing at all. It was disconnected years ago and left in place.",
    "When traffic signals moved to fixed computerized timing, pedestrian buttons stopped affecting the cycle.",
    "Removing them would have cost money and confused people. So thousands stayed, wired to nothing.",
    "Which raises the obvious question: why keep a control that controls nothing?",
    "Because pressing it changes the person, not the signal.",
    "The illusion of control measurably reduces frustration during a wait and makes the wait feel shorter.",
    "A pedestrian who pressed a button waits more patiently than one who simply stood there.",
    "It isn't the only one. Many office thermostats are disconnected placebos, and door-close buttons in many elevators do nothing during normal operation.",
    "You're not being ignored. You're being given something to do with your hands.",
], [
    img("Street-corner diagram of a pedestrian signal post with a button unit mounted on it",
        "push_in", P_URBAN),
    img("Technical diagram of a fixed-cycle signal timer with no pedestrian input branch",
        "static_drift", P_URBAN),
    img("Cutaway diagram of a button housing with a severed wire inside", "pan_left_right", P_URBAN),
    img("Diagram of a control icon with a question-mark link to an unchanged output", "push_in",
        P_URBAN),
    img("Diagram of a pressing hand icon linked to a mood indicator rather than to a signal output",
        "hard_zoom_then_push_in", P_URBAN),
    img("Comparison bars of frustration level with and without an available control", "pull_out",
        P_URBAN),
    img("Comparison of two waiting figures at a corner, one with a button and one without",
        "push_in", P_URBAN),
    img("Row of disconnected-control icons: a wall thermostat dial and an elevator button panel",
        "pan_left_right", P_URBAN),
    img("Wide street-corner diagram with the button lit and the signal cycle running independently",
        "pull_out", P_URBAN),
], thumb("A crosswalk button cut open to reveal a wire connected to nothing", P_URBAN))

register(36, "Hostile Architecture: The Bench You Can't Lie Down On", [
    "The armrest in the middle of that bench isn't for arms.",
    "It's there to make lying down impossible, and it's part of a design category called hostile or defensive architecture.",
    "Once you know the vocabulary, it's everywhere.",
    "Studs and spikes on flat ledges. Slanted or individually divided seating. Sprinklers timed for overnight hours in sheltered doorways.",
    "Each is described publicly as deterring skateboarding, loitering, or damage.",
    "In practice, much of it targets people sleeping rough, by removing the last usable flat surfaces in a city.",
    "It's worth being precise about the trade-off, because it's a real one. Cities do have genuine maintenance and safety concerns.",
    "But a design that solves those by making public space unusable to the most vulnerable people in it has chosen a side.",
    "A city's furniture tells you who it expects to be there, and who it would rather move along.",
], [
    img("Public-bench cross-section diagram with a centre divider marked and a lying-down outline "
        "crossed out", "push_in", P_URBAN),
    img("Design-catalogue style layout of defensive street-furniture elements", "static_drift",
        P_URBAN),
    img("Streetscape diagram with several defensive elements annotated at their positions",
        "pan_left_right", P_URBAN),
    img("Detail diagram row of studded ledge, slanted seat, and divided bench profiles", "push_in",
        P_URBAN),
    img("Diagram of a design element with a stated-purpose label attached to it",
        "hard_zoom_then_push_in", P_URBAN),
    img("Streetscape diagram with flat usable surfaces progressively removed across three panels",
        "pull_out", P_URBAN),
    img("Balance-scale diagram weighing a maintenance icon against a shelter icon", "push_in",
        P_URBAN),
    img("Streetscape diagram with an accessibility-focused bench design shown as an alternative",
        "pan_left_right", P_URBAN),
    img("Wide streetscape diagram with furniture elements annotated by who can and cannot use them",
        "pull_out", P_URBAN),
], thumb("A public bench cross-section with a centre armrest dividing it, drawn as a design "
         "specification", P_URBAN))

register(37, "Norman Doors: When the Design Is the Trick Played on You", [
    "If you've ever pushed a door that pulls, the door was wrong. Not you.",
    "They're called Norman doors, after Don Norman, the designer who wrote about them.",
    "The concept underneath is affordance: the way an object's shape suggests how to use it.",
    "A vertical handle affords grabbing and pulling. A flat plate affords pushing. Your hands read them before your brain does.",
    "A Norman door is one where the affordance contradicts the actual mechanism.",
    "Handle on a push door. Identical hardware on both sides of a one-way door. No visible hinge to give the answer away.",
    "The tell that it's a design failure and not a user failure is the sign.",
    "When a door needs a sign that says PUSH, the door has already failed. The sign is a patch over a bad specification.",
    "Good design doesn't need instructions. It needs a shape that can only be used one way.",
], [
    img("Door-elevation diagram with a vertical pull handle mounted on a door marked as opening "
        "outward", "push_in", P_PERCEPTION),
    img("Design-reference book icon beside a door diagram, muted archival tones", "static_drift",
        P_PERCEPTION),
    img("Diagram of an object shape linked by an arrow to a suggested hand action", "pan_left_right",
        P_PERCEPTION),
    img("Comparison diagram of a pull handle and a flat push plate with matching action arrows",
        "push_in", P_PERCEPTION),
    img("Diagram of a hardware element and a mechanism arrow pointing in opposite directions",
        "hard_zoom_then_push_in", P_PERCEPTION),
    img("Row of ambiguous door-hardware configurations with no directional cue", "pull_out",
        P_PERCEPTION),
    img("Door diagram with an added instructional sign panel marked as a corrective patch",
        "push_in", P_PERCEPTION),
    img("Comparison of a door needing a sign against a door whose hardware is unambiguous",
        "pan_left_right", P_PERCEPTION),
    img("Wide door-elevation diagram with hardware that affords only one action", "pull_out",
        P_PERCEPTION),
], thumb("A vertical pull handle mounted on a door that only opens by pushing, drawn as a design "
         "diagram", P_PERCEPTION))

register(38, "Gas Station Layout: The Pump-to-Snack Pipeline", [
    "Fuel barely makes a filling station any money. The business is the walk you take while the tank fills.",
    "Margins on fuel are famously thin, and much of what a station charges goes straight back out in wholesale cost and tax.",
    "Margins on a cold drink, a coffee, or a snack are a different category entirely.",
    "So the site is designed around converting a fuel stop into a store visit.",
    "The building is positioned so the entrance faces the pumps. The windows are large and unobstructed.",
    "From every pump, you can see directly into the coolers, and the coolers are stocked at eye level with the highest-margin drinks.",
    "The payment terminal at the pump often prompts you to come inside for a receipt or an offer.",
    "And the restroom, which is a genuine reason many people stop, is placed at the back past the entire store.",
    "You came for fuel. The fuel was the loss leader that brought you within sight of the actual product.",
], [
    img("Overhead station site plan with pump islands and a store building positioned facing them",
        "push_in", P_RETAIL),
    img("Margin-comparison bar diagram of a fuel segment against a convenience segment",
        "static_drift", P_RETAIL),
    img("Bar diagram with a tall margin column beside a very short one", "pan_left_right", P_RETAIL),
    img("Site plan with conversion arrows drawn from pump positions to the store entrance",
        "push_in", P_RETAIL),
    img("Site plan with sightlines from each pump passing through large windows into the store",
        "hard_zoom_then_push_in", P_RETAIL),
    img("Cooler-wall cross-section with the eye-level band highlighted", "pull_out", P_RETAIL),
    img("Pump-terminal screen diagram with an in-store prompt element highlighted", "push_in",
        P_RETAIL),
    img("Store floor plan with a restroom placed at the rear beyond the full product floor",
        "pan_left_right", P_RETAIL),
    img("Wide site plan with the complete pump-to-store-to-restroom route lit", "pull_out", P_RETAIL),
], thumb("Sightlines from every fuel pump converging through a window onto a glowing cooler wall",
         P_RETAIL))

register(39, "The $1.50 Hot Dog: The Loss That Buys Your Loyalty", [
    "That warehouse hot dog combo has cost a dollar fifty since the mid-1980s. It loses money on purpose.",
    "A loss leader is a product sold at or below cost to bring people in and shape how they see everything else.",
    "Most loss leaders rotate weekly. This one is permanent, and that's what makes it unusual.",
    "A fixed price held for decades becomes a reference point customers actually track.",
    "It functions as a public promise: if they haven't raised this, they probably aren't quietly raising everything else either.",
    "That's a halo effect. One famous price sets the perceived price level of an entire warehouse of items nobody is checking.",
    "The company has been open about protecting it. Its co-founder is widely quoted telling a successor, in blunt terms, never to raise the price.",
    "They kept it, and reportedly re-engineered production and supply to absorb the cost instead.",
    "It isn't generosity. It's the cheapest possible advertisement for being cheap.",
], [
    img("Food-court signage diagram with a fixed price displayed prominently", "push_in", P_PRICING),
    img("Diagram of a product priced below a cost line with an inbound traffic arrow", "static_drift",
        P_PRICING),
    img("Comparison of rotating weekly offer tags against one unchanging fixed price tag",
        "pan_left_right", P_PRICING),
    img("Timeline diagram of a price value holding flat across decades", "push_in", P_PRICING),
    img("Diagram of a single fixed price radiating a halo across a warehouse floor plan",
        "hard_zoom_then_push_in", P_PRICING),
    img("Store plan with a perceived-value indicator applied across many unchecked item icons",
        "pull_out", P_PRICING),
    img("Diagram of a quotation-mark icon beside a protected price marker, muted formal tones",
        "push_in", P_PRICING),
    img("Supply-chain diagram with production and sourcing blocks feeding a fixed-price endpoint",
        "pan_left_right", P_PRICING),
    img("Wide diagram of a single small price sign glowing across a large warehouse plan", "pull_out",
        P_PRICING),
], thumb("A tiny fixed food-court price sign glowing like a beacon over an entire warehouse store plan",
         P_PRICING))

register(40, "Milk, Eggs, and the Loss-Leader Front Page", [
    "The deals on the front of the weekly flyer often sell below cost. They're the bait, not the business.",
    "Retailers separate products into two categories that behave very differently.",
    "Known-value items are the ones customers can actually price-check from memory: milk, eggs, bananas, soda.",
    "Everything else, most of the store, is priced without anyone comparing.",
    "So the known-value items go on the front page at a loss, because those are the prices that form your opinion of the whole store.",
    "Then the full-margin items sit along the route you walk to reach them.",
    "The math only needs the average basket to work, not any individual product.",
    "Retailers do watch for cherry pickers, shoppers who buy only the loss leaders and leave.",
    "Which is exactly what the flyer is inviting you to do, if you're willing to shop the front page and nothing else.",
], [
    img("Weekly-flyer front-page layout diagram with several featured deal blocks", "push_in",
        P_PRICING),
    img("Diagram of two product categories separated into distinct labeled groups", "static_drift",
        P_PRICING),
    img("Row of common staple icons with price-memory indicators above them", "pan_left_right",
        P_PRICING),
    img("Store plan with most product blocks marked as uncompared", "push_in", P_PRICING),
    img("Diagram of a below-cost front-page item feeding a store-wide price-perception indicator",
        "hard_zoom_then_push_in", P_PRICING),
    img("Store plan with full-margin blocks lining the route toward the featured items", "pull_out",
        P_PRICING),
    img("Basket diagram with mixed-margin items averaging to a positive total", "push_in", P_PRICING),
    img("Basket diagram containing only featured deal items with a negative margin indicator",
        "pan_left_right", P_PRICING),
    img("Wide flyer layout with the featured page and a matching short store route highlighted",
        "pull_out", P_PRICING),
], thumb("A weekly flyer's front-page deals circled in red beside a full-margin cart behind them",
         P_PRICING))

register(41, "Jewelry Store Lighting: Diamonds Under Engineered Fire", [
    "That stone blazed under the counter lights and looks quieter at home. The lighting was part of the performance.",
    "A diamond's sparkle depends almost entirely on the light hitting it.",
    "Small, intense, point-source light produces sharp flashes as the stone moves. Diffuse light produces almost none.",
    "So display cases use tightly focused spotlights aimed at close range, often many per case.",
    "Stores also select bulbs for high color rendering, so every colour in the flash reads vividly rather than muddy.",
    "Some mix two temperatures deliberately: cooler light to make the stone read bright and white, warmer light so skin looks healthy beside it.",
    "None of this changes the stone. It's the same carat, cut, and clarity in any room.",
    "But home lighting is usually a single diffuse ceiling fixture, which is close to the worst possible case for sparkle.",
    "You didn't buy a worse diamond. You bought a lighting rig you didn't take home.",
], [
    img("Jewelry display-case cross-section with multiple focused spotlight fixtures aimed inward",
        "push_in", P_PERCEPTION),
    img("Optical diagram of light rays entering and refracting out of a faceted stone shape",
        "static_drift", P_PERCEPTION),
    img("Comparison of a point-source lighting diagram against a diffuse-source diagram",
        "pan_left_right", P_PERCEPTION),
    img("Case cross-section with several narrow beam cones converging on a single display position",
        "push_in", P_PERCEPTION),
    img("Color-rendering comparison chart of a vivid spectrum against a muted one",
        "hard_zoom_then_push_in", P_PERCEPTION),
    img("Case diagram with two labeled light temperatures aimed at a stone and at a skin-tone swatch",
        "pull_out", P_PERCEPTION),
    img("Specification card diagram listing unchanged stone properties", "push_in", P_PERCEPTION),
    img("Home-room diagram with a single diffuse ceiling fixture and minimal specular highlights",
        "pan_left_right", P_PERCEPTION),
    img("Wide split diagram of the same stone under a spotlight array and under a single ceiling "
        "fixture", "pull_out", P_PERCEPTION),
], thumb("The same faceted stone shown split-screen, blazing under a spotlight array and quiet under a "
         "single ceiling bulb", P_PERCEPTION))

register(42, "Window Seats and Waiting Lists: Restaurant Scarcity Theater", [
    "The couple seated in the window and the twenty-minute wait for a half-empty room are both staging.",
    "Restaurants seat from the front and the windows outward, and it isn't about the view.",
    "A visible diner is an advertisement. An empty window is a warning.",
    "Social proof is the tendency to treat other people's choices as information about quality.",
    "A busy-looking restaurant reads as good, and a dead one reads as risky, regardless of the food.",
    "The waiting list does the same job from the other direction.",
    "A short wait implies demand, and demand implies the wait is worth it. Both feelings arrive before you've eaten anything.",
    "This is why you can be told twenty minutes and then walk past open tables to your seat.",
    "The tables were available. The impression wasn't finished yet.",
], [
    img("Restaurant floor plan with window-adjacent tables marked as filled first", "push_in",
        P_RESTAURANT),
    img("Floor plan with seating-sequence numbers running from the front outward", "static_drift",
        P_RESTAURANT),
    img("Street-view diagram of a window frontage with occupancy indicators", "pan_left_right",
        P_RESTAURANT),
    img("Diagram of observed-choice icons feeding into a quality-judgment indicator", "push_in",
        P_RESTAURANT),
    img("Comparison of a full-looking frontage and an empty one with opposite quality indicators",
        "hard_zoom_then_push_in", P_RESTAURANT),
    img("Entrance diagram with a waiting-list stand and a queue marker outside", "pull_out",
        P_RESTAURANT),
    img("Diagram linking a wait-duration marker to a demand indicator to a value impression",
        "push_in", P_RESTAURANT),
    img("Floor plan with occupied front tables and visibly empty rear tables", "pan_left_right",
        P_RESTAURANT),
    img("Wide floor plan annotated with a seating strategy rather than a capacity constraint",
        "pull_out", P_RESTAURANT),
], thumb("A restaurant floor plan with the window tables filled and the room behind them sitting empty",
         P_RESTAURANT))

register(43, "Mall Escalator Placement: The Extra Lap You Always Walk", [
    "The up escalator and the down escalator are never next to each other. Count the storefronts between them.",
    "In a well-designed transport building, vertical circulation is stacked so you can change floors immediately.",
    "In a mall, it's deliberately offset, so arriving on a floor means walking its length to leave it.",
    "That walk is the entire reason the escalators are placed that way.",
    "Every level change becomes a guaranteed pass along a full run of storefronts.",
    "Retail planners talk about this in terms of dwell time and frontage exposure, both of which the offset increases at no construction cost.",
    "Watch for the same logic in department stores, where the escalator often lands you facing a department rather than another escalator.",
    "Compare it to an airport or a train station, where the priority is genuinely moving people, and the escalators sit back to back.",
    "The building isn't badly organized. It's organized around a different goal than the one you have.",
], [
    img("Mall cross-section with up and down escalators offset at opposite ends of each level",
        "push_in", P_MALL),
    img("Transit-building cross-section with vertical circulation stacked directly together",
        "static_drift", P_MALL),
    img("Mall floor plan with a zigzag path between offset escalator positions", "pan_left_right",
        P_MALL),
    img("Floor plan with the connecting walk highlighted as the designed outcome", "push_in", P_MALL),
    img("Floor plan with storefront frontage markers counted along the connecting walk",
        "hard_zoom_then_push_in", P_MALL),
    img("Diagram of dwell-time and frontage-exposure indicators rising with path length", "pull_out",
        P_MALL),
    img("Department-store plan with an escalator landing oriented toward a merchandise zone",
        "push_in", P_MALL),
    img("Side-by-side cross-sections of a mall and a transit hall with opposite escalator placement",
        "pan_left_right", P_MALL),
    img("Wide mall cross-section with the full multi-level zigzag route lit", "pull_out", P_MALL),
], thumb("A mall cross-section with escalators at opposite ends of each floor and a zigzag path "
         "between them", P_MALL))

register(44, "Hotel Lobby Grandeur, Hallway Gloom", [
    "The lobby is a cathedral. Your corridor is a dim tube. The contrast is deliberate.",
    "Hotels concentrate architectural spending in the spaces where impressions get formed, not where guests spend the most hours.",
    "The lobby is double height, naturally lit, expensively finished, and unusually quiet for its size.",
    "The corridor upstairs is low, artificially lit, narrow, and finished to a completely different standard.",
    "The reason is anchoring, plus the way memory encodes an experience.",
    "The first ninety seconds set an expectation that colours everything afterward.",
    "Once the lobby has established a category, the room mostly needs to avoid contradicting it.",
    "There's a practical layer too. Corridors are pure circulation, so a dimmer, tighter corridor makes the room feel brighter and larger by comparison when the door opens.",
    "You're not walking from a beautiful space into a disappointing one. You're being set up for the reveal.",
], [
    img("Hotel cross-section with a double-height lobby volume above compressed corridor levels",
        "push_in", P_PERCEPTION),
    img("Diagram of spending allocation weighted toward arrival spaces", "static_drift", P_PERCEPTION),
    img("Lobby interior diagram with high ceilings, daylight, and generous proportions",
        "pan_left_right", P_PERCEPTION),
    img("Corridor cross-section with low ceiling height and narrow proportions", "push_in",
        P_PERCEPTION),
    img("Diagram of a first-impression marker anchoring a later evaluation curve",
        "hard_zoom_then_push_in", P_PERCEPTION),
    img("Timeline diagram with an early impression window marked prominently", "pull_out",
        P_PERCEPTION),
    img("Diagram of an established expectation band with a later experience sitting inside it",
        "push_in", P_PERCEPTION),
    img("Sequence diagram of a dim narrow corridor opening into a brighter wider room",
        "pan_left_right", P_PERCEPTION),
    img("Wide hotel cross-section with lobby, corridor, and room annotated as a designed sequence",
        "pull_out", P_PERCEPTION),
], thumb("A hotel cross-section with a radiant double-height lobby stacked above rows of dim narrow "
         "corridors", P_PERCEPTION))

register(45, "Supermarket Seasonal Aisles: Urgency on a Calendar", [
    "The holiday aisle shows up earlier every year. The deadline it advertises is the entire sales pitch.",
    "A regular aisle has no urgency. The cereal will be there next week, and the week after.",
    "A seasonal aisle has a hard expiry, and everyone knows it.",
    "That expiry does something no discount can: it converts browsing into a decision with a date attached.",
    "Retailers also get a long tail by starting early, capturing planners months out and procrastinators at the end.",
    "The early start has a practical driver too. Shelf space is allocated seasonally, and being first means owning the category before competitors set up.",
    "Then comes the cliff. The day after the holiday, the same merchandise is often marked down steeply.",
    "That markdown is priced into the plan from the beginning; the early full-price weeks are what pay for it.",
    "You're not buying early. You're buying inside a countdown someone else started.",
], [
    img("Store plan with a seasonal aisle block marked distinctly from permanent aisles", "push_in",
        P_SUPERMARKET),
    img("Diagram of a permanent aisle with a continuous availability line and no end marker",
        "static_drift", P_SUPERMARKET),
    img("Diagram of a seasonal aisle with a hard expiry marker on its availability line",
        "pan_left_right", P_SUPERMARKET),
    img("Diagram of a browsing indicator converting into a decision marker under a countdown",
        "push_in", P_SUPERMARKET),
    img("Timeline diagram with purchase markers clustered at both the early and late ends",
        "hard_zoom_then_push_in", P_SUPERMARKET),
    img("Shelf-allocation diagram with a seasonal block claimed ahead of competing blocks",
        "pull_out", P_SUPERMARKET),
    img("Price-timeline diagram with a steep drop marked immediately after a date", "push_in",
        P_SUPERMARKET),
    img("Revenue diagram with early full-price segments offsetting a later markdown segment",
        "pan_left_right", P_SUPERMARKET),
    img("Wide calendar diagram with a seasonal window bracketed and a countdown marker inside it",
        "pull_out", P_SUPERMARKET),
], thumb("A holiday aisle blooming in a store plan while the calendar behind it still reads months "
         "early", P_SUPERMARKET))

register(46, "Bank Branch Design: Marble, Columns, and the Feeling of Safety", [
    "Banks were built like temples for a reason, and it wasn't taste.",
    "Before deposit insurance existed, a bank failing meant depositors simply lost their money.",
    "So the single most valuable thing a bank could project was permanence.",
    "Stone, columns, high ceilings, and a visible vault door all said the same thing: this institution is not going anywhere.",
    "The architecture was doing the job that regulation and insurance do now.",
    "It's a rare case where you can date a building's psychology to a specific gap in the financial system.",
    "Once deposits were insured, the message stopped needing to be carved in stone, and branch design changed completely.",
    "Modern branches use glass, open floors, low counters, seating, sometimes coffee, because the job shifted from proving solvency to feeling approachable.",
    "Same industry, opposite architecture, because the thing customers needed reassurance about changed.",
], [
    img("Classical bank facade elevation with columns and a heavy stone entrance", "push_in",
        P_PERCEPTION),
    img("Historical diagram of a deposit icon with no protective layer around it", "static_drift",
        P_PERCEPTION),
    img("Diagram of a permanence indicator linked to heavy masonry construction elements",
        "pan_left_right", P_PERCEPTION),
    img("Interior elevation with a prominent vault door and high ceiling volume", "push_in",
        P_PERCEPTION),
    img("Diagram of architecture and regulation shown as substitutes on a balance scale",
        "hard_zoom_then_push_in", P_PERCEPTION),
    img("Timeline diagram linking a policy change marker to a shift in building style", "pull_out",
        P_PERCEPTION),
    img("Diagram of a deposit icon gaining a protective layer, with the stone facade fading",
        "push_in", P_PERCEPTION),
    img("Modern branch interior elevation with glass frontage, open floor, and low counters",
        "pan_left_right", P_PERCEPTION),
    img("Wide side-by-side elevation of a classical facade and a modern glass branch", "pull_out",
        P_PERCEPTION),
], thumb("A bank facade built like a stone temple beside a modern all-glass branch, drawn as elevations",
         P_PERCEPTION))

register(47, "Grocery Basket Shortage: Why Hand Baskets Keep Disappearing", [
    "Looking for a basket and only finding carts isn't an accident of stocking.",
    "Container size shapes purchase size, and retailers have known it for a long time.",
    "A basket has a hard physical limit, and it gets heavy, which creates a natural stopping point.",
    "A cart has neither. It rolls, so weight stops being feedback, and its capacity far exceeds a typical trip.",
    "Give a shopper a cart for a small trip and the container itself suggests the trip should be bigger.",
    "So basket stacks tend to be small, placed just inside the door, and not replenished during the day.",
    "Cart corrals sit outside, are far larger, and get actively collected and returned all day long.",
    "Neither is a rule anyone posts. It's just what gets maintained and what doesn't.",
    "Take the basket if you can find one. The limit is the point.",
], [
    img("Store-entrance plan with a small basket stack inside and a large cart corral outside",
        "push_in", P_SUPERMARKET),
    img("Comparison diagram of container capacity against typical purchase quantity", "static_drift",
        P_SUPERMARKET),
    img("Diagram of a basket with a weight indicator rising as items accumulate", "pan_left_right",
        P_SUPERMARKET),
    img("Diagram of a wheeled cart with the weight-feedback indicator crossed out", "push_in",
        P_SUPERMARKET),
    img("Diagram of a large container outline with a small item group and a suggestion arrow",
        "hard_zoom_then_push_in", P_SUPERMARKET),
    img("Entrance plan with a small depleted basket stack marked", "pull_out", P_SUPERMARKET),
    img("Exterior plan with a large cart corral and active return-route arrows", "push_in",
        P_SUPERMARKET),
    img("Comparison of maintenance-frequency indicators for two container types", "pan_left_right",
        P_SUPERMARKET),
    img("Wide entrance plan with both container options drawn to scale side by side", "pull_out",
        P_SUPERMARKET),
], thumb("An empty basket rack beside a full corral of oversized carts at a store entrance",
         P_SUPERMARKET))

register(48, "The Drive-Thru Menu Board: Ordered Before You Order", [
    "By the time you reach the speaker, the board has already made most of the decision for you.",
    "A drive-thru board gets a few seconds of attention, from a driver, often at night, sometimes in rain.",
    "That constraint shapes everything about it.",
    "Combos get photographs and the largest blocks. Individual items get small text at the edges.",
    "Under time pressure, people don't optimize. They take the option that's easiest to process.",
    "A numbered combo is one word to say. Assembling the same food item by item is three or four decisions and a longer sentence.",
    "The board is engineered so the low-effort choice and the high-margin choice are the same choice.",
    "Then the speaker adds a scripted upsell, timed for the moment after you've committed, when changing your mind costs more than saying yes.",
    "You didn't choose the combo. You chose the path of least resistance, and someone laid that path out in advance.",
], [
    img("Drive-thru menu board layout diagram with large combo blocks and small edge text areas",
        "push_in", P_RESTAURANT),
    img("Diagram of a short attention-duration marker beside a board layout", "static_drift",
        P_RESTAURANT),
    img("Diagram of viewing conditions annotated around a board: distance, low light, motion",
        "pan_left_right", P_RESTAURANT),
    img("Board layout with a visual hierarchy diagram showing block sizes ranked", "push_in",
        P_RESTAURANT),
    img("Diagram of a decision path choosing the lowest-effort branch under a time constraint",
        "hard_zoom_then_push_in", P_RESTAURANT),
    img("Comparison of a single-token order against a multi-step assembled order", "pull_out",
        P_RESTAURANT),
    img("Diagram with an ease axis and a margin axis converging on the same option", "push_in",
        P_RESTAURANT),
    img("Sequence diagram of an order confirmation followed by a scripted prompt block",
        "pan_left_right", P_RESTAURANT),
    img("Wide board layout annotated as a decision funnel rather than a list", "pull_out",
        P_RESTAURANT),
], thumb("A drive-thru menu board where combo blocks are billboards and single items are fine print",
         P_RESTAURANT))

register(49, "Self-Checkout: The Labor You Do for Free and Feel Good About", [
    "You scan, you bag, you pay, and somehow it registers as a convenience.",
    "Self-checkout transfers a task the retailer used to pay someone to do onto the customer, for free.",
    "That's the actual economics, and it's not hidden. It's just not how it feels.",
    "Two things make it feel like a benefit instead of a cost.",
    "The first is control. Doing it yourself feels faster even when it isn't, because you're never waiting on someone else's pace.",
    "The second is the queue design. Self-checkout usually uses one line feeding many kiosks.",
    "A single snaking line moves visibly and constantly, so it feels faster than picking one of several lanes and watching another move quicker.",
    "That's a real improvement in fairness and in perceived wait, layered on top of the labor transfer.",
    "The queue psychology is genuinely good design. It's just also what makes the unpaid work go down easily.",
], [
    img("Checkout-area plan comparing a staffed lane block against a self-service kiosk cluster",
        "push_in", P_RETAIL),
    img("Diagram of a task block moving from a staff icon to a customer icon", "static_drift",
        P_RETAIL),
    img("Diagram of a labor-cost arrow shifting between two parties", "pan_left_right", P_RETAIL),
    img("Diagram of two contributing factor blocks feeding a perception indicator", "push_in",
        P_RETAIL),
    img("Diagram of a control indicator raised beside an unchanged duration bar",
        "hard_zoom_then_push_in", P_RETAIL),
    img("Queue diagram of one line feeding several kiosks", "pull_out", P_RETAIL),
    img("Comparison of a single serpentine queue against several parallel lane queues", "push_in",
        P_RETAIL),
    img("Diagram of fairness and perceived-wait indicators both improving with a single queue",
        "pan_left_right", P_RETAIL),
    img("Wide checkout plan annotated with both the labor shift and the queue improvement",
        "pull_out", P_RETAIL),
], thumb("A self-checkout kiosk with an invisible employee lanyard hanging over the scanner",
         P_RETAIL))

register(50, "Casino Comps: The Free Drink That Isn't Free", [
    "The complimentary drink isn't hospitality. It's one of the most precisely calculated costs on the floor.",
    "Comps are free goods given to players, and every one of them is priced against expected loss.",
    "Modern casinos track play through loyalty cards: what you bet, how long, at what stakes.",
    "From that, they calculate a theoretical loss: what the house mathematically expects to win from you over time.",
    "Comps are then issued as a fraction of that number. The drink, the buffet, the room, the suite.",
    "It's a rebate on money the odds say you'll lose, dressed as generosity.",
    "The drink does a second job too. Alcohol reduces risk assessment, which is not a neutral thing to hand a gambler.",
    "And reciprocity applies here exactly as it does at a supermarket sample table.",
    "You didn't get something for nothing. You got a discount on a loss, calculated before you sat down.",
], [
    img("Casino floor diagram with a complimentary drink icon and a small cost tag attached",
        "push_in", P_CASINO),
    img("Diagram of a comp item linked by an arrow to an expected-loss value block", "static_drift",
        P_CASINO),
    img("Diagram of a loyalty card feeding play-data blocks into a tracking system", "pan_left_right",
        P_CASINO),
    img("Diagram of wager, duration, and stake inputs producing a calculated value output",
        "push_in", P_CASINO),
    img("Diagram of a calculated value with a fraction of it split off toward comp icons",
        "hard_zoom_then_push_in", P_CASINO),
    img("Tiered diagram of comp items scaled against increasing expected-loss values", "pull_out",
        P_CASINO),
    img("Diagram of a risk-assessment indicator lowering beside a drink icon", "push_in", P_CASINO),
    img("Diagram of a reciprocity loop between a gift icon and a continued-play arrow",
        "pan_left_right", P_CASINO),
    img("Wide casino floor diagram with a comp item and its precomputed cost annotation", "pull_out",
        P_CASINO),
], thumb("A complimentary casino drink casting a shadow shaped like a calculated cost figure",
         P_CASINO))
