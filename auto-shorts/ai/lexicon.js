'use strict';
/**
 * Word lists behind the local analysis.
 *
 * Kept in one place so the emphasis and B-roll heuristics can be tuned without
 * touching the logic that uses them.
 */

/** Never emphasised, never a B-roll keyword. */
const STOPWORDS = new Set(`
a an the and or but so if then than that this these those there here
i me my we us our you your he him his she her it its they them their
is are was were be been being am do does did doing done
have has had having will would shall should can could may might must
of in on at to from by for with about into over under again further
as at because before after above below up down out off once
no nor not only own same too very just also even still yet
what which who whom whose when where why how all any both each few more most
other some such
'll 're 've 'd 'm 's n't
`.trim().split(/\s+/));

/** Words that almost always carry the point of a sentence. */
const POWER_WORDS = new Set(`
never always nobody everyone everybody nothing everything anyone
free instantly secret hidden proven guaranteed illegal dangerous
scam fraud fake stolen banned broke bankrupt worthless useless
best worst biggest smallest fastest slowest cheapest richest poorest
first last only single every huge massive tiny giant insane crazy
wrong right true false real truth lie lies mistake mistakes
stop start avoid ignore forget remember warning caution
double triple half zero million billion trillion thousand hundred
secretly actually literally exactly seriously honestly
`.trim().split(/\s+/));

/** Contrast and reversal markers — the pivot of a hook usually follows one. */
const PIVOT_WORDS = new Set(`
but however although though instead actually except unless
until suddenly turns nobody until yet meanwhile whereas
`.trim().split(/\s+/));

/** Words introducing the payoff of an explanation. */
const CAUSAL_WORDS = new Set(`
because since therefore so means meaning result results causes caused
which why reason
`.trim().split(/\s+/));

/**
 * Concrete nouns worth cutting to a visual. Grouped so a match can also supply
 * sibling search terms for the B-roll suggestion list.
 */
const VISUAL_CONCEPTS = {
  money: ['cash', 'money', 'dollar', 'dollars', 'coin', 'coins', 'wallet', 'bank', 'banking', 'salary', 'income', 'payment', 'invoice', 'debt', 'loan', 'mortgage', 'savings', 'budget', 'price', 'cost', 'profit', 'revenue', 'wealth', 'rich', 'investment', 'stocks', 'crypto', 'bitcoin'],
  card: ['card', 'cards', 'credit', 'debit', 'visa', 'mastercard', 'atm', 'terminal', 'transaction', 'chargeback'],
  crime: ['scam', 'scammer', 'fraud', 'theft', 'thief', 'stolen', 'hacker', 'hacking', 'breach', 'phishing', 'malware', 'virus', 'criminal', 'police', 'arrest', 'prison', 'court', 'lawsuit'],
  device: ['phone', 'smartphone', 'iphone', 'android', 'laptop', 'computer', 'screen', 'keyboard', 'mouse', 'tablet', 'monitor', 'app', 'apps', 'notification', 'browser', 'website'],
  ai: ['ai', 'chatgpt', 'gpt', 'claude', 'robot', 'algorithm', 'model', 'prompt', 'neural', 'automation', 'machine'],
  space: ['space', 'star', 'stars', 'galaxy', 'planet', 'planets', 'moon', 'sun', 'orbit', 'universe', 'cosmos', 'nebula', 'blackhole', 'asteroid', 'comet', 'rocket', 'astronaut', 'telescope'],
  nature: ['ocean', 'sea', 'water', 'forest', 'tree', 'trees', 'mountain', 'desert', 'river', 'storm', 'lightning', 'rain', 'snow', 'fire', 'volcano', 'earthquake', 'sky', 'cloud', 'clouds'],
  body: ['brain', 'heart', 'blood', 'lungs', 'muscle', 'bone', 'skin', 'eye', 'eyes', 'sleep', 'dream', 'dreams', 'stress', 'anxiety', 'hormone', 'nerve', 'cell', 'cells', 'dna'],
  food: ['food', 'coffee', 'sugar', 'water', 'meal', 'breakfast', 'protein', 'diet', 'kitchen', 'cooking', 'restaurant'],
  work: ['job', 'jobs', 'office', 'work', 'career', 'boss', 'meeting', 'interview', 'resume', 'company', 'business', 'startup', 'employee', 'team'],
  time: ['clock', 'time', 'hour', 'hours', 'minute', 'minutes', 'second', 'seconds', 'day', 'days', 'week', 'month', 'year', 'years', 'deadline', 'calendar'],
  place: ['city', 'house', 'home', 'building', 'street', 'road', 'car', 'train', 'plane', 'airport', 'hotel', 'school', 'hospital', 'store', 'shop'],
  chart: ['chart', 'graph', 'data', 'statistics', 'percent', 'growth', 'decline', 'trend', 'number', 'numbers', 'study', 'research', 'report', 'survey'],
  people: ['people', 'person', 'crowd', 'family', 'child', 'children', 'friend', 'customer', 'user', 'audience', 'viewer', 'creator'],
};

/** Reverse index: word -> concept group. */
const WORD_TO_CONCEPT = new Map();
for (const [concept, words] of Object.entries(VISUAL_CONCEPTS)) {
  for (const w of words) {
    if (!WORD_TO_CONCEPT.has(w)) WORD_TO_CONCEPT.set(w, concept);
  }
}

/**
 * Extra search terms offered for each concept when suggesting B-roll. These are
 * the phrases a creator would type into their own footage library.
 */
const CONCEPT_SUGGESTIONS = {
  money: ['cash counting close-up', 'bank app on phone', 'receipt / invoice on desk', 'coins stacking'],
  card: ['credit card close-up', 'card tap on terminal', 'suspicious transaction on screen', 'mobile banking screen'],
  crime: ['hooded figure at laptop', 'padlock / security imagery', '警 alert on screen', 'cctv footage look'],
  device: ['hand scrolling a phone', 'screen recording close-up', 'laptop typing overhead', 'notification popping up'],
  ai: ['chat interface typing', 'abstract neural network', 'server room', 'code scrolling'],
  space: ['starfield drift', 'planet rotating', 'nebula timelapse', 'telescope at night'],
  nature: ['aerial over landscape', 'storm clouds timelapse', 'ocean waves slow motion', 'forest canopy'],
  body: ['brain scan animation', 'heartbeat monitor', 'person sleeping', 'microscope cells'],
  food: ['coffee pouring', 'meal prep overhead', 'sugar spooning', 'kitchen close-up'],
  work: ['office over-the-shoulder', 'handshake', 'empty desk', 'team meeting'],
  time: ['clock ticking macro', 'calendar pages', 'timelapse of a street', 'hourglass'],
  place: ['city timelapse', 'driving POV', 'house exterior', 'busy street crowd'],
  chart: ['animated line chart', 'newspaper headline', 'data on screen', 'statistics graphic'],
  people: ['crowd walking slow motion', 'candid reaction shot', 'person alone thinking', 'audience clapping'],
};

/** Correct a stray non-ASCII entry that slipped into the suggestion copy. */
CONCEPT_SUGGESTIONS.crime[2] = 'fraud alert on screen';

module.exports = {
  STOPWORDS, POWER_WORDS, PIVOT_WORDS, CAUSAL_WORDS,
  VISUAL_CONCEPTS, WORD_TO_CONCEPT, CONCEPT_SUGGESTIONS,
};
