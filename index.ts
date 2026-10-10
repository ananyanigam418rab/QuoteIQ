/** Optional Cloudflare Worker deployment for a Ninoo static frontend.
 * Run wrangler secret put NICRRON_API_KEY / PRISMTRACE_API_KEY / PRISMTRACE_PROJECT_ID.
 * Copy the worker URL into VITE_API_BASE_URL for a hosted integration.
 */
interface Env{NICRRON_API_KEY:string;PRISMTRACE_API_KEY?:string;PRISMTRACE_PROJECT_ID?:string;ALLOWED_ORIGIN:string;PRISMTRACE_HOST?:string}
const SYS='Extract each ordered industrial RFQ line verbatim as text, preserving material grade, dimensions, quantities, ASTM, MTR, COO and origin. Do not infer. Do not omit. Return ONLY JSON: {"lines":["original line 1", "original line 2"]}.';
export default{async fetch(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url),origin=req.headers.get('origin')||'',allowed=origin===env.ALLOWED_ORIGIN||/^http:\/\/localhost:\d+$/.test(origin);
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store',...(allowed?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})};
 const send=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:{...headers,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}});
 if(url.pathname==='/api/health'&&req.method==='GET')return send({online:true,ai:!!env.NICRRON_API_KEY,prism:!!env.PRISMTRACE_API_KEY&&!!env.PRISMTRACE_PROJECT_ID});
 if(url.pathname!=='/api/analyze'||req.method!=='POST')return send({error:'Use POST /api/analyze'},404);
 if(origin&&!allowed)return send({error:'Origin not allowed'},403);
 if(Number(req.headers.get('content-length')||'0')>22000)return send({error:'Too large'},413);
 let input:unknown;try{input=await req.json()}catch{return send({error:'Invalid JSON'},400)}
 const data=input as{rfqId?:string;text?:string};if(typeof data?.text!=='string'||data.text.length<5||data.text.length>15000)return send({error:'text must be 5–15000 characters'},400);
 if(!env.NICRRON_API_KEY)return send({error:'Nicrron API key not configured'},503);
 const begin=Date.now();let raw='';let lines:string[]=[];let model='nicrron/auto';
 try{const response=await fetch('https://api.nicrron.ai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${env.NICRRON_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:SYS},{role:'user',content:data.text}],temperature:0,max_tokens:2400}),signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error(`Nicrron ${response.status}: ${(await response.text()).slice(0,180)}`);const json=await response.json() as{choices?:{message?:{content?:string}}[];model?:string};raw=json.choices?.[0]?.message?.content||'';model=json.model||model;const parsed=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))as{lines?:unknown[]};lines=(parsed.lines||[]).filter((x):x is string=>typeof x==='string'&&x.length<550).slice(0,80);if(!lines.length)throw Error('Empty line array')}catch(err){return send({error:String(err)},502)}
 let traceStatus='not-configured';if(env.PRISMTRACE_API_KEY&&env.PRISMTRACE_PROJECT_ID){try{const r=await fetch((env.PRISMTRACE_HOST||'https://prism.blockconvey.com')+'/api/traces',{method:'POST',headers:{'Content-Type':'application/json','X-PRISMtrace-Key':env.PRISMTRACE_API_KEY},body:JSON.stringify({project_id:env.PRISMTRACE_PROJECT_ID,model,input_messages:[{role:'user',content:data.text}],output_message:raw,latency_ms:Date.now()-begin,session_id:typeof data.rfqId==='string'?data.rfqId:'rfq-session',agent_id:'rudco-quoteiq',agent_name:'QuoteIQ RFQ Extraction',metadata:{workflow:'rfq-to-quote',line_count:lines.length}}),signal:AbortSignal.timeout(8000)});traceStatus=r.ok?'sent':'failed'}catch{traceStatus='failed'}}
 return send({lines,model,traceStatus,latencyMs:Date.now()-begin});}};
