/* @flow */

import { inBrowser } from 'core/util/env'
import { makeMap } from 'shared/util'

export const namespaceMap = {
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML'
}

export const isHTMLTag = makeMap(
  'html,body,base,head,link,meta,style,title,' +
  'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
  'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
  'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
  's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
  'embed,object,param,source,canvas,script,noscript,del,ins,' +
  'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
  'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
  'output,progress,select,textarea,' +
  'details,dialog,menu,menuitem,summary,' +
  'content,element,shadow,template,blockquote,iframe,tfoot'
)

// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
export const isSVG = makeMap(
  'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
  'foreignobject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
  'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
  true
)

export const isPreTag = (tag: ?string): boolean => tag === 'pre'

export const isReservedTag = (tag: string): ?boolean => {
  return isHTMLTag(tag) || isSVG(tag)
}

export function getTagNamespace (tag: string): ?string {
  if (isSVG(tag)) {
    return 'svg'
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  if (tag === 'math') {
    return 'math'
  }
}

const unknownElementCache = Object.create(null)
export function isUnknownElement (tag: string): boolean { // 
  /* istanbul ignore if */
  if (!inBrowser) {
    return true
  }
  if (isReservedTag(tag)) { // 已知保留标签
    return false
  }
  tag = tag.toLowerCase()
  /* istanbul ignore if */
  if (unknownElementCache[tag] != null) { // 缓存存在
    return unknownElementCache[tag]
  }
  // 创建一个无效的 HTML 元素，它没有特定属性，它的属性和方法都来自HTMLElement接口
  /*
  *HTMLUnknownElement和自定义元素的区别可以看这里
  https://www.zhangxinxu.com/wordpress/2018/03/htmlunknownelement-html5-custom-elements/
  */
  const el = document.createElement(tag) 
  if (tag.indexOf('-') > -1) { // 存在短横线，在浏览器中会被当作自定义元素，在这里允许自定义元素作为未知元素
    // http://stackoverflow.com/a/28210364/1070244
    return (unknownElementCache[tag] = (
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement
    ))
  } else { // 未知元素
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(el.toString()))
  }
}

export const isTextInputType = makeMap('text,number,password,search,email,tel,url')
