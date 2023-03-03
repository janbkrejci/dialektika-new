const required = val => (val ? null : "Povinné pole")

const validEmail = val => (val.match(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/) ? null : "Neplatný e-mail")

const minLength = (val, len, msg) => (!!val && val.length >= len ? null : msg)

const maxLength = (val, len, msg) => (!!val && val.length <= len ? null : msg)

const equalStrings = (val1, val2, msg) => (val1 == val2 ? null : msg)

export {
  required,
  validEmail,
  minLength,
  maxLength,
  equalStrings
}