/** Secure optional API. Node 20+. No third-party server deps required. */
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// Tiny .env loader for local demos. Ninoo production secrets must come from a server secret manager.
const envFile=resolve(root,'.env');if(existsSync(envFile))for(const line of readFileSync(envFile,'utf8').split(/\n/)){const m=line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const NICRRON='https://api.nicrron.ai/v1/chat/completions',PRISM='https://prism.blockconvey.com/api/traces';
const allowed=(process.env.ALLOWED_ORIGIN||'http://localhost:5173').split(',').map(s=>s.trim());
const cors=(origin)=>origin&&(allowed.includes(origin)||allowed.includes('*'))?origin:'';
function reply(res,status,obj,origin){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(obj));}
const limit=22000;
const system=`Extract ordered RFQ product lines as an array of ORIGINAL text fragments, preserving explicit material grades, dimensions, ASTM numbers, quantities, gauge, required certifications, and country of origin. No inference or guessing. Do not omit lines. Remove email salutations and headers. Return ONLY JSON {"lines":["original line one","original line two"]}. Prefer exact copying of each line. No preamble.`;
const server=createServer(async(req,res)=>{
 const origin=cors(req.headers.origin);if(req.method==='OPTIONS'){res.writeHead(origin?204:403,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return;}
 if(req.url==='/api/health'&&req.method==='GET'){reply(res,200,{online:true,ai:Boolean(process.env.NICRRON_API_KEY),prism:Boolean(process.env.PRISMTRACE_API_KEY&&process.env.PRISMTRACE_PROJECT_ID)},origin);return;}
 if(req.url!=='/api/analyze'||req.method!=='POST'){reply(res,404,{error:'Route not found. Use POST /api/analyze.'},origin);return;}
 if(req.headers.origin&&!origin){reply(res,403,{error:'Origin not allowed.'},origin);return;}
 let text='';for await(const part of req){text+=part.toString('utf8');if(text.length>limit){reply(res,413,{error:'Request too large'},origin);return;}}
 let input;try{input=JSON.parse(text);}catch{reply(res,400,{error:'Invalid JSON'},origin);return;}
 if(typeof input.text!=='string'||input.text.trim().length<5||input.text.length>15000){reply(res,400,{error:'text must be 5–15000 characters.'},origin);return;}
 if(!process.env.NICRRON_API_KEY){reply(res,503,{error:'NICRRON_API_KEY not configured. Offline safety engine remains available.'},origin);return;}
 const begin=Date.now();let raw='';let lines=[];let model='nicrron/auto';
 try{
  const gateway=await fetch(NICRRON,{method:'POST',headers:{'Authorization':`Bearer ${process.env.NICRRON_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:input.text}],temperature:0,max_tokens:2400}),signal:AbortSignal.timeout(12000)});
  if(!gateway.ok){const err=(await gateway.text()).slice(0,260);throw Error(`Nicrron HTTP ${gateway.status}: ${err}`);}
  const payload=await gateway.json();raw=String(payload.choices?.[0]?.message?.content??'');model=payload.model||model;
  const cleaned=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();const parsed=JSON.parse(cleaned);
  if(!Array.isArray(parsed.lines))throw Error('AI did not return a lines array');
  lines=parsed.lines.filter(x=>typeof x==='string'&&x.length<550).slice(0,80);
  if(lines.length===0)throw Error('AI returned no line items');
 }catch(e){reply(res,502,{error:e instanceof Error?e.message:'AI request failed'},origin);return;}
 let traceStatus='not-configured';
 if(process.env.PRISMTRACE_API_KEY&&process.env.PRISMTRACE_PROJECT_ID){
  try{const t=await fetch(PRISM,{method:'POST',headers:{'Content-Type':'application/json','X-PRISMtrace-Key':process.env.PRISMTRACE_API_KEY},body:JSON.stringify({project_id:process.env.PRISMTRACE_PROJECT_ID,model,input_messages:[{role:'user',content:input.text}],output_message:raw,latency_ms:Date.now()-begin,session_id:typeof input.rfqId==='string'&&input.rfqId.length<128?input.rfqId:'rfq-session',agent_id:'rudco-quoteiq',agent_name:'QuoteIQ RFQ Extraction',metadata:{workflow:'rfq-to-quote',line_count:lines.length,uncertainty_policy:'never guess specs'}}),signal:AbortSignal.timeout(8000)});traceStatus=t.ok?'sent':'failed';if(!t.ok)console.error('PRISM trace failed',t.status,(await t.text()).slice(0,200));}catch(e){traceStatus='failed';console.error('PRISM unavailable',e instanceof Error?e.message:e);}
 }
 reply(res,200,{lines,model,traceStatus,latencyMs:Date.now()-begin},origin);
});
server.listen(Number(process.env.PORT||8787),'0.0.0.0',()=>console.log(`QuoteIQ optional AI backend on port ${process.env.PORT||8787}. Nicrron: ${!!process.env.NICRRON_API_KEY}; PRISM: ${!!process.env.PRISMTRACE_API_KEY}`));
