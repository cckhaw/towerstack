// Server-side name validation + profanity filtering for the leaderboard.
// Best-effort: normalises leetspeak, tolerates repeated letters, and uses
// whole-word matching for short words that would otherwise cause false
// positives (e.g. "Essex", "Dickson", "peacock").

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g' };

// Matched anywhere in the squashed name (long, unambiguous words)
const SUBSTRING = [
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'asshole', 'bastard',
  'whore', 'slut', 'pussy', 'retard', 'wanker', 'bollock', 'motherfuck', 'dickhead',
  'cocksuck', 'blowjob', 'handjob', 'jizz', 'nazi', 'hitler', 'rapist', 'pedo', 'paedo',
  'porn', 'chink', 'tranny', 'wetback', 'kike', 'bullshit', 'horseshit', 'dumbass',
  'jackass', 'douche', 'bukkake', 'cumshot', 'fellatio', 'orgasm', 'masturbat'
];
// Matched only as a whole word (short / ambiguous words)
const WHOLE = [
  'ass', 'arse', 'dick', 'cock', 'cum', 'sex', 'tit', 'tits', 'boob', 'boobs', 'piss',
  'fag', 'dyke', 'coon', 'gook', 'spic', 'rape', 'anal', 'anus', 'dildo', 'twat', 'wank',
  'prick', 'skank', 'hoe', 'milf', 'nude', 'nudes', 'hentai', 'kkk', 'isis', 'penis', 'vagina',
  'bollocks', 'bugger', 'damn', 'crap'
];

// Innocent words that contain a flagged substring (the "Scunthorpe problem")
const ALLOW = ['scunthorpe', 'shiitake', 'shitake', 'cassandra', 'assassin', 'classic', 'bassist', 'passion', 'assess',
  'analyst', 'analysis', 'penistone', 'mishit', 'pedometer', 'pedometers', 'hancock', 'peacock', 'dickens', 'dickinson', 'dickson'];
const ALLOW_RE = new RegExp(ALLOW.join('|'), 'g');

// "fuck" -> /f+u+c+k+/ so "fuuuck" still matches
const stretch = w => w.split('').map(c => c + '+').join('');
const SUB_RE = SUBSTRING.map(w => new RegExp(stretch(w)));
const WHOLE_RE = WHOLE.map(w => new RegExp('^' + stretch(w) + '$'));

function normalise(s) {
  return String(s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[01345789]/g, d => LEET[d]);
}

export function isProfane(input) {
  const n = normalise(input);
  const squashed = n.replace(ALLOW_RE, ' ').replace(/[^a-z]/g, '');
  if (SUB_RE.some(re => re.test(squashed))) return true;
  const tokens = n.split(/[^a-z]+/).filter(Boolean);
  if (tokens.some(t => WHOLE_RE.some(re => re.test(t)))) return true;
  // Catch spaced-out letters like "f u c k" / "s h i t"
  const spaced = n.replace(/(?<=\b[a-z]) (?=[a-z]\b)/g, '');
  if (spaced !== n && SUB_RE.some(re => re.test(spaced.replace(/[^a-z]/g, '')))) return true;
  return false;
}

export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 14) return null;
  if (!/^[A-Za-z0-9 _.\-]+$/.test(name)) return null;
  return name;
}
