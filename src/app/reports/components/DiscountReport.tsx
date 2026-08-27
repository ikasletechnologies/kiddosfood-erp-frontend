import React, { useState, useEffect } from 'react';
import { Download, Printer, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { reportsApi } from '@/lib/api/accounting.api';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

export default function DiscountReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [totalDiscount, setTotalDiscount] = useState(0);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await reportsApi.getDiscountReport({
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
      });
      setData(res.data?.data || []);
      setTotalDiscount(res.data?.totalDiscount || 0);
    } catch (error) {
      toast.error('Failed to load discount report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateRange]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex items-center border rounded bg-gray-50 text-sm overflow-hidden h-9">
            <div className="flex items-center px-3 text-gray-500 border-r bg-gray-100">
              From
            </div>
            <input
              type="date"
              className="px-2 py-1 bg-transparent focus:outline-none text-gray-700"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
            <div className="flex items-center px-3 text-gray-500 border-x bg-gray-100">
              To
            </div>
            <input
              type="date"
              className="px-2 py-1 bg-transparent focus:outline-none text-gray-700"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 border rounded-full hover:bg-gray-50 text-emerald-600 border-gray-200">
            <Download size={18} />
          </button>
          <button className="p-2 border rounded-full hover:bg-gray-50 text-emerald-600 border-gray-200">
            <Printer size={18} />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-gray-50 text-gray-600 text-xs uppercase border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600 border-r w-32">Date</th>
              <th className="px-4 py-3 font-medium text-gray-600 border-r w-40">Invoice No</th>
              <th className="px-4 py-3 font-medium text-gray-600 border-r">Party Name</th>
              <th className="px-4 py-3 font-medium text-gray-600 border-r text-right w-40">Original Amount</th>
              <th className="px-4 py-3 font-medium text-gray-600 border-r text-right w-40">Discount Amount</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right w-40">Final Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading data...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-20 text-gray-500">
                  No data is available for Discount Report. Please try again after making relevant changes.
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 border-r whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 border-r font-medium text-blue-600">
                    {row.invoiceNo}
                  </td>
                  <td className="px-4 py-3 border-r font-medium">
                    {row.partyName}
                  </td>
                  <td className="px-4 py-3 border-r text-right">
                    {row.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 border-r text-right text-red-600">
                    {row.discountAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600">
                    {row.finalAmount.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-white border-t p-4 flex justify-end">
        <div className="text-sm">
          <span className="text-gray-500 mr-8">Total Discount</span>
          <span className="font-semibold text-red-600">₹ {totalDiscount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
