import { signInitData, validateInitData } from "./init-data.util";

const BOT_TOKEN = "123456:TEST-TOKEN";
const NOW = 1_800_000_000;

const buildInitData = (overrides: Record<string, string> = {}, token = BOT_TOKEN) => {
  const params = new URLSearchParams({
    auth_date: String(NOW - 60),
    query_id: "AAE",
    user: JSON.stringify({ id: 42, first_name: "Айдар", username: "aidar" }),
    ...overrides,
  });
  params.set("hash", signInitData(params, token));
  return params.toString();
};

describe("validateInitData", () => {
  it("accepts correctly signed data and returns the user", () => {
    expect(validateInitData(buildInitData(), BOT_TOKEN, NOW)).toEqual({
      id: 42,
      first_name: "Айдар",
      username: "aidar",
    });
  });

  it("rejects data signed with another bot token", () => {
    expect(validateInitData(buildInitData({}, "999:OTHER"), BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects tampered data", () => {
    const tampered = buildInitData().replace("%22id%22%3A42", "%22id%22%3A43");
    expect(validateInitData(tampered, BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects stale data", () => {
    const old = buildInitData({ auth_date: String(NOW - 2 * 24 * 60 * 60) });
    expect(validateInitData(old, BOT_TOKEN, NOW)).toBeNull();
  });

  it("rejects missing or malformed hash and missing user", () => {
    expect(validateInitData("auth_date=1&user=%7B%7D", BOT_TOKEN, NOW)).toBeNull();
    expect(validateInitData("hash=zz", BOT_TOKEN, NOW)).toBeNull();
    const params = new URLSearchParams({ auth_date: String(NOW) });
    params.set("hash", signInitData(params, BOT_TOKEN));
    expect(validateInitData(params.toString(), BOT_TOKEN, NOW)).toBeNull();
  });
});
