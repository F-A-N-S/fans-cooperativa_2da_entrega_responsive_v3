import { redirectToLogin } from './api.js';
export async function adminLogin(email, password){
  const u = new URL(window.API_AUTH, location.origin); u.searchParams.set('action','admin_login');
  const r = await fetch(u.toString(), { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({email,password}) });
  const t = await r.text(); let d; try{ d=JSON.parse(t);}catch(_){ throw new Error('Respuesta no JSON: '+t); }
  if(!r.ok || !d.ok) throw new Error(d.error||'Login failed');
  try{ localStorage.setItem('fans_token', d.token); localStorage.setItem('token', d.token);}catch(_){}
  try{ const sso = new URL(window.API_AUTH, location.origin); sso.searchParams.set('action','admin_sso_from_token'); sso.searchParams.set('token', d.token); await fetch(sso.toString(), { credentials:'include' }); }catch(_){}
  location.href = 'backoffice.html';
}
export async function logout(){
  try{ const u=new URL(window.API_AUTH, location.origin); u.searchParams.set('action','logout'); await fetch(u.toString(), { credentials:'include' }); }catch(_){}
  try{ localStorage.removeItem('fans_token'); localStorage.removeItem('token'); }catch(_){}
  redirectToLogin();
}