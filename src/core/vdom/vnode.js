/* @flow */

export default class VNode {
  tag: string | void; // 节点标签名称
  data: VNodeData | void; // 虚拟节点数据
  children: ?Array<VNode>; // 子虚拟节点
  text: string | void; // 当前节点的文本，一般文本节点或注释节点会有该属性
  elm: Node | void; // 当前虚拟节点对应的真实DOM节点
  ns: string | void; // 节点的namespace
  context: Component | void; // 组件的渲染上下文
  key: string | number | void; // 节点的key属性，用于作为节点的标识，有利于patch的优化
  componentOptions: VNodeComponentOptions | void; // 创建组件实例时用到的选项信息
  componentInstance: Component | void; // 组件实例
  parent: VNode | void; // 组件占位节点

  // strictly internal
  raw: boolean; // contains raw HTML? (server only) 是否包含原生HTML
  isStatic: boolean; // hoisted static node是否静态Node
  isRootInsert: boolean; // necessary for enter transition check
  isComment: boolean; // empty comment placeholder?
  isCloned: boolean; // 是否是克隆节点
  isOnce: boolean; // is a v-once node?
  asyncFactory: Function | void; // 异步组件工厂函数
  asyncMeta: Object | void;
  isAsyncPlaceholder: boolean;
  ssrContext: Object | void;
  fnContext: Component | void; // real context vm for functional nodes
  fnOptions: ?ComponentOptions; // for SSR caching
  devtoolsMeta: ?Object; // used to store functional render context for devtools
  fnScopeId: ?string; // functional scope id support

  constructor(
    tag?: string,
    data?: VNodeData,
    children?: ?Array<VNode>,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child (): Component | void {
    return this.componentInstance
  }
}
// 创建一个空的占位节点
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}
// 创建一个文本节点
export function createTextVNode (val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

/**
 * 
优化的浅层克隆，用于静态节点和槽节点，因为它们可以跨
多个渲染重用，克隆它们避免
 DOM 操作依赖于它们的 elm 引用时的错误。
 */
export function cloneVNode (vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
    // clone children array to avoid mutating original in case of cloning
    // a child.
    vnode.children && vnode.children.slice(),
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )
  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  cloned.isCloned = true
  return cloned
}
