import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import ts from 'typescript';
import i18n,{ t,changeLanguage,readLanguage,locale,formatDate,formatNumber } from '../src/i18n/config.js';

test('three catalogs cover the same keys and never invent interpolation parameters',async()=>{
  const catalogs={};
  for(const code of ['en','fil','war'])catalogs[code]=JSON.parse(await readFile(new URL(`../src/locales/${code}/translation.json`,import.meta.url),'utf8'));
  for(const code of ['fil','war']){
    assert.deepEqual(Object.keys(catalogs[code]).sort(),Object.keys(catalogs.en).sort());
    for(const [key,text]of Object.entries(catalogs[code])){
      assert.equal(typeof text,'string');assert.ok(text.trim(),`${code}: ${key}`);
      const original=new Set([...key.matchAll(/{{(\w+)}}/g)].map(x=>x[1]));
      for(const parameter of text.matchAll(/{{(\w+)}}/g))assert.ok(original.has(parameter[1]),`${code}: unexpected parameter in ${key}`);
    }
  }
});

test('language changes translate saved notices, preserve interpolation and fall back to English',async()=>{
  await changeLanguage('en');
  const stored=t('Welcome back, {{value1}}!',{value1:'Map <neighbor>'});
  await changeLanguage('war');
  assert.equal(t('Report a Concern'),'Pagreport hin Problema');
  assert.equal(t(['Report','Location']),'Report Lugar');
  assert.equal(t(stored),'Maupay nga pagbalik, Map <neighbor>!');
  assert.equal(t('A new English fallback sentence.'),'A new English fallback sentence.');
  const translated=i18n.getResource('war','translation','Language');
  delete i18n.getResourceBundle('war','translation').Language;
  assert.equal(t('Language'),'Language');
  i18n.addResource('war','translation','Language',translated);
  await changeLanguage('fil');
  assert.equal(t('Report a Concern'),'Mag-ulat ng Suliranin');
  assert.equal(t(stored),'Maligayang pagbabalik, Map <neighbor>!');
  assert.ok(formatNumber(1234).length>3);
  assert.ok(formatDate('2026-11-01T00:00:00Z',{dateStyle:'medium'}));
  assert.equal(locale(),'fil-PH');
  await changeLanguage('en');
});

test('English is the default for invalid preferences and unavailable storage',()=>{
  assert.equal(readLanguage({getItem:()=>null}),'en');
  assert.equal(readLanguage({getItem:()=> 'invalid'}),'en');
  assert.equal(readLanguage({getItem:()=> 'war'}),'war');
  assert.equal(readLanguage({getItem:()=>{throw Error('blocked');}}),'en');
});

test('translations do not alter comparison identifiers or control values',async()=>{
  const paths=['../src/App.jsx',...(await readdir(new URL('../src/components/',import.meta.url))).filter(x=>x.endsWith('.jsx')).map(x=>'../src/components/'+x)];
  for(const file of paths){const source=await readFile(new URL(file,import.meta.url),'utf8');const ast=ts.createSourceFile(file,source,99,true,ts.ScriptKind.JSX);
    function check(n){
      if(ts.isCallExpression(n)&&n.expression.getText(ast)==='t'){
        const comparison=ts.isBinaryExpression(n.parent)&&[ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsEqualsToken,ts.SyntaxKind.EqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsToken].includes(n.parent.operatorToken.kind);
        assert.ok(!comparison,`${file}: translated comparison`);
        if(ts.isJsxExpression(n.parent)&&ts.isJsxAttribute(n.parent.parent))assert.notEqual(n.parent.parent.name.text,'value',`${file}: translated control value`);
      }
      ts.forEachChild(n,check);
    }check(ast);
  }
});
