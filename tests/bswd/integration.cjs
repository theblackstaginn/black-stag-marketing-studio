/* LOCAL Supabase integration. Synthetic fixtures only; no external communication. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const {createClient}=require('@supabase/supabase-js');
const {chromium}=require('playwright');
const BRAND='d51c76c3-a4a6-4109-99c2-5a4b3cff226b';
const status=JSON.parse(fs.readFileSync(process.env.BSWD_LOCAL_STATUS,'utf8'));
const api=status.API_URL, db=status.DB_URL;
for(const value of [api,db])assert(['127.0.0.1','localhost'].includes(new URL(value).hostname),'Only loopback test services are allowed');
const anon=status.ANON_KEY, secret=status.SERVICE_ROLE_KEY;
assert(api&&db&&anon&&secret,'Local status is missing required connection details');
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(api,secret,opts);
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
function sql(text){return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
function file(p){return sql(fs.readFileSync(p,'utf8'));}
const must=(r,label)=>{assert.equal(r.error,null,label+': '+r.error?.message);return r.data;};
async function rejected(p,label){const r=await p;assert(r.error,label+' was allowed');console.log('PASS API: '+label);}
fs.mkdirSync('bswd-test-evidence',{recursive:true});
let browser,server;
(async()=>{
 // Real repository core schema plus actual co-owner visibility policies.
 file('supabase/schema.sql');
 file('supabase/migrations/20260929235934_add_brand_co_owners.sql');
 const migrations=fs.readdirSync('supabase/migrations').filter(x=>/bswd/.test(x)).sort();
 assert.equal(migrations.length,2);
 assert(migrations[0].endsWith('_bswd_prospect_pipeline.sql'),'Schema must sort before guards');
 assert.notEqual(migrations[0].split('_')[0],migrations[1].split('_')[0],'Migration versions must be distinct');
 for(const m of migrations)file('supabase/migrations/'+m);
 const users={};
 const password='Synthetic-local-QA-only-2026!';
 for(const name of ['owner','outsider','coowner']){
  const email='bswd-'+name+'@example.test';
  const data=must(await admin.auth.admin.createUser({email,password,email_confirm:true}), 'Create local fixture user');
  users[name]={id:data.user.id,email};
 }
 sql(`insert into public.brands(id,owner_id,slug,official_name) values(${quote(BRAND)},${quote(users.owner.id)},'bswd-isolated-qa','Synthetic BSWD QA');
 insert into public.brand_memberships(brand_id,user_id) values(${quote(BRAND)},${quote(users.coowner.id)});`);
 // Report only test assertions, never JWTs/keys/status output.
 const counts=()=>sql('select (select count(*) from public.bswd_prospects),(select count(*) from public.bswd_outreach),(select count(*) from public.bswd_prospect_events);');
 const before=counts();
 const smoke=file('tests/bswd_pipeline_smoke.sql');
 assert.equal(counts(),before,'Rollback must restore all prospect, outreach and audit row counts');
 console.log('PASS SQL: smoke executed successfully; all fixture mutations rolled back');
 fs.writeFileSync('bswd-test-evidence/sql-result.txt',smoke+'\nRollback row counts unchanged: '+before+'\n');
 async function login(name){const c=createClient(api,anon,opts);must(await c.auth.signInWithPassword({email:users[name].email,password}),'Sign in '+name);return c;}
 const owner=await login('owner'), outsider=await login('outsider'), coowner=await login('coowner');
 const payload={owner_id:users.owner.id,business_name:'Synthetic API QA',location:'Test City',source_url:'https://example.test/research',opportunity_evidence:'Synthetic evidence. Never contact.',prospect_key:'untrusted-client-key',stage:'researched'};
 const prospect=must(await owner.from('bswd_prospects').insert(payload).select().single(),'Owner creates prospect');
 for(const [name,c] of [['outsider',outsider],['coowner',coowner],['anon',createClient(api,anon,opts)]]){
  for(const table of ['bswd_prospects','bswd_outreach','bswd_prospect_events']){
   const r=await c.from(table).select('*');
   if(name==='anon')assert(r.error,'Anon must lack table permissions');else {must(r,name+' read');assert.deepEqual(r.data,[],name+' leaks '+table);}
  }
  if(name!=='anon'){
   const r=await c.from('bswd_prospects').update({stage:'lost'}).eq('id',prospect.id).select();
   must(r,name+' update');assert.deepEqual(r.data,[]);
   await rejected(c.from('bswd_prospects').insert({...payload,owner_id:users[name].id,business_name:'Forbidden '+name}),name+' cannot create own BSWD prospect');
   await rejected(c.from('bswd_outreach').insert({owner_id:users[name].id,prospect_id:prospect.id,channel:'email',draft_body:'forbidden'}),name+' cannot reference owner prospect');
  }
  console.log('PASS Auth/RLS: '+name+' read/write isolation');
 }
 await rejected(owner.from('bswd_prospects').insert({...payload,business_name:' SYNTHETIC  API QA ',prospect_key:'different-key'}),'normalized duplicate');
 const draft=must(await owner.from('bswd_outreach').insert({owner_id:users.owner.id,prospect_id:prospect.id,channel:'email',subject:'Synthetic only',draft_body:'Never send.'}).select().single(),'Draft creation');
 must(await owner.from('bswd_outreach').update({state:'approved',approved_at:new Date().toISOString()}).eq('id',draft.id),'Approve draft');
 await rejected(owner.from('bswd_outreach').update({state:'sent',sent_at:new Date().toISOString()}).eq('id',draft.id),'fabricated sent message');
 await rejected(owner.from('bswd_prospects').update({stage:'won'}).eq('id',prospect.id),'fabricated sale');
 must(await owner.from('bswd_prospects').update({stage:'do_not_contact'}).eq('id',prospect.id),'Suppress prospect');
 await rejected(owner.from('bswd_outreach').insert({owner_id:users.owner.id,prospect_id:prospect.id,channel:'email',draft_body:'forbidden'}),'suppressed draft');
 await rejected(owner.from('bswd_prospects').delete().eq('id',prospect.id),'cascade deletion of history');
 await rejected(owner.from('bswd_prospect_events').insert({owner_id:users.owner.id,prospect_id:prospect.id,event_type:'fake_sent'}),'audit forgery');
 const events=must(await owner.from('bswd_prospect_events').select('event_type').eq('prospect_id',prospect.id),'Read real audit events');
 assert.deepEqual(events.map(x=>x.event_type).sort(),['draft_approved','draft_created','prospect_created','prospect_suppressed'].sort());
 console.log('PASS Auth/RLS: owner lifecycle and protected audit events through Data API');
 // Serve exact branch HTML/JS/CSS, replacing only local configuration and CDN SDK path.
 const sdk=fs.readFileSync(path.join(__dirname,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'));
 const config='window.BLACK_STAG_CONFIG='+JSON.stringify({supabase:{url:api,publishableKey:anon}})+';';
 server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1);
  if(name==='config.js'){res.setHeader('Content-Type','application/javascript');return res.end(config);}
  if(name==='supabase.js'){res.setHeader('Content-Type','application/javascript');return res.end(sdk);}
  if(!['prospect-desk.html','prospect-desk.js','lead-desk.css'].includes(name)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript');
  let body=fs.readFileSync(name,'utf8');
  if(name.endsWith('.html'))body=body.replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','/supabase.js');
  res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 async function contextFor(name,viewport){
  const context=await browser.newContext({viewport});
  await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  if(name){const c=await login(name);const session=must(await c.auth.getSession(),'Get test session').session;
   const key='sb-'+new URL(api).hostname.split('.')[0]+'-auth-token';
   await context.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session});
  }
  return context;
 }
 for(const name of [null,'outsider','coowner']){
  const context=await contextFor(name,{width:390,height:844});const page=await context.newPage();
  await page.goto(base+'/prospect-desk.html');
  await page.waitForFunction(()=>!/Verifying/.test(document.getElementById('gate').textContent));
  assert(await page.locator('#app').isHidden(),String(name)+' UI gate');
  await context.close();console.log('PASS browser gate: '+(name||'signed out'));
 }
 for(const [label,width,height] of [['desktop',1280,900],['mobile',390,844],['small-mobile',320,740]]){
  const context=await contextFor('owner',{width,height});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/prospect-desk.html');await page.locator('#app').waitFor({state:'visible'});await page.getByText('Synthetic API QA',{exact:true}).waitFor();
  await page.getByText('Add researched prospect',{exact:true}).click();
  const name='Synthetic Browser QA '+label;
  async function fill(){await page.locator('#business').fill(name);await page.locator('#location').fill('Test City');await page.locator('#source').fill('https://example.test/qa');await page.locator('#evidence').fill('Synthetic verified evidence; never contact.');}
  await fill();await page.locator('#add').click();await page.getByRole('heading',{name,exact:true}).waitFor();
  await fill();await page.locator('#add').click();await page.getByText('Duplicate business and location.',{exact:true}).waitFor();
  let card=page.locator('#queue > article').filter({has:page.getByRole('heading',{name,exact:true})});
  await card.locator('.toolbar select').selectOption('qualified');await card.getByRole('button',{name:'Save stage',exact:true}).click();
  await card.getByText('qualified',{exact:true}).waitFor();
  await page.locator('#stageFilter').selectOption('qualified');await card.getByText('Drafts and outreach history',{exact:true}).click();
  await card.getByLabel('Subject',{exact:true}).fill('Synthetic subject');await card.getByLabel('Draft body',{exact:true}).fill('Synthetic draft. '+('longunbrokencontent'.repeat(30)));
  await card.getByRole('button',{name:'Save draft only'}).click();
  await card.getByRole('button',{name:'Approve draft for manual use'}).waitFor({state:'attached'});
  // Refresh rebuilds collapsed details; expand the newly rendered history.
  await page.waitForFunction(()=>!document.getElementById('refresh').disabled);
  card=page.locator('#queue > article').filter({has:page.getByRole('heading',{name,exact:true})});
  if(!await card.getByRole('button',{name:'Approve draft for manual use'}).isVisible())await card.getByText('Drafts and outreach history',{exact:true}).click();
  page.once('dialog',d=>d.accept());await card.getByRole('button',{name:'Approve draft for manual use'}).click();
  await card.getByText('draft approved',{exact:true}).waitFor({state:'attached'});
  await card.getByText('Activity history',{exact:true}).click();await card.getByText('draft approved',{exact:true}).waitFor();
  if(!await card.getByText('Synthetic subject',{exact:true}).isVisible())await card.getByText('Drafts and outreach history',{exact:true}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' horizontal overflow');
  await page.screenshot({path:'bswd-test-evidence/'+label+'.png',fullPage:true});
  await card.locator('.toolbar select').selectOption('do_not_contact');await card.getByRole('button',{name:'Save stage',exact:true}).click();
  await page.locator('#stageFilter').selectOption('do_not_contact');
  await card.getByText('Contact suppressed. No outreach permitted.',{exact:true}).waitFor();
  await card.getByText('Drafts and outreach history',{exact:true}).click();
  assert.equal(await card.getByRole('button',{name:'Save draft only'}).count(),0);
  assert.equal(await card.getByRole('button',{name:'Approve draft for manual use'}).count(),0);
  await page.evaluate(async()=>{const c=window.supabase.createClient(window.BLACK_STAG_CONFIG.supabase.url,window.BLACK_STAG_CONFIG.supabase.publishableKey);await c.auth.signOut();});
  await page.locator('#app').waitFor({state:'hidden'});assert.equal(await page.locator('#queue').textContent(),'');
  assert.deepEqual(errors,[]);
  await context.close();console.log('PASS browser: '+label+' create, duplicate, filter, draft, approve, audit, suppression, sign-out');
 }
 console.log('PASS: isolated SQL + real Auth/Data API/RLS + browser integration');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();if(server)server.close();
 // This database is disposable. Remove only synthetic users created by this run.
 // The shell trap destroys the entire unlinked stack even after any test failure.
});
