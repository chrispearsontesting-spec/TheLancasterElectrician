/* Wallet unlock: Capacitor biometrics (if a plugin is present), else WebAuthn
   platform authenticator, else the existing Driv3Lock PIN. Re-locks after
   leaving the wallet or after 2 minutes. Does not change gt.lock keys. */
(function(root){
  "use strict";
  var SS_KEY="d3.walletUnlock", WA_KEY="d3.walletPasskey" /* not gt.*: a passkey id is per-phone, so it must stay out of .driv3 backups */, TTL=2*60*1000;
  var ls=root.localStorage, ss=root.sessionStorage;
  try{ ls.removeItem("gt.wallet.webauthn"); }catch(e){}

  function now(){ return Date.now(); }
  function unlocked(){
    var t=+ss.getItem(SS_KEY)||0;
    if(!t) return false;
    if(now()-t>TTL){ ss.removeItem(SS_KEY); return false; }
    return true;
  }
  function markUnlocked(){ ss.setItem(SS_KEY,String(now())); }
  function lock(){ ss.removeItem(SS_KEY); }

  function capPlugin(){
    try{
      if(!root.Capacitor||!root.Capacitor.Plugins) return null;
      if(root.Capacitor.isNativePlatform && !root.Capacitor.isNativePlatform()) return null;
      var P=root.Capacitor.Plugins;
      return P.Driv3Biometric||P.NativeBiometric||P.BiometricAuth||P.Biometric||null;
    }catch(e){ return null; }
  }
  async function capAvailable(){
    var p=capPlugin(); if(!p) return false;
    try{
      if(typeof p.isAvailable==="function"){
        var r=await p.isAvailable();
        if(r&&typeof r==="object") return !!(r.isAvailable||r.available||r.has===true);
        return !!r;
      }
      if(typeof p.checkBiometry==="function"){
        var b=await p.checkBiometry();
        return !!(b&&(b.isAvailable||b.strongBiometryIsAvailable||b.biometryType));
      }
      return true;
    }catch(e){ return false; }
  }
  async function capUnlock(){
    var p=capPlugin(); if(!p) return false;
    try{
      if(typeof p.verifyIdentity==="function"){
        /* Android's own BiometricPrompt: face or fingerprint, phone PIN/pattern/password as fallback. */
        await p.verifyIdentity({reason:"Unlock Wallet",title:"Unlock Wallet",subtitle:"Trac3"});
        return true;
      }
      if(typeof p.authenticate==="function"){
        await p.authenticate({reason:"Unlock your Trac3 Wallet"});
        return true;
      }
    }catch(e){ return false; }
    return false;
  }

  function b64(buf){
    var u=buf instanceof ArrayBuffer?new Uint8Array(buf):buf, s="";
    for(var i=0;i<u.length;i++) s+=String.fromCharCode(u[i]);
    return btoa(s);
  }
  function unb64(s){ return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)}).buffer; }
  function waOk(){
    return !!(root.PublicKeyCredential && navigator.credentials && window.isSecureContext);
  }
  function waStored(){
    try{ return JSON.parse(ls.getItem(WA_KEY)||"null"); }catch(e){ return null; }
  }
  async function waPlatform(){
    if(!waOk()||!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    try{ return !!await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }catch(e){ return false; }
  }
  async function waEnroll(){
    var cred=await navigator.credentials.create({
      publicKey:{
        challenge:crypto.getRandomValues(new Uint8Array(32)),
        rp:{name:"Trac3",id:location.hostname},
        user:{id:crypto.getRandomValues(new Uint8Array(16)),name:"trac3-wallet",displayName:"Trac3 Wallet"},
        pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
        authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",residentKey:"preferred"},
        timeout:60000
      }
    });
    if(!cred) throw new Error("Cancelled");
    ls.setItem(WA_KEY, JSON.stringify({id:b64(cred.rawId),at:Date.now()}));
    return true;
  }
  async function waGet(){
    var st=waStored(), allow=[];
    if(st&&st.id) allow.push({type:"public-key",id:unb64(st.id),transports:["internal"]});
    var cred=await navigator.credentials.get({
      publicKey:{
        challenge:crypto.getRandomValues(new Uint8Array(32)),
        rpId:location.hostname,
        allowCredentials:allow,
        userVerification:"required",
        timeout:60000
      }
    });
    return !!cred;
  }
  async function waUnlock(){
    if(!waOk()) return false;
    try{
      if(waStored()) return await waGet();
      if(await waPlatform()) return await waEnroll();
    }catch(e){ return false; }
    return false;
  }

  function pinOn(){ return !!(root.Driv3Lock && Driv3Lock.isOn && Driv3Lock.isOn()); }
  function pinUnlock(){
    return new Promise(function(res){
      if(!pinOn()){ res(false); return; }
      function done(){ root.removeEventListener("driv3:unlock", done); res(true); }
      root.addEventListener("driv3:unlock", done);
      try{ Driv3Lock.lockNow(); }catch(e){ root.removeEventListener("driv3:unlock", done); res(false); }
    });
  }

  async function canBio(){
    if(await capAvailable()) return {kind:"cap",label:"Unlock"};
    if(waOk() && (waStored() || await waPlatform())) return {kind:"webauthn",label:"Unlock"};
    if(pinOn()) return {kind:"pin",label:"Unlock with PIN"};
    return {kind:"none",label:"Unlock"};
  }
  /* A system unlock that just happened for the app lock (same sheet) counts for the wallet too. */
  function recentBio(){ var t=+ss.getItem("d3.bioAt")||0; return t && now()-t<15000; }

  /* Order: Android's own sheet (native app) > WebAuthn platform authenticator with
     userVerification "required" (Android Chrome shows the same face/fingerprint/screen-lock
     sheet) > the Trac3 PIN, which is only used when neither exists. Cancelling the
     system sheet does not drop to the PIN: the locked screen offers Unlock to try again. */
  async function unlock(){
    if(unlocked()){ markUnlocked(); return true; }
    if(recentBio()){ markUnlocked(); return true; }
    if(await capAvailable()){
      if(await capUnlock()){ markUnlocked(); return true; }
      return false;
    }
    /* WebAuthn: call it before any other await when we already have a passkey, so the
       tap that opened the Wallet still counts as the user gesture. */
    if(waOk() && waStored()){
      if(await waUnlock()){ markUnlocked(); return true; }
      return false;
    }
    var platform=false;
    try{ platform=await waPlatform(); }catch(e){}
    if(platform){
      if(await waUnlock()){ markUnlocked(); return true; }
      return false;
    }
    if(pinOn()){
      var ok=await pinUnlock();
      if(ok){ markUnlocked(); return true; }
      return false;
    }
    /* No fingerprint, WebAuthn or PIN is set up — don't block viewing, but the UI should nudge them to set a PIN. */
    markUnlocked();
    return true;
  }

  function touch(){ if(unlocked()) markUnlocked(); }

  /* Leaving the wallet page locks it. Stay unlocked only while wallet.html is open, up to TTL. */
  function guardPage(){
    if(!/wallet\.html/i.test(location.pathname||"")) return;
    document.addEventListener("visibilitychange",function(){
      if(document.visibilityState==="hidden"){ /* keep the timestamp; TTL handles it */ }
      else if(!unlocked()) lock();
    });
    root.addEventListener("pagehide",function(){ lock(); });
  }

  var api={
    TTL:TTL, unlocked:unlocked, unlock:unlock, lock:lock, touch:touch,
    canBio:canBio, capAvailable:capAvailable, waOk:waOk, waStored:waStored, pinOn:pinOn, guardPage:guardPage,
    /* true when unlock() would show a system sheet (native or a WebAuthn passkey on this phone) */
    systemSheet:async function(){ if(await capAvailable()) return true; if(waOk()&&waStored()) return true; return await waPlatform(); }
  };
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  else {
    root.D3WalletLock=api;
    if(root.document && /wallet\.html/i.test(location.pathname||"")){
      if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",guardPage);
      else guardPage();
    }
  }
})(typeof window!=="undefined"?window:globalThis);
