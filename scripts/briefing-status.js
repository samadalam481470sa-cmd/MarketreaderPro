import {getPool,closePool} from '../apps/api/database.js';
try{const db=await getPool();const r=await db.query('SELECT briefing_date,generated_at,body FROM daily_briefings ORDER BY briefing_date DESC LIMIT 1');console.log(JSON.stringify(r.rows[0]||{status:'no-briefing-generated'}))}finally{await closePool()}
