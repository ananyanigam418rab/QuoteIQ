import{jsPDF}from'jspdf';
import type{ItemResult,Result}from'./types';import{buyerEmail,formatSpec,summarize}from'./engine';
const money=(n:number)=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const download=(content:Blob,name:string)=>{const url=URL.createObjectURL(content);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const csvCell=(value:unknown)=>'"'+String(value??'').replace(/"/g,'""')+'"';
export function exportCsv(lines:ItemResult[]){const headers=['Source line','Status','Approved','SKU','Material','Grade','Form','ASTM','Quantity','Unit price USD','Total USD','Benchmark min USD','Benchmark max USD','Stock','Origin','Compliance','Uncertainties'];const body=lines.map(i=>[i.raw,i.status,i.approved?'yes':'no',i.matched?.sku,i.spec.material,i.spec.grade,i.spec.form,i.spec.astm,i.spec.quantity,i.pricing?.unit,i.pricing?.total,i.pricing?.benchmarkMin,i.pricing?.benchmarkMax,i.matched?.stock,i.matched?.origin,[i.spec.requireMtr&&'MTR',i.spec.requireCoo&&'COO',i.spec.requireDomestic&&'Domestic'].filter(Boolean).join(';'),[...i.questions,...i.warnings].join(' | ')]);const csv=[headers,...body].map(row=>row.map(csvCell).join(',')).join('\r\n');download(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),'QuoteIQ-quote-lines.csv');}
export function exportJson(r:Result){download(new Blob([JSON.stringify({...r,disclosure:'Seeded prices and market ranges are illustrative; supplier documents and origins must be verified.'},null,2)],{type:'application/json'}),`QuoteIQ-audit-${r.id.slice(0,8)}.json`);}
export function exportQuestions(lines:ItemResult[]){download(new Blob([buyerEmail(lines)],{type:'text/plain'}),'QuoteIQ-buyer-clarifications.txt');}
export function exportPdf(r:Result){
 const doc=new jsPDF({unit:'pt',format:'a4'}),W=595,H=842,margin=48;let y=52;
 const draw=(str:string,size=10,bold=false,color:[number,number,number]=[33,43,61],maxW=W-2*margin)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);const lines=doc.splitTextToSize(str,maxW) as string[];if(y+lines.length*(size*1.45)>H-58){doc.addPage();y=55;}doc.text(lines,margin,y);y+=lines.length*(size*1.45)+9;};
 const accepted=r.lines.filter(i=>i.pricing&&(i.status==='ready'||i.approved));
 doc.setFillColor(15,30,47);doc.rect(0,0,W,113,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(24);doc.text('RUDCO  /  QUOTEIQ',margin,54);doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Draft quotation • generated from RFQ evidence',margin,75);doc.text(new Date(r.createdAt).toLocaleString(),margin,94);y=145;
 draw(`Quote reference: ${r.id.slice(0,8).toUpperCase()}     |     ${accepted.length} approved line(s)`,11,true);
 draw('Only clearly matched or manually approved lines appear here. This is a DRAFT — verify inventory, standards, market pricing, origin and certifications before sending.',10,false,[154,75,30]);
 y+=4;doc.setDrawColor(220,226,233);doc.line(margin,y,W-margin,y);y+=22;
 if(!accepted.length)draw('No line items are cleared for the draft quote. Resolve uncertainties in the app first.',12,true);
 for(let i=0;i<accepted.length;i++){
  const item=accepted[i];draw(`${i+1}.  ${item.matched!.sku}   •   ${money(item.pricing!.unit)} / unit   •   ${item.spec.quantity} units   •   ${money(item.pricing!.total)}`,11,true);
  draw(formatSpec(item.spec),9,false,[62,83,105]);
  draw(`Reference benchmark: ${money(item.pricing!.benchmarkMin)}–${money(item.pricing!.benchmarkMax)} / unit (${item.pricing!.isIllustrative?'DEMO — illustrative, NOT live':'uploaded, NOT independently verified'})`,9);
  if(item.spec.requireMtr||item.spec.requireCoo||item.spec.requireDomestic)draw(`Required documents/origin: ${[item.spec.requireMtr&&'MTR',item.spec.requireCoo&&'COO',item.spec.requireDomestic&&'US origin'].filter(Boolean).join(', ')}. Documentation must be independently confirmed.`,9);
  y+=10;
 }
 const total=summarize(r.lines).total;y+=5;doc.setDrawColor(220,226,233);doc.line(margin,y,W-margin,y);y+=26;draw(`ESTIMATED SUBTOTAL     ${money(total)}`,16,true,[20,93,105]);
 draw('Excludes freight, taxes, duties and any delivery lead time. Pricing valid only after supplier confirmation.',9,false,[100,110,122]);
 if(r.lines.some(i=>i.status==='clarify'||i.status==='unmatched'||(i.status==='review'&&!i.approved))){y+=10;draw('ITEMS HELD — BUYER CLARIFICATION / REVIEW',11,true,[154,75,30]);for(const i of r.lines.filter(i=>i.status==='clarify'||i.status==='unmatched'||(i.status==='review'&&!i.approved))){draw(`• ${i.raw}`,9,true);for(const q of i.questions.slice(0,3))draw(`   - ${q}`,9);if(!i.questions.length)draw('   - Human approval and document confirmation required.',9);}}
 const count=doc.getNumberOfPages();for(let p=1;p<=count;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(130,140,151);doc.text(`QuoteIQ  |  Draft only — not a supplier commitment                                       Page ${p} / ${count}`,margin,H-26);}
 doc.save(`QuoteIQ-draft-${r.id.slice(0,8)}.pdf`);
}
