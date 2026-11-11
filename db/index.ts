import {env} from '@/lib/server-env';
export function db(){if(!env.DB)throw new Error('База данных недоступна');return env.DB;}
export function bucket(){if(!env.BUCKET)throw new Error('Хранилище фотографий недоступно');return env.BUCKET;}
