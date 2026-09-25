// Future adapters must validate every row and call the same owner-authorized
// product command; never write unchecked rows directly into the catalog.
export type ImportFormat='csv'|'xlsx'|'xml'|'yml';
export interface ImportRow {name:string;category:string;sku:string;price:number;quantity:number;imageUrls:string[];published:boolean}
export interface ImportIssue {row:number;field:keyof ImportRow;message:string}
export interface ImportPreview {format:ImportFormat;rows:ImportRow[];issues:ImportIssue[]}
