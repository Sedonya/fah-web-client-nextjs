function is_object(o: any) { return o != null && typeof o === 'object'; }

class Updatable {
  constructor(data: any) {
    Object.assign(this, Updatable.clean_keys(data));
  }

  static clean_key(key: any): any {
    if (typeof key == 'string' && key.length <= 16)
      return key.replace('-', '_');
    return key;
  }

  static clean_keys(data: any): any {
    if (Array.isArray(data)) {
      let r = [];
      for (const value of data)
        r.push(Updatable.clean_keys(value));
      return r;
    }

    if (is_object(data)) {
      let r: any = {};
      for (const [key, value] of Object.entries(data))
        r[Updatable.clean_key(key)] = Updatable.clean_keys(value);
      return r;
    }

    return data;
  }

  do_update(update: any[]) {
    let obj: any = this;
    let i = 0;

    while (i < update.length - 2) {
      let key = Updatable.clean_key(update[i++]);

      if (obj[key] == undefined)
        obj[key] = Number.isInteger(update[i]) ? [] : {};

      obj = obj[key];
    }

    let is_array = Array.isArray(obj);
    let key      = Updatable.clean_key(update[i++]);
    let value    = update[i];

    if      (is_array && key   === -1)   obj.push(value);
    else if (is_array && key   === -2)   obj.splice(obj.length, 0, ...value);
    else if (is_array && value === null) obj.splice(key, 1);
    else if (value === null)             delete obj[key];
    else                                 obj[key] = value;
  }
}

export default Updatable;
