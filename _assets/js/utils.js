import * as DOMPurify from 'dompurify';
import { marked } from 'marked';
import _ from 'lodash';

export default {
  boolToString(val, ifTrue, ifFalse, ifNil) {
    if (_.isNil(val)) return ifNil;
    return (val ? ifTrue : ifFalse);
  },
  formatDate(val) {
    return val ? val.toLocaleDateString() : '';
  },
  addWeek(date) {
    const d = new Date(date || new Date());
    d.setDate(d.getDate() + 7);
    return d;
  },
  convertMD(s) {
    return DOMPurify.sanitize(marked.parse(s));
  },
  async userName(id) {
    if (!id) return '...';
    try {
      const u = await window.pb.collection('users').getOne(id);
      const fullName = [u?.firstName, u?.lastName].join(' ').trim();
      return fullName || u?.username;
    } catch (e) {
      // console.log('userName err', e);
      return 'Anonym';
    }
  },
};
