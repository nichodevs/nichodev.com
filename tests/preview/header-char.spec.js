const {test:base,expect}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path');
const {openCommunity,account,phrase}=require('../helpers/community'),F=require('../../community/char-format');
const test=base.extend({community:async({},use)=>{const f=await openCommunity();try{await use(f);}finally{await f.close();}},baseURL:async({community},use)=>use(community.origin)});
test('header CHAR opens the lab, follows the account and resets after logout on mobile',async({page,community})=>{
 const call=community.client();await account(call,'header_char');await call('/char',{method:'PUT',body:{design:{...F.make('robo-sound'),name:'MEU ROBÔ'},revision:0}});
 await page.goto('/comunidade/');const char=page.locator('#headerCharCanvas');await expect(char).toHaveAttribute('aria-label','CHAR padrão');const fallback=await char.evaluate(c=>c.toDataURL());await page.getByRole('link',{name:'Abrir CHAR LAB',exact:true}).click();await expect(page.locator('#nicoPreview')).toBeVisible();
 await page.locator('.account-button').click();await page.locator('#accountUser').fill('header_char');await page.locator('#accountPassword').fill(phrase);await page.locator('#accountSubmit').click();await expect(char).toHaveAttribute('aria-label','Seu CHAR: MEU ROBÔ');expect(await char.evaluate(c=>c.toDataURL())).not.toBe(fallback);
 await page.getByRole('link',{name:'MEU ESTÚDIO',exact:true}).click();await page.getByRole('button',{name:'SAIR DA CONTA',exact:true}).click();await expect(char).toHaveAttribute('aria-label','CHAR padrão');expect(await char.evaluate(c=>c.toDataURL())).toBe(fallback);
 for(const width of [360,390,910]){await page.setViewportSize({width,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#headerChar')).toBeVisible();}
 if(process.env.HEADER_PREVIEW_DIR){fs.mkdirSync(process.env.HEADER_PREVIEW_DIR,{recursive:true});await page.locator('.app-header').screenshot({path:path.join(process.env.HEADER_PREVIEW_DIR,'char-no-cabecalho.png')});}
});
