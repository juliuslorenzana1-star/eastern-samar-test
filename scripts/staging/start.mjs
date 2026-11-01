import { createServer } from 'vite';
import { stagingEnvironment, checkClosedSignup } from './environment.mjs';
const env=stagingEnvironment();await checkClosedSignup(env);
for(const [name,value]of Object.entries(env))if(name.startsWith('VITE_'))process.env[name]=value;
const server=await createServer({mode:'staging',server:{host:'127.0.0.1',port:5186,strictPort:true}});await server.listen();server.printUrls();
console.log('Restricted staging: genuine Supabase requests; no presentation fixtures. Use designated testing accounts only.');
