
// import { Observer } from './observer'
class Vue {
  constructor(options) {
    this.$data = options.data

    this.initState(this.$data)

  }

  initState(data) {
    const keys = Object.keys(data)

    for(const key of keys) {
      this._proxy(this, '$data', key)
    }

    // new Observer(this, data)
  }

  _proxy(vm, rootKey, key) {
    const get = () => {
      return vm[rootKey][key]
    }

    const set = (val) => {
      vm[rootKey][key] = val
    }

    Object.defineProperty(vm, key, {
      enumerable: true,
      configurable: true,
      get,
      set
    })
  }

}