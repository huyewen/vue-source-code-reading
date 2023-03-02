/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * 观察者解析表达式，收集依赖项，
 * 并在表达式值更改时触发回调。
 * 这用于 $watch() api 和指令。
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  /**
   *  自增属性，在执行更新时会对watcher根据id进行排序，因为数据
   *   处理watcher的创建顺序时computedWatcher => userWatcher => renderWatcher，所以组件内
   * watcher的执行顺序也是 computedWatcher => userWatcher => renderWatcher，这样能保证renderWatcher执行
   * dom更新时 computed属性是最新的。
   */
  id: number;
  deep: boolean;
  /* 
  只有userWatcher的user属性是true
   表示是用户手动传入的回调函数，因此在执行cb回调函数时，要try、catch捕获异常
  */
  user: boolean;
  /**
   * lazy用于标识是否在创建watcher时执行watcher.get函数，默认是false，表示创建时不执行
   */
  lazy: boolean;
  sync: boolean;
  /**
   * dirty可以理解为订阅的该属性是否为脏数据，即做过改变，用于标识数据是否需要重新获取,true为重新获取，false则读取缓存
   */
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  /**
   * 当前watcher的值，其为执行getter函数的结果值
   * computedWatcher：getter函数执行的值
   * userWatcher所对应属性的值
   * renderWatcher 则该值为undefined
   */
  value: any;

  constructor(
    vm: Component,
    /**
     * expOrFn为key或者函数，computedWatcher传的是函数（get函数） ，用于获取computed属性的值。
     * userWatcher传的是属性名，通过属性名获取对应的函数
     * renderWatcher传的是updateComponent即组件更新函数
     * 
     * 不过它们最终都会转化为函数，存在watcher.getter中
     */
    expOrFn: string | Function,
    cb: Function, //  computedWatcher，renderWatcher传的是空函数，userWatcher传的是回调函数
    options?: ?Object,
    isRenderWatcher?: boolean // 是否作为渲染观察者
  ) {
    this.vm = vm
    if (isRenderWatcher) { // 如果是渲染watcher
      vm._watcher = this
    }
    // 该实例所拥有的所有watcher实例
    vm._watchers.push(this)
    // options
    if (options) { // 配置选项
      // 布尔转化
      this.deep = !!options.deep // 
      this.user = !!options.user // 只有user watcher才会为true
      this.lazy = !!options.lazy // 标识是否在创建watcher时执行watcher.get函数
      this.sync = !!options.sync
      this.before = options.before // 该wacher执行前调用的回调，例如挂载前调用的beforeUpdate
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // 为字符串，则通过字符串键名获取到对应属性值
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // lazy为true时则创建时不执行，一般只有userWatcher和renderWatcher创建时才会执行
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) { // 如果是用户手动写的回调，因此在执行cb回调函数时，要try、catch捕获异常
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) { 
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) { // 没有订阅过的目标
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) { // 更新前订阅了，更新后没有订阅，那就要取消掉该目标，也就是将watcher从某属性dep中删除
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds // 将老的重置为最新的
    this.newDepIds = tmp
    this.newDepIds.clear() // 每次执行过后都会被清空
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    // 如果this.lazy为true，即当前watcher属于computedWatcher，只是设置dirty属性
    // 也就是依赖发生变化的时候，此时并不直接从新计算，而是将dirty标记为true，下次访问的时候会重新计算
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) { // 如果this.sync, 执行run函数
      this.run()
    } else { // 将当前watcher入队，后面在异步更新时，会遍历执行watcher的run方法
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   * run函数触发时机是 vue执行异步更新时，会遍历触发watcher的run函数
   */
  run () {
    if (this.active) { // 激活状态
      const value = this.get() // 调用get方法
      // 两个值不相等，例如computed值前后不相等
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          invokeWithErrorHandling(this.cb, this.vm, [value, oldValue], this.vm, info)
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list. // 依赖订阅者列表
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
