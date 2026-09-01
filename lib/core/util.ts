import { ungzip } from 'pako';
import { create } from 'zustand';

export const useTimeStore = create<{ now: number; update: () => void }>((set) => ({
  now: Date.now(),
  update: () => set({ now: Date.now() }),
}));

// Start global tick for the store
if (typeof window !== 'undefined') {
  setInterval(() => useTimeStore.getState().update(), 250);
}

const ansiClass: Record<number, string> = {91: 'log-error', 92: 'log-debug', 93: 'log-warn'};
const store_timeout = 24 * 60 * 60 * 1000;

function pad(t: any, c = ' ', count = 2) {
  let s = '' + t;
  while (s.length < count) s = c + s;
  return s;
}

function zpad(t: any, count = 2) { return pad(t, '0', count); }

export class Util {
  _addressRE = new RegExp(/^(([\w.-]+)(:\d+)?)?(\/[\w.-]+)?$/);
  _urlbase64_map: Record<string, string> = {'+': '-', '\/': '_', '=': ''};
  _base64_map: Record<string, string> =    {'-': '+', '_': '\/'};

  get now() { return useTimeStore.getState().now; }

  debounce(cb: any, delay = 100) {
    let state: any = {};
    return (...args: any[]) => {
      if (state.timer != undefined) {
        state.triggered = true;
        state.args = args;
      } else {
        cb(...args);
        state.timer = setTimeout(() => {
          if (state.triggered) cb(...state.args);
          delete state.timer;
          delete state.triggered;
          delete state.args;
        }, delay);
      }
    };
  }

  clamp(n: number, min: number, max: number) { return Math.min(Math.max(n, min), max); }

  lock_scrolling() {
    if (typeof window === 'undefined') return;
    document.body.style.top = `-${window.scrollY}px`;
    document.body.style.position = 'fixed';
  }

  unlock_scrolling() {
    if (typeof window === 'undefined') return;
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
  }
  
  Deferred() {
    let resolve: any, reject: any;
    let promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { resolve, reject, promise: () => promise };
  }

  isObject(o: any) { return o != null && typeof o === 'object'; }
  isEmpty(o: any)  { return !Object.keys(o).length; }

  merge_objs(dst: any, src: any) {
    Object.entries(src).map(([k, v]) => {
      if (this.isObject(v) && this.isObject(dst[k])) this.merge_objs(dst[k], v);
      else dst[k] = v;
    });
  }

  map_object(o: any, cb: any) {
    return Object.entries(o).reduce((r: any, [k, v]) => {
      r[k] = cb(v, k);
      return r;
    }, {});
  }

  deepCopy(o: any): any {
    if (Array.isArray(o)) return o.map((v: any) => this.deepCopy(v));
    if (this.isObject(o)) return this.map_object(o, (v: any) => this.deepCopy(v));
    return o;
  }

  copy_props(dst: any, src: any) {
    if (src != undefined) Object.entries(src).map(([k, v]) => dst[k] = v);
  }

  isEqual(a: any, b: any): boolean {
    if (typeof a != typeof b) return false;
    if (!this.isObject(a) || !this.isObject(b)) return a === b;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length != keysB.length) return false;
    for (const key of keysA) {
      if (!this.isEqual(a[key], b[key])) return false;
    }
    return true;
  }

  is_closer(a: number, b: number, target: number) {
    return Math.abs(a - target) < Math.abs(b - target);
  }

  format(s: string, o: any) {
    return s.replace(/{([^{}]*)}/g, (a, b) => {
      const r = o[b];
      return typeof r === 'string' || typeof r === 'number' ? String(r) : a;
    });
  }

  human_number(x: number, precision = 1) {
    if (1e12 <= x) return (x / 1e12).toFixed(precision) + 'T';
    if (1e9  <= x) return (x / 1e9 ).toFixed(precision) + 'B';
    if (1e6  <= x) return (x / 1e6 ).toFixed(precision) + 'M';
    if (1e3  <= x) return (x / 1e3 ).toFixed(precision) + 'K';
    return x;
  }

  capitalize(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  escape_html(s: string) {
    return s.replace(/[&<>"']/g, (c) => {
      switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return c;
      }
    });
  }

  ansi_class(s: string) {
    let m = s.match(/\u001b\[(\d+)m/);
    return m ? (ansiClass[parseInt(m[1])] || '') : '';
  }

  ansi2html(s: string) { return this.escape_html(s).replace(/\u001b\[\d+m/g, ''); }

  version_parse(v: string | string[]) {
    if (typeof(v) == 'string') v = v.split('.');
    if (v != undefined) return (v as string[]).map(x => parseInt(x));
    return [0, 0, 0];
  }

  version_less(a: string | string[], b: string | string[]) {
    const aa = this.version_parse(a);
    const bb = this.version_parse(b);
    for (let i = 0; i < aa.length || i < bb.length; i++) {
      const A = aa[i] || 0;
      const B = bb[i] || 0;
      if (A < B) return true;
      if (B < A) return false;
    }
    return false;
  }

  remove(key: string) {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    localStorage.removeItem(key + '.__ts__');
  }

  store(key: string, value: any) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(key + '.__ts__', new Date().toISOString());
  }

  is_expired(key: string, timeout = store_timeout) {
    if (!timeout) return false;
    if (typeof window === 'undefined') return false;
    let ts = localStorage.getItem(key + '.__ts__');
    try {
      if (ts && Date.now() - new Date(ts).getTime() < timeout) return false;
    } catch (e) {}
    return true;
  }

  retrieve(key: string, timeout = store_timeout) {
    try {
      if (!this.is_expired(key, timeout)) {
        if (typeof window === 'undefined') return;
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : undefined;
      }
    } catch (e) { console.log(e); }
  }

  store_bool(key: string, value: boolean) { this.store(key, !!value); }

  retrieve_bool(key: string, timeout = store_timeout) {
    return !!this.retrieve(key, timeout);
  }

  uri_get(str: string, name: string, defaultValue: string) {
    let regex   = new RegExp('((^[\\?#]?)|[&])' + name + '=([^&#]*)');
    let results = regex.exec(str);
    return results === null ?
      (defaultValue === undefined ? '' : defaultValue) :
      decodeURIComponent(results[3].replace(/\+/g, ' '));
  }

  query_get(name: string, defaultValue?: string) {
    if (typeof window === 'undefined') return defaultValue;
    return this.uri_get(location.search, name, defaultValue || '');
  }

  cookie_get(name: string) {
    if (typeof document === 'undefined') return;
    const parts = `; ${document.cookie}`.split(`; ${name}=`);
    if (parts.length == 2) return parts.pop()?.split(';').shift();
  }

  parse_interval(t: string) {
    let reStr = '(?<num>\\d+(\\.\\d+)?) *(?<unit>[a-zA-Z]+) *';
    if (!new RegExp(`^(${reStr})+$`).test(t)) throw `Invalid time interval "${t}"`;
    let re = new RegExp(reStr, 'g');
    let secs = 0;
    let match;
    while ((match = re.exec(t)) !== null) {
      if (!match.groups) continue;
      let num = parseFloat(match.groups.num);
      switch (match.groups.unit[0]) {
      case 'y': num *= 365; // fallthrough
      case 'd': num *= 24; // fallthrough
      case 'h': num *= 60; // fallthrough
      case 'm': num *= 60; // fallthrough
      case 's': num *= 1; break;
      default: throw `Invalid time interval "${t}"`;
      }
      secs += num;
    }
    return secs;
  }

  time_interval(secs: number): string {
    if (!isFinite(secs)) return '???';
    if (secs < 0) return '-' + this.time_interval(-secs);
    function div(x: number, y: number) { return (x / y) >> 0; }
    function mod(x: number, y: number) { return (x % y) >> 0; }
    if (secs && secs < 0.9995) return Math.round(secs * 1000) + 'ms';
    if (secs < 60) return Math.round(secs) + 's';
    if (secs < 60 * 60) return div(secs, 60) + 'm ' + zpad(mod(secs, 60)) + 's';
    if (secs < 60 * 60 * 24)
      return div(secs, 60 * 60) + 'h ' + zpad(div(mod(secs, 60 * 60), 60)) + 'm';
    return div(secs, 60 * 60 * 24) + 'd ' + zpad(div(mod(secs, 60 * 60 * 24), 60 * 60)) + 'h';
  }

  format_time(t: any) {
    const d = new Date(t);
    return `${d.getUTCFullYear()}/${zpad(d.getUTCMonth() + 1)}/` +
      `${zpad(d.getUTCDate())} ${zpad(d.getUTCHours())}:` +
      `${zpad(d.getUTCMinutes())}:${zpad(d.getUTCSeconds())}`;
  }

  timestamp(t: any = new Date()) {
    const d = new Date(t);
    return `${d.getUTCFullYear()}${zpad(d.getUTCMonth() + 1)}` +
      `${zpad(d.getUTCDate())}-${zpad(d.getUTCHours())}` +
      `${zpad(d.getUTCMinutes())}${zpad(d.getUTCSeconds())}`;
  }

  since(t: any, when: any = new Date()) {
    let secs = (new Date(t).getTime() - new Date(when).getTime()) / 1000;
    return this.time_interval(-secs);
  }

  format_timeout(t: any, offset: number) {
    let secs = (new Date(t).getTime() - new Date().getTime()) / 1000 + offset;
    return secs < 0 ? 'Expired' : this.time_interval(secs);
  }

  timeout_time(t: any, offset: number) {
    return this.format_time(new Date(t).getTime() + offset * 1000);
  }

  wrap(s: string, length?: number) {
    if (!length) return s;
    let chunks = [];
    for (let i = 0; i < Math.ceil(s.length / length); i++)
      chunks.push(s.substr(i * length, length));
    return chunks.join('\n');
  }

  base64_encode(s: string, length?: number) { return this.wrap(btoa(s), length); }

  urlbase64_encode(s: string, length?: number) {
    let encoded = this.base64_encode(s, length);
    return encoded.replace(/[+\/=]/g, c => this._urlbase64_map[c]);
  }

  base64_decode(s: string) {
    return atob(s.replace(/[-_]/g, c => this._base64_map[c] || c));
  }

  str2buf(str: string) { return Uint8Array.from(str, c => c.codePointAt(0)!); }

  buf2str(buf: any) {
    let view   = new Uint8Array(buf);
    let block  = 65535;
    let result = '';
    for (let i = 0; i < view.length; i += block) {
      if (view.length < i + block) block = view.length - i;
      result += String.fromCharCode.apply(null, Array.from(view.subarray(i, i + block)));
    }
    return result;
  }

  async decompress(s: string, type: string) {
    if (type != 'gzip') throw 'Unsupported compression type "' + type + '"';
    return this.buf2str(ungzip(this.str2buf(s)));
  }

  get_direct_address() {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem('fah-direct-address') || undefined;
  }

  set_direct_address(addr: string) {
    if (typeof window === 'undefined') return;
    if (!addr) localStorage.removeItem('fah-direct-address');
    else localStorage.setItem('fah-direct-address', addr);
  }

  set_body_class(enable: boolean, name: string) {
    if (typeof document === 'undefined') return;
    document.body.classList[enable ? 'add' : 'remove'](name);
  }
}

export const util = new Util();
