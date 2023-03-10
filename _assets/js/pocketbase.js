import PocketBase from 'pocketbase';
import _ from 'lodash';

const BACKEND_SERVER = 'https://dialektika-server.janbkrejci.repl.co';
const pb = new PocketBase(BACKEND_SERVER);

pb.autoCancellation(false);

// filter should return boolean, false if parameter was null
// hooks should return object (possibly modified) or null
// hooks are: [pre|post][Create|Update|Delete]
// *Create and *Delete hooks have one arg, *Update has two - original and new
// Currently, only one subscription to each collection is possible
// pre- hooks can alter the record before it is stored to collection, post-hooks can not
async function subscribe(colName, filter = (x) => !!x, hooks = {}) {
  const self = this;
  // pb.collection(colName).unsubscribe();
  // load all (filtered) records
  // TODO for large collections maybe load page by page
  this.collections[colName] = _.filter(await pb.collection(colName).getFullList(), (r) => {
    if (hooks.preCreate) return filter(hooks.preCreate(r));
    return filter(r);
  });
  // start subscription
  pb.collection(colName).subscribe('*', (e) => {
    let origRecord = null;
    const newRecord = e.record;

    // first call pre-hook,
    // then if after pre-hook record passes filter, add it to collection and pass it to post-hook
    // if after pre-hook record does not pass filter, do not add it and return null
    function tryAdd(rec) {
      let r = rec;
      if (hooks.preCreate) r = hooks.preCreate(r);
      if (!!r && filter(r)) {
        self.collections[colName].push(r);
        if (hooks.postCreate) r = hooks.postCreate(r);
      }
      return r;
    }
    function tryDelete(rec) {
      _.remove(self.collections[colName], (x) => x.id === rec.id);
      return rec;
    }
    function tryUpdate(orig, rec) {
      if (!orig) return tryAdd(rec);
      let r = rec;
      if (hooks.preUpdate) r = hooks.preUpdate(orig, r);
      if (!!r && filter(r)) {
        const o = orig;
        r = Object.assign(orig, r); // TODO does this work?
        if (hooks.postUpdate) r = hooks.postUpdate(o, r);
      } else {
        r = null;
        return tryDelete(orig);
      }
      return r;
    }

    switch (e.action) {
      case 'update':
        origRecord = this.collections[colName].find((item) => item.id === newRecord.id);
        tryUpdate(origRecord, e.record);
        break;
      case 'create':
        tryAdd(e.record);
        break;
      case 'delete':
        tryDelete(e.record);
        break;
      default:
        break;
    }
  });
}

export {
  pb,
  subscribe,
  BACKEND_SERVER,
};
