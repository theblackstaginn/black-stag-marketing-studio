import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Owner-authenticated BSWD website discovery. Never sends outreach.
// Search results are clues, not proof of website absence or ownership.
const BRAND_ID = "d51c76c3-a4a6-4109-99c2-5a4b3cff226b";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const EXCLUDED = new Set([
  "facebook.com","instagram.com","tiktok.com","linkedin.com","youtube.com",
  "yelp.com","yellowpages.com","bbb.org","mapquest.com","google.com",
  "maps.apple.com","tripadvisor.com","manta.com","angi.com","nextdoor.com",
  "chamberofcommerce.com","bizapedia.com","dnb.com","alignable.com",
  "merchantcircle.com","houzz.com","thumbtack.com","linktr.ee","beacons.ai",
  "pinterest.com","x.com","twitter.com","reddit.com","whatsapp.com",
  "opencorporates.com","chamberofcommerce.org","foursquare.com"
]);
const SOCIAL = new Set(["facebook.com","instagram.com","tiktok.com","linkedin.com","youtube.com","pinterest.com","x.com","twitter.com"]);
const GENERIC_MAIL = new Set([
  "gmail.com","yahoo.com","outlook.com","hotmail.com","icloud.com","aol.com",
  "live.com","msn.com","proton.me","protonmail.com","mail.com","comcast.net"
]);
const NOISE = new Set(["the","and","of","a","at","in","on","an","llc","inc","co","company","ltd","corp","corporation"]);
const CORS = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  "Vary":"Origin"
};
const reply=(status:number, data:unknown):Response=>new Response(JSON.stringify(data), {status,headers:CORS});
const clipped=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const words=(v:string)=>v.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g," ").split(" ").filter(Boolean);
const tokens=(v:string)=>words(v).filter(w=>!NOISE.has(w));
function safeSite(value:unknown):string|null {
  if(typeof value!=="string"||value.length>2200)return null;
  try {
    const u=new URL(value);
    if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return null;
    const h=u.hostname.toLowerCase();
    if(!h.includes(".")||h==="localhost"||h.endsWith(".local")||h.endsWith(".internal")
      ||/^(127|10|192\.168)\./.test(h))return null;
    u.hash="";
    return u.href.slice(0,2000);
  }catch{return null;}
}
function registeredHost(url:string):string{
  const h=new URL(url).hostname.toLowerCase().replace(/^www\./,"");
  return h;
}
function onHost(host:string,domain:string):boolean{return host===domain||host.endsWith("."+domain);}
function isExcluded(url:string):boolean{
  const h=registeredHost(url);return [...EXCLUDED].some(d=>onHost(h,d));
}
function scoreCandidate(row:Record<string,unknown>,name:string,location:string,email:string){
  const href=safeSite(row.url);
  if(!href)return null;
  const host=registeredHost(href);
  const text=clipped(row.title,240)+" "+clipped(row.content,850);
  const normalized=text.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g," ");
  const nameTokens=tokens(name).filter(w=>w.length>=2);
  const matches=nameTokens.filter(w=>normalized.split(" ").includes(w));
  const coverage=nameTokens.length?matches.length/nameTokens.length:0;
  const exactName=words(name).join(" ");
  const title=words(clipped(row.title,240)).join(" ");
  const titleMatch=exactName.length>=5&&title.includes(exactName);
  const locationToken=tokens(location).filter(w=>w.length>2).slice(0,3);
  const locationMatch=locationToken.length>0&&locationToken.some(w=>normalized.split(" ").includes(w));
  const emailHost=email.includes("@")?email.split("@").pop()?.toLowerCase()||"":"";
  const emailMatch=emailHost&&!GENERIC_MAIL.has(emailHost)
    &&(onHost(host,emailHost)||onHost(emailHost,host));
  const excluded=isExcluded(href);
  const isSocial=[...SOCIAL].some(d=>onHost(host,d));
  let score=coverage*0.52+(titleMatch?0.22:0)+(locationMatch?0.14:0)+(emailMatch?0.28:0);
  if(nameTokens.length===1&&!emailMatch)score=Math.min(score,0.58);
  if(excluded)score=0;
  const kind=excluded?(isSocial?"social":"directory"):"website_candidate";
  return {url:href,title:clipped(row.title,180),excerpt:clipped(row.content,420),
    host,kind,score:Math.min(1,Math.round(score*100)/100),
    reasons:[coverage>=0.85?"name match":coverage>=0.5?"partial name":"weak name",
      locationMatch?"location mentioned":null,emailMatch?"business email domain":null]
      .filter(Boolean),exact_name:titleMatch,location_match:locationMatch,email_domain_match:!!emailMatch};
}
function classify(rows:Array<Record<string,unknown>>,name:string,location:string,email:string){
  const entries=rows.map(x=>scoreCandidate(x,name,location,email)).filter((x):x is NonNullable<typeof x>=>x!==null);
  const dedup=new Map<string,typeof entries[number]>();
  for(const x of entries) {
    const old=dedup.get(x.host);
    if(!old||x.score>old.score)dedup.set(x.host,x);
  }
  const candidates=[...dedup.values()].sort((a,b)=>b.score-a.score).slice(0,12);
  const external=candidates.filter(x=>x.kind==="website_candidate");
  const strong=external.find(x=>x.score>=0.78&&(x.location_match||x.email_domain_match));
  const tentative=external.find(x=>x.score>=0.37);
  const status=strong?"likely_website_found":tentative?"possible_match":"no_clear_site_found";
  const best=strong||tentative;
  const reason=strong
    ?"Search results strongly associate an independent domain with the business. Review before assuming ownership."
    :tentative?"An independent domain might belong to this business; manual review required."
    :"No convincing independent website appeared in these searches. This does NOT prove there is no website.";
  return {status,best_candidate_url:best?.url||null,candidates,match_reason:reason};
}
function publishableKey():string {
  const v=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if(v){try{const p=JSON.parse(v);if(typeof p.default==="string")return p.default;}catch{/*fallback*/}}
  return Deno.env.get("SUPABASE_ANON_KEY")||"";
}
async function smallJson(response:Response){
  const text=await response.text();
  try{return JSON.parse(text.slice(0,80000));}catch{return null;}
}
async function readDB(base:string,path:string,headers:Record<string,string>){
  const res=await fetch(base+"/rest/v1/"+path,{headers,signal:AbortSignal.timeout(12000)});
  return {ok:res.ok,status:res.status,body:await smallJson(res)};
}
async function getSearch(query:string,key:string):Promise<Array<Record<string,unknown>>>{
  const headers:Record<string,string>={"Content-Type":"application/json"};
  if(key)headers.Authorization="Bearer "+key;
  else headers["X-Tavily-Access-Mode"]="keyless";
  const response=await fetch("https://api.tavily.com/search",{
    method:"POST",headers,body:JSON.stringify({
      query,search_depth:"basic",max_results:6,
      include_answer:false,include_raw_content:false,include_images:false
    }),signal:AbortSignal.timeout(16000)
  });
  const body=await smallJson(response);
  if(!response.ok)throw new Error(
    response.status===429||response.status===432||response.status===433?"provider_limit"
    :"provider_http_"+response.status
  );
  if(!body||!Array.isArray(body.results))throw new Error("provider_invalid_response");
  return body.results.slice(0,6);
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return reply(405,{error:"method_not_allowed"});
  const token=req.headers.get("Authorization")||"";
  if(!/^Bearer\s+\S+$/i.test(token))return reply(401,{error:"sign_in_required"});
  const base=Deno.env.get("SUPABASE_URL")||"";
  const publicKey=publishableKey(),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!base||!publicKey||!service)return reply(503,{error:"verifier_not_configured"});
  let input:unknown;
  try {
    if(Number(req.headers.get("content-length")||0)>2000)return reply(413,{error:"request_too_large"});
    input=await req.json();
  }catch{return reply(400,{error:"invalid_json"});}
  const data=input&&typeof input==="object"&&!Array.isArray(input)?input as Record<string,unknown>:{};
  const id=clipped(data.prospect_id,60);
  if(!UUID.test(id))return reply(400,{error:"invalid_prospect_id"});
  const force=data.force===true;
  const userHeaders={"apikey":publicKey,"Authorization":token,"Content-Type":"application/json"};
  const adminHeaders={"apikey":service,"Authorization":"Bearer "+service,"Content-Type":"application/json"};
  try {
    const auth=await fetch(base+"/auth/v1/user",{headers:userHeaders,signal:AbortSignal.timeout(12000)});
    if(!auth.ok)return reply(401,{error:"sign_in_required"});
    const user=await smallJson(auth);
    const uid=clipped(user?.id,60);
    if(!UUID.test(uid))return reply(401,{error:"sign_in_required"});
    // Require the primary BSWD owner, not merely any logged-in Studio user.
    const owners=await readDB(base,"brands?select=id&id=eq."+BRAND_ID+"&owner_id=eq."+uid+"&limit=1",userHeaders);
    if(!owners.ok)return reply(502,{error:"owner_access_check_failed"});
    if(!Array.isArray(owners.body)||owners.body.length!==1)return reply(403,{error:"bswd_owner_only"});
    const found=await readDB(base,
      "bswd_prospects?select=id,business_name,location,contact_value,contact_channel,source_url,website_url,suppressed_at,stage&owner_id=eq."
      +uid+"&id=eq."+id+"&limit=1",userHeaders);
    if(!found.ok)return reply(502,{error:"prospect_read_failed"});
    const prospect=Array.isArray(found.body)?found.body[0]:null;
    if(!prospect)return reply(404,{error:"prospect_unavailable"});
    if(prospect.suppressed_at||prospect.stage==="do_not_contact")
      return reply(409,{error:"suppressed_prospect_not_checked"});
    const existing=await readDB(base,"bswd_site_search_checks?select=*&prospect_id=eq."+id+"&limit=1",adminHeaders);
    if(!existing.ok)return reply(502,{error:"search_cache_unavailable"});
    const cached=Array.isArray(existing.body)?existing.body[0]:null;
    if(cached&&Date.now()-Date.parse(cached.checked_at)<CACHE_MS
      &&(!force||Date.now()-Date.parse(cached.checked_at)<3600000)){
      return reply(200,{ok:true,cached:true,check:cached});
    }
    // Basic daily cap prevents unbounded third-party searches through this endpoint.
    const today=new Date().toISOString().slice(0,10);
    const allowance=await readDB(base,"bswd_site_search_checks?select=prospect_id&checked_at=gte."+today+"T00:00:00Z&limit=50",adminHeaders);
    if(!allowance.ok)return reply(502,{error:"check_budget_unavailable"});
    if(Array.isArray(allowance.body)&&allowance.body.length>=25)return reply(429,{error:"daily_verification_limit"});
    const business=clipped(prospect.business_name,200),place=clipped(prospect.location,150);
    if(!business)return reply(422,{error:"missing_business_name"});
    const queries=[
      '"'+business.replace(/"/g,"")+'" '+place.replace(/"/g,"")+" official business website",
      business.replace(/"/g,"")+" "+place.replace(/"/g,"")+" website contact"
    ];
    let all:Array<Record<string,unknown>>=[],queryCount=0;
    const apiKey=Deno.env.get("TAVILY_API_KEY")||"";
    try{
      for(const q of queries) {
        const results=await getSearch(q.trim(),apiKey);
        all.push(...results);queryCount++;
        const quick=classify(all,business,place,clipped(prospect.contact_value,320));
        if(quick.status==="likely_website_found")break;
      }
    }catch(error){
      // An incomplete provider response may not be interpreted as no website.
      const msg=error instanceof Error?error.message:"provider_error";
      return reply(msg==="provider_limit"?429:502,{error:msg,completed_searches:queryCount});
    }
    const evaluated=classify(all,business,place,clipped(prospect.contact_value,320));
    const record={
      prospect_id:id,...evaluated,query_count:queryCount,
      provider:apiKey?"tavily":"tavily-keyless",
      checked_at:new Date().toISOString()
    };
    const stored=await fetch(base+"/rest/v1/bswd_site_search_checks?on_conflict=prospect_id",{
      method:"POST",headers:{...adminHeaders,"Prefer":"resolution=merge-duplicates,return=representation"},
      body:JSON.stringify(record),signal:AbortSignal.timeout(12000)
    });
    const saved=await smallJson(stored);
    if(!stored.ok)return reply(502,{error:"search_result_save_failed"});
    const check=Array.isArray(saved)?saved[0]:saved;
    return reply(200,{ok:true,cached:false,check});
  }catch(error){
    console.error("BSWD verifier failed",error instanceof Error?error.name:"unexpected");
    return reply(503,{error:"verifier_temporarily_unavailable"});
  }
});
