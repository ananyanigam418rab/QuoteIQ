import * as XLSX from 'xlsx';
import type {CatalogItem,Material,Form} from './types';
const toNum=(x:unknown):number=>Number(String(x??'').replace(/[$,]/g,''));
const truthy=(x:unknown)=>['yes','true','1','available','y'].includes(String(x??'').toLowerCase().trim());
const str=(x:unknown)=>String(x??'').trim();
function sheetRows(bytes:ArrayBuffer){const wb=XLSX.read(bytes,{type:'array'});if(!wb.SheetNames.length)throw Error('Spreadsheet contains no sheets.');return XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:''});}
export async function readRfqFile(file:File):Promise<string>{
 if(file.size>12_000_000)throw Error('File is over the 12 MB limit.');
 const name=file.name.toLowerCase();
 if(/\.(txt|eml|csv)$/i.test(name)){
  const txt=await file.text();
  if(name.endsWith('.csv')){const wb=XLSX.read(txt,{type:'string'});const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:''});return rows.map((row,i)=>`${i+1}. ${Object.values(row).filter(Boolean).join(' — ')}`).join('\n');}
  return txt;
 }
 if(/\.(xlsx|xls)$/i.test(name)){
  const rows=sheetRows(await file.arrayBuffer());return rows.map((row,i)=>`${i+1}. ${Object.entries(row).filter(([,v])=>String(v).trim()).map(([k,v])=>`${k}: ${v}`).join(' | ')}`).join('\n');
 }
 if(name.endsWith('.pdf')){
  const pdfjs=await import('pdfjs-dist');
  const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  let txt='';for(let i=1;i<=Math.min(doc.numPages,25);i++){const page=await doc.getPage(i);const content=await page.getTextContent();let lastY:number|undefined;for(const item of content.items){if(!('str'in item))continue;const y=('transform'in item&&Array.isArray(item.transform)?item.transform[5]:undefined) as number|undefined;if(lastY!==undefined&&y!==undefined&&Math.abs(y-lastY)>4)txt+='\n';txt+=item.str+' ';lastY=y;}txt+='\n';}
  if(txt.trim().length<15)throw Error('This PDF appears scanned or image-only. Please paste OCR text; the app does not silently guess its contents.');
  return txt;
 }
 throw Error('Unsupported file. Use PDF, XLSX, XLS, CSV, EML or TXT.');
}
export async function readCatalog(file:File):Promise<CatalogItem[]>{
 if(file.size>6_000_000)throw Error('Catalog must be smaller than 6 MB.');
 const ext=file.name.toLowerCase();if(!/\.(xlsx|xls|csv)$/i.test(ext))throw Error('Use CSV or XLSX catalog.');
 let rows:Record<string,unknown>[];
 if(ext.endsWith('.csv')){const wb=XLSX.read(await file.text(),{type:'string'});rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:''});}
 else rows=sheetRows(await file.arrayBuffer());
 const out:CatalogItem[]=[];
 for(const [idx,input]of rows.entries()){
  const r:Record<string,unknown>={};for(const[k,v]of Object.entries(input))r[k.toLowerCase().trim().replace(/[^a-z0-9]+/g,'_')]=v;
  const g=(...keys:string[])=>keys.map(k=>r[k]).find(v=>v!==undefined&&str(v)!=='');
  const materialRaw=str(g('material','metal')).toLowerCase();
  const material:Material|undefined=materialRaw.includes('stainless')?'Stainless Steel':materialRaw.includes('alum')?'Aluminum':materialRaw.includes('carbon')||materialRaw.includes('mild')||materialRaw.includes('steel')?'Carbon Steel':undefined;
  const formRaw=str(g('form','shape','product')).toLowerCase();const form:Form|undefined=formRaw.includes('pipe')?'Pipe':formRaw.includes('plate')?'Plate':formRaw.includes('bar')?'Bar':formRaw.includes('sheet')?'Sheet':undefined;
  const price=toNum(g('price','unit_price','catalog_price'));
  const min=toNum(g('benchmark_min','market_min','market_low'));
  const max=toNum(g('benchmark_max','market_max','market_high'));
  const sku=str(g('sku','item','product_id'));
  const grade=str(g('grade','alloy')).toUpperCase();
  if(!sku||!grade||!material||!form||!Number.isFinite(price)||price<=0)continue;
  const f=(...names:string[])=>{const v=g(...names);if(v===undefined)return undefined;const n=toNum(v);return Number.isFinite(n)?n:undefined;};
  const standard=str(g('astm','standard')).toUpperCase();
  if(!/^(?:ASTM\s*)?[AB]\s*\d{2,4}/.test(standard))continue;
  out.push({sku,material,grade,form,thicknessIn:f('thickness_in','thickness'),widthIn:f('width_in','width'),lengthIn:f('length_in','length'),diameterIn:f('diameter_in','diameter','nominal_diameter'),schedule:str(g('schedule','sch'))||undefined,astm:standard.startsWith('ASTM')?standard.replace(/^ASTM\s*/,'ASTM '):`ASTM ${standard}`,price,benchmarkMin:Number.isFinite(min)&&min>0?min:price*.95,benchmarkMax:Number.isFinite(max)&&max>0?max:price*1.18,stock:f('stock','inventory','available')??0,origin:str(g('origin','country_of_origin'))||'Unknown',mtrAvailable:truthy(g('mtr','mtr_available')),cooAvailable:truthy(g('coo','coo_available')),source:'uploaded'});
  if(out.length>=1000)break;
  if(idx>1000)break;
 }
 if(!out.length)throw Error('No valid rows. Required catalog columns: SKU, Material, Grade, Form, Price, ASTM, dimensions.');
 return out;
}
