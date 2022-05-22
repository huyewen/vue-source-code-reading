/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  /**
   * 每一个实例构造器，包括Vue，都有一个唯一的cid，让我们可以为原型继承创建
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance 类继承
   */
  Vue.extend = function (extendOptions: Object): Function {
    // 子类选项
    extendOptions = extendOptions || {} // 创建子类时传入的options
    const Super = this // Super指向父级构造函数
    const SuperId = Super.cid // 父级cid
    /**
     * extendOptions._Ctor用于缓存构造函数，我们在使用自定子
     * 组件的时候会调用Vue.extend，初次生成vnode的时候生成新
     * 构造函数并缓存，如果页面数据有更新，则会重新生成vnode
     * 并做diff，在第二次生成vnode过程中给，调用Vue.extend就
     * 回直接从缓存中取。
     */
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }
    // 
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) { // 验证组件名
      validateComponentName(name)
    }
    // 创建子类构造器
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 将子类构造器原型指向父类构造器原型，也就是继承父类原型链
    Sub.prototype = Object.create(Super.prototype) // 继承
    // 将子类原型对象上的constructor属性从新指向子类构造器
    Sub.prototype.constructor = Sub
    Sub.cid = cid++ // 设置子类唯一编号cid值
    Sub.options = mergeOptions( // 合并子类选项
      Super.options,
      extendOptions
    )
    Sub['super'] = Super // 将super指向父类构造器

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup 将组件添加到自身的components中，方便组件调用自己
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    // 在扩展时保留对超级选项的引用。
    // 稍后在实例化时我们可以检查 Super 的选项是否已经被更新。
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options) // 合并后的选项

    /**
     * 最后 Sub上没有的属性和方法如下
     * Vue.version = '__VERSION__'
        Vue.compile = compileToFunctions
        Vue.config 
        Vue.util
        Vue.set
        Vue.delete
        Vue.nextTick
     */

    // cache constructor
    // 缓存子类构造器
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
