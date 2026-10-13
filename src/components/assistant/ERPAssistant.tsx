'use client';

import Link from 'next/link';
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bot, ExternalLink, Loader2, MessageCircle, Plus, Send, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { assistantApi, AssistantReply } from '@/lib/api';

type Message = {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  links?: string[];
  live?: boolean;
  retrievedAt?: string | null;
  failedText?: string;
};

const suggestions = (path: string) => {
  if (path.includes('purchase') || path.includes('procurement')) return [
    'Purchase order create panna steps sollu.',
    'PO number kudutha current status kaatu.',
    'Vendor account details eppadi check panradhu?',
  ];
  if (path.includes('inventory') || path.includes('stock')) return [
    'Raw rice stock warehouse-wise kaatu.',
    'Stock adjustment flow explain pannu.',
    'Low stock report enga irukku?',
  ];
  if (path.includes('production') || path.includes('packaging')) return [
    'Intha batch-la remaining quantity eppadi check panradhu?',
    'Packaging confirmation flow explain pannu.',
    'Production batch number kudutha status kaatu.',
  ];
  if (path.includes('sales') || path.includes('invoice')) return [
    'Sales invoice create panna steps sollu.',
    'Invoice number kudutha status kaatu.',
    'Dispatch flow explain pannu.',
  ];
  return [
    'Purchase order create panna help pannu.',
    'Stock item availability kaatu.',
    'Production batch status eppadi check panradhu?',
  ];
};

const newConversationId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36);

const validLinkPrefixes = [
  '/vendors', '/purchases', '/inventory', '/production', '/packaging',
  '/sales', '/reports',
];

const BUTTON_SIZE = 48;
const EDGE_GAP = 12;
const POSITION_KEY = 'erp-assistant:button-position';

type Position = { x: number; y: number };

const clampPosition = ({ x, y }: Position): Position => ({
  x: Math.min(Math.max(EDGE_GAP, x), window.innerWidth - BUTTON_SIZE - EDGE_GAP),
  y: Math.min(Math.max(EDGE_GAP, y), window.innerHeight - BUTTON_SIZE - EDGE_GAP),
});

const safeLinks = (links: unknown) =>
  Array.isArray(links)
    ? links.filter((link): link is string => typeof link === 'string' && validLinkPrefixes.some((prefix) => link === prefix || link.startsWith(prefix + '/') || link.startsWith(prefix + '?'))).slice(0, 8)
    : [];

export default function ERPAssistant() {
  const { user } = useAuth();
  const pathname = usePathname();
  const role = String((user as any)?.role?.name || user?.role || '').toUpperCase();
  const allowed = role === 'SUPER_ADMIN' || role === 'FRANCHISE_ADMIN';
  const storageKey = user ? `erp-assistant:${user.id}:${role}:${user.franchiseId || 'hq'}` : '';
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [conversationId, setConversationId] = useState(newConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const drag = useRef<{ offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prompts = useMemo(() => suggestions(pathname), [pathname]);

  useEffect(() => {
    if (!allowed || !storageKey) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
      if (saved.conversationId) setConversationId(saved.conversationId);
      if (Array.isArray(saved.messages)) setMessages(saved.messages);
    } catch {
      sessionStorage.removeItem(storageKey);
    }
    assistantApi.status()
      .then(({ data }) => setAvailable(data.available))
      .catch(() => setAvailable(false));
  }, [allowed, storageKey, open]);

  useEffect(() => {
    if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify({ conversationId, messages }));
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationId, messages, storageKey]);

  useEffect(() => {
    let initial: Position = {
      x: window.innerWidth - BUTTON_SIZE - 20,
      y: window.innerHeight - BUTTON_SIZE - 20,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
      if (typeof saved?.x === 'number' && typeof saved?.y === 'number') initial = saved;
    } catch { /* ignore */ }
    setPosition(clampPosition(initial));
    const onResize = () => setPosition((old) => old && clampPosition(old));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!allowed) return null;

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!position) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    if (!state.moved && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 5) return;
    state.moved = true;
    setPosition(clampPosition({ x: event.clientX - state.offsetX, y: event.clientY - state.offsetY }));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!state) return;
    if (state.moved) {
      try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { /* ignore */ }
    } else {
      setOpen(true);
    }
  };

  const reset = async () => {
    await assistantApi.clear(conversationId).catch(() => undefined);
    setConversationId(newConversationId());
    setMessages([]);
    setInput('');
  };

  const ask = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    setMessages((old) => [...old, { id: newConversationId(), sender: 'user', text: clean }]);
    setInput('');
    setSending(true);
    try {
      const { data } = await assistantApi.chat({
        message: clean,
        conversationId,
        pagePath: pathname,
      });
      const reply = data as AssistantReply;
      setMessages((old) => [...old, {
        id: newConversationId(),
        sender: 'assistant',
        text: reply.answer,
        links: safeLinks(reply.links),
        live: reply.usedLiveData,
        retrievedAt: reply.retrievedAt,
      }]);
    } catch (error: any) {
      const detail = error?.response?.data?.message || error?.response?.data?.error;
      setMessages((old) => [...old, {
        id: newConversationId(),
        sender: 'assistant',
        text: detail || 'Assistant-ai reach panna mudiyala. Konjam neram kazhichu retry pannunga.',
        failedText: clean,
      }]);
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(input);
  };

  return <>
    {position && <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true); } }}
      aria-label='Open ERP Assistant'
      title='ERP Assistant (drag to move)'
      style={{ left: position.x, top: position.y, width: BUTTON_SIZE, height: BUTTON_SIZE }}
      className='fixed z-40 flex cursor-grab touch-none select-none items-center justify-center rounded-full bg-orange-500 text-white shadow-xl transition-colors hover:bg-orange-600 active:cursor-grabbing'
    >
      <MessageCircle size={22} />
    </button>}

    {open && <div className='pointer-events-none fixed inset-0 z-50 flex items-end justify-end bg-transparent sm:p-5'>
      <section className='pointer-events-auto flex h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:h-[min(760px,90vh)] sm:max-w-md sm:rounded-2xl'>
        <header className='flex items-center justify-between border-b bg-orange-500 px-4 py-3 text-white'>
          <div className='flex items-center gap-2'>
            <Bot size={22} />
            <div><h2 className='font-semibold'>Kiddos ERP Assistant</h2><p className='text-xs text-orange-50'>Read-only help & live lookups</p></div>
          </div>
          <div className='flex gap-1'>
            <button onClick={reset} className='rounded-lg p-2 hover:bg-white/15' title='New conversation'><Plus size={19} /></button>
            <button onClick={() => setOpen(false)} className='rounded-lg p-2 hover:bg-white/15' title='Close'><X size={19} /></button>
          </div>
        </header>

        {available === false && <div className='border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800'>
          AI guidance unavailable. Authorized live ERP lookups may still work.
        </div>}

        <div className='flex-1 space-y-3 overflow-y-auto p-4'>
          {messages.length === 0 && <div className='space-y-4'>
            <div className='rounded-2xl bg-muted p-4 text-sm'>
              English, தமிழ், அல்லது Tanglish-la கேளுங்க. Data மாற்ற முடியாது; view/help மட்டும்.
            </div>
            <div className='space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Try asking</p>
              {prompts.map((prompt) => <button key={prompt} onClick={() => void ask(prompt)} className='block w-full rounded-xl border p-3 text-left text-sm hover:border-orange-300 hover:bg-orange-50/60'>{prompt}</button>)}
            </div>
          </div>}

          {messages.map((message) => <div key={message.id} className={message.sender === 'user' ? 'ml-10' : 'mr-6'}>
            <div className={message.sender === 'user' ? 'rounded-2xl rounded-br-sm bg-orange-500 p-3 text-sm text-white' : 'whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted p-3 text-sm'}>
              {message.text}
            </div>
            {message.live && <p className='mt-1 text-[11px] text-muted-foreground'>Live data retrieved {message.retrievedAt ? new Date(message.retrievedAt).toLocaleString() : 'now'}</p>}
            {!!message.links?.length && <div className='mt-2 flex flex-wrap gap-2'>
              {message.links.map((href) => <Link key={href} href={href} className='inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-orange-600 hover:bg-orange-50'>{href}<ExternalLink size={11} /></Link>)}
            </div>}
            {message.failedText && <button onClick={() => void ask(message.failedText!)} className='mt-1 text-xs font-medium text-orange-600 hover:underline'>Retry</button>}
          </div>)}
          {sending && <div className='mr-20 flex items-center gap-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground'><Loader2 size={16} className='animate-spin' /> Checking…</div>}
          <div ref={endRef} />
        </div>

        <footer className='border-t p-3'>
          <form onSubmit={submit} className='flex gap-2'>
            <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={2000} placeholder='Ask about this ERP…' className='min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-orange-400' />
            <button disabled={!input.trim() || sending} className='rounded-xl bg-orange-500 p-3 text-white disabled:opacity-40' aria-label='Send'><Send size={18} /></button>
          </form>
          <p className='mt-2 text-center text-[11px] text-muted-foreground'>Read-only • Access follows your ERP role and franchise</p>
        </footer>
      </section>
    </div>}
  </>;
}
