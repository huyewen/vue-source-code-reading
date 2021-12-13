/* @flow */
// 对Vue的第三层封装
import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 给Vue原型上添加元素挂载方法
const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  // el不能是body和HTML元素
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  /**
   * 当选项中没有渲染函数，则拿到template并将其编译成渲染函数
   * 然后将编译后的渲染函数挂载到$options上的render属性上
   */
  if (!options.render) {
    let template = options.template
    if (template) {
      /**
       * 当模板选项存在时，如果模板选项是字符串，则继续判断模板选项值
       * 是不是id选择器，是的话通过id获取对应元素对象；如果模板选项是
       * 元素对象，则将template选项置为innerHTML；如果模板选项是其它
       * 类型，则视为无效选项。
       */
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') { // template为script模板的id
          template = idToTemplate(template) // 获取模板
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) { // 模板不存在，提示警告
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {   // 模板为HTML元素节点
        template = template.innerHTML
      } else { // 无效模板
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      /**
       * 如果模板选项不存在，则拿到el对应的HTML代码作为模板并赋给template选项
       */
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }
      // 将模板编译并生成render函数并将render函数挂到render选项上
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        /**
         * delimiters: 该选项可以改变纯文本插入分隔符，当不传递值时，vue默认的
         * 分隔符为{{}}，如果我们想用其它模板，可以通过delimiters修改。
         */
        delimiters: options.delimiters,
        /**
         * comments：当设为true时，将会保留且渲染模板中的HTML注释。默认行为是舍弃它们。
         */
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
// 获取
function getOuterHTML (el: Element): string {
  // 如果el.outerHTML存在,则返回包含el以及el所有子元素
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    // 将对el进行深复制（包含el中所有节点关系）后的副本添加到新创建的container中
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}
// 将compileToFunction方法暴露给Vue作为静态方法存在
Vue.compile = compileToFunctions

export default Vue
