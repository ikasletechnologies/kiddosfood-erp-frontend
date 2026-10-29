"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, RefreshCw, Search, ShieldCheck, Upload, Users, X } from 'lucide-react';
import { DOCUMENT_ACCEPT, DOCUMENT_CATEGORIES, documentBase64, FranchiseDocument, franchiseDocumentsApi as api, validateDocumentFile, validateDocumentHeader } from '@/lib/api/franchise-documents.api';
import { Modal } from '@/components/ui/Modal';

const button='inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const primary='inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-40';
const input='w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
export function documentError(error:any,fallback:string) {
  const body=error.response?.data;
  if(body&&typeof body==='object'&&typeof (body.error||body.message)==='string')return body.error||body.message;
  if(error.response?.status===404)return 'Document service is temporarily unavailable. Refresh and try again. Your selected file has not been uploaded.';
  if(error.code==='ERR_NETWORK')return 'Unable to reach the server. Check your connection and try again.';
  return !error.response&&error.message?error.message:fallback;
}
export default function FranchiseDocuments({franchiseId,franchiseName,manage=false}:{franchiseId:string;franchiseName?:string;manage?:boolean}) {
  const [documents,setDocuments]=useState<FranchiseDocument[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [history,setHistory]=useState(false),[search,setSearch]=useState(''),[maxBytes,setMaxBytes]=useState(10*1024*1024);
  const [editor,setEditor]=useState<{category:string;replaceId?:string}|null>(null),[file,setFile]=useState<File|null>(null);
  const [visibility,setVisibility]=useState('INTERNAL'),[notes,setNotes]=useState(''),[issueDate,setIssueDate]=useState(''),[expiryDate,setExpiryDate]=useState('');
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[preview,setPreview]=useState<{url:string;document:FranchiseDocument}|null>(null);
  const urls=useRef(new Set<string>());
  const fileInput=useRef<HTMLInputElement>(null);
  const loadVersion=useRef(0);
  const [loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState(''),[dragging,setDragging]=useState(false);
  const load=useCallback(async()=>{
    const version=++loadVersion.current;
    setLoading(true);setLoadError('');
    try{const response=await api.list(franchiseId,manage&&history);if(version!==loadVersion.current)return;if(!Array.isArray(response.data.documents)||!Number.isFinite(response.data.maxFileBytes))throw new Error('Invalid document response');setDocuments(response.data.documents);setMaxBytes(response.data.maxFileBytes);setLoaded(true);}
    catch(e:any){if(version===loadVersion.current)setLoadError(documentError({response:e.response,code:e.code},'Could not load franchise documents. Please try refreshing.'));}
    finally{if(version===loadVersion.current)setLoading(false);}
  },[franchiseId,manage,history]);
  useEffect(()=>{load();return()=>{loadVersion.current++;};},[load]);
  useEffect(()=>()=>{urls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
  const closePreview=()=>{if(preview){URL.revokeObjectURL(preview.url);urls.current.delete(preview.url);}setPreview(null);};
  const choose=(next:File|null)=>{if(!next)return;const problem=validateDocumentFile(next,maxBytes);if(problem){setFile(null);setError(problem);return;}setError('');setFile(next);};
  const start=(category:string,replaceId?:string)=>{setEditor({category,replaceId});setFile(null);setVisibility('INTERNAL');setNotes('');setIssueDate('');setExpiryDate('');setError('');setNotice('');};
  const perform=async(action:()=>Promise<any>,message:string)=>{setBusy(true);setError('');setNotice('');try{await action();setNotice(message);await load();}catch(e:any){setError(documentError(e,'The document could not be saved. Your selected file is still available to retry.'));}finally{setBusy(false);}};
  const upload=()=>{if(!file||!editor||busy)return;const target=editor,selected=file;setProgress(0);
    perform(async()=>{const dataBase64=await documentBase64(selected);validateDocumentHeader(selected,dataBase64);await api.upload(franchiseId,{...target,originalFileName:selected.name,mimeType:selected.type,dataBase64,visibility,notes,issueDate,expiryDate},setProgress);setProgress(100);setEditor(null);setFile(null);},'Document saved.');};
  const openFile=async(doc:FranchiseDocument,view:boolean)=>{
    setError('');
    try{const response=await api.file(franchiseId,doc.id,view);const url=URL.createObjectURL(new Blob([response.data],{type:doc.mimeType}));urls.current.add(url);
      if(view){closePreview();setPreview({url,document:doc});}
      else{const anchor=document.createElement('a');anchor.href=url;anchor.download=doc.originalFileName;anchor.click();setTimeout(()=>{URL.revokeObjectURL(url);urls.current.delete(url);},1000);}
    }catch{setError('Could not access this document. Please refresh and try again.');}
  };
  const uploaded=new Set(documents.filter(d=>d.status==='ACTIVE').map(d=>d.category)).size;
  const visibleCategories=DOCUMENT_CATEGORIES.filter(([category,name])=>name.toLowerCase().includes(search.toLowerCase())||documents.some(d=>d.category===category&&d.originalFileName.toLowerCase().includes(search.toLowerCase())));
  return <section aria-label="Franchise documents" className="space-y-4 min-w-0">
    <div className="space-y-1"><h3 className="font-bold text-slate-900 dark:text-white">{manage?'UPDATE DOCUMENTS':'Branch Documents'}</h3>{franchiseName&&<p className="break-words text-sm font-semibold text-orange-600">{franchiseName}</p>}<p className="text-xs leading-relaxed text-slate-500">{manage?'Upload files for this branch. All categories are optional, and files stay private unless you share them.':'View and download documents shared with your franchise by Super Admin.'}</p></div>
    {manage&&loaded&&<div className="rounded-xl border border-orange-100 bg-orange-50/60 p-3 text-xs text-orange-900"><div className="flex flex-wrap justify-between gap-2"><span>Total Categories: 9</span><span>Uploaded Categories: {uploaded}</span><span>Pending Categories: {9-uploaded}</span></div><progress className="mt-2 h-1.5 w-full accent-orange-500" value={uploaded} max={9} aria-label="Uploaded categories" /></div>}
    <div className="flex flex-wrap gap-3 items-center"><div className="relative min-w-0 flex-1 basis-48"><Search size={15} aria-hidden="true" className="absolute left-3 top-3 text-slate-400"/><input aria-label="Search documents" className={input+' pl-9'} placeholder="Search documents..." value={search} onChange={e=>setSearch(e.target.value)} /></div><button type="button" aria-label="Refresh Documents" className={button} disabled={busy||loading} onClick={()=>{setError('');load();}}><RefreshCw size={14} aria-hidden="true" className={loading?'animate-spin':''}/>Refresh</button>{manage&&<label className="text-xs flex gap-2 items-center text-slate-500"><input type="checkbox" aria-label="Version history" className="accent-orange-500" checked={history} onChange={e=>setHistory(e.target.checked)} disabled={busy}/>Show version history</label>}</div>
    {loadError&&<p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
    {error&&!editor&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice&&<p role="status" className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 size={16} aria-hidden="true"/>{notice}</p>}
    {!loading&&loaded&&visibleCategories.length===0&&<p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">No documents match your search.</p>}
    {loading?<p role="status" className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 size={16} aria-hidden="true" className="animate-spin"/>Loading documents...</p>:loaded&&visibleCategories.map(([category,name])=>{
      const docs=documents.filter(d=>d.category===category),active=docs.some(d=>d.status==='ACTIVE'),multiple=['LEGAL_AGREEMENTS','OTHER_DOCUMENTS'].includes(category);
      return <div key={category} className={'min-w-0 rounded-xl border p-4 space-y-3 '+(editor?.category===category?'border-orange-300 bg-orange-50/20':'border-slate-200 dark:border-slate-700')}>
        <div className="flex justify-between items-start gap-3"><div className="flex min-w-0 items-start gap-2.5"><span className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-slate-800"><FileText size={17} aria-hidden="true"/></span><div className="min-w-0"><h4 className="break-words text-sm font-bold">{name}</h4><span className={'mt-0.5 inline-block text-xs '+(active?'text-green-700':'text-slate-500')}>{active?'Uploaded':manage?'Not Uploaded':'No shared documents'}</span></div></div>{manage&&(!active||multiple)&&editor?.category!==category&&<button type="button" className={button+' border-orange-200 text-orange-700'} disabled={busy} onClick={()=>start(category)}><Upload size={13} aria-hidden="true"/>{multiple&&active?'Add File':'Upload'}</button>}</div>
        {docs.map(doc=><div key={doc.id} className="space-y-2 border-t border-slate-100 pt-2 text-xs">
          <p className="font-semibold break-all">{doc.originalFileName} <span className="text-slate-500">· v{doc.version} · {doc.status==='ACTIVE'?'Uploaded':doc.status==='HISTORICAL'?'Historical':'Archived'}</span></p>
          <p className="text-slate-500">{new Date(doc.uploadedAt).toLocaleString()} · {doc.uploadedByName} · {(doc.fileSize/1024).toFixed(1)} KB</p>
          <p className="text-slate-500">{doc.visibility==='SHARED'?'Shared With Franchise':'Internal Only'}{doc.issueDate?` · Issued: ${new Date(doc.issueDate).toLocaleDateString()}`:''}{doc.expiryDate?` · Expires: ${new Date(doc.expiryDate).toLocaleDateString()}`:''}</p>
          {doc.notes&&<p className="whitespace-pre-wrap break-words">{doc.notes}</p>}
          <div className="flex flex-wrap gap-2">
            {(doc.mimeType==='application/pdf'||doc.mimeType.startsWith('image/'))&&<button type="button" className={button} onClick={()=>openFile(doc,true)}>View</button>}
            <button type="button" className={button} onClick={()=>openFile(doc,false)}>Download</button>
            {manage&&doc.status==='ACTIVE'&&<><button type="button" className={button} disabled={busy} onClick={()=>start(category,doc.id)}>Replace</button><button type="button" className={button} disabled={busy} onClick={()=>{if(window.confirm('Remove this document from active files? Its version history will be retained.'))perform(()=>api.remove(franchiseId,doc.id),'Document archived.');}}>Remove</button><button type="button" className={button} disabled={busy} onClick={()=>{if(doc.visibility==='SHARED'||window.confirm('Share this document with this franchise? Check that it contains no private information before sharing.'))perform(()=>api.update(franchiseId,doc.id,{visibility:doc.visibility==='SHARED'?'INTERNAL':'SHARED'}),'Visibility updated.');}}>{doc.visibility==='SHARED'?'Make Internal':'Share With Franchise'}</button></>}
          </div>
        </div>)}
        {manage&&editor?.category===category&&<div className="space-y-4 border-t border-orange-100 pt-4" role="group" aria-label={`Upload ${name}`}>
          <label className={'block cursor-pointer rounded-xl border-2 border-dashed p-4 text-xs transition-colors focus-within:ring-2 focus-within:ring-orange-400 '+(dragging?'border-orange-500 bg-orange-100':'border-orange-200 bg-white hover:bg-orange-50/50 dark:bg-slate-900')} onDragOver={e=>{e.preventDefault();if(!busy)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(!busy)choose(e.dataTransfer.files[0]);}}>
            <input ref={fileInput} className="sr-only" type="file" aria-label={`File for ${name}`} accept={DOCUMENT_ACCEPT} disabled={busy} onChange={e=>choose(e.target.files?.[0]||null)}/>
            <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-orange-50 p-2.5 text-orange-500"><Upload size={20} aria-hidden="true"/></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{file?'Choose a different file':'Drop your document here'}</p><p className="mt-0.5 text-xs text-slate-500">or click to browse · Up to {maxBytes/1024/1024} MB</p></div><span className={button+' pointer-events-none border-orange-200 text-orange-700'}>{file?'Change File':'Choose File'}</span></div><p className="mt-3 text-[11px] text-slate-400">PDF, Word, Excel, JPG, PNG and WebP</p>
          </label>
          {file&&<div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:bg-slate-900"><FileText size={18} aria-hidden="true" className="shrink-0 text-orange-500"/><div className="min-w-0 flex-1"><p title={file.name} className="truncate text-xs font-semibold">Selected: {file.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{(file.size/1024).toFixed(1)} KB · Ready to upload</p></div><button type="button" aria-label="Remove selected file" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600" disabled={busy} onClick={()=>{setFile(null);if(fileInput.current)fileInput.current.value='';}}><X size={15} aria-hidden="true"/></button></div>}
          <div className="space-y-1.5"><label htmlFor={`visibility-${category}`} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Who can view this document?</label><select id={`visibility-${category}`} aria-label="Document visibility" className={input} value={visibility} disabled={busy} onChange={e=>setVisibility(e.target.value)}><option value="INTERNAL">Internal Only</option><option value="SHARED">Shared With Franchise</option></select><p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">{visibility==='INTERNAL'?<ShieldCheck size={13} aria-hidden="true" className="mt-0.5 shrink-0"/>:<Users size={13} aria-hidden="true" className="mt-0.5 shrink-0"/>}{visibility==='INTERNAL'?'Only Super Admin can access this file.':'This file will appear in this franchise’s Branch Profile.'}</p></div>
          <details className="rounded-lg border border-slate-200 bg-white p-3 dark:bg-slate-900"><summary className="cursor-pointer text-xs font-semibold text-slate-600">Additional details (optional)</summary><div className="mt-3 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="min-w-0 text-xs text-slate-500">Issue Date<input aria-label="Document issue date" className={input+' mt-1'} type="date" value={issueDate} disabled={busy} onChange={e=>setIssueDate(e.target.value)}/></label><label className="min-w-0 text-xs text-slate-500">Expiry Date<input aria-label="Document expiry date" className={input+' mt-1'} type="date" value={expiryDate} disabled={busy} onChange={e=>setExpiryDate(e.target.value)}/></label></div><textarea aria-label="Document notes" className={input} rows={2} placeholder="Add a note..." maxLength={2000} value={notes} disabled={busy} onChange={e=>setNotes(e.target.value)}/></div></details>
          {error&&<p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs leading-relaxed text-red-700">{error}</p>}
          {busy&&<div><progress className="h-1.5 w-full accent-orange-500" max={100} value={progress} aria-label="Upload progress"/><p className="mt-1 text-xs text-slate-500">{progress>=95?'Saving securely...':`Uploading... ${progress}%`}</p></div>}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-orange-100 pt-3"><button type="button" className={button} disabled={busy} onClick={()=>{setEditor(null);setFile(null);setError('');}}>Cancel Upload</button><button type="button" className={primary} disabled={!file||busy} onClick={upload}>{busy?<Loader2 size={16} aria-hidden="true" className="animate-spin"/>:<Upload size={16} aria-hidden="true"/>}{editor.replaceId?'Save Replacement':'Upload Document'}</button></div>
        </div>}
      </div>;
    })}
    {preview && <Modal isOpen onClose={closePreview} title={preview.document.originalFileName} size="xl" zIndex={80}>
      {preview&&(preview.document.mimeType.startsWith('image/')?<img src={preview.url} alt={preview.document.originalFileName} className="max-h-[65vh] w-full object-contain"/>:<iframe title="Document preview" src={preview.url} referrerPolicy="no-referrer" className="h-[65vh] w-full rounded-lg border"/>)}
      {preview&&<button type="button" className={button+' mt-3'} onClick={()=>openFile(preview.document,false)}>Download</button>}
    </Modal>}
  </section>;
}
