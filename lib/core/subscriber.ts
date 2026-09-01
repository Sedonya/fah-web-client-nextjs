class Subscriber {
  sock: any;
  subscribers: Record<string, any>;
  data: any[];
  max_count: number;
  period: number;
  msg: any;
  cache?: Cache;
  ref?: string;
  cachePromise?: Promise<void>;
  subscribed?: boolean;

  constructor(sock: any, max_count = 10000, period = 3600) {
    this.sock        = sock;
    this.subscribers = {};
    this.data        = [];
    this.max_count   = max_count;
    this.period      = period;
    this.msg         = {};
  }

  get has_subscribers() { return 0 < Object.keys(this.subscribers).length; }

  add_subscriber(cb: any) {
    let id = this.sock.nextID++;
    this.subscribers[id] = cb;
    this.data.map(cb);
    this.update();
    return id;
  }

  del_subscriber(id: any) {
    delete this.subscribers[id];
    this.update();
  }

  _get_message(type: string) { return Object.assign({type}, this.msg); }

  async _cache_save() {
    if (!this.cache) return;
    let res = new Response(JSON.stringify(this.data));
    return this.cache.put('/data', res);
  }

  async __cache_load() {
    if (typeof caches === 'undefined') return;
    const startTime = performance.now();
    this.cache = await caches.open('fah-' + this.ref);

    let res = await this.cache.match('/data');
    if (!res) return;

    this.data = await res.json();
    this.data.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const loadedEntries = this.data.length;
    this._limit_data();
    this._notify(this.data);
    const endTime = performance.now();
    console.log("__cache_load for fah-" + this.ref + " took " +
                (endTime - startTime) + " ms to load " +
                loadedEntries + " entries");
  }

  async _cache_load() {
    if (!this.cachePromise) this.cachePromise = this.__cache_load();
    return await this.cachePromise;
  }

  async _subscribe() {
    await this._cache_load();
    if (!this.sock.connected) return this.sock.connect();
    if (this.subscribed) return;

    let msg = this._get_message('subscribe');
    msg.max_count = this.max_count;
    if (this.data.length) msg.since = this.data[this.data.length - 1].time;

    this.sock.send(msg);
    this.subscribed = true;
  }

  _unsubscribe() {
    if (this.sock.connected) this.sock.send(this._get_message('unsubscribe'));
    this.subscribed = false;
  }

  _notify(data: any[]) {
    Object.values(this.subscribers).map(cb => {data.map(cb)});
  }

  update() {
    if (!this.subscribed && this.has_subscribers) this._subscribe();
    if (this.subscribed && !this.has_subscribers) this._unsubscribe();
  }

  _limit_data() {
    if (this.max_count < this.data.length)
      this.data.splice(0, this.data.length - this.max_count);
  }

  add_data(_data: any[]) {
    let data: any[] = [];
    let last = this.data[this.data.length - 1];

    for (let entry of _data) {
      if (last != undefined) {
        let lastTime = new Date(last.time).getTime() / 1000;
        let thisTime = new Date(entry.time).getTime() / 1000;
        let steps    = Math.round((thisTime - lastTime) / this.period);

        if (steps < this.max_count)
          for (let i = 1; i < steps; i++) {
            let time = new Date((lastTime + this.period * i) * 1000);
            data.push({time: time.toISOString(), value: last.value});
          }
        else {
          data      = [];
          this.data = [];
        }
      }

      data.push(entry);
      last = entry;
    }

    this._notify(data);
    this.data.push(...data);
    this._limit_data();
    this._cache_save();
  }

  on_message(msg: any) {
    let data = Array.isArray(msg.data) ? msg.data.reverse() : [msg.data];
    this.add_data(data);
  }

  on_open()  {this.update();}
  on_close() {this.subscribed = false;}
}

export default Subscriber;
