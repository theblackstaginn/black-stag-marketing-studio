import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const BRAND = "956b245e-f60f-4e40-9d5b-0246d947ffb2";
const BASE = "https://openapi.etsy.com/v3/application";
const ORIGIN = "https://theblackstaginn.github.io";
const URL = Deno.env.get("SUPABASE_URL") || "";

function secretKey() {
  const packed=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(packed){try{const key=JSON.parse(packed).default;if(key)return key;}catch{}}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}
function publishableKey() {
  const direct=Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY");
  if(direct)return direct;
  try {
    const keys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
    return keys.default||Object.values(keys)[0]||"";
  }catch{return "";}
}
function credentials(){
  const id=Deno.env.get("ETSY_APP_KEYSTRING")||"";
  const shared=Deno.env.get("ETSY_APP_SHARED_SECRET")||"";
  const raw=Deno.env.get("ETSY_TOKEN_ENCRYPTION_KEY")||"";
  let bytes:Uint8Array;
  try{bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));}catch{throw Error("bridge_configuration_missing");}
  if(!id||!shared||bytes.length!==32)throw Error("bridge_configuration_missing");
  return {id,shared,bytes};
}
function admin(){
  if(!URL||!secretKey())throw Error("bridge_configuration_missing");
  return createClient(URL,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
}
function headers(req:Request) {
  return req.headers.get("origin")===ORIGIN?{
    "Access-Control-Allow-Origin":ORIGIN,
    "Access-Control-Allow-Methods":"POST,OPTIONS",
    "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
    "Vary":"Origin",
  }:{};
}
function answer(req:Request,data:unknown,status=200) {
  return new Response(JSON.stringify(data),{status,headers:{
    "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff",...headers(req)
  }});
}
async function authorize(req:Request){
  const token=/^Bearer (\S+)$/i.exec(req.headers.get("authorization")||"")?.[1];
  const key=publishableKey();
  if(!token||!key)throw Error("not_authorized");
  const client=createClient(URL,key,{global:{headers:{Authorization:"Bearer "+token}},
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data:{user},error}=await client.auth.getUser(token);
  if(error||!user)throw Error("not_authorized");
  const {data:brand}=await client.from("brands").select("owner_id").eq("id",BRAND).maybeSingle();
  if(brand?.owner_id===user.id)return user.id;
  const {data:membership}=await client.from("brand_memberships").select("role")
    .eq("brand_id",BRAND).eq("user_id",user.id).maybeSingle();
  if(membership?.role==="owner")return user.id;
  throw Error("not_authorized");
}
function decode(value:string){
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error("invalid_token_format");
  const base=value.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(base+"=".repeat((4-base.length%4)%4)),c=>c.charCodeAt(0));
}
function encode(bytes:Uint8Array){
  let s="";for(const v of bytes)s+=String.fromCharCode(v);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function aes(keyBytes:Uint8Array,mode:"encrypt"|"decrypt"){
  return crypto.subtle.importKey("raw",keyBytes,"AES-GCM",false,[mode]);
}
async function decrypt(value:string,keyBytes:Uint8Array){
  const [version,iv,data]=value.split(".");
  if(version!=="v1"||!iv||!data)throw Error("invalid_token_format");
  const key=await aes(keyBytes,"decrypt");
  const result=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv)},key,decode(data));
  return new TextDecoder().decode(result);
}
async function encrypt(value:string,keyBytes:Uint8Array){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await aes(keyBytes,"encrypt");
  const data=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value));
  return "v1."+encode(iv)+"."+encode(new Uint8Array(data));
}
function money(m:unknown) {
  if(!m||typeof m!=="object")return null;
  const x=m as Record<string,unknown>;
  const amount=Number(x.amount),divisor=Number(x.divisor);
  if(!Number.isFinite(amount)||!Number.isFinite(divisor)||divisor<=0)return null;
  const currency=typeof x.currency_code==="string"?x.currency_code:"";
  if(!/^[A-Z]{3}$/.test(currency))return null;
  return {amount:Math.round((amount/divisor)*100)/100,currency};
}
function cleanListing(row:any) {
  const id=String(row.listing_id||"");
  if(!/^\d{1,20}$/.test(id))return null;
  const tags=Array.isArray(row.tags)?row.tags.filter((t:unknown)=>typeof t==="string").slice(0,13):[];
  const text=(v:unknown,max:number)=>typeof v==="string"?v.slice(0,max):"";
  return {
    id,title:text(row.title,300),description:text(row.description,5000),
    tags,url:text(row.url,500),price:money(row.price),
    state:text(row.state,30),quantity:Number.isFinite(row.quantity)?row.quantity:null,
    favorites:Number.isFinite(row.num_favorers)?row.num_favorers:null,
    listing_type:text(row.listing_type,40),
    created_at:Number.isFinite(row.created_timestamp)?row.created_timestamp:null,
    updated_at:Number.isFinite(row.updated_timestamp)?row.updated_timestamp:null,
  };
}
async function loadConnection(db:ReturnType<typeof admin>){
  const {data,error}=await db.from("etsy_shop_credentials")
    .select("shop_id,shop_name,etsy_user_id,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,scopes")
    .eq("brand_id",BRAND).maybeSingle();
  if(error||!data)throw Error("shop_not_connected");
  if(String(data.shop_name).toLowerCase()!=="laceleatherarcane"||!/^\d+$/.test(String(data.shop_id)))throw Error("shop_identity_mismatch");
  return data;
}
async function renew(db:ReturnType<typeof admin>,row:any,cfg:ReturnType<typeof credentials>){
  const refresh=await decrypt(row.refresh_token_encrypted,cfg.bytes);
  const res=await fetch("https://api.etsy.com/v3/public/oauth/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"refresh_token",client_id:cfg.id,refresh_token:refresh}),
    signal:AbortSignal.timeout(12000)
  });
  if(!res.ok)throw Error(res.status===401||res.status===400?"shop_reauthorization_required":"etsy_refresh_unavailable");
  const data=await res.json();
  if(typeof data.access_token!=="string"||typeof data.refresh_token!=="string")throw Error("etsy_refresh_unavailable");
  if(data.access_token.split(".")[0]!==String(row.etsy_user_id))throw Error("shop_identity_mismatch");
  const sec=Number(data.expires_in);
  if(!Number.isFinite(sec)||sec<60||sec>86400)throw Error("etsy_refresh_unavailable");
  const [access,refreshEncrypted]=await Promise.all([encrypt(data.access_token,cfg.bytes),encrypt(data.refresh_token,cfg.bytes)]);
  const expiry=new Date(Date.now()+sec*1000).toISOString();
  const {error}=await db.from("etsy_shop_credentials").update({
    access_token_encrypted:access,refresh_token_encrypted:refreshEncrypted,
    access_token_expires_at:expiry,updated_at:new Date().toISOString()
  }).eq("brand_id",BRAND);
  if(error)throw Error("credential_renewal_storage_failed");
  row.access_token_encrypted=access;
  row.refresh_token_encrypted=refreshEncrypted;
  row.access_token_expires_at=expiry;
  return data.access_token as string;
}

async function saved(client:ReturnType<typeof admin>){
  const {data,error}=await client.from("etsy_listing_audits")
    .select("listing_id,title,advertised_price,inventory_prices,file_metadata,file_count,file_count_complete,warnings,audited_at")
    .eq("brand_id",BRAND).order("title",{ascending:true});
  if(error)throw Error("audit_storage_unavailable");
  return data||[];
}
async function performAudit(){
  const client=admin();
  const cfg=credentials();
  const connection=await loadConnection(client);
  const {data:snap,error:snapshotError}=await client.from("etsy_shop_snapshots")
    .select("listings,listings_complete,synced_at").eq("brand_id",BRAND).maybeSingle();
  if(snapshotError||!snap||!Array.isArray(snap.listings)||!snap.listings.length)throw Error("sync_listings_first");
  if(!snap.listings_complete)throw Error("incomplete_listing_snapshot");
  if(snap.listings.length>100)throw Error("too_many_listings_for_audit");
  let token;
  if(new Date(connection.access_token_expires_at).getTime()<Date.now()+180000) token=await renew(client,connection,cfg);
  else token=await decrypt(connection.access_token_encrypted,cfg.bytes);
  async function get(path:string){
    const url=BASE+path;
    const build=()=>fetch(url,{method:"GET",headers:{
      "x-api-key":cfg.id+":"+cfg.shared,
      "Authorization":"Bearer "+token,
      "Accept":"application/json"
    },signal:AbortSignal.timeout(12000)});
    let res=await build();
    if(res.status===401){
      token=await renew(client,connection,cfg);
      res=await build();
    }
    if(!res.ok)throw Error("etsy_http_"+res.status);
    return await res.json();
  }
  const shopId=String(connection.shop_id);
  const output:any[]=[];
  for(const listing of snap.listings){
    const id=String(listing.id||"");
    if(!/^[0-9]{5,20}$/.test(id))continue;
    const warns:string[]=[];
    let fileMeta:any[]=[],fileCount:number|null=null,fileComplete=false;
    let inventoryPrices:any=null;
    try {
      const info=await get("/shops/"+shopId+"/listings/"+id+"/files");
      const files=Array.isArray(info?.results)?info.results:[];
      const count=Number(info?.count);
      if(!Number.isSafeInteger(count)||count<0)throw Error("unexpected_file_count");
      fileCount=count;
      fileComplete=count<=files.length;
      fileMeta=files.slice(0,6).map((f:any)=>({
        id:/^\d+$/.test(String(f.listing_file_id||""))?String(f.listing_file_id):null,
        filename:typeof f.filename==="string"?f.filename.slice(0,255):"",
        filetype:typeof f.filetype==="string"?f.filetype.slice(0,60):"",
        size_bytes:Number.isFinite(Number(f.size_bytes))?Number(f.size_bytes):null,
        rank:Number.isInteger(f.rank)?f.rank:null
      }));
      if(!fileComplete)warns.push("Etsy did not return metadata for all attached files.");
      if(count===0)warns.push("No downloadable files are attached.");
      if(count>=5)warns.push("This listing is at Etsy's five-file limit.");
      const filenames=new Set();
      for(const f of fileMeta){
        if((f.size_bytes||0)>20*1024*1024)warns.push("A reported file exceeds 20 MiB.");
        if(f.filename){
          const n=f.filename.toLowerCase();
          if(filenames.has(n))warns.push("Two attached files have the same filename.");
          filenames.add(n);
        }
      }
    } catch(e){
      warns.push("Could not inspect attachment metadata ("+(e instanceof Error?e.message:"request_failed")+").");
    }
    try {
      const inventory=await get("/listings/"+id+"/inventory");
      const products=Array.isArray(inventory?.products)?inventory.products:[];
      const prices:any[]=[];
      for(const p of products.slice(0,100)){
        for(const o of (Array.isArray(p.offerings)?p.offerings:[])){
          if(o?.is_deleted||o?.is_enabled===false)continue;
          const parsed=money(o.price);
          if(parsed)prices.push(parsed);
        }
      }
      const currencies=[...new Set(prices.map(p=>p.currency))];
      inventoryPrices={offerings_count:prices.length,currencies,
        min_price:currencies.length===1&&prices.length?Math.min(...prices.map(p=>p.amount)):null,
        max_price:currencies.length===1&&prices.length?Math.max(...prices.map(p=>p.amount)):null,
        currency:currencies.length===1?currencies[0]:null,
        varied:currencies.length!==1||new Set(prices.map(p=>p.amount)).size>1
      };
      if(currencies.length>1)warns.push("Inventory has multiple price currencies.");
      const advertised=listing.price;
      if(prices.length && currencies.length===1 && advertised?.currency===currencies[0] &&
        Number(advertised?.amount)>inventoryPrices.min_price+0.009){
        warns.push("Displayed price exceeds the lowest available offering price; review pricing configuration.");
      }
    } catch(e) {
      if(e instanceof Error && e.message==="etsy_http_404")
        warns.push("Inventory records not available; use the listing price as the current reference.");
      else warns.push("Could not inspect inventory prices ("+(e instanceof Error?e.message:"request_failed")+").");
    }
    output.push({
      brand_id:BRAND,listing_id:id,
      title:String(listing.title||"").slice(0,300),
      advertised_price:listing.price||null,
      inventory_prices:inventoryPrices,
      file_metadata:fileMeta,file_count:fileCount,file_count_complete:fileComplete,
      warnings:[...new Set(warns)],audited_at:new Date().toISOString()
    });
  }
  if(!output.length)throw Error("no_listings_to_audit");
  const {error}=await client.from("etsy_listing_audits").upsert(output,{onConflict:"brand_id,listing_id"});
  if(error)throw Error("audit_storage_unavailable");
  return output.map(({brand_id,...row})=>row);
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
  if(req.method!=="POST")return answer(req,{error:"method_not_allowed"},405);
  if(req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN)
    return answer(req,{error:"origin_denied"},403);
  try{
    await authorize(req);
    const body=await req.json().catch(()=>({}));
    if(body.action==="saved")return answer(req,{rows:await saved(admin())});
    if(body.action==="audit")return answer(req,{rows:await performAudit()});
    return answer(req,{error:"invalid_action"},400);
  }catch(e){
    const error=e instanceof Error?e.message:"unknown";
    const known=["not_authorized","shop_not_connected","shop_identity_mismatch",
      "shop_reauthorization_required","bridge_configuration_missing","etsy_refresh_unavailable",
      "credential_renewal_storage_failed","audit_storage_unavailable","sync_listings_first",
      "incomplete_listing_snapshot","too_many_listings_for_audit","no_listings_to_audit"];
    if(!known.includes(error))console.error("Etsy listing audit error:",error);
    return answer(req,{error:known.includes(error)?error:"audit_failed"},
      error==="not_authorized"?403: error==="sync_listings_first"?409:502);
  }
});
