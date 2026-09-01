import Sock from './sock';
import NodeMachConn from './node-mach-conn';
import { util } from './util';
import { cryptoUtil as crypto } from './crypto';
import { account } from './account';
import { defaultMachines as machs } from './machines';
import { useNodeStore, useAccountStore } from './stores';

class Node extends Sock {
  util = util;
  crypto = crypto;
  id?: string;
  sid?: string;
  sigkey?: any;
  deckey?: any;

  constructor(...args: any[]) {
    super(undefined as any, ...args);

    // Watch for account changes to trigger login
    setTimeout(() => {
      let prevNode: any;
      let prevSecret: any;
      useAccountStore.subscribe((state) => {
        if (state.data.node !== prevNode || account.secret !== prevSecret) {
          prevNode = state.data.node;
          prevSecret = account.secret;
          this.login();
        }
      });
    }, 0);
  }

  is_loading() { return useNodeStore.getState().loading; }

  async _mach_add(msg: any) {
    let pubkey = await this.crypto.spki_import(this.util.base64_decode(msg.pubkey));
    let id = await this.crypto.pubkey_id(pubkey);

    let signature = this.util.base64_decode(msg.signature);
    let data      = JSON.stringify(msg.payload);
    let result    = await this.crypto.rsa_verify(pubkey, signature, data);
    if (!result) throw 'Invalid machine signature';

    if (msg.payload.account != this.id)
      throw ('Machine login ' + msg.payload.account + ' is not for this account ' + this.id);

    let key = this.util.base64_decode(msg.payload.key);
    key = await this.crypto.rsa_decrypt(this.deckey, key);
    key = await this.crypto.aes_import(key);

    let mach = machs.get(id);

    if (!mach) {
      await account.update();
      mach = machs.get(id, false);
    }

    if (mach) {
      console.log('Adding node machine connection', id);
      let conn = new NodeMachConn(mach, key, this);
      mach.set_conn(conn);
      await conn.open();
    } else console.debug('Ignoring new node client connection', id);
  }

  async _mach_del(id: string) {
    let mach = machs.get(id);
    if (!mach || mach.is_direct()) return;

    console.log('Closing node machine connection', id);

    mach.close();
    mach.set_conn();
  }

  async _mach_msg(msg: any) {
    let mach = machs.get(msg.client);
    if (mach && mach.get_conn()) (mach.get_conn() as any).receive(msg);
  }

  async on_broadcast(msg: any) {
    let apub      = account.data.pubkey;
    let pubkey    = await this.crypto.spki_import(this.util.base64_decode(apub));
    let signature = this.util.base64_decode(msg.signature);
    await this.crypto.rsa_verify(pubkey, signature, JSON.stringify(msg.payload));

    console.debug('broadcast:', msg.payload);

    let cmd = msg.payload.cmd;
    if (cmd == 'restart' || cmd == 'config') {
      let ts = new Date(msg.payload.time).getTime();
      await account.update(ts);
    }
  }

  on_message(msg: any) {
    switch (msg.type) {
    case 'connect':    return this._mach_add(msg.client);
    case 'disconnect': return this._mach_del(msg.id);
    case 'message':    return this._mach_msg(msg);
    case 'broadcast':  return this.on_broadcast(msg);
    default: throw 'Unsupported account message type "' + msg.type + '"';
    }
  }

  on_open(event: any) { this._login(); }

  on_close(event: any) {
    const state = useNodeStore.getState();
    if (!state.active) return;

    console.log('Account closed');

    for (let mach of Array.from(machs as any)) {
      if (!(mach as any).is_direct()) {
        (mach as any).close();
      }
    }

    if (account.data.node) {
      fetch('https://' + account.data.node, {mode: 'no-cors'}).catch(() => {});
    }

    if (state.active) setTimeout(() => this.connect(), 1000);
  }

  on_error(event: any) { console.debug('WS error', event); }

  async _login() {
    setTimeout(() => useNodeStore.setState({ loading: false }), 8000);

    let apub = this.util.base64_decode(account.data.pubkey);
    apub     = await this.crypto.spki_import(apub);
    this.id  = await this.crypto.pubkey_id(apub);

    this.sid    = this.util.urlbase64_encode(this.crypto.get_random(12));
    let payload = {time: new Date().toISOString(), session: this.sid};
    let signature = await this.crypto.rsa_sign(this.sigkey, JSON.stringify(payload));

    let msg = {
      type: 'login',
      payload,
      pubkey: account.data.pubkey,
      signature: this.util.urlbase64_encode(signature as string),
    };

    this.send(msg);
  }

  async login() {
    const state = useNodeStore.getState();
    if (state.active) await this.logout();
    if (!account.data.node || !account.secret) return;

    useNodeStore.setState({ active: true, loading: true });

    let secret  = account.secret;
    this.deckey = await this.crypto.pkcs8_import(secret, 'RSA-OAEP');
    this.sigkey = await this.crypto.pkcs8_import(secret, 'RSASSA-PKCS1-v1_5');

    this.set_url('wss://' + account.data.node + '/ws/account');
    this.connect();
  }

  async logout() {
    useNodeStore.setState({ active: false });

    let machList = Array.from(machs as any);
    for (let mach of machList)
      if (!(mach as any).is_direct()) {
        (mach as any).close();
        machs.del((mach as any).get_id());
      }

    await this.close();
  }

  async broadcast(cmd: string, data = {}) {
    const state = useNodeStore.getState();
    if (!state.active) return;

    let payload   = Object.assign({cmd, time: new Date().toISOString()}, data);
    let signature = await this.crypto.rsa_sign(this.sigkey, JSON.stringify(payload));
    let encodedSig = this.util.urlbase64_encode(signature as string);

    console.debug('Broadcasting:', payload);
    this.send({type: 'broadcast', payload, signature: encodedSig});
  }
}

export const defaultNode = new Node();
