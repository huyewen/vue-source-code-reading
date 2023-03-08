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
    const vnode: VNode = getFirstComponentChild(slot)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        remove(keys, key)
        keys.push(key)
      } else {
        // delay setting the cache until update
        this.vnodeToCache = vnode
        this.keyToCache = key
      }

      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
