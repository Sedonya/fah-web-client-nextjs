class MachConnection {
  mach: any;

  constructor(mach: any) { this.mach = mach; }

  is_connected()  { return false; }
  is_direct()     { return false; }

  get_id()        { return this.mach.get_id(); }

  on_open()       { this.mach.on_open(); }
  on_close()      { this.mach.on_close(); }
  on_message(msg: any) { this.mach.on_message(msg); }

  async send(msg: any) {}
  async receive(msg: any) {}
  close() {}
}

export default MachConnection;
