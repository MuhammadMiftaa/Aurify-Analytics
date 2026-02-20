import { investmentType, walletType } from "../../utils/dto";

export function calculateNetWorthCompositions(
  wallets: walletType[],
  investments: investmentType[],
): Map<string, any> {
  const compositions = new Map<string, any>();

  // Group by user
  const userWallets = new Map<string, walletType[]>();
  const userInvestments = new Map<string, investmentType[]>();

  wallets.forEach((w) => {
    if (!userWallets.has(w.user_id)) {
      userWallets.set(w.user_id, []);
    }
    userWallets.get(w.user_id)!.push(w);
  });

  investments.forEach((inv) => {
    if (!userInvestments.has(inv.userId)) {
      userInvestments.set(inv.userId, []);
    }
    userInvestments.get(inv.userId)!.push(inv);
  });

  // Get all unique users
  const allUsers = new Set([...userWallets.keys(), ...userInvestments.keys()]);

  allUsers.forEach((userId) => {
    const walletsList = userWallets.get(userId) || [];
    const investmentsList = userInvestments.get(userId) || [];

    // Calculate wallet totals
    const walletTotal = walletsList.reduce((sum, w) => sum + w.balance, 0);

    // Group wallets by type
    const walletsByType = new Map<string, number>();
    walletsList.forEach((w) => {
      const type = w.wallet_type_name || w.wallet_type || "Other";
      walletsByType.set(type, (walletsByType.get(type) || 0) + w.balance);
    });

    // Calculate investment totals
    let investmentTotal = 0;
    let unrealizedGain = 0;

    const investmentsByType = new Map<
      string,
      { total: number; gain: number }
    >();
    investmentsList.forEach((inv) => {
      const currentValue = inv.quantity * inv.assetCode.toIDR;
      investmentTotal += currentValue;
      const gain = currentValue - inv.amount;
      unrealizedGain += gain;

      const type = inv.assetCode.name || inv.code;
      if (!investmentsByType.has(type)) {
        investmentsByType.set(type, { total: 0, gain: 0 });
      }
      const typeData = investmentsByType.get(type)!;
      typeData.total += currentValue;
      typeData.gain += gain;
    });

    const total = walletTotal + investmentTotal;

    // Build slices
    const slices: any[] = [];

    // Wallet slices
    if (walletTotal > 0) {
      const walletDetails: Record<string, number> = {};
      walletsByType.forEach((amount, type) => {
        walletDetails[type] = amount;
      });

      slices.push({
        Label: "Cash & Bank Accounts",
        Amount: walletTotal,
        Percentage: total > 0 ? (walletTotal / total) * 100 : 0,
        Details: {
          ItemCount: walletsList.length,
          Description: `${walletsList.length} wallet(s)`,
          ...walletDetails,
        },
      });
    }

    // Investment slices
    if (investmentTotal > 0) {
      const investmentDetails: Record<string, number> = {};
      investmentsByType.forEach((data, type) => {
        investmentDetails[type] = data.total;
      });

      slices.push({
        Label: "Investments",
        Amount: investmentTotal,
        Percentage: total > 0 ? (investmentTotal / total) * 100 : 0,
        Details: {
          ItemCount: investmentsList.length,
          Description: `${investmentsList.length} investment(s)`,
          UnrealizedGain: unrealizedGain,
          ...investmentDetails,
        },
      });
    }

    compositions.set(userId, {
      UserID: userId,
      Total: total,
      Slices: slices,
    });
  });

  return compositions;
}
