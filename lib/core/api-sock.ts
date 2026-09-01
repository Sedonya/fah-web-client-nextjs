import Sock from './sock';
import Subscriber from './subscriber';

class TeamSubscriber extends Subscriber {
  ref: string;
  msg: any;

  constructor(sock: any, team: string, max_count = 10000) {
    super(sock, max_count);
    this.ref = `team-${team}`;
    this.msg = {timeseries: 'team.score', team, '$ref': this.ref};
  }
}

class UserSubscriber extends Subscriber {
  ref: string;
  msg: any;

  constructor(sock: any, uid: string, pid: string, max_count = 10000) {
    super(sock, max_count);
    this.ref = `user-${uid}-${pid}`;
    this.msg = {timeseries: 'user.score', uid, pid, '$ref': this.ref};
  }
}

function get_chart_subscriber(sock: any, chart: any) {
  switch (chart.type) {
  case 'team': return new TeamSubscriber(sock, chart.team);
  case 'user': return new UserSubscriber(sock, chart.uid, chart.pid);
  }
}

class APISock extends Sock {
  subs: Record<string, any>;
  nextID: number;

  constructor(...args: any[]) {
    super(args[0], args[1]);
    this.subs = {};
    this.nextID = 1;
  }

  subscribe(chart: any, cb: any) {
    let sub = get_chart_subscriber(this, chart);
    if (!sub) return;
    let ref = sub.ref;

    if (this.subs[ref] == undefined) this.subs[ref] = sub;

    return {ref, id: this.subs[ref].add_subscriber(cb)};
  }

  unsubscribe(o: any) {
    if (this.subs[o.ref]) {
      this.subs[o.ref].del_subscriber(o.id);
    }
  }

  on_message(msg: any) {
    if (msg.data != undefined && msg.data.message != undefined) {
      console.error(msg.data.message);
      console.debug(msg);
      return;
    }

    let sub = this.subs[msg.$ref];
    if (sub != undefined) sub.on_message(msg);
    else throw 'Unsupported API Websocket message: ' + JSON.stringify(msg);
  }

  on_open(event: any) {
    Object.values(this.subs).map(t => t.on_open(event));
  }

  on_close(event: any) {
    setTimeout(() => this.connect(), 1000);
    Object.values(this.subs).map(t => t.on_close(event));
  }

  on_error(event: any) {
    console.debug('APISock error', event);
  }
}

export default APISock;
