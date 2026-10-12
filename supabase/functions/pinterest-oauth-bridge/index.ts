import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";

const BRAND_ID="956b245e-f60f-4e40-9d5b-0246d947ffb2";
const EXPECTED_USERNAME="laceandleather65";
const ORIGIN="https://theblackstaginn.github.io";
const CALLBACK="https://theblackstaginn.github.io/black-stag-marketing-studio/pinterest-connect.html";
const SCOPES=["user_accounts:read","boards:read","boards:write","pins:read","pins:write"];
const DEMO_PIN={
  title:"Printable Tarot Journal Pages | Grimoire Vol. 1",
  description:"Make room for the meaning behind each draw. Grimoire Journal Pages Vol. 1 brings eight aged-parchment layouts for tarot pulls, intentions and quiet reflection. Digital PNG pages and a print-ready PDF, with space for your own words.",
  link:"https://www.etsy.com/listing/4433883659/grimoire-journal-pages-8-printable-aged",
  image:"https://i.etsystatic.com/63811998/r/il/29ed86/7605179291/il_794xN.7605179291_cvmu.jpg",
  alt:"Collage of eight old-world warm parchment journal-page designs with lined, blank and bordered layouts for Grimoire Journal Pages Vol. 1."
};
const PROJECT=Deno.env.get("SUPABASE_URL")||"";
const PINTEREST_API="https://api.pinterest.com/v5";
type AdminClient=ReturnType<typeof admin>;

function adminKey():string{
  const bundle=Deno.env.get("SUPABASE_SECRET_KEYS")||"";
  if(bundle){try{const x=JSON.parse(bundle).default;if(typeof x==="string"&&x)return x;}catch{}}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}
function publicKey():string{
  const direct=Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY");
  if(direct)return direct;
  try{const x=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");return x.default||Object.values(x)[0]||"";}
  catch{return "";}
}
function admin(){
  if(!PROJECT||!adminKey())throw Error("backend_not_configured");
  return createClient(PROJECT,adminKey(),{auth:{persistSession:false,autoRefreshToken:false}});
}
function config(){
  const id=(Deno.env.get("PINTEREST_APP_ID")||"").trim();
  const secret=(Deno.env.get("PINTEREST_APP_SECRET")||"").trim();
  // HKDF keeps Pinterest encryption cryptographically separate from Etsy,
  // even if the existing 256-bit deployment key is reused as root material.
  const root=Deno.env.get("PINTEREST_TOKEN_ENCRYPTION_KEY")||Deno.env.get("ETSY_TOKEN_ENCRYPTION_KEY")||"";
  let raw:Uint8Array;
  try{raw=Uint8Array.from(atob(root),x=>x.charCodeAt(0));}catch{throw Error("pinterest_secrets_missing");}
  if(!id||id.length>180||!secret||secret.length>500||raw.length!==32)throw Error("pinterest_secrets_missing");
  return{id,secret,raw};
}
function originHeaders(req:Request):Record<string,string>{
  return req.headers.get("origin")===ORIGIN
    ?{"Access-Control-Allow-Origin":ORIGIN,
      "Access-Control-Allow-Methods":"POST,OPTIONS",
      "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
      "Vary":"Origin"}:{};
}
function respond(req:Request,data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...originHeaders(req)
  }});
}
function raw64(bytes:Uint8Array){
  let s="";for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s);
}
function url64(bytes:Uint8Array){return raw64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function fromUrl64(value:string){
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error("invalid_encrypted_token");
  const s=value.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(s+"=".repeat((4-s.length%4)%4)),x=>x.charCodeAt(0));
}
async function stateHash(state:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(state));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
async function encryptionKey(raw:Uint8Array){
  const root=await crypto.subtle.importKey("raw",raw,"HKDF",false,["deriveKey"]);
  return crypto.subtle.deriveKey({
    name:"HKDF",hash:"SHA-256",
    salt:new TextEncoder().encode("black-stag-pinterest-oauth-v1"),
    info:new TextEncoder().encode("pinterest-credential-token-aes-gcm")
  },root,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
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
function scopesOf(input:unknown):string[]{
  const src=Array.isArray(input)?input.join(" "):String(input||"");
  return [...new Set(src.split(/[,\s]+/).filter(x=>/^[a-z_]+:(read|write|read_secret|write_secret)$/.test(x)))];
}
function calculateExpiry(inSeconds:unknown,limit=4000000):string{
  const sec=Number(inSeconds);
  if(!Number.isFinite(sec)||sec<60||sec>limit)throw Error("unexpected_token_expiry");
  return new Date(Date.now()+sec*1000).toISOString();
}
function refreshExpiry(data:any){
  if(Number.isFinite(Number(data.refresh_token_expires_at))&&Number(data.refresh_token_expires_at)>0)
    return new Date(Number(data.refresh_token_expires_at)*1000).toISOString();
  if(Number.isFinite(Number(data.refresh_token_expires_in))&&Number(data.refresh_token_expires_in)>0)
    return new Date(Date.now()+Number(data.refresh_token_expires_in)*1000).toISOString();
  return null;
}
async function owner(req:Request,db:AdminClient):Promise<string|null>{
  const jwt=/^Bearer (\S+)$/i.exec(req.headers.get("Authorization")||"")?.[1];
  const anon=publicKey();
  if(!jwt||!anon)return null;
  const client=createClient(PROJECT,anon,{
    global:{headers:{Authorization:"Bearer "+jwt}},
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  const {data:{user},error}=await client.auth.getUser(jwt);
  if(error||!user)return null;
  // Authorization occurs in the user's RLS-scoped context; the owner is
  // checked once more against service-only tables after completing OAuth.
  const {data:brand,error:be}=await client.from("brands").select("owner_id").eq("id",BRAND_ID).maybeSingle();
  if(be||!brand)return null;
  if(brand.owner_id===user.id)return user.id;
  const {data:member}=await client.from("brand_memberships").select("role")
    .eq("brand_id",BRAND_ID).eq("user_id",user.id).maybeSingle();
  return member?.role==="owner"?user.id:null;
}
function basic(cfg:ReturnType<typeof config>){
  return "Basic "+raw64(new TextEncoder().encode(cfg.id+":"+cfg.secret));
}
async function status(req:Request,db:AdminClient){
  if(!await owner(req,db))return respond(req,{error:"not_authorized"},403);
  const {data,error}=await db.from("pinterest_account_credentials")
    .select("username,scopes,access_token_expires_at,refresh_token_expires_at,connected_at")
    .eq("brand_id",BRAND_ID).maybeSingle();
  if(error)return respond(req,{error:"status_unavailable"},500);
  let configured=true;try{config();}catch{configured=false;}
  const {data:cache}=await db.from("pinterest_board_cache")
    .select("count,synced_at,complete").eq("brand_id",BRAND_ID).maybeSingle();
  return respond(req,{configured,connected:!!data,account:data||null,boards:cache||null});
}
async function start(req:Request,db:AdminClient){
  const who=await owner(req,db);
  if(!who)return respond(req,{error:"not_authorized"},403);
  const cfg=config();
  const state=url64(crypto.getRandomValues(new Uint8Array(32)));
  const {error}=await db.from("pinterest_oauth_attempts").insert({
    state_hash:await stateHash(state),brand_id:BRAND_ID,initiated_by:who,scopes:SCOPES,
    expires_at:new Date(Date.now()+10*60*1000).toISOString()
  });
  if(error)return respond(req,{error:"unable_to_begin_authorization"},500);
  const url=new URL("https://www.pinterest.com/oauth/");
  for(const [k,v] of Object.entries({
    client_id:cfg.id,redirect_uri:CALLBACK,response_type:"code",
    scope:SCOPES.join(","),state
  }))url.searchParams.set(k,v);
  return respond(req,{authorize_url:url.toString(),expires_in:600});
}
async function finish(req:Request,db:AdminClient,input:any){
  // Authorization codes and states are ONLY accepted with an authenticated,
  // permitted Studio account; no GET exchange or cross-origin callback.
  const who=await owner(req,db);
  if(!who)return respond(req,{error:"not_authorized"},403);
  const state=String(input.state||"");
  if(!/^[A-Za-z0-9_-]{43}$/.test(state))return respond(req,{error:"invalid_state"},400);
  const {data:attempts,error:e}=await db.from("pinterest_oauth_attempts")
    .delete().eq("state_hash",await stateHash(state))
    .gt("expires_at",new Date().toISOString())
    .select("brand_id,initiated_by,scopes");
  if(e||!attempts||attempts.length!==1)return respond(req,{error:"authorization_expired_or_reused"},400);
  const attempt=attempts[0];
  if(attempt.brand_id!==BRAND_ID||attempt.initiated_by!==who)
    return respond(req,{error:"authorization_owner_mismatch"},403);
  if(input.error)return respond(req,{error:"authorization_declined"},400);
  const code=String(input.code||"");
  if(!code||code.length>3000)return respond(req,{error:"authorization_code_missing"},400);
  const cfg=config();
  const exchange=await fetch(PINTEREST_API+"/oauth/token",{
    method:"POST",
    headers:{"Authorization":basic(cfg),"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},
    body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:CALLBACK}),
    signal:AbortSignal.timeout(15000)
  });
  if(!exchange.ok){console.error("Pinterest OAuth token exchange status:",exchange.status);return respond(req,{error:"pinterest_token_exchange_failed"},502);}
  const token=await exchange.json();
  if(typeof token.access_token!=="string"||typeof token.refresh_token!=="string")
    return respond(req,{error:"pinterest_token_response_incomplete"},502);
  const granted=scopesOf(token.scope);
  if(!SCOPES.every(s=>granted.includes(s)))
    return respond(req,{error:"pinterest_permissions_incomplete"},403);
  const accountRes=await fetch(PINTEREST_API+"/user_account",{
    headers:{"Authorization":"Bearer "+token.access_token,"Accept":"application/json"},
    signal:AbortSignal.timeout(15000)
  });
  if(!accountRes.ok){console.error("Pinterest account verification:",accountRes.status);return respond(req,{error:"pinterest_account_verification_failed"},502);}
  const account=await accountRes.json();
  const name=String(account.username||"");
  if(name.toLowerCase()!==EXPECTED_USERNAME)return respond(req,{error:"different_pinterest_account"},403);
  const key=await encryptionKey(cfg.raw);
  const [encryptedAccess,encryptedRefresh]=await Promise.all([
    seal(token.access_token,key),seal(token.refresh_token,key)
  ]);
  const {error:saveError}=await db.from("pinterest_account_credentials").upsert({
    brand_id:BRAND_ID,username:name,pinterest_user_id:account.id?String(account.id):null,
    access_token_encrypted:encryptedAccess,refresh_token_encrypted:encryptedRefresh,
    scopes:granted,
    access_token_expires_at:calculateExpiry(token.expires_in),
    refresh_token_expires_at:refreshExpiry(token),
    authorized_by:who,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()
  },{onConflict:"brand_id"});
  if(saveError){console.error("Pinterest credential storage:",saveError.code);return respond(req,{error:"unable_to_save_connection"},500);}
  return respond(req,{connected:true,username:name,scopes:granted});
}
async function validToken(db:AdminClient){
  const {data:row,error}=await db.from("pinterest_account_credentials")
    .select("username,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,refresh_token_expires_at,scopes")
    .eq("brand_id",BRAND_ID).maybeSingle();
  if(error||!row)throw Error("not_connected");
  if(String(row.username).toLowerCase()!==EXPECTED_USERNAME)throw Error("different_pinterest_account");
  const granted=Array.isArray(row.scopes)?row.scopes.map(String):[];
  if(!SCOPES.every(s=>granted.includes(s)))throw Error("reauthorization_required");
  const cfg=config(),key=await encryptionKey(cfg.raw);
  if(new Date(row.access_token_expires_at).getTime()>Date.now()+3*86400000)
    return await openSealed(row.access_token_encrypted,key);
  if(row.refresh_token_expires_at&&new Date(row.refresh_token_expires_at).getTime()<Date.now()+60000)
    throw Error("reauthorization_required");
  const refresh=await openSealed(row.refresh_token_encrypted,key);
  const response=await fetch(PINTEREST_API+"/oauth/token",{
    method:"POST",
    headers:{"Authorization":basic(cfg),"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},
    body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refresh}),
    signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw Error(response.status===400||response.status===401?"reauthorization_required":"refresh_unavailable");
  const refreshed=await response.json();
  if(typeof refreshed.access_token!=="string"||typeof refreshed.refresh_token!=="string")
    throw Error("refresh_unavailable");
  const scopes=scopesOf(refreshed.scope);
  if(!SCOPES.every(s=>scopes.includes(s)))throw Error("reauthorization_required");
  const [accessEncrypted,refreshEncrypted]=await Promise.all([
    seal(refreshed.access_token,key),seal(refreshed.refresh_token,key)
  ]);
  const update:Record<string,unknown>={
    access_token_encrypted:accessEncrypted,refresh_token_encrypted:refreshEncrypted,
    access_token_expires_at:calculateExpiry(refreshed.expires_in),
    updated_at:new Date().toISOString(),scopes
  };
  const exp=refreshExpiry(refreshed);
  if(exp)update.refresh_token_expires_at=exp;
  const {error:save}=await db.from("pinterest_account_credentials")
    .update(update).eq("brand_id",BRAND_ID);
  if(save)throw Error("refresh_storage_failed");
  return refreshed.access_token as string;
}
async function boards(req:Request,db:AdminClient){
  if(!await owner(req,db))return respond(req,{error:"not_authorized"},403);
  const token=await validToken(db);
  let bookmark:string|undefined,all:any[]=[],complete=false;
  const warnings:string[]=[];
  for(let page=0;page<10;page++){
    const url=new URL(PINTEREST_API+"/boards");
    url.searchParams.set("page_size","100");
    if(bookmark)url.searchParams.set("bookmark",bookmark);
    const r=await fetch(url,{headers:{"Authorization":"Bearer "+token,"Accept":"application/json"},
      signal:AbortSignal.timeout(15000)});
    if(!r.ok){console.error("Pinterest board list HTTP",r.status);throw Error("pinterest_board_request_failed");}
    const result=await r.json();
    const items=Array.isArray(result.items)?result.items:[];
    for(const b of items){
      const id=String(b.id||"");
      if(!/^\d{5,24}$/.test(id))continue;
      all.push({id,name:String(b.name||"Untitled").slice(0,120),
        privacy:String(b.privacy||"").slice(0,32),
        description:String(b.description||"").slice(0,320)});
    }
    bookmark=typeof result.bookmark==="string"&&result.bookmark?result.bookmark:undefined;
    if(!bookmark){complete=true;break;}
  }
  if(!complete)warnings.push("Board list truncated after 1,000 boards.");
  const {error:save}=await db.from("pinterest_board_cache").upsert({
    brand_id:BRAND_ID,boards:all,complete,count:all.length,warnings,
    synced_at:new Date().toISOString()
  },{onConflict:"brand_id"});
  if(save)throw Error("board_cache_unavailable");
  return respond(req,{boards:all,complete,count:all.length,warnings});
}

async function createDemoPin(req:Request,db:AdminClient,input:any){
  if(!await owner(req,db))return respond(req,{error:"not_authorized"},403);
  if(input.confirm!=="CREATE_TRIAL_PIN")return respond(req,{error:"explicit_confirmation_required"},400);
  const boardId=String(input.board_id||"");
  if(!/^\d{5,24}$/.test(boardId))return respond(req,{error:"invalid_board"},400);
  const {data:cache,error:cacheError}=await db.from("pinterest_board_cache")
    .select("boards").eq("brand_id",BRAND_ID).maybeSingle();
  if(cacheError||!cache||!Array.isArray(cache.boards))throw Error("board_cache_unavailable");
  const board=cache.boards.find((b:any)=>String(b?.id||"")===boardId);
  if(!board)return respond(req,{error:"board_not_authorized"},403);
  const token=await validToken(db);
  const r=await fetch(PINTEREST_API+"/pins",{
    method:"POST",
    headers:{
      "Authorization":"Bearer "+token,
      "Accept":"application/json",
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      board_id:boardId,
      title:DEMO_PIN.title,
      description:DEMO_PIN.description,
      link:DEMO_PIN.link,
      alt_text:DEMO_PIN.alt,
      media_source:{source_type:"image_url",url:DEMO_PIN.image}
    }),
    signal:AbortSignal.timeout(20000)
  });
  if(!r.ok){
    console.error("Pinterest demo Pin create HTTP",r.status);
    return respond(req,{error:"pinterest_pin_create_failed",http_status:r.status},502);
  }
  const result=await r.json();
  const pinId=String(result?.id||"");
  if(!/^\d{5,30}$/.test(pinId))throw Error("pinterest_pin_response_invalid");
  return respond(req,{
    created:true,
    pin_id:pinId,
    board:{id:boardId,name:String(board.name||"Untitled")},
    title:DEMO_PIN.title,
    link:DEMO_PIN.link,
    trial_notice:"Created through the connected developer app. Under Trial access, Pinterest limits created Pins to creator visibility."
  },201);
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:originHeaders(req)});
  if(req.method!=="POST")return respond(req,{error:"method_not_allowed"},405);
  if(req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN)
    return respond(req,{error:"origin_denied"},403);
  try{
    const body=await req.json().catch(()=>({}));
    if(!body||typeof body!=="object")return respond(req,{error:"invalid_payload"},400);
    // Auth is checked inside each explicit action; no unauthenticated reads.
    const db=admin();
    if(body.action==="status")return await status(req,db);
    if(body.action==="start")return await start(req,db);
    if(body.action==="finish")return await finish(req,db,body);
    if(body.action==="boards")return await boards(req,db);
    if(body.action==="create_demo_pin")return await createDemoPin(req,db,body);
    return respond(req,{error:"invalid_action"},400);
  }catch(err){
    const name=err instanceof Error?err.message:"server_error";
    const known=["backend_not_configured","pinterest_secrets_missing","not_connected",
      "different_pinterest_account","reauthorization_required","refresh_unavailable",
      "refresh_storage_failed","pinterest_board_request_failed","board_cache_unavailable",
      "pinterest_pin_response_invalid","unexpected_token_expiry","invalid_encrypted_token"];
    if(!known.includes(name))console.error("Pinterest bridge error:",name);
    return respond(req,{error:known.includes(name)?name:"server_unavailable"},
      name==="not_connected"?404:name==="reauthorization_required"?403:503);
  }
});