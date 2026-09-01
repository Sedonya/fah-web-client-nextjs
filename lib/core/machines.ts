import { create } from 'zustand';
import Machine from './machine';
import Unit from './unit';
import { account } from './account';
import { defaultNode as node } from './node';
import { useMachinesStore, useAccountStore } from './stores';

class Machines {
  wus_enabled?: boolean;

  constructor() {
    setTimeout(() => {
      let prevMachinesConfig: any;
      
      useAccountStore.subscribe((state) => {
        let currentMachinesConfig = state.data.machines;
        if (currentMachinesConfig !== prevMachinesConfig) {
          prevMachinesConfig = currentMachinesConfig;
          
          if (!currentMachinesConfig) return;

          let found: Record<string, boolean> = {};
          for (let config of currentMachinesConfig) {
            let mach = this.get(config.id);
            if (!mach) mach = this.add(config.id);
            mach.set_name(config.name);
            found[config.id] = true;
          }

          for (let mach of Array.from(this as any)) {
            if (!found[(mach as Machine).get_id()]) {
              if ((mach as Machine).is_direct()) continue;
              (mach as Machine).close();
              this.del((mach as Machine).get_id());
            }
          }
        }
      });
    }, 0);
  }

  get is_empty() { return !this.count; }
  get count() { return Array.from(this as any).length; }

  *[Symbol.iterator]() {
    for (let mach of Object.values(useMachinesStore.getState().machines))
      if (!mach.is_hidden()) yield mach;
  }

  set(id: string, mach: Machine) {
    let machines = useMachinesStore.getState().machines;
    if (machines[id]) {
      if (machines[id] == mach) return;
      machines[id].close();
    }

    useMachinesStore.setState({ machines: { ...machines, [id]: mach } });
    if (this.wus_enabled !== undefined) {
      mach.wus_enable(this.wus_enabled);
    }
  }

  has(id: string) { return id in useMachinesStore.getState().machines; }
  get(id: string, createIfMissing = true) { 
    return useMachinesStore.getState().machines[id];
  }

  add(id: string) {
    let mach = this.create(id);
    this.set(id, mach);
    return mach;
  }

  del(id: string) {
    let machines = { ...useMachinesStore.getState().machines };
    delete machines[id];
    useMachinesStore.setState({ machines });
  }

  create(id: string) { return new Machine(id); }

  get_direct_id() {
    let mach = this.get_direct();
    if (mach) return mach.get_id();
  }

  get_direct() { return useMachinesStore.getState().machines['__direct__']; }

  get_direct_config(group: any) {
    let mach = this.get_direct();
    return mach ? mach.get_config(group) : {};
  }

  *get_units() {
    let found: Record<string, boolean> = {};

    for (let mach of Array.from(this as any)) {
      let units = ((mach as Machine).get_data().wus || []).concat((mach as Machine).get_units());

      for (let unit of units) {
        if (!(unit instanceof Unit)) unit = new Unit(unit, mach);

        if (unit.id && unit.project && !found[unit.id]) {
          found[unit.id] = true;
          yield unit;
        }
      }
    }
  }

  get_unit(id: string) {
    for (let unit of this.get_units())
      if (unit.id == id) return unit;
    return {} as any;
  }

  active_unit_sum(fn: (unit: any) => number) {
    return Array.from(this as any).reduce((sum: number, mach: any) => {
      if (!mach.is_recently_connected()) return sum;

      return mach.get_units().reduce((sum: number, unit: any) => {
        if (unit.state != 'RUN' && !unit.finish) return sum;
        let value = fn(unit);
        return sum + (isFinite(value) ? value : 0);
      }, sum);
    }, 0);
  }

  get ppd() { return this.active_unit_sum(unit => unit.unit.ppd); }

  async set_state(state: string) {
    await node.broadcast('state', {state});

    for (let mach of Array.from(this as any))
      if ((mach as Machine).is_direct())
        await (mach as Machine).set_state(state);
  }

  wus_enable(enable: boolean) {
    for (let mach of Array.from(this as any))
      (mach as Machine).wus_enable(enable);

    this.wus_enabled = enable;
  }
}

export const defaultMachines = new Machines();
