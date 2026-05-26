'use client'
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function ReportsModule() {
  const router = useRouter();
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState('today');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [printView, setPrintView] = useState<string>('full');

  // --- FILTERS FOR EXPENSES ---
  const [expFilterSupplier, setExpFilterSupplier] = useState('all');
  const [expFilterType, setExpFilterType] = useState('all');

  // --- EDIT STATE FOR SALES ---
  const [editSale, setEditSale] = useState<any>(null);
  const [saleEditTotal, setSaleEditTotal] = useState('');
  const [saleEditPay, setSaleEditPay] = useState('');
  const [saleEditType, setSaleEditType] = useState('');
  const [saleEditDate, setSaleEditDate] = useState(''); 

  // --- EDIT STATE FOR EXPENSES ---
  const [editExpense, setEditExpense] = useState<any>(null);
  const [expEditCategory, setExpEditCategory] = useState('');
  const [expEditDesc, setExpEditDesc] = useState('');
  const [expEditAmount, setExpEditAmount] = useState('');
  const [expEditDate, setExpEditDate] = useState(''); 

  const formatForInput = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const fetchData = async () => {
    const { data: salesData } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
    if (salesData) setSales(salesData);

    const { data: expData } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (expData) setExpenses(expData);

    const { data: invData } = await supabase.from('durian_inventory').select('*');
    if (invData) setInventory(invData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const now = new Date();
  
  const filterByTime = (dateString: string) => {
    const targetDate = new Date(dateString);
    if (timeRange === 'today') return targetDate.toDateString() === now.toDateString();
    if (timeRange === 'week') return targetDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (timeRange === 'month') return targetDate.getMonth() === now.getMonth() && targetDate.getFullYear() === now.getFullYear();
    if (timeRange === 'year') return targetDate.getFullYear() === now.getFullYear();
    if (timeRange === 'custom' && customDate) {
      const [year, month, day] = customDate.split('-');
      return targetDate.getFullYear() === parseInt(year) && targetDate.getMonth() + 1 === parseInt(month) && targetDate.getDate() === parseInt(day);
    }
    return true; 
  };

  const getReportDateRangeString = () => {
    const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (timeRange === 'today') return formatDate(now);
    if (timeRange === 'week') return `${formatDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))} - ${formatDate(now)}`;
    if (timeRange === 'month') return `${formatDate(new Date(now.getFullYear(), now.getMonth(), 1))} - ${formatDate(now)}`;
    if (timeRange === 'year') return `${formatDate(new Date(now.getFullYear(), 0, 1))} - ${formatDate(now)}`;
    if (timeRange === 'custom' && customDate) return formatDate(new Date(customDate));
    
    let earliestDate = now;
    const allDates = [...sales.map(s => new Date(s.created_at).getTime()), ...expenses.map(e => new Date(e.created_at).getTime())];
    if (allDates.length > 0) earliestDate = new Date(Math.min(...allDates));
    return `${formatDate(earliestDate)} - ${formatDate(now)}`;
  };

  const filteredSales = sales.filter(s => filterByTime(s.created_at));
  
  // Expenses Base Filter (Time)
  const baseFilteredExpenses = expenses.filter(e => filterByTime(e.created_at));
  
  // Expenses Advanced Filter (Supplier & Type)
  const filteredExpenses = baseFilteredExpenses.filter(e => {
      // 1. Supplier Filter
      if (expFilterSupplier !== 'all' && e.supplier_name !== expFilterSupplier) return false;
      
      // 2. Product Type Filter (Including the grouped "All Durians" option)
      if (expFilterType === 'all_durians') {
         if (e.category !== 'Durian Restock') return false;
      } else if (expFilterType !== 'all' && e.durian_type !== expFilterType) {
         return false;
      }
      
      return true;
  });

  const uniqueExpenseSuppliers = Array.from(new Set(baseFilteredExpenses.map(e => e.supplier_name).filter(Boolean)));
  const uniqueExpenseTypes = Array.from(new Set(baseFilteredExpenses.map(e => e.durian_type).filter(Boolean)));

  const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total_price), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.total_cost_rm), 0); 
  const grossProfit = totalRevenue - totalExpenses;
  
  const totalWeight = filteredSales.reduce((sum, s) => sum + Number(s.weight_kg), 0);
  const totalQty = filteredSales.reduce((sum, s) => sum + Number(s.quantity), 0);

  // Calculate totals for filtered expenses log
  const totalExpenseWeight = filteredExpenses.reduce((sum, e) => sum + Number(e.weight_bought_kg || 0), 0);
  const totalExpenseQty = filteredExpenses.reduce((sum, e) => sum + Number(e.quantity_bought || 0), 0);

  const salesByDurian: Record<string, { type: string, qty: number, weight: number, revenue: number }> = {};
  filteredSales.forEach(s => {
    if (s.cart_items && s.cart_items.length > 0) {
      s.cart_items.forEach((item: any) => {
        if (!salesByDurian[item.type]) salesByDurian[item.type] = { type: item.type, qty: 0, weight: 0, revenue: 0 };
        salesByDurian[item.type].qty += Number(item.qty);
        salesByDurian[item.type].weight += Number(item.weight);
        salesByDurian[item.type].revenue += Number(item.total_price);
      });
    } else {
      if (!salesByDurian[s.durian_type]) salesByDurian[s.durian_type] = { type: s.durian_type, qty: 0, weight: 0, revenue: 0 };
      salesByDurian[s.durian_type].qty += Number(s.quantity);
      salesByDurian[s.durian_type].weight += Number(s.weight_kg);
      salesByDurian[s.durian_type].revenue += Number(s.total_price);
    }
  });
  const topSellers = Object.values(salesByDurian).sort((a, b) => b.revenue - a.revenue);
  const lowStock = inventory.filter(i => i.total_weight_kg < 5 && i.total_durians < 5).sort((a, b) => a.total_weight_kg - b.total_weight_kg);

  const totalTopWeight = topSellers.reduce((sum, i) => sum + i.weight, 0);
  const totalTopRev = topSellers.reduce((sum, i) => sum + i.revenue, 0);
  const totalLowQty = lowStock.reduce((sum, i) => sum + i.total_durians, 0);
  const totalLowWeight = lowStock.reduce((sum, i) => sum + i.total_weight_kg, 0);

  const handlePrint = (viewType: string) => {
    setPrintView(viewType);
    setTimeout(() => { window.print(); }, 100);
  };

  const handleDeleteSale = async (id: string) => {
    if (window.confirm("⚠️ Delete this sale record? Note: This does NOT automatically return stock to inventory.")) {
      await supabase.from('sales').delete().eq('id', id);
      fetchData();
    }
  };

  const handleSaveSaleEdit = async () => {
    await supabase.from('sales').update({
      total_price: parseFloat(saleEditTotal),
      payment_method: saleEditPay,
      order_type: saleEditType,
      created_at: new Date(saleEditDate).toISOString() 
    }).eq('id', editSale.id);
    setEditSale(null);
    fetchData();
  };

  const handleDeleteExpense = async (exp: any) => {
    if (exp.category === 'Durian Restock' || exp.category === 'Other Fruit Restock') {
      if (window.confirm(`⚠️ WARNING: This will remove ${exp.quantity_bought || 0} units and ${exp.weight_bought_kg || 0} kg from ${exp.durian_type} inventory. Continue?`)) {
        const target = inventory.find(i => i.type === exp.durian_type);
        if (target) {
          const newQty = target.total_durians - (exp.quantity_bought || 0);
          const newWeight = target.total_weight_kg - (exp.weight_bought_kg || 0);
          let updatedBatches = [...(target.stock_batches || [])];
          const restockDate = new Date(exp.created_at).toISOString().split('T')[0];
          const batchIdx = updatedBatches.findIndex((b: any) => b.date === restockDate);
          
          if (batchIdx !== -1) {
             updatedBatches[batchIdx].qty -= (exp.quantity_bought || 0);
             updatedBatches[batchIdx].weight -= (exp.weight_bought_kg || 0);
             updatedBatches = updatedBatches.filter((b: any) => b.qty > 0 || b.weight > 0);
          }

          await supabase.from('durian_inventory').update({ 
             total_durians: Math.max(0, newQty), 
             total_weight_kg: Math.max(0, newWeight), 
             stock_batches: updatedBatches 
          }).eq('type', exp.durian_type);
        }
        await supabase.from('expenses').delete().eq('id', exp.id);
        alert("✅ Restock reversed and inventory updated!");
        fetchData();
      }
    } else {
      if (window.confirm("⚠️ Delete this expense record completely?")) {
        await supabase.from('expenses').delete().eq('id', exp.id);
        fetchData();
      }
    }
  };

  const handleSaveExpenseEdit = async () => {
    await supabase.from('expenses').update({
      category: expEditCategory,
      description: expEditDesc,
      total_cost_rm: parseFloat(expEditAmount),
      created_at: new Date(expEditDate).toISOString() 
    }).eq('id', editExpense.id);
    setEditExpense(null);
    fetchData();
  };

  const inputClass = "w-full border-2 border-gray-300 p-3 rounded-xl font-bold bg-gray-50 focus:ring-2 focus:ring-green-400 outline-none text-black";

  const Modal = ({ id, title, onClose, children }: { id: string, title: string, onClose: () => void, children: React.ReactNode }) => (
    <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4 md:p-8 backdrop-blur-sm print:hidden">
      <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gray-100 p-6 border-b flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-black text-gray-900">{title}</h2>
          <div className="flex gap-4">
            <button onClick={() => handlePrint(id)} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-green-700 transition-colors">🖨️ Print PDF</button>
            <button onClick={onClose} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-xl font-bold hover:bg-yellow-400 transition-colors">✕ Close</button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="pb-10 bg-gray-100 min-h-screen text-black relative">
      
      <div className="print:hidden p-4">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-200 mt-4">
          <div><h1 className="text-4xl font-black text-green-900 tracking-tight">Business Reports</h1></div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="font-bold text-gray-700">Time Range:</label>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="border-2 border-gray-300 p-3 rounded-xl text-black bg-gray-50 font-bold focus:ring-2 focus:ring-green-500 outline-none">
              <option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="year">This Year</option><option value="custom">📅 Custom Date</option><option value="all">All Time</option>
            </select>
            {timeRange === 'custom' && ( <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="border-2 border-gray-300 p-3 rounded-xl text-black bg-gray-50 font-bold" /> )}
            <button onClick={() => handlePrint('full')} className="ml-4 bg-gray-900 text-white px-6 py-3 rounded-xl font-black hover:bg-black shadow-lg transition-transform active:scale-95">🖨️ Print Full Report</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
            <p className="text-gray-500 font-bold uppercase tracking-wider mb-2">Total Sales Revenue</p>
            <p className="text-5xl font-black text-green-600">RM {totalRevenue.toFixed(2)}</p>
            <p className="text-sm font-bold text-gray-500 mt-4 bg-gray-100 w-fit px-4 py-2 rounded-lg">Sold: {totalWeight.toFixed(3)}kg / {totalQty} units</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
            <p className="text-gray-500 font-bold uppercase tracking-wider mb-2">Total Net Expenses</p>
            <p className="text-5xl font-black text-yellow-600">RM {totalExpenses.toFixed(2)}</p>
          </div>
          <div className={`bg-white p-8 rounded-3xl shadow-sm border ${grossProfit >= 0 ? 'border-green-200 bg-green-50/50' : 'border-yellow-300 bg-yellow-50/50'}`}>
            <p className="text-gray-600 font-bold uppercase tracking-wider mb-2">Net Profit</p>
            <p className={`text-5xl font-black ${grossProfit >= 0 ? 'text-green-700' : 'text-yellow-700'}`}>RM {grossProfit.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <button onClick={() => setActiveModal('top')} className="bg-green-700 text-white p-10 rounded-3xl shadow-lg hover:bg-green-800 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
            <span className="text-4xl">🏆</span><div><h3 className="text-2xl font-black group-hover:underline">Top Selling Products</h3></div>
          </button>
          <button onClick={() => setActiveModal('sales')} className="bg-gray-700 text-white p-10 rounded-3xl shadow-lg hover:bg-gray-800 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
            <span className="text-4xl">🧾</span><div><h3 className="text-2xl font-black group-hover:underline">Sales Log</h3></div>
          </button>
          <button onClick={() => setActiveModal('expenses')} className="bg-yellow-500 text-gray-900 p-10 rounded-3xl shadow-lg hover:bg-yellow-600 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
            <span className="text-4xl">💸</span><div><h3 className="text-2xl font-black group-hover:underline">Expenses Log</h3></div>
          </button>
          <button onClick={() => setActiveModal('viewReceipts')} className="bg-blue-600 text-white p-10 rounded-3xl shadow-lg hover:bg-blue-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
            <span className="text-4xl">📄</span><div><h3 className="text-2xl font-black group-hover:underline">View Documents</h3></div>
          </button>
          <button onClick={() => setActiveModal('low')} className="bg-gray-300 text-gray-800 p-10 rounded-3xl shadow-lg border border-gray-400 hover:bg-gray-400 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
            <span className="text-4xl">⚠️</span><div><h3 className="text-2xl font-black group-hover:underline">Low Inventory Alerts</h3></div>
          </button>
          <button onClick={() => router.push('/reports/statistics')} className="bg-green-600 text-white p-10 rounded-3xl shadow-lg hover:bg-green-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
            <span className="text-4xl">📈</span><div><h3 className="text-2xl font-black group-hover:underline">Statistics & Trends</h3></div>
          </button>
        </div>

        {/* LOW STOCK ALERT (RE-ADDED HERE) */}
        {lowStock.length > 0 && (
          <div className="mt-10 bg-yellow-50 border-l-8 border-yellow-500 p-6 rounded-2xl shadow-xl flex items-center animate-pulse">
            <span className="text-5xl mr-6">🚨</span>
            <div>
              <h4 className="text-xl font-black text-yellow-900 uppercase tracking-widest mb-1">Low Stock Warning</h4>
              <p className="text-yellow-700 font-bold text-lg">
                {lowStock.map(item => `${item.type} (${Number(item.total_weight_kg).toFixed(3)}kg / ${item.total_durians}pcs)`).join('  •  ')}
              </p>
            </div>
          </div>
        )}

        {/* MODAL DISPLAYS */}
        {activeModal === 'top' && (
          <Modal id="top" title="🏆 Top Selling Products" onClose={() => setActiveModal(null)}>
            <table className="w-full text-left border-collapse text-lg">
              <thead><tr className="border-b-4 border-gray-300"><th className="p-4 text-gray-600 font-bold">Type</th><th className="p-4 text-gray-600 font-bold text-center">Weight</th><th className="p-4 text-gray-600 font-bold text-right">Revenue</th></tr></thead>
              <tbody>{topSellers.map((item) => (<tr key={item.type} className="border-b border-gray-200 hover:bg-gray-50"><td className="p-4 font-black">{item.type}</td><td className="p-4 text-center">{item.weight.toFixed(3)} kg</td><td className="p-4 font-black text-green-600 text-right">RM {item.revenue.toFixed(2)}</td></tr>))}</tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-4 border-gray-300">
                  <td className="p-4 font-black text-gray-800 text-right uppercase tracking-widest">Grand Total:</td>
                  <td className="p-4 font-black text-gray-800 text-center">{totalTopWeight.toFixed(3)} kg</td>
                  <td className="p-4 font-black text-green-700 text-right">RM {totalTopRev.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </Modal>
        )}
        
        {activeModal === 'sales' && (
          <Modal id="sales" title="🧾 Sales Transaction Log" onClose={() => setActiveModal(null)}>
            <table className="w-full text-left border-collapse text-md">
              <thead>
                <tr className="border-b-4 border-gray-300">
                   <th className="p-4 text-gray-600 font-bold">Order Info</th>
                   <th className="p-4 text-gray-600 font-bold">Items Ordered</th>
                   <th className="p-4 text-gray-600 font-bold">Details</th>
                   <th className="p-4 text-gray-600 font-bold text-right">Total</th>
                   <th className="p-4 text-gray-600 font-bold text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-200 hover:bg-yellow-50">
                    <td className="p-4">
                      <div className="font-black text-green-800">{sale.order_number || 'N/A'}</div>
                      <div className="text-sm font-bold text-gray-500">{new Date(sale.created_at).toLocaleString()}</div>
                      <div className="text-xs uppercase text-gray-400 mt-1">Cashier: {sale.cashier_name || 'System'}</div>
                    </td>
                    <td className="p-4 text-gray-800">
                      {sale.cart_items && sale.cart_items.length > 0 ? sale.cart_items.map((i:any, idx:number) => <div key={idx} className="font-bold">{i.type} <span className="font-normal text-sm text-gray-500">({Number(i.weight).toFixed(3)}kg)</span></div>) : <div className="font-bold">{sale.durian_type} <span className="font-normal text-sm text-gray-500">({Number(sale.weight_kg).toFixed(3)}kg)</span></div>}
                    </td>
                    <td className="p-4 text-xs font-bold text-gray-500 uppercase">
                      <div>{sale.order_type === 'eat_here' ? `🍽️ Eat Here (Table ${sale.table_number})` : sale.order_type === 'pack' ? '🛍️ Pack' : sale.order_type === 'delivery' ? '🛵 Delivery' : '🚶 Walk-in'}</div>
                      <div className="mt-1">{sale.payment_method === 'cash' ? '💵 Cash' : '📱 QR Pay'}</div>
                    </td>
                    <td className="p-4 font-black text-green-700 text-right text-xl">RM {sale.total_price.toFixed(2)}</td>
                    <td className="p-4 text-center print:hidden border-l-2 border-gray-100">
                      <button onClick={() => { 
                          setEditSale(sale); 
                          setSaleEditTotal(sale.total_price); 
                          setSaleEditPay(sale.payment_method); 
                          setSaleEditType(sale.order_type); 
                          setSaleEditDate(formatForInput(sale.created_at));
                      }} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg font-bold hover:bg-yellow-400 mb-2 w-full text-xs shadow-sm">Edit</button>
                      <button onClick={() => handleDeleteSale(sale.id)} className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-bold hover:bg-red-600 hover:text-white w-full text-xs shadow-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-4 border-gray-300">
                  <td className="p-4 font-black text-gray-800 text-right uppercase tracking-widest">Grand Total:</td>
                  <td className="p-4 font-black text-gray-800">{totalQty} units / {totalWeight.toFixed(3)} kg</td>
                  <td className="p-4"></td>
                  <td className="p-4 font-black text-green-700 text-right text-xl">RM {totalRevenue.toFixed(2)}</td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </Modal>
        )}

        {activeModal === 'expenses' && (
          <Modal id="expenses" title="💸 Expenses Log" onClose={() => setActiveModal(null)}>
            
            {/* EXPENSE ADVANCED FILTERS */}
            <div className="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-xl mb-6 flex gap-4 print:hidden">
               <div className="flex-1">
                 <label className="block text-xs font-bold text-yellow-900 uppercase mb-1">Supplier</label>
                 <select value={expFilterSupplier} onChange={e=>setExpFilterSupplier(e.target.value)} className="w-full p-2 border-2 border-yellow-300 rounded-lg font-bold">
                    <option value="all">All Suppliers</option>
                    {uniqueExpenseSuppliers.map((s:any) => <option key={s} value={s}>{s}</option>)}
                 </select>
               </div>
               <div className="flex-1">
                 <label className="block text-xs font-bold text-yellow-900 uppercase mb-1">Durian/Product Type</label>
                 <select value={expFilterType} onChange={e=>setExpFilterType(e.target.value)} className="w-full p-2 border-2 border-yellow-300 rounded-lg font-bold">
                    <option value="all">All Product Types</option>
                    <option value="all_durians">🍍 All Durians (Grouped)</option>
                    {uniqueExpenseTypes.map((t:any) => <option key={t} value={t}>{t}</option>)}
                 </select>
               </div>
            </div>

            <table className="w-full text-left border-collapse text-md">
              <thead>
                <tr className="border-b-4 border-gray-300">
                   <th className="p-4 text-gray-600 font-bold">Date & User</th>
                   <th className="p-4 text-gray-600 font-bold">Category</th>
                   <th className="p-4 text-gray-600 font-bold">Details</th>
                   <th className="p-4 text-gray-600 font-bold text-right">Amount</th>
                   <th className="p-4 text-gray-600 font-bold text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-gray-200 hover:bg-yellow-50">
                    <td className="p-4">
                      <div className="font-bold text-gray-600">{new Date(exp.created_at).toLocaleString()}</div>
                      <div className="text-xs text-gray-400 uppercase mt-1">By: {exp.user_name || 'Admin'}</div>
                    </td>
                    <td className="p-4 font-bold text-gray-800">{exp.category}</td>
                    <td className="p-4 text-gray-700">
                      
                      {/* Hide the auto-generated "Bought @" description if it's a restock */}
                      {!(exp.description && exp.description.startsWith('Bought @')) && (
                          <div>{exp.description}</div>
                      )}
                      
                      {/* Detailed calculation based on weight and cost if it's a restock */}
                      {(exp.category === 'Durian Restock' || exp.category === 'Other Fruit Restock') && exp.weight_bought_kg > 0 && (
                          <div className="text-sm font-bold text-gray-600 mt-0.5">
                             Total Quantity: {exp.quantity_bought || 0} units<br/>
                             Total Weight: {exp.weight_bought_kg.toFixed(3)} kg<br/>
                             Price Per Kg: RM {(Math.abs(exp.total_cost_rm) / exp.weight_bought_kg).toFixed(2)}
                          </div>
                      )}
                      
                      {exp.supplier_name && <div className="text-sm font-bold text-green-700 mt-1">Sup: {exp.supplier_name}</div>}
                      {exp.receipt_url && <a href={exp.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-green-600 underline hover:text-green-800 mt-1 inline-block">📄 View Document</a>}
                    </td>
                    <td className="p-4 font-black text-right text-yellow-600">RM {Math.abs(exp.total_cost_rm).toFixed(2)}</td>
                    <td className="p-4 text-center print:hidden border-l-2 border-gray-100">
                      <button onClick={() => { 
                          setEditExpense(exp); 
                          setExpEditCategory(exp.category); 
                          setExpEditDesc(exp.description); 
                          setExpEditAmount(Math.abs(exp.total_cost_rm).toString()); 
                          setExpEditDate(formatForInput(exp.created_at));
                      }} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg font-bold hover:bg-yellow-400 mb-2 w-full text-xs shadow-sm">Edit</button>
                      <button onClick={() => handleDeleteExpense(exp)} className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-bold hover:bg-red-600 hover:text-white w-full text-xs shadow-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-yellow-50 border-t-4 border-yellow-300">
                  <td colSpan={3} className="p-4 font-black text-yellow-900 text-right uppercase tracking-widest">
                      <span className="text-sm font-bold text-yellow-700 tracking-normal normal-case mr-6">
                          Total Restock: {totalExpenseQty} units / {totalExpenseWeight.toFixed(3)} kg
                      </span>
                      Total Expenses:
                  </td>
                  <td className="p-4 font-black text-yellow-700 text-right text-xl">RM {totalExpenses.toFixed(2)}</td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </Modal>
        )}

        {activeModal === 'viewReceipts' && (
          <Modal id="viewReceipts" title="📄 Document & Expense Viewer" onClose={() => setActiveModal(null)}>
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[600px] text-left border-collapse">
                <thead>
                  <tr className="border-b-4 border-gray-300">
                    <th className="p-4">Date</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Details & Supplier</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Document</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} className="border-b border-gray-200 hover:bg-yellow-50 bg-white">
                      <td className="p-4 text-sm font-bold text-gray-600">{new Date(exp.created_at).toLocaleDateString()}</td>
                      <td className="p-4 font-extrabold text-gray-800">{exp.category}</td>
                      <td className="p-4 text-sm text-gray-700">
                        {exp.description} 
                        {exp.supplier_name && <span className="text-green-700 font-bold block mt-1">Supplier: {exp.supplier_name}</span>}
                      </td>
                      <td className="p-4 font-black text-gray-800 text-right">RM {Math.abs(exp.total_cost_rm).toFixed(2)}</td>
                      <td className="p-4 text-center">
                        {exp.receipt_url ? (
                         <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="...">
                          📄 View Document
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs font-bold">No Document</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500 font-bold">No expenses or documents found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Modal>
        )}

        {activeModal === 'low' && (
          <Modal id="low" title="⚠️ Low Inventory Alerts" onClose={() => setActiveModal(null)}>
            <table className="w-full text-left border-collapse text-lg">
              <thead><tr className="border-b-4 border-gray-300"><th className="p-4 text-gray-600 font-bold">Type</th><th className="p-4 text-gray-600 font-bold text-center">Qty</th><th className="p-4 text-gray-600 font-bold text-right">Weight</th></tr></thead>
              <tbody>
                {lowStock.map((item) => (<tr key={item.type} className="border-b border-yellow-200 bg-yellow-50"><td className="p-4 font-black text-yellow-900">{item.type}</td><td className="p-4 font-bold text-center text-gray-800">{item.total_durians} pcs</td><td className="p-4 font-bold text-right text-gray-800">{Number(item.total_weight_kg).toFixed(3)} kg</td></tr>))}
              </tbody>
              <tfoot>
                <tr className="bg-yellow-100 border-t-4 border-yellow-300">
                  <td className="p-4 font-black text-yellow-900 text-right uppercase tracking-widest">Total Low Stock:</td>
                  <td className="p-4 font-black text-yellow-900 text-center">{totalLowQty} pcs</td>
                  <td className="p-4 font-black text-yellow-900 text-right">{totalLowWeight.toFixed(3)} kg</td>
                </tr>
              </tfoot>
            </table>
          </Modal>
        )}
      </div>

      {/* --- EDIT SALE MODAL --- */}
      {editSale && (
        <div className="fixed inset-0 bg-gray-900/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border-4 border-yellow-400">
            <h2 className="text-2xl font-black text-green-900 mb-6 border-b-2 border-gray-200 pb-2">✏️ Edit Sale Data</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date & Time</label>
                <input type="datetime-local" value={saleEditDate} onChange={(e) => setSaleEditDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Price (RM)</label>
                <input type="number" step="0.1" value={saleEditTotal} onChange={(e) => setSaleEditTotal(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Method</label>
                <select value={saleEditPay} onChange={(e) => setSaleEditPay(e.target.value)} className={inputClass}>
                  <option value="cash">💵 Cash</option>
                  <option value="qr">📱 QR DuitNow</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Order Type</label>
                <select value={saleEditType} onChange={(e) => setSaleEditType(e.target.value)} className={inputClass}>
                  <option value="eat_here">🍽️ Eat Here</option>
                  <option value="pack">🛍️ Pack</option>
                  <option value="delivery">🛵 Delivery</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setEditSale(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300">Cancel</button>
              <button onClick={handleSaveSaleEdit} className="flex-1 bg-green-600 text-white font-extrabold py-3 rounded-xl hover:bg-green-700 shadow-md">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT EXPENSE MODAL --- */}
      {editExpense && (
        <div className="fixed inset-0 bg-gray-900/90 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border-4 border-yellow-400">
            <h2 className="text-2xl font-black text-green-900 mb-6 border-b-2 border-gray-200 pb-2">✏️ Edit Expense Log</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date & Time</label>
                <input type="datetime-local" value={expEditDate} onChange={(e) => setExpEditDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                <input type="text" value={expEditCategory} onChange={(e) => setExpEditCategory(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Details / Description</label>
                <input type="text" value={expEditDesc} onChange={(e) => setExpEditDesc(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Amount (RM)</label>
                <input type="number" step="0.1" value={expEditAmount} onChange={(e) => setExpEditAmount(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setEditExpense(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300">Cancel</button>
              <button onClick={handleSaveExpenseEdit} className="flex-1 bg-green-600 text-white font-extrabold py-3 rounded-xl hover:bg-green-700 shadow-md">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* 🖨️ PROFESSIONAL PDF PRINT VIEW */}
      {/* ========================================= */}
      <div className="hidden print:block w-full text-black bg-white font-sans text-xs p-4" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        
        {/* LOGO & HEADER (COLORED) */}
        <div className="text-center mb-8 pb-4 break-inside-avoid">
          <img src="/logo.png" alt="Ah Wei 33 Durian Logo" className="w-24 h-24 mx-auto mb-2 object-cover rounded-full border-4 border-green-500" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <h1 className="text-3xl font-black uppercase tracking-widest text-green-800">Ah Wei 33 Durian</h1>
          <h2 className="text-xl font-extrabold mt-1 text-gray-800">
             {printView === 'full' ? 'Official Business Dashboard' : printView === 'sales' ? 'Sales Transaction Log' : printView === 'expenses' ? 'Business Expenses Log' : printView === 'top' ? 'Top Selling Products Report' : printView === 'viewReceipts' ? 'Document Viewer' : 'Low Inventory Report'}
          </h2>
          <div className="mt-2"><span className="text-gray-800 font-bold text-xs uppercase tracking-widest border-b border-black pb-1">Period: {getReportDateRangeString()}</span></div>
        </div>

        {/* OVERALL STATS - ONLY SHOW IN 'FULL' REPORT */}
        {printView === 'full' && (
          <div className="flex justify-between items-center mb-10 gap-4 break-inside-avoid border-b-2 border-black pb-6">
            <div className="flex-1 text-center">
              <p className="font-extrabold text-black uppercase text-[10px] tracking-wider mb-1">Total Revenue</p>
              <p className="text-2xl font-black text-black">RM {totalRevenue.toFixed(2)}</p>
            </div>
            <div className="flex-1 text-center border-l-2 border-black">
              <p className="font-extrabold text-black uppercase text-[10px] tracking-wider mb-1">Total Expenses</p>
              <p className="text-2xl font-black text-black">RM {totalExpenses.toFixed(2)}</p>
            </div>
            <div className="flex-1 text-center border-l-2 border-black">
              <p className="font-extrabold text-black uppercase text-[10px] tracking-wider mb-1">Net Profit</p>
              <p className="text-2xl font-black text-black">RM {grossProfit.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* PROFESSIONAL TABLES (NO BACKGROUND COLORS, BLACK BORDERS) */}
        {(printView === 'full' || printView === 'top') && (
          <div className="mb-10 break-inside-avoid">
            <h3 className="text-sm font-black text-black uppercase tracking-widest mb-2">Top Selling Products</h3>
            <table className="w-full text-left border-collapse border border-black print:text-[10px]">
              <thead>
                <tr>
                  <th className="border border-black p-2 font-bold uppercase">Product Type</th>
                  <th className="border border-black p-2 text-center font-bold uppercase">Weight Sold</th>
                  <th className="border border-black p-2 text-right font-bold uppercase">Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                {topSellers.map((item) => (
                  <tr key={item.type} className="break-inside-avoid">
                    <td className="border border-black p-2 font-bold">{item.type}</td>
                    <td className="border border-black p-2 text-center">{item.weight.toFixed(3)} kg</td>
                    <td className="border border-black p-2 text-right font-black">RM {item.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="border border-black p-2 font-black text-right uppercase tracking-widest">Grand Total:</td>
                  <td className="border border-black p-2 font-black text-center">{totalTopWeight.toFixed(3)} kg</td>
                  <td className="border border-black p-2 font-black text-right">RM {totalTopRev.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {(printView === 'full' || printView === 'sales') && (
          <div className="mb-10 break-inside-avoid">
            <h3 className="text-sm font-black text-black uppercase tracking-widest mb-2">Sales Transaction Log</h3>
            <table className="w-full text-left border-collapse border border-black print:text-[10px]">
              <thead>
                <tr>
                  <th className="border border-black p-2 font-bold uppercase w-1/4">Date / Order No</th>
                  <th className="border border-black p-2 font-bold uppercase w-5/12">Items Ordered</th>
                  <th className="border border-black p-2 font-bold uppercase">Details</th>
                  <th className="border border-black p-2 text-right font-bold uppercase">Total (RM)</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="break-inside-avoid">
                    <td className="border border-black p-2">
                       <div className="font-bold">{sale.order_number || 'N/A'}</div>
                       <div>{new Date(sale.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</div>
                    </td>
                    <td className="border border-black p-2">
                      {sale.cart_items && sale.cart_items.length > 0 ? (
                         sale.cart_items.map((item: any, idx: number) => (
                            <div key={idx} className="font-bold">• {item.type} <span className="font-normal">- {Number(item.weight).toFixed(3)}kg ({item.qty}pcs)</span></div>
                         ))
                      ) : (
                         <div className="font-bold">• {sale.durian_type} <span className="font-normal">- {Number(sale.weight_kg).toFixed(3)}kg</span></div>
                      )}
                    </td>
                    <td className="border border-black p-2 uppercase">
                      <div>Type: {sale.order_type === 'eat_here' ? `Eat Here` : sale.order_type === 'pack' ? 'Pack' : sale.order_type === 'delivery' ? 'Delivery' : 'Walk-in'}</div>
                      <div>Pay: {sale.payment_method}</div>
                    </td>
                    <td className="border border-black p-2 text-right font-black text-base">RM {sale.total_price.toFixed(2)}</td>
                  </tr>
                ))}
                {filteredSales.length === 0 && <tr><td colSpan={4} className="p-4 text-center border border-black">No sales recorded.</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td className="border border-black p-2 font-black text-right uppercase tracking-widest">Grand Total:</td>
                  <td className="border border-black p-2 font-black">{totalQty} units / {totalWeight.toFixed(3)} kg</td>
                  <td className="border border-black p-2"></td>
                  <td className="border border-black p-2 font-black text-right text-sm">RM {totalRevenue.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {(printView === 'full' || printView === 'expenses') && (
          <div className="mb-10 break-inside-avoid">
            <h3 className="text-sm font-black text-black uppercase tracking-widest mb-2">
              Business Expenses Log 
              {expFilterSupplier !== 'all' && ` | Supplier: ${expFilterSupplier}`}
              {expFilterType !== 'all' && ` | Product: ${expFilterType}`}
            </h3>
            <table className="w-full text-left border-collapse border border-black print:text-[10px]">
              <thead>
                <tr>
                  <th className="border border-black p-2 font-bold uppercase w-1/4">Date / User</th>
                  <th className="border border-black p-2 font-bold uppercase w-1/4">Category</th>
                  <th className="border border-black p-2 font-bold uppercase w-1/3">Details</th>
                  <th className="border border-black p-2 text-right font-bold uppercase">Amount (RM)</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="break-inside-avoid">
                    <td className="border border-black p-2">
                       <div className="font-bold">{new Date(exp.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</div>
                       <div className="uppercase">By: {exp.user_name || 'Admin'}</div>
                    </td>
                    <td className="border border-black p-2 font-bold">{exp.category}</td>
                    <td className="border border-black p-2">
                      
                      {/* Hide the auto-generated "Bought @" description if it's a restock */}
                      {!(exp.description && exp.description.startsWith('Bought @')) && (
                          <div>{exp.description}</div>
                      )}

                      {/* Detailed calculation based on weight and cost if it's a restock */}
                      {(exp.category === 'Durian Restock' || exp.category === 'Other Fruit Restock') && exp.weight_bought_kg > 0 && (
                          <div className="font-bold mt-1">
                             Total Quantity: {exp.quantity_bought || 0} units<br/>
                             Total Weight: {exp.weight_bought_kg.toFixed(3)} kg<br/>
                             Price Per Kg: RM {(Math.abs(exp.total_cost_rm) / exp.weight_bought_kg).toFixed(2)}
                          </div>
                      )}

                      {exp.supplier_name && <div className="font-bold mt-1">Supplier: {exp.supplier_name}</div>}
                    </td>
                    <td className="border border-black p-2 text-right font-black text-base">{exp.total_cost_rm < 0 ? '+' : ''}{Math.abs(exp.total_cost_rm).toFixed(2)}</td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && <tr><td colSpan={4} className="p-4 text-center border border-black">No expenses recorded.</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="border border-black p-2 font-black text-right uppercase tracking-widest">
                      <span className="text-xs font-bold tracking-normal normal-case mr-4">
                          Total Restock: {totalExpenseQty} units / {totalExpenseWeight.toFixed(3)} kg
                      </span>
                      Total Expenses:
                  </td>
                  <td className="border border-black p-2 font-black text-right text-sm">RM {totalExpenses.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {(printView === 'full' || printView === 'low') && (
          <div className="mb-10 break-inside-avoid">
            <h3 className="text-sm font-black text-black uppercase tracking-widest mb-2">Low Inventory Alerts</h3>
            <table className="w-full text-left border-collapse border border-black print:text-[10px]">
              <thead>
                <tr>
                  <th className="border border-black p-2 font-bold uppercase">Product Type</th>
                  <th className="border border-black p-2 text-center font-bold uppercase">Remaining Quantity</th>
                  <th className="border border-black p-2 text-right font-bold uppercase">Remaining Weight</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((item) => (
                  <tr key={item.type} className="break-inside-avoid">
                    <td className="border border-black p-2 font-bold">{item.type}</td>
                    <td className="border border-black p-2 text-center font-bold">{item.total_durians} units</td>
                    <td className="border border-black p-2 text-right font-bold">{Number(item.total_weight_kg).toFixed(3)} kg</td>
                  </tr>
                ))}
                {lowStock.length === 0 && <tr><td colSpan={3} className="p-4 text-center border border-black font-bold">All stock levels are healthy! ✅</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td className="border border-black p-2 font-black text-right uppercase tracking-widest">Total Low Stock:</td>
                  <td className="border border-black p-2 font-black text-center">{totalLowQty} units</td>
                  <td className="border border-black p-2 font-black text-right">{totalLowWeight.toFixed(3)} kg</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}