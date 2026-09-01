import { util } from './util';
import { defaultCache } from './cache';
import { create } from 'zustand';

export const useApiStore = create<{ causes: string[], latest_version?: string }>((set) => ({
  causes: [],
  latest_version: undefined,
}));

export class API {
  url: string;
  cache = defaultCache;
  timeout: number;
  sid: string;
  _error_handler: (action: string, error: string, response?: any) => void;

  constructor(url: string, timeout = 24 * 60 * 60 * 1000) {
    this.url = url;
    this.timeout = timeout;
    this.sid = '';
    
    // Defer initialization to avoid SSR window access
    if (typeof window !== 'undefined') {
      this.sid = util.retrieve('fah-sid', 0) || '';
    }

    this._error_handler = (action, error) => {
      throw { action, error };
    };

    this._check_version();
    this._update_causes();
  }

  get data() { return useApiStore.getState(); }

  sid_clear() {
    util.remove('fah-sid');
    this.sid = '';
  }

  sid_save(sid: string) {
    this.sid = sid;
    util.store('fah-sid', sid);
  }

  get_release() { return 'public'; }

  get_download_url() {
    const release = this.get_release();
    const base    = 'https://foldingathome.org/';
    if (release == 'public') return base + 'download';
    return base + release + '/';
  }

  get_latest_version() { return this.data.latest_version; }

  async _check_version() {
    let latest_version = await this.cache.get('latest-version', this.timeout);
    if (latest_version != undefined) {
      useApiStore.setState({ latest_version });
      return;
    }

    const release = this.get_release();
    const base = 'https://download.foldingathome.org';
    const url  = `${base}/releases/${release}/fah-client/meta.json`;
    
    try {
      const r    = await fetch(url);
      const data = await r.json();

      if (data.length) {
        let version = data[0].version;
        if (version != undefined && version.length == 3) {
          version = version.join('.');
          this.cache.set('latest-version', version, undefined);
          useApiStore.setState({ latest_version: version });
          return;
        }
      }
    } catch (e) {}
  }

  get_causes() { return this.data.causes; }

  async _update_causes() {
    try {
      let causesRaw: any = await this.fetch({
        path: '/project/cause', action: 'Getting project causes',
        expire: this.timeout
      });

      if (!causesRaw) return;

      delete causesRaw[0];
      let causes = Object.values(causesRaw).sort() as string[];
      causes.unshift('any');

      useApiStore.setState({ causes });
    } catch (e) {}
  }

  set_error_handler(handler: any) { this._error_handler = handler; }

  async error(response: any, path: string, method: string, data: any, action: string, cb?: any) {
    action = action || ('API call ' + method + ' ' + path);
    let error = data && data.error ? data.error : (response && response.statusText ? response.statusText : 'Unknown error');

    if (cb) {
      let ret = cb(action, error, response);
      if (ret === false) return;
    }

    let ret = this._error_handler(action, error, response);
    if (ret !== false) throw { action, error };
  }

  async fetch(args: any) {
    const { path, method = 'GET', data, action, expire, error_cb } = args;

    let error = async (r: any, errData?: any) => {
      return this.error(r, path, method, errData, action, error_cb);
    };

    try {
      let url = new URL(this.url + path);
      let config: any = { method, headers: {}, credentials: 'include' };

      // Ensure SID is populated if missing during hydration
      if (!this.sid && typeof window !== 'undefined') {
        this.sid = util.retrieve('fah-sid', 0) || '';
      }

      if (this.sid) {
        config.headers.Authorization = this.sid;
      }

      if (data) {
        if (method == 'GET' || method == 'DELETE') {
          url.search = new URLSearchParams(data).toString();
        } else {
          config.headers['Content-Type'] = 'application/json';
          config.body = JSON.stringify(data);
        }
      }

      if (expire != undefined) {
        let content: any = await this.cache.get(url.toString(), expire, true);
        if (content != undefined) {
          if (content.status == 404) return error(new Response(content.value, { status: 404 }));
          if (!content.status || (200 <= content.status && content.status < 300)) return content.value;
        }
      }

      let r = await fetch(url, config);
      if (r.headers.get('Content-Type')?.includes('application/json')) {
        let content = await r.json();
        if (expire != undefined) await this.cache.set(url.toString(), content, r.status);
        if (!r.ok) return error(r, content);
        return content;
      } else if (!r.ok) {
        return error(r);
      }
    } catch (e) {
      console.debug('API error', e);
      return error(new Response(), { error: 'API error: ' + e });
    }
  }

  async get(path: string, data?: any, action?: string) { return this.fetch({ path, method: 'GET', data, action }); }
  async put(path: string, data?: any, action?: string) { return this.fetch({ path, method: 'PUT', data, action }); }
  async post(path: string, data?: any, action?: string) { return this.fetch({ path, method: 'POST', data, action }); }
  async delete(path: string, data?: any, action?: string) { return this.fetch({ path, method: 'DELETE', data, action }); }
}

export const defaultApi = new API('https://api.foldingathome.org');
