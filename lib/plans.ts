// Future entitlements, not a checkout or a paywall. Basic search remains available to everyone.
export const plans={Free:{ads:true,photoPerHour:3,planningPerHour:3},Plus:{ads:false,photoPerHour:10,planningPerHour:10},Pro:{ads:false,photoPerHour:20,planningPerHour:20}} as const;
export const activePlan=plans.Free;
