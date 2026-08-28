/**
 * Country flags, and the coordinate guard the map leans on.
 *
 * A flag emoji is not a picture: it is two regional indicator letters that the
 * font pairs up. Get the arithmetic wrong by one and you get a different
 * country, silently, which is the sort of wrong that ships.
 */

import { flagOf, codeOf, flagsForLegs } from '../src/utils/flags.js';

let failed = 0;
const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`  ok   ${name}`); return; }
    failed += 1;
    console.log(`  FAIL ${name}\n       got  ${a}\n       want ${b}`);
};

console.log('\nflags:');
check('india', flagOf('in'), '🇮🇳');
check('switzerland', flagOf('ch'), '🇨🇭');
check('case does not matter', flagOf('IN'), flagOf('in'));
check('whitespace does not either', flagOf('  in  '), '🇮🇳');
// Two letters is the whole rule; anything else would render as stray letters.
check('one letter is not a country', flagOf('i'), '');
check('three letters is not either', flagOf('ind'), '');
check('a number is not a country', flagOf('12'), '');
check('nothing is nothing', flagOf(''), '');
check('undefined is nothing', flagOf(undefined), '');
check('a flag is two code points, not two letters',
    [...flagOf('in')].length, 2);

console.log('\nnames to codes:');
check('a name she would type', codeOf('India'), 'in');
check('an alias', codeOf('UK'), 'gb');
check('a code passes straight through', codeOf('fr'), 'fr');
check('spacing and case', codeOf('  New Zealand '), 'nz');
// Better no flag than the wrong one.
check('somewhere not in the table gets nothing', codeOf('Narnia'), null);
check('nothing gets nothing', codeOf(''), null);

console.log('\na trip\'s flags:');
check('in visiting order, without repeats',
    flagsForLegs([
        { country_code: 'IN' },
        { country: 'India' },
        { country: 'Nepal' },
        { country_code: 'in' },
    ]), ['🇮🇳', '🇳🇵']);
check('the stored code wins over the name',
    flagsForLegs([{ country_code: 'ch', country: 'India' }]), ['🇨🇭']);
// "Air Travel" has no country, and does not need a flag.
check('a leg with no country contributes nothing',
    flagsForLegs([{ city: 'Air Travel' }, { country: 'India' }]), ['🇮🇳']);
check('no legs, no flags', flagsForLegs([]), []);
check('undefined does not throw', flagsForLegs(undefined), []);

console.log(failed ? `\n${failed} failing\n` : '\nall passing\n');
process.exit(failed ? 1 : 0);
