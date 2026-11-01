import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import ts from 'typescript';
const en=JSON.parse(readFileSync('src/locales/en/translation.json','utf8'));
const files=['src/App.jsx','src/main.jsx',...readdirSync('src/components').filter(x=>x.endsWith('.jsx')).map(x=>'src/components/'+x)];
for(const file of files){const s=readFileSync(file,'utf8'),ast=ts.createSourceFile(file,s,99,true,ts.ScriptKind.JSX);function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='t'&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0]))en[n.arguments[0].text]=n.arguments[0].text;ts.forEachChild(n,walk);}walk(ast);}
const rows=new Map();
for(const line of readFileSync('scripts/translations.tsv','utf8').split(/\r?\n/).slice(1)){
 if(!line.trim())continue;const [key,fil,war]=line.split('\t');if(!key||!fil||!war)throw Error('Incomplete translation: '+line);rows.set(key,[fil,war]);en[key]=key;
}
const protectedText=new Set(['SMART ESTE','SMART ESTE.','EASTERN SAMAR','Eastern Samar','SAMAR','EASTERN','Borongan City','General MacArthur','San Julian','San Policarpo','REGION VIII','REGION VIII · PHILIPPINES','PH / EASTERN VISAYAS','EASTERN SAMAR, EASTERN VISAYAS','EASTERN SAMAR · PHILIPPINES','Eastern Visayas · Philippines','PHILIPPINE SEA','Philippine Sea','By Julius Lorenzana','Developed by Julius Lorenzana','Ctrl K']);
const usedKeys=new Set();
for(const file of files){const s=readFileSync(file,'utf8');for(const match of s.matchAll(/\bt\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)){try{usedKeys.add(match[1][0]==='"'?JSON.parse(match[1]):match[1].slice(1,-1));}catch{ /* AST scan above remains authoritative. */ }}}
const technical=key=>/^\s|^[Mm]\d|^\(max-width|^\.search|^(?:field-label|icon-button|outline-button|primary-button|modal-foot|report-modal|volunteer-empty|volunteer-message|smart-art|smart-orbit|smart-preview|civic-guide) /.test(key)||!/[A-Za-z]/.test(key);
const nonCopy=new Set(['Z','abcd','alert','blue','button','checkbox','dialog','email not confirmed','evenodd','eyebrow','group','invalid login credentials','newest','off','progressbar','toast','true','violet','° E','° N']);
for(const key of Object.keys(en))if(!usedKeys.has(key)&&(nonCopy.has(key)||/^smart-(art|preview|orbit)\S* /.test(key)))delete en[key];
for(const key of Object.keys(en))if(technical(key)&&!usedKeys.has(key))delete en[key];
const byCase=new Map([...rows].map(([key,value])=>[key.toLowerCase(),value]));
const missing=[];const catalogs={fil:{},war:{}};
for(const key of Object.keys(en).sort()){
 const value=rows.get(key)||byCase.get(key.toLowerCase());
 if(!value&&key!=='Volunteer_navigation'&&!protectedText.has(key)&&!nonCopy.has(key)&&!technical(key))missing.push(key);
 catalogs.fil[key]=value?.[0]||key;catalogs.war[key]=value?.[1]||key;
}
// Compact navigation uses a noun; the full label can remain an action phrase.
en.Volunteer_navigation='Volunteer';catalogs.fil.Volunteer_navigation='Boluntaryo';catalogs.war.Volunteer_navigation='Volunteer';
for(const [language,catalog]of Object.entries({en,...catalogs})){mkdirSync(`src/locales/${language}`,{recursive:true});writeFileSync(`src/locales/${language}/translation.json`,JSON.stringify(catalog,null,2)+'\n');}
mkdirSync('test-results.local',{recursive:true});writeFileSync('test-results.local/untranslated.json',JSON.stringify(missing,null,2)+'\n');
console.log('Catalog keys:',Object.keys(en).length,'Untranslated:',missing.length);
if(process.argv.includes('--check')&&missing.length)process.exitCode=1;
