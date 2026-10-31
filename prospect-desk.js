/* Private BSWD Prospect Desk. No outbound messaging. */
"use strict";
(() => {
 const BRAND_ID="d51c76c3-a4a6-4109-99c2-5a4b3cff226b";
 const STAGES=["discovered","researched","qualified","draft_ready","approved","contacted","replied","meeting","quoted","won","lost","do_not_contact"];
 const $=id=>document.getElementById(id);
 let client,ownerId,records=[],outreach=[],events=[],siteChecks=new Map(),scanStarted=false,scanRunning=false;
 function node(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;}
 function lock(text){ownerId=null;records=[];outreach=[];events=[];siteChecks.clear();$("queue").replaceChildren();$("app").hidden=true;notice(text);}
 function notice(text){$("gate").textContent=text;}
 function normalize(value){return String(value||"").normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");}
 function keyFor(name,location){return normalize(name)+"|"+normalize(location);}
 function url(value){try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}}
 function field(label,value){const p=node("p");p.append(node("strong",label+": "),node("span",value||"Not recorded"));return p;}
 const GAPS={no_website:"No dedicated website",social_only:"Social-media only",severely_broken:"Severely broken website"};
 function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||"").trim());}
 function hasEmail(p){return p.contact_channel==="email"&&validEmail(p.contact_value);}
 function targetReady(p){
  const check=siteChecks.get(p.id);
  const recent=check&&Date.now()-Date.parse(check.checked_at)<30*86400000;
  const consistent=check&&(p.opportunity_type==="severely_broken"
    ?["likely_website_found","possible_match"].includes(check.status)
    :check.status==="no_clear_site_found");
  return Boolean(recent&&consistent)&&hasEmail(p)&&Boolean(url(p.email_source_url))&&Object.hasOwn(GAPS,p.opportunity_type)
   &&Boolean(String(p.opportunity_evidence||"").trim())
   &&Boolean(url(p.source_url))&&(!p.website_url||Boolean(url(p.website_url)))
   &&(p.opportunity_type==="severely_broken"?Boolean(url(p.website_url)):!p.website_url);
 }
 function targetPriority(p){return ({no_website:0,social_only:1,severely_broken:2})[p.opportunity_type]??3;}
 function render(){
  const targets=records.filter(targetReady).length;
  const mode=$("targetFilter").value;
  const filtered=records.filter(p=>($("stageFilter").value==="all"||p.stage===$("stageFilter").value)
   &&(!$("emailOnly").checked||hasEmail(p))
   &&(mode==="all"||(mode==="ready"?targetReady(p):!targetReady(p))))
   .sort((a,b)=>targetPriority(a)-targetPriority(b)||String(a.business_name).localeCompare(String(b.business_name)));
  $("count").textContent=filtered.length+" shown · "+targets+" research-ready · "+records.length+" total";
  $("empty").hidden=filtered.length>0;const queue=$("queue");queue.replaceChildren();
  for(const p of filtered){
   const card=node("article");card.className="panel";
   card.append(node("h2",p.business_name),field("Location",p.location),field("Stage",p.stage),
    field("Website gap",GAPS[p.opportunity_type]||"Needs verification"),field("Website",p.website_url||"No verified site recorded"),
    field("Contact method",p.contact_channel),field(hasEmail(p)?"Business email":"Other contact",p.contact_value),
    field("Public email source",p.email_source_url),field("Evidence",p.opportunity_evidence));
   const eligibility=node("p",targetReady(p)?"✓ Research criteria recorded; eligible for owner review.":"Not yet an eligible target. Verify the public email and actual website gap.");
   eligibility.className=targetReady(p)?"muted":"flag";card.append(eligibility,siteCheckView(p));
   const src=url(p.source_url);if(src){const link=node("a","View source");link.href=src;link.target="_blank";link.rel="noopener noreferrer";card.append(link);}
   if(p.suppressed_at||p.stage==="do_not_contact"){const flag=node("p","Contact suppressed. No outreach permitted.");flag.className="flag";card.append(flag);}
   const controls=node("div");controls.className="toolbar";
   const sel=node("select");sel.setAttribute("aria-label","Stage for "+p.business_name);
   for(const s of STAGES){const o=node("option",s.replaceAll("_"," "));o.value=s;o.selected=s===p.stage;sel.append(o);}
   const save=node("button","Save stage");save.type="button";save.disabled=true;
   sel.addEventListener("change",()=>save.disabled=sel.value===p.stage);
   const feedback=node("span");feedback.setAttribute("role","status");
   save.addEventListener("click",async()=>{
    if(p.suppressed_at&&sel.value!=="do_not_contact"){feedback.textContent="Suppressed records cannot be reopened here.";return;}
    if(["approved","contacted","replied","meeting","quoted","won"].includes(sel.value)){feedback.textContent="This desk cannot approve or assert contact or revenue. Use verified sales records.";return;}
    if(["qualified","draft_ready"].includes(sel.value)&&!targetReady(p)){feedback.textContent="Verify the public business email and website gap before qualifying.";return;}
    save.disabled=true;
    const patch={stage:sel.value,updated_at:new Date().toISOString()};
    if(sel.value==="do_not_contact"){patch.suppressed_at=new Date().toISOString();patch.suppression_reason="Owner suppression";}
    const {data:changed,error}=await client.from("bswd_prospects").update(patch).eq("id",p.id).eq("owner_id",ownerId).select("id").maybeSingle();
    if(!error&&!changed){feedback.textContent="Save failed: access changed. Refresh and sign in again.";save.disabled=false;return;}
    feedback.textContent=error?"Save failed: "+error.message:"Saved";await refresh();
   });
   controls.append(sel,save,feedback);card.append(controls);
   const review=node("details");review.append(node("summary","Review email and website gap"));
   review.append(verificationEditor(p));card.append(review);
   const details=node("details");details.append(node("summary","Drafts and outreach history"));
   const drafts=draftEditor(p);details.append(drafts);card.append(details);
   const activity=node("details");activity.append(node("summary","Activity history"));
   for(const event of events.filter(x=>x.prospect_id===p.id)){activity.append(field(new Date(event.created_at).toLocaleString(),event.event_type.replaceAll("_"," ")));}
   if(!events.some(x=>x.prospect_id===p.id))activity.append(node("p","No recorded activity."));
   card.append(activity);
   queue.append(card);
  }
 }
 function siteCheckView(p){
  const box=node("div");box.className="panel";
  const c=siteChecks.get(p.id);
  const statuses={likely_website_found:"Likely existing website",possible_match:"Possible match; verify before outreach",no_clear_site_found:"No clear site found (NOT proof of absence)",search_error:"Search incomplete"};
  box.append(field("Automatic website lookup",c?statuses[c.status]||"Unknown":"Waiting for check"));
  if(c){
   box.append(field("Checked",new Date(c.checked_at).toLocaleString()));
   if(c.match_reason)box.append(node("p",c.match_reason));
   const matches=Array.isArray(c.candidates)?c.candidates.filter(x=>x.kind==="website_candidate").slice(0,3):[];
   for(const m of matches){const site=url(m.url);if(!site)continue;
    const link=node("a",(m.title||m.host||"Candidate site")+" · "+Math.round((m.score||0)*100)+"% signal");
    link.href=site;link.target="_blank";link.rel="noopener noreferrer";
    const line=node("p");line.append(link);box.append(line);
   }
   if(["no_website","social_only"].includes(p.opportunity_type)&&c.status==="likely_website_found"){
    const flag=node("p","Potential conflict: a website was found. Confirm before classifying this business as site-less.");
    flag.className="flag";box.append(flag);
   }
  }
  if(!p.suppressed_at&&p.stage!=="do_not_contact"){
   const button=node("button",c?"Recheck website":"Check website");button.type="button";
   const status=node("span");status.setAttribute("role","status");
   button.addEventListener("click",async()=>{
    button.disabled=true;status.textContent="Searching...";
    const result=await verifySite(p,Boolean(c));
    status.textContent=result.ok?"Recorded.":"Unavailable: "+result.message;
    button.disabled=false;
   });box.append(button,status);
  }
  return box;
 }
 function verificationEditor(p){
  const form=node("form");form.className="panel";
  if(p.suppressed_at||p.stage==="do_not_contact"){form.append(node("p","Suppressed prospect. Research cannot reopen contact."));return form;}
  const input=(labelText,value,type,maxLength)=>{
   const label=node("label",labelText);const el=node("input");el.type=type||"text";el.value=value||"";
   if(maxLength)el.maxLength=maxLength;label.append(el);form.append(label);return el;
  };
  const email=input("Public business email",hasEmail(p)?p.contact_value:"","email",320);
  const emailSource=input("URL showing this business email",p.email_source_url,"url",2000);
  const gapLabel=node("label","Website gap");const gap=node("select");
  const choose=node("option","Select after independent research");choose.value="";gap.append(choose);
  for(const [key,label] of Object.entries(GAPS)){const option=node("option",label);option.value=key;gap.append(option);}
  gap.value=p.opportunity_type||"";gapLabel.append(gap);form.append(gapLabel);
  const website=input("Actual dedicated website URL (required only if severely broken)",p.website_url,"url",2000);
  const evidenceLabel=node("label","Objective website-gap evidence");const evidence=node("textarea",p.opportunity_evidence||"");
  evidence.maxLength=4000;evidenceLabel.append(evidence);form.append(evidenceLabel);
  const save=node("button","Save research verification");save.type="submit";
  const feedback=node("span");feedback.setAttribute("role","status");form.append(save,feedback);
  form.addEventListener("submit",async event=>{
   event.preventDefault();
   const contact=email.value.trim(),link=url(emailSource.value.trim()),site=website.value.trim()?url(website.value.trim()):null;
   if(!validEmail(contact)||!link||!Object.hasOwn(GAPS,gap.value)||!evidence.value.trim()
     ||(website.value.trim()&&!site)||(gap.value==="severely_broken"&&!site)
     ||(gap.value!=="severely_broken"&&website.value.trim())){
    feedback.textContent="A public email, its source URL, a supported website gap, and objective evidence are required. Broken sites need a URL; no-site/social-only leads must leave that field empty.";
    return;
   }
   save.disabled=true;
   const patch={contact_channel:"email",contact_value:contact,email_source_url:link,
    opportunity_type:gap.value,website_url:site,opportunity_evidence:evidence.value.trim(),source_checked_at:new Date().toISOString()};
   const {data:changed,error}=await client.from("bswd_prospects").update(patch).eq("id",p.id).eq("owner_id",ownerId).select("id").maybeSingle();
   feedback.textContent=error?"Verification failed: "+error.message:changed?"Research saved; no outreach sent.":"No matching record; refresh and sign in again.";
   save.disabled=false;if(changed&&!error)await refresh();
  });
  return form;
 }
 function draftEditor(p){
  const wrap=node("div");const history=outreach.filter(x=>x.prospect_id===p.id);
  for(const d of history){
   const section=node("div");section.className="panel";
   section.append(field("Channel",d.channel),field("State",d.state),field("Subject",d.subject));
   const body=node("pre",d.draft_body);body.style.whiteSpace="pre-wrap";body.style.overflowWrap="anywhere";section.append(body);
   if(d.state==="draft"&&targetReady(p)&&!p.suppressed_at&&p.stage!=="do_not_contact"){
    const approve=node("button","Approve draft for manual use");approve.type="button";
    const feedback=node("span");feedback.setAttribute("role","status");
    approve.addEventListener("click",async()=>{
     if(!window.confirm("Approve this draft? Approval does not send anything."))return;
     approve.disabled=true;
     const {data:changed,error}=await client.from("bswd_outreach").update({state:"approved",approved_at:new Date().toISOString()}).eq("id",d.id).eq("owner_id",ownerId).eq("state","draft").select("id").maybeSingle();
     if(!error&&!changed){feedback.textContent="Approval failed: draft or access changed. Refresh before retrying.";approve.disabled=false;return;}
     feedback.textContent=error?"Approval failed: "+error.message:"Approved. Not sent.";approve.disabled=false;if(!error)await refresh();
    });section.append(approve,feedback);
   }
   wrap.append(section);
  }
  if(p.suppressed_at||p.stage==="do_not_contact"){
   wrap.append(node("p","Contact suppressed: new drafts and approval are disabled."));return wrap;
  }
  if(!targetReady(p)){wrap.append(node("p","Verify the public business email, source URL, and material website gap before writing drafts."));return wrap;}
  const form=node("form");form.className="panel";
  const heading=node("h3","Prepare personalized draft");form.append(heading);
  const channelLabel=node("p","Channel: verified public business email");form.append(channelLabel);
  const subjectLabel=node("label","Subject");const subject=node("input");subject.maxLength=180;subjectLabel.append(subject);form.append(subjectLabel);
  const bodyLabel=node("label","Draft body");const body=node("textarea");body.required=true;body.maxLength=12000;bodyLabel.append(body);form.append(bodyLabel);
  const save=node("button","Save draft only");save.type="submit";const feedback=node("span");feedback.setAttribute("role","status");form.append(save,feedback);
  form.addEventListener("submit",async e=>{
   e.preventDefault();
   if(!targetReady(p)||!body.value.trim()||!subject.value.trim()){feedback.textContent="Verified email, subject, and draft body are required.";return;}
   save.disabled=true;
   const {error}=await client.from("bswd_outreach").insert({owner_id:ownerId,prospect_id:p.id,channel:"email",subject:subject.value.trim(),draft_body:body.value.trim(),state:"draft"});
   feedback.textContent=error?"Draft failed: "+error.message:"Draft saved. Nothing sent.";save.disabled=false;if(!error)await refresh();
  });
  wrap.append(form);return wrap;
 }
 async function refresh(){
  if(!ownerId)return;
  $("refresh").disabled=true;
  const {data:identity,error:identityError}=await client.auth.getUser();
  if(identityError||identity?.user?.id!==ownerId){lock("Sign in to Black Stag Marketing Studio first.");return;}
  const {data,error}=await client.from("bswd_prospects").select("id,owner_id,business_name,location,website_url,source_url,opportunity_evidence,contact_channel,contact_value,stage,opportunity_type,email_source_url,suppressed_at,created_at").eq("owner_id",ownerId).order("created_at",{ascending:false}).limit(200);
  $("refresh").disabled=false;
  if(error){notice("Prospect table unavailable. Migration may not be applied: "+error.message);return;}
  const {data:drafts,error:draftError}=await client.from("bswd_outreach").select("id,owner_id,prospect_id,channel,subject,draft_body,state,approved_at,created_at").eq("owner_id",ownerId).order("created_at",{ascending:false}).limit(500);
  if(draftError){notice("Outreach records unavailable: "+draftError.message);return;}
  const {data:activity,error:eventError}=await client.from("bswd_prospect_events").select("id,prospect_id,event_type,created_at").eq("owner_id",ownerId).order("created_at",{ascending:false}).limit(1000);
  if(eventError){notice("Activity history unavailable: "+eventError.message);return;}
  const {data:checks,error:checkError}=await client.from("bswd_site_search_checks")
   .select("prospect_id,status,best_candidate_url,candidates,match_reason,checked_at,query_count,provider").limit(500);
  if(checkError){notice("Website lookup unavailable: "+checkError.message);return;}
  if(!ownerId)return;
  siteChecks=new Map((checks||[]).map(x=>[x.prospect_id,x]));
  outreach=drafts||[];records=data||[];events=activity||[];notice("");render();
  if(!scanStarted){scanStarted=true;void verifyDue(2);}
 }
 async function verifySite(p,force=false){
  if(!ownerId||p.suppressed_at||p.stage==="do_not_contact")return {ok:false,message:"Not available for this prospect"};
  try{
   const {data,error}=await client.functions.invoke("bswd-site-verifier",{body:{prospect_id:p.id,force}});
   if(error)return {ok:false,message:error.message||"Service unavailable"};
   if(!data?.ok||!data?.check)return {ok:false,message:data?.error||"No result returned"};
   siteChecks.set(p.id,data.check);render();return {ok:true};
  }catch(error){return {ok:false,message:error?.message||"Lookup unavailable"};}
 }
 async function verifyDue(limit=2){
  if(!ownerId||scanRunning)return;scanRunning=true;
  $("verifyNext").disabled=true;
  const status=$("verifyStatus");
  try{
   const targets=records.filter(p=>hasEmail(p)&&!p.suppressed_at&&p.stage!=="do_not_contact"
    &&(!siteChecks.has(p.id)||Date.now()-Date.parse(siteChecks.get(p.id).checked_at)>7*86400000))
    .slice(0,Math.min(3,Math.max(1,limit)));
   if(!targets.length){status.textContent="All email contacts recently checked.";return;}
   let completed=0;
   for(const p of targets){
    status.textContent="Checking "+p.business_name+" ("+(completed+1)+"/"+targets.length+")";
    const result=await verifySite(p);
    if(!result.ok){status.textContent="Stopped after "+completed+" check(s): "+result.message;return;}
    completed++;
   }
   status.textContent=completed+" automated checks complete. Review the evidence.";
  }finally{scanRunning=false;$("verifyNext").disabled=false;}
 }
 async function init(){
  const conf=window.BLACK_STAG_CONFIG?.supabase||{};
  if(!window.supabase?.createClient||!conf.url||!conf.publishableKey){notice("Studio configuration unavailable");return;}
  client=window.supabase.createClient(conf.url,conf.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  client.auth.onAuthStateChange((_event,session)=>{if(!session)lock("Sign in to Black Stag Marketing Studio first.");});
  const {data:userData,error:authError}=await client.auth.getUser();
  if(authError||!userData?.user){notice("Sign in to Black Stag Marketing Studio first.");return;}
  const {data:brand,error:brandError}=await client.from("brands").select("id,owner_id").eq("id",BRAND_ID).maybeSingle();
  if(brandError||brand?.owner_id!==userData.user.id){notice("This desk is restricted to the BSWD owner.");return;}
  ownerId=userData.user.id;$("app").hidden=false;
  for(const stage of STAGES){if(!Array.from($("stageFilter").options).some(o=>o.value===stage)){const option=node("option",stage.replaceAll("_"," "));option.value=stage;$("stageFilter").append(option);}}
  $("refresh").addEventListener("click",refresh);$("stageFilter").addEventListener("change",render);$("emailOnly").addEventListener("change",render);$("targetFilter").addEventListener("change",render);$("verifyNext").addEventListener("click",()=>void verifyDue(3));
  $("newProspect").addEventListener("submit",async e=>{
   e.preventDefault();const name=$("business").value.trim(),location=$("location").value.trim(),
    source=url($("source").value),website=$("website").value.trim(),evidence=$("evidence").value.trim(),
    email=$("contactEmail").value.trim(),emailSource=url($("emailSource").value),gap=$("opportunityType").value;
   if(!name||!source||!evidence||!validEmail(email)||!emailSource||!Object.hasOwn(GAPS,gap)
     ||(website&&!url(website))||(gap==="severely_broken"&&!website)
     ||(gap!=="severely_broken"&&website)){
    $("addStatus").textContent="Verify a public business email and its source, choose a website gap, and record evidence. Broken sites require a URL; no-site/social-only targets must leave it empty.";return;
   }
   $("add").disabled=true;
   const {data:created,error}=await client.from("bswd_prospects").insert({owner_id:ownerId,business_name:name,location,source_url:source,website_url:website?url(website):null,opportunity_evidence:evidence,contact_channel:"email",contact_value:email,email_source_url:emailSource,opportunity_type:gap,prospect_key:keyFor(name,location),stage:"researched"}).select("id").single();
   $("add").disabled=false;
   $("addStatus").textContent=error?(error.code==="23505"?"Duplicate business and location.":error.message):"Saved research candidate.";
   if(!error){$("newProspect").reset();await refresh();
    const createdProspect=records.find(p=>p.id===created?.id);
    if(createdProspect){$("addStatus").textContent="Saved. Automatically checking its website...";
     const checked=await verifySite(createdProspect);
     $("addStatus").textContent=checked.ok?"Saved with website lookup results.":"Saved; website lookup pending: "+checked.message;
    }
   }
  });
  await refresh();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();