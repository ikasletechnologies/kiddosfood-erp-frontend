import { describe, it, expect } from "vitest";
import { profitOf } from "../packaging-profit";

describe("profitOf", () => {
  it("₹140 against ₹155 cost → ₹15 loss per packet, ₹150 for 10", () => {
    expect(profitOf(155, 140, 10)).toEqual({
      perPacket: -15,
      total: -150,
      status: "LOSS",
      message: "Warning: Selling price is ₹15 below production cost per packet. Estimated loss for 10 packets: ₹150.",
    });
  });

  it("break-even at cost, profit above it", () => {
    expect(profitOf(155, 155, 10)).toMatchObject({ perPacket: 0, total: 0, status: "BREAK_EVEN", message: "Break-even" });
    expect(profitOf(155, 180, 10)).toMatchObject({ perPacket: 25, total: 250, status: "PROFIT" });
    expect(profitOf(155, 180, 10)!.message).toBe("Estimated profit ₹25 per packet · ₹250 for 10 packets");
  });

  it("keeps paise exact (₹193.75 cost, ₹180 price, 8 packets)", () => {
    expect(profitOf(193.75, 180, 8)).toMatchObject({ perPacket: -13.75, total: -110 });
    expect(profitOf(0.1 + 0.2, 0.6, 3)).toMatchObject({ perPacket: 0.3, total: 0.9 });
  });

  it("shows nothing without a cost, a valid price or good packets", () => {
    expect(profitOf(null, 140, 10)).toBeNull();
    expect(profitOf(155, 0, 10)).toBeNull();
    expect(profitOf(155, -1, 10)).toBeNull();
    expect(profitOf(155, NaN, 10)).toBeNull();
    expect(profitOf(155, 140, 0)).toBeNull();
  });
});
