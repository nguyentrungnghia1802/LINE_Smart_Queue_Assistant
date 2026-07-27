import type { Plugin } from 'vite';

const MESSAGE_BUS_MODULE = '/@liff/message-bus/lib/index.es.js';
const EVAL_BLOCK_START =
  '(i=document.createElement("iframe")).style.display="none",i.src="about:blank",document.body.appendChild(i),';
const EVAL_BLOCK_END = ',r="iframe-".concat(e,"-ready")';

const CSP_SAFE_POST =
  '(i=document.createElement("iframe")).style.display="none",' +
  'i.name="liff-message-handler-"+e,' +
  'i.src="about:blank",' +
  'document.body.appendChild(i),' +
  '(a=document.createElement("form")).method="POST",' +
  'a.action="https://liff-subwindow.line.me/liff/v2/sub/messageHandler",' +
  'a.target=i.name,' +
  'a.style.display="none",' +
  'a.appendChild(Object.assign(document.createElement("input"),' +
  '{type:"hidden",name:"identifier",value:e})),' +
  'document.body.appendChild(a),' +
  'a.submit(),' +
  'a.remove()';

export function rewriteLiffMessageBusForCsp(code: string): string {
  const start = code.indexOf(EVAL_BLOCK_START);
  const end = code.indexOf(EVAL_BLOCK_END, start);
  if (start < 0 || end < 0) {
    throw new Error(
      'The installed LIFF message-bus implementation changed; review the CSP-safe iframe patch.'
    );
  }
  return `${code.slice(0, start)}${CSP_SAFE_POST}${code.slice(end)}`;
}

export function liffCspPlugin(): Plugin {
  return {
    name: 'liff-csp-safe-message-bus',
    enforce: 'pre',
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0];
      if (!normalizedId.endsWith(MESSAGE_BUS_MODULE)) return null;
      return { code: rewriteLiffMessageBusForCsp(code), map: null };
    },
  };
}
