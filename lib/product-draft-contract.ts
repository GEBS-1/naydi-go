import {z} from 'zod';
import {categories} from './model';

export const productDraftSchema=z.object({
 name:z.string().trim().min(2).max(200),
 category:z.enum(categories),
 brand:z.string().trim().max(200),
 model:z.string().trim().max(200),
 features:z.string().trim().max(4000),
 description:z.string().trim().max(4000),
 keywords:z.string().trim().max(1000)
}).strict();
export type ProductDraft=z.infer<typeof productDraftSchema>;
