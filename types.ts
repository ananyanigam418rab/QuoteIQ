export type Material = 'Stainless Steel'|'Carbon Steel'|'Aluminum';
export type Form = 'Sheet'|'Plate'|'Pipe'|'Bar';
export type Status = 'ready'|'review'|'clarify'|'unmatched';
export type CatalogItem={sku:string;material:Material;grade:string;form:Form;thicknessIn?:number;widthIn?:number;lengthIn?:number;diameterIn?:number;schedule?:string;astm:string;price:number;benchmarkMin:number;benchmarkMax:number;stock:number;origin:string;mtrAvailable:boolean;cooAvailable:boolean;source:'sample'|'uploaded'};
export type Spec={material?:Material;grade?:string;form?:Form;thicknessIn?:number;widthIn?:number;lengthIn?:number;diameterIn?:number;schedule?:string;quantity?:number;unit:'pcs'|'ft';astm?:string;requireMtr:boolean;requireCoo:boolean;requireDomestic:boolean};
export type ItemResult={id:string;raw:string;spec:Spec;status:Status;confidence:number;matched?:CatalogItem;alternatives:CatalogItem[];questions:string[];warnings:string[];evidence:string[];pricing?:{list:number;discountRate:number;unit:number;total:number;benchmarkMin:number;benchmarkMax:number;positionPct:number;isIllustrative:boolean};approved:boolean};
export type Result={id:string;lines:ItemResult[];source:string;createdAt:string;engine:'rules'|'ai-assisted';telemetry:'sent'|'not-configured'|'failed';apiMessage?:string};
