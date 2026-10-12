import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const project = Deno.env.get("SUPABASE_URL") || "";
const callback = project + "/functions/v1/etsy-oauth-callback";
const brandId = "956b245e-f60f-4e40-9d5b-0246d947ffb2";
const scopes = ["shops_r", "listings_r", "transactions_r"];
const origin = "https://theblackstaginn.github.io";
function key() {
  const str = Deno.env.get("SUPABASE_SECRET_KEYS");
  if(str) { try { const k=JSON.parse(str).default; if(k) return k; } catch {} }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function db() { return createClient(project,key(),{auth:{persistSession:false,autoRefreshToken:false}}); }
function cfg() {
  const id=Deno.env.get("ETSY_APP_KEYSTRING")||"";
  const secret=Deno.env.get("ETSY_APP_SHARED_SECRET")||"";
  const raw=Deno.env.get("ETSY_TOKEN_ENCRYPTION_KEY")||"";
  let bytes:Uint8Array;
  try { bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0)); }
  catch { throw Error("configuration_missing"); }
  if(!id||!secret||bytes.length!==32) throw Error("configuration_missing");
  return {id,secret,bytes};
}
function json(data:unknown,status=200,req?:Request) {
  const requestOrigin=req?.headers.get("origin");
  const allowed=requestOrigin===origin;
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store",...(allowed?{"access-control-allow-origin":origin,"vary":"Origin"}:{})}});
}
function page(ok:boolean,message:string,status=200) {
  return new Response("<!doctype html><meta charset='utf-8'><meta name='robots' content='noindex,nofollow'><meta name='referrer' content='no-referrer'><title>Black Stag Connection</title><body style='background:#191b19;color:#f5eddb;font:18px/1.6 Georgia,serif;margin:10vh auto;padding:30px;max-width:650px'><h1>"+(ok?"Shop linked":"Connection not completed")+"</h1><p>"+message+"</p><a style='color:#d2b78b' href='https://theblackstaginn.github.io/black-stag-marketing-studio/etsy-connect.html'>Back to connection page</a></body>",{status,headers:{"content-type":"text/html;charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"}});
}
function b64(data:Uint8Array) { return btoa(String.fromCharCode(...data)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
async function digest(input:string) { return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input))); }
async function hex(input:string) { return Array.from(await digest(input),b=>b.toString(16).padStart(2,"0")).join(""); }
async function seal(token:string,bytes:Uint8Array) {
  const cryptoKey=await crypto.subtle.importKey("raw",bytes,"AES-GCM",false,["encrypt"]);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const sealed=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},cryptoKey,new TextEncoder().encode(token)));
  return "v1."+b64(iv)+"."+b64(sealed);
}
async function owner(req:Request,client:ReturnType<typeof db>) {
  const token=/^Bearer (\S+)$/i.exec(req.headers.get("authorization")||"")?.[1];
  if(!token) return null;
  const {data:{user}}=await client.auth.getUser(token);
  if(!user) return null;
  const {data:brand}=await client.from("brands").select("owner_id").eq("id",brandId).single();
  if(brand?.owner_id===user.id) return user.id;
  const {data:member}=await client.from("brand_memberships").select("role").eq("brand_id",brandId).eq("user_id",user.id).maybeSingle();
  return member?.role==="owner"?user.id:null;
}
async function begin(req:Request) {
  const client=db(),who=await owner(req,client);
  if(!who) return json({error:"Sign in as a Lace & Leather owner in Marketing Studio."},403,req);
  const {id}=cfg();
  const state=b64(crypto.getRandomValues(new Uint8Array(32)));
  const verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
  const {error}=await client.from("etsy_oauth_attempts").insert({state_hash:await hex(state),brand_id:brandId,initiated_by:who,code_verifier:verifier,requested_scopes:scopes,expires_at:new Date(Date.now()+600000).toISOString()});
  if(error) return json({error:"Could not create a secure authorization request."},500,req);
  const url=new URL("https://www.etsy.com/oauth/connect");
  for(const [k,v] of Object.entries({response_type:"code",client_id:id,redirect_uri:callback,scope:scopes.join(" "),state,code_challenge:b64(await digest(verifier)),code_challenge_method:"S256"})) url.searchParams.set(k,v);
  return json({authorize_url:url.toString()},200,req);
}
async function status(req:Request) {
  const client=db(),who=await owner(req,client);
  if(!who) return json({error:"Sign in as a Lace & Leather owner in Marketing Studio."},403,req);
  const {data}=await client.from("etsy_shop_credentials").select("shop_name,shop_id,connected_at,scopes").eq("brand_id",brandId).maybeSingle();
  let configured=true;try{cfg()}catch{configured=false}
  return json({connected:!!data,shop:data,configured},200,req);
}
async function finish(url:URL) {
  const state=url.searchParams.get("state")||"";
  if(!/^[A-Za-z0-9_-]{43}$/.test(state)) return page(false,"Authorization state is invalid. Start again.",400);
  const client=db();
  const {data:rows,error}=await client.from("etsy_oauth_attempts").delete().eq("state_hash",await hex(state)).gt("expires_at",new Date().toISOString()).select();
  if(error||rows?.length!==1) return page(false,"Authorization expired or already used. Start again.",400);
  const attempt=rows[0];
  if(attempt.brand_id!==brandId) return page(false,"Brand mismatch.",403);
  if(url.searchParams.has("error")) return page(false,"Authorization was cancelled.",400);
  const code=url.searchParams.get("code")||"";
  if(!code||code.length>3000) return page(false,"Authorization code was missing.",400);
  const {data:brand}=await client.from("brands").select("owner_id").eq("id",brandId).maybeSingle();
  if(brand?.owner_id!==attempt.initiated_by) {
    const {data:member}=await client.from("brand_memberships").select("role").eq("brand_id",brandId).eq("user_id",attempt.initiated_by).maybeSingle();
    if(member?.role!=="owner") return page(false,"Authorization rights changed. Start again.",403);
  }
  const conf=cfg();
  const exchange=await fetch("https://api.etsy.com/v3/public/oauth/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:conf.id,redirect_uri:callback,code,code_verifier:attempt.code_verifier})});
  if(!exchange.ok) return page(false,"Etsy could not complete token exchange. Please restart.",502);
  const tok=await exchange.json();
  if(typeof tok.access_token!=="string"||typeof tok.refresh_token!=="string") return page(false,"Missing token data.",502);
  const userId=tok.access_token.split(".")[0];
  if(!/^\d+$/.test(userId)) return page(false,"Invalid Etsy account identifier.",502);
  const granted=String(tok.scope||"").split(/\s+/).filter(Boolean);
  if(!scopes.every(s=>granted.includes(s))) return page(false,"Not all requested read-only permissions were granted.",403);
  const shopResponse=await fetch("https://openapi.etsy.com/v3/application/users/"+userId+"/shops",{headers:{"x-api-key":conf.id+":"+conf.secret,"authorization":"Bearer "+tok.access_token}});
  if(!shopResponse.ok) return page(false,"Couldn't verify the Etsy shop.",502);
  const shop=await shopResponse.json();
  if(String(shop?.shop_name||"").toLowerCase()!=="laceleatherarcane"||String(shop?.user_id||"")!==userId||!shop?.shop_id) return page(false,"The authorized account does not own LaceLeatherArcane. Nothing was saved.",403);
  const seconds=Number(tok.expires_in);
  if(!Number.isFinite(seconds)||seconds<60||seconds>86400) return page(false,"Unexpected token expiry.",502);
  const [access,refresh]=await Promise.all([seal(tok.access_token,conf.bytes),seal(tok.refresh_token,conf.bytes)]);
  const {error:storeError}=await client.from("etsy_shop_credentials").upsert({brand_id:brandId,shop_id:String(shop.shop_id),shop_name:String(shop.shop_name),etsy_user_id:userId,access_token_encrypted:access,refresh_token_encrypted:refresh,scopes:granted,access_token_expires_at:new Date(Date.now()+seconds*1000).toISOString(),authorized_by:attempt.initiated_by,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"brand_id"});
  if(storeError) return page(false,"Unable to store the secure connection.",500);
  return page(true,"LaceLeatherArcane is connected with read-only access. No listings have been changed.");
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:{"access-control-allow-origin":req.headers.get("origin")===origin?origin:"null","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","vary":"Origin"}});
  try {
    if(req.method==="GET"){
      const url=new URL(req.url);
      if(url.searchParams.get("health")==="1") return json({status:"online"});
      return await finish(url);
    }
    if(req.method!=="POST")return json({error:"Method not allowed"},405,req);
    if(req.headers.get("origin") && req.headers.get("origin")!==origin)return json({error:"Origin rejected"},403,req);
    const payload=await req.json().catch(()=>({}));
    if(payload.action==="start") return await begin(req);
    if(payload.action==="status") return await status(req);
    return json({error:"Invalid action"},400,req);
  }catch(e){
    const m=e instanceof Error?e.message:"unknown";
    console.error("Etsy bridge error",m);
    if(req.method==="GET")return page(false,"The connection is not ready. Check the secure server configuration.",503);
    return json({error:m==="configuration_missing"?"Etsy server secrets are not configured.":"Connection failed."},503,req);
  }
});