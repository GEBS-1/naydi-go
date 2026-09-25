import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw new Error('База данных недоступна');return env.DB;}
export function bucket(){if(!env.BUCKET)throw new Error('Хранилище фотографий недоступно');return env.BUCKET;}
