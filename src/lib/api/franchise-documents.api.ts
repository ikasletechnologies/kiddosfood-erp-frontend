import api from './base';
export const DOCUMENT_CATEGORIES = [
  ['CATALOGUE','Catalogue'], ['BROCHURE','Brochure'], ['RENTAL_AGREEMENT','Rental Agreement'],
  ['FSSAI_CERTIFICATE','FSSAI Certificate'], ['LEGAL_AGREEMENTS','Legal Agreements'],
  ['OTHER_DOCUMENTS','Other Documents (Aadhaar, PAN, etc.)'], ['APPLICATION_FORM','Application Form'],
  ['FRANCHISE_PRICE_LIST','Franchise Price List'], ['CUSTOMER_PRICE_LIST','Customer Price List'],
] as const;
export interface FranchiseDocument {
  id:string; franchiseId:string; category:string; originalFileName:string; mimeType:string; fileSize:number;
  familyId:string; version:number; status:'ACTIVE'|'HISTORICAL'|'ARCHIVED'; visibility:'INTERNAL'|'SHARED';
  uploadedBy:string; uploadedByName:string; uploadedAt:string; updatedAt:string;
  issueDate?:string|null; expiryDate?:string|null; notes?:string|null;
}
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.xls,.xlsx';
export function validateDocumentFile(file:File,maxBytes:number):string|null {
  if(!/\.(pdf|docx?|jpe?g|png|webp|xlsx?)$/i.test(file.name))return 'Choose a PDF, Word, Excel or JPG/PNG/WebP image.';
  if(!file.size)return 'The file is empty.';
  if(file.size>maxBytes)return `File must be ${(maxBytes/1024/1024).toLocaleString()} MB or smaller.`;
  return null;
}
export function documentBase64(file:File):Promise<string> {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Could not read the selected file.'));reader.readAsDataURL(file);});
}
/** Early content-signature check; the server also inspects document containers. */
export function validateDocumentHeader(file:File,base64:string) {
  const bytes=atob(base64.slice(0,32)),ext=file.name.split('.').pop()?.toLowerCase();
  const hex=Array.from(bytes).map(char=>char.charCodeAt(0).toString(16).padStart(2,'0')).join('');
  const valid=ext==='pdf'?bytes.startsWith('%PDF-'):
    ext==='png'?hex.startsWith('89504e470d0a1a0a'):
    ext==='jpg'||ext==='jpeg'?hex.startsWith('ffd8ff'):
    ext==='webp'?bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP':
    ext==='doc'||ext==='xls'?hex.startsWith('d0cf11e0a1b11ae1'):
    ext==='docx'||ext==='xlsx'?hex.startsWith('504b0304'):false;
  if(!valid)throw new Error('File content does not match the selected document type.');
}
const base=(id:string)=>`/api/franchise/${encodeURIComponent(id)}/documents`;
export const franchiseDocumentsApi = {
  list:(id:string,history=false)=>api.get<{documents:FranchiseDocument[];maxFileBytes:number}>(base(id),{params:history?{history:true}:undefined}),
  upload:(id:string,data:any,onProgress:(value:number)=>void)=>api.post<FranchiseDocument>(base(id),data,{onUploadProgress:event=>onProgress(event.total?Math.min(95,Math.round(event.loaded/event.total*100)):0)}),
  update:(id:string,docId:string,data:any)=>api.patch(`${base(id)}/${encodeURIComponent(docId)}`,data),
  remove:(id:string,docId:string)=>api.delete(`${base(id)}/${encodeURIComponent(docId)}`),
  file:(id:string,docId:string,preview=false)=>api.get(`${base(id)}/${encodeURIComponent(docId)}/file`,{params:{preview},responseType:'blob'}),
};
