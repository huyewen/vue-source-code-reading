/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    // Vue实例的唯一标识，新建Vue实例时，uid都会递增，渲染组件时也同样会触发
    vm._uid = uid++

    // 测试代码性能，以下是开始测量，相当于打一个开始标记点------
    // let startTag, endTag
    // /* istanbul ignore if */
    // if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    //   startTag = `vue-perf-start:${vm._uid}`
    //   endTag = `vue-perf-end:${vm._uid}`
    //   mark(startTag)
    // }

    // a flag to avoid this being observed
    // 监听对象变化时用于过滤vm
    // _isVue为ture时(即传入的值是Vue实例本身)不会新建observer实例
    vm._isVue = true
    // merge options
    // 处理组件配置项
    // 当选项options存在并且选项中的_isComponent为true时（_isComponent是内部创建子组件时才会添加为true的属性）
    // 也就是说当前vue实例是组件
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 对 子组件 做一个性能优化，减少原型链上的动态查找，提高执行效率
      initInternalComponent(vm, options)
    } else {
      // 根组件上对选项的合并，将全局配置选项合并到根组件的局部配置上，换句话说
      // 将构造器及构造器父级上定义的options与实例化时传入的options进行合并
      vm.$options = mergeOptions(
        // 从实例构造函数上获取选项，若其有祖先，则返回选项中包含其祖先选项
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    /*
    初始化一些和生命周期相关的属性，例如vm.$parent、vm.$root、
    vm.$children、vm.refs、vm._watcher、vm._inactive、vm._directInactive、
    vm._isMounted、vm._isDestroyed、vm._isBeingDestroyed
    */
    initLifecycle(vm)
    /**
    * 初始化事件相关的属性，当有父组件的相关listener方法绑定在子组件上时
    */
    initEvents(vm)
    /**
     * 初始化渲染所需的$slots、$scopedSlots以及$createElement等属性
     */
    initRender(vm)
    /**
     * 调用钩子函数beforeCreate
    */
    callHook(vm, 'beforeCreate')
    /**
     * 在初始化data/props之前，解析注入的数据,之所以在initState之前，是有可能在data中对inject进行引用
     */
    initInjections(vm) // resolve injections before data/props
    /**
     * 初始化数据，进行双向绑定 state/props
     */
    initState(vm)
    /**
     * 在data/props初始化完成后初始化provide中的数据或者方法，之所以在initState之后，是有可能在provide中引用data/props中属性
     */
    initProvide(vm) // resolve provide after data/props
    /**
     * 调用created钩子函数
    */
    callHook(vm, 'created')

    // 性能测量，以下是结束测量------
    /* istanbul ignore if */
    // if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    //   vm._name = formatComponentName(vm, false)
    //   mark(endTag)
    //   measure(`vue ${vm._name} init`, startTag, endTag)
    // }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// 该函数用于性能优化，创建配置对象访问API，减少运行时原型链的查找，提高执行效率
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // 基于 构造函数 上的配置对象创建 vm.$options
  // 也就是创建一个以构造函数的静态属性options为原型的对象并赋值给vm.$options
  /**
   * 例如以下代码
   * function Vue(){}
   * Vue.options = {...}
   * vm = new Vue()
   * vm.$options = Object.create(Vue.options)
   * 
   */
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  // 这样做是因为它比动态枚举快
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// 从实例构造函数上获取配置选项
export function resolveConstructorOptions (Ctor: Class<Component>) {
  // 如果不存在基类，也就是说Ctor是基础Vue构造器时，那么options就是Vue构造函数上的options（静态属性）
  // 具体Vue.options里面有什么可以看vue-2.6.14\src\platforms\web\runtime\index.js中底部的注释
  let options = Ctor.options
  // Ctor有super属性，说明Ctor是通过Vue.extend()创建的子类
  if (Ctor.super) {
    // 以递归方式获取基类上的配置项
    const superOptions = resolveConstructorOptions(Ctor.super)
    // 缓存基类的配置选项
    const cachedSuperOptions = Ctor.superOptions
    // 当两个不相等时，说明基类的配置项发生了更改
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 将新的基类选项重新存到构造函数中
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 找到已更改的配置选项
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        // 如果有已更改选项，则将已更改选项modifiedOptions和extend选项合并
        extend(Ctor.extendOptions, modifiedOptions)
      }
      // 将基类选项和extend选项进行合并后重新赋值给options
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
