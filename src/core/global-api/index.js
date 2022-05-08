/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'
import { observe } from 'core/observer/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  /**
   * config: {} 有以下属性
   * optionMergeStrategies（选项合并策略）、
   * silent（是否抑制警告）、
   * productionTip（在启动时是否显示生产模式提示消息）、
   * performance（是否记录性能）、
   * devtools（是否启动调试工具，开发环境时为true）、
   * errorHandler（错误回调）、
   * ignoredElements（存放被忽略的某些自定义元素）、
   * keyCodes（v-on 的自定义用户密钥别名）、
   * isReservedTag（用于检测标签是否为保留标签）
   * parsePlatformTagName（用于解析特定平台的真实标签名）、
   * isUnknownElement（用于检验一个标签是否为一个不确定的元素）、
   * getTagNamespace（获取标签元素的命名空间）、
   * mustUseProp（）、
   * _maxUpdateCount（调度程序刷新周期中允许的最大循环更新）
   * _lifecycleHooks([ 'beforeCreate','created','beforeMount','mounted','beforeUpdate',
   * 'updated','beforeDestroy','destroyed','activated','deactivated','errorCaptured','serverPrefetch'])
   */
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }


    Vue.options = Object.create(null)
    
  ASSET_TYPES.forEach(type => {
      Vue.options[type + 's'] = Object.create(null)
    })

    // this is used to identify the "base" constructor to extend all plain-object
    // components with in Weex's multi-instance scenarios.
    // 这用于标识“基”构造函数，用于在 Weex 的多实例场景中扩展所有普通对象组件。
    Vue.options._base = Vue

    // 将全局组件keep-alive装进Vue.options.components中
    extend(Vue.options.components, builtInComponents)

    initUse(Vue)
    initMixin(Vue)
    initExtend(Vue)
    initAssetRegisters(Vue)
    
}
