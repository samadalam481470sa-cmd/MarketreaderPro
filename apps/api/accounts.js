import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const digest=t=>createHash('sha256').update(t).digest('hex');
const bad=(message,status=422)=>Object.assign(new Error(message),{status});
export async function hashPassword(password,salt=randomBytes(16).toString('hex')){
 if(typeof password!=='string'||password.length<12||password.length>128)throw bad('Password must be 12–128 characters');
 const key=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 return 'scrypt$'+salt+'$'+key.toString('hex');
}
export async function verifyPassword(password,stored){
 if(typeof password!=='string'||!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored||''))return false;
 const [,salt,hex]=stored.split('$');const expected=Buffer.from(hex,'hex');
 const actual=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 return timingSafeEqual(actual,expected);
}
export async function register(db,{email,password}){
 if(typeof email!=='string'||!email.includes('@')||email.length>254)throw bad('Invalid email');
 const normalized=email.trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))throw bad('Invalid email');
 const hash=await hashPassword(password);
 const c=await db.connect();try{
  await c.query('BEGIN');
  const result=await c.query('INSERT INTO app_users(email,password_hash) VALUES($1,$2) RETURNING id,email',[normalized,hash]);
  await c.query('INSERT INTO paper_accounts(user_id) VALUES($1)',[result.rows[0].id]);
  await c.query('COMMIT');return result.rows[0];
 }catch(e){await c.query('ROLLBACK');if(e.code==='23505')throw bad('Account already exists',409);throw e}finally{c.release()}
}
export async function login(db,{email,password}){
 if(typeof email!=='string'||typeof password!=='string')throw bad('Invalid credentials',401);
 const r=await db.query('SELECT id,email,password_hash FROM app_users WHERE email=$1',[email.trim().toLowerCase()]);
 if(!r.rows.length||!await verifyPassword(password,r.rows[0].password_hash))throw bad('Invalid credentials',401);
 const token=randomBytes(32).toString('base64url');
 await db.query("INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '12 hours')",[r.rows[0].id,digest(token)]);
 return {token,expiresInSeconds:43200,user:{id:r.rows[0].id,email:r.rows[0].email}};
}
export async function authenticate(db,authorization){
 const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization||'');
 if(!match)throw bad('Authentication required',401);
 const r=await db.query('SELECT s.id AS session_id,u.id,u.email FROM user_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[digest(match[1])]);
 if(!r.rows.length)throw bad('Session expired or invalid',401);
 return r.rows[0];
}
export async function logout(db,sessionId){await db.query('DELETE FROM user_sessions WHERE id=$1',[sessionId])}
export function validatePaperOrder(x){
 if(!x||typeof x!=='object'||Array.isArray(x))throw bad('Invalid order');
 const {symbol,side,quantity,priceCents,requestId}=x;
 if(typeof symbol!=='string'||!/^[A-Z0-9.-]{1,20}$/.test(symbol)||!['buy','sell'].includes(side)||!Number.isSafeInteger(quantity)||quantity<1||quantity>100000||!Number.isSafeInteger(priceCents)||priceCents<1||priceCents>100000000||typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw bad('Invalid paper order');
 const total=quantity*priceCents;if(!Number.isSafeInteger(total))throw bad('Order total too large');
 return {symbol,side,quantity,priceCents,requestId,total};
}
export async function paperOrder(db,userId,input){
 const o=validatePaperOrder(input);
 const c=await db.connect();
 try{
  await c.query('BEGIN');
  const previous=await c.query('SELECT * FROM paper_orders WHERE user_id=$1 AND request_id=$2',[userId,o.requestId]);
  if(previous.rows.length){await c.query('COMMIT');return {...previous.rows[0],duplicate:true}}
  const cash=await c.query('SELECT cash_cents FROM paper_accounts WHERE user_id=$1 FOR UPDATE',[userId]);
  if(!cash.rows.length)throw bad('Paper account missing',404);
  const pos=await c.query('SELECT quantity FROM paper_positions WHERE user_id=$1 AND symbol=$2 FOR UPDATE',[userId,o.symbol]);
  const held=Number(pos.rows[0]?.quantity??0),balance=Number(cash.rows[0].cash_cents);
  if(o.side==='buy'&&o.total>balance)throw bad('Insufficient simulated funds');
  if(o.side==='sell'&&o.quantity>held)throw bad('Insufficient simulated shares');
  const next=held+(o.side==='buy'?o.quantity:-o.quantity);
  const updated=balance+(o.side==='buy'?-o.total:o.total);
  await c.query('UPDATE paper_accounts SET cash_cents=$1 WHERE user_id=$2',[updated,userId]);
  await c.query('INSERT INTO paper_positions(user_id,symbol,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,symbol) DO UPDATE SET quantity=EXCLUDED.quantity',[userId,o.symbol,next]);
  const insert=await c.query('INSERT INTO paper_orders(user_id,symbol,side,quantity,price_cents,total_cents,request_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[userId,o.symbol,o.side,o.quantity,o.priceCents,o.total,o.requestId]);
  await c.query('COMMIT');return {...insert.rows[0],simulated:true};
 }catch(e){await c.query('ROLLBACK');if(e.code==='23505')throw bad('Retry order with same request ID',409);throw e}finally{c.release()}
}
export async function paperPortfolio(db,userId){
 const [a,p,o]=await Promise.all([
 db.query('SELECT cash_cents FROM paper_accounts WHERE user_id=$1',[userId]),
 db.query('SELECT symbol,quantity FROM paper_positions WHERE user_id=$1 AND quantity>0 ORDER BY symbol',[userId]),
 db.query('SELECT id,symbol,side,quantity,price_cents,total_cents,created_at FROM paper_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[userId])
 ]);
 return {mode:'simulation-only',cashCents:a.rows[0]?.cash_cents,positions:p.rows,orders:o.rows,note:'Orders use user-supplied simulation prices. No live execution or price verification.'};
}
