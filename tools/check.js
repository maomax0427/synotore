// データ検証：node tools/check.js
// 解答ページ（Answer Key）の並びと words.js の答えが一致しているか、25語そろっているかを確かめる。
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../data/words.js'), 'utf8');
const SETS = new Function(src + '; return SETS;')();

const KEY = {
  b13: 'foolproof gap fine fixed forecast gather fix fixture found feature foolish flood foundation federal fold fundamental fee fool frame fierce frequently flavor further flexible float',
  b14: 'guarantee highlight giant gradually habitual generate gift grant handle generous glance grave harbor gentle global gross harm genuine govern harmful nongovernmental grab hide harmless headquarters',
  b15: 'impose imagine ideal implement imposing honor identify imply impressive humorous identical implicit improve humor illustrate incidence imagination dishonest imaginary incidentally imaginative indicate immediately incredible index',
  b16: 'intensify involve initial initiate intelligent intensification indication inquiry inspect intense intentional disintegrate institute instrument intervention infect integrate integral investigate infectious intention ingredient interior invasion inevitable',
  c13: 'fury filter formulate fragrance furious flap formulation freshly garment flock fur frighten gauge flourish foster infertile fluid fragile fiber frank fragment fictitious fog fragrant forbid',
  c14: 'herald glowing habitat hatch heritage graceful hail heal hierarchy disgrace helpless glare graze hammer hence gorgeous grasp hamper greeting handsome harsh harvest grief glow genetics',
  c15: 'inherent innovation innovative insert insight inhabitant instinctive infinite inspire informal humble incentive instructive immense hostility hurried incorporate inclination inclined induce incline inherit instruction humanitarian inhabit',
  c16: 'interfere interrupt liquid lonely interval intimate landmark lively loyal intimidate isolated last locate loyalty invent lasting location inventive legend irritate leisure logical inventor liable irritable',
};

let bad = 0;
const seen = new Set();
for (const s of SETS) {
  const key = KEY[s.id].split(' ');
  if (s.words.length !== 25) { console.log(`${s.name}: ${s.words.length}語（25語のはず）`); bad++; }
  s.words.forEach((w, i) => {
    if (w.w !== key[i]) { console.log(`${s.name} ${i + 1}: ${w.w} ≠ 解答 ${key[i]}`); bad++; }
    if (!w.syn || !w.ja || !w.pos) { console.log(`${s.name} ${i + 1}: 空の項目あり`); bad++; }
    if (seen.has(w.id)) { console.log(`ID重複 ${w.id}`); bad++; }
    seen.add(w.id);
  });
}
console.log(bad ? `NG: ${bad}件` : `OK: ${SETS.length}セット ${seen.size}語`);
process.exit(bad ? 1 : 0);
