export type Choice = string | {title:string; description?:string};
export type Question = {question:string; context?:string; options?:Choice[]; allowFreeform?:boolean; allowMultiple?:boolean; allowComment?:boolean};
export type Params = Question & {questions?:Question[]; timeout?:number};
export type NativeUI = {select:(title:string,options:string[],opts?:{signal?:AbortSignal;timeout?:number})=>Promise<string|undefined>;input:(title:string,placeholder?:string,opts?:{signal?:AbortSignal;timeout?:number})=>Promise<string|undefined>};
export type Answer = {question:string; response:string|string[]; comment?:string};
export function createAskUser(){
 let active=false;
 return async function ask(raw:unknown,ctx:{hasUI:boolean;ui:NativeUI},signal?:AbortSignal){
  const answers:Answer[]=[];
  const result=(reason?:string)=>({cancelled:!!reason,...(reason?{reason}:{}),answers,response:!reason&&answers.length===1?answers[0].response:null});
  let questions:Question[],params:Params;
  try{
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error();params=raw as Params;
   if(params.timeout!==undefined&&(!Number.isFinite(params.timeout)||params.timeout<=0))throw Error();
   if(params.questions!==undefined){if(params.question!==undefined||!Array.isArray(params.questions)||params.questions.length<1||params.questions.length>4)throw Error();questions=params.questions.map(q=>({...q,context:q.context??params.context,allowComment:q.allowComment??params.allowComment}));}
   else questions=[params];
   for(const q of questions){
    if(!q||typeof q.question!=='string'||!q.question.trim()||(q.context!==undefined&&typeof q.context!=='string'))throw Error();
    for(const key of ['allowFreeform','allowMultiple','allowComment'] as const)if(q[key]!==undefined&&typeof q[key]!=='boolean')throw Error();
    if(q.options!==undefined&&(!Array.isArray(q.options)||q.options.length>30))throw Error();
    for(const o of q.options??[])if(typeof o==='string'?!o.trim():!o||typeof o.title!=='string'||!o.title.trim()||(o.description!==undefined&&typeof o.description!=='string'))throw Error();
    if(!q.options?.length&&q.allowFreeform===false)throw Error();
   }
  }catch{return result('invalid_arguments');}
  if(signal?.aborted)return result('aborted');
  if(!ctx.hasUI)return result('no_ui');
  if(active)return result('busy');
  active=true;
  const controller=new AbortController();let reason:string|undefined;
  const abort=()=>{reason='aborted';controller.abort();};signal?.addEventListener('abort',abort,{once:true});
  const deadline=params!.timeout===undefined?undefined:Date.now()+params!.timeout;
  const timer=params!.timeout===undefined?undefined:setTimeout(()=>{reason='timeout';controller.abort();},params!.timeout);
  async function dialog<T>(run:(opts:{signal:AbortSignal;timeout?:number})=>Promise<T>):Promise<T>{
   if(controller.signal.aborted)throw Error(reason);
   if(deadline!==undefined&&Date.now()>=deadline){reason='timeout';controller.abort();throw Error(reason);}
   let rejectAbort:(()=>void)|undefined;
   const aborted=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(Error(reason??'aborted'));controller.signal.addEventListener('abort',rejectAbort,{once:true});});
   try{const value=await Promise.race([run({signal:controller.signal,...(deadline===undefined?{}:{timeout:Math.max(1,deadline-Date.now())})}),aborted]);if(controller.signal.aborted)throw Error(reason);return value;}
   finally{if(rejectAbort)controller.signal.removeEventListener('abort',rejectAbort);}
  }
  async function input(title:string){const value=await dialog(o=>ctx.ui.input(title,undefined,o));if(value===undefined)throw Error('cancelled');if(!value.trim())throw Error('blank_input');return value.trim();}
  try{
   for(const [qi,q] of questions!.entries()){
    const title=[questions!.length>1?`Question ${qi+1}/${questions!.length}: ${q.question}`:q.question,q.context].filter(Boolean).join('\n\n');
    const choices=(q.options??[]).map((o,i)=>({value:typeof o==='string'?o.trim():o.title.trim(),label:`${i+1}. ${typeof o==='string'?o.trim():o.title.trim()}${typeof o==='string'||!o.description?'':` — ${o.description}`}`}));
    let response:string|string[];
    if(!choices.length)response=await input(title);
    else if(q.allowMultiple){
     const selected=new Set<number>();let other:string|undefined;
     for(;;){
      const rows=choices.map((o,i)=>`${selected.has(i)?'[x]':'[ ]'} ${o.label}`);
      const otherLabel=other?`Other: ${other}`:'Other (type an answer)';if(q.allowFreeform!==false)rows.push(otherLabel);
      rows.push('Done (submit selected answers)');
      const value=await dialog(o=>ctx.ui.select(title,rows,o));if(value===undefined)throw Error('cancelled');
      if(value==='Done (submit selected answers)'){if(!selected.size&&!other)throw Error('empty_selection');response=[...selected].sort((a,b)=>a-b).map(i=>choices[i].value);if(other)response.push(other);break;}
      if(value===otherLabel&&q.allowFreeform!==false){other=await input(`${title}\nOther answer`);continue;}
      const index=rows.indexOf(value);if(index<0||index>=choices.length)throw Error('invalid_response');selected.has(index)?selected.delete(index):selected.add(index);
     }
    }else{
     const rows=choices.map(o=>o.label);if(q.allowFreeform!==false)rows.push('Other (type an answer)');
     const value=await dialog(o=>ctx.ui.select(title,rows,o));if(value===undefined)throw Error('cancelled');
     if(value==='Other (type an answer)'&&q.allowFreeform!==false)response=await input(`${title}\nOther answer`);
     else{const i=rows.indexOf(value);if(i<0||i>=choices.length)throw Error('invalid_response');response=choices[i].value;}
    }
    let comment:string|undefined;
    if(q.allowComment){const value=await dialog(o=>ctx.ui.input(`${q.question}\nOptional comment (leave blank to skip)`,undefined,o));if(value===undefined)throw Error('cancelled');comment=value.trim()||undefined;}
    answers.push({question:q.question,response,...(comment?{comment}:{})});
   }
   return result();
  }catch(error){return result(reason??(error instanceof Error?error.message:'ui_error'));}
  finally{if(timer!==undefined)clearTimeout(timer);signal?.removeEventListener('abort',abort);active=false;}
 };
}
