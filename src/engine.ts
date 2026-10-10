import type { CatalogItem, ItemResult, Material, Form, Spec } from './types';

const fix=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const readNum=(s:string):number=>{const x=s.trim().replace(/["']/g,''); if(x.includes('/')) {const [a,b]=x.split('/').map(Number);return b?a/b:NaN;}return Number(x);};
const num='(\\d+(?:\\.\\d+)?|\\.\\d+|\\d+\\/\\d+)';
const round4=(n:number)=>Math.round(n*10000)/10000;
const makeId=()=>typeof crypto!=='undefined'&&'randomUUID'in crypto?crypto.randomUUID():`id-${Math.random().toString(36).slice(2)}`;
const isItemLine=(s:string)=>/\b(ss|stainless|steel|alum(?:inum)?|a36|6061|316l?|304|sheet|plate|pipe)\b/i.test(s)&&(/\d/.test(s)||/\bpipe\b/i.test(s));
export function splitRfq(input:string):string[]{
 const out:string[]=[];
 for(const row of input.replace(/\r/g,'').split(/\n/)){
  const line=row.trim().replace(/^[-•*]\s*/, '').replace(/^\d{1,3}[.):\-]\s*/,'').trim();
  if(!line||!isItemLine(line))continue;
  // Avoid section headings that happen to mention "steel".
  if(line.length>550)continue;
  out.push(line);
 }
 return out.slice(0,80);
}
export function parseSpec(raw:string):Spec{
 const s=raw.toLowerCase().replace(/[×]/g,'x').replace(/[–—]/g,'-');
 const spec:Spec={unit:'pcs',requireMtr:/\b(mtr|mill\s*test\s*report|mill\s*cert(?:ificate)?s?)\b/i.test(s),requireCoo:/\b(coo|country\s+of\s+origin|origin\s+certificate)\b/i.test(s),requireDomestic:/\b(domestic|us(?:a)?\s*(?:origin|only|made)|american\s*(?:made|origin)|made\s+in\s+usa)\b/i.test(s)};
 if(/\b(aluminum|aluminium|alum\.?|al\s*6061|6061(?:-t6)?)\b/.test(s))spec.material='Aluminum';
 else if(/\b(a36|carbon steel|mild steel|hot[ -]?rolled|\bhr\s+plate)\b/.test(s))spec.material='Carbon Steel';
 else if(/\b(stainless|ss\s*\d|\bss\b|316l?|304)\b/.test(s))spec.material='Stainless Steel';
 if(/\b6061\s*[- ]?\s*t6\b/.test(s))spec.grade='6061-T6';
 else if(/\ba36\b/.test(s))spec.grade='A36';
 else if(/\b316\s*l\b/.test(s))spec.grade='316L';
 else if(/\b316\b/.test(s))spec.grade='316';
 else if(/\b304\b/.test(s))spec.grade='304';
 else if(/\b6061\b/.test(s))spec.grade='6061';
 if(/\bpipe|tubing|tube\b/.test(s))spec.form='Pipe';
 else if(/\bplate\b/.test(s))spec.form='Plate';
 else if(/\bsheet\b/.test(s))spec.form='Sheet';
 else if(/\bbar|rod\b/.test(s))spec.form='Bar';
 const std=s.match(/\bastm\s*[-:]?\s*([ab]\s*\d{2,4}(?:\s*\/\s*[ab]?\d{2,4})?)\b/i);
 if(std)spec.astm='ASTM '+std[1].toUpperCase().replace(/\s+/g,'').replace(/\//g,'/');
 const qty=s.match(/\b(?:qty|quantity|qnty|need|require|order)\s*[:#=\-]?\s*(\d+(?:\.\d+)?)\b/i)
  ??s.match(/\b(\d+)\s*(?:pcs|pieces|sheets|plates|lengths|ea|each|units)\b/i)
  ??s.match(/^\s*(\d+)\s*(?:x|pcs|ea)\s+/i);
 if(qty)spec.quantity=Number(qty[1]);
 // Wall/sheet gauge is explicitly interpreted using stainless-sheet gauge reference.
 const gauge=s.match(/\b(\d{1,2})\s*(?:ga|gauge)\b/i);
 const gaugeMap:Record<string,number>={'10':0.1406,'11':0.125,'12':0.1094,'14':0.0781,'16':0.0625,'18':0.05,'20':0.0375,'22':0.0313,'24':0.025};
 if(gauge&&gaugeMap[gauge[1]])spec.thicknessIn=gaugeMap[gauge[1]];
 if(spec.form==='Pipe'){
  const pipe=s.match(new RegExp('\\b'+num+'\\s*(?:"|in(?:ch(?:es)?)?)?\\s*(?:nominal\\s*)?(?:dia(?:meter)?|od)?\\s*(?:sch(?:edule)?\\s*\\d+|x\\s*\\d+\\s*(?:ft|feet|\u0027)|\\s+pipe)', 'i'));
  const diameterFirst=s.match(new RegExp('\\b'+num+'\\s*(?:"|inch|in)\\s*(?:(?:sch(?:edule)?)|(?:pipe))','i'));
  const diameterAfter=s.match(new RegExp('(?:pipe|tube)\\s*'+num+'\\s*(?:"|in(?:ch(?:es)?)?)','i'));
  const d=diameterFirst?.[1]??diameterAfter?.[1]??pipe?.[1];
  if(d)spec.diameterIn=readNum(d);
  const sch=s.match(/\bsch(?:edule)?\s*[-#:]?\s*(\d+|std|xs|xxs)\b/i);if(sch)spec.schedule=sch[1].toUpperCase();
  const len=s.match(/(?:x|length\s*[:=]?)\s*(\d+(?:\.\d+)?)\s*(ft|feet|\u0027|inches|inch|in|\")/i);
  if(len)spec.lengthIn=Number(len[1])*(len[2].startsWith('f')||len[2]==="'"?12:1);
  else {const l=s.match(/\b(\d+)\s*(?:ft|feet)\b/);if(l)spec.lengthIn=Number(l[1])*12;}
 }else{
  const triple=s.match(new RegExp('(?<![a-z0-9])'+num+'\\s*(?:"|in(?:ch(?:es)?)?)?\\s*x\\s*'+num+'\\s*(?:"|in(?:ch(?:es)?)?)?\\s*x\\s*'+num+'(?=\\s*(?:"|in|ft|feet|[,;\\s]|$))','i'));
  if(triple){spec.thicknessIn=readNum(triple[1]);spec.widthIn=readNum(triple[2]);spec.lengthIn=readNum(triple[3]);}
  else {
   const explicit=s.match(new RegExp('(?<![a-z0-9])'+num+'\\s*(?:in(?:ches)?|"|thick(?:ness)?)\\s*[,;]?\\s*'+num+'\\s*x\\s*'+num+'(?=\\s|$|[,;])','i'));
   if(explicit){spec.thicknessIn=readNum(explicit[1]);spec.widthIn=readNum(explicit[2]);spec.lengthIn=readNum(explicit[3]);}
   else{
    const thick=s.match(new RegExp('(?:thk|thick(?:ness)?|gage)\\s*[:=]?\\s*'+num+'\\s*(?:"|in)?\\b','i'));
    if(thick)spec.thicknessIn=readNum(thick[1]);
    const pair=s.match(/\b(\d+(?:\.\d+)?)\s*(?:"|in(?:ches)?)?\s*x\s*(\d+(?:\.\d+)?)(?:\s*(ft|feet|\u0027|in|inches|"))?(?=\s|[,;]|$)/i);
    if(pair){const a=Number(pair[1]),b=Number(pair[2]);const ft=pair[3]==='ft'||pair[3]==='feet'||pair[3]==="'"||(a===4&&b===8);spec.widthIn=a*(ft?12:1);spec.lengthIn=b*(ft?12:1);}
   }
  }
 }
 for(const key of ['thicknessIn','widthIn','lengthIn','diameterIn'] as const){if(spec[key]!==undefined)spec[key]=round4(spec[key]!);}
 return spec;
}
function almost(a:number|undefined,b:number|undefined,tol=.001){return a!==undefined&&b!==undefined&&Math.abs(a-b)<=tol;}
function similarity(spec:Spec,c:CatalogItem):number{
 if(spec.material!==c.material||spec.grade!==c.grade||spec.form!==c.form)return -1;
 if(spec.astm&&spec.astm!==c.astm)return -1;
 let score=35;
 const fields:(keyof Pick<Spec,'thicknessIn'|'widthIn'|'lengthIn'|'diameterIn'>)[]=spec.form==='Pipe'?['diameterIn','lengthIn']:['thicknessIn','widthIn','lengthIn'];
 for(const f of fields){const a=spec[f],b=c[f];if(a===undefined||b===undefined)continue;if(almost(a,b))score+=20;else if(Math.abs(a-b)<=.005)score+=4;else score-=50;}
 if(spec.form==='Pipe'&&spec.schedule){if(spec.schedule===c.schedule)score+=20;else score-=60;}
 if(spec.quantity&&c.stock>=spec.quantity)score+=5;
 return score;
}
const fmt=(n:number|undefined)=>n===undefined?'?':Number.isInteger(n)?String(n):String(round4(n));
export function analyzeLine(raw:string,catalog:CatalogItem[],id=makeId()):ItemResult{
 const spec=parseSpec(raw),questions:string[]=[],warnings:string[]=[],evidence:string[]=[];
 // Catalog-backed suggestion of omitted product form is never treated as certain.
 if(!spec.form&&spec.material&&spec.grade&&spec.thicknessIn&&spec.widthIn&&spec.lengthIn){
  const shapeCandidates=catalog.filter(c=>c.material===spec.material&&c.grade===spec.grade&&almost(c.thicknessIn,spec.thicknessIn)&&almost(c.widthIn,spec.widthIn)&&almost(c.lengthIn,spec.lengthIn));
  const shapes=new Set(shapeCandidates.map(c=>c.form));
  if(shapes.size===1){spec.form=shapeCandidates[0].form;warnings.push(`Product form ${spec.form.toLowerCase()} inferred from matching catalog dimensions; buyer must confirm.`);}
 }
 if(!spec.material)questions.push('What material family is required (stainless, carbon steel, or aluminum)?');
 if(!spec.grade)questions.push('Which material grade is required (for example 304 or 316L)?');
 if(!spec.form)questions.push('Is the material a sheet, plate, pipe, or bar?');
 if(!spec.quantity||spec.quantity<=0||!Number.isInteger(spec.quantity))questions.push('How many pieces or lengths should we quote?');
 if(spec.form==='Pipe'){
  if(!spec.diameterIn)questions.push('What nominal pipe diameter (inches) is required?');
  if(!spec.schedule)questions.push('What pipe schedule or wall thickness is required?');
  if(!spec.lengthIn)questions.push('What pipe length is required?');
 }else if(spec.form==='Sheet'||spec.form==='Plate'||spec.form==='Bar'){
  if(!spec.thicknessIn)questions.push('What material thickness or gauge is required?');
  if(!spec.widthIn||!spec.lengthIn)questions.push('What are the width and length, with units?');
 }
 const alternatives=catalog.filter(c=>c.material===spec.material&&c.form===spec.form&&(c.grade===spec.grade||!spec.grade)).sort((a,b)=>similarity(spec,b)-similarity(spec,a)).slice(0,3);
 const eligible=catalog.map(c=>({c,score:similarity(spec,c)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score);
 const best=eligible[0];
 let matched:CatalogItem|undefined;
 if(best&&best.score>=70)matched=best.c;
 if(matched){
  const dimFields:(keyof Pick<Spec,'thicknessIn'|'widthIn'|'lengthIn'|'diameterIn'>)[]=spec.form==='Pipe'?['diameterIn','lengthIn']:['thicknessIn','widthIn','lengthIn'];
  for(const f of dimFields)if(spec[f]!==undefined&&!almost(spec[f],matched[f]))questions.push(`${f.replace('In','')} ${fmt(spec[f])}\" differs from catalog ${fmt(matched[f])}\". Is substitution approved?`);
  if(spec.form==='Pipe'&&spec.schedule!==matched.schedule)questions.push(`Confirm pipe schedule ${spec.schedule||'unspecified'} versus catalog ${matched.schedule||'unspecified'}.`);
  if(!spec.astm){spec.astm=matched.astm;warnings.push(`${matched.astm} proposed from the catalog; buyer did not specify a standard.`);}
  evidence.push(`Catalog match ${matched.sku}: ${matched.material} ${matched.grade} ${matched.form.toLowerCase()} with compared dimensions.`);
  if(spec.astm===matched.astm)evidence.push(`Standard: ${matched.astm} (catalog listing; physical certification still requires verification).`);
  if(spec.quantity&&matched.stock<spec.quantity)warnings.push(`Insufficient catalog stock: ${matched.stock} available vs ${spec.quantity} requested.`);
  if(spec.requireMtr){if(matched.mtrAvailable)warnings.push('MTR requested: catalog says obtainable; verify document and heat/lot before shipment.');else questions.push('MTR requested but supplier has no MTR on file. Is a certified alternative acceptable?');}
  if(spec.requireCoo){if(matched.cooAvailable)warnings.push('COO requested: supplier says obtainable; verify country-of-origin document.');else questions.push('COO requested but supplier has no document on file. Is an alternative acceptable?');}
  if(spec.requireDomestic&&matched.origin.toUpperCase()!=='US')questions.push(`Domestic origin required but this supplier lists ${matched.origin}. May we source an alternative?`);
  if(spec.requireDomestic&&matched.origin.toUpperCase()==='US')evidence.push('Supplier lists US origin (declaration not independently verified).');
 }else if(questions.length===0){questions.push('No exact supplier SKU matches all dimensions, grade, form and ASTM standard. Can you approve an alternative or request sourcing?');}
 let pricing:ItemResult['pricing'];
 if(matched&&spec.quantity){
  const discountRate=spec.quantity>=50?.08:spec.quantity>=25?.05:spec.quantity>=10?.03:0;
  const unit=fix(matched.price*(1-discountRate)),total=fix(unit*spec.quantity);
  pricing={list:matched.price,discountRate,unit,total,benchmarkMin:matched.benchmarkMin,benchmarkMax:matched.benchmarkMax,positionPct:fix((unit-matched.benchmarkMin)/Math.max(.01,matched.benchmarkMax-matched.benchmarkMin)*100),isIllustrative:matched.source==='sample'};
  evidence.push(`Price = $${matched.price.toFixed(2)} list × ${(100-discountRate*100).toFixed(0)}% quantity factor = $${unit.toFixed(2)}/unit.`);
  evidence.push(`${matched.source==='sample'?'Illustrative seeded':'Buyer-uploaded'} benchmark range: $${matched.benchmarkMin.toFixed(2)}–$${matched.benchmarkMax.toFixed(2)}/unit; not independently live-verified.`);
 }
 let status:ItemResult['status']='ready';
 if(questions.length)status=questions.some(q=>/no exact supplier/i.test(q))?'unmatched':'clarify';
 else if(!matched)status='unmatched';
 else if(warnings.some(w=>/inferred|proposed|insufficient.*stock|MTR requested|COO requested/i.test(w)))status='review';
 if(!matched&&questions.length&&spec.grade===undefined)status='clarify';
 const confidence=matched&&!questions.length?Math.min(99,Math.max(64,best.score-2-(warnings.length*6))):matched?Math.min(65,best.score-40):questions.length?24:15;
 return{id,raw,spec,status,confidence,matched,alternatives:alternatives.filter(c=>c.sku!==matched?.sku),questions,warnings,evidence,pricing,approved:false};
}
export function analyzeRfq(lines:string[],catalog:CatalogItem[]):ItemResult[]{return lines.slice(0,80).map(s=>analyzeLine(s,catalog));}
export function summarize(items:ItemResult[]){const accepted=items.filter(i=>i.pricing&&(i.status==='ready'||i.approved));return{total:fix(accepted.reduce((a,b)=>a+(b.pricing?.total||0),0)),count:accepted.length,ambiguous:items.filter(i=>i.status==='clarify'||i.status==='unmatched').length,review:items.filter(i=>i.status==='review'&&!i.approved).length};}
export function formatSpec(s:Spec){return [s.material,s.grade,s.form,s.form==='Pipe'?`${fmt(s.diameterIn)}\" ø · Sch ${s.schedule||'?'} · ${fmt(s.lengthIn)}\"`:`${fmt(s.thicknessIn)}\" × ${fmt(s.widthIn)}\" × ${fmt(s.lengthIn)}\"`,s.astm||'ASTM unspecified'].filter(Boolean).join(' / ');}
export function buyerEmail(lines:ItemResult[]){const pending=lines.filter(x=>(x.status==='clarify'||x.status==='unmatched'||(x.status==='review'&&!x.approved)));return `Subject: Clarifications requested for your RFQ\n\nHello,\n\nThank you for your request. Before we can provide a firm quote for the following items, could you clarify:\n\n${pending.map((x,i)=>`${i+1}. ${x.raw}\n${x.questions.length?x.questions.map(q=>'   • '+q).join('\n'):'   • Please confirm the proposed specification and documentation availability before release.'}`).join('\n\n')}\n\nWe will complete the remaining quotation once these details are confirmed.\n\nBest regards,\nRudCo Sales`}

/** AI output is advisory only. Every interpreted field must remain identical to
 * what the local parser observed in the matching original line. */
export function verifyAiExtraction(originalLines:string[],aiLines:string[]):boolean{
 if(originalLines.length!==aiLines.length||!originalLines.length)return false;
 const fields:(keyof Spec)[]=['material','grade','form','thicknessIn','widthIn','lengthIn','diameterIn','schedule','quantity','unit','astm','requireMtr','requireCoo','requireDomestic'];
 return originalLines.every((original,i)=>{
  if(splitRfq(aiLines[i]).length!==1)return false;
  const before=parseSpec(original),after=parseSpec(aiLines[i]);
  return fields.every(key=>{
   const a=before[key],b=after[key];
   if(typeof a==='number'||typeof b==='number')return typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=0.0001;
   return a===b;
  });
 });
}
