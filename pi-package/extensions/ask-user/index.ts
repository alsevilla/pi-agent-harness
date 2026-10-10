import {Type} from 'typebox';
import type {ExtensionAPI} from '@earendil-works/pi-coding-agent';
import {createAskUser} from './core.ts';
const option=Type.Union([Type.String({minLength:1}),Type.Object({title:Type.String({minLength:1}),description:Type.Optional(Type.String())})]);
const fields={context:Type.Optional(Type.String()),options:Type.Optional(Type.Array(option,{maxItems:30})),allowFreeform:Type.Optional(Type.Boolean()),allowMultiple:Type.Optional(Type.Boolean()),allowComment:Type.Optional(Type.Boolean())};
export default function askUser(pi:ExtensionAPI){
 const ask=createAskUser();
 pi.registerTool({
  name:'ask_user',label:'Ask user',executionMode:'sequential',
  description:'Ask for a material missing decision using native dialogs. Supply question or 1–4 questions. Other/freeform defaults on. Multi-select requires explicit Done. Cancelled, timed out or incomplete requests never establish approval.',
  parameters:Type.Object({...fields,question:Type.Optional(Type.String({minLength:1})),questions:Type.Optional(Type.Array(Type.Object({...fields,question:Type.String({minLength:1})}),{minItems:1,maxItems:4})),timeout:Type.Optional(Type.Number({exclusiveMinimum:0,description:'Whole-request deadline in milliseconds.'}))},{additionalProperties:false}),
  async execute(_id,params,signal,_update,ctx){
   const details=await ask(params,ctx,signal);
   return {content:[{type:'text',text:JSON.stringify(details)}],details};
  },
 });
}
