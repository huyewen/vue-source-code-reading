/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  hasSymbol,
  isPromise,
  remove
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'
import { currentRenderingInstance } from 'core/instance/render'

function ensureCtor (comp: any, base) {
  if (
    comp.__esModule ||
    (hasSymbol && comp[Symbol.toStringTag] === 'Module')
  ) {
    comp = comp.default
  }
  return isObject(comp)
    ? base.extend(comp)
    : comp
}

export function createAsyncPlaceholder (
  factory: Function,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag: ?string
): VNode {
  const node = createEmptyVNode()
  node.asyncFactory = factory
  node.asyncMeta = { data, context, children, tag }
  return node
}
/**
 * 异步组件实现的本质是2次渲染，先渲染成注释节点，当组件加载成功后，再通过forceRender
 * 重新渲染异步组件。
 * 异步组件的写法;
 * 
// 1：处理异步组件（工厂函数）
// 最终返回 该组件的构造函数
// Vue.component('HelloWorld', function (resolve, reject) {
//   // 这个特殊的 require 语法告诉 webpack
//   // 自动将编译后的代码分割成不同的块
//   // 下面的代码其实就是发送 ajax 请求，到后端获取这个组件的数据，
//   require(['./components/HelloWorld'], function (res) {
//     // 这个方法是发送 ajax 的回调函数，它是异步的，会在 ajax 请求完成后进行执行
//     // 它的执行时机要晚于同步代码
//     resolve(res)
//   })
// })
 
// 2：处理异步组件（工厂函数 + Promise）
// Vue.component('HelloWorld', () => import('./components/HelloWorld.vue'))
 
// 3：高级异步组件
// const AsyncComp = () => ({
// 需要加载的组件 (应该是一个 `Promise` 对象)
  component: import('./MyComponent.vue'),
  // 异步组件加载时使用的组件
  loading: LoadingComponent,
  // 加载失败时使用的组件
  error: ErrorComponent,
  // 展示加载时组件的延时时间。默认值是 200 (毫秒)
  delay: 200,
  // 如果提供了超时时间且组件加载也超时了，
  // 则使用加载失败时使用的组件。默认值是：`Infinity`
  timeout: 3000

 */

export function resolveAsyncComponent (
  factory: Function,
  baseCtor: Class<Component>
): Class<Component> | void {
  /**
   *  resolveAsyncComponent 函数会多次触发，第一次执行，发送请求，获取异步组件的信息，
   * 无论异步组件的信息是否正常获取，都会将相关信息赋值到factory上面，这里的相关信息包括
   * error、resolved、loading等表示异步组件获取状态的变量，然后执行forceRender方法重新渲染，这会
   * 再次进入resolveAsyncComponent函数，此时就可以根据error、resolved、loading等数据
   * 判断异步组件的加载状态，返回对应的组件信息
   */

  // factory.error为true表示组件加载失败，如果此时factory上有定义errorcomp，则直接返回它
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }
  // factory.resolved存在定义，则表示组件加载成功，那么只需返回这个异步组件定义就行
  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  // 当前正在执行render的vue实例
  const owner = currentRenderingInstance
  /**
   * 当异步组件第一次被使用并且第一次执行到这里时，factory.owners肯定没有被定义，所以忽略这个条件，继续向下执行
   * 这个owners为数组，里面存储着使用了当前异步组件的vue实例。
   * 
   * 下次执行到这里，owners已经被定义，那么直接将当前vue实例，push到owners就好
   * 
   * 
   */
  if (owner && isDef(factory.owners) && factory.owners.indexOf(owner) === -1) {
    // already pending
    factory.owners.push(owner)
  }
  // 如果
  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }
  /**
   * owners数组 表示factory被哪些vue实例引用，里面放置vue实例，当这个异步组件加载成功或者失败的时候，可以触发
   * owners中所有Vue实例的$forceUpdate，强制这些使用了当前异步组件的组件重新渲染，进而渲染出已经加载完成了的
   * 异步组件。
   */

  if (owner && !isDef(factory.owners)) {
    const owners = factory.owners = [owner]
    let sync = true
    let timerLoading = null
    let timerTimeout = null
      // 父实例销毁时，从owners中移出
      ; (owner: any).$on('hook:destroyed', () => remove(owners, owner))
    const forceRender = (renderCompleted: boolean) => {
      // 遍历各个Vue实例，让他们强制更新视图
      for (let i = 0, l = owners.length; i < l; i++) {
        (owners[i]: any).$forceUpdate()
      }
      // 如果renderCompleted为true，则清空owners，并且重置timerLoading和timerTimeout
      if (renderCompleted) {
        owners.length = 0
        if (timerLoading !== null) {
          clearTimeout(timerLoading)
          timerLoading = null
        }
        if (timerTimeout !== null) {
          clearTimeout(timerTimeout)
          timerTimeout = null
        }
      }
    }

    const resolve = once((res: Object | Class<Component>) => {
      // cache resolved
      factory.resolved = ensureCtor(res, baseCtor) // 生成一个组件构造函数
      //仅当这不是同步解析时调用回调
      //（异步解析在SSR期间被填充为同步）
      if (!sync) {
        forceRender(true) // 组件已经拿到了，强制各个vue实例更新
      } else {
        owners.length = 0
      }
    })

    const reject = once(reason => {
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender(true)
      }
    })

    const res = factory(resolve, reject)
    /**
     * 最上面三种异步组件定义方式，调用他们分别返回一下三种格式的结果
     * 第一种： res的结果看factory函数return了啥，这里是undefined，不过返回啥不是关键点，主要是成功与失败都执行
     * 了resolve或者reject
     * 第二种： 返回一个Promise实例
     * 第三种： 返回一个对象，其中对象的component属性是一个promise实例
     */


    if (isObject(res)) {
      if (isPromise(res)) { // 如果res是Promise实例
        // () => Promise
        if (isUndef(factory.resolved)) { // 如果异步组件没有加载完成
          res.then(resolve, reject)
        }
      } else if (isPromise(res.component)) { // 如果res的component属性是一个promise实例
        res.component.then(resolve, reject)

        if (isDef(res.error)) { // 存在加载错误时组件
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }

        if (isDef(res.loading)) { // 存在加载时组件
          // 为加载时组件创建一个构造函数
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          //  展示加载时组件的延时时间
          if (res.delay === 0) { // 如果是0，那么表示立即显示加载时组件
            factory.loading = true
          } else {
            /**在res.delay后，如果组件还没加载完成或者加载失败，让视图显示加载中组件
             * 但是如果在这个时间内组件加载完成或者失败了了，也就是resolve或者
             * reject被调用，那就会清除timerLoading等
             * 相关计时器
            */
            timerLoading = setTimeout(() => {
              timerLoading = null
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                // 
                factory.loading = true
                forceRender(false)
              }
            }, res.delay || 200) // 默认两百毫秒
          }
        }

        if (isDef(res.timeout)) { // 组件加载超时时间
          // 如果加载组件达到超时时间还没加载完成，那么直接算加载失败
          timerTimeout = setTimeout(() => {
            timerTimeout = null
            if (isUndef(factory.resolved)) {
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }

    sync = false
    // 如果 factory.loading 为 true 的话，说明异步组件还在加载中，此时返回 loadingComp
    // 如果不为 true 的话，说明异步组件加载完成，返回 resolved 异步组件即可
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
