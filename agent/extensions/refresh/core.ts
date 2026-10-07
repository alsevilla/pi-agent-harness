import { spawn } from 'node:child_process';
import { isAbsolute, win32 } from 'node:path';

export function parseRequest(text: string): {kind:'graph'|'qmd'|'serena'; root?:string} {
 const match=text.trim().match(/^(graph|qmd|serena)(?:\s+(.+))?$/);
 if(!match) throw Error('Usage: /refresh graph ["absolute project root"] | qmd | serena');
 const kind=match[1] as 'graph'|'qmd'|'serena';
 let root=match[2]?.trim();
 if(kind!=='graph' && root) throw Error(`${kind} accepts no arguments.`);
 if(root?.startsWith('"') && root.endsWith('"')) root=root.slice(1,-1);
 if(root && (!isAbsolute(root) && !win32.isAbsolute(root) || /[\r\n\0"]/.test(root))) throw Error('Graph target must be one absolute directory.');
 return root ? {kind,root} : {kind};
}
export function assertNoHooks(config:any) {
 if(!config || typeof config.collections!=='object' || !config.collections) throw Error('Invalid QMD collections configuration.');
 for(const [name,collection] of Object.entries(config.collections)) {
  if((collection as any)?.update) throw Error(`QMD collection ${name} has an update hook. Remove/review it first; /refresh never runs hooks.`);
 }
}
export class Singleton {
 private busy=false;
 async run<T>(action:()=>Promise<T>):Promise<T> {
  if(this.busy) throw Error('A refresh is already running.');
  this.busy=true; try{return await action()}finally{this.busy=false}
 }
}
export async function runBounded(exe:string,args:string[],cwd:string,timeoutMs:number,spawnProcess:any=spawn,env?:NodeJS.ProcessEnv):Promise<string> {
 return new Promise((resolve,reject)=>{
  const child=spawnProcess(exe,args,{cwd,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],env});
  let output='', total=0, failure:Error|undefined;
  const terminate=(message:string)=>{failure??=Error(message);child.kill()};
  const timer=setTimeout(()=>terminate('Refresh timed out; process terminated.'),timeoutMs);
  // Node handles spawn errors and close after kill. Retain only a compact tail.
  const collect=(chunk:Buffer)=>{total+=chunk.length; output=(output+chunk.toString()).slice(-12000);if(total>256000)terminate('Refresh exceeded output limit; process terminated.')};
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.on('error',(error:Error)=>{clearTimeout(timer);reject(error)});
  child.on('close',(code:number|null)=>{clearTimeout(timer);if(failure)reject(failure);else if(code!==0)reject(Error(`Refresh exited ${code}: ${output}`));else resolve(output)});
 });
}
