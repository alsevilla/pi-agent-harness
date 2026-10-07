import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { parseRequest, runBounded, Singleton, assertNoHooks } from '../core.ts';
import refresh, {candidateRoot,graphTarget} from '../index.ts';
import { mkdtempSync,mkdirSync,writeFileSync,existsSync,symlinkSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('parses exact targets and rejects extra commands', () => {
 assert.deepEqual(parseRequest('graph "C:/Repo With Space"'), {kind:'graph', root:'C:/Repo With Space'});
 assert.deepEqual(parseRequest('qmd'), {kind:'qmd'});
 assert.throws(() => parseRequest('qmd embed'));
 assert.throws(() => parseRequest('graph relative/path'));
 assert.throws(() => parseRequest('serena junk'));
});
test('rejects hooks including YAML inline objects', () => {
 assertNoHooks({collections:{notes:{path:'x'}}});
 assert.throws(() => assertNoHooks({collections:{notes:{update:'git pull'}}}));
});
test('singleton releases on failure and forbids concurrent work', async () => {
 const gate=new Singleton(); let release:any;
 const first=gate.run(()=>new Promise<void>(r=>release=r));
 await assert.rejects(gate.run(async()=>{}), /already running/); release(); await first;
 await assert.rejects(gate.run(async()=>{throw Error('broken')}));
 await gate.run(async()=>{});
});
function fakeSpawn(code:number, output:string, capture:any) {
 return (_exe:any,_args:any,options:any) => {
  capture.options=options; const child:any=new EventEmitter(); child.stdout=new EventEmitter(); child.stderr=new EventEmitter(); child.kill=()=>{capture.killed=true; queueMicrotask(()=>child.emit('close',null)); return true};
  if(code>=0) queueMicrotask(()=>{child.stdout.emit('data',Buffer.from(output));child.emit('close',code)});
  return child;
 };
}
test('bounded process hides Windows and reports exit/output/timeout', async()=>{
 const capture:any={}; const result=await runBounded('node',['test'],'C:/',100,fakeSpawn(0,'ok',capture));
 assert.equal(result,'ok'); assert.equal(capture.options.shell,false); assert.equal(capture.options.windowsHide,true);
 await assert.rejects(runBounded('node',[],'C:/',100,fakeSpawn(2,'bad',{})),/exited 2/);
 const timeout:any={}; await assert.rejects(runBounded('node',[],'C:/',10,fakeSpawn(-1,'',timeout)),/timed out/); assert.equal(timeout.killed,true);
 const excess:any={}; await assert.rejects(runBounded('node',[],'C:/',100,fakeSpawn(0,'x'.repeat(300000),excess)),/output limit/); assert.equal(excess.killed,true);
});
test('graph resolves candidate Git root, never initializes and rejects output junction escape',()=>{
 const temp=mkdtempSync(join(tmpdir(),'pi-refresh-test-'));const candidate=join(temp,'candidate'),other=join(temp,'other');
 try{
  mkdirSync(join(candidate,'nested'),{recursive:true});mkdirSync(join(candidate,'.git'));mkdirSync(other);
  assert.equal(candidateRoot(join(candidate,'nested')),candidate);
  assert.throws(()=>graphTarget(candidate),/no existing/);assert.equal(existsSync(join(candidate,'graphify-out')),false);
  mkdirSync(join(other,'graphify-out'));writeFileSync(join(other,'graphify-out','graph.json'),'{}');
  symlinkSync(join(other,'graphify-out'),join(candidate,'graphify-out'),'junction');
  assert.throws(()=>graphTarget(candidate),/outside/);
  assert.equal(graphTarget(candidate,other),other);
 }finally{rmSync(temp,{recursive:true,force:true})}
});
test('Serena forwarding requires registered command and never requests a plain model turn',async()=>{
 let handler:any;const messages:any[]=[];const notices:any[]=[];let available=false;
 refresh({registerCommand:(_name:any,options:any)=>handler=options.handler,getCommands:()=>available?[{name:'serena-restart'}]:[],sendUserMessage:(...args:any[])=>messages.push(args)} as any);
 const ctx={cwd:process.cwd(),ui:{notify:(...args:any[])=>notices.push(args)}};
 await handler('serena',ctx);assert.equal(messages.length,0);assert.match(notices[0][0],/not loaded/);
 available=true;await handler('serena',ctx);assert.deepEqual(messages,[['/serena-restart',{expandPromptTemplates:true}]]);
});
