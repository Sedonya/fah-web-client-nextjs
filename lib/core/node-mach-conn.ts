import MachConnection from './mach-connection';
import { cryptoUtil as crypto } from './crypto';
import { util } from './util';

class NodeMachConn extends MachConnection {
  key: any;
  node: any;
  ivs: Record<string, boolean>;

  constructor(mach: any, key: any, node: any) {
    super(mach);
    this.key = key;
    this.node = node;
    this.ivs = {};
  }

  async open() {
    await this._send({
      type:   'session-open',
      session: this.node.sid,
    });
    this.on_open();
  }

  close() { this.on_close(); }

  is_connected() { return true; }

  async send(msg: any) {
    return this._send({
      type:    'message',
      session: this.node.sid,
      content: msg,
    });
  }

  async _send(msg: any) {
    console.debug('Sending:', msg);

    let iv = crypto.get_random(16);

    let payload: any = JSON.stringify(msg);
    payload = await crypto.aes(this.key, iv, payload, true);
    payload = util.urlbase64_encode(payload);

    let encodedIv = util.urlbase64_encode(iv as string);
    this.ivs[encodedIv] = true;

    msg = {type: 'message', id: this.get_id(), iv: encodedIv, payload};
    return this.node.send(msg);
  }

  async receive(msg: any) {
    let iv = msg.iv;
    if (this.ivs[iv]) throw 'IV cannot be used more than once';
    if (1e6 < Object.keys(this.ivs).length) throw 'Too many IVs';
    this.ivs[iv] = true;
    let decodedIv = util.base64_decode(iv);

    let payload = util.base64_decode(msg.payload);
    payload = await crypto.aes(this.key, decodedIv, payload, false);

    if (msg.compression)
      payload = await util.decompress(payload, msg.compression);

    let parsedPayload = JSON.parse(payload);

    if (parsedPayload.session != this.node.sid)
      throw 'Message not for this session';

    this.on_message(parsedPayload.content);
  }
}

export default NodeMachConn;
