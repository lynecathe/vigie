import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Countdown, urgency } from "../components";

describe("Countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("décompte chaque seconde", () => {
    render(<Countdown dueAt="2026-11-19T10:00:00Z" />);
    expect(screen.getByRole("timer")).toHaveTextContent("72:00:00");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("timer")).toHaveTextContent("71:59:59");
  });

  it("affiche le dépassement une fois l'échéance passée", () => {
    render(<Countdown dueAt="2026-11-16T09:00:00Z" />);
    expect(screen.getByRole("timer")).toHaveTextContent("+01:00:00");
  });
});

describe("urgency", () => {
  const now = new Date("2026-11-16T10:00:00Z").getTime();
  it.each([
    ["2026-11-16T09:59:00Z", "retard"],
    ["2026-11-16T20:00:00Z", "urgent"],
    ["2026-11-18T10:00:00Z", "serein"],
  ])("%s → %s", (due, expected) => expect(urgency(due, now)).toBe(expected));
});
