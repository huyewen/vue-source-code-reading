/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
const componentVNodeHooks = {
  // 组件初始化时
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    /**
     * 如果实例存在，说明是从keepAlive缓存中拿出来，只需要重新patch就行，
     * 当然，如果该组件没被缓存过，但是正要被缓存，那么此时不存在componentInstance，
     * 但是keepAlive还是为true，此时条件不成立，还是按照普通组件一样继续向下执行创建流程
     */
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      // 传入的新旧vnode是同一个
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      // 如果实例不存在，则为组件创建一个组件实例
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance // 当前组件实例,作为即将创建的组件实例的父实例
      )
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },
  // 组件虚拟节点比对时
  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions // 获取最新的options选项
    // 不需要重新创建组件实例，将新势力指向老实例
    const child = vnode.componentInstanc = oldVnode.componentInstance
    // 更新组件的props、listeners以及children等信息值
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode // 新占位节点
      options.children // new children
    )
  },
  // 组件被插入挂载成功时
  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) { // 如果组件是从缓存里拿出来的，或者是要第一次缓存的组件
      if (context._isMounted) { // 更新的时候，此时context为KeepAlive实例
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        // 会递归调用每个后代组件的activated钩子函数
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },
  // 组件被销毁时
  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)

export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }

  const baseCtor = context.$options._base // Vue

  // plain options object: turn it into a constructor
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // async component
  /**
   * 异步组件注册时候传入的是一个工厂函数，所以并非像普通函数一样是
   * extend之后的构造函数
   */
  /**
   * 异步组件触发加载的时间是在执行render生成VNode过程中，也就是走到createComponent
   * 这里，当判断组件为异步组件，也就是无Ctor.id的时候，这时候会执行resolveAsyncComponent
   * 方法到服务器请求该异步组件的资源。
   */
  let asyncFactory
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor // 工厂函数
    /**
     * resolveAsyncComponent返回的是异步组件的构造函数，不过由于异步请求，所以同步
     * 代码获取的Ctor可能是undefined，当为undefined的时候，Vue会创建一个注释占位节点，
     * 里面放置渲染这个异步组件所有的信息数据。
     * 
     * 当异步组件经过首次加载后，异步组件的资源会被缓存起来，此时，如果当前的异步
     * 组件再次被使用时，resolveAsyncComponent会直接返回已经请求成功的异步组件资源，
     * 此时返回的Ctor就不是undefined，所以可以进入下面的处理逻辑
     */
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor)
    // 在第一次执行到这里时，如果Ctor不是undefined，那么有种可能，那就是异步组件工厂函数返回的
    // 对象中delay为0并且loading组件存在，那这时返回的Ctor为loading组件的构造函数（具体可看resolveAsyncComponent代码解析）
    if (Ctor === undefined) {
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  // 在组件构造函数创建后，假如全局mixins被应用，则再次解析构造函数选项
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  // 组件listener
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  // dom listeners
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // 如果是抽象函数，除了slot/props/listeners，其它都会被过滤掉
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // install component management hooks onto the placeholder node
  installComponentHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  return vnode
}

// 为虚拟节点创建组件实例
export function createComponentInstanceForVnode (
  // we know it's MountedComponentVNode but flow doesn't
  vnode: any, // 外壳节点，也就是在父节点树中的占位节点
  // activeInstance in lifecycle state
  parent: any // 父实例
): Component {
  const options: InternalComponentOptions = {
    _isComponent: true, // 当前实例为组件
    _parentVnode: vnode, // 当前组件在父节点树中的占位节点，也就是外壳节点
    parent // 父组件实例
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  return new vnode.componentOptions.Ctor(options)
}

function installComponentHooks (data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i] // 钩子键
    const existing = hooks[key] // 是否存在这个钩子
    const toMerge = componentVNodeHooks[key]
    /**
     * existing要不就不在，这是和toMerge不等，并且整个if条件成立
     * existing要是在，但是和toMerge相等，并且没有被合并过，那么条件也成立
     * existing要是在，但是和toMerge相等，那两者没比较合并，条件不成立
     * existing要是在，并且和toMerge不相等，但是已经被合并过了，那么条件也不成立
     */
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}
// 所谓的合并，就是将两个钩子函数放入一个新函数中，以达到同时调用的效果
function mergeHook (f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b)
    f2(a, b)
  }
  merged._merged = true
  return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
function transformModel (options, data: any) {
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
    ; (data.attrs || (data.attrs = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  const existing = on[event]
  const callback = data.model.callback
  if (isDef(existing)) {
    if (
      Array.isArray(existing)
        ? existing.indexOf(callback) === -1
        : existing !== callback
    ) {
      on[event] = [callback].concat(existing)
    }
  } else {
    on[event] = callback
  }
}
