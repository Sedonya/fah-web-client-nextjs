import Updatable from './updatable';
import Unit      from './unit';
import { util } from './util';
import { account } from './account';
import { defaultApi as api } from './api';
import { defaultCache as cache } from './cache';
import { defaultMachines as machs } from './machines';
import { useMachineStore } from './stores';

class Machine {
  id: string;
  aid: string;
  conn: any;
  first: boolean = false;
  vizUnit?: string;
  logEnabled?: boolean;
  wusEnabled?: boolean;

  constructor(id: string) {
    this.id = id;
    this.aid = account.data.id;

    // Initialize state
    useMachineStore.setState((state) => ({
      states: {
        ...state.states,
        [id]: {
          id,
          name: id,
          connected: false,
          last_connected: 0,
          data: {}
        }
      }
    }));
  }

  get state() {
    return useMachineStore.getState().states[this.id];
  }

  setState(updates: any) {
    useMachineStore.setState((state) => ({
      states: {
        ...state.states,
        [this.id]: { ...state.states[this.id], ...updates }
      }
    }));
  }

  get_id()      {return this.state.id}
  get_name()    {return this.state.name}
  get_data()    {return this.state.data}
  get_viz(unit: string) {return (this.get_data().viz || {})[unit] || {}}
  get_url(path: string) {return this.get_id() + path}
  get_info()    {return this.get_data().info || {}}
  get_version() {return this.get_info().version}
  get_os()      {return this.get_info().os}
  get_groups()  {return Object.keys(this.get_data().groups || {'': null})}
  get_group(name = '') {return (this.get_data().groups || {})[name] || {}}

  get_title() {
    if (this.is_direct()) return 'Direct client at ' + this.conn.address;
    return 'F@H ID ' + this.get_id();
  }

  get_config(group?: string) {
    if (group == undefined) return this.get_data().config || {};
    return this.get_group(group).config || {};
  }

  get_resources(group = '', max_length?: number) {
    let l = [];
    let config = this.get_config(group);

    if (config.cpus) l.push(config.cpus + ' CPUs');

    for (let gpu of this.get_gpus(group))
      l.push(gpu.description);

    let s = l.length ? l.join(', ') : 'No resources';

    if (max_length && max_length < s.length)
      return s.substring(0, max_length - 3) + '...';

    return s;
  }

  has_resources(group = '') {
    return this.get_config(group).cpus || this.get_gpus(group).length;
  }

  get_conn() {return this.conn}
  set_conn(conn?: any) {this.conn = conn}
  is_direct() {return this.get_conn() && this.get_conn().is_direct()}

  get_units() {
    return (this.get_data().units || []).map(
      (unit: any) => new Unit(unit, this)
    );
  }

  is_hidden() {
    if (this.is_direct())
      return !this.is_connected() && !util.get_direct_address();

    return this.get_id() == machs.get_direct_id();
  }

  is_empty() { return !this.get_units().length; }
  set_name(name: string) { this.setState({ name }); }

  async save_name(name: string) {
    this.set_name(name);
    await api.put('/account/machines/' + this.get_id(), {name}, 'Saving machine name');
    this.send_command('restart');
  }

  is_outdated() {
    // get_latest_version doesn't exist on API yet in this port, we should stub or implement it
    const latest  = (api as any).get_latest_version ? (api as any).get_latest_version() : undefined;
    const current = this.get_version();
    return latest && current && util.version_less(current, latest);
  }

  is_connected() {return this.state.connected}

  is_recently_connected() {
    return this.is_connected() ||
      new Date().getTime() < this.state.last_connected + 5 * 60 * 1000;
  }

  is_paused(group?: string): boolean {
    if (group != undefined) return this.get_config(group).paused;

    for (let g of this.get_groups())
      if (!this.is_paused(g))
        return false;

    return true;
  }

  is_active() {
    if (!this.is_connected()) return false;

    for (let unit of this.get_units())
      if (!unit.paused) return true;

    return false;
  }

  is_linked() {
    let aid = this.get_info().account;
    let current_aid = account.data.id;
    return current_aid ? aid == current_aid : !!aid;
  }

  get_gpus(group = '') {
    let info   = this.get_info();
    let config = this.get_config(group);
    let gpus   = [];

    if (config.gpus && info.gpus)
      for (let id in config.gpus)
        if (info.gpus[id] && config.gpus[id].enabled)
          gpus.push(info.gpus[id]);

    return gpus;
  }

  async send_command(cmd: string, data = {}) {
    data = Object.assign({}, data, {cmd, time: new Date().toISOString()});
    return this.send(data);
  }

  async set_state(state: string, group?: string) {
    let data: any = {state};
    if (group != undefined) data.group = group;
    return this.send_command('state', data);
  }

  async auto_link() {
    if (!this.is_connected()) return;

    let token = account.data.token;
    if (!token || this.get_info().account) return;

    await this.link(token);

    console.log('Auto-linking client');
  }

  async dump(unit: any)        {return this.send_command('dump',   {unit})}
  async configure(config: any) {return this.send_command('config', {config})}

  async link(token: string)       {
    return this.send_command('link', {token, name: this.get_name()});
  }

  async unlink() {
    await api.delete('/account/machines/' + this.get_id(), undefined, 'Unlinking machine');
    if (this.is_connected()) this.send_command('restart');
  }

  visualize_unit(unit: any) {
    if (this.vizUnit == unit) return;
    this.vizUnit = unit;
    this._send_viz_enable();
  }

  log_enable(enable: boolean) {
    if (this.logEnabled == enable) return;
    console.debug(this.get_name() + ': log ' +
      (enable ? 'enabled' : 'disabled'));
    this.logEnabled = enable;
    this._send_log_enable();
  }

  wus_enable(enable: boolean) {
    if (this.wusEnabled == enable) return;
    this.wusEnabled = enable;
    this._send_wus_enable();
  }

  async send(msg: any) {
    console.debug(this.get_name(), msg);
    return this.get_conn().send(msg);
  }

  on_open()  {this.first = true}

  on_close() {
    this.setState({ connected: false, last_connected: new Date().getTime() });
  }

  close()    {if (this.get_conn()) this.get_conn().close()}

  async on_message(msg: any) {
    console.debug(this.get_name() + ':', msg);

    if (this.first) {
      this.first = false;
      this.setState({ connected: true, data: new Updatable(msg) });

      if (this.vizUnit)    this._send_viz_enable();
      if (this.logEnabled) this._send_log_enable();
      if (this.wusEnabled) this._send_wus_enable();

    } else if (Array.isArray(msg)) {
      let data = this.state.data;
      if (data && typeof data.do_update === 'function') {
        data.do_update(msg);
        // trigger reactivity by cloning or simply setState data again (since Updatable mutated itself)
        this.setState({ data });
      }

      if (msg.length && msg[0] == 'viz') {
        let key   = msg.slice(0, -1).join('/');
        let value = msg.slice(-1)[0];
        await cache.set(key, value);
      }

      let log = this.state.data.log || [];
      const maxLog = 1e5;
      if (maxLog < log.length) {
        log.splice(0, log.length - maxLog);
        log.splice(0, log.length / 3);
        this.setState({ data: this.state.data });
      }
    }
  }

  async _viz_get_frames(unit: string) {
    const data = this.get_data();
    if (!data.viz) data.viz = {};

    let viz = this.get_viz(unit);

    if (!viz.topology) {
      let key = 'viz/' + unit + '/topology';
      viz.topology = await cache.get(key, 0);
    }

    if (!viz.frames) viz.frames = [];

    if (viz.topology) {
      for (let i = 0; i < 1000; i++) {
        if (viz.frames[i]) break;
        let key = 'viz/' + unit + '/frames/' + i;
        let frame = await cache.get(key, 0);
        if (!frame) break;
        viz.frames[i] = frame;
      }
      data.viz[unit] = viz;
      this.setState({ data });
    }

    return viz.frames.length;
  }

  dup_state(mach: any) {
    this.visualize_unit(mach.vizUnit);
    this.log_enable(mach.logEnabled);
    this.wus_enable(mach.wusEnabled);
  }

  async _send_viz_enable() {
    if (!this.is_connected()) return;
    const unit  = this.vizUnit;
    const frame = await this._viz_get_frames(unit!);
    this.send_command('viz', {unit, frame});
  }

  _send_log_enable() {
    if (this.is_connected()) this.send_command('log', {enable: this.logEnabled});
  }

  _send_wus_enable() {
    if (this.is_connected()) this.send_command('wus', {enable: this.wusEnabled});
  }
}

export default Machine;
