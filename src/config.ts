const required = (key: string): string => {
  const value = Bun.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const config = {
  db: {
    url: required("DATABASE_URL"),
  },
  redis: {
    url: required("REDIS_URL"),
  },
  wallet: {
    treasuryWalletId: required("TREASURY_WALLET_ID"),
  },
};
