/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

export let isUsingMicroTask = false

const callbacks = []
let pending = false

function flushCallbacks () { // 清理callback数组，并调用每个回调函数
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// 这里我们有使用微任务的异步延迟包装器。
// 在 2.5 中，我们使用（宏）任务（结合微任务）。
// 但是，当状态在重绘之前改变时，它有一些微妙的问题
//（例如#6813，出入过渡）。
// 此外，在事件处理程序中使用（宏）任务会导致一些奇怪的行为
// 这是无法规避的（例如#7109、#7153、#7546、#7834、#8109）。
// 所以我们现在再次在任何地方使用微任务。
// 这种权衡的一个主要缺点是存在一些场景
// 微任务的优先级太高，应该在两者之间触发
// 顺序事件（例如 #4521、#6690，它们有变通方法）
// 甚至在同一事件的冒泡之间 (#6566)。
let timerFunc // timer回调

// nextTick 行为利用了可以访问的微任务队列
// 通过本机 Promise.then 或 MutationObserver。
// MutationObserver 有更广泛的支持，但是它存在严重错误
// 在触摸事件处理程序中触发时，iOS 中的 UIWebView >= 9.3.3。 它
// 触发几次后完全停止工作...所以，如果是原生的
// Promise 可用，我们将使用它：
/* $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) { // 原生可用的promise可用，则使用他
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    // 在有问题的 UIWebViews 中，Promise.then 并没有完全中断，但是
    // 它可能会陷入一个奇怪的状态，回调被推入
    // 微任务队列，但队列没有被刷新，直到浏览器
    // 需要做一些其他的工作，例如 处理一个计时器。 因此我们可以
    // 通过添加一个空计时器“强制”刷新微任务队列。
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (!isIE && typeof MutationObserver !== 'undefined' && ( // promise用不了，则使用MutationObserver
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2 // 改变文本节点值，触发MutationObserver
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) { // setImmediate可用，则使用setImmediate
  // Fallback to setImmediate.
  // Technically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else { // 其它都不可用，则使用setTimeout
  // Fallback to setTimeout.
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true
    timerFunc() // 启动异步调用回调队列，所以在同一个事件循环中，调用nextTick的都会被push到callbacks数组中，等待下一个事件循环被调用。
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
