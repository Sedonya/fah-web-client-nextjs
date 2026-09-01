export class Sock {
  url: string;
  timeout: number;
  connected: boolean;
  ws?: WebSocket;
  timer?: any;

  constructor(url: string, timeout = 20000) {
    this.url       = url;
    this.timeout   = timeout;
    this.connected = false;
  }

  set_url(url: string) { this.url = url; }
  set_timeout(timeout: number) { this.timeout = timeout; }

  on_message(msg: any) { console.log('WS:', msg); }
  on_open(event: any)  {}
  on_close(event: any) {}
  on_error(event: any) {}

  _clear_timeout() { clearTimeout(this.timer); }

  _open(event: any) {
    this.connected = true;
    this._clear_timeout();
    this.on_open(event);
  }

  _close(event: any) {
    this._clear_timeout();
    this.connected = false;
    this.ws = undefined;
    this.on_close(event);
  }

  _error(event: any) { this.on_error(event); }
  _message(event: any) { this.on_message(JSON.parse(event.data)); }
  _timeout() { this.close(); }

  close() {
    if (this.ws) this.ws.close();
    this._clear_timeout();
  }

  connect() {
    if (this.ws != undefined) return;
    if (typeof WebSocket === 'undefined') return;

    console.debug('Connecting to ' + this.url);

    this.ws = new WebSocket(this.url);

    this.ws.onopen    = e => this._open(e);
    this.ws.onclose   = e => this._close(e);
    this.ws.onerror   = e => this._error(e);
    this.ws.onmessage = e => this._message(e);

    this.timer = setTimeout(() => this._timeout(), this.timeout);
  }

  send(msg: any) {
    if (this.connected && this.ws) this.ws.send(JSON.stringify(msg));
    else console.debug('Cannot send message, not connected:', msg);
  }
}

export default Sock;
