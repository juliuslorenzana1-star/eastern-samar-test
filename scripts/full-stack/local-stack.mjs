import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir,copyFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const workdir=resolve(root,'supabase-proof.local');
export const project='escam-local-proof';
const cli=resolve(root,'node_modules/supabase/dist/supabase.js');
export function safeOutput(value){
  return String(value).split(/\r?\n/).filter(line=>!/(key|token|password|secret|postgresql:\/\/)/i.test(line))
    .map(line=>line.replace(/[A-Za-z0-9_-]{32,}/g,'[redacted]')).slice(-25).join('\n');
}
export function command(file,args,options={}){
  const result=spawnSync(file,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:20000000,timeout:600000,...options});
  if(result.error || result.status!==0)throw new Error(`${file===process.execPath?'Supabase CLI':file} failed: ${safeOutput(result.stderr || result.error?.message || result.stdout)}`);
  return result.stdout;
}
export const supabase=(args)=>command(process.execPath,[cli,...args,'--workdir',workdir],{env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'}});
export function sql(query){
  return command('docker',['exec','-i',`supabase_db_${project}`,'psql','-U','postgres','-d','postgres','-X','-A','-t','-v','ON_ERROR_STOP=1'],{input:query});
}
export async function prepare(){
  await mkdir(workdir,{recursive:true});
  const marker=resolve(workdir,'owner.json');
  try{await access(resolve(workdir,'supabase/config.toml'));const existing=JSON.parse(await readFile(marker,'utf8'));if(existing.project!==project)throw Error('Unexpected local workspace');}
  catch(error){
    if(error.code!=='ENOENT')throw error;
    try{await access(resolve(workdir,'supabase/config.toml'));throw Error('Refusing to overwrite an unowned Supabase workspace');}catch(check){if(check.code!=='ENOENT')throw check;}
    supabase(['init']);await writeFile(marker,JSON.stringify({project}));
  }
  const configFile=resolve(workdir,'supabase/config.toml');let config=await readFile(configFile,'utf8');
  config=config.replace(/^project_id\s*=.*$/m,`project_id = "${project}"`);
  const set=(section,key,value)=>{
    const start=config.indexOf(`[${section}]`);if(start<0)throw Error(`Missing CLI configuration section ${section}`);
    const end=config.indexOf('\n[',start+1);const stop=end<0?config.length:end;
    const body=config.slice(start,stop);const regex=new RegExp(`^${key}\\s*=.*$`,'m');
    if(!regex.test(body))throw Error(`Missing CLI configuration option ${section}.${key}`);
    config=config.slice(0,start)+body.replace(regex,`${key} = ${value}`)+config.slice(stop);
  };
  set('auth','enable_signup','false');set('auth.email','enable_signup','false');
  set('auth','enable_anonymous_sign_ins','false');set('db.seed','enabled','false');
  set('analytics','enabled','false');set('edge_runtime','enabled','false');set('storage.vector','enabled','false');
  await writeFile(configFile,config);
  const migrations=resolve(workdir,'supabase/migrations');await mkdir(migrations,{recursive:true});
  for(const name of (await readdir(resolve(root,'supabase/migrations'))).filter(n=>n.endsWith('.sql')))await copyFile(resolve(root,'supabase/migrations',name),resolve(migrations,name));
  console.log('Prepared unlinked, dedicated local Supabase workspace; public signup, anonymous Auth and Edge runtime disabled.');
}
export async function start(){
  await prepare();
  command('docker',['info','--format','{{.OSType}}']);
  const context=JSON.parse(command('docker',['context','inspect','--format','{{json .Endpoints.docker.Host}}']));
  if(!/^(unix:\/\/|npipe:\/\/)/.test(context))throw Error('Refusing a remote Docker context.');
  let network;
  try{network=JSON.parse(command('docker',['network','inspect','escam-proof-network']));}
  catch{command('docker',['network','create','--driver','bridge','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1','escam-proof-network']);network=JSON.parse(command('docker',['network','inspect','escam-proof-network']));}
  if(network[0]?.Options?.['com.docker.network.bridge.host_binding_ipv4']!=='127.0.0.1')throw Error('Local Docker network is not loopback-bound.');
  // Capture CLI output because its normal success output includes local keys.
  supabase(['start','--network-id','escam-proof-network','--exclude','realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor']);
  console.log('Supabase containers are healthy. Credentials suppressed; no linked hosted project.');
}
export function credentials(){
  const data=JSON.parse(supabase(['status','-o','json']));
  if(data.API_URL!=='http://127.0.0.1:54321')throw Error('Refusing a non-loopback API target.');
  const anon=data.ANON_KEY || data.PUBLISHABLE_KEY;
  const service=data.SERVICE_ROLE_KEY || data.SECRET_KEY;
  if(!anon || !service)throw Error(`Local CLI status lacks required credential fields. Available names: ${Object.keys(data).join(',')}`);
  return {url:data.API_URL,anon,service};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.includes('--prepare'))await prepare();
    else if(process.argv.includes('--start'))await start();
    else if(process.argv.includes('--stop')){supabase(['stop']);console.log('Stopped only the dedicated local stack; volumes preserved.');}
    else throw Error('Choose --prepare, --start or --stop. No reset or hosted commands are supported.');
  }catch(error){console.error(safeOutput(error.message));process.exitCode=1;}
}
