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
async function snapshot(db:ReturnType<typeof admin>){
  const {data,error}=await db.from("etsy_shop_snapshots").select(
    "shop_id,shop_name,listings_total,listings,listings_complete,sales_30d,warnings,synced_at"
  ).eq("brand_id",BRAND).maybeSingle();
  if(error)throw Error("snapshot_unavailable");
  return data;
}
async function sync(){
  const db=admin(),cfg=credentials();
  const connection=await loadConnection(db);
  const old=await snapshot(db);
  let token:string;
  if(new Date(connection.access_token_expires_at).getTime() < Date.now()+180000){
    token=await renew(db,connection,cfg);
  }else{
    token=await decrypt(connection.access_token_encrypted,cfg.bytes);
  }
  async function get(path:string){
    const res=await fetch(BASE+path,{headers:{
      "x-api-key":cfg.id+":"+cfg.shared,"Authorization":"Bearer "+token,"Accept":"application/json"
    },signal:AbortSignal.timeout(12000)});
    if(res.status===401){
      token=await renew(db,connection,cfg);
      const retried=await fetch(BASE+path,{headers:{
        "x-api-key":cfg.id+":"+cfg.shared,"Authorization":"Bearer "+token,"Accept":"application/json"
      },signal:AbortSignal.timeout(12000)});
      if(!retried.ok)throw Error("etsy_http_"+retried.status);
      return retried.json();
    }
    if(!res.ok)throw Error("etsy_http_"+res.status);
    return res.json();
  }
  const shopId=String(connection.shop_id);
  let listings:any[]=old?.listings||[],listingsTotal=old?.listings_total??null;
  let listingsComplete=old?.listings_complete||false;
  let sales=old?.sales_30d||null;
  const warnings:string[]=[];
  let successes=0;
  try{
    let raw:any[]=[];let expected=0;
    for(let offset=0;offset<400;offset+=100){
      const batch=await get("/shops/"+shopId+"/listings?state=active&limit=100&offset="+offset);
      const entries=Array.isArray(batch.results)?batch.results:[];
      expected=Number.isFinite(batch.count)?batch.count:entries.length;
      raw.push(...entries);
      if(!entries.length||raw.length>=expected||entries.length<100)break;
    }
    listings=raw.filter(r=>r.state==="active").map(cleanListing).filter(Boolean);
    listingsTotal=listings.length;
    listingsComplete=raw.length>=expected;
    if(!listingsComplete)warnings.push("Listing report is limited to the first 400 records.");
    successes++;
  }catch(e){
    const reason=e instanceof Error?e.message:"unavailable";
    warnings.push("Listings could not be refreshed ("+reason+").");
  }
  try{
    const start=Math.floor((Date.now()-30*86400000)/1000);
    let receipts:any[]=[];let expected=0;
    for(let offset=0;offset<300;offset+=100){
      const batch=await get("/shops/"+shopId+"/receipts?was_paid=true&was_canceled=false&min_created="+start+"&sort_on=created&sort_order=desc&limit=100&offset="+offset);
      const entries=Array.isArray(batch.results)?batch.results:[];
      expected=Number.isFinite(batch.count)?batch.count:entries.length;
      receipts.push(...entries);
      if(!entries.length||receipts.length>=expected||entries.length<100)break;
    }
    const complete=receipts.length>=expected;
    const valid=receipts.filter(r=>r.was_paid!==false&&r.was_canceled!==true&&!["canceled","fully_refunded"].includes(String(r.status||"").toLowerCase()));
    let cents=0,currency="",known=0,mixed=false;
    for(const r of valid){
      const sub=money(r.subtotal);
      if(!sub)continue;
      if(currency&&currency!==sub.currency){mixed=true;continue;}
      currency=sub.currency;known++;cents+=Math.round(sub.amount*100);
    }
    sales={
      period_days:30,paid_orders:valid.length,
      subtotal_amount:mixed||known!==valid.length?null:Math.round(cents)/100,
      currency:currency||null,
      orders_with_subtotals:known,
      subtotal_excludes:"tax,shipping; not adjusted for Etsy fees or all refunds",
      complete,
    };
    if(!complete)warnings.push("Sales report is limited to the first 300 receipts.");
    if(mixed||known!==valid.length)warnings.push("Some receipts had missing or mixed-currency subtotals.");
    successes++;
  }catch(e){
    const reason=e instanceof Error?e.message:"unavailable";
    warnings.push("Sales could not be refreshed ("+reason+").");
  }
  if(!successes)throw Error("etsy_data_unavailable");
  const payload={
    brand_id:BRAND,shop_id:shopId,shop_name:connection.shop_name,
    listings_total:listingsTotal,listings,listings_complete:listingsComplete,
    sales_30d:sales,warnings,synced_at:new Date().toISOString()
  };
  const {error}=await db.from("etsy_shop_snapshots").upsert(payload,{onConflict:"brand_id"});
  if(error)throw Error("snapshot_storage_failed");
  return payload;
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
  if(req.method!=="POST")return answer(req,{error:"method_not_allowed"},405);
  if(req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN)return answer(req,{error:"origin_denied"},403);
  try{
    await authorize(req);
    const input=await req.json().catch(()=>({}));
    if(input.action==="cached"){
      const data=await snapshot(admin());
      return answer(req,{connected:true,snapshot:data});
    }
    if(input.action==="sync"){
      const data=await sync();
      return answer(req,{connected:true,snapshot:data});
    }
    return answer(req,{error:"invalid_action"},400);
  }catch(e){
    const msg=e instanceof Error?e.message:"unknown";
    const known=["not_authorized","shop_not_connected","shop_identity_mismatch","shop_reauthorization_required","bridge_configuration_missing","etsy_refresh_unavailable","credential_renewal_storage_failed","etsy_data_unavailable","snapshot_unavailable","snapshot_storage_failed"];
    const error=known.includes(msg)?msg:msg.startsWith("etsy_http_")?msg:"server_unavailable";
    if(error==="server_unavailable")console.error("Etsy read-only sync internal error");
    return answer(req,{error},error==="not_authorized"?403:error==="shop_not_connected"?404:502);
  }
});