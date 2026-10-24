// Packages compiled public assets only. Never reads environment files or uploads.
import { cp,mkdtemp,readdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join,relative } from 'node:path';
const manifestPath='test-results.local/preview-manifest.json';
if(process.argv[2]==='prepare') {
  const directory=await mkdtemp('test-results.local/preview-artifact-');
  await cp('dist',directory,{recursive:true});
  const config=JSON.parse(await readFile('vercel.json','utf8'));
  await writeFile(join(directory,'vercel.json'),JSON.stringify({version:2,rewrites:config.rewrites,headers:config.headers}));
  const files=[];
  async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const item=join(path,entry.name);if(entry.isDirectory())await walk(item);else{const bytes=await readFile(item);files.push({file:relative(directory,item).replaceAll('\\','/'),path:item,size:bytes.length,sha:createHash('sha1').update(bytes).digest('hex'),encodedLength:Math.ceil(bytes.length/3)*4});}}}
  await walk(directory);
  await writeFile(manifestPath,JSON.stringify(files));
  console.log(JSON.stringify(files));
}else{
  const files=JSON.parse(await readFile(manifestPath,'utf8'));
  const bytes=await readFile(files[Number(process.argv[2])].path);
  console.log(bytes.toString('base64').slice(Number(process.argv[3]),Number(process.argv[3])+16000));
}
