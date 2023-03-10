import * as DOMPurify from 'dompurify';
import { marked } from 'marked';
import _ from 'lodash';

export default {
  boolToString(val, ifTrue, ifFalse, ifNil) {
    if (_.isNil(val)) return ifNil;
    return (val ? ifTrue : ifFalse);
  },
  formatDate(val) {
    return val ? new Date(val).toLocaleDateString() : '';
  },
  addWeek(date) {
    const d = new Date(date || new Date());
    d.setDate(d.getDate() + 7);
    return d;
  },
  convertMD(s) {
    return DOMPurify.sanitize(marked.parse(s));
  },
  userName(id) {
    if (!id) return '...';
    const u = _.find(this.collections.users, (usr) => usr.id === id);
    const fullName = [u?.firstName, u?.lastName].join(' ').trim();
    return fullName || u?.username || 'Anonym';
  },
};
