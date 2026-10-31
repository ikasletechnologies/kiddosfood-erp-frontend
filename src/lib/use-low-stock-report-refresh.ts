"use client";
import { useEffect, useState } from 'react';
import { FINISHED_GOODS_SETTING_CHANGED, FINISHED_GOODS_SETTING_STORAGE_KEY } from './stock-settings-events';
export function useLowStockReportRefresh(enabled=true) {
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!enabled)return;
    const refresh=()=>setRevision(v=>v+1);
    const storage=(e:StorageEvent)=>{if(e.key===FINISHED_GOODS_SETTING_STORAGE_KEY)refresh()};
    const visible=()=>{if(document.visibilityState==='visible')refresh()};
    window.addEventListener(FINISHED_GOODS_SETTING_CHANGED,refresh);window.addEventListener('storage',storage);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
    return ()=>{window.removeEventListener(FINISHED_GOODS_SETTING_CHANGED,refresh);window.removeEventListener('storage',storage);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible)};
  },[enabled]);
  return revision;
}
