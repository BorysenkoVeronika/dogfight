import {test,expect} from '@playwright/test';
type DebugWindow=Window & {dogfightDebug?:{playerId():string|null;entities():Array<{kind:string;ownerId?:string;x:number}>}};
test('two players share roster, movement and chat', async ({browser})=>{
  const first=await browser.newContext();const second=await browser.newContext();
  const a=await first.newPage();const b=await second.newPage();
  try {
    for(const [page,name] of [[a,'Alice E2E'],[b,'Bob E2E']] as const) {
      await page.goto('/');
      await page.locator('#player-name').fill(name);
      await page.getByRole('button',{name:'Training Room'}).click();
      await page.locator('#join-button').click();
      await expect(page.locator('#game')).toBeVisible();
    }
    for(const page of [a,b]){
      await expect(page.locator('#player-roster')).toContainText('Alice E2E');
      await expect(page.locator('#player-roster')).toContainText('Bob E2E');
    }
    const ownId=await a.evaluate(()=> (window as DebugWindow).dogfightDebug?.playerId());
    expect(ownId).toBeTruthy();
    const firstX=await b.evaluate(id=> (window as DebugWindow).dogfightDebug?.entities().find((e)=>e.kind==='ship'&&e.ownerId===id)?.x,ownId);
    expect(firstX).toBeDefined();
    await a.keyboard.down('ArrowUp');
    await expect.poll(async()=>await b.evaluate(id=> (window as DebugWindow).dogfightDebug?.entities().find((e)=>e.kind==='ship'&&e.ownerId===id)?.x,ownId),{timeout:500}).not.toBe(firstX);
    await a.keyboard.up('ArrowUp');
    await a.locator('#chat-input').fill('Hello from Playwright');
    await a.locator('#chat-form button').click();
    await expect(b.locator('#chat-messages')).toContainText('Hello from Playwright');
  } finally {await first.close();await second.close();}
});
