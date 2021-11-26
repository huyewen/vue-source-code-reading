

### initInternalComponent方法做了啥？



```

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.
  }
}
```

`initInternalComponent`方法接受两个参数，第一个参数是组件实例，即this。第二个参数是组件构造函数中传入的option，这个option根据上文的分析，他是在`createComponentInstanceForVnode`方法中定义的：

```
export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
): Component {
  const options: InternalComponentOptions = {
    _isComponent: true,
    _parentVnode: vnode,
    parent
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  return new vnode.componentOptions.Ctor(options)
}
```

option中有三个属性值，`_isComponent`上面已经提到过了；`_parentVode`其实就是该组件实例的vnode对象（`createComponentInstanceForVnode`就是根据这个vnode对象去创建一个组件实例）；`parent`则是该组件的父组件实例对象。
然后我们用这样一个例子：

```
 <div id="demo">
        <comp :msg="msg" @log-msg="logMsg"></comp>
    </div>
    <script>
        Vue.component('comp', {
            props: ['msg'],
            template: `
                <div class="blog-post">
                <h3>{{ msg }}</h3>
                <button @click="$emit('log-msg', msg)">
                    Console Message
                </button>
            `
        });
        // 创建实例
        const app = new Vue({
            el: '#demo',
            data: {
                msg: 'props-message'
            },
            methods: {
                logMsg(data) {
                    console.log(data)
                }
            }
        });
    </script>
```

来看看具体`initInternalComponent`做了什么操作。

```
const opts = vm.$options = Object.create(vm.constructor.options)
```

首先，用`Object.create`这个[函数](https://link.segmentfault.com/?enc=pmBOCyoXVuevlFZfn5ziDA%3D%3D.%2FRmLBl930nEepQv9AJZN7dka1rbr3dZexy7Hyf2n3Uf%2FejhIx46JtgGg6DM1whVexl49etceA2036ygWlQRcDYhqRGIR6ijFiTlAY%2Bss3Al9uLyUAa3CgMU%2FesAkS%2B1a)，把组件构造函数的`options`挂载到`vm.$options`的`__proto__`上。

```
const parentVnode = options._parentVnode
opts.parent = options.parent
opts._parentVnode = parentVnode
```

接下把传入参数的option的`_parentVode`和`parent`挂载到组件实例`$options`上。用上面那个例子来说，`parent`就是我们组件的根实例，而`_parentVnode`就是`<comp :msg="msg" @log-msg="logMsg"></comp>`生成的一个Vnode对象。

```
const vnodeComponentOptions = parentVnode.componentOptions
opts.propsData = vnodeComponentOptions.propsData
opts._parentListeners = vnodeComponentOptions.listeners
opts._renderChildren = vnodeComponentOptions.children
opts._componentTag = vnodeComponentOptions.tag
```

然后把父组件里的vnode上的四个属性挂载到我们的`$options`上，还是用那个例子来说，`propsData`就是根据`:msg="msg"`生成的，他的值就是在根组件里定义的那个msg`{msg: "props-message"}`。而`_parentListeners`就是根据`@log-msg="logMsg"`生成的，他的值是`logMsg`这个定义在父组件中的方法。

```
if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
}
```

最后就是如果传入的option中如果有render，把render相关的也挂载到$options上。
因此，这个`initInternalComponent`主要做了两件事情：

1. 指定组件$options原型
2. 把组件依赖于父组件的props、listeners也挂载到options上，方便子组件调用。