const phrases = [
  'Big Bang', 'James Webb', 'Space Telescope', 'Artificial Intelligence',
  'Sagrada Família', 'Sagrada Familia', 'Marcus Aurelius', 'Charlie Chaplin',
  'Mariana Trench', 'Hadal Zone', 'Voynich Manuscript', 'carbon dioxide',
  'solar shield', 'deep space', 'light years', 'solar system', 'silent cinema',
  'motion pictures', 'look back', 'peer through', 'cutting edge', 'everyday algorithms',
  'fastest route', 'weather forecast'
];

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const patternStr = '\\b(' + phrases.map(p => escapeRegex(p).replace(/\\\s\+/g, '\\s+')).sort((a,b) => b.length - a.length).join('|') + ')\\b';
const pattern = new RegExp(patternStr, 'gi');

const sample = 'ancient celestial bodies formed shortly after the Big Bang. With Artificial Intelligence, we look back into history and find the fastest route.';

console.log('Testing pattern:');
let match;
while ((match = pattern.exec(sample)) !== null) {
    console.log(`Found: "${match[0]}" at position ${match.index}`);
}
