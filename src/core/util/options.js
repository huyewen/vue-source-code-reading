/* @flow */

import config from '../config'
import { warn } from './debug'
import { set } from '../observer/index'
import { unicodeRegExp } from './lang'
import { nativeWatch, hasSymbol } from './env'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
// 选项合并策略对象
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  /**
   * el提供一个在页面已经存在DOM元素作为Vue实例挂载目标，因此它只在创建Vue实例才存在，在
   * 子类或者子组件中无法定义el选项，因此el的合并策略是在保证选项只存在于根实例的Vue实例
   * 的情况下使用默认策略进行合并
   * 
   * 可以看Vue.extend的定义
   * ...
   * Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    ...
    子类选项合并并没有传入子类实例
   */
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) { // 只允许Vue实例才拥有el实例，其他子类构造器不允许有el属性
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal

  const keys = hasSymbol
    ? Reflect.ownKeys(from)
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) { // 组件实例或者子类实例
    // in a Vue.extend merge, both should be functions
    if (!childVal) { // 子类不存在data，返回父类data
      return parentVal
    }
    if (!parentVal) { // 父类不存在data，返回子类data
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else { // Vue实例
    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

/**
 * 选项data合并策略
 */
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // 必须保证组件和子类是一个函数而不是一个对象
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
  return res
    ? dedupeHooks(res)
    : res
}

function dedupeHooks (hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
strats.props =
  strats.methods =
  strats.inject =
  strats.computed = function (
    parentVal: ?Object,
    childVal: ?Object,
    vm?: Component,
    key: string
  ): ?Object {
    if (childVal && process.env.NODE_ENV !== 'production') {
      assertObjectType(key, childVal, vm)
    }
    if (!parentVal) return childVal
    const ret = Object.create(null)
    extend(ret, parentVal)
    if (childVal) extend(ret, childVal)
    return ret
  }
strats.provide = mergeDataOrFn

/**
 * Default strategy.默认策略
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  // 子选项不在则用父选项，子选项存在则用子选项
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 */
// 校验组件名称是否符合规范
function checkComponents (options: Object) {
  // 遍历组件对象，校验每个组件名称是否符合规范
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName (name: string) {
  // 正则判断组件名是否符合HTML5标签规范
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  // 不能使用Vue自身内置的组件名，例如slot,component等
  // 不能使用HTML的保留标签，例如div/span等等
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 * 确保所有props选项值都是基础对象格式
 */
/**
 * Vue官方文档规定了props选项的书写形式有两种，分别是
 * 1、数组形式 {props: ['a','b','c']}
 * 2、对象形式 {
 *    props: {
 *      a: {
 *        type: 'String',
 *        default: ''
 *      },
 *      b: 'String'
 *    }
 * }
 * 但是从源码上两种形式都会转换成对象形式
 */
function normalizeProps (options: Object, vm: ?Component) {
  // 拿到子选项中的props属性
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  if (Array.isArray(props)) { // 假如props是数组
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) { // 假如props是基本对象
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val) // 如果val为基础对象，就直接返回，否则转换为对象
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') { // props啥也不是，报警告
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Vue官方文档规定inject有两种格式分别是
 * 1、数组格式
 * {
 *    inject: ['a']
 * }
 * 2、对象格式
 * {
 *    inject: {
 *      a: { // 新命名
 *        from: 'a', // 来源
 *        default: ''
 *      },
 *      b: 'b'
 *    }
 * }
 * 最后经过规范化都会转化为基本对象
 */
function normalizeInject (options: Object, vm: ?Component) {
  // 拿到子选项的inject选项
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  if (Array.isArray(inject)) { // inject为数组
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] } // 转化对象
    }
  } else if (isPlainObject(inject)) { // inject为普通对象
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val) // 两对像属性合并，有相同属性则后面的覆盖前面的
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') { // 啥也不是，报警告
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * 官方文档 规定自定义指令有两个书写格式
 * 1、函数方式，默认会在bind、update钩子中触发相同的行为
 * {
 *    directives: { 
 *      move: function(el, binding) { ... }
 *    }
 * }
 * 2、对象写法
 * {
 *    directives: { 
 *      move: {
 *        bind(el, binding) {...},
 *        inserted(el, binding) {...},
 *        update(el, binding) {...},
 *        componentUpdated(el, binding) {...},
 *        unbind(el, binding) {...}
 *      }
 *    }
 * }
 * 最终都会转化为对象形式
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') { // 当属性值为函数时
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
/**
 * 
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  // 校验组件
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }

  if (typeof child === 'function') {
    child = child.options
  }
  // 校验和规范化props选项
  normalizeProps(child, vm)
  // 校验和规范化inject选项
  normalizeInject(child, vm)
  // 校验和规范化指令选项
  normalizeDirectives(child)

  /**
   * 在子选项上应用扩展和混合,但前提是它是一个原始选项对象，而不是
   * 另一个 mergeOptions 调用的结果。只有合并的选项具有 _base 属性。
   */
  // 针对extends扩展的子类构造器
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  const options = {}
  let key
  // 父选项有则那父选项的选项
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    // 当父选项没有就拿子选项中的选项
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    // 拿到对应选项的选项策略，没有则使用默认策略
    const strat = strats[key] || defaultStrat
    // 执行选项的选项合并策略方法
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options // 返回合并后的选项
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}
