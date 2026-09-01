import MachConnection from './mach-connection';
import Sock from './sock';
import { util } from './util';
import { defaultMachines as machs } from './machines';
import Machine from './machine';

class DirectMachConn extends MachConnection {
  initialized: boolean;
  address?: string;
  sock?: Sock;
  _ping_timer?: any;

  constructor(name: any, address = '127.0.0.1:7396') {
    super(machs.create('__direct__'));

    this.initialized = false;
    this.mach.set_conn(this);
    this.set_address(address);
    machs.set('__direct__', this.mach);
  }

  set_address(address: string) {
    if (this.address == address) return;
    this.address = address;

    if (this.sock) {
      this.sock.on_open    = () => {};
      this.sock.on_close   = () => {};
      this.sock.on_message = () => {};
      this.sock.close();
      delete this.sock;
      this._on_close(undefined);
    }

    this.mach.set_name('direct');
    // Using setState instead of direct data mutation for Zustand compatibility
    this.mach.setState({ data: {} });

    let url  = 'ws://' + address + '/api/websocket';
    this.sock = new Sock(url);
    this.sock.on_open    = ()    => this._on_open(undefined);
    this.sock.on_close   = (event: any) => this._on_close(event);
    this.sock.on_message = (msg: any)   => this._on_message(msg);

    this.open();
  }

  open() { if (this.sock) this.sock.connect(); }

  is_connected()  { return !!(this.sock && this.sock.connected); }
  is_direct()     { return true; }
  async send(msg: any) { return this.sock ? this.sock.send(msg) : undefined; }

  _clear_ping() {
    if (this._ping_timer != undefined) clearTimeout(this._ping_timer);
    delete this._ping_timer;
  }

  _update_ping() {
    if (util.version_less('8.1.17', this.mach.get_version())) {
      this._clear_ping();
      this._ping_timer = setTimeout(() => {
        console.log(this.mach.get_name() + ': timed out');
        if (this.sock) this.sock.close();
      }, 30000);
    }
  }

  _on_open(event: any) { this.on_open(); }

  _on_close(event: any) {
    this._clear_ping();
    this.on_close();
    this.initialized = false;
    if (this.sock) setTimeout(() => this.sock?.connect(), 1000);
  }

  _on_message(msg: any) {
    this._update_ping();
    this.on_message(msg);

    if (!this.initialized) {
      let info = this.mach.get_info();

      if (info.version) {
        this.initialized = true;

        console.debug('Direct Client Version', info.version);
        let last_version = util.retrieve('fah-last-version');
        let our_version  = '8.1.18'; // Fallback version since we don't use Vite import.meta.env anymore

        if (util.version_less(our_version, info.version) &&
            (!last_version ||
              util.version_less(last_version, info.version))) {
          util.store('fah-last-version', info.version);

          if (typeof location !== 'undefined' && location.hostname.indexOf('foldingathome.org') != -1) {
            if (!info.url) location.reload();
            else location.replace(info.url);
          }
        }

        if (info.id) {
          let node_mach = machs.get(info.id);
          if (node_mach) this.mach.dup_state(node_mach);
          this.mach.setState({ id: info.id });
        }

        if (info.mach_name) this.mach.set_name(info.mach_name);

        this.mach.auto_link();
      }
    }
  }
}

export default DirectMachConn;
