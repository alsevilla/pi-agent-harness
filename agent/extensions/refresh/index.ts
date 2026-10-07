import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { existsSync, readFileSync, realpathSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { assertNoHooks, parseRequest, runBounded, Singleton } from './core.ts';

function file(path:string,label:string) {
 if(!isAbsolute(path)||!existsSync(path)||!statSync(path).isFile())throw Error(`${label} must name an existing absolute file.`);
 return realpathSync(path);
}
export function candidateRoot(cwd:string) {
 let root=realpathSync(cwd);const original=root;
 while(true){if(existsSync(join(root,'.git')))return root;const parent=dirname(root);if(parent===root)return original;root=parent}
}
function within(root:string,path:string) {
 const rel=relative(root,realpathSync(path));
 if(rel==='..'||rel.startsWith('..\\')||rel.startsWith('../')||isAbsolute(rel))throw Error('Graph output links outside the selected checkout; refresh refused.');
}
export function graphTarget(cwd:string,explicit?:string) {
 const root=realpathSync(explicit??candidateRoot(cwd));
 const output=join(root,'graphify-out');
 if(!statSync(root).isDirectory()||!existsSync(join(output,'graph.json')))throw Error('Target has no existing graphify-out/graph.json. Specify the intended absolute checkout; /refresh does not initialize graphs.');
 const pending=[output];let checked=0;
 while(pending.length){const path=pending.pop()!;if(++checked>10000)throw Error('Graph output has too many entries to validate.');within(root,path);if(statSync(path).isDirectory())for(const name of readdirSync(path))pending.push(join(path,name))}
 return root;
}
export default function refresh(pi:ExtensionAPI) {
 const folder=dirname(fileURLToPath(import.meta.url)); const gate=new Singleton();
 pi.registerCommand('refresh',{
  description:'Refresh graph code, QMD collections, or existing Serena worker without a model turn',
  handler:async(args,ctx)=>{
   try {
    const request=parseRequest(args);
    await gate.run(async()=>{
     if(request.kind==='serena') {
      if(!pi.getCommands().some(command=>command.name==='serena-restart'))throw Error('Serena extension is not loaded. Reload/install its configured extension first.');
      // Public Pi API dispatches registered commands before agent prompting.
      pi.sendUserMessage('/serena-restart',{expandPromptTemplates:true});
      ctx.ui.notify('Requested existing Serena worker restart; its command reports the result.','info'); return;
     }
     const configPath=join(folder,'config.json');
     const config=existsSync(configPath)?JSON.parse(readFileSync(configPath,'utf8')):{};
     const timeout=Math.min(600000,Math.max(1000,Number(config.timeoutMs)||120000));
     let output:string;
     if(request.kind==='graph') {
      const root=graphTarget(ctx.cwd,request.root);
      const python=file(config.graphPythonPath??join(homedir(),'AppData','Roaming','uv','tools','graphifyy','Scripts','python.exe'),'Graphify Python');
      ctx.ui.notify(`Updating code graph in ${root}`,'info');
      output=await runBounded(python,['-m','graphify','update',root],root,timeout,undefined,{...process.env,GRAPHIFY_OUT:join(root,'graphify-out'),GRAPHIFY_FORCE:'0',GRAPHIFY_NO_TIPS:'1',PYTHONUTF8:'1'});
     }else {
      const qmd=JSON.parse(readFileSync(join(folder,'..','qmd','config.json'),'utf8'));
      const node=file(qmd.nodePath,'QMD Node'); const cli=file(qmd.cliPath,'QMD CLI');
      const name=qmd.indexName??'index';if(!/^[\w-]+$/.test(name))throw Error('QMD indexName must be a simple named global index.');
      const home=process.env.HOME||process.env.USERPROFILE||homedir();
      const configDir=process.env.QMD_CONFIG_DIR||(process.env.XDG_CONFIG_HOME?join(process.env.XDG_CONFIG_HOME,'qmd'):join(home,'.config','qmd'));
      const yamlPath=file(resolve(configDir,`${name}.yml`),'Named QMD configuration');
      const yaml=createRequire(cli)('yaml');assertNoHooks(yaml.parse(readFileSync(yamlPath,'utf8')));
      ctx.ui.notify(`Updating all QMD collections in index ${name}; no embeddings or hooks.`,'info');
      output=await runBounded(node,[cli,'--index',name,'update'],ctx.cwd,timeout);
     }
     pi.sendMessage({customType:'refresh-result',content:output.trim()||'Refresh completed.',display:true},{triggerTurn:false});
     ctx.ui.notify('Refresh completed.','info');
    });
   }catch(error){ctx.ui.notify(error instanceof Error?error.message:String(error),'error')}
  },
 });
}
