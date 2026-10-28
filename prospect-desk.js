/* Private BSWD Prospect Desk. No outbound messaging. */
"use strict";
(() => {
 const BRAND_ID="d51c76c3-a4a6-4109-99c2-5a4b3cff226b";
 const STAGES=["discovered","researched","qualified","draft_ready","approved","contacted","replied","meeting","quoted","won","lost","do_not_contact"];
 const $=id=>document.getElementById(id);
 let client,ownerId,records=[],outreach=[],events=[];
 function node(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;}
 function lock(text){ownerId=null;records=[];outreach=[];events=[];$("queue").replaceChildren();$("app").hidden=true;notice(text);}
 function notice(text){$("gate").textContent=text;}
 function normalize(value){return String(value||"").normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");}
 function keyFor(name,location){return normalize(name)+"|"+normalize(location);}
 function url(value){try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}}
 function field(label,value){const p=node("p");p.append(node("strong",label+": "),node("span",value||"Not recorded"));return p;}
 function hasEmail(p){return p.contact_channel==="email"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contact_value||"");}
 function render(){
  const filtered=records.filter(p=>($("stageFilter").value==="all"||p.stage===$("stageFilter").value)&&(!$("emailOnly").checked||hasEmail(p)));
  $("count").textContent=filtered.length+" / "+records.length+" records";
  $("empty").hidden=filtered.length>0;const queue=$("queue");queue.replaceChildren();
  for(const p of filtered){
   const card=node("article");card.className="panel";
   card.append(node("h2",p.business_name),field("Location",p.location),field("Stage",p.stage),field("Contact method",p.contact_channel),field(hasEmail(p)?"Business email":"Other contact",p.contact_value),field("Evidence",p.opportunity_evidence));
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
    save.disabled=true;
    const patch={stage:sel.value,updated_at:new Date().toISOString()};
    if(sel.value==="do_not_contact"){patch.suppressed_at=new Date().toISOString();patch.suppression_reason="Owner suppression";}
    const {data:changed,error}=await client.from("bswd_prospects").update(patch).eq("id",p.id).eq("owner_id",ownerId).select("id").maybeSingle();
    if(!error&&!changed){feedback.textContent="Save failed: access changed. Refresh and sign in again.";save.disabled=false;return;}
    feedback.textContent=error?"Save failed: "+error.message:"Saved";await refresh();
   });
   controls.append(sel,save,feedback);card.append(controls);
   const details=node("details");details.append(node("summary","Drafts and outreach history"));
   const drafts=draftEditor(p);details.append(drafts);card.append(details);
   const activity=node("details");activity.append(node("summary","Activity history"));
   for(const event of events.filter(x=>x.prospect_id===p.id)){activity.append(field(new Date(event.created_at).toLocaleString(),event.event_type.replaceAll("_"," ")));}
   if(!events.some(x=>x.prospect_id===p.id))activity.append(node("p","No recorded activity."));
   card.append(activity);
   queue.append(card);
  }
 }
 function draftEditor(p){
  const wrap=node("div");const history=outreach.filter(x=>x.prospect_id===p.id);
  for(const d of history){
   const section=node("div");section.className="panel";
   section.append(field("Channel",d.channel),field("State",d.state),field("Subject",d.subject));
   const body=node("pre",d.draft_body);body.style.whiteSpace="pre-wrap";body.style.overflowWrap="anywhere";section.append(body);
   if(d.state==="draft"&&!p.suppressed_at&&p.stage!=="do_not_contact"){
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
  const form=node("form");form.className="panel";
  const heading=node("h3","Prepare personalized draft");form.append(heading);
  const channelLabel=node("label","Channel");const channel=node("select");
  for(const value of ["email","contact_form","referral"]){const option=node("option",value.replace("_"," "));option.value=value;channel.append(option);}
  channelLabel.append(channel);form.append(channelLabel);
  const subjectLabel=node("label","Subject");const subject=node("input");subject.maxLength=180;subjectLabel.append(subject);form.append(subjectLabel);
  const bodyLabel=node("label","Draft body");const body=node("textarea");body.required=true;body.maxLength=12000;bodyLabel.append(body);form.append(bodyLabel);
  const save=node("button","Save draft only");save.type="submit";const feedback=node("span");feedback.setAttribute("role","status");form.append(save,feedback);
  form.addEventListener("submit",async e=>{
   e.preventDefault();
   if(!body.value.trim()||(channel.value==="email"&&!subject.value.trim())){feedback.textContent="Body and email subject required.";return;}
   save.disabled=true;
   const {error}=await client.from("bswd_outreach").insert({owner_id:ownerId,prospect_id:p.id,channel:channel.value,subject:subject.value.trim()||null,draft_body:body.value.trim(),state:"draft"});
   feedback.textContent=error?"Draft failed: "+error.message:"Draft saved. Nothing sent.";save.disabled=false;if(!error)await refresh();
  });
  wrap.append(form);return wrap;
 }
 async function refresh(){
  if(!ownerId)return;
  $("refresh").disabled=true;
  const {data:identity,error:identityError}=await client.auth.getUser();
  if(identityError||identity?.user?.id!==ownerId){lock("Sign in to Black Stag Marketing Studio first.");return;}
  const {data,error}=await client.from("bswd_prospects").select("id,owner_id,business_name,location,website_url,source_url,opportunity_evidence,contact_channel,contact_value,stage,suppressed_at,created_at").eq("owner_id",ownerId).order("created_at",{ascending:false}).limit(200);
  $("refresh").disabled=false;
  if(error){notice("Prospect table unavailable. Migration may not be applied: "+error.message);return;}
  const {data:drafts,error:draftError}=await client.from("bswd_outreach").select("id,owner_id,prospect_id,channel,subject,draft_body,state,approved_at,created_at").eq("owner_id",ownerId).order("created_at",{ascending:false}).limit(500);
  if(draftError){notice("Outreach records unavailable: "+draftError.message);return;}
  const {data:activity,error:eventError}=await client.from("bswd_prospect_events").select("id,prospect_id,event_type,created_at").eq("owner_id",ownerId).order("created_at",{ascending:false}).limit(1000);
  if(eventError){notice("Activity history unavailable: "+eventError.message);return;}
  if(!ownerId)return;
  outreach=drafts||[];records=data||[];events=activity||[];notice("");render();
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
  $("refresh").addEventListener("click",refresh);$("stageFilter").addEventListener("change",render);$("emailOnly").addEventListener("change",render);
  $("newProspect").addEventListener("submit",async e=>{
   e.preventDefault();const name=$("business").value.trim(),location=$("location").value.trim(),source=url($("source").value),website=$("website").value.trim(),evidence=$("evidence").value.trim(),email=$("contactEmail").value.trim();
   if(!name||!source||!evidence||(website&&!url(website))||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))){$("addStatus").textContent="Enter a valid source, evidence, and optional website or email address.";return;}
   $("add").disabled=true;
   const {error}=await client.from("bswd_prospects").insert({owner_id:ownerId,business_name:name,location,source_url:source,website_url:website?url(website):null,opportunity_evidence:evidence,contact_channel:email?"email":$("channel").value.trim(),contact_value:email||null,prospect_key:keyFor(name,location),stage:"researched"});
   $("add").disabled=false;
   $("addStatus").textContent=error?(error.code==="23505"?"Duplicate business and location.":error.message):"Saved research candidate.";
   if(!error){$("newProspect").reset();await refresh();}
  });
  await refresh();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();