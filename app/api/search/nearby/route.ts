// Compatibility for open tabs from before shared search suggestions were retired.
export function POST(){return Response.json({items:[]},{headers:{'Cache-Control':'no-store'}});}
