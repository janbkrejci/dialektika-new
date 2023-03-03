import Alpine from 'alpinejs'
import PocketBase from "pocketbase"
import { required, validEmail, minLength, maxLength, equalStrings } from "./validators.js"
import focus from '@alpinejs/focus'
Alpine.plugin(focus)

window.Alpine = Alpine

const BACKEND_SERVER = 'https://dialektika-server.janbkrejci.repl.co'
const pb = new PocketBase(BACKEND_SERVER)

// TODO delete later
window.pb = pb

Alpine.data('user', () => ({
  showMenu: false,
  showSidebar: false,
  model: null,
  error: null,
  name() {
    return this.model?.name
  },
  model() {
    return this.model
  },
  get id() {
    return this.model?.id
  },
  avatar() {
    return this.model ?
      BACKEND_SERVER + "/api/files/users/"
      + this.model.id + "/" + this.model.avatar
      : null
  },
  init() {
    let obj = JSON.parse(localStorage.getItem('pocketbase_auth'))
    //console.log("localStorage.pocketbase_auth", obj)
    //console.log("obj", obj)
    this.parse(obj)
  },
  parse(obj) {
    if (obj?.model) {
      this.model = obj.model
      this.error = null
    } else {
      this.model = null
      this.error = null
    }
  },
  async login(name, password) {
    try {
      let obj = await pb.collection('users').authWithPassword(name, password)
      this.init()
    } catch (err) {
      console.log("error logging in", err)
      this.error = "Neúspěšný pokus o přihlášení"
    }
  },
  logout() {
    pb.authStore.clear()
    this.init()
  }
}))

Alpine.data("login", () => ({
  form: 'login',
  loginError: null,
  registrationError: null,
  resetSuccess: null,
  resetError: null,
  alias: null,
  password: null,
  password2: null,
  firstName: null,
  surname: null,
  email: null,
  aliasError: null,
  passwordError: null,
  password2Error: null,
  firstNameError: null,
  surnameError: null,
  emailError: null,
  disabled: false,
  reset() {
    this.loginError = null
    this.registrationError = null
    this.resetSuccess = null
    this.aliasError = null
    this.passwordError = null
    this.password2Error = null
    this.firstNameError = null
    this.surnameError = null
    this.emailError = null
    this.birthDateError = null
    this.occupationError = null
    this.districtError = null
  },
  switchForm(mode) {
    this.reset()
    this.form = mode
    this.$nextTick(() => {
      if (mode != "reset")
        document.getElementById("alias").focus()
      else
        document.getElementById("email").focus()
    })
  },
  validate(id = null) {
    if (id) {
      switch (id) {
        case "alias":
          this.aliasError = required(this.alias) ||
            minLength(this.alias, 3, "Minimální délka jsou 3 znaky")
          return !this.aliasError
        case "password":
          this.passwordError = required(this.password) ||
            minLength(this.password, 6, "Minimální délka hesla je 6 znaků")
            || maxLength(this.password, 72, "Maximální délka hesla je 72 znaků")
          return !this.passwordError
        case "password2":
          this.password2Error = required(this.password2) ||
            equalStrings(this.password, this.password2, "Hesla se neshodují")
          return !this.password2Error
        case "email":
          this.emailError = required(this.email) || validEmail(this.email)
          return this.emailError
      }
    } else {
      this.reset()
      switch (this.form) {
        case "reset":
          this.validate("email")
          break;
        case "login":
          this.validate("alias")
          this.validate("password")
          break
        case "register":
          this.validate("alias")
          this.validate("email")
          this.validate("password")
          this.validate("password2")
          break
      }
      return !(this.aliasError || this.emailError || this.passwordError || this.password2Error)
    }
  },
  init() {
    this.$focus.first()
  },
  next() {
    let id = this.$focus.focused()?.id
    if (id) {
      this.validate(id)
    }
    if (this.form == 'register') {
      if ("password2" == id) {
        if (!this.disabled) {
          this.register()
        }
      }
    } else if (this.form == 'login') {
      if ("password" == id) {
        if (!this.disabled) {
          this.doLogin()
        }
      }
    } else {
      if ("email" == id) {
        if (!this.disabled) {
          this.doReset()
        }
      }
    }
    this.$focus.next()
  },
  focusFirstError() {
    let first = null
    if (this.aliasError) { first = "alias" }
    else if (this.emailError) { first = "email" }
    else if (this.passwordError) { first = "password" }
    else if (this.password2Error) { first = "password2" }
    if (first) {
      this.$focus.focus(document.getElementById(first))
    }
  },
  async doLogin() {
    this.disabled = true
    if (this.validate()) {
      try {
        await pb.collection('users').authWithPassword(this.alias, this.password)
        window.location.replace(document.referrer)
      } catch (err) {
        console.log("login err", err)
        this.loginError = "Neúspěšný pokus o přihlášení"
        this.disabled = false
      }
    } else {
      this.focusFirstError()
      this.disabled = false
    }
  },
  async doReset() {
    this.disabled = true
    if (this.validate()) {
      try {
        await pb.collection("users").requestPasswordReset(this.email)
        this.resetSuccess = "Odeslali jsme Vám odkaz pro reset hesla, podívejte se do e-mailu (a do nevyžádané pošty, pokud tam naše zpráva spadla)."
        this.disabled = false
      } catch (err) {
        this.resetError = "Něco se nepovedlo"
        this.disabled = false
      }
    } else {
      this.focusFirstError()
      this.disabled = false
    }

  },
  async register() {
    this.disabled = true
    if (this.validate()) {
      try {
        await pb.collection('users').create({
          username: this.alias,
          email: this.email,
          password: this.password,
          passwordConfirm: this.password2
        });
        await pb.collection('users').authWithPassword(this.alias, this.password)
        window.location.replace(document.referrer)
      } catch (err) {
        debugger
        console.log("err registering", err.data)
        this.registrationError = 'Neúspěšná registrace'
        if (err.data.data.email) {
          this.emailError = "Neplatný nebo obsazený e-mail"
        }
        if (err.data.data.username) {
          this.aliasError = "Neplatný nebo obsazený uživatel"
        }
        if (err.data.data.password) {
          this.passwordError = "Neplatné heslo"
        }
        this.disabled = false
      }
    } else {
      this.focusFirstError()
      this.disabled = false
    }
  }
}))

function back() {
  let target = document.referrer
  if (!target || target.match("login")) target = "/"
  window.location.replace(target)
}

window.back = back

Alpine.start()
