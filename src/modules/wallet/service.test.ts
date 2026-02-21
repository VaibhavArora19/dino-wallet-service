import { describe, it, expect, mock, beforeEach } from "bun:test";

// --- tx mock (inner transaction object) ---
const txExecute = mock(async () => [] as any[]);
const txReturning = mock(
  async () =>
    [
      {
        id: "tx-1",
        type: "topup",
        amount: "100",
        asset_id: "asset-1",
        idempotency_key: "key-1",
      },
    ] as any[],
);
const txValues = mock(() => ({ returning: txReturning }));
const txInsert = mock(() => ({ values: txValues }));
const txUpdate = mock(() => ({
  set: mock(() => ({ where: mock(async () => {}) })),
}));

const txMock = { execute: txExecute, insert: txInsert, update: txUpdate };

// --- db mock ---
const findFirstWallet = mock(async () => null as any);
const findFirstTransaction = mock(async () => null as any);
const dbTransaction = mock(async (cb: (tx: typeof txMock) => any) =>
  cb(txMock),
);

// Chainable select mock (used by verifyBalance)
const dbSelectWhere = mock(async () => [{ ledgerBalance: "100" }] as any[]);
const dbSelectFrom = mock(() => ({ where: dbSelectWhere }));
const dbSelect = mock(() => ({ from: dbSelectFrom }));

const dbMock = {
  query: {
    wallets: { findFirst: findFirstWallet },
    transactions: { findFirst: findFirstTransaction },
  },
  transaction: dbTransaction,
  select: dbSelect,
};

// --- redis mock ---
const redisGet = mock(async () => null as string | null);
const redisSet = mock(async () => "OK");

// Register module mocks (Bun hoists these above imports)
mock.module("../../db", () => ({ db: dbMock }));
mock.module("../../lib/redis", () => ({
  redis: { get: redisGet, set: redisSet },
}));
mock.module("../../config", () => ({
  config: { wallet: { treasuryWalletId: "treasury-wallet-id" } },
}));

// Dynamic import AFTER mock setup so factories resolve against initialized objects
const { WalletService } = await import("./service");
const service = new WalletService();

const WALLET_ID = "wallet-123";
const IDEMPOTENCY_KEY = "idem-key-1";

beforeEach(() => {
  findFirstWallet.mockReset();
  findFirstTransaction.mockReset();
  dbTransaction.mockReset();
  dbTransaction.mockImplementation(async (cb) => cb(txMock));
  txExecute.mockReset();
  txExecute.mockResolvedValue([]); // safe default: no rows
  redisGet.mockReset();
  redisGet.mockResolvedValue(null);
  redisSet.mockReset();
  redisSet.mockResolvedValue("OK");
});

// ---------------------------------------------------------------------------
describe("WalletService.getBalance", () => {
  it("returns wallet data when wallet exists", async () => {
    const wallet = {
      id: WALLET_ID,
      balance: "100",
      asset_id: "asset-1",
      type: "user",
    };
    findFirstWallet.mockResolvedValueOnce(wallet);

    const result = await service.getBalance(WALLET_ID);

    expect(result).toEqual(wallet);
  });

  it("throws 404 when wallet is not found", async () => {
    findFirstWallet.mockResolvedValueOnce(null);

    await expect(service.getBalance("nonexistent")).rejects.toMatchObject({
      message: "Wallet not found",
      statusCode: 404,
    });
  });
});

// ---------------------------------------------------------------------------
describe("WalletService.topUp", () => {
  it("returns cached result when idempotency key exists", async () => {
    const cached = { id: "tx-cached", type: "topup" };
    redisGet.mockResolvedValueOnce(JSON.stringify(cached));

    const result = await service.topUp(WALLET_ID, IDEMPOTENCY_KEY, 100);

    expect(result).toEqual(cached);
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it("throws 404 when wallet is not found", async () => {
    // txExecute returns [] → wallet undefined → WalletError
    await expect(
      service.topUp(WALLET_ID, IDEMPOTENCY_KEY, 100),
    ).rejects.toMatchObject({
      message: "Wallet not found",
      statusCode: 404,
    });
  });

  it("throws 422 when treasury has insufficient funds", async () => {
    txExecute
      .mockResolvedValueOnce([
        { id: WALLET_ID, asset_id: "asset-1", balance: "500" },
      ])
      .mockResolvedValueOnce([{ id: "treasury-wallet-id", balance: "50" }]); // 50 < 100

    await expect(
      service.topUp(WALLET_ID, IDEMPOTENCY_KEY, 100),
    ).rejects.toMatchObject({
      message: "Treasury insufficient funds",
      statusCode: 422,
    });
  });

  it("creates transaction and caches idempotency key on success", async () => {
    txExecute
      .mockResolvedValueOnce([
        { id: WALLET_ID, asset_id: "asset-1", balance: "500" },
      ])
      .mockResolvedValueOnce([{ id: "treasury-wallet-id", balance: "1000" }]);

    const result = await service.topUp(WALLET_ID, IDEMPOTENCY_KEY, 100);

    expect(dbTransaction).toHaveBeenCalledTimes(1);
    expect(redisSet).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: "tx-1" });
  });
});

// ---------------------------------------------------------------------------
describe("WalletService.spend", () => {
  it("returns cached result when idempotency key exists", async () => {
    const cached = { id: "tx-cached", type: "spend" };
    redisGet.mockResolvedValueOnce(JSON.stringify(cached));

    const result = await service.spend(WALLET_ID, IDEMPOTENCY_KEY, 100);

    expect(result).toEqual(cached);
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it("throws 422 when wallet has insufficient funds", async () => {
    txExecute.mockResolvedValueOnce([
      { id: WALLET_ID, asset_id: "asset-1", balance: "50" },
    ]); // 50 < 100

    await expect(
      service.spend(WALLET_ID, IDEMPOTENCY_KEY, 100),
    ).rejects.toMatchObject({
      message: "Insufficient funds",
      statusCode: 422,
    });
  });

  it("creates transaction and caches idempotency key on success", async () => {
    txExecute.mockResolvedValueOnce([
      { id: WALLET_ID, asset_id: "asset-1", balance: "500" },
    ]);
    // second tx.execute (treasury lock) falls through to default []

    const result = await service.spend(WALLET_ID, IDEMPOTENCY_KEY, 100);

    expect(dbTransaction).toHaveBeenCalledTimes(1);
    expect(redisSet).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: "tx-1" });
  });
});

// ---------------------------------------------------------------------------
describe("WalletService.verifyBalance", () => {
  it("reports in-sync when stored balance matches ledger", async () => {
    findFirstWallet.mockResolvedValueOnce({ id: WALLET_ID, balance: "100" });
    dbSelectFrom.mockReturnValueOnce({
      where: async () => [{ ledgerBalance: "100" }],
    });

    const result = await service.verifyBalance(WALLET_ID);

    expect(result.isInSync).toBe(true);
    expect(result.storedBalance).toBe(100);
    expect(result.ledgerBalance).toBe(100);
  });

  it("reports out-of-sync when balances differ", async () => {
    findFirstWallet.mockResolvedValueOnce({ id: WALLET_ID, balance: "100" });
    dbSelectFrom.mockReturnValueOnce({
      where: async () => [{ ledgerBalance: "90" }],
    });

    const result = await service.verifyBalance(WALLET_ID);

    expect(result.isInSync).toBe(false);
    expect(result.storedBalance).toBe(100);
    expect(result.ledgerBalance).toBe(90);
  });

  it("throws 404 when wallet is not found", async () => {
    findFirstWallet.mockResolvedValueOnce(null);

    await expect(service.verifyBalance("nonexistent")).rejects.toMatchObject({
      message: "Wallet not found",
      statusCode: 404,
    });
  });
});
