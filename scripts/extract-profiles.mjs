import fs from 'node:fs';
const text=fs.readFileSync('profile-reference.scad','utf8');
const profiles={};
for(const p of [3,5]) {
  const block=text.split('module tooth_profile_HTD_'+p+'mm(height)')[1].split('}')[0];
  profiles[p]=JSON.parse(block.split('polygon(')[1].split(');')[0]);
}
fs.writeFileSync('src/profiles.json',JSON.stringify(profiles));
