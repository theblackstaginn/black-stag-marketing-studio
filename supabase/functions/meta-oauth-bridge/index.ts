import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const BRAND_ID = "d51c76c3-a4a6-4109-99c2-5a4b3cff226b";
const ORIGIN = "https://theblackstaginn.github.io";
const CALLBACK = "https://theblackstaginn.github.io/black-stag-marketing-studio/meta-connect.html";
const SCOPES = ["ads_read"];
const BSMS_CAMPAIGN_ID = "261eb42b-bc35-4b18-ac0d-6120b6d7d6b3";
const DEFAULT_META_CAMPAIGN_ID = "120251805582510770";
const MAX_DASHBOARD_ADS = 20;
const PROJECT = Deno.env.get("SUPABASE_URL") || "";

type AdminClient = ReturnType<typeof admin>;
type MetaConfig = { id:string; secret:string; version:string; encryptionRoot:Uint8Array };

function adminKey(): string {
  const bundle = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  if (bundle) {
    try {
      const parsed = JSON.parse(bundle);
      if (typeof parsed.default === "string" && parsed.default) return parsed.default;
    } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function publicKey(): string {
  const direct = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  if (direct) return direct;
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return parsed.default || Object.values(parsed)[0] || "";
  } catch { return ""; }
}
function admin() {
  if (!PROJECT || !adminKey()) throw Error("backend_not_configured");
  return createClient(PROJECT, adminKey(), { auth:{persistSession:false,autoRefreshToken:false} });
}
function config(): MetaConfig {
  const id=(Deno.env.get("META_APP_ID")||"").trim();
  const secret=(Deno.env.get("META_APP_SECRET")||"").trim();
  const version=(Deno.env.get("META_GRAPH_VERSION")||"").trim();
  const root=Deno.env.get("META_TOKEN_ENCRYPTION_KEY")||Deno.env.get("PINTEREST_TOKEN_ENCRYPTION_KEY")||Deno.env.get("ETSY_TOKEN_ENCRYPTION_KEY")||"";
  let encryptionRoot:Uint8Array;
  try { encryptionRoot=Uint8Array.from(atob(root),ch=>ch.charCodeAt(0)); } catch { throw Error("meta_secrets_missing"); }
  if(!/^\d{5,30}$/.test(id)||!secret||secret.length>500||!/^v\d{1,2}\.\d$/.test(version)||encryptionRoot.length!==32) throw Error("meta_secrets_missing");
  return {id,secret,version,encryptionRoot};
}
function graph(cfg:MetaConfig,path:string){ return `https://graph.facebook.com/${cfg.version}${path}`; }
function originHeaders(req:Request):Record<string,string>{
  return req.headers.get("origin")===ORIGIN?{
    "Access-Control-Allow-Origin":ORIGIN,
    "Access-Control-Allow-Methods":"POST,OPTIONS",
    "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
    "Vary":"Origin"
  }:{};
}
function respond(req:Request,data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...originHeaders(req)}});
}
function raw64(bytes:Uint8Array){ let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s); }
function url64(bytes:Uint8Array){ return raw64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function fromUrl64(value:string){
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error("invalid_encrypted_token");
  const s=value.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(s+"=".repeat((4-s.length%4)%4)),ch=>ch.charCodeAt(0));
}
async function stateHash(state:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(state));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
async function encryptionKey(raw:Uint8Array){
  const root=await crypto.subtle.importKey("raw",raw,"HKDF",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:new TextEncoder().encode("black-stag-meta-oauth-v1"),info:new TextEncoder().encode("meta-credential-token-aes-gcm")},root,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function seal(plaintext:string,key:CryptoKey){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(plaintext));
  return "v1."+url64(iv)+"."+url64(new Uint8Array(cipher));
}
async function openSealed(stored:string,key:CryptoKey){
  const [version,iv,cipher]=stored.split(".");
  if(version!=="v1"||!iv||!cipher)throw Error("invalid_encrypted_token");
  const value=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromUrl64(iv)},key,fromUrl64(cipher));
  return new TextDecoder().decode(value);
}
async function appSecretProof(token:string,secret:string){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(token));
  return Array.from(new Uint8Array(sig),b=>b.toString(16).padStart(2,"0")).join("");
}
async function owner(req:Request,db:AdminClient):Promise<string|null>{
  const jwt=/^Bearer (\S+)$/i.exec(req.headers.get("Authorization")||"")?.[1];
  const publishable=publicKey();
  if(!jwt||!publishable)return null;
  const client=createClient(PROJECT,publishable,{global:{headers:{Authorization:"Bearer "+jwt}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:{user},error}=await client.auth.getUser(jwt);
  if(error||!user)return null;
  const {data:brand,error:be}=await client.from("brands").select("owner_id").eq("id",BRAND_ID).maybeSingle();
  if(be||!brand)return null;
  if(brand.owner_id===user.id)return user.id;
  const {data:member}=await client.from("brand_memberships").select("role").eq("brand_id",BRAND_ID).eq("user_id",user.id).maybeSingle();
  return member?.role==="owner"?user.id:null;
}
async function status(req:Request,db:AdminClient){
  if(!await owner(req,db))return respond(req,{error:"not_authorized"},403);
  let configured=true; try{config()}catch{configured=false}
  const {data,error}=await db.from("meta_account_credentials").select("facebook_user_id,facebook_name,scopes,access_token_expires_at,connected_at").eq("brand_id",BRAND_ID).maybeSingle();
  if(error)return respond(req,{error:"status_unavailable"},500);
  const {data:cache}=await db.from("meta_ad_account_cache").select("count,synced_at,complete,warnings").eq("brand_id",BRAND_ID).maybeSingle();
  return respond(req,{configured,connected:!!data,account:data||null,ad_accounts:cache||null});
}
async function start(req:Request,db:AdminClient){
  const who=await owner(req,db); if(!who)return respond(req,{error:"not_authorized"},403);
  const cfg=config(),state=url64(crypto.getRandomValues(new Uint8Array(32)));
  const {error}=await db.from("meta_oauth_attempts").insert({state_hash:await stateHash(state),brand_id:BRAND_ID,initiated_by:who,scopes:SCOPES,expires_at:new Date(Date.now()+600000).toISOString()});
  if(error)return respond(req,{error:"unable_to_begin_authorization"},500);
  const url=new URL("https://www.facebook.com/"+cfg.version+"/dialog/oauth");
  url.searchParams.set("client_id",cfg.id); url.searchParams.set("redirect_uri",CALLBACK); url.searchParams.set("response_type","code"); url.searchParams.set("scope",SCOPES.join(",")); url.searchParams.set("state",state);
  return respond(req,{authorize_url:url.toString(),expires_in:600});
}
async function exchangeCode(cfg:MetaConfig,code:string){
  const url=new URL(graph(cfg,"/oauth/access_token"));
  url.searchParams.set("client_id",cfg.id); url.searchParams.set("client_secret",cfg.secret); url.searchParams.set("redirect_uri",CALLBACK); url.searchParams.set("code",code);
  const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});
  if(!r.ok){console.error("Meta code exchange HTTP",r.status);throw Error("meta_token_exchange_failed")}
  return await r.json();
}
async function exchangeLongLived(cfg:MetaConfig,shortToken:string){
  const url=new URL(graph(cfg,"/oauth/access_token"));
  url.searchParams.set("grant_type","fb_exchange_token"); url.searchParams.set("client_id",cfg.id); url.searchParams.set("client_secret",cfg.secret); url.searchParams.set("fb_exchange_token",shortToken);
  const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});
  if(!r.ok){console.error("Meta long-lived exchange HTTP",r.status);throw Error("meta_long_lived_exchange_failed")}
  return await r.json();
}
async function debugToken(cfg:MetaConfig,token:string){
  const url=new URL(graph(cfg,"/debug_token")); url.searchParams.set("input_token",token); url.searchParams.set("access_token",cfg.id+"|"+cfg.secret);
  const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)}); if(!r.ok)throw Error("meta_token_validation_failed"); return await r.json();
}
async function readMe(cfg:MetaConfig,token:string){
  const url=new URL(graph(cfg,"/me")); url.searchParams.set("fields","id,name"); url.searchParams.set("access_token",token); url.searchParams.set("appsecret_proof",await appSecretProof(token,cfg.secret));
  const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)}); if(!r.ok)throw Error("meta_account_verification_failed"); return await r.json();
}
async function finish(req:Request,db:AdminClient,input:Record<string,unknown>){
  const who=await owner(req,db); if(!who)return respond(req,{error:"not_authorized"},403);
  const state=String(input.state||""); if(!/^[A-Za-z0-9_-]{43}$/.test(state))return respond(req,{error:"invalid_state"},400);
  const {data:attempts,error}=await db.from("meta_oauth_attempts").delete().eq("state_hash",await stateHash(state)).gt("expires_at",new Date().toISOString()).select("brand_id,initiated_by,scopes");
  if(error||!attempts||attempts.length!==1)return respond(req,{error:"authorization_expired_or_reused"},400);
  if(attempts[0].brand_id!==BRAND_ID||attempts[0].initiated_by!==who)return respond(req,{error:"authorization_owner_mismatch"},403);
  if(input.error)return respond(req,{error:"authorization_declined"},400);
  const code=String(input.code||""); if(!code||code.length>4000)return respond(req,{error:"authorization_code_missing"},400);
  const cfg=config(),short=await exchangeCode(cfg,code);
  if(typeof short.access_token!=="string")throw Error("meta_token_response_incomplete");
  const longLived=await exchangeLongLived(cfg,short.access_token);
  if(typeof longLived.access_token!=="string")throw Error("meta_token_response_incomplete");
  const debug=await debugToken(cfg,longLived.access_token),data=debug?.data;
  if(!data?.is_valid||String(data.app_id||"")!==cfg.id)throw Error("meta_token_validation_failed");
  const granted=Array.isArray(data.scopes)?data.scopes.map(String):[];
  if(!SCOPES.every(scope=>granted.includes(scope)))return respond(req,{error:"meta_permissions_incomplete"},403);
  const profile=await readMe(cfg,longLived.access_token),facebookUserId=String(profile?.id||""),facebookName=String(profile?.name||"").slice(0,160);
  if(!/^\d{5,30}$/.test(facebookUserId))throw Error("meta_account_verification_failed");
  let expiresAt:string;
  if(Number.isFinite(Number(data.expires_at))&&Number(data.expires_at)>0)expiresAt=new Date(Number(data.expires_at)*1000).toISOString();
  else {
    const sec=Number(longLived.expires_in);
    if(!Number.isFinite(sec)||sec<60||sec>90*86400)throw Error("unexpected_token_expiry");
    expiresAt=new Date(Date.now()+sec*1000).toISOString();
  }
  const key=await encryptionKey(cfg.encryptionRoot),encrypted=await seal(longLived.access_token,key);
  const {error:saveError}=await db.from("meta_account_credentials").upsert({brand_id:BRAND_ID,facebook_user_id:facebookUserId,facebook_name:facebookName||null,access_token_encrypted:encrypted,scopes:granted,access_token_expires_at:expiresAt,authorized_by:who,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"brand_id"});
  if(saveError)throw Error("unable_to_save_connection");
  return respond(req,{connected:true,facebook_name:facebookName||null,scopes:granted,access_token_expires_at:expiresAt});
}
async function validToken(db:AdminClient){
  const {data:row,error}=await db.from("meta_account_credentials").select("access_token_encrypted,access_token_expires_at").eq("brand_id",BRAND_ID).maybeSingle();
  if(error||!row)throw Error("not_connected");
  if(new Date(row.access_token_expires_at).getTime()<Date.now()+60000)throw Error("reauthorization_required");
  const cfg=config(),key=await encryptionKey(cfg.encryptionRoot);
  return {token:await openSealed(row.access_token_encrypted,key),cfg};
}
function sanitizeAdAccount(item:Record<string,unknown>){
  const id=String(item.id||""),accountId=String(item.account_id||"");
  if(!/^act_\d{5,30}$/.test(id)||!/^\d{5,30}$/.test(accountId))return null;
  return {id,account_id:accountId,name:String(item.name||"Untitled ad account").slice(0,160),currency:item.currency?String(item.currency).slice(0,8):null,timezone_name:item.timezone_name?String(item.timezone_name).slice(0,80):null,account_status:Number.isFinite(Number(item.account_status))?Number(item.account_status):null};
}
async function accounts(req:Request,db:AdminClient){
  if(!await owner(req,db))return respond(req,{error:"not_authorized"},403);
  const {token,cfg}=await validToken(db),proof=await appSecretProof(token,cfg.secret);
  let url=new URL(graph(cfg,"/me/adaccounts")); url.searchParams.set("fields","id,account_id,name,currency,timezone_name,account_status"); url.searchParams.set("limit","100"); url.searchParams.set("access_token",token); url.searchParams.set("appsecret_proof",proof);
  const all:Record<string,unknown>[] = [],warnings:string[]=[]; let complete=false;
  for(let page=0;page<10;page++){
    const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});
    if(!r.ok){console.error("Meta ad account list HTTP",r.status);throw Error(r.status===400||r.status===401?"reauthorization_required":"meta_ad_account_request_failed")}
    const result=await r.json(),items=Array.isArray(result?.data)?result.data:[];
    for(const item of items){const sanitized=sanitizeAdAccount(item);if(sanitized)all.push(sanitized)}
    const next=result?.paging?.next; if(!next){complete=true;break}
    const candidate=new URL(String(next)); if(candidate.protocol!=="https:"||candidate.hostname!=="graph.facebook.com")throw Error("meta_pagination_invalid"); url=candidate;
  }
  if(!complete)warnings.push("Ad account list truncated after 1,000 accounts.");
  const {error:saveError}=await db.from("meta_ad_account_cache").upsert({brand_id:BRAND_ID,ad_accounts:all,complete,count:all.length,warnings,synced_at:new Date().toISOString()},{onConflict:"brand_id"});
  if(saveError)throw Error("meta_ad_account_cache_unavailable");
  return respond(req,{ad_accounts:all,count:all.length,complete,warnings});
}

function num(value:unknown){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:0;
}
function dollarsFromMinor(value:unknown){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed/100:0;
}
function safeMetaId(value:unknown){
  const id=String(value||"").replace(/^act_/,"");
  return /^\d{5,30}$/.test(id)?id:"";
}
function insightLeadCount(actions:unknown){
  if(!Array.isArray(actions))return 0;
  const rows=actions.filter(item=>item&&typeof item==="object") as Array<Record<string,unknown>>;
  const priority=[
    "offsite_conversion.fb_pixel_lead",
    "lead",
    "onsite_conversion.lead_grouped",
    "onsite_conversion.lead"
  ];
  for(const type of priority){
    const found=rows.find(item=>String(item.action_type||"")===type);
    if(found)return num(found.value);
  }
  const fuzzy=rows.find(item=>/lead/i.test(String(item.action_type||"")));
  return fuzzy?num(fuzzy.value):0;
}
function normalizeInsights(row:Record<string,unknown>|null|undefined){
  const actions=Array.isArray(row?.actions)?row?.actions:[];
  const spend=num(row?.spend),results=insightLeadCount(actions);
  const inlineClicks=num(row?.inline_link_clicks);
  return {
    spend,
    impressions:num(row?.impressions),
    reach:num(row?.reach),
    clicks:num(row?.clicks),
    link_clicks:inlineClicks,
    ctr:num(row?.ctr),
    link_ctr:num(row?.inline_link_click_ctr),
    cpc:num(row?.cpc),
    cpm:num(row?.cpm),
    frequency:num(row?.frequency),
    results,
    cost_per_result:results>0?spend/results:null
  };
}
async function metaJson(cfg:MetaConfig,token:string,proof:string,path:string,params:Record<string,string>={}){
  const url=new URL(graph(cfg,path));
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  url.searchParams.set("access_token",token);
  url.searchParams.set("appsecret_proof",proof);
  const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(18000)});
  const result=await r.json().catch(()=>null);
  if(!r.ok||result?.error){
    const code=Number(result?.error?.code);
    if(code===190||r.status===401)throw Error("reauthorization_required");
    console.error("Meta dashboard request HTTP",r.status,"path",path,"code",code||"none");
    throw Error("meta_dashboard_request_failed");
  }
  return result;
}
async function dashboard(req:Request,db:AdminClient,input:Record<string,unknown>){
  if(!await owner(req,db))return respond(req,{error:"not_authorized"},403);
  const {token,cfg}=await validToken(db),proof=await appSecretProof(token,cfg.secret);
  const {data:cache,error:cacheError}=await db.from("meta_ad_account_cache")
    .select("ad_accounts,synced_at,complete,warnings")
    .eq("brand_id",BRAND_ID)
    .maybeSingle();
  if(cacheError)throw Error("meta_ad_account_cache_unavailable");
  const cached=Array.isArray(cache?.ad_accounts)?cache.ad_accounts as Array<Record<string,unknown>>:[];
  if(!cached.length)throw Error("meta_account_not_accessible");

  const requestedAccount=safeMetaId(input.ad_account_id);
  const selected=cached.find(item=>safeMetaId(item.account_id)===requestedAccount) || (!requestedAccount?cached[0]:null);
  if(!selected)throw Error("meta_account_not_accessible");
  const accountId=safeMetaId(selected.account_id);
  const account={
    id:"act_"+accountId,
    account_id:accountId,
    name:String(selected.name||"Meta ad account").slice(0,160),
    currency:selected.currency?String(selected.currency).slice(0,8):"USD",
    timezone_name:selected.timezone_name?String(selected.timezone_name).slice(0,80):null,
    account_status:Number.isFinite(Number(selected.account_status))?Number(selected.account_status):null
  };

  let campaignId=safeMetaId(input.meta_campaign_id)||DEFAULT_META_CAMPAIGN_ID;
  let campaignResult:Record<string,unknown>|null=null;
  try{
    campaignResult=await metaJson(cfg,token,proof,"/"+campaignId,{
      fields:"id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time"
    });
  }catch(e){
    if(safeMetaId(input.meta_campaign_id))throw e;
    const listed=await metaJson(cfg,token,proof,"/act_"+accountId+"/campaigns",{
      fields:"id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time",
      limit:"50"
    });
    const items=Array.isArray(listed?.data)?listed.data as Array<Record<string,unknown>>:[];
    const preferred=items.find(item=>String(item.effective_status||"")==="ACTIVE")||items[0];
    if(!preferred)throw Error("meta_campaign_not_found");
    campaignId=safeMetaId(preferred.id);
    campaignResult=preferred;
  }
  if(!campaignResult||!campaignId)throw Error("meta_campaign_not_found");

  const insightFields="spend,impressions,reach,clicks,inline_link_clicks,ctr,inline_link_click_ctr,cpc,cpm,frequency,actions";
  const [campaignInsightsRaw,adsRaw]=await Promise.all([
    metaJson(cfg,token,proof,"/"+campaignId+"/insights",{fields:insightFields,date_preset:"maximum",limit:"1"}),
    metaJson(cfg,token,proof,"/"+campaignId+"/ads",{
      fields:"id,name,status,effective_status,created_time,updated_time,creative{id,name,title,body,image_url,thumbnail_url}",
      limit:String(MAX_DASHBOARD_ADS)
    })
  ]);
  const campaignInsight=Array.isArray(campaignInsightsRaw?.data)?campaignInsightsRaw.data[0]||null:null;
  const adItems=Array.isArray(adsRaw?.data)?(adsRaw.data as Array<Record<string,unknown>>).slice(0,MAX_DASHBOARD_ADS):[];
  const warnings:string[]=[];
  const ads=await Promise.all(adItems.map(async item=>{
    const adId=safeMetaId(item.id);
    let insight:Record<string,unknown>|null=null;
    if(adId){
      try{
        const raw=await metaJson(cfg,token,proof,"/"+adId+"/insights",{fields:insightFields,date_preset:"maximum",limit:"1"});
        insight=Array.isArray(raw?.data)?raw.data[0]||null:null;
      }catch{
        warnings.push("One ad insight row could not be refreshed.");
      }
    }
    const creative=item.creative&&typeof item.creative==="object"?item.creative as Record<string,unknown>:{};
    return {
      id:adId,
      name:String(item.name||"Untitled ad").slice(0,180),
      status:String(item.status||""),
      effective_status:String(item.effective_status||""),
      headline:creative.title?String(creative.title).slice(0,300):null,
      primary_text:creative.body?String(creative.body).slice(0,1500):null,
      image_url:creative.image_url?String(creative.image_url):creative.thumbnail_url?String(creative.thumbnail_url):null,
      metrics:normalizeInsights(insight)
    };
  }));

  const campaignStart=String(campaignResult.start_time||campaignResult.created_time||"");
  let leadQuery=db.from("black_stag_leads")
    .select("status,utm_source,utm_medium,utm_campaign,utm_content,fbclid,created_at")
    .eq("brand_id",BRAND_ID)
    .eq("campaign_id",BSMS_CAMPAIGN_ID)
    .order("created_at",{ascending:false})
    .limit(500);
  if(campaignStart&&Number.isFinite(new Date(campaignStart).getTime()))leadQuery=leadQuery.gte("created_at",campaignStart);
  const {data:leadRows,error:leadError}=await leadQuery;
  if(leadError)throw Error("meta_lead_attribution_unavailable");
  const leads=Array.isArray(leadRows)?leadRows as Array<Record<string,unknown>>:[];
  const byStatus:Record<string,number>={new:0,contacted:0,qualified:0,quoted:0,won:0,lost:0,spam:0};
  const byContent:Record<string,number>={};
  let metaClickLeads=0,attributedLeads=0;
  for(const lead of leads){
    const status=String(lead.status||"");
    if(Object.prototype.hasOwnProperty.call(byStatus,status))byStatus[status]++;
    const content=String(lead.utm_content||"").trim();
    if(content){byContent[content]=(byContent[content]||0)+1;attributedLeads++}
    const source=String(lead.utm_source||"").toLowerCase();
    if(Boolean(lead.fbclid)||source.includes("facebook")||source.includes("meta"))metaClickLeads++;
  }

  const campaignMetrics=normalizeInsights(campaignInsight);
  const lifetimeBudget=dollarsFromMinor(campaignResult.lifetime_budget);
  const dailyBudget=dollarsFromMinor(campaignResult.daily_budget);
  return respond(req,{
    connected:true,
    generated_at:new Date().toISOString(),
    cache:{synced_at:cache?.synced_at||null,complete:cache?.complete!==false,warnings:cache?.warnings||[]},
    account,
    campaign:{
      id:campaignId,
      name:String(campaignResult.name||"Meta campaign").slice(0,180),
      status:String(campaignResult.status||""),
      effective_status:String(campaignResult.effective_status||""),
      objective:String(campaignResult.objective||""),
      start_time:campaignResult.start_time||null,
      stop_time:campaignResult.stop_time||null,
      lifetime_budget:lifetimeBudget||null,
      daily_budget:dailyBudget||null,
      metrics:campaignMetrics
    },
    ads,
    leads:{
      total:leads.length,
      meta_click_leads:metaClickLeads,
      attributed:attributedLeads,
      unattributed:Math.max(0,leads.length-attributedLeads),
      by_status:byStatus,
      by_utm_content:byContent
    },
    warnings:Array.from(new Set(warnings))
  });
}

async function disconnect(req:Request,db:AdminClient,input:Record<string,unknown>){
  if(!await owner(req,db))return respond(req,{error:"not_authorized"},403);
  if(input.confirm!=="DISCONNECT_META")return respond(req,{error:"explicit_confirmation_required"},400);
  try{
    const {token,cfg}=await validToken(db),url=new URL(graph(cfg,"/me/permissions"));
    url.searchParams.set("access_token",token);url.searchParams.set("appsecret_proof",await appSecretProof(token,cfg.secret));
    await fetch(url,{method:"DELETE",headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)});
  }catch(e){console.warn("Meta remote revoke unavailable; local credential removal will continue.",e instanceof Error?e.message:"unknown")}
  await Promise.all([db.from("meta_account_credentials").delete().eq("brand_id",BRAND_ID),db.from("meta_ad_account_cache").delete().eq("brand_id",BRAND_ID)]);
  return respond(req,{disconnected:true});
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:originHeaders(req)});
  if(req.method!=="POST")return respond(req,{error:"method_not_allowed"},405);
  if(req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN)return respond(req,{error:"origin_denied"},403);
  try{
    const body=await req.json().catch(()=>({}));if(!body||typeof body!=="object")return respond(req,{error:"invalid_payload"},400);
    const db=admin();
    if(body.action==="status")return await status(req,db);
    if(body.action==="start")return await start(req,db);
    if(body.action==="finish")return await finish(req,db,body);
    if(body.action==="accounts")return await accounts(req,db);
    if(body.action==="dashboard")return await dashboard(req,db,body);
    if(body.action==="disconnect")return await disconnect(req,db,body);
    return respond(req,{error:"invalid_action"},400);
  }catch(e){
    const name=e instanceof Error?e.message:"server_error";
    const known=["backend_not_configured","meta_secrets_missing","not_connected","reauthorization_required","meta_token_exchange_failed","meta_long_lived_exchange_failed","meta_token_validation_failed","meta_token_response_incomplete","meta_account_verification_failed","meta_ad_account_request_failed","meta_ad_account_cache_unavailable","meta_account_not_accessible","meta_campaign_not_found","meta_dashboard_request_failed","meta_lead_attribution_unavailable","meta_pagination_invalid","unexpected_token_expiry","invalid_encrypted_token","unable_to_save_connection"];
    if(!known.includes(name))console.error("Meta bridge error:",name);
    return respond(req,{error:known.includes(name)?name:"server_unavailable"},name==="not_connected"?404:name==="reauthorization_required"?403:503);
  }
});