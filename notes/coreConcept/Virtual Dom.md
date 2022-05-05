### Virtual DOM



#### 浏览器的渲染流程

当浏览器接收到一个html文件时，JS引擎和浏览器的渲染引擎便开始了工作。从渲染引擎的角度，它首先会将html文件解析成一个DOM树，与此同时，浏览器将识别并加载CSS样式，并和DOM树一起合并为一个渲染树。有了渲染树后，渲染引擎将计算所有元素的位置信息，最后通过绘制，在屏幕打印最终的内容。JS引擎和渲染引擎虽然是两个独立的线程，但是JS引擎却可以触发渲染引擎工作，当我们通过脚本去修改元素位置或外观时，JS引擎会利用DOM相关的API方法去操作DOM对象，此时渲染引擎便开始工作，渲染引擎会触发回流或者重绘，下面是回流和重绘的两个概念：

- 回流：当我们对DOM的修改引发了元素尺寸的变化时，浏览器需要重新计算元素的大小和位置，最后将重新计算的结果绘制出来，这个过程称为回流。
- 重绘：当我们对DOM的修改只单纯改变元素的某方面颜色时，浏览器此时并不需要重新计算元素的大小和位置，而只要重新绘制新样式，这个过程称为重绘。

很显然，回流比重绘更加耗费性能。

通过了解浏览器基本的渲染机制，我们很容易联想到当不断的通过JS修改DOM时，不经意间会触发到渲染引擎的回流或者重绘，这个性能开销是非常巨大的。


