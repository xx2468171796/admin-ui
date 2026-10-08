import assert from 'node:assert/strict';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));
export function executablePath(){const cached='/home/admin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';return process.env.CHROMIUM_PATH || (existsSync(cached)?cached:chromium.executablePath());}
const browser=await chromium.launch({headless:true,executablePath:executablePath(),args:['--no-sandbox']});
let server;
try{
 server=await createServer({root:resolve(root,'examples/starter'),configFile:false,plugins:[react()],server:{host:'127.0.0.1',port:7100+Math.floor(Math.random()*600),hmr:false,watch:null}});await server.listen();
 const p=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(server.resolvedUrls.local[0]);
 const click=name=>p.getByRole('button',{name,exact:true}).click();const nav=name=>p.getByRole('navigation',{name:'主导航'}).getByRole('button',{name,exact:true}).click();
 await p.locator('tbody tr[data-row-key]').first().waitFor();assert.equal(await p.locator('tbody tr[data-row-key]').count(),10);
 const sidebarNav=p.getByRole('navigation',{name:'主导航'});const contentGroup=sidebarNav.getByRole('group',{name:'用户与内容'});
 assert.deepEqual(await contentGroup.locator('button').allInnerTexts(),['用户管理','公告编辑']);
 assert.deepEqual(await sidebarNav.locator('.aui-nav-group-title').allInnerTexts(),['看板','用户与内容','资金','素材','系统','页面模板']);
 assert.equal(await contentGroup.locator('.aui-nav-group-title').evaluate(el=>el.tagName),'H2');
 assert.equal(await contentGroup.locator('.aui-nav-group-title').evaluate(el=>getComputedStyle(el).fontSize),'12.9px');
 const ungrouped=['组件总览'];
 assert.deepEqual(await sidebarNav.locator(':scope > button').allInnerTexts(),ungrouped,'未分组菜单仍是 nav 直接子节点');
 assert.ok(await sidebarNav.locator('.aui-nav-group-title').first().isVisible());
 const groupTitleTop=(await contentGroup.locator('.aui-nav-group-title').boundingBox()).y;assert.ok(groupTitleTop<(await contentGroup.getByRole('button',{name:'用户管理'}).boundingBox()).y);
 await click('收起侧栏');await p.waitForTimeout(80);assert.equal(await sidebarNav.locator('.aui-nav-group-title').first().evaluate(el=>getComputedStyle(el).fontSize),'0px','折叠态组标题变一条细线（不写字）');assert.ok(await contentGroup.getByRole('button',{name:'用户管理'}).isVisible());
 { const acct=p.locator('.aui-acct-row');assert.ok(await acct.isVisible(),'折叠态留头像');assert.equal(await acct.getAttribute('aria-label'),'账号：陈组长');await acct.click();const pop=p.locator('.aui-acct-pop');await pop.waitFor();await p.waitForTimeout(150);assert.match(await pop.innerText(),/我的资料[\s\S]*API 令牌[\s\S]*管理后台[\s\S]*外观[\s\S]*退出登录/,'头像打开账号菜单');{const bx=await pop.boundingBox();assert.ok(bx.x>=48,`折叠态菜单向右弹出 x=${bx.x}`);};await p.keyboard.press('Escape');await pop.waitFor({state:'detached'});const co=p.locator('.aui-company');assert.equal(await co.getAttribute('aria-label'),'切换公司：当前 华南子公司（演示）');assert.equal((await co.boundingBox()).width<=40,true,'折叠态公司只剩图标'); }
 await click('展开侧栏');await p.waitForTimeout(80);assert.ok(await sidebarNav.locator('.aui-nav-group-title').first().isVisible());assert.match(await p.locator('.aui-acct-row').innerText(),/陈组长/,'展开时头像一行写名字');assert.equal(Math.round((await p.locator('.aui-sidebar').boundingBox()).width),232,'侧栏 232');assert.equal(Math.round((await p.locator('.aui-topbar').boundingBox()).height),48,'顶栏 48');assert.match(await p.getByRole('navigation',{name:'面包屑'}).first().innerText(),/用户与内容\s*用户管理/,'顶栏是真面包屑');assert.equal(await p.getByText('工作空间',{exact:true}).count(),0,'不再写「工作空间 /」');
 await click('下一页');await p.getByRole('cell',{name:'U1011',exact:true}).waitFor();await p.getByRole('button',{name:'查看详情',exact:true}).first().click();await p.getByRole('heading',{name:'用户详情',exact:true}).waitFor();await click('返回列表');await p.getByRole('cell',{name:'U1011',exact:true}).waitFor();
 await p.getByLabel('搜索关键词').fill('U1002');await p.getByLabel('搜索关键词').press('Enter');await p.getByText('U1002',{exact:true}).waitFor();assert.equal(await p.locator('tbody tr:visible').count(),1);
 await click('新增用户');await click('保存');await p.getByRole('alert').filter({hasText:'请填写昵称'}).waitFor();await p.locator('#edit-name').fill('测试用户');await p.locator('#edit-phone').fill('13800001111');await click('取消');await click('继续填写');assert.equal(await p.locator('#edit-name').inputValue(),'测试用户');await click('保存');await p.getByRole('dialog').waitFor({state:'hidden'});
 await nav('公告编辑');await p.getByLabel('Markdown 内容').fill('# 共享规范\n\n<script>alert(1)</script>');await p.getByRole('heading',{name:'共享规范'}).waitFor();await nav('用户管理');await nav('公告编辑');assert.match(await p.getByLabel('Markdown 内容').inputValue(),/共享规范/);await click('关闭公告编辑');await p.getByRole('heading',{name:'关闭未保存页面？'}).waitFor();await click('取消');
 await nav('系统设置');await p.getByRole('tablist',{name:'系统设置分区'}).waitFor();
 const gate=p.getByRole('switch',{name:'开放注册'});assert.equal(await gate.getAttribute('aria-checked'),'true');
 assert.equal(await gate.evaluate(el=>getComputedStyle(el).position),'relative','aui-switch 必须自带定位上下文');
 const captcha=p.getByRole('switch',{name:'强制人机验证'});assert.equal(await captcha.getAttribute('aria-checked'),'false');await captcha.click();await p.getByRole('status').filter({hasText:'强制人机验证已启用'}).waitFor();assert.equal(await captcha.getAttribute('aria-checked'),'true');
 assert.ok(await p.locator('.aui-content').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'开关所在容器不得出现纵向溢出');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const modulesTab=p.getByRole('tab',{name:'模块开关'});assert.equal(await modulesTab.getAttribute('aria-selected'),'true');assert.equal(await modulesTab.getAttribute('tabindex'),'0');
 // 2.4.0: 系统设置是 TabbedPage，每个分区一个 tabpanel（打开过的保留挂载、隐藏）
 const sectionPanel=p.getByRole('tabpanel',{name:'模块开关'});assert.match(await sectionPanel.innerText(),/模块总开关/);assert.equal(await sectionPanel.getAttribute('aria-labelledby'),await modulesTab.getAttribute('id'));assert.equal(await modulesTab.getAttribute('aria-controls'),await sectionPanel.getAttribute('id'));
 await modulesTab.focus();await p.keyboard.press('ArrowRight');await p.getByRole('tabpanel',{name:'安全策略'}).getByText('登录防护',{exact:true}).waitFor();assert.equal(await p.getByRole('tab',{name:'安全策略'}).evaluate(el=>el===document.activeElement),true,'方向键切换后焦点跟随');
 await p.keyboard.press('End');assert.equal(await p.getByRole('tab',{name:'安全策略'}).getAttribute('aria-selected'),'true','End 跳过 disabled 分区');
 // 标签条只横向滚：纵向不能有溢出（否则 Windows 在标签旁画带箭头的竖滚动条），激活下划线仍压在分隔线上
 const tabBars=await p.evaluate(()=>[...document.querySelectorAll('.aui-section-tabs,.aui-tabs')].map(el=>{const cs=getComputedStyle(el);return{cls:el.className,overflowY:cs.overflowY,extra:el.scrollHeight-el.clientHeight};}));
 assert.ok(tabBars.length>=2,'前置条件：页内分区和工作标签都在页面上');
 for(const bar of tabBars){assert.equal(bar.overflowY,'hidden',`${bar.cls} 必须写明 overflow-y:hidden`);assert.ok(bar.extra<=0,`${bar.cls} 纵向溢出 ${bar.extra}px`);}
 const underline=await p.evaluate(()=>{const tab=document.querySelector('.aui-section-tab.aui-active').getBoundingClientRect();const bar=document.querySelector('.aui-section-tabs-bar').getBoundingClientRect();return Math.abs(tab.bottom-bar.bottom);});
 assert.ok(underline<=0.5,`激活下划线应压在分区条底线上，差 ${underline}px`);
 await p.keyboard.press('Home');assert.equal(await modulesTab.getAttribute('aria-selected'),'true');
 const resultTrigger=p.getByRole('button',{name:'查看生成结果'});await resultTrigger.click();const resultDialog=p.getByRole('dialog');await resultDialog.getByRole('heading',{name:'生成结果'}).waitFor();
 assert.equal(await resultDialog.getByRole('button',{name:'保存',exact:true}).count(),0,'非表单弹层不应出现保存按钮');
 assert.ok(await resultDialog.evaluate(el=>el.classList.contains('aui-dialog')&&el.classList.contains('aui-dialog-lg')),'Dialog 与 FormDialog 共用 aui-dialog 样式');
 await p.keyboard.press('Escape');await resultDialog.waitFor({state:'hidden'});await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>document.activeElement?.textContent?.trim()),'查看生成结果','关闭后焦点回到触发按钮');
 await nav('资金账本');const ledgerPage=p.locator('#aui-page-ledger');await ledgerPage.locator('tbody tr').first().waitFor();
 assert.equal(await ledgerPage.locator('tbody tr[data-row-key]').count(),10);
 const cursorFooter=ledgerPage.locator('.aui-pagination');assert.match(await cursorFooter.locator('span').first().innerText(),/^已显示 1–10 条$/,'游标列表写已显示范围，不写第 1 页');
 assert.doesNotMatch(await cursorFooter.innerText(),/共 \d+ 条/,'游标模式不显示总条数');
 assert.equal(await cursorFooter.getByRole('button',{name:'第 1 页'}).count(),0,'游标模式不显示页码');
 assert.equal(await cursorFooter.getByRole('button',{name:'上一页'}).isDisabled(),true);
 const firstRow=await ledgerPage.locator('tbody tr td').first().innerText();
 await cursorFooter.getByRole('button',{name:'下一页'}).click();await ledgerPage.getByText('L9010',{exact:true}).waitFor();assert.match(await cursorFooter.locator('span').first().innerText(),/^已显示 11–20 条$/);assert.notEqual(await ledgerPage.locator('tbody tr td').first().innerText(),firstRow);
 await cursorFooter.getByRole('button',{name:'上一页'}).click();await ledgerPage.getByText(firstRow,{exact:true}).waitFor();assert.equal(await cursorFooter.getByRole('button',{name:'上一页'}).isDisabled(),true);
 await cursorFooter.getByRole('button',{name:'下一页'}).click();await ledgerPage.getByText('L9010',{exact:true}).waitFor();
 await ledgerPage.getByLabel('搜索关键词').fill('充值到账');await ledgerPage.getByLabel('搜索关键词').press('Enter');await p.waitForTimeout(300);assert.match(await cursorFooter.locator('span').first().innerText(),/^已显示 1–\d+ 条$/,'换筛选条件必须回到第一页');
 assert.ok((await ledgerPage.locator('tbody tr').allInnerTexts()).every(row=>row.includes('充值到账')));
 await ledgerPage.getByLabel('搜索关键词').press('Escape');await p.waitForTimeout(300);
 const sidebarBg=()=>p.locator('.aui-sidebar').evaluate(el=>getComputedStyle(el).backgroundColor);const forestSidebar=await sidebarBg();
 await click('外观');await p.locator('.aui-appearance-pop').getByRole('button',{name:'深海蓝',exact:true}).click();assert.equal(await p.locator('.aui-appearance-pop').getByRole('button',{name:'深海蓝',exact:true}).getAttribute('aria-pressed'),'true');await p.keyboard.press('Escape');await p.locator('.aui-appearance-pop').waitFor({state:'detached'});
 assert.equal(await p.locator('.adminui').evaluate(el=>getComputedStyle(el).getPropertyValue('--aui-primary')),'#2f5f8f');assert.notEqual(await sidebarBg(),forestSidebar,'换色卡后侧栏跟着换色');
 await p.reload();await p.locator('tbody tr').first().waitFor();assert.equal(await p.locator('.adminui').evaluate(el=>getComputedStyle(el).getPropertyValue('--aui-primary')),'#2f5f8f','色卡刷新后仍保留');assert.notEqual(await sidebarBg(),forestSidebar);
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
// 顶栏挤满（宿主往 headerActions 塞了身份选择 / 徽标 / 一排图标）：手机上菜单按钮也不能被盖住（中心点就是按钮本身），也不撑宽整页
await p.waitForTimeout(400);// 侧栏收回屏外的动画走完再量
// 宿主的顶栏像运维平台那样挤：身份选择 + 徽标 + 一排按钮 + 「名字 · 退出」。390 / 360 都要：菜单按钮能点、整页不撑宽、
// 每个操作保持自己的大小（文字不被截断），放不下的整排横滑能滑到（最后的「退出」点得到），右边有渐隐提示
for(const width of [390,360]){
  await p.setViewportSize({width,height:844});await p.waitForTimeout(400);
  const crowd=await p.evaluate(async()=>{
    const a=document.querySelector('.aui-topbar-actions');const added=[];
    const add=(html)=>{const t=document.createElement('template');t.innerHTML=html;const el=t.content.firstElementChild;el.setAttribute('data-probe','crowd');a.appendChild(el);added.push(el);return el;};
    add('<span class="aui-badge">演示登录</span>');
    add('<button type="button" class="aui-input aui-select"><span>老板 · 管理员</span><svg width="15" height="15"></svg></button>');
    add('<button type="button" class="aui-button aui-button-ghost aui-button-sm">改密码</button>');
    const last=add('<button type="button" class="aui-button aui-button-ghost aui-button-sm">老板 · 退出</button>');
    await new Promise(r=>setTimeout(r,120));
    const b=document.querySelector('.aui-mobile-menu').getBoundingClientRect();
    const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
    const truncated=[...a.querySelectorAll('*')].filter(el=>{const cs=getComputedStyle(el);if(el.closest('.aui-sr-only')||el.clientWidth<=1)return false;return (cs.overflow==='hidden'||cs.overflowX==='hidden'||cs.textOverflow==='ellipsis')&&el.textContent.trim()&&el.scrollWidth>el.clientWidth+1;}).map(el=>el.textContent.trim());
    const fadeBefore=a.dataset.end;
    a.scrollLeft=a.scrollWidth;await new Promise(r=>setTimeout(r,120));
    const r=last.getBoundingClientRect();const atLast=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    const out={width:innerWidth,menu:!!hit&&!!hit.closest('.aui-mobile-menu'),menuWidth:b.width,doc:document.documentElement.scrollWidth,truncated,fadeBefore,fadeAfter:a.dataset.end,lastReachable:!!atLast&&last.contains(atLast),lastRight:r.right};
    a.scrollLeft=0;for(const el of added)el.remove();return out;
  });
  assert.ok(crowd.menu&&crowd.menuWidth>=32,`${width} 顶栏挤满时菜单按钮被盖住 / 压扁 ${JSON.stringify(crowd)}`);
  assert.ok(crowd.doc<=crowd.width,`${width} 顶栏挤满时撑宽了整页 ${JSON.stringify(crowd)}`);
  assert.deepEqual(crowd.truncated,[],`${width} 顶栏的操作被压到文字截断 ${JSON.stringify(crowd)}`);
  assert.ok(crowd.lastReachable&&crowd.lastRight<=crowd.width+1,`${width} 最后一个操作（退出）滑不到 / 点不到 ${JSON.stringify(crowd)}`);
  assert.equal(crowd.fadeBefore,'true',`${width} 右边藏着操作却没有渐隐提示 ${JSON.stringify(crowd)}`);
  assert.equal(crowd.fadeAfter,'false',`${width} 滑到头了还在渐隐 ${JSON.stringify(crowd)}`);
}
await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);
await click('打开菜单');await p.waitForTimeout(250);assert.ok(await p.getByRole('navigation',{name:'主导航'}).locator('.aui-nav-group-title').first().isVisible(),'手机抽屉仍显示组标题');await p.screenshot({path:resolve(root,'test/artifacts/mobile-grouped-nav.png')});await nav('用户管理');await p.waitForTimeout(300);assert.ok(await p.locator('.aui-sidebar').evaluate(el=>el.getBoundingClientRect().right<=0),'点分组内菜单后抽屉收回屏外');const pageHeader=await p.locator('#aui-page-users .aui-resource > .aui-panel-header').first().evaluate(el=>{const r=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,height:b.height};};return{text:r(el.querySelector('.aui-panel-title')),actions:r(el.querySelector(':scope > .aui-header-actions'))};});
 assert.ok(!(pageHeader.text.x<pageHeader.actions.right&&pageHeader.actions.x<pageHeader.text.right&&pageHeader.text.y<pageHeader.actions.bottom&&pageHeader.actions.y<pageHeader.text.bottom),`390 页面头标题与操作重叠 ${JSON.stringify(pageHeader)}`);
 assert.ok(pageHeader.actions.height<=44,`390 页面头操作区控件被压成 ${pageHeader.actions.height}px`);
 await click('新增用户');await p.waitForTimeout(400);const footer=await p.locator('.aui-dialog-footer').boundingBox();assert.ok(footer.y+footer.height<=844);
 const dialogHeader=await p.locator('.aui-dialog-header').evaluate(el=>{const t=el.querySelector('.aui-header-text').getBoundingClientRect();const btn=el.querySelector('.aui-dialog-close').getBoundingClientRect();return{textRight:t.right,btnLeft:btn.left,btnWidth:btn.width};});
 assert.ok(dialogHeader.textRight<=dialogHeader.btnLeft+1,`390 弹层标题与关闭钮重叠 ${JSON.stringify(dialogHeader)}`);
 assert.ok(dialogHeader.btnWidth>=32,`390 弹层关闭钮被压缩成 ${dialogHeader.btnWidth}px`);await p.screenshot({path:resolve(root,'test/artifacts/mobile-form.png')});await click('取消');assert.deepEqual(errors,[]);await p.close();await server.close();
 server=await createServer({root,configFile:false,plugins:[react()],server:{host:'127.0.0.1',port:7100+Math.floor(Math.random()*600),hmr:false,watch:null}});await server.listen();const f=await browser.newPage();await f.goto(server.resolvedUrls.local[0]+'test/fixture.html');await f.locator('#result').filter({hasText:'initial'}).waitFor();
 const outside=await f.locator('#outside').evaluate(el=>({background:getComputedStyle(el).backgroundColor,font:getComputedStyle(el).fontSize}));
 await f.getByRole('button',{name:'慢查询',exact:true}).click();await f.getByRole('button',{name:'快查询',exact:true}).click();await f.locator('#result').filter({hasText:'fast'}).waitFor();await f.waitForTimeout(500);assert.equal(await f.locator('#result').innerText(),'fast');await f.getByRole('button',{name:'失败查询',exact:true}).click();await f.locator('#result').filter({hasText:'服务失败'}).waitFor();
 await f.getByRole('button',{name:'打开表单'}).click();await f.getByLabel('内容',{exact:true}).fill('rejected');await f.getByRole('button',{name:'保存',exact:true}).evaluate(el=>{el.click();el.click();});await f.getByRole('alert').filter({hasText:'服务端拒绝'}).waitFor();assert.equal(await f.locator('#calls').innerText(),'1');assert.equal(await f.getByLabel('内容',{exact:true}).inputValue(),'rejected');await f.keyboard.press('Escape');await f.getByRole('button',{name:'继续填写'}).click();await f.getByLabel('内容',{exact:true}).fill('success');await f.getByRole('button',{name:'保存',exact:true}).click();await f.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await f.locator('#calls').innerText(),'2');
 const file=f.locator('input[type=file]');await file.setInputFiles({name:'bad.png',mimeType:'text/html',buffer:Buffer.from('bad')});await f.getByRole('alert').filter({hasText:'类型不支持'}).waitFor();await file.setInputFiles({name:'fail.png',mimeType:'image/png',buffer:Buffer.from('x')});await f.getByRole('alert').filter({hasText:'上传器失败'}).waitFor();await file.setInputFiles({name:'ok.png',mimeType:'image/png',buffer:Buffer.from('x')});await f.getByRole('button',{name:'取消上传'}).click();await f.waitForTimeout(350);assert.equal(await f.locator('#received').innerText(),'0');await file.setInputFiles({name:'ok.png',mimeType:'image/png',buffer:Buffer.from('x')});await f.locator('#received').filter({hasText:'1'}).waitFor();
 await f.getByRole('button',{name:'色卡设置'}).first().click();await f.getByRole('button',{name:'黛紫',exact:true}).click();await f.keyboard.press('Escape');assert.equal(await f.locator('.adminui').first().evaluate(el=>getComputedStyle(el).getPropertyValue('--aui-primary')),'#5b4a8b');assert.equal(await f.locator('.adminui').nth(1).evaluate(el=>getComputedStyle(el).getPropertyValue('--aui-primary')),'#2a7a78','另一个 Provider 保持自己的色卡');assert.deepEqual(await f.locator('#outside').evaluate(el=>({background:getComputedStyle(el).backgroundColor,font:getComputedStyle(el).fontSize})),outside);
 // 判据按「包含块」而不是 DOM 链：绝对定位元素是否被裁剪取决于包含块，按 DOM 链找
 // 「第一个 overflow 非 visible 的祖先」会漏掉这一类。
 const escapedBubbles=page=>page.evaluate(()=>[...document.querySelectorAll('input[type=checkbox]')].filter(input=>{
  for (let el=input.parentElement;el;el=el.parentElement){const st=getComputedStyle(el);
   if(st.position!=='static'||st.transform!=='none'||st.filter!=='none')return false;}
  return true;
 }).map(input=>`${input.getAttribute('aria-label')||input.id||'bubble'}@${Math.round(input.getBoundingClientRect().x)}`));
 const queryPage=await browser.newPage({viewport:{width:390,height:844}});const queryErrors=[];queryPage.on('pageerror',e=>queryErrors.push(e.message));
 await queryPage.goto(server.resolvedUrls.local[0]+'test/query.html');await queryPage.locator('.aui-query .aui-select').first().waitFor();await queryPage.waitForTimeout(150);
 const queryBox=()=>queryPage.evaluate(()=>{
  const read=el=>{const r=el.getBoundingClientRect();const label=el.querySelector('span');
   return{width:Math.round(r.width),row:Math.round(r.y),text:(el.textContent||'').trim(),
    clipped:el.scrollWidth>el.clientWidth+1||Boolean(label&&label.scrollWidth>label.clientWidth+1)};};
  return{doc:document.documentElement.scrollWidth,inner:window.innerWidth,
   selects:[...document.querySelectorAll('.aui-query .aui-select')].map(read),
   buttons:[...document.querySelectorAll('.aui-query .aui-button')].map(read),
   search:read(document.querySelector('.aui-query-search'))};
 });
 const narrow=await queryBox();
 for (const select of narrow.selects){
  // 「宽度够」和「读得出来」是两条断言：只断宽度的话，把下限调小一点这条就会以
  // 「看着有宽度、其实文案被裁」的形态回来。
  assert.ok(select.width>=120,`390 筛选控件被压成 ${select.width}px（${select.text}），应宁可换行也要保持可读`);
  assert.equal(select.clipped,false,`390 筛选控件文案被裁：${select.text}（宽 ${select.width}px）`);
 }
 assert.equal(narrow.doc,narrow.inner,`390 下不得因为加了下限反而顶宽整页：${narrow.doc}/${narrow.inner}`);
 assert.ok(new Set(narrow.selects.map(s=>s.row)).size>1,'390 下五个筛选应当换行而不是挤在一行');
 // QueryBar 没有「查询 / 重置」按钮了（打字就筛），不再检查两个按钮同行。
 await queryPage.setViewportSize({width:1440,height:900});await queryPage.waitForTimeout(250);
 const wideBar=await queryBox();
 assert.deepEqual(wideBar.selects.map(s=>s.width),[170,170,170,170,170],'1440 下筛选控件宽度应保持 170px');
 assert.equal(new Set([...wideBar.selects,...wideBar.buttons,wideBar.search].map(s=>s.row)).size,1,'1440 下查询栏应仍是单行');
 assert.equal(wideBar.doc,wideBar.inner);
 assert.deepEqual(queryErrors,[]);await queryPage.close();
 const overflowPage=await browser.newPage({viewport:{width:390,height:844}});const overflowErrors=[];overflowPage.on('pageerror',e=>overflowErrors.push(e.message));
 await overflowPage.goto(server.resolvedUrls.local[0]+'test/overflow.html');await overflowPage.locator('.aui-switch').waitFor();await overflowPage.waitForTimeout(150);
 const wide=await overflowPage.evaluate(()=>{const el=document.querySelector('.aui-table-scroll');return{inner:window.innerWidth,doc:document.documentElement.scrollWidth,client:el.clientWidth,scroll:el.scrollWidth,overflow:getComputedStyle(el).overflowX};});
 assert.ok(wide.scroll>wide.client&&wide.overflow==='auto','前置条件：宽表应由内层容器横向滚动');
 assert.equal(wide.doc,wide.inner,`隐藏的 bubble input 顶宽了整页：documentElement.scrollWidth=${wide.doc} 而视口 ${wide.inner}（内滚容器本身 ${wide.client}/${wide.scroll} 完全正常，所以只看滚动容器查不出来）`);
 assert.deepEqual(await escapedBubbles(overflowPage),[],'宽表里的 bubble input 必须有定位祖先作为包含块');
 // 标签条放不下：不出系统滚动条；右侧渐隐 + 箭头；点箭头往右滚、左侧出现；滚轮横滚；键盘切到最后一个会被滚进可视区
 const strip=overflowPage.locator('.aui-section-tabs-scroll');const stripList=strip.locator('[role=tablist]');
 const stripState=()=>strip.evaluate(el=>{const list=el.querySelector('[role=tablist]');const arrows=[...el.querySelectorAll('.aui-scroll-arrow')].map(a=>getComputedStyle(a).visibility);return{start:el.dataset.start??null,end:el.dataset.end??null,left:list.scrollLeft,scrollbar:list.offsetHeight-list.clientHeight,sbw:getComputedStyle(list).scrollbarWidth,arrows};});
 let st=await stripState();
 assert.equal(st.scrollbar,0,'标签条不能占出滚动条的高度');assert.equal(st.sbw,'none');
 assert.deepEqual([st.start,st.end,st.arrows],[null,'true',[]],'一开始只有右侧有更多：右侧渐隐，没有圆箭头');
 { const more=strip.getByRole('button',{name:'很多分区：更多'});assert.ok(await more.isVisible(),'放不下时右端出「更多 ⌄」');const g=await strip.evaluate(el=>{const list=el.querySelector('[role=tablist]').getBoundingClientRect();const m=el.querySelector('.aui-strip-trailing').getBoundingClientRect();return{list:list.right,more:m.left};});assert.ok(g.more>=g.list-0.5,`「更多」在标签条右边，不压标签字 ${JSON.stringify(g)}`);
   await more.click();const menu=overflowPage.getByRole('menu');await menu.waitFor();assert.equal(await menu.getByRole('menuitemcheckbox').count(),10,'「更多」列出全部分区');await menu.getByRole('menuitemcheckbox',{name:'第9个分区'}).click();await overflowPage.waitForTimeout(600);
   assert.equal(await overflowPage.getByRole('tab',{name:'第9个分区'}).getAttribute('aria-selected'),'true','从「更多」选中分区');st=await stripState();assert.ok(st.left>100,`选中的分区被滚进来：${st.left}`);assert.equal(st.start,'true','滚过之后左侧出现渐隐'); }
 await stripList.evaluate(el=>{el.scrollLeft=0;});await overflowPage.waitForTimeout(100);
await stripList.hover();await overflowPage.mouse.wheel(0,120);await overflowPage.waitForTimeout(150);
 assert.ok((await stripState()).left>0,'竖向滚轮在标签条上横向滚动');
 await overflowPage.getByRole('tab',{name:'第1个分区'}).click();await overflowPage.keyboard.press('End');await overflowPage.waitForTimeout(600);
 const lastIn=await overflowPage.evaluate(()=>{const list=document.querySelector('.aui-section-tabs');const tab=[...list.querySelectorAll('[role=tab]')].at(-1);const a=list.getBoundingClientRect(),b=tab.getBoundingClientRect();return b.left>=a.left-0.5&&b.right<=a.right+0.5;});
 assert.ok(lastIn,'键盘切到最后一个分区时它被滚进可视区');st=await stripState();assert.deepEqual([st.start,st.end],['true',null],'滚到最右：只剩左侧渐隐');
 assert.deepEqual(overflowErrors,[]);await overflowPage.close();
 const tall=await browser.newPage({viewport:{width:1440,height:900}});const tallErrors=[];tall.on('pageerror',e=>tallErrors.push(e.message));await tall.goto(server.resolvedUrls.local[0]+'test/sidebar.html');
 const menu=tall.getByRole('navigation',{name:'主导航'});await menu.getByRole('button',{name:'菜单项 1',exact:true}).waitFor();
 // The host page sets no body margin (sidebar.html): the SDK removes the UA 8px so the dark rail is not framed in white.
 assert.equal(await tall.evaluate(()=>getComputedStyle(document.body).margin),'0px');assert.equal(await tall.locator('aside.aui-sidebar').evaluate(n=>n.getBoundingClientRect().left),0);
 // Controls hosts put in the sidebar slots keep ≥4.5:1 text contrast on the dark brand rail
 // (the rail re-points text tokens to light; light-surface controls must follow or turn white-on-white).
 const railCheck=()=>tall.locator('#profile-controls').evaluate(root=>{const rgba=c=>{const m=c.match(/[\d.]+/g).map(Number);const k=c.startsWith('color(')?255:1;return{r:m[0]*k,g:m[1]*k,b:m[2]*k,a:m[3]??1}};const over=(t,b)=>({r:t.r*t.a+b.r*(1-t.a),g:t.g*t.a+b.g*(1-t.a),b:t.b*t.a+b.b*(1-t.a),a:1});const lum=c=>[c.r,c.g,c.b].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const bgOf=el=>{const chain=[];for(let n=el;n;n=n.parentElement){chain.push(rgba(getComputedStyle(n).backgroundColor));if(n.classList.contains('aui-sidebar'))break}return chain.reverse().reduce((acc,c)=>c.a?over(c,acc):acc,{r:255,g:255,b:255,a:1})};const out=[];for(const el of root.querySelectorAll('span,a,button,input')){if(!el.textContent.trim()&&el.tagName!=='INPUT')continue;if(el.tagName==='SPAN'&&el.querySelector('button'))continue;const fg=over(rgba(getComputedStyle(el).color),bgOf(el));const bg=bgOf(el);const [x,y]=[lum(fg),lum(bg)];out.push({text:(el.textContent||el.value).trim(),ratio:+((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)})}return out});
 for(const mode of ['light','dark']){await tall.evaluate(m=>document.querySelectorAll('.adminui').forEach(n=>n.setAttribute('data-aui-mode',m)),mode);const lowRail=(await railCheck()).filter(c=>c.ratio<4.5);assert.equal(lowRail.length,0,`侧栏里的控件文字对比度不足（${mode}）: ${JSON.stringify(lowRail)}`)}
 await tall.evaluate(()=>document.querySelectorAll('.adminui').forEach(n=>n.setAttribute('data-aui-mode','light')));
 const reachable=async label=>{
  const profile=await tall.locator('.aui-account-slot').evaluate(el=>({display:getComputedStyle(el).display,bottom:el.getBoundingClientRect().bottom}));
  // 折叠态按既有设计隐藏 profile；只要它显示，就必须落在视口内而不是被推到下面。
  if (profile.display==='none') assert.ok(label.includes('折叠'),`${label}: profile 不该被隐藏`);
  else assert.ok(profile.bottom<=901&&profile.bottom>0,`${label}: 侧栏底部 profile 落在视口内，实测 bottom=${profile.bottom}`);
  const metrics=await menu.evaluate(el=>({scroll:el.scrollHeight,client:el.clientHeight,overflow:getComputedStyle(el).overflowY}));
  assert.ok(metrics.scroll>metrics.client,`${label}: 菜单内容高于可视区时必须靠内部滚动而不是撑高侧栏(${metrics.scroll}/${metrics.client})`);
  assert.ok(['auto','scroll'].includes(metrics.overflow),`${label}: 菜单区必须可滚`);
  // 菜单项 30 is the bottom-most entry (last item of the last group 系统).
  const last=menu.getByRole('button',{name:'菜单项 30',exact:true});await last.scrollIntoViewIfNeeded();await last.click();
  await tall.locator('#clicked').filter({hasText:'page-30'}).waitFor();
  assert.equal(await tall.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${label}: 不得横向溢出`);
 };
 const headerBoxes=async()=>tall.evaluate(()=>{
  const header=document.querySelector('.aui-panel-header');
  const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const actions=header.querySelector('.aui-header-actions');
  return{
   // 面板头通栏（贴卡片边、自带内边距）：对齐按内容盒比较
   header:(()=>{const r=rect(header);const cs=getComputedStyle(header);const l=parseFloat(cs.paddingLeft),rt=parseFloat(cs.paddingRight);return{...r,x:r.x+l,right:r.right-rt,width:r.width-l-rt};})(),
   text:rect(header.querySelector('.aui-header-text')),
   actions:rect(actions),
   controls:[...actions.children].filter(el=>!el.classList.contains('aui-page-actions-slot')).map(el=>{const r=el.getBoundingClientRect();return{tag:el.tagName,role:el.getAttribute('role'),height:r.height,right:r.right};}),
   wrap:getComputedStyle(header).flexWrap,
  };
 });
 const overlaps=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
 const checkHeader=async(label,{singleRow})=>{
  const box=await headerBoxes();
  assert.ok(box.actions.right<=box.header.right+1,`${label}: 操作区不得超出面板右边界 actions.right=${box.actions.right} header.right=${box.header.right}`);
  for (const control of box.controls)
   assert.ok(control.right===undefined||control.right<=box.header.right+1,`${label}: 控件越出面板 ${JSON.stringify(control)}`);
  assert.ok(!overlaps(box.text,box.actions),`${label}: 标题与操作区矩形不得重叠 text=${JSON.stringify(box.text)} actions=${JSON.stringify(box.actions)}`);
  for (const control of box.controls)
   // 开关是 32 × 18，最矮的控件就是它
   assert.ok(control.height>=18&&control.height<=40,`${label}: 操作区控件被压成 ${control.height}px（${control.tag}/${control.role}），应保持控件档高`);
  if (singleRow){
   const mid=r=>r.y+r.height/2;assert.ok(Math.abs(mid(box.text)-mid(box.actions))<8,`${label}: 桌面应与标题同一行并垂直居中 text=${mid(box.text)} actions=${mid(box.actions)}`);
   assert.ok(Math.abs(box.actions.right-box.header.right)<2,`${label}: 桌面操作区应右对齐 actions.right=${box.actions.right} header.right=${box.header.right}`);
   assert.ok(box.actions.height<=40,`${label}: 桌面操作区应是单行，实测 ${box.actions.height}px（控件被挤到多行）`);
  } else {
   assert.ok(box.actions.y>=box.text.bottom-1,`${label}: 窄屏操作区应换到标题下方 actions.y=${box.actions.y} text.bottom=${box.text.bottom}`);
   assert.ok(box.actions.x-box.header.x<2,`${label}: 窄屏换行后操作区应左对齐 actions.x=${box.actions.x} header.x=${box.header.x}`);
   assert.ok(box.actions.height>40,`${label}: 五个控件在 390 下应占多行`);
  }
 };
 await checkHeader('1440 面板头', {singleRow:true});
 await reachable('展开态');
 assert.ok(await menu.evaluate(el=>{const t=el.scrollTop;el.scrollTop=0;const top=el.scrollTop;el.scrollTop=t;return top===0&&t>0;}),'最后一项确实是滚动后才够得到的');
 await tall.getByRole('button',{name:'收起侧栏',exact:true}).click();await tall.waitForTimeout(120);await reachable('折叠态');
 await tall.getByRole('button',{name:'展开侧栏',exact:true}).click();await tall.waitForTimeout(120);
 await tall.setViewportSize({width:390,height:844});await tall.getByRole('button',{name:'打开菜单',exact:true}).click();await tall.waitForTimeout(300);
 const drawer=await tall.evaluate(()=>{const nav=document.querySelector('.aui-sidebar nav');const profile=document.querySelector('.aui-account-slot').getBoundingClientRect();return{scroll:nav.scrollHeight,client:nav.clientHeight,overflow:getComputedStyle(nav).overflowY,profileBottom:profile.bottom};});
 assert.ok(drawer.scroll>drawer.client&&['auto','scroll'].includes(drawer.overflow),'手机抽屉菜单区必须可滚');
 assert.ok(drawer.profileBottom<=844+1&&drawer.profileBottom>0,`手机抽屉 profile 应在视口内，实测 ${drawer.profileBottom}`);
 const lastMobile=menu.getByRole('button',{name:'菜单项 30',exact:true});await lastMobile.scrollIntoViewIfNeeded();await lastMobile.click();await tall.locator('#clicked').filter({hasText:'page-30'}).waitFor();
 await checkHeader('390 面板头', {singleRow:false});
 assert.deepEqual(tallErrors,[]);await tall.close();
 const focusPage=await browser.newPage({viewport:{width:1280,height:900}});const focusErrors=[];focusPage.on('pageerror',e=>focusErrors.push(e.message));
 await focusPage.goto(server.resolvedUrls.local[0]+'test/focus.html');await focusPage.locator('#open-form').waitFor();
 // 判据是「关闭后 activeElement 就是那颗触发按钮本身」——比节点身份，不比 tagName / textContent。
 const restored=async(triggerSelector,label)=>{
  const handle=await focusPage.locator(triggerSelector).elementHandle();
  const ok=await focusPage.evaluate(el=>document.activeElement===el,handle);
  if (!ok) {
   const actual=await focusPage.evaluate(()=>{const a=document.activeElement;return`${a.tagName}#${a.id||''}.${String(a.className||'').split(' ')[0]} isBody=${a===document.body}`;});
   assert.fail(`${label}: 关闭后焦点应回到触发按钮本身，实测 activeElement = ${actual}`);
  }
  await handle.dispose();
 };
 const closePaths=[
  ['#open-plain','Dialog + Esc',async()=>focusPage.keyboard.press('Escape')],
  ['#open-plain','Dialog + 遮罩',async()=>focusPage.locator('.aui-dialog-overlay').click({position:{x:5,y:5}})],
  ['#open-plain','Dialog + 页脚按钮',async()=>focusPage.locator('#plain-footer').click()],
  ['#open-form','FormDialog + Esc',async()=>focusPage.keyboard.press('Escape')],
  ['#open-form','FormDialog + 取消',async()=>focusPage.getByRole('button',{name:'取消'}).click()],
  ['#open-form','FormDialog + 提交成功',async()=>{await focusPage.getByRole('button',{name:'保存'}).click();await focusPage.getByRole('dialog').waitFor({state:'hidden'});}],
 ];
 for (const [trigger,label,close] of closePaths){
  await focusPage.locator(trigger).click();await focusPage.locator('.aui-dialog[data-state=open]').waitFor();await focusPage.waitForTimeout(80);
  assert.ok(await focusPage.evaluate(()=>document.querySelector('.aui-dialog').contains(document.activeElement)),`${label}: 打开后焦点应进入弹层`);
  await close();await focusPage.getByRole('dialog').waitFor({state:'hidden'});await focusPage.waitForTimeout(150);
  await restored(trigger,label);
 }
 await focusPage.getByRole('button',{name:'色卡设置'}).click();await focusPage.locator('.aui-appearance-pop').waitFor();await focusPage.waitForTimeout(80);await focusPage.keyboard.press('Escape');await focusPage.locator('.aui-appearance-pop').waitFor({state:'detached'});await focusPage.waitForTimeout(150);
 await restored('button[aria-label="色卡设置"]','AppearanceButton + Esc');
 // 开启者在弹层打开期间被宿主销毁（保存后刷新列表就是这样）：不许把人丢回页面顶端。
 const doomed=await focusPage.locator('#open-volatile').elementHandle();
 await focusPage.locator('#open-volatile').click();await focusPage.locator('.aui-dialog[data-state=open]').waitFor();await focusPage.waitForTimeout(120);
 assert.equal(await focusPage.evaluate(el=>el.isConnected,doomed),false,'前置条件：开启者应已在弹层打开期间被宿主销毁');await doomed.dispose();
 await focusPage.keyboard.press('Escape');await focusPage.getByRole('dialog').waitFor({state:'hidden'});await focusPage.waitForTimeout(200);
 const orphan=await focusPage.evaluate(()=>{const a=document.activeElement;return{isBody:a===document.body,connected:a.isConnected,inRoot:Boolean(document.querySelector('.adminui')?.contains(a)),tag:a.tagName};});
 assert.equal(orphan.isBody,false,`开启者被销毁后不得把焦点丢到 body，实测 ${JSON.stringify(orphan)}`);
 assert.ok(orphan.connected&&orphan.inRoot,`开启者被销毁后应落在仍存在的所属区域，实测 ${JSON.stringify(orphan)}`);
 assert.deepEqual(await escapedBubbles(focusPage),[],'表单弹层页也不得有逃出包含块的 bubble input');
 assert.deepEqual(focusErrors,[]);await focusPage.close();
 console.log('PASS browser: consumer list/detail/forms/tabs/Markdown/charts/mobile, grouped+flat sidebar navigation (collapsed/mobile), switch toggle (no overflow), in-page tabs keyboard, non-form Dialog Esc/focus return, cursor pagination without totals; stale requests, async save failure/double submit, upload failure/cancel, scoped themes/portals; hidden Radix bubble inputs stay inside a positioned containing block so a 720px table cannot widen the document; five query filters stay readable and wrap at 390 while 1440 keeps one 170px row; 33-item sidebar scrolls internally with profile reachable at 1440/collapsed/390; crowded panel header single-row at 1440 and wrapped left-aligned without overlap at 390; crowded topbar at 390 never covers the menu button; return focus lands on the exact trigger node for Dialog/FormDialog/AppearanceButton across Esc/overlay/cancel/submit, and on the surviving region when the trigger is destroyed.');
} finally {await server?.close();await browser.close();}
