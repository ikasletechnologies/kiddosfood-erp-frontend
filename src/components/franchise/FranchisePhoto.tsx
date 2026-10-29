"use client";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { clsx } from "clsx";
import api from "@/lib/api/base";

export interface FranchisePhotoReference { id: string; url: string; mimeType?: string; fileName?: string; size?: number }

/** Fetch privately: a plain image URL cannot carry the API's Bearer token. */
export default function FranchisePhoto({ photo, file, name = "Franchise", className }: { photo?: FranchisePhotoReference | null; file?: File | null; name?: string; className?: string }) {
  const [source,setSource] = useState<string | null>(null);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{
    let stale=false,objectUrl:string | null=null;
    setSource(null);setFailed(false);
    if(file){objectUrl=URL.createObjectURL(file);setSource(objectUrl);}
    else if(photo?.url) api.get(photo.url,{responseType:'blob'}).then(response=>{
      if(stale)return;
      objectUrl=URL.createObjectURL(response.data);setSource(objectUrl);
    }).catch(()=>{if(!stale)setFailed(true);});
    return ()=>{stale=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[file,photo?.id,photo?.url]);
  return <div className={clsx("flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 dark:bg-orange-500/10",className)}>
    {source && !failed ? <img src={source} alt={`${name} photo`} onError={()=>setFailed(true)} className="h-full w-full object-contain" /> : <Building2 aria-label="Default franchise photo" className="h-10 w-10 text-orange-400" />}
  </div>;
}
