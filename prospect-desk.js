/* Private BSWD Prospect Desk. No outbound messaging. */
"use strict";
(() => {
 const BRAND_ID="d51c76c3-a4a6-4109-99c2-5a4b3cff226b";
 const STAGES=["discovered","researched","qualified","draft_ready","approved","contacted","replied","meeting","quoted","won","lost","do_not_contact"];
 const $=id=>document.getElementById(id);
 let client,ownerId,records=[];
 function node(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;}
 function notice(text){$("gate").textContent=text;}
 function normalize(value){return String(value||"").normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");}
 function keyFor(name,location){return normalize(name)+"|"+normalize(location);}
 function url(value){try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:null;}catch{return null;}}
 function field(label,value){const p=node("p");p.append(node("strong",label+": "),node("span",value||"Not recorded"));return p;}
 function render(){
  const filtered=records.filter(p=>$("stageFilter").value==="all"||p.stage===$("stageFilter").value);
  $("count").textContent=filtered.length+" / "+records.length+" records";
  $("empty").hidden=filtered.length>0;const queue=$("queue");queue.replaceChildren();
  for(const p of filtered){
   const card=node("article");card.className="panel";
   card.append(node("h2",p.business_name),field("Location",p.location),field("Stage",p.stage),field("Evidence",p.opportunity_evidence));
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
    const {error}=await client.from("bswd_prospects").update(patch).eq("id",p.id).eq("owner_id",ownerId);
    feedback.textContent=error?"Save failed: "+error.message:"Saved";await refresh();
   });
   controls.append(sel,save,feedback);card.append(controls);
   const details=node("details");details.append(node("summary","Drafts and outreach history"));
   const drafts=awaitingPlaceholder(p.id);details.append(drafts);card.append(details);
   queue.append(card);
  }
 }
 function awaitingPlaceholder(id){const wrap=node("div");wrap.dataset.prospectId=id;wrap.append(node("p","Drafts are read-only in this first increment. No messages can be sent."));return wrap;}
 async function refresh(){
  $("refresh").disabled=true;
  const {data,error}=await client.from("bswd_prospects").select("id,owner_id,business_name,location,website_url,source_url,opportunity_evidence,contact_channel,stage,suppressed_at,created_at").eq("owner_id",ownerId).order("created_at",{ascending:false}).limit(200);
  $("refresh").disabled=false;
  if(error){notice("Prospect table unavailable. Migration may not be applied: "+error.message);return;}
  records=data||[];notice("");render();
 }
 async function init(){
  const conf=window.BLACK_STAG_CONFIG?.supabase||{};
  if(!window.supabase?.createClient||!conf.url||!conf.publishableKey){notice("Studio configuration unavailable");return;}
  client=window.supabase.createClient(conf.url,conf.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const {data:userData,error:authError}=await client.auth.getUser();
  if(authError||!userData?.user){notice("Sign in to Black Stag Marketing Studio first.");return;}
  const {data:brand,error:brandError}=await client.from("brands").select("id,owner_id").eq("id",BRAND_ID).maybeSingle();
  if(brandError||brand?.owner_id!==userData.user.id){notice("This desk is restricted to the BSWD owner.");return;}
  ownerId=userData.user.id;$("app").hidden=false;
  $("refresh").addEventListener("click",refresh);$("stageFilter").addEventListener("change",render);
  $("newProspect").addEventListener("submit",async e=>{
   e.preventDefault();const name=$("business").value.trim(),location=$("location").value.trim(),source=url($("source").value),website=$("website").value.trim(),evidence=$("evidence").value.trim();
   if(!name||!source||!evidence||(website&&!url(website))){$("addStatus").textContent="Enter a valid source, evidence, and optional website URL.";return;}
   $("add").disabled=true;
   const {error}=await client.from("bswd_prospects").insert({owner_id:ownerId,business_name:name,location,source_url:source,website_url:website?url(website):null,opportunity_evidence:evidence,contact_channel:$("channel").value.trim(),prospect_key:keyFor(name,location),stage:"researched"});
   $("add").disabled=false;
   $("addStatus").textContent=error?(error.code==="23505"?"Duplicate business and location.":error.message):"Saved research candidate.";
   if(!error){$("newProspect").reset();await refresh();}
  });
  await refresh();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();