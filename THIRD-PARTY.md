# 第三方说明

Button/Input/Textarea/Checkbox/Choice/FormDialog 的组合来源于 shadcn/ui 的 new-york 组件模式，基于 Radix UI primitives，按本 SDK 的独立作用域 CSS 和主题 token 适配。没有要求消费者安装 shadcn CLI 或 Tailwind。

shadcn/ui — https://github.com/shadcn-ui/ui — MIT
Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Radix UI、class-variance-authority、clsx、Lucide、React、ECharts、react-markdown、remark-gfm 使用其各自随依赖包分发的许可证。重依赖仅在使用对应子路径时加载。
# 可选 Excel 解析

`read-excel-file`（MIT）用于 `@adminui/react/excel` 子路径读取 XLSX。动态导入，不进入根入口；官方来源 https://github.com/catamphetamine/read-excel-file 。
