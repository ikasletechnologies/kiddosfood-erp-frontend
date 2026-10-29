"use client";
import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import FranchisePhoto, { FranchisePhotoReference } from "./FranchisePhoto";

export const MAX_FRANCHISE_PHOTO_BYTES=5*1024*1024;
const accepted=['image/jpeg','image/png','image/webp'];
export function validatePhotoFile(file:File):string | null {
  if(!/\.(jpe?g|png|webp)$/i.test(file.name) || (file.type && !accepted.includes(file.type)))return 'Only JPG, JPEG, PNG and WebP photos are supported.';
  if(file.size>MAX_FRANCHISE_PHOTO_BYTES)return 'Franchise photo must be 5 MB or smaller.';
  if(!file.size)return 'The photo is empty.';
  return null;
}

export async function photoPayload(file:File) {
  const error=validatePhotoFile(file);if(error)throw new Error(error);
  const dataBase64=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1] || '');reader.onerror=()=>reject(new Error('Could not read the photo. Choose it again.'));reader.readAsDataURL(file);
  });
  const extension=file.name.split('.').pop()?.toLowerCase();
  return {fileName:file.name,mimeType:file.type || (extension==='png'?'image/png':extension==='webp'?'image/webp':'image/jpeg'),dataBase64};
}

export default function FranchisePhotoUpload({ file, photo, removed, onChange, error:serverError, disabled=false }: {file:File | null;photo?:FranchisePhotoReference | null;removed:boolean;onChange:(file:File | null)=>void;error?:string;disabled?:boolean}) {
  const input=useRef<HTMLInputElement>(null);
  const [error,setError]=useState<string | null>(null);
  const [dragging,setDragging]=useState(false);
  const hasPhoto=!!file || (!!photo && !removed);
  const choose=(files:FileList | null)=>{
    if(disabled || !files?.length)return;
    if(files.length!==1){setError('Choose one franchise photo.');return;}
    const message=validatePhotoFile(files[0]);setError(message);if(!message)onChange(files[0]);
  };
  return <div>
    <p className="mb-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">Franchise Photo <span className="font-normal">(Optional)</span></p>
    <div role="group" aria-label="Franchise photo upload" onDragOver={event=>{event.preventDefault();if(!disabled)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);choose(event.dataTransfer.files);}} className={`flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed p-3 ${dragging?'border-orange-500 bg-orange-50':'border-slate-200 dark:border-slate-700'}`}>
      <FranchisePhoto file={file} photo={removed?null:photo} className="h-20 w-24" />
      <div className="min-w-0 flex-1 space-y-2">
        <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" aria-label="Franchise Photo" disabled={disabled} onChange={event=>{choose(event.currentTarget.files);event.currentTarget.value='';}} />
        <div className="flex flex-wrap gap-2"><button type="button" disabled={disabled} onClick={()=>input.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-600 disabled:opacity-50"><Upload size={14}/>{hasPhoto?'Change Photo':'Upload Photo'}</button>
          {hasPhoto && <button type="button" disabled={disabled} onClick={()=>{setError(null);onChange(null);}} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-50"><X size={14}/>Remove Photo</button>}
        </div>
        <p className="text-[11px] text-slate-500">Drag and drop a photo here. JPG, JPEG, PNG or WebP · Max 5 MB.</p>
      </div>
    </div>
    {(error || serverError) && <p role="alert" className="mt-1 text-xs text-rose-600">{error || serverError}</p>}
  </div>;
}
