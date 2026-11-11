export type ChatThread={id:string;productId:string|null;productName:string;photoUrl:string;city:string;role:'buyer'|'seller';otherName:string;updatedAt:number;lastText?:string;unread?:number;available?:boolean};
export type ChatMessage={id:string;seq:number;text:string;mine:boolean;sentAt:number;readAt:number|null};
