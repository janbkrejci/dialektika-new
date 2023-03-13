import Alpine from 'alpinejs';
import focus from '@alpinejs/focus';
import _ from 'lodash';
import {
  required, validEmail, minLength, maxLength, equalStrings,
} from './validators';
import utils from './utils';
import { pb, subscribe, BACKEND_SERVER } from './pocketbase';
import 'flowbite';

window.utils = utils;

Alpine.plugin(focus);

window.Alpine = Alpine;

Alpine.data('user', () => ({
  user_showMenu: false,
  user_showSidebar: false,
  user_model: null,
  disabled: false,
  collections: {},
  errors: {},
  reset() {
    this.errors = {};
  },
  get user_name() {
    const fullName = [this.user_model?.firstName, this.user_model?.lastName].join(' ').trim();
    return fullName || this.user_model?.username;
  },
  get user_email() {
    return this.user_model?.email;
  },
  get user_id() {
    return this.user_model?.id;
  },
  get user_avatar() {
    return this.user_model
      ? `${BACKEND_SERVER}/api/files/users/${
        this.user_model.id}/${this.user_model.avatar}`
      : null;
  },
  get sortedUsers() {
    // return _.chain(this.collections.users).sortBy(['lastName', 'firstName']).value()
    return _.chain(this.collections.users).sortBy('created').reverse().value();
  },
  setPropertiesFromHash() {
    const u = new URLSearchParams(window.location.hash.substring(1));
    u.forEach((v, k) => {
      this[k] = v;
    }, this);
  },
  async init() {
    this.user_model = pb.authStore.model;
    this.userName = utils.userName.bind(this);
    this.subscribe = subscribe.bind(this);
    this.subscribe('users');
    try {
      await pb.collection('users').authRefresh();
    } catch (e) {
      pb.authStore.clear();
    }

    this.userName = utils.userName.bind(this);
    this.subscribe = subscribe.bind(this);
    this.subscribe('users');
  },
  logout() {
    pb.authStore.clear();
    this.init();
  },
}));

Alpine.data('login', () => ({
  form: 'login',
  fields: {},
  switchForm(mode) {
    this.reset();
    this.form = mode;
    this.$nextTick(() => {
      if (mode !== 'reset') document.getElementById('alias').focus();
      else document.getElementById('email').focus();
    });
  },
  validate(id = null) {
    if (id) {
      switch (id) {
        case 'alias':
          this.errors.aliasError = required(this.fields.alias)
            || minLength(this.fields.alias, 3, 'Minimální délka jsou 3 znaky');
          break;
        case 'password':
          this.errors.passwordError = required(this.fields.password)
            || minLength(this.fields.password, 6, 'Minimální délka hesla je 6 znaků')
            || maxLength(this.fields.password, 72, 'Maximální délka hesla je 72 znaků');
          break;
        case 'password2':
          this.errors.password2Error = required(this.fields.password2)
            || equalStrings(this.fields.password, this.fields.password2, 'Hesla se neshodují');
          break;
        case 'email':
          this.errors.emailError = required(this.fields.email) || validEmail(this.fields.email);
          break;
        default:
          break;
      }
    } else {
      this.reset();
      switch (this.form) {
        case 'reset':
          this.validate('email');
          break;
        case 'login':
          this.validate('alias');
          this.validate('password');
          break;
        case 'register':
          this.validate('alias');
          this.validate('email');
          this.validate('password');
          this.validate('password2');
          break;
        default:
          break;
      }
    }
    return _.isEmpty(_.omitBy(this.errors, _.isNil));
  },
  init() {
    this.$focus.first();
  },
  next() {
    const id = this.$focus.focused()?.id;
    if (id) {
      this.validate(id);
    }
    let last = null;
    let functor = null;
    switch (this.form) {
      case 'register':
        last = 'password2';
        functor = this.doRegister;
        break;
      case 'login':
        last = 'password';
        functor = this.doLogin;
        break;
      default:
        last = 'email';
        functor = this.doReset;
    }
    if (last === id) {
      if (!this.disabled && functor) functor.apply(this);
    } else {
      this.$focus.next();
    }
  },
  focusFirstError() {
    let first = null;
    if (this.errors.aliasError) { first = 'alias'; } else if (this.errors.emailError) { first = 'email'; } else if (this.errors.passwordError) { first = 'password'; } else if (this.errors.password2Error) { first = 'password2'; }
    if (first) {
      this.$focus.focus(document.getElementById(first));
    } else {
      this.$focus.first();
    }
  },
  async doLogin() {
    this.disabled = true;
    if (this.validate()) {
      try {
        await pb.collection('users').authWithPassword(this.fields.alias, this.fields.password);
        window.location.replace(document.referrer);
      } catch (err) {
        this.errors.loginError = 'Neúspěšný pokus o přihlášení';
        this.disabled = false;
        this.$focus.first();
      }
    } else {
      this.focusFirstError();
      this.disabled = false;
    }
  },
  async doReset() {
    this.disabled = true;
    if (this.validate()) {
      try {
        await pb.collection('users').requestPasswordReset(this.fields.email);
        this.errors.resetSuccess = 'Odeslali jsme Vám odkaz pro reset hesla, podívejte se do e-mailu (a do nevyžádané pošty, pokud tam naše zpráva spadla).';
        this.disabled = false;
        this.$focus.first();
      } catch (err) {
        this.errors.resetError = 'Něco se nepovedlo';
        this.disabled = false;
        this.$focus.first();
      }
    } else {
      this.focusFirstError();
      this.disabled = false;
    }
  },
  async doRegister() {
    this.disabled = true;
    if (this.validate()) {
      try {
        await pb.collection('users').create({
          username: this.fields.alias,
          email: this.fields.email,
          password: this.fields.password,
          passwordConfirm: this.fields.password2,
        });
        await pb.collection('users').authWithPassword(this.fields.alias, this.fields.password);
        window.location.replace(document.referrer);
      } catch (err) {
        this.errors.registrationError = 'Neúspěšná registrace';
        if (err.data.data.email) {
          this.errors.emailError = 'Neplatný nebo obsazený e-mail';
        }
        if (err.data.data.username) {
          this.errors.aliasError = 'Neplatný nebo obsazený uživatel';
        }
        if (err.data.data.password) {
          this.errors.passwordError = 'Neplatné heslo';
        }
        this.disabled = false;
        this.focusFirstError();
      }
    } else {
      this.focusFirstError();
      this.disabled = false;
    }
  },
}));

Alpine.data('passwordReset', () => ({
  fields: {},
  validate(id = null) {
    if (id) {
      switch (id) {
        case 'password':
          this.errors.passwordError = required(this.fields.password)
            || minLength(this.fields.password, 6, 'Minimální délka hesla je 6 znaků')
            || maxLength(this.fields.password, 72, 'Maximální délka hesla je 72 znaků');
          break;
        case 'password2':
          this.errors.password2Error = required(this.fields.password2)
            || equalStrings(this.fields.password, this.fields.password2, 'Hesla se neshodují');
          break;
        default:
          break;
      }
    } else {
      this.reset();
      this.validate('password');
      this.validate('password2');
    }
    return _.isEmpty(_.omitBy(this.errors, _.isNil));
  },
  init() {
    this.fields.token = window.location.hash.substring(1);
    if (this.fields.token === '') {
      window.back();
    }
    this.$focus.first();
  },
  next() {
    const id = this.$focus.focused()?.id;
    if (id) {
      this.validate(id);
    }
    if (id === 'password2') {
      if (!this.disabled) {
        this.doReset();
      }
    } else {
      this.$focus.next();
    }
  },
  focusFirstError() {
    let first = null;
    if (this.errors.passwordError) { first = 'password'; } else if (this.errors.password2Error) { first = 'password2'; }
    if (first) {
      this.$focus.focus(document.getElementById(first));
    } else {
      this.$focus.first();
    }
  },
  async doReset() {
    this.disabled = true;
    if (this.validate()) {
      try {
        await pb.collection('users').confirmPasswordReset(this.fields.token, this.fields.password, this.fields.password2);
        this.errors.resetSuccess = 'Heslo bylo změněno';
        this.disabled = false;
        this.$focus.first();
        this.logout();
      } catch (err) {
        this.errors.resetError = 'Heslo se nepodařilo změnit';
        if (err.response.data.token) {
          this.errors.resetError = 'Použitý odkaz je neplatný nebo starý';
        }
        this.disabled = false;
        this.$focus.first();
      }
    } else {
      this.focusFirstError();
      this.disabled = false;
    }
  },
}));

Alpine.data('aktivity', () => ({
  state: null,
  lastState: null,
  action: null,
  selectedID: null,
  selectedItem: {},
  renewSelectedItem() {
    this.selectedItem = this.collections.votings.find((i) => i.id === this.selectedID) || {
      state: 'new',
    };
  },
  renew() {
    this.state = null;
    this.selectedID = null;
    this.selectedItem = {};
    this.action = null;

    this.setPropertiesFromHash();

    if (this.selectedID) {
      this.renewSelectedItem();
      if (this.action === 'reOpen') {
        const orig = { ...this.selectedItem };
        delete orig.id;
        delete orig.updated;
        delete orig.preselectionResult;
        delete orig.preselectionClosed;
        orig.state = 'new';
        this.selectedItem = orig;
      }
    } else if (!this.state) {
      window.location.replace('/aktivity#state=hlasovani');
    }
    this.$nextTick(() => {
      this.$focus.focus(this.firstInput());
    });
  },
  async init() {
    const self = this;

    await this.subscribe('votings', (x) => !!x, {
      postDelete(item) {
        if (item.id === self.selectedID) {
          const s = new URLSearchParams(window.location.hash.substring(1));
          s.delete('selectedID');
          s.set('state', self.lastState || "hlasovani");
          self.lastState = null;
          window.location.hash = s.toString();
        }
      },
    });
    await this.subscribe('votes');
    await this.subscribe('discussions');

    window.addEventListener('hashchange', () => {
      self.renew();
    }, false);
    this.renew();
  },
  votersFor(voting) {
    const { scope } = voting;
    if (!scope) return [];
    // TODO, to begin we accept every user for every voting
    return _.chain(this.collections.users).sortBy(['lastName', 'firstName']).map((u) => u.id).value();
  },
  votesFor(voting) {
    const isVote = !voting.state === 'suggested';
    const result = _.reject(
      this.collections.votes,
      (i) => (i.isVote !== isVote || i.voting !== voting.id),
    );
    return result;
  },
  positiveVotesFor(voting) {
    return _.sumBy(this.votesFor(voting), (o) => (o.vote ? 1 : 0)) || 0;
  },
  negativeVotesFor(voting) {
    return _.sumBy(this.votesFor(voting), (o) => (o.vote ? 0 : 1)) || 0;
  },
  voteOfFor(uid, voting) {
    const isVote = !voting.state === 'suggested';
    const functor = (i) => (i.isVote === isVote && i.voting === voting.id && i.user === uid);
    const result = _.find(this.collections.votes, functor);
    return result;
  },
  amIVoterFor(voting) {
    return this.votersFor(voting).includes(this.user_id);
  },
  didIVoteFor(voting, finalVote) {
    return !!(this.collections.votes || []).find(
      (i) => i.user === this.user_id && i.isVote === finalVote && i.voting === voting.id,
    );
  },
  suggestedItems() {
    return Object.values(this.collections.votings || []).filter((i) => i.state === 'suggested'
        && this.amIVoterFor(i)
        && !this.didIVoteFor(i, false));
  },
  elaboratingItems() {
    return Object.values(this.collections.votings || {}).filter((i) => i.state === 'elaborating'
        && this.amIVoterFor(i));
  },
  rejectedItems() {
    return _.chain(Object.values(this.collections.votings || {}).filter((i) => i.state === 'rejected'
        && this.amIVoterFor(i))).sortBy('preselectionClosed').reverse().value();
  },
  votingItems() {
    return Object.values(this.collections.votings || {}).filter((i) => i.state === 'voting'
        && this.amIVoterFor(i)
        && !this.didIVoteFor(i, true));
  },
  closedItems() {
    return _.chain(Object.values(this.collections.votings || {}).filter((i) => i.state === 'closed'
        && this.amIVoterFor(i))).sortBy('votingClosed').reverse().value();
  },
  firstInput() {
    function e(id) {
      return document.getElementById(id);
    }
    let result = null;
    switch (this.selectedItem.state) {
      case 'new':
        result = e('subject');
        break;
      default:
        break;
    }
    return result;
  },
  showDetail(id) {
    this.lastState = this.state;
    const s = new URLSearchParams(window.location.hash.substring(1));
    s.set('state', 'detail');
    s.set('selectedID', id);
    window.location.hash = s.toString();
  },
  hideDetail() {
    const s = new URLSearchParams();
    s.set('state', this.lastState || 'hlasovani');
    this.lastState = null;
    window.history.back();
  },
  async reOpen(id) {
    // TODO
    this.selectedID = id
    this.renewSelectedItem()
    delete this.selectedItem.preselectionClosed
    this.preselectionResult = false
    this.selectedItem.author = this.user_id
    this.selectedItem.state = "new"
    delete this.selectedItem.created
    delete this.selectedItem.updated
    window.location.hash = "state=detail"
    this.$focus.focus(this.firstInput())
  },
  async vote(item, value) {
    if (!item || _.isNil(value)) return;
    this.disabled = true;
    const isVote = !item.state === 'suggested';
    try {
      const result = {
        voting: item.id,
        user: this.user_id,
        isVote,
        vote: value,
        voteActive: true,
      };
      this.collections.votes.push(result);
      await pb.collection('votes').create(result);
      // check if this was a last vote
      const votersCount = this.votersFor(item).length;
      const votesCount = this.votesFor(item).length;
      if (votesCount >= votersCount) {
        let result = false;
        const updateObj = {...item};
        if (item.state === 'suggested') {
          result = this.positiveVotesFor(item) > this.negativeVotesFor(item);
          updateObj.preselectionResult = result;
          updateObj.state = result ? 'elaborating' : 'rejected';
          updateObj.preselectionClosed = new Date();
          updateObj.finalSubject = item.subject;
          updateObj.finalDescription = item.description;
        } else {
          result = this.positiveVotesFor(item) >= this.negativeVotesFor(item);
          updateObj.votingResult = result;
          updateObj.state = 'closed';
          updateObj.votingClosed = new Date();
        }
        await pb.collection('votings').update(item.id, updateObj);
      }
    } catch (error) {
      console.log(error);
      this.errors.submitError = 'Nepovedlo se...';
    }
    this.disabled = false;
  },
  validate(id = null) {
    if (id) {
      switch (id) {
        case 'subject':
          this.errors.subjectError = required(this.selectedItem.subject?.trim());
          break;
        case 'description':
          this.errors.descriptionError = required(this.selectedItem.description?.trim());
          break;
        /* case 'password':
          this.passwordError = required(this.password)
            || minLength(this.password, 6, 'Minimální délka hesla je 6 znaků')
            || maxLength(this.password, 72, 'Maximální délka hesla je 72 znaků');
          return !this.passwordError;
        case 'password2':
          this.password2Error = required(this.password2)
            || equalStrings(this.password, this.password2, 'Hesla se neshodují');
          return !this.password2Error;
        case 'email':
          this.emailError = required(this.email) || validEmail(this.email);
          return this.emailError; */
        default:
          this.submitError = `Nenastavená validace pro pole'${id}'`;
          break;
      }
    } else {
      this.reset();
      switch (this.selectedItem.state) {
        case 'new':
          this.validate('subject');
          this.validate('description');
          break;
        default:
          break;
      }
    }
    return !(this.errors.subjectError || this.errors.descriptionError);
  },
  next() {
    const current = this.$focus.focused()?.id;
    if (current) {
      this.validate(current);
    }
    let nxt = null;
    switch (this.selectedItem.state) {
      case 'new':
        switch (current) {
          case 'subject':
            nxt = 'description';
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }
    if (nxt) this.$focus.focus(document.getElementById(nxt));
  },
  focusFirstError() {
    let first = null;
    if (this.errors.subjectError) { first = 'subject'; } else if (this.errors.descriptionError) { first = 'description'; }
    /* else if (this.emailError) { first = 'email'; }
    else if (this.passwordError) { first = 'password'; }
    else if (this.password2Error) { first = 'password2'; } */
    if (first) {
      this.$focus.focus(document.getElementById(first));
    }
  },
  async doCreateTopic() {
    this.disabled = true;
    if (this.validate()) {
      try {
        this.selectedItem.state = 'suggested';
        this.selectedItem.author = this.user_id;
        this.selectedItem.scope = 'bv6zy25qi4ijcv2'; // TODO let user select it

        const newItem = await pb.collection('votings').create(this.selectedItem);
        this.collections.votings.push(newItem);

        window.location.replace(`/aktivity#state=detail&selectedID=${newItem.id}`);
        // sessionStorage.setItem('refresh', 'true');

        /* if (window.history.replaceState) {
          console.log("replace url")
          const newurl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?selectedID=${newItem.id}`;
          window.history.replaceState(null, '', newurl);

        } else {
          console.log("redirect")
          const s = new URLSearchParams();
          s.set('selectedID', newItem.id);
          window.location.search = s.toString();
        } */
      } catch (err) {
        console.log(err);
        this.errors.submitError = JSON.stringify(err, 2, null);
      } finally {
        this.disabled = false;
      }
    } else {
      this.focusFirstError();
      this.disabled = false;
    }
  },
}));

Alpine.start();
