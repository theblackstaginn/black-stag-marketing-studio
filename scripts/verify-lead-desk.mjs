/* Offline synthetic-data browser QA. No live customer data or messages. */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const html = readFileSync("lead-desk.html", "utf8");
const js = readFileSync("lead-desk.js", "utf8");
const home = readFileSync("index.html", "utf8");
assert(html.includes('<meta name="robots" content="noindex,nofollow">'));
assert(html.includes('<meta name="referrer" content="no-referrer">'));
assert(js.includes('from("black_stag_leads")') && js.includes('eq("brand_id", BRAND_ID)'));
assert(js.includes('brand.owner_id !== userData.user.id'),"Missing primary owner gate");
assert(!/service_role|sk_test_|sk_live_/i.test(js),"Privileged token leaked in client");
assert(home.includes("leadDeskNav")&&home.includes("leadDeskMobileCard"));
assert(home.includes('"leadDeskNav","leadDeskMobileCard"'),"Brand visibility missing");

const stub = [
  "(() => {",
  " const now=Date.now(); const past=d=>new Date(now-d*86400000).toISOString();",
  " const brand='d51c76c3-a4a6-4109-99c2-5a4b3cff226b';",
  " const base={brand_id:brand,website_url:null,contact_preference:'email',message:null,utm_medium:null,utm_content:null,landing_path:null,consent_to_contact:true};",
  " const leads=[",
  " {...base,id:'11111111-1111-4111-8111-111111111111',name:'Alex Sample',business_name:'Hearth Bakery',email:'alex@example.test',phone:'5555550161',website_url:'https://example.test',primary_need:'Mobile problems',message:'Website is awkward on phones.',source:'website_checkup',status:'new',utm_source:'facebook',utm_campaign:'qualified_local_leads',created_at:past(0),updated_at:past(0)},",
  " {...base,id:'22222222-2222-4222-8222-222222222222',name:'Jordan Sample',business_name:'North Georgia Trades',email:'jordan@example.test',phone:null,primary_need:'New website',source:'website_checkup',status:'contacted',utm_source:null,utm_campaign:null,created_at:past(5),updated_at:past(4)},",
  " {...base,id:'33333333-3333-4333-8333-333333333333',name:'Taylor Sample',business_name:'Pine Ridge Farm',email:null,phone:'5555550144',contact_preference:'phone',primary_need:null,source:'website_checkup',status:'won',utm_source:null,utm_campaign:null,created_at:past(7),updated_at:past(2)}",
  " ];",
  " window.__QA_LEADS=leads;",
  " window.supabase={createClient:()=>({",
  " auth:{getUser:async()=>({data:{user:{id:window.__QA_NOT_OWNER?'other':'qa-owner'}},error:null})},",
  " from:table=>{const q={filter:{},values:null}; const chain={",
  " select(){return chain},eq(k,v){q.filter[k]=v;return chain},order(){return chain},update(data){q.values=data;return chain},",
  " async limit(){return {data:table==='black_stag_leads'?leads.filter(row=>Object.entries(q.filter).every(([k,v])=>row[k]===v)):[]}},",
  " async maybeSingle(){return {data:table==='brands'?{id:brand,owner_id:'qa-owner'}:null,error:null}},",
  " async single(){if(table!=='black_stag_leads')return {data:null,error:{message:'Unexpected table'}};",
  " const row=leads.find(x=>x.id===q.filter.id&&x.brand_id===q.filter.brand_id);if(!row)return {data:null,error:{message:'Missing row'}};",
  " Object.assign(row,q.values);return {data:{id:row.id,status:row.status,updated_at:row.updated_at},error:null};}",
  " };return chain;}",
  " })};",
  "})();"
].join("\n");

const origin=process.env.LEAD_DESK_BASE||"http://127.0.0.1:8765";
mkdirSync("lead-desk-qa",{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
  for(const [label,width,height] of [["desktop",1280,900],["mobile",390,844]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:label==="mobile",hasTouch:label==="mobile",deviceScaleFactor:1});
    await context.route("**/cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:stub}));
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(origin+"/lead-desk.html",{waitUntil:"domcontentloaded",timeout:25000});
    await page.locator("#workspace").waitFor({state:"visible",timeout:8000});
    assert.equal(await page.locator("#statNew").textContent(),"1",label+" new count");
    assert.equal(await page.locator("#statDue").textContent(),"2",label+" follow-up count");
    assert.equal(await page.locator("#statActive").textContent(),"1",label+" in progress");
    assert.equal(await page.locator("#statWon").textContent(),"1",label+" won status");
    assert.equal(await page.locator(".lead-card").count(),2,label+" default queue");
    assert.equal(await page.locator(".lead-card h3").first().textContent(),"Hearth Bakery",label+" priority");
    const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert(widths.scroll<=widths.viewport+6,label+" unexpected horizontal scrolling");
    await page.screenshot({path:"lead-desk-qa/"+label+"-pipeline.png",fullPage:true});
    const card=page.locator(".lead-card").filter({hasText:"Hearth Bakery"});
    await card.locator("select").selectOption("contacted");
    await card.locator("button.save-stage").click();
    await page.waitForFunction(()=>document.getElementById("statNew").textContent==="0");
    assert.equal(await page.locator("#statActive").textContent(),"2",label+" save stage active count");
    assert.equal(await page.locator("#statDue").textContent(),"1",label+" save stage action count");
    await page.locator("#filter").selectOption("all");
    assert.equal(await page.locator(".lead-card").count(),3,label+" full queue count");
    const owned=page.locator(".lead-card").filter({hasText:"Pine Ridge Farm"});
    assert.equal(await owned.locator('a[href^="tel:"]').count(),1,label+" phone preference missing call action");
    assert.equal(await owned.locator('a[href^="sms:"]').count(),0,label+" ignored phone preference");
    const emailOnly=page.locator(".lead-card").filter({hasText:"Hearth Bakery"});
    assert.equal(await emailOnly.locator('a[href^="tel:"]').count(),0,label+" ignored email preference");
    // Privacy: if consent is withdrawn, manual contact buttons vanish on refresh.
    await page.evaluate(() => {
      window.__QA_LEADS.find(x => x.business_name === "North Georgia Trades").consent_to_contact = false;
    });
    await page.locator("#refresh").click();
    const withdrawn=page.locator(".lead-card").filter({hasText:"North Georgia Trades"});
    assert.equal(await withdrawn.locator('a[href^="mailto:"]').count(),0,label+" missing consent exposed email action");
    assert(await withdrawn.getByText(/No contact permission is recorded/).isVisible(),
      label+" missing privacy warning");
    await page.locator("#filter").selectOption("spam");
    assert(await page.locator("#queueEmpty").isVisible(),label+" empty state");
    assert.deepEqual(errors,[],label+" browser errors "+errors.join(", "));
    console.log("PASS "+label+" responsive layout, pipeline metrics, priority, stage saves and filters");
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(()=>{window.__QA_NOT_OWNER=true});
  await context.route("**/cdn.jsdelivr.net/**",route=>route.fulfill({status:200,contentType:"application/javascript",body:stub}));
  const denied=await context.newPage();
  await denied.goto(origin+"/lead-desk.html",{waitUntil:"domcontentloaded"});
  await denied.locator("#gate").getByText(/restricted to the primary/i).waitFor({state:"visible",timeout:8000});
  assert(await denied.locator("#workspace").isHidden(),"Non-owner can see lead queue");
  console.log("PASS unauthorized identity denied");
  await context.close();
} finally {
  await browser.close();
}
