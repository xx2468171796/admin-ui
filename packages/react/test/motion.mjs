import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({root,configFile:false,plugins:[react()],server:{host:'127.0.0.1',port:7100+Math.floor(Math.random()*600),hmr:false,watch:null}});
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || chromium.executablePath()});
const output = await mkdtemp(join(tmpdir(),'adminui-motion-'));
try {
  await server.listen();
  const page = await browser.newPage({reducedMotion:'no-preference',viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(() => {
    window.motionCalls = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function(...args) { if (this.classList.contains('aui-reveal')) window.motionCalls++; return original.apply(this,args); };
  });
  await page.goto(server.resolvedUrls.local[0]+'test/motion.html');
  await page.waitForFunction(()=>document.querySelector('.aui-skeleton')?.dataset.paused==='false');
  const animationStyles=()=>page.evaluate(()=>({
    shimmer:getComputedStyle(document.querySelector('.aui-skeleton-line'),'::after').animationName,
    dots:getComputedStyle(document.querySelector('.aui-loading-dots-shapes > span')).animationName,
    outside:getComputedStyle(document.querySelector('#outside')).animationName,
  }));
  assert.deepEqual(await animationStyles(),{shimmer:'aui-shimmer',dots:'aui-dot-pulse',outside:'outside-spin'});
  await page.getByLabel('保留输入').fill('keep-me');
  await page.evaluate(()=>window.savedInput=document.querySelector('input'));
  const before = await page.evaluate(()=>window.motionCalls);
  await page.getByRole('button',{name:'重播',exact:true}).click();
  await page.waitForFunction(count=>window.motionCalls>count,before);
  assert.equal(await page.evaluate(()=>document.querySelector('input')===window.savedInput),true,'replay must not remount form fields');
  assert.equal(await page.getByLabel('保留输入').inputValue(),'keep-me');
  await page.waitForFunction(()=>document.querySelector('.aui-reveal').getAnimations().length===0);
  assert.equal(await page.locator('.aui-reveal').evaluate(el=>getComputedStyle(el).transform),'none');
  await page.evaluate(()=>window.scrollTo(0,1600));
  await page.waitForFunction(()=>document.querySelector('.aui-skeleton').dataset.paused==='true');
  assert.equal(await page.locator('.aui-skeleton-line').first().evaluate(el=>getComputedStyle(el,'::after').animationPlayState),'paused');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForFunction(()=>document.querySelector('.aui-skeleton').dataset.paused==='false');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>document.querySelector('.adminui').dataset.auiPaused==='true');
  assert.equal(await page.locator('.aui-loading-dots').getAttribute('data-paused'),'true');
  await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>document.querySelector('.aui-skeleton').dataset.paused==='false');
  for (const mode of ['none','reduced']) {
    if (mode==='none') await page.getByRole('button',{name:'切换动效',exact:true}).click();
    else { await page.getByRole('button',{name:'切换动效',exact:true}).click(); await page.emulateMedia({reducedMotion:'reduce'}); }
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.aui-skeleton-line'),'::after').animationName==='none');
    assert.deepEqual(await animationStyles(),{shimmer:'none',dots:'none',outside:'outside-spin'});
    const runs=await page.evaluate(()=>window.motionCalls);
    await page.getByRole('button',{name:'重播',exact:true}).click(); await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>window.motionCalls),runs,`${mode} must disable JS animations too`);
    await page.getByRole('button',{name:'打开弹窗',exact:true}).click(); await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.activeElement?.textContent==='打开弹窗');
    const box=await page.getByRole('button',{name:'重播',exact:true}).boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
    assert.equal(await page.getByRole('button',{name:'重播',exact:true}).evaluate(el=>getComputedStyle(el).transform),'none'); await page.mouse.up();
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('.aui-skeleton').dataset.paused==='false');
  assert.deepEqual(errors,[]); await page.close();
  // Reviewable gallery in the actual distributed starter at phone and desktop widths.
  const galleryServer=await createServer({root:join(root,'examples/starter'),configFile:false,plugins:[react()],server:{host:'127.0.0.1',port:7100+Math.floor(Math.random()*600),hmr:false,watch:null}});
  try {
    await galleryServer.listen(); const gallery=await browser.newPage({reducedMotion:'no-preference'});
    for(const width of [360,390,1440]) {
      await gallery.setViewportSize({width,height:1000}); await gallery.goto(galleryServer.resolvedUrls.local[0]);
      if(width<760) await gallery.getByRole('button',{name:'打开菜单',exact:true}).click();
      await gallery.getByRole('navigation').getByRole('button',{name:'动效示例',exact:true}).click();
      await gallery.getByRole('heading',{name:'动效示例',exact:true}).waitFor();
      await gallery.getByLabel('试填内容').fill('状态保留'); await gallery.getByRole('button',{name:'重播入场',exact:true}).click();
      assert.equal(await gallery.getByLabel('试填内容').inputValue(),'状态保留');
      await gallery.waitForFunction(()=>document.querySelector('.aui-reveal').getAnimations().length===0);
      assert.ok(await gallery.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await gallery.screenshot({path:join(output,`motion-${width}.png`),fullPage:true});
    }
    await gallery.close();
  } finally {await galleryServer.close();}
  console.log(`PASS motion: replay state, reduced-motion/none CSS+WAAPI, offscreen/background pause, focus and 360/390/1440 gallery (${output})`);
} finally {await browser.close();await server.close();}
