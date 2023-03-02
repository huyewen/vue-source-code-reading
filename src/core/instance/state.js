/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
// 代理数据的访问，在这一步之后就可以通过this.property来访问data选项中的property
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  // 初始化props
  if (opts.props) initProps(vm, opts.props)
  // 初始化methods
  if (opts.methods) initMethods(vm, opts.methods)
  // 初始化data
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  // 初始化computed
  if (opts.computed) initComputed(vm, opts.computed)
  // 初始化watch
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/**
 * 如果传入的props值为基本类型，那么当父组件中的数据发生改变时，会在重新调用render时将新的props值传入，
 * 此时在updateChildComponent 中会用新值替换掉旧值，这是触发props属性的set方法，所以会触发子组件更新
 * 
 * 如果传入的props值为引用类型，那么当整个属性值被全部替换时，对组件的触发流程和上面相同
 * 如果只是改变引用类型值内部属性，则会同时通知父子组件更新
 * 
 * 因为对引用对象值做defineReactive时，value已经拥有__ob__，
 * 所以当父子组件同时使用同一个对象时，它们的watcher都会被__ob__.dep作为依赖进行收集
 * 
 * 所以当内部属性发生改变时，会同时通知父子组件更新
 */

function initProps (vm: Component, propsOptions: Object) {
  // 拿到父组件传下来的propsData
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent // 根实例
  // root instance props should be converted
  if (!isRoot) { // 不是根实例，那就是组件
    // 不对值进行递归监听
    toggleObserving(false)
  }
  // propsOptions为当前组件实例中props选项定义的property对象
  for (const key in propsOptions) {
    // 将当前实例定义的props键收集起来
    keys.push(key)
    // 验证传入的props和当前实例定义的props类型是不是一样的，或者是否必填的时候没有给定值
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
        config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        // 表示props属性不可被更改
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

function initData (vm: Component) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') { // 在methods中有相同名字属性
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) { // 在props中有相同名字属性
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 如果不是保留属性，也就是说该属性名称不是以_、$开头的，在这里做一层过滤，
      // 除此之外在initProxy中又做了一次过滤
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  // 这里是怎么禁用的呢？那就是推一个undefined进到targetStack，并且Dep.target为undefined
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget() // 将undefined从栈中拿出来，并将target设为栈顶元素
  }
}

// lazy为true表示创建watcher时执行watch.get函数，当lazy为true时，对应的dirty也为true， 
// 表示数据发生改变时，都重新执行watch.get获取新数据
const computedWatcherOptions = { lazy: true }


/**
 * 初始化computed的时候，为每个computed属性创建一个watcher，第一次创建时dirty为true，所以传入的
 * get函数不执行，watcher.value为undefined，当第一次访问computed属性时，会执行evaluate（看下面createComputedGetter），
 * 其中会执行一次watcher.get，此时，Dep.target被设为当前计算属性的watcher实例，在执行get期间，会访问
 * computed属性的依赖，从而触发其它依赖属性的get方法，期间Dep.target会被所依赖属性的dep进行收集，
 * 当依赖属性发生变化时，会遍历依赖属性收集到的依赖（watcher），并调用它们的update方法，此时当
 * 调用computed属性的watcher.update会将dirty设置为true，它并不会立即重新计算值，只会当再一次
 * 访问这个计算属性（可能是因为数据的变化引起的页面渲染）的时候才会重新计算。
 */

/**
 * 简单点讲就是，计算属性初始化的时候会为每个计算属性创建一个watcher，当访问计算属性的
 * 时候会执行计算属性的get方法，执行期间同样回去访问依赖属性，这时计算属性的watcher会被当做依赖
 * 被收集起来，当依赖发生改变时，watcher的dirty属性会改变，表示旧的value值已是脏数据，所以下一次
 * 获取计算属性的时候，计算属性会重新计算。
 */

/**
 * 计算属性的改变并不会直接引起页面的改变，
 */
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    // 不是一个函数，那就必须是一个带有get的对象
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 如果属性不存在vm实例中
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(`The computed property "${key}" is already defined as a method.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering() // 
  if (typeof userDef === 'function') { // 如果是函数
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else { // 如果是对象
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
    sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
/**
 * 第一种情况
 * 
 * 比如计算属性c的依赖时d1和d2，那么在第一次计算值时c的watcher实例会订
 * 阅d1和d2（也就是cwatcher会触发d1,d2的get,从而被它们的dep进行收集），
 * 这个时候cwatcher订阅了两个目标，当d1 d2更新时，并不会导致c的重新计算，
 * 而是会修改c watcher中的dirty，当再次访问c时，才会重新计算值，这也就是
 * c会有缓存效果的原因，只要dirty始终保持为false，那么拿到的永远是旧的值。
 * 
 * 在render函数执行时，第一次访问计算属性c，对数据d1 d2来说，它们除了收集了
 * c watcher之外，还有页面的render watcher，当d1 d2发生改变时，会遍历subs，通知更新，
 * 这时c watcher中的dirty会被改为true，但不会立马重新计算值，除此之外，页面watcher也会被触发，重新渲染，
 * 最后在执行render时，会再次拿到计算属性c，此时会重新计算c的值。
 * 
 * 另一种情况
 * 
 * 当在watch中监听计算属性c时，首先在initWatch中会第一次访问c，这时触发c的get，那么首先cwatcher会被d1 d2收集，
 * 然后userwatcher会被d1 d2收集，最后render执行访问c时，因为dirty已被第一次触发，所以为false,
 * 不会重新计算，但是因为target此时为页面watcher，所以会调用cwacther.depend()，让已收集cwatcher
 * 为依赖的响应数据再次收集一下页面watcher，所以此时页面watcher也会被d1 d2收集起来。
 */
function createComputedGetter (key) {
  return function computedGetter () { // render阶段调用或者第一次调用时
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      /*一*/if (watcher.dirty) { // 如果dirty为true，表示第一次创建时或者依赖发生了改变
        watcher.evaluate() // 里面会调用watcher得get方法重新计算值
      }
      /*二*/if (Dep.target) { // 手动让数据属性再一次收集一下Dep.target，此时它为组件watcher。
        watcher.depend() // 
      }
      // 如果不是重新计算过的，则调用旧的value值
      return watcher.value
    }
  }
}

function createGetterInvoker (fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}


function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) { // 如果是回调函数数组，则为每个数组创建watcher
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else { // 如果是字符串，函数，对象
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function, // watch中定义的为字符串，$watch定义的可能还会是一个返回字符串的函数，也可以说是get函数
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) { // 如果是对象
    options = handler // 该对象就是options配置对象
    handler = handler.handler // 对象中的handler则是回调函数
  }
  if (typeof handler === 'string') { // 如果是字符串，则表明是方法的键名，则handler为methods中指定的方法
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any, // 回调函数
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) { // 递归调用
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true // 表示是侦听器watch创建的watcher
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) { // 立即执行一次
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }
    // 返回解除监听的函数
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
