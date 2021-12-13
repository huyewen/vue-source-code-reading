/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
/**
 * createCompilerCreator将传入的baseCompile存储，然后返回createCompiler函数
 * 并将返回的createCompiler赋给createCompiler变量再暴露出去
 */
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 把模板解析成抽象语法树AST
  const ast = parse(template.trim(), options)
  // 优化AST语法树，执行optimize方法
  if (options.optimize !== false) {
    optimize(ast, options)
  }
  // 代码生成，将AST生成对应的渲染函数
  const code = generate(ast, options)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
