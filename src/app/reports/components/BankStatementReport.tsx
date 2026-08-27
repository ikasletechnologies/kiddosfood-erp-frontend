import React, { useState, useEffect } from 'react';
import { Download, Printer, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { reportsApi } from '@/lib/api/accounting.api';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

export default function BankStatementReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [accountId, setAccountId] = useState('NONE');
  const [closingBalance, setClosingBalance] = useState(0);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await reportsApi.getBankStatement({
        accountId,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
      });
      setData(res.data?.data || []);
      setClosingBalance(res.data?.closingBalance || 0);
    } catch (error) {
      toast.error('Failed to load bank statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateRange, accountId]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 font-medium mb-1">Bank name</span>
            <select
              className="border rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-500 text-blue-500 font-medium bg-gray-50"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="NONE">NONE</option>
              {/* Additional accounts would be populated here dynamically */}
            </select>
          </div>
          
          <div className="flex items-center border rounded bg-gray-50 text-sm overflow-hidden h-9 mt-5">
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

        <div className="flex items-center gap-2 mt-5">
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
              <th className="px-4 py-3 font-medium text-gray-600 border-r">Description</th>
              <th className="px-4 py-3 font-medium text-gray-600 border-r text-right w-40">Withdrawal Amount</th>
              <th className="px-4 py-3 font-medium text-gray-600 border-r text-right w-40">Deposit Amount</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right w-40">Balance Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading data...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-20 text-gray-500">
                  No data is available for Bank Statement. Please try again after making relevant changes.
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 border-r whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 border-r">
                    {row.description}
                  </td>
                  <td className="px-4 py-3 border-r text-right font-medium">
                    {row.withdrawalAmount > 0 ? row.withdrawalAmount.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 border-r text-right font-medium">
                    {row.depositAmount > 0 ? row.depositAmount.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {row.balanceAmount.toFixed(2)}
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
          <span className="text-gray-500 mr-8">Balance</span>
          <span className="font-semibold">₹ {closingBalance.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
