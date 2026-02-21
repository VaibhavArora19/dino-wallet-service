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
  it("returns user when found", async () => {
    const user = { id: "user-1", name: "Alice", email: "alice@example.com" };
    findFirstUser.mockResolvedValueOnce(user);

    const result = await service.getUserByEmail("alice@example.com");

    expect(result).toEqual(user);
  });

  it("throws 404 when user is not found", async () => {
    findFirstUser.mockResolvedValueOnce(null);

    await expect(service.getUserByEmail("notfound@example.com")).rejects.toMatchObject({
      message: "User not found",
      statusCode: 404,
    });
  });
});
