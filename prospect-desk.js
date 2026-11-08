/* Private BSWD Prospect Desk. No outbound messaging. */
"use strict";
(() => {
 const BRAND_ID="d51c76c3-a4a6-4109-99c2-5a4b3cff226b";
 const STAGES=["discovered","researched","qualified","draft_ready","approved","contacted","replied","meeting","quoted","won","lost","do_not_contact"];
 const $=id=>document.getElementById(id);
 let client,ownerId,records=[],outreach=[],events=[],siteChecks=new Map(),scanStarted=false,scanRunning=false,importRunning=false,importLastRun=0;
 function node(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;}
 function lock(text){ownerId=null;records=[];outreach=[];events=[];siteChecks.clear();$("queue").replaceChildren();$("app").hidden=true;notice(text);}
 function notice(text){$("gate").textContent=text;}
 function normalize(value){return String(value||"").normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");}
 function keyFor(name,location){return normalize(name)+"|"+normalize(location);}
 function url(value){try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}}
 function field(label,value){const p=node("p");p.append(node("strong",label+": "),node("span",value||"Not recorded"));return p;}
 const GAPS={no_website:"No dedicated website",social_only:"Social-media only",severely_broken:"Verified broken website",outdated_site:"Completely outdated website"};
 function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||"").trim());}
 function hasEmail(p){return p.contact_channel==="email"&&validEmail(p.contact_value);}
 // An existing website is eligible only after documented first-hand audit evidence.
 // The site's official domain must match at least one audited page; healthy and inconclusive sites fail closed.
 function verifiedSiteAudit(a,site,kind){
  if(!site||!["severely_broken","outdated_site"].includes(kind)||!a||typeof a!=="object"||Array.isArray(a))return null;
  const result=kind==="severely_broken"?"material_defect":"completely_outdated";
  if(a.result!==result)return null;
  const date=Date.parse(a.checked_at);
  if(!Number.isFinite(date)||date>Date.now()+3600000||Date.now()-date>30*86400000)return null;
  if(!Array.isArray(a.evidence)||a.evidence.length<(kind==="outdated_site"?2:1)||a.evidence.length>8)return null;
  if(a.evidence.some(x=>typeof x!=="string"||x.trim().length<24||x.length>360))return null;
  if(!Array.isArray(a.urls_checked)||a.urls_checked.length<1||a.urls_checked.length>8)return null;
  const auditedUrls=a.urls_checked.map(x=>typeof x==="string"?url(x):null);
  if(auditedUrls.some(x=>!x))return null;
  const hostname=u=>new URL(u).hostname.toLowerCase().replace(/^www\./,"");
  if(!auditedUrls.some(x=>hostname(x)===hostname(site)))return null;
  return {result,checked_at:new Date(date).toISOString(),evidence:a.evidence.map(x=>x.trim()),urls_checked:auditedUrls};
 }
 function siteAuditFromEvidence(text){
  const line=String(text||"").split(/\r?\n/).find(x=>x.startsWith("SITE_AUDIT_V1="));
  if(!line||line.length>3500)return null;
  try{return JSON.parse(line.slice("SITE_AUDIT_V1=".length));}catch{return null;}
 }
 function hasVerifiedSiteAudit(p){
  const site=url(p.website_url);
  return Boolean(site&&verifiedSiteAudit(siteAuditFromEvidence(p.opportunity_evidence),site,p.opportunity_type));
 }

 // Transfer machine-readable BSMS research notes through the signed-in owner's RLS session.
 // The background agent never impersonates the owner or writes protected tables directly.
 // This is a research-only import: no approval, sent status, or outbound message.
 function stagedCandidate(work){
  if(!/^Research candidate:\s+/i.test(String(work.title||"")))return null;
  const line=String(work.notes||"").split(/\r?\n/).find(x=>x.startsWith("BSWD_CANDIDATE_V1="));
  if(!line||line.length>10000)return null;
  let c;
  try{c=JSON.parse(line.slice("BSWD_CANDIDATE_V1=".length));}catch{return null;}
  if(!c||typeof c!=="object"||Array.isArray(c))return null;
  const name=String(c.business_name||"").trim(),location=String(c.location||"").trim();
  const email=String(c.contact_email||"").trim();
  const source=url(c.source_url),emailSource=url(c.email_source_url);
  const evidence=String(c.opportunity_evidence||"").trim();
  const checked=Date.parse(c.checked_at);
  if(name.length<2||name.length>200||location.length>160||!validEmail(email)||email.length>320
    ||!source||!emailSource||!evidence||evidence.length>4000||!Number.isFinite(checked)
    ||checked>Date.now()+3600000||Date.now()-checked>90*86400000
    ||normalize(String(work.title).replace(/^Research candidate:\s+/i,""))!==normalize(name))return null;
  const site=c.website_url?url(c.website_url):null;
  if(c.website_url&&!site)return null;
  let audited=null,kind=null,fullEvidence=evidence;
  if(site){
   kind=c.opportunity_type;
   audited=verifiedSiteAudit(c.site_audit,site,kind);
   if(!audited)return null; // Functional, unaudited, or ambiguously outdated websites NEVER reach the desk.
   fullEvidence+="\n\nExisting site audited "+audited.checked_at.slice(0,10)+":\n"
    +audited.evidence.map(x=>"- "+x).join("\n")
    +"\nPages checked: "+audited.urls_checked.join(", ")
    +"\nSITE_AUDIT_V1="+JSON.stringify(audited);
   if(fullEvidence.length>4000)return null;
  }else if(c.site_audit||["outdated_site","severely_broken"].includes(c.opportunity_type))return null;
  return {owner_id:ownerId,business_name:name,location,source_url:source,
   opportunity_evidence:fullEvidence,contact_channel:"email",contact_value:email,
   email_source_url:emailSource,website_url:site,opportunity_type:kind,
   prospect_key:keyFor(name,location),stage:"researched"};
 }
 async function importStagedCandidates(){
  if(!ownerId||importRunning||Date.now()-importLastRun<45000)return;
  importRunning=true;importLastRun=Date.now();
  const status=$("importStatus");
  try{
   const {data:work,error:readError}=await client.from("work_items")
    .select("id,title,notes,status").eq("brand_id",BRAND_ID).eq("work_type","research")
    .in("status",["open","in_progress","waiting"])
    .order("created_at",{ascending:false}).limit(200);
   if(readError){status.textContent="Research sync unavailable: "+readError.message;return;}
   let imported=0,failed=0;
   for(const item of work||[]){
    if(imported>=10)break;
    const candidate=stagedCandidate(item);
    if(!candidate)continue;
    if(records.some(p=>keyFor(p.business_name,p.location)===candidate.prospect_key
      ||(p.contact_channel==="email"&&normalize(p.contact_value)===normalize(candidate.contact_value))))continue;
    const {data:created,error}=await client.from("bswd_prospects")
      .insert(candidate).select("id,business_name,location,contact_value,contact_channel,stage").single();
    if(error){if(error.code!=="23505")failed++;continue;} // DB guard handles concurrent duplicates.
    if(created){records.push(created);imported++;}
   }
   if(imported){
    status.textContent=imported+" researched candidate(s) imported from Studio. Nothing sent.";
    await refresh();
    // The owner-only verifier rechecks website claims; an email draft remains unsent.
    if(!scanRunning)void verifyDue(2);
   }else if(failed)status.textContent="Some research could not be imported; existing records are unchanged.";
  }catch(error){
   status.textContent="Research sync unavailable. Refresh after signing in again.";
   console.warn("BSWD research import error",error?.name||"unknown");
  }finally{importRunning=false;}
 }

 function targetReady(p){
  const check=siteChecks.get(p.id);
  const recent=check&&Date.now()-Date.parse(check.checked_at)<30*86400000;
  const hasSite=Boolean(p.website_url);
  const eligible=hasSite?hasVerifiedSiteAudit(p)
    :Boolean(recent&&check.status==="no_clear_site_found"&&["no_website","social_only"].includes(p.opportunity_type));
  return eligible&&hasEmail(p)&&Boolean(url(p.email_source_url))&&Object.hasOwn(GAPS,p.opportunity_type)
   &&Boolean(String(p.opportunity_evidence||"").trim())&&Boolean(url(p.source_url));
 }
 function targetPriority(p){return ({no_website:0,social_only:1,severely_broken:2,outdated_site:3})[p.opportunity_type]??4;}
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
   const card=node("article");card.className="panel";card.dataset.prospectId=p.id;
   card.append(node("h2",p.business_name),field("Location",p.location),field("Stage",p.stage),
    field("Website opportunity",GAPS[p.opportunity_type]||"Needs verification"),field("Website",p.website_url||"No verified site recorded"),
    field("Contact method",p.contact_channel),field(hasEmail(p)?"Business email":"Other contact",p.contact_value),
    field("Public email source",p.email_source_url),field("Evidence",p.opportunity_evidence));
   const eligibility=node("p",targetReady(p)?"✓ Research criteria recorded; eligible for owner review.":"Not yet an eligible target. Verify the public email and actual website gap.");
   eligibility.className=(targetReady(p)?"muted":"flag")+" target-eligibility";card.append(eligibility,siteCheckView(p));
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
  const box=node("div");box.className="panel site-check-panel";
  const c=siteChecks.get(p.id);
  const statuses={likely_website_found:"Likely existing website",possible_match:"Possible match; verify before outreach",no_clear_site_found:"No clear site found (NOT proof of absence)",search_error:"Search incomplete"};
  box.append(field("Automatic website lookup",c?statuses[c.status]||"Unknown":hasVerifiedSiteAudit(p)?"Existing site audited before import":"Waiting for check"));
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
  const website=input("Dedicated website URL (required for broken or outdated sites)",p.website_url,"url",2000);
  const evidenceLabel=node("label","Objective website-gap evidence");const evidence=node("textarea",p.opportunity_evidence||"");
  evidence.maxLength=4000;evidenceLabel.append(evidence);form.append(evidenceLabel);
  const save=node("button","Save research verification");save.type="submit";
  const feedback=node("span");feedback.setAttribute("role","status");form.append(save,feedback);
  form.addEventListener("submit",async event=>{
   event.preventDefault();
   const contact=email.value.trim(),link=url(emailSource.value.trim()),site=website.value.trim()?url(website.value.trim()):null;
   const siteType=["severely_broken","outdated_site"].includes(gap.value);
   if(!validEmail(contact)||!link||!Object.hasOwn(GAPS,gap.value)||!evidence.value.trim()
     ||(website.value.trim()&&!site)||(siteType&&!site)
     ||(!siteType&&website.value.trim())
     ||(siteType&&!hasVerifiedSiteAudit({website_url:site,opportunity_type:gap.value,opportunity_evidence:evidence.value}))){
    feedback.textContent="A public business email and research evidence are required. Existing-site prospects require a recent, documented SITE_AUDIT_V1 record proving a real defect or completely outdated website. Healthy and unaudited websites are disqualified.";
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
  if(!importRunning)void importStagedCandidates();
 }
 async function verifySite(p,force=false){
  if(!ownerId||p.suppressed_at||p.stage==="do_not_contact")return {ok:false,message:"Not available for this prospect"};
  try{
   const {data,error}=await client.functions.invoke("bswd-site-verifier",{body:{prospect_id:p.id,force}});
   if(error){
    // Only display the verifier's short machine-readable error code, never arbitrary server text.
    let code="";
    try{
     if(typeof error.context?.json==="function"){
      const detail=await error.context.json();
      if(typeof detail?.error==="string"&&/^[a-z][a-z0-9_]{0,79}$/.test(detail.error))code=detail.error;
     }
    }catch{/* Transport or non-JSON errors retain their generic message. */}
    const status=Number(error.context?.status);
    return {ok:false,message:code?("Website lookup HTTP "+(status||"error")+": "+code):(error.message||"Service unavailable")};
   }
   if(!data?.ok||!data?.check)return {ok:false,message:data?.error||"No result returned"};
   siteChecks.set(p.id,data.check);
   // Background results must not reset unsaved selections or draft text.
   if($("targetFilter").value==="all"){
    const card=Array.from($("queue").children).find(x=>x.dataset.prospectId===p.id);
    if(card){
     const panel=card.querySelector(".site-check-panel");
     if(panel)panel.replaceWith(siteCheckView(p));
     const eligibility=card.querySelector(".target-eligibility");
     if(eligibility){
      const ready=targetReady(p);
      eligibility.textContent=ready?"✓ Research criteria recorded; eligible for owner review.":"Not yet an eligible target. Verify the public email and actual website gap.";
      eligibility.className=(ready?"muted":"flag")+" target-eligibility";
     }
    }
    $("count").textContent=$("queue").children.length+" shown · "+records.filter(targetReady).length+" research-ready · "+records.length+" total";
   }else render();
   return {ok:true};
  }catch(error){return {ok:false,message:error?.message||"Lookup unavailable"};}
 }
 async function verifyDue(limit=2){
  if(!ownerId||scanRunning)return;scanRunning=true;
  $("verifyNext").disabled=true;
  const status=$("verifyStatus");
  try{
   // Auto-check missing-site prospects first. Known-site records remain manually checkable.
   const targets=records.filter(p=>hasEmail(p)&&!p.suppressed_at&&p.stage!=="do_not_contact"
    &&!p.website_url
    &&(!siteChecks.has(p.id)||Date.now()-Date.parse(siteChecks.get(p.id).checked_at)>7*86400000))
    .slice(0,Math.min(3,Math.max(1,limit)));
   if(!targets.length){status.textContent="No eligible email leads need website checks; existing-site records are skipped.";return;}
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
   if(!name||!source||!validEmail(email)||!emailSource||(gap&&!Object.hasOwn(GAPS,gap))
     ||(website&&!url(website))||(["severely_broken","outdated_site"].includes(gap)&&!website)
     ||(!["severely_broken","outdated_site"].includes(gap)&&website)
     ||(website&&!hasVerifiedSiteAudit({website_url:website,opportunity_type:gap,opportunity_evidence:evidence}))){
    $("addStatus").textContent="Use a public business email, its source URL, and research evidence. An existing website must have a verified audit record first. Healthy websites are disqualified.";return;
   }
   $("add").disabled=true;
   const {data:created,error}=await client.from("bswd_prospects").insert({owner_id:ownerId,business_name:name,location,source_url:source,website_url:website?url(website):null,opportunity_evidence:evidence||null,contact_channel:"email",contact_value:email,email_source_url:emailSource,opportunity_type:gap||null,prospect_key:keyFor(name,location),stage:"researched"}).select("id").single();
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