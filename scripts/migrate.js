import {getPool,migrate,closePool} from '../apps/api/database.js';
try {const count=await migrate(await getPool());console.log(JSON.stringify({message:'migrations_applied',available:count}))}
catch(e){console.error(JSON.stringify({message:'migration_failed',reason:e.message}));process.exitCode=1}
finally{await closePool()}
