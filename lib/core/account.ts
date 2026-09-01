import { create } from 'zustand';
import Unit from './unit';
import { util } from './util';
import { cryptoUtil as crypto } from './crypto';
import { defaultApi as api } from './api';

// We will export these from their respective files once we port them.
// For now, we stub or dynamically get them to avoid circular dependency issues if any.
import { defaultNode as node } from './node';
import { defaultMachines as machs } from './machines';
import { useAccountStore } from './stores';

function get_redirect() {
  if (typeof location === 'undefined') return '';
  return location.href.replace(/\/?#.*$/, '');
}

class Account {
  util = util;
  crypto = crypto;
  api = api;
  provider: any;
  secret: any;
  _last_update?: number;

  constructor() {
    this.provider = this.util.retrieve('fah-provider', 0);
    this._secret_load();
  }

  get data() { return useAccountStore.getState().data; }

  set_data(data: any) {
    useAccountStore.getState().setData(data);
  }

  get_columns() {
    if (typeof document === 'undefined') return Unit.default_columns;
    if (document.body.clientWidth <= 520) return Unit.minimal_columns;
    if (document.body.clientWidth <= 800) return Unit.default_columns;
    let columns = (this.data.config || {}).columns;
    return (columns && columns.length) ?
      columns.filter(Unit.has_field) : Unit.default_columns;
  }

  async _secret_load() {
    let secret = this.util.retrieve('fah-secret', 0);
    if (secret) {
      this.secret = this.util.base64_decode(secret);
      this.set_data({ unlocked: true });
    }
  }

  async _secret_save(prikey: any) {
    this.secret = await this.crypto.pkcs8_export(prikey);
    this.util.store('fah-secret', this.util.base64_encode(this.secret));
    this.set_data({ unlocked: true });
  }

  _secret_clear() {
    this.util.remove('fah-secret');
    delete this.secret;
    this.set_data({ unlocked: false });
  }

  async save_credentials(id: any, password: any, name?: any, iconURL?: any) {
    let data: any = {id, password, name, iconURL};
    if (typeof window !== 'undefined' && (window as any).PasswordCredential)
      return navigator.credentials.store(new (window as any).PasswordCredential(data));
  }

  async register(config: any) {
    const {user, team, passkey, avatar, node: nodeVal, email, passphrase} = config;
    const salt = email.toLowerCase();
    const {pubkey, password, secret, key} = await this.create_secret(passphrase, salt);

    const verify_url = location.origin + '/verify/';
    const data = {
      user, team, passkey, avatar, node: nodeVal, email, password, pubkey, secret,
      verify_url
    };

    await this.api.put('/register', data, 'Registering');
    return this.save_credentials(email, passphrase, user, avatar);
  }

  async request_reset(config: any) {
    const data = {email: config.email, url: location.origin + '/reset/'};
    return this.api.put('/reset', data, 'Requesting account reset');
  }

  async reset(config: any) {
    const {token, email, passphrase} = config;
    const salt = email.toLowerCase();
    const {pubkey, password, secret, key} = await this.create_secret(passphrase, salt);

    return this.api.put('/reset/' + token, {pubkey, password, secret}, 'Resetting account');
  }

  async login_with_passphrase(config: any) {
    const {email, passphrase} = config;
    const salt = await this.crypto.sha256(email.toLowerCase());
    const {hash, key} = await this.derive_password(passphrase, salt);

    let data = await this.api.fetch({
      path: '/login',
      data: {email, password: hash},
      action: 'Signing in'
    });

    this.api.sid_save(data.id);
    await this.save_credentials(email, passphrase);
    await this.retrieve_secret(hash, key, salt);
    await this.update();

    const mach = this.machs?.get_direct();
    if (mach) await mach.auto_link();
  }

  async login(provider: any) {
    this.api.sid_clear();
    if (provider) this.util.store('fah-provider', provider);

    try {
      let config = {redirect_uri: get_redirect()};
      let data = await this.api.get('/login/' + provider, config, 'Logging in');
      this.api.sid_save(data.id);
      // await this.save_credentials(email, passphrase) // Error in original logic: email/passphrase undefined
      location.href = data.redirect;
    } catch(e) { console.log('api.login() failed', e); }
  }

  async derive_password(passphrase: any, salt: any) {
    let L = await this.crypto.pbkdf2_derive(passphrase, salt);
    let H = await this.crypto.sha256(await this.crypto.raw_export(L));
    return {hash: this.util.base64_encode(H), key: L};
  }

  async create_secret(passphrase: any, salt: any) {
    let K: any = await this.crypto.rsa_gen();
    let P = await this.crypto.spki_export(K.publicKey);
    salt  = await this.crypto.sha256(salt);
    let {hash, key} = await this.derive_password(passphrase, salt);
    let W = await this.crypto.pkcs8_wrap(key, K.privateKey, salt);

    W = this.util.base64_encode(W as string);
    P = this.util.base64_encode(P as string);

    return {pubkey: P, password: hash, secret: W, key: K};
  }

  async new_secret(passphrase: any, email: any) {
    const salt = email.toLowerCase();
    const {pubkey, password, secret, key} = await this.create_secret(passphrase, salt);

    const data = {pubkey, password, secret};
    await this.api.put('/account/secret', data, 'Storing account secret');
    await this._secret_save(key.privateKey);
    await this.update();
  }

  async lock_secret() { this._secret_clear(); }

  async retrieve_secret(password: any, key: any, iv: any) {
    let W = await this.api.get('/account/secret', {password}, 'Retrieving account secret');
    let decodedW = this.util.base64_decode(W.secret);
    let prikey = await this.crypto.pkcs8_unwrap(key, decodedW, iv);
    await this._secret_save(prikey);
  }

  async unlock_secret(passphrase: any, salt: any) {
    salt = await this.crypto.sha256(salt);
    let {hash, key} = await this.derive_password(passphrase, salt);
    this.retrieve_secret(hash, key, salt);
  }

  async update(ts?: any) {
    if (ts && this._last_update && ts < this._last_update) return;
    this._last_update = Date.now();

    if (this.api.sid) {
      try {
        let account = await this.api.fetch({
          path: '/account', action: 'Logging in', error_cb:
          (action: string, error: any, r: any) => {
            if (r.status == 401) this.api.sid_clear();
          }
        });

        if (!account.pubkey) {
           useAccountStore.getState().clearData();
        } else {
          let pubkey = this.util.base64_decode(account.pubkey);
          pubkey     = await this.crypto.spki_import(pubkey);
          account.id = await this.crypto.pubkey_id(pubkey);
          this.set_data(account);
        }
      } catch (e) { console.error('Login failed', e); }
    }

    if (typeof this.data.config == 'string') {
      this.set_data({ config: JSON.parse(this.data.config) });
    }

    return this.data;
  }

  async try_login() {
    if (this.util.query_get('state')) {
      await this.api.get('/login/' + this.provider + location.search, undefined, 'Logging in');
      location.search = '';
      throw 'Logging in';
    }
    return this.update();
  }

  get logged_in() { return !!this.data.created; }

  loggedout() {
    this.api.sid_clear();
    this._secret_clear();
    useAccountStore.getState().clearData();
  }

  async logout() {
    let data = this.data;
    if (data.node) {
        // Handle node state clearing if necessary
    }
    await this.api.put('/logout', undefined, 'Logging out');
    this.loggedout();
  }

  async check(create_dialog: any) {
    if (!this.data.user) return;

    if (!this.logged_in) {
      let account = await create_dialog();

      if (account) {
        account.passkey = account.passkey || undefined;
        try {
          await this.api.put('/account', account, 'Creating account');
        } catch(e) {}
      }
      this.logout();
    }
  }

  async delete() {
    await this.api.delete('/account', undefined, 'Deleting account');
    if (this.node) await this.node.broadcast('restart');
    this.loggedout();
  }

  async save(data: any) {
    let restart = data.node != this.data.node;
    await this.api.put('/account', data, 'Saving account data');
    if (this.node) await this.node.broadcast('config', {config: data});
    if (restart && this.node) await this.node.broadcast('restart');
    this.set_data(data);
  }

  async reset_token() {
    await this.api.post('/account/token', null, 'Resetting account token');
    await this.update();
  }
}

export const account = new Account();
