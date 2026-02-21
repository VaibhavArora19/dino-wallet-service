import { describe, it, expect, mock, beforeEach } from "bun:test";

const findFirstUser = mock(async () => null as any);

const dbMock = {
  query: {
    users: { findFirst: findFirstUser },
  },
};

mock.module("../../db", () => ({ db: dbMock }));

const { UserService } = await import("./service");
const service = new UserService();

beforeEach(() => {
  findFirstUser.mockReset();
});

describe("UserService.getUserByEmail", () => {
  it("returns user with wallets when found", async () => {
    const user = { id: "user-1", name: "Alice", email: "alice@example.com", wallets: [] };
    findFirstUser.mockResolvedValueOnce(user);

    const result = await service.getUserByEmail("alice@example.com");

    expect(result).toMatchObject(user);
  });

  it("throws 404 when user is not found", async () => {
    findFirstUser.mockResolvedValueOnce(null);

    await expect(service.getUserByEmail("notfound@example.com")).rejects.toMatchObject({
      message: "User not found",
      statusCode: 404,
    });
  });
});

describe("UserService.getUserById", () => {
  it("returns user with wallets when found", async () => {
    const user = {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      wallets: [{ id: "wallet-1", balance: "500" }],
    };
    findFirstUser.mockResolvedValueOnce(user);

    const result = await service.getUserById("user-1");

    expect(result).toMatchObject(user);
  });

  it("throws 404 when user is not found", async () => {
    findFirstUser.mockResolvedValueOnce(null);

    await expect(service.getUserById("nonexistent")).rejects.toMatchObject({
      message: "User not found",
      statusCode: 404,
    });
  });
});
