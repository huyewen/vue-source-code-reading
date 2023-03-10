/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type CacheEntry = {
  name: ?string;
  tag: ?string;
  componentInstance: Component;
};

type CacheEntryMap = { [key: string]: ?CacheEntry };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  // 先拿到选项中的name选项，没有的话就用标签名
  return opts && (opts.Ctor.options.name || opts.tag)
}

// name是否与pattern匹配
function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) { // 数组
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') { // 字符串
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) { // 正则
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

// 遍历cache，// 如果name不在include中或者在exclude中，则卸载组件
function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const entry: ?CacheEntry = cache[key]
    if (entry) {
      const name: ?string = entry.name
      // 如果name不在在include中或者在exclude中，则卸载组件
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

// 删除缓存中指定的组件，并调用组件的卸载函数对组件进行卸载
function pruneCacheEntry (
  cache: CacheEntryMap,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const entry: ?CacheEntry = cache[key]
  if (entry && (!current || entry.tag !== current.tag)) {
    entry.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  /**
   * 表示该组件是一个抽象组件，组件自身不会渲染成一个真实的DOM元素。比如在创建两个vm实例
   * 之间的父子关系时，会跳过抽象组件的实例
   * let parent = options.parent
  if (parent && !options.abstract) {
    // 找到不是抽象组件的父实例，然后将自身添加到父组件子实例数组中
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }
   */
  abstract: true,

  props: {
    // 字符串或正则表达式、数组。只有名称匹配的组件会被缓存
    include: patternTypes,
    // 字符串或正则表达式、数组。任何名称匹配的组件都不会被缓存
    exclude: patternTypes,
    // 最多可以缓存多少组件实例
    max: [String, Number]
  },

  methods: {
    // 在keep-alive挂载或者更新完之后触发
    cacheVNode () {
      const { cache, keys, vnodeToCache, keyToCache } = this
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        cache[keyToCache] = {
          name: getComponentName(componentOptions),
          tag,
          componentInstance,
        }
        keys.push(keyToCache)
        // prune oldest entry
        // 超出最大缓存数，则将最早放进去的移除掉
        /**
         * 为啥要设置缓存数量限制呢？
         * 因为componentInstance还存放在$el，也就是真实DOM，所以如果无限制的缓存，那么
         * 对内存资源的消耗是极大的，直接影响性能。
         */
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        this.vnodeToCache = null
      }
    }
  },

  created () {
    // 用于缓存子组件
    this.cache = Object.create(null)
    this.keys = []
  },
  // 当keep-alive被销毁时，会同时销毁它缓存的组件，并调用deactivated钩子函数
  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },
  mounted () {
    this.cacheVNode()
    // 监听include和exclude
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated () {
    this.cacheVNode()
  },

  render () {
    // 获取子组件
    const slot = this.$slots.default
    // 拿到子数组中第一个组件节点，如果不存在组件节点，那这里返回的就是undefined
    const vnode: VNode = getFirstComponentChild(slot)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      const name: ?string = getComponentName(componentOptions) // 获得组件名
      const { include, exclude } = this
      /**
       * 要是传了include或者exclude，那要对组件进行缓存的话，要不就得在include中，要不就不能在exclude，要是
       * 都存在两者中，那么还是会被缓存，因为下面第一个条件不成立，程序接着往下执行
       */
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) { // 如果不在include或者在exclude中，那么就不缓存了，直接返回找到的节点
        return vnode
      }

      const { cache, keys } = this
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (cache[key]) { // 如果缓存存在，则直接从缓存中拿出组件实例，后面patch的时候就不用重新初始化组件实例了
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest 先挪调，再加进去，保持当前key在栈顶位置
        remove(keys, key)
        keys.push(key)
      } else {
        // delay setting the cache until update
        // 组件挂载或者更新的时候对组件做缓存
        // 即将做缓存的虚拟节点
        this.vnodeToCache = vnode
        this.keyToCache = key
      }

      vnode.data.keepAlive = true // 对当前节点进行标记
    }
    return vnode || (slot && slot[0])
  }
}
