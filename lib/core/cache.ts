export class Cache {
  name: string;
  timeout: number;
  cache?: any;
  _cache?: Record<string, any>;

  constructor(name: string, timeout: number) {
    this.name = name;
    this.timeout = timeout;
  }

  async set(key: string, value: any, status?: any) {
    let data = {ts: new Date().toISOString(), value, status};

    try {
      if (!this.cache) this.cache = await caches.open(this.name);
      await this.cache.put(key, new Response(JSON.stringify(data)));
    } catch (e) {
      if (!this._cache) this._cache = {};
      this._cache[key] = data;
    }
  }

  async get(key: string, timeout?: number, withStatus = false) {
    let data;
    if (timeout == undefined) timeout = this.timeout;

    try {
      if (!this.cache) this.cache = await caches.open(this.name);

      let res = await this.cache.match(key);
      if (!res) return;
      data = await res.json();
    } catch (e) {
      if (!this._cache) this._cache = {};
      data = this._cache[key];
    }

    if (data && (!timeout || Date.now() - new Date(data.ts).getTime() < timeout))
      return withStatus ? data : data.value;
  }
}

export const defaultCache = new Cache('fah-web-cache', 24 * 60 * 60 * 1000);
