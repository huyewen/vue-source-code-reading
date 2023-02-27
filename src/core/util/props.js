/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

/**
 * 首先，判断当前props类型是否为Boolean，或者类型数组是否含有Boolean，如果有，假如父组件没有传入
 * 并且自身没有默认值，则直接值为false，反则判断父组件传入的值是否为空字符串或者值与属性名同名，
 * 如果是则判断，当前props类型中是否有String类型或者Boolean类型是否在String之前，如果没有String
 * 或者Boolean在String之前，则将Value设为true。
 * 
 * 使用default：如果父组件传入的值为undefined或者没有传入，则使用默认值，为默认值添加响应式
 * 
 * 假如是在开发环境并且不在weex环境下，继续验证props
 * 
 * require验证：假如props属性值要求必须传入然后父组件没传，则提示属性必传警告
 * 
 * type验证：验证传入的值类型是否是定义的类型，不是的话提示输入值类型与定义类型不匹配警告
 * 
 * validator验证：如果有validator属性，则调用它，返回true则验证通过
 */

export function validateProp (
  key: string, // 键
  propOptions: Object, // 当前实例定义的props
  propsData: Object, // 父组件传入的props数据
  vm?: Component
): any {
  const prop = propOptions[key]
  const absent = !hasOwn(propsData, key)  // key在不在propsData中
  let value = propsData[key]
  // boolean casting
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  if (booleanIndex > -1) { // 如果是布尔类型 
    if (absent && !hasOwn(prop, 'default')) {
      // 如果父组件没有传入该属性的值或者没有默认值，则默认为false
      value = false
    } else if (value === '' || value === hyphenate(key)) {
      // 该属性值为空字符串或者属性值与属性名同名
      // 进一步说明就是，父组件传''空字符串 或者 以<SubComponentVue flag/>这种方式传
      const stringIndex = getTypeIndex(String, prop.type)
      // 不存在String类型，或者在prop.type中，Boolean类型在String类型前面，那么value设为true
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true // 在这种情况下，布尔值优先
      }
    }
  }
  // check default value
  if (value === undefined) { // 只有父组件传入的值为undefined或者没有传，才会使用默认值
    // 如果值不存在，则使用默认值，并且为默认值添加响应式
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    observe(value)
    toggleObserving(prevShouldObserve)
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  // 默认值不能为对象或者数组，Vue要求涉及到对象或数组的默认值都要以函数返回
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  // 
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  // 如果prop不能为空并且父组件没有传入该属性
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  // 如果值为null并且允许父组件不传入
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || type === true
  const expectedTypes = []
  if (type) { // 属性类型指定存在
    if (!Array.isArray(type)) { // 如果不是数组，转化为数组
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i], vm)
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }

  const haveExpectedTypes = expectedTypes.some(t => t)
  if (!valid && haveExpectedTypes) {
    // 输入的和要求的不一致
    warn(
      getInvalidTypeMessage(name, value, expectedTypes),
      vm
    )
    return
  }
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) { // 验证不通过
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol|BigInt)$/

function assertType (value: any, type: Function, vm: ?Component): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    try {
      valid = value instanceof type
    } catch (e) {
      warn('Invalid prop type: "' + String(type) + '" is not a constructor', vm);
      valid = false;
    }
  }
  return {
    valid,
    expectedType
  }
}

const functionTypeCheckRE = /^\s*function (\w+)/

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType (fn) {
  const match = fn && fn.toString().match(functionTypeCheckRE)
  return match ? match[1] : ''
}

function isSameType (a, b) {
  return getType(a) === getType(b)
}


/**
 * 返回type在指定类型中的索引值，因为指定类型可能是一个数组（props属性
 * 定义的类型可能为一个数组）
 */
function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) { // 不是数组（因为允许为props指定多个类型）
    // 如果是布尔类型，则返回0，否则返回-1
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    // 如果存在type相同的类型，则返回该类型在expectedTypes中的索引
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}

function getInvalidTypeMessage (name, value, expectedTypes) {
  let message = `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  // check if we need to specify expected value
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    isExplicable(typeof value) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${styleValue(value, expectedType)}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${styleValue(value, receivedType)}.`
  }
  return message
}

function styleValue (value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

const EXPLICABLE_TYPES = ['string', 'number', 'boolean']
function isExplicable (value) {
  return EXPLICABLE_TYPES.some(elem => value.toLowerCase() === elem)
}

function isBoolean (...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
