import { readFileSync,readdirSync,writeFileSync } from 'node:fs';
import ts from 'typescript';
const attributes=new Set(['aria-label','title','placeholder','alt']);
const en=JSON.parse(readFileSync('src/locales/en/translation.json','utf8'));
const failures=[];
for(const file of ['src/App.jsx','src/main.jsx',...readdirSync('src/components').filter(x=>x.endsWith('.jsx')).map(x=>'src/components/'+x)]){
 let source=readFileSync(file,'utf8');const ast=ts.createSourceFile(file,source,99,true,ts.ScriptKind.JSX);const edits=[];
 function display(n){
  let p=n.parent;
  while(p&&!ts.isJsxExpression(p)){
   if(ts.isJsxAttribute(p))return attributes.has(p.name.text);
   if(ts.isCallExpression(p)||ts.isArrowFunction(p)||ts.isBinaryExpression(p))return false;
   p=p.parent;
  }
  return p&&(!ts.isJsxAttribute(p.parent)||attributes.has(p.parent.name.text));
 }
 function walk(n){
  if(ts.isStringLiteral(n)&&/[A-Za-z]/.test(n.text)&&display(n)&&!ts.isCallExpression(n.parent)){
   failures.push(`${file}:${ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1}: ${n.text}`);
   if(process.argv.includes('--fix')){const attribute=ts.isJsxAttribute(n.parent);edits.push([n.getStart(ast),n.end,`${attribute?'{':''}t(${JSON.stringify(n.text)})${attribute?'}':''}`]);en[n.text]=n.text;}
  }
  if(ts.isJsxText(n)&&/[A-Za-z]/.test(n.text))failures.push(`${file}: untranslated JSX text: ${n.text.trim()}`);
  ts.forEachChild(n,walk);
 }walk(ast);
 if(edits.length){edits.sort((a,b)=>b[0]-a[0]);for(const[a,b,v]of edits)source=source.slice(0,a)+v+source.slice(b);writeFileSync(file,source);}
}
if(process.argv.includes('--fix'))writeFileSync('src/locales/en/translation.json',JSON.stringify(en,null,2)+'\n');
console.log(failures.length?failures.join('\n'):'No untranslated static JSX labels.');
if(failures.length&&!process.argv.includes('--fix'))process.exitCode=1;
