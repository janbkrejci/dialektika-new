import Alpine from 'alpinejs';
import PocketBase from 'pocketbase';
import focus from '@alpinejs/focus';
import _ from 'lodash';
import * as DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  required, validEmail, minLength, maxLength, equalStrings,
} from './validators';

Alpine.plugin(focus);

window.Alpine = Alpine;

const BACKEND_SERVER = 'https://dialektika-server.janbkrejci.repl.co';
const pb = new PocketBase(BACKEND_SERVER);

// TODO delete later
window.pb = pb;

Alpine.data('user', () => ({
  user_showMenu: false,
  user_showSidebar: false,
  user_model: null,
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
  /* async user_refresh() {
    // TODO make user_name reactive?
    await pb.collection('users').authRefresh();
    this.init();
    // console.log("ref", this, localStorage.getItem('pocketbase_auth'))
  }, */
  init() {
    this.user_model = (JSON.parse(localStorage.getItem('pocketbase_auth')))?.model;
  },
  logout() {
    pb.authStore.clear();
    this.init();
  },
}));

Alpine.data('login', () => ({
  form: 'login',
  errors: {},
  fields: {},
  disabled: false,
  reset() {
    this.errors = {};
  },
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
  errors: {},
  fields: {},
  disabled: false,
  reset() {
    this.errors = {};
  },
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
  state: 'hlasovani',
  lastState: null,
  selectedID: null,
  selectedItem: {},
  errors: {},
  items: {
    H0: { id: 'H0', state: 'closed', subject: 'H0' },
    H1: { id: 'H1', state: 'closed', subject: 'H1' },
    H2: { id: 'H2', state: 'voting', subject: 'H2' },
    H3: {
      id: 'H3',
      state: 'suggested',
      subject: 'H3',
      description: 'test H3',
      preselectors: ['kyqfosmd2ld162c'],
      preselections: {
        // kyqfosmd2ld162c: false,
      },
    },
    H4: {
      id: 'H4',
      state: 'elaborating',
      subject: 'H4',
      description: 'test H3',
      preselectors: ['kyqfosmd2ld162c'],
      preselections: {
        // kyqfosmd2ld162c: false,
      },
    },
    H5: { id: 'H5', state: 'rejected', subject: 'H5' },
    H6: { id: 'H6', state: 'rejected', subject: 'H6' },
  },
  suggestedItems() {
    return Object.values(this.items).filter((i) => i.state === 'suggested'
        && [...(i.preselectors || [])].includes(this.user_id)
        && !(Object.keys(i.preselections || {})).includes(this.user_id));
  },
  elaboratingItems() {
    return Object.values(this.items).filter((i) => i.state === 'elaborating'
        && [...(i.preselectors || [])].includes(this.user_id)
        && !(Object.keys(i.preselections || {})).includes(this.user_id));
  },
  preselectors() {
    // TODO from users collection and scope
    return [this.user_id];
  },
  switchState(s) {
    this.reset();
    this.state = s;
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
    this.selectedID = id;
    this.selectedItem = this.items[id] || { state: 'new' };
    this.lastState = this.state;
    this.switchState('detail');
    this.$focus.focus(this.firstInput());
  },
  hideDetail() {
    this.switchState(this.lastState);
    this.lastState = null;
    this.selectedID = null;
    this.selectedItem = {};
  },
  reOpen(id) {
    this.selectedID = null;
    const orig = { ...this.items[id] };
    delete orig.id;
    delete orig.created;
    delete orig.updated;
    delete orig.preselections;
    orig.state = 'new';
    this.selectedItem = orig;
    this.lastState = this.state;
    this.switchState('detail');
    this.$focus.focus(this.firstInput());
  },
  vote(id, value) {
    const item = this.items[id];
    if (item.state === 'suggested') {
      if ((item.preselectors || []).includes(this.user_id)) {
        if (!item.preselections) {
          item.preselections = {};
        }
        if (!item.preselections[this.user_id]) {
          item.preselections[this.user_id] = value;
          // TODO item.save
          // TODO close if last
        }
      }
    } else if (item.state === 'voting') {
      if ((item.voters || []).includes(this.user_id)) {
        if (!item.votes) {
          item.votes = {};
        }
        if (!item.votes[this.user_id]) {
          item.votes[this.user_id] = value;
          // TODO item.save
          // TODO close if last
        }
      }
    }
  },
  reset() {
    this.errors = {};
  },
  validate(id = null) {
    if (id) {
      switch (id) {
        case 'subject':
          this.errors.subjectError = required(this.selectedItem.subject);
          break;
        case 'description':
          this.errors.descriptionError = required(this.selectedItem.description);
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
    const id = this.$focus.focused()?.id;
    let last = null;
    let functor = null;
    switch (this.selectedItem.state) {
      case 'new':
        last = document.getElementById('description').style.display === 'none'
          ? 'subject'
          : 'description';
        functor = this.doCreateTopic;
        break;
      default:
        break;
    }
    if (last === id) {
      if (!this.disabled && functor) functor.apply(this);
    } else if (id === 'subject') {
      this.$focus.focus(document.getElementById('description'));
    } else {
      this.$focus.next();
    }
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
        // TODO delete when saving to DB
        const newId = Math.floor(Math.random() * 1000000);
        const created = new Date();
        this.selectedItem.id = newId;
        this.selectedItem.created = created;

        this.selectedItem.state = 'suggested';
        this.selectedItem.preselectors = this.preselectors();

        // TODO delete when saving to DB
        this.items[newId] = { id: newId, ...this.selectedItem };
        // await pb.collection('votes').create(this.selectedItem);

        this.hideDetail();
      } catch (err) {
        this.errors.submitError = JSON.stringify(err, 2, null);
        this.disabled = false;
      }
    } else {
      this.focusFirstError();
      this.disabled = false;
    }
  },
  convertMD(s) {
    return DOMPurify.sanitize(marked.parse(s));
  },
}));

Alpine.start();
