import {z} from 'zod';
const Schema=z.object({
 PORT:z.coerce.number().int().min(1).max(65535).default(3000),
 HOST:z.string().min(1).default('0.0.0.0'),
 NODE_ENV:z.enum(['development','production','test']).default('development'),
 LOG_LEVEL:z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'),
 ALLOWED_ORIGINS:z.string().default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000'),
 MAX_CONNECTIONS_PER_IP:z.coerce.number().int().min(1).max(1000).default(8),
 MAX_ROOMS:z.coerce.number().int().min(2).max(1000).default(10),
 MAX_PLAYERS_PER_ROOM:z.coerce.number().int().min(1).max(64).default(8),
});
const result=Schema.safeParse(process.env);
if(!result.success)throw new Error(`Invalid server environment: ${result.error.message}`);
if(result.data.NODE_ENV==='production' && !process.env.ALLOWED_ORIGINS){
 throw new Error('ALLOWED_ORIGINS is required in production');
}
export const config={port:result.data.PORT,host:result.data.HOST,nodeEnv:result.data.NODE_ENV,
 logLevel:result.data.LOG_LEVEL,
 allowedOrigins:result.data.ALLOWED_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean),
 maxConnectionsPerIp:result.data.MAX_CONNECTIONS_PER_IP,maxRooms:result.data.MAX_ROOMS,
 maxPlayersPerRoom:result.data.MAX_PLAYERS_PER_ROOM};
