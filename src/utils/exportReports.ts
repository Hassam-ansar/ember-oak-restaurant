import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { IOrder, IInventoryItem, IExpense } from '../types/restaurant';

export function exportAnalyticsToPDF(params: {
  restaurantName: string;
  period: string;
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    totalIngredientCOGS: number;
    grossProfit: number;
    totalOperatingExpenses: number;
    netProfit: number;
  };
  bestsellingProducts: { name: string; category: string; unitsSold: number; revenue: number }[];
  orders: IOrder[];
  expenses: IExpense[];
}) {
  const doc = new jsPDF();
  const dateStr = new Date().toLocaleString();

  doc.setFontSize(18);
  doc.text(`${params.restaurantName} — Financial & Operations Report`, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${dateStr} | Reporting Period: ${params.period.toUpperCase()}`, 14, 28);

  // 1. Executive Summary Table
  autoTable(doc, {
    startY: 34,
    head: [['Metric', 'Value']],
    body: [
      ['Total Gross Sales Revenue', `$${params.metrics.totalRevenue.toFixed(2)}`],
      ['Completed & Active Orders', `${params.metrics.totalOrders}`],
      ['Average Order Value (AOV)', `$${params.metrics.avgOrderValue.toFixed(2)}`],
      ['Ingredient Cost of Goods Sold (COGS)', `$${params.metrics.totalIngredientCOGS.toFixed(2)}`],
      ['Gross Profit', `$${params.metrics.grossProfit.toFixed(2)}`],
      ['Operating Expenses', `$${params.metrics.totalOperatingExpenses.toFixed(2)}`],
      ['Net Profit', `$${params.metrics.netProfit.toFixed(2)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [24, 24, 27] },
  });

  // 2. Bestselling Products Table
  const afterSummaryY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text('Top Performing Menu Items', 14, afterSummaryY);

  autoTable(doc, {
    startY: afterSummaryY + 4,
    head: [['Product Name', 'Category', 'Units Sold', 'Revenue']],
    body: params.bestsellingProducts.slice(0, 10).map((p) => [
      p.name,
      p.category,
      String(p.unitsSold),
      `$${p.revenue.toFixed(2)}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [180, 83, 9] },
  });

  // 3. Recent Orders Ledger
  const afterProductsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.text('Recent Orders Ledger', 14, afterProductsY);

  autoTable(doc, {
    startY: afterProductsY + 4,
    head: [['Order #', 'Customer', 'Type', 'Status', 'Payment', 'Total']],
    body: params.orders.slice(0, 15).map((o) => [
      o.orderNumber,
      o.customerName,
      o.orderType,
      o.status,
      `${o.paymentMethod.toUpperCase()} (${o.paymentStatus})`,
      `$${o.totalAmount.toFixed(2)}`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [24, 24, 27] },
  });

  doc.save(`ember-oak-financial-report-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportAnalyticsToExcel(params: {
  metrics: Record<string, number>;
  bestsellingProducts: { name: string; category: string; unitsSold: number; revenue: number }[];
  orders: IOrder[];
  inventory: IInventoryItem[];
  expenses: IExpense[];
}) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Financial Summary
  const summaryRows = Object.entries(params.metrics).map(([k, v]) => ({
    Metric: k,
    Value: v,
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Financial Summary');

  // Sheet 2: Orders
  const orderRows = params.orders.map((o) => ({
    OrderNumber: o.orderNumber,
    CreatedAt: o.createdAt,
    Customer: o.customerName,
    Phone: o.customerPhone,
    Type: o.orderType,
    Status: o.status,
    Subtotal: o.subtotal,
    Discount: o.discountAmount,
    Tax: o.taxAmount,
    DeliveryFee: o.deliveryFee,
    TotalAmount: o.totalAmount,
    IngredientCOGS: o.estimatedCost,
    PaymentMethod: o.paymentMethod,
    PaymentStatus: o.paymentStatus,
    AssignedRider: o.assignedRiderName || 'Unassigned',
  }));
  const wsOrders = XLSX.utils.json_to_sheet(orderRows);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders Ledger');

  // Sheet 3: Bestselling Products
  const wsBest = XLSX.utils.json_to_sheet(params.bestsellingProducts);
  XLSX.utils.book_append_sheet(wb, wsBest, 'Bestsellers');

  // Sheet 4: Inventory Stock
  const invRows = params.inventory.map((i) => ({
    Ingredient: i.name,
    Category: i.category,
    CurrentStock: i.currentStock,
    Unit: i.unit,
    MinThreshold: i.minStockLevel,
    Status: i.currentStock <= i.minStockLevel ? 'LOW STOCK ALERT' : 'Nominal',
    UnitCost: i.costPerUnit,
    TotalValuation: Number((i.currentStock * i.costPerUnit).toFixed(2)),
    Supplier: i.supplierName || '',
    ExpiryDate: i.expiryDate,
  }));
  const wsInv = XLSX.utils.json_to_sheet(invRows);
  XLSX.utils.book_append_sheet(wb, wsInv, 'Inventory & Stock');

  // Sheet 5: Expenses
  const expRows = params.expenses.map((e) => ({
    Date: e.date,
    Title: e.title,
    Category: e.category,
    Amount: e.amount,
    Vendor: e.paidTo,
    Method: e.paymentMethod,
    RecordedBy: e.recordedBy,
  }));
  const wsExp = XLSX.utils.json_to_sheet(expRows);
  XLSX.utils.book_append_sheet(wb, wsExp, 'Operating Expenses');

  XLSX.writeFile(wb, `ember-oak-workbook-${new Date().toISOString().split('T')[0]}.xlsx`);
}
