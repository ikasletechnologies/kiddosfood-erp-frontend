import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ChatThread from "../ChatThread";
import ChatLauncher from "../ChatLauncher";
import { FRANCHISE_QUICK_QUESTIONS } from "@/lib/chat-quick-questions";

const mocks = vi.hoisted(() => ({
  role: "FRANCHISE_ADMIN", enabled: true, totalUnread: 0, pathname: "/franchise/dashboard",
  send: vi.fn(), markRead: vi.fn(), setActiveConversation: vi.fn(),
  subscribe: vi.fn(() => () => {}), getMessages: vi.fn(),
}));
vi.mock("@/context/ChatContext", () => ({ useChat: () => ({ ...mocks, connected: true, userId: "user-1" }) }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/lib/api", () => ({ chatApi: { getMessages: mocks.getMessages }, CHAT_MAX_LENGTH: 2000 }));
const thread = { conversationId: "own-chat", title: "Kiddos HQ Support", avatarLabel: "HQ" };
const message = { id: "old-message", conversationId: "own-chat", senderUserId: "hq", senderRole: "SUPER_ADMIN", senderName: "HQ", messageType: "TEXT", content: "Existing message", clientMessageId: "old-id", createdAt: "2026-10-29T04:00:00Z", deletedAt: null };
beforeEach(() => {
  vi.clearAllMocks(); mocks.role = "FRANCHISE_ADMIN"; mocks.enabled = true; mocks.totalUnread = 0; mocks.pathname = "/franchise/dashboard";
  mocks.getMessages.mockResolvedValue({ data: { messages: [message], hasMore: false, peerLastReadAt: null } });
  mocks.send.mockImplementation(async (conversationId, content, clientMessageId) => ({ ...message, id: "saved", senderUserId: "user-1", senderRole: "FRANCHISE_ADMIN", conversationId, content, clientMessageId }));
});
afterEach(cleanup);

it.each(FRANCHISE_QUICK_QUESTIONS)("prepares $label without sending or changing history", async question => {
  render(<ChatThread {...thread} />);
  await screen.findByText("Existing message");
  fireEvent.click(screen.getByRole("button", { name: question.label }));
  expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(question.message);
  expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(screen.getAllByText("Existing message")).toHaveLength(1);
});

it("sends edited template once through the existing conversation, then clears the input", async () => {
  render(<ChatThread {...thread} />); await screen.findByText("Existing message");
  fireEvent.click(screen.getByRole("button", { name: "📦 Request Stock" }));
  const input = screen.getByRole("textbox", { name: "Message" });
  fireEvent.change(input, { target: { value: "Please send 10 APPAM packets." } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
  expect(mocks.send).toHaveBeenCalledWith("own-chat", "Please send 10 APPAM packets.", expect.any(String));
  expect(input).toHaveValue("");
  expect(screen.getAllByText("Please send 10 APPAM packets.")).toHaveLength(1);
});

it("preserves Enter-to-send and Shift+Enter composition", async () => {
  render(<ChatThread {...thread} />); await screen.findByText("Existing message");
  fireEvent.click(screen.getByRole("button", { name: "🚚 Order Status" }));
  const input = screen.getByRole("textbox", { name: "Message" });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true }); expect(mocks.send).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1)); expect(input).toHaveValue("");
});

it("keeps templates franchise-only and clears composition when the conversation changes", async () => {
  const { rerender } = render(<ChatThread {...thread} />); await screen.findByText("Existing message");
  fireEvent.click(screen.getByRole("button", { name: "📊 Account Statement" }));
  mocks.role = "SUPER_ADMIN";
  rerender(<ChatThread {...thread} conversationId="other-chat" />);
  expect(screen.queryByRole("group", { name: "Quick Questions" })).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
  expect(mocks.send).not.toHaveBeenCalled();
  await screen.findByText("Existing message");
});

it("retains failed-message retry with the same id instead of creating a duplicate", async () => {
  mocks.send.mockRejectedValueOnce(new Error("Connection lost"));
  render(<ChatThread {...thread} />); await screen.findByText("Existing message");
  fireEvent.click(screen.getByRole("button", { name: "📦 Request Stock" }));
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Retry" })).toBeNull());
  expect(mocks.send).toHaveBeenCalledTimes(2);
  expect(mocks.send.mock.calls[1]).toEqual(mocks.send.mock.calls[0]);
  expect(screen.getAllByText(FRANCHISE_QUICK_QUESTIONS[0].message)).toHaveLength(1);
});

it("replaces the assistant launcher with the existing chat route and unread badge", () => {
  mocks.totalUnread = 3; render(<ChatLauncher />);
  expect(screen.getByRole("link", { name: "Open chat, 3 unread messages" })).toHaveAttribute("href", "/chat");
  expect(screen.getByText("3")).toBeVisible();
  expect(screen.queryByText(/ERP Assistant/)).not.toBeInTheDocument();
});

it("hides the launcher on chat and from accounts without chat access", () => {
  mocks.pathname = "/chat"; const { rerender } = render(<ChatLauncher />); expect(screen.queryByRole("link")).toBeNull();
  mocks.pathname = "/"; mocks.role = "ACCOUNTANT"; rerender(<ChatLauncher />); expect(screen.queryByRole("link")).toBeNull();
  mocks.role = "FRANCHISE_ADMIN"; mocks.enabled = false; rerender(<ChatLauncher />); expect(screen.queryByRole("link")).toBeNull();
});
