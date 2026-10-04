import type {PlanItem} from './discovery';
export function itemsFromTask(task:string):PlanItem[]{
 const list=task.replace(/(?:до|бюджет)\s*\d[\d\s]*\s*(?:рублей|руб|₽)?/giu,'').replace(/^(найди|купи|нужны|нужно|купить)\s+/iu,'').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
 if(list.length<2)return [];
 return list.slice(0,30).map(name=>({id:crypto.randomUUID(),name:name.slice(0,200),query:name.slice(0,200),category:'Другое',note:'Количество задаётся пользователем',enabled:true,quantity:1}));
}
export function refineItems(items:PlanItem[],message:string){
 const remove=message.match(/^(?:убери|удали)\s+(.+)$/iu)?.[1]||message.match(/^(.+?)\s+уже есть[.!]?$/iu)?.[1];
 if(!remove)return null;const value=remove.trim().toLowerCase();return items.filter(x=>!x.name.toLowerCase().includes(value));
}
export function listTotal(items:PlanItem[]){let known=0,unknown=0;for(const item of items.filter(x=>x.enabled)){const price=item.selected?.price;if(price==null||!item.selected?.source){unknown++;continue;}known+=price*(item.quantity??1);}return {known,unknown};}
