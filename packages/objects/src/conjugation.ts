/**
 * Verb Conjugation Utilities
 *
 * Extracted from the canonical source: digital-objects/linguistic.ts
 * Handles consonant doubling, vowel-y rules, and irregular verbs correctly.
 *
 * Kept as a local copy so @headlessly/objects avoids runtime resolution
 * issues with the digital-objects barrel export in test/bundler contexts.
 */

function isVowel(char: string | undefined): boolean {
  return char ? 'aeiou'.includes(char.toLowerCase()) : false
}

function shouldDoubleConsonant(verb: string): boolean {
  if (verb.length < 2) return false
  const last = verb.charAt(verb.length - 1)
  const secondLast = verb.charAt(verb.length - 2)
  if ('wxy'.includes(last)) return false
  if (isVowel(last) || !isVowel(secondLast)) return false
  const doublingVerbs = [
    'submit',
    'commit',
    'permit',
    'omit',
    'admit',
    'emit',
    'transmit',
    'refer',
    'prefer',
    'defer',
    'occur',
    'recur',
    'begin',
    'stop',
    'drop',
    'shop',
    'plan',
    'scan',
    'ban',
    'run',
    'gun',
    'stun',
    'cut',
    'shut',
    'hit',
    'sit',
    'fit',
    'spit',
    'quit',
    'knit',
    'get',
    'set',
    'pet',
    'wet',
    'bet',
    'let',
    'put',
    'drag',
    'brag',
    'flag',
    'tag',
    'bag',
    'nag',
    'wag',
    'hug',
    'bug',
    'mug',
    'tug',
    'rub',
    'scrub',
    'grab',
    'stab',
    'rob',
    'sob',
    'throb',
    'nod',
    'prod',
    'plod',
    'plot',
    'rot',
    'blot',
    'spot',
    'knot',
    'trot',
    'chat',
    'pat',
    'bat',
    'mat',
    'rat',
    'slap',
    'clap',
    'flap',
    'tap',
    'wrap',
    'snap',
    'trap',
    'cap',
    'map',
    'nap',
    'zap',
    'tip',
    'sip',
    'dip',
    'rip',
    'zip',
    'slip',
    'trip',
    'drip',
    'chip',
    'clip',
    'flip',
    'grip',
    'ship',
    'skip',
    'whip',
    'strip',
    'equip',
    'hop',
    'pop',
    'mop',
    'cop',
    'chop',
    'crop',
    'prop',
    'flop',
    'swim',
    'trim',
    'slim',
    'skim',
    'dim',
    'rim',
    'brim',
    'grim',
    'hem',
    'stem',
    'jam',
    'cram',
    'ram',
    'slam',
    'dam',
    'ham',
    'scam',
    'spam',
    'tram',
    'hum',
    'drum',
    'strum',
    'sum',
    'gum',
    'chum',
    'plum',
  ]
  if (verb.length <= 3) return true
  return doublingVerbs.some((v) => verb === v || verb.endsWith(v))
}

/**
 * Convert verb to past participle (create -> created, qualify -> qualified, submit -> submitted)
 */
export function toPastParticiple(verb: string): string {
  if (verb.endsWith('e')) return verb + 'd'
  if (verb.endsWith('y') && !isVowel(verb[verb.length - 2])) {
    return verb.slice(0, -1) + 'ied'
  }
  if (shouldDoubleConsonant(verb)) {
    return verb + verb[verb.length - 1] + 'ed'
  }
  return verb + 'ed'
}

/**
 * Convert verb to gerund (create -> creating, qualify -> qualifying, submit -> submitting)
 */
export function toGerund(verb: string): string {
  if (verb.endsWith('ie')) return verb.slice(0, -2) + 'ying'
  if (verb.endsWith('e') && !verb.endsWith('ee')) return verb.slice(0, -1) + 'ing'
  if (shouldDoubleConsonant(verb)) {
    return verb + verb[verb.length - 1] + 'ing'
  }
  return verb + 'ing'
}

/**
 * Derive verb conjugation forms from a verb string.
 */
export function conjugateVerb(verb: string): { action: string; activity: string; event: string } {
  return {
    action: verb,
    activity: toGerund(verb),
    event: toPastParticiple(verb),
  }
}
