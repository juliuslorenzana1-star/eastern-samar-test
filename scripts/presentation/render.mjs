// Free, local rendering only. FFMPEG_PATH may point to an existing FFmpeg binary.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
const out=resolve('presentation-output.local');
const ffmpeg=process.env.FFMPEG_PATH||join(process.env.TEMP,'escam-media-tools/package/ffmpeg.exe');
const source=JSON.parse(await readFile(join(out,'manifest.json'),'utf8'));
if(!source.recording)throw Error('Run npm run video:record first.');
const run=args=>new Promise((ok,no)=>{const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,cwd:out,stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',x=>{error+=x;});child.on('error',no);child.on('exit',code=>code===0?ok():no(Error(error)));});
function wavDuration(bytes){let rate=0,length=0;for(let offset=12;offset+8<=bytes.length;){const name=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4);if(name==='fmt ')rate=bytes.readUInt32LE(offset+16);if(name==='data')length+=size;offset+=8+size+(size%2);}if(!rate||!length)throw Error('Invalid narration WAV');return length/rate;}
const time=seconds=>{const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
const captions=[];let captionId=0;const durations=[];
for(const scene of source.scenes){
  await stat(scene.video);const audio=join(out,scene.id+'.wav'),spoken=wavDuration(await readFile(audio));
  if(spoken>scene.duration-.2)throw Error(`${scene.id}: narration ${spoken.toFixed(1)}s exceeds ${scene.duration}s. Increase offline voice rate and regenerate; do not clip words.`);
  const sentences=scene.voice.match(/[^.!?]+[.!?]+|[^.!?]+$/g).map(x=>x.trim());const wordTotal=scene.voice.split(/\s+/).length;let cursor=scene.start;
  for(const sentence of sentences){const duration=spoken*sentence.split(/\s+/).length/wordTotal;captions.push(`${++captionId}\n${time(cursor)} --> ${time(cursor+duration)}\n${sentence}\n`);cursor+=duration;}
  durations.push({id:scene.id,spokenSeconds:spoken,sceneSeconds:scene.duration});
  const encoded=join(out,scene.id+'.mp4');
  const fresh=await stat(encoded).then(async item=>item.mtimeMs>=(await stat(scene.video)).mtimeMs).catch(()=>false);
  if(!fresh)await run(['-i',scene.video,'-t',String(scene.duration),'-vf','scale=1920:1080,fps=30','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',encoded]);
  await run(['-i',audio,'-af','apad','-t',String(scene.duration),'-ar','48000','-ac','2',join(out,scene.id+'-padded.wav')]);console.log(`Rendered ${scene.id}`);
}
await writeFile(join(out,'captions.srt'),captions.join('\n'));
const list=extension=>source.scenes.map(scene=>`file '${scene.id}${extension}'`).join('\n');
await writeFile(join(out,'video-concat.txt'),list('.mp4'));await writeFile(join(out,'audio-concat.txt'),list('-padded.wav'));
await run(['-f','concat','-safe','0','-i','video-concat.txt','-c','copy','-movflags','+faststart',join(out,'Eastern-Samar-no-narration.mp4')]);
await run(['-f','concat','-safe','0','-i','audio-concat.txt','-c:a','pcm_s16le',join(out,'voiceover.wav')]);
await run(['-i',join(out,'Eastern-Samar-no-narration.mp4'),'-i',join(out,'voiceover.wav'),'-i',join(out,'captions.srt'),'-map','0:v','-map','1:a','-map','2:0','-c:v','copy','-c:a','aac','-b:a','192k','-c:s','mov_text','-metadata:s:s:0','language=eng','-t','150','-movflags','+faststart',join(out,'Eastern-Samar-rehearsal-150s.mp4')]);
await writeFile(join(out,'render-verification.json'),JSON.stringify({durationTarget:150,width:1920,height:1080,videoCodec:'H.264',narration:'Microsoft David Desktop — offline synthetic draft',music:false,subtitleTiming:'Sentence timing estimated by word count within each measured speech segment; editorial review required',durations},null,2));
console.log('Rendered 150-second rehearsal, silent backup, narration and English subtitles.');
