"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

export interface Notification {
  id: string;
  type: "success" | "warning" | "info" | "alert";
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  addNotification: (notif: Omit<Notification, "id" | "time" | "read">) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("erp_notifications");
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse notifications", e);
      }
    }
  }, []);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    localStorage.setItem("erp_notifications", JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = useCallback((notif: Omit<Notification, "id" | "time" | "read">) => {
    const newNotif: Notification = {
      ...notif,
      id: Math.random().toString(36).substring(7),
      time: "Just now",
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Keep last 50
    
    // Show toast
    toast(newNotif.title, {
      icon: "🔔",
      duration: 4500,
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const rawRole = (user?.role as any)?.name ?? user?.role ?? "";
    const role = typeof rawRole === "string" ? rawRole.toUpperCase() : "";
    const isSuperAdmin = role === "SUPER_ADMIN";
    const userFranchiseId = user?.franchiseId;

    const token = typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("auth_token")
      : null;

    const newSocket = io(SOCKET_URL, {
      auth: {
        token,
        role,
        franchiseId: userFranchiseId,
      },
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("🔌 Connected to Notification System");
      // Explicitly subscribe to authorized room
      if (isSuperAdmin) {
        newSocket.emit("join", { room: "super-admin", role: "SUPER_ADMIN" });
      } else if (userFranchiseId) {
        newSocket.emit("join", {
          room: `franchise:${userFranchiseId}`,
          franchiseId: userFranchiseId,
          role: "FRANCHISE_ADMIN",
        });
      }
    });

    // Helper: extracts product summary e.g. "KARI KOZHAMBU · 1000 KG"
    const getProductSummary = (data: any) => {
      const prods = data.products ?? data.items ?? [];
      if (!prods || prods.length === 0) return "";
      const p = prods[0];
      const pName = p.productName || p.product?.name || "Finished Product";
      const qty = p.requestedQuantity || p.quantity || 0;
      const unit = p.unit || p.product?.unit || "KG";
      return prods.length > 1
        ? `${pName} · ${qty} ${unit} (+${prods.length - 1} more)`
        : `${pName} · ${qty} ${unit}`;
    };

    // ─── Local Immediate Dispatch Listener ──────────────────────
    const handleLocalStockRequest = (e: any) => {
      const detail = e.detail;
      if (!detail) return;

      const reqFid = detail.franchiseId;
      const reqNumber = detail.requestNumber || "Stock Request";
      const fName = detail.franchiseName || "Blackbulls";
      const summary = getProductSummary(detail);
      const isOrder = detail.isSupplyOrder;
      const targetLink = isOrder
        ? `/franchise-orders?id=${detail.id}`
        : `/franchise/requests?id=${detail.id}`;

      if (isSuperAdmin) {
        addNotification({
          type: "info",
          title: `New Stock Request from ${fName}`,
          message: summary ? `${summary} · ${reqNumber}` : `New stock request ${reqNumber} from ${fName}`,
          link: targetLink,
        });
      } else if (userFranchiseId && reqFid === userFranchiseId) {
        addNotification({
          type: "info",
          title: "Stock Request Submitted",
          message: `Your Stock Request ${reqNumber} has been submitted to HQ.`,
          link: targetLink,
        });
      }
    };

    window.addEventListener("erp:notify-stock-request", handleLocalStockRequest);

    // Listen for POS Orders (Scoped)
    newSocket.on("new-order", (order: any) => {
      if (!isSuperAdmin && order.franchiseId && order.franchiseId !== userFranchiseId) return;
      addNotification({
        type: "success",
        title: "New POS Order",
        message: `Invoice #${order.invoiceNum || order.id?.slice(0, 6)} created for ₹${order.totalAmount || 0}`,
        link: `/pos/history?id=${order.id}`,
      });
      window.dispatchEvent(new CustomEvent("erp:refresh-pos-orders"));
    });

    // Listen for Franchise Orders (Scoped)
    newSocket.on("new-franchise-order", (order: any) => {
      const ordFid = order.franchiseId || order.franchise?.id;
      const foNumber = order.orderNumber || `FO-${String(order.id).slice(0, 4).toUpperCase()}`;
      const fName = order.franchise?.name || "Blackbulls";
      const summary = getProductSummary(order);

      if (isSuperAdmin) {
        addNotification({
          type: "info",
          title: `New Stock Request from ${fName}`,
          message: summary ? `${summary} · ${foNumber}` : `New stock order ${foNumber} from ${fName}`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      } else if (userFranchiseId && ordFid === userFranchiseId) {
        addNotification({
          type: "info",
          title: "Stock Request Submitted",
          message: `Your Stock Request ${foNumber} has been submitted to HQ.`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      }
    });

    // ─── Franchise Product Request Lifecycle (Strict Scoping) ───
    newSocket.on("product-request:created", (request: any) => {
      const reqFid = request.franchiseId || request.franchise?.id;
      const reqNumber = request.requestNumber || `FPR-${String(request.id).slice(0, 4).toUpperCase()}`;
      const fName = request.franchise?.name || "Blackbulls";
      const summary = getProductSummary(request);

      if (isSuperAdmin) {
        addNotification({
          type: "info",
          title: `New Stock Request from ${fName}`,
          message: summary ? `${summary} · ${reqNumber}` : `New stock request ${reqNumber} submitted by ${fName}`,
          link: `/franchise/requests?id=${request.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      } else if (userFranchiseId && reqFid === userFranchiseId) {
        addNotification({
          type: "info",
          title: "Stock Request Submitted",
          message: `Your Stock Request ${reqNumber} has been submitted to HQ.`,
          link: `/franchise/requests?id=${request.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      }
    });

    newSocket.on("product-request:approved", (request: any) => {
      const reqFid = request.franchiseId || request.franchise?.id;
      const reqNumber = request.requestNumber || `FPR-${String(request.id).slice(0, 4).toUpperCase()}`;
      const fName = request.franchise?.name || "Franchise";

      if (isSuperAdmin) {
        addNotification({
          type: "success",
          title: "Product Request Approved",
          message: `Request ${reqNumber} for ${fName} approved & converted to Supply Order.`,
          link: `/franchise/requests?id=${request.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      } else if (userFranchiseId && reqFid === userFranchiseId) {
        addNotification({
          type: "success",
          title: "Product Request Approved by HQ",
          message: `Your Stock Request ${reqNumber} has been APPROVED by Central HQ.`,
          link: `/franchise/requests?id=${request.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      }
    });

    newSocket.on("product-request:rejected", (request: any) => {
      const reqFid = request.franchiseId || request.franchise?.id;
      const reqNumber = request.requestNumber || `FPR-${String(request.id).slice(0, 4).toUpperCase()}`;
      const reason = request.rejectionReason || request.adminResponse || "Stock currently unavailable";

      if (isSuperAdmin) {
        addNotification({
          type: "alert",
          title: "Product Request Rejected",
          message: `Request ${reqNumber} was rejected: ${reason}`,
          link: `/franchise/requests?id=${request.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      } else if (userFranchiseId && reqFid === userFranchiseId) {
        addNotification({
          type: "alert",
          title: "Stock Request Rejected",
          message: `Your Stock Request ${reqNumber} was rejected by HQ: ${reason}`,
          link: `/franchise/requests?id=${request.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      }
    });

    newSocket.on("product-request:cancelled", (request: any) => {
      const reqFid = request.franchiseId || request.franchise?.id;
      const reqNumber = request.requestNumber || `FPR-${String(request.id).slice(0, 4).toUpperCase()}`;
      const fName = request.franchise?.name || "Franchise";

      if (isSuperAdmin) {
        addNotification({
          type: "warning",
          title: "Request Cancelled by Franchise",
          message: `Stock Request ${reqNumber} was cancelled by ${fName}.`,
          link: `/franchise/requests?id=${request.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      } else if (userFranchiseId && reqFid === userFranchiseId) {
        addNotification({
          type: "warning",
          title: "Request Cancelled",
          message: `Your Stock Request ${reqNumber} was cancelled.`,
          link: `/franchise/requests?id=${request.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      }
    });

    // ─── Supply Order (FO) Lifecycle (Strict Scoping) ───────────
    newSocket.on("supply-order:created", (order: any) => {
      const ordFid = order.franchiseId || order.franchise?.id;
      const foNumber = order.orderNumber || `FO-${String(order.id).slice(0, 4).toUpperCase()}`;
      const fName = order.franchise?.name || "Blackbulls";
      const summary = getProductSummary(order);

      if (isSuperAdmin) {
        addNotification({
          type: "info",
          title: `New Stock Request from ${fName}`,
          message: summary ? `${summary} · ${foNumber}` : `New supply order ${foNumber} from ${fName}`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      } else if (userFranchiseId && ordFid === userFranchiseId) {
        addNotification({
          type: "info",
          title: "Stock Request Submitted",
          message: `Your Stock Request ${foNumber} has been submitted to HQ.`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
        window.dispatchEvent(new CustomEvent("erp:refresh-product-requests"));
      }
    });

    newSocket.on("supply-order:processing", (order: any) => {
      const ordFid = order.franchiseId || order.franchise?.id;
      const foNumber = order.orderNumber || `FO-${String(order.id).slice(0, 4).toUpperCase()}`;

      if (isSuperAdmin) {
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      } else if (userFranchiseId && ordFid === userFranchiseId) {
        addNotification({
          type: "info",
          title: "HQ Processing Stock",
          message: `Central HQ has reserved stock & is preparing dispatch for ${foNumber}.`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      }
    });

    newSocket.on("supply-order:dispatched", (order: any) => {
      const ordFid = order.franchiseId || order.franchise?.id;
      const foNumber = order.orderNumber || `FO-${String(order.id).slice(0, 4).toUpperCase()}`;
      const fName = order.franchise?.name || "Franchise";

      if (isSuperAdmin) {
        addNotification({
          type: "info",
          title: `Supply Order Dispatched to ${fName}`,
          message: `Goods dispatched for ${foNumber} (Challan: ${order.dispatchReference || "DC-N/A"}).`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      } else if (userFranchiseId && ordFid === userFranchiseId) {
        addNotification({
          type: "warning",
          title: "Stock Dispatched from HQ",
          message: `Goods are on the way for ${foNumber} (Challan: ${order.dispatchReference || "DC-N/A"}). Please confirm receipt upon arrival.`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      }
    });

    newSocket.on("supply-order:delivery-issue", (order: any) => {
      const ordFid = order.franchiseId || order.franchise?.id;
      const foNumber = order.orderNumber || `FO-${String(order.id).slice(0, 4).toUpperCase()}`;
      const fName = order.franchise?.name || "Franchise";

      if (isSuperAdmin) {
        addNotification({
          type: "alert",
          title: `Delivery Discrepancy Reported from ${fName}`,
          message: `Damaged or missing stock reported on order ${foNumber}. Discrepancy resolution required.`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      } else if (userFranchiseId && ordFid === userFranchiseId) {
        addNotification({
          type: "alert",
          title: "Delivery Discrepancy Recorded",
          message: `Your damaged/missing stock report for ${foNumber} has been sent to HQ for reconciliation.`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      }
    });

    newSocket.on("supply-order:delivered", (order: any) => {
      const ordFid = order.franchiseId || order.franchise?.id;
      const foNumber = order.orderNumber || `FO-${String(order.id).slice(0, 4).toUpperCase()}`;
      const fName = order.franchise?.name || "Franchise";

      if (isSuperAdmin) {
        addNotification({
          type: "success",
          title: `Delivery Receipt Confirmed by ${fName}`,
          message: `${fName} has received and inwarded stock for order ${foNumber}.`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      } else if (userFranchiseId && ordFid === userFranchiseId) {
        addNotification({
          type: "success",
          title: "Stock Inwarded Successfully",
          message: `Delivery receipt confirmed for ${foNumber}. Stock has been added to your branch inventory.`,
          link: `/franchise/stock`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      }
    });

    // ─── Local Immediate Cancellation & Review Listeners ────────
    const handleLocalOrderCancelled = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const fName = detail.franchiseName || "Franchise";
      const foNumber = detail.orderNumber || "Order";
      const summary = detail.productSummary || "Stock items";
      const reason = detail.reason || "Cancelled by admin";
      const link = `/franchise-orders?id=${detail.id}`;

      if (isSuperAdmin) {
        addNotification({
          type: "warning",
          title: `Pending Order Cancelled by ${fName}`,
          message: `${foNumber} · ${summary}\nReason: ${reason}`,
          link,
        });
      } else if (userFranchiseId && detail.franchiseId === userFranchiseId) {
        addNotification({
          type: "warning",
          title: "Order Cancelled",
          message: `Your order ${foNumber} has been cancelled successfully.`,
          link,
        });
      }
      window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      window.dispatchEvent(new CustomEvent("erp:refresh-finished-goods"));
    };

    const handleLocalCancellationRequested = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const fName = detail.franchiseName || "Franchise";
      const foNumber = detail.orderNumber || "Order";
      const summary = detail.productSummary || "Stock items";
      const reason = detail.reason || "Requested by franchise";
      const link = `/franchise-orders?id=${detail.id}&view=cancellation`;

      if (isSuperAdmin) {
        addNotification({
          type: "alert",
          title: `Cancellation Requested by ${fName}`,
          message: `${foNumber} · ${summary}\nReason: ${reason}`,
          link,
        });
      } else if (userFranchiseId && detail.franchiseId === userFranchiseId) {
        addNotification({
          type: "info",
          title: "Cancellation Request Submitted",
          message: `Your cancellation request for ${foNumber} has been submitted for HQ review.`,
          link,
        });
      }
      window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
    };

    const handleLocalCancellationApproved = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const foNumber = detail.orderNumber || "Order";
      const link = `/franchise-orders?id=${detail.id}`;

      if (isSuperAdmin) {
        addNotification({
          type: "success",
          title: "Order Cancellation Approved",
          message: `Cancellation approved for ${foNumber}. Stock released.`,
          link,
        });
      } else if (userFranchiseId && detail.franchiseId === userFranchiseId) {
        addNotification({
          type: "success",
          title: "Cancellation Approved by HQ",
          message: `HQ has approved cancellation for ${foNumber}. Reserved stock has been released.`,
          link,
        });
      }
      window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      window.dispatchEvent(new CustomEvent("erp:refresh-finished-goods"));
    };

    const handleLocalCancellationRejected = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const foNumber = detail.orderNumber || "Order";
      const link = `/franchise-orders?id=${detail.id}`;

      if (isSuperAdmin) {
        addNotification({
          type: "info",
          title: "Cancellation Request Rejected",
          message: `Cancellation rejected for ${foNumber}. Order workflow resumed.`,
          link,
        });
      } else if (userFranchiseId && detail.franchiseId === userFranchiseId) {
        addNotification({
          type: "alert",
          title: "Cancellation Request Rejected by HQ",
          message: `HQ has rejected your cancellation request for ${foNumber}. Order will continue processing.`,
          link,
        });
      }
      window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
    };

    window.addEventListener("erp:notify-order-cancelled", handleLocalOrderCancelled);
    window.addEventListener("erp:notify-cancellation-requested", handleLocalCancellationRequested);
    window.addEventListener("erp:notify-cancellation-approved", handleLocalCancellationApproved);
    window.addEventListener("erp:notify-cancellation-rejected", handleLocalCancellationRejected);

    // Listen for Socket Cancellation Events (Scoped)
    newSocket.on("supply-order:cancelled", (order: any) => {
      const ordFid = order.franchiseId || order.franchise?.id;
      const foNumber = order.orderNumber || `FO-${String(order.id).slice(0, 4).toUpperCase()}`;
      const fName = order.franchise?.name || "Franchise";
      const summary = getProductSummary(order);
      const reason = order.cancellationReason || order.notes || "Order cancelled";

      if (isSuperAdmin) {
        addNotification({
          type: "warning",
          title: `Pending Order Cancelled by ${fName}`,
          message: `${foNumber} · ${summary}\nReason: ${reason}`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
        window.dispatchEvent(new CustomEvent("erp:refresh-finished-goods"));
      } else if (userFranchiseId && ordFid === userFranchiseId) {
        addNotification({
          type: "warning",
          title: "Order Cancelled",
          message: `Your order ${foNumber} has been cancelled.`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
        window.dispatchEvent(new CustomEvent("erp:refresh-finished-goods"));
      }
    });

    newSocket.on("supply-order:cancellation-requested", (order: any) => {
      const ordFid = order.franchiseId || order.franchise?.id;
      const foNumber = order.orderNumber || `FO-${String(order.id).slice(0, 4).toUpperCase()}`;
      const fName = order.franchise?.name || "Franchise";
      const summary = getProductSummary(order);
      const reason = order.cancellationRequest?.reasonCode || "Requested by franchise";

      if (isSuperAdmin) {
        addNotification({
          type: "alert",
          title: `Cancellation Requested by ${fName}`,
          message: `${foNumber} · ${summary}\nReason: ${reason}`,
          link: `/franchise-orders?id=${order.id}&view=cancellation`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      } else if (userFranchiseId && ordFid === userFranchiseId) {
        addNotification({
          type: "info",
          title: "Cancellation Request Submitted",
          message: `Your cancellation request for ${foNumber} is awaiting HQ review.`,
          link: `/franchise-orders?id=${order.id}`,
        });
        window.dispatchEvent(new CustomEvent("erp:refresh-franchise-orders"));
      }
    });

    return () => {
      window.removeEventListener("erp:notify-stock-request", handleLocalStockRequest);
      window.removeEventListener("erp:notify-order-cancelled", handleLocalOrderCancelled);
      window.removeEventListener("erp:notify-cancellation-requested", handleLocalCancellationRequested);
      window.removeEventListener("erp:notify-cancellation-approved", handleLocalCancellationApproved);
      window.removeEventListener("erp:notify-cancellation-rejected", handleLocalCancellationRejected);
      newSocket.close();
    };
  }, [user, addNotification]);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}
