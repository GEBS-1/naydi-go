// No advertising partner or checkout is connected. Never delay search for an empty slot.
export const plans={Free:{ads:false,photoPerHour:3,planningPerHour:3},Plus:{ads:false,photoPerHour:10,planningPerHour:10},Pro:{ads:false,photoPerHour:20,planningPerHour:20}} as const;
// Pending server-side buyer identity and atomic spending ledger; NOT enforcement.
export const buyerTrialPolicy={scope:'lifetime',searches:10,proPriceKopecks:14900,proSearches:100,proDays:30,autoRenew:false} as const;
export const activePlan=plans.Free;
