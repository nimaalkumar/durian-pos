'use client'
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function StatisticsPage() {
  const router = useRouter();
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  
  // FILTERS
  const [timeRange, setTimeRange] = useState('month');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [metric, setMetric] = useState('sales');

  // ADVANCED COMPARISON STATE
  const [compareMode, setCompareMode] = useState('today_vs_yesterday');
  const [compStart1, setCompStart1] = useState(new Date().toISOString().split('T')[0]);
  const [compEnd1, setCompEnd1] = useState(new Date().toISOString().split('T')[0]);
  const [compStart2, setCompStart2] = useState(new Date(Date.now() - 86400000).toISOString().split('T')[0]);
  const [compEnd2, setCompEnd2] = useState(new Date(Date.now() - 86400000).toISOString().split('T')[0]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: salesData } = await supabase.from('sales').select('*').order('created_at', { ascending: true });
      if (salesData) setSales(salesData);
      
      const { data: expData } = await supabase.from('expenses').select('*').order('created_at', { ascending: true });
      if (expData) setExpenses(expData);
      
      const { data: invData } = await supabase.from('durian_inventory').select('*');
      if (invData) setInventory(invData);
    };
    fetchData();
  }, []);

  const now = new Date();
  
  const filterByTime = (dataArray: any[]) => {
    return dataArray.filter(item => {
      const targetDate = new Date(item.created_at);
      if (timeRange === 'today') return targetDate.toDateString() === now.toDateString();
      if (timeRange === 'week') return targetDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (timeRange === 'month') return targetDate.getMonth() === now.getMonth() && targetDate.getFullYear() === now.getFullYear();
      if (timeRange === 'year') return targetDate.getFullYear() === now.getFullYear();
      if (timeRange === 'custom' && customDate) {
        const [year, month, day] = customDate.split('-');
        return targetDate.getFullYear() === parseInt(year) && targetDate.getMonth() + 1 === parseInt(month) && targetDate.getDate() === parseInt(day);
      }
      return true; 
    });
  };

  const getReportDateRangeString = () => {
    const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (metric === 'compare') {
       if (compareMode === 'today_vs_yesterday') return 'Today vs Yesterday';
       if (compareMode === 'this_week_vs_last_week') return 'This Week vs Last Week';
       if (compareMode === 'this_month_vs_last_month') return 'This Month vs Last Month';
       if (compareMode === 'this_year_vs_last_year') return 'This Year vs Last Year';
       if (compareMode === 'last_3_vs_prev_3') return 'Last 3 Days vs Prev 3 Days';
       if (compareMode === 'custom') return `${formatDate(new Date(compStart1))} to ${formatDate(new Date(compEnd1))} VS ${formatDate(new Date(compStart2))} to ${formatDate(new Date(compEnd2))}`;
    }

    if (timeRange === 'today') return formatDate(now);
    if (timeRange === 'week') return `${formatDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))} - ${formatDate(now)}`;
    if (timeRange === 'month') return `${formatDate(new Date(now.getFullYear(), now.getMonth(), 1))} - ${formatDate(now)}`;
    if (timeRange === 'year') return `${formatDate(new Date(now.getFullYear(), 0, 1))} - ${formatDate(now)}`;
    if (timeRange === 'custom' && customDate) return formatDate(new Date(customDate));
    
    // For 'All Time'
    let earliestDate = now;
    const allDates = [...sales.map(s => new Date(s.created_at).getTime()), ...expenses.map(e => new Date(e.created_at).getTime())];
    if (allDates.length > 0) earliestDate = new Date(Math.min(...allDates));
    return `${formatDate(earliestDate)} - ${formatDate(now)}`;
  };

  // --- DATA AGGREGATION ---
  const generateTrendData = () => {
    const aggregated: Record<string, number> = {};
    const dataset = metric === 'sales' ? filterByTime(sales) : filterByTime(expenses);
    dataset.forEach(item => {
      const dateStr = new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const val = metric === 'sales' ? Number(item.total_price) : Math.abs(Number(item.total_cost_rm));
      aggregated[dateStr] = (aggregated[dateStr] || 0) + val;
    });
    const dataArr = Object.entries(aggregated).map(([date, value]) => ({ date, value }));
    const maxVal = Math.max(...dataArr.map(d => d.value), 10);
    return { dataArr, maxVal };
  };

  const getTopSellers = () => {
    const filteredSales = filterByTime(sales);
    const salesByDurian: Record<string, number> = {};
    filteredSales.forEach(s => {
      if (s.cart_items && s.cart_items.length > 0) {
        s.cart_items.forEach((item: any) => { salesByDurian[item.type] = (salesByDurian[item.type] || 0) + Number(item.total_price); });
      } else {
        salesByDurian[s.durian_type] = (salesByDurian[s.durian_type] || 0) + Number(s.total_price);
      }
    });
    return Object.entries(salesByDurian).map(([type, revenue]) => ({ type, revenue })).sort((a, b) => b.revenue - a.revenue);
  };

  const topSellers = getTopSellers();
  const topSellersMax = Math.max(...topSellers.map(t => t.revenue), 10);
  
  const lowStock = inventory.filter(i => i.total_weight_kg < 5 || i.total_durians < 5).sort((a, b) => a.total_weight_kg - b.total_weight_kg);
  const lowStockMax = Math.max(...lowStock.map(t => t.total_weight_kg), 10);

  // --- ADVANCED COMPARISON ENGINE ---
  const getComparisonData = () => {
    let p1Start = new Date(), p1End = new Date(), p2Start = new Date(), p2End = new Date();
    let label1 = "Period 1", label2 = "Period 2";

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);

    if (compareMode === 'today_vs_yesterday') {
      p1Start = todayStart; p1End = todayEnd;
      p2Start = new Date(todayStart.getTime() - 86400000); p2End = new Date(todayEnd.getTime() - 86400000);
      label1 = "Today"; label2 = "Yesterday";
    } else if (compareMode === 'last_3_vs_prev_3') {
      p1Start = new Date(todayStart.getTime() - 2 * 86400000); p1End = todayEnd;
      p2Start = new Date(p1Start.getTime() - 3 * 86400000); p2End = new Date(p1Start.getTime() - 1);
      label1 = "Last 3 Days"; label2 = "Prev 3 Days";
    } else if (compareMode === 'this_week_vs_last_week') {
      p1Start = new Date(todayStart.getTime() - 6 * 86400000); p1End = todayEnd;
      p2Start = new Date(p1Start.getTime() - 7 * 86400000); p2End = new Date(p1Start.getTime() - 1);
      label1 = "This Week"; label2 = "Last Week";
    } else if (compareMode === 'this_month_vs_last_month') {
      p1Start = new Date(now.getFullYear(), now.getMonth(), 1); p1End = todayEnd;
      p2Start = new Date(now.getFullYear(), now.getMonth() - 1, 1); p2End = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      label1 = "This Month"; label2 = "Last Month";
    } else if (compareMode === 'this_year_vs_last_year') {
      p1Start = new Date(now.getFullYear(), 0, 1); p1End = todayEnd;
      p2Start = new Date(now.getFullYear() - 1, 0, 1); p2End = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      label1 = "This Year"; label2 = "Last Year";
    } else if (compareMode === 'custom') {
      p1Start = new Date(compStart1); p1Start.setHours(0,0,0,0); p1End = new Date(compEnd1); p1End.setHours(23,59,59,999);
      p2Start = new Date(compStart2); p2Start.setHours(0,0,0,0); p2End = new Date(compEnd2); p2End.setHours(23,59,59,999);
      label1 = "Custom Range 1"; label2 = "Custom Range 2";
    }

    let p1Sales = 0; let p2Sales = 0;
    sales.forEach(s => {
      const d = new Date(s.created_at).getTime();
      if (d >= p1Start.getTime() && d <= p1End.getTime()) p1Sales += Number(s.total_price);
      if (d >= p2Start.getTime() && d <= p2End.getTime()) p2Sales += Number(s.total_price);
    });

    return { p1Sales, p2Sales, diff: p1Sales - p2Sales, label1, label2 };
  };

  const { dataArr: trendData, maxVal } = generateTrendData();
  const compareData = getComparisonData();

  // Reusable SVG calculations
  const graphWidth = 1000;
  const graphHeight = 300;
  const xStep = trendData.length > 1 ? graphWidth / (trendData.length - 1) : graphWidth;
  const polylinePoints = trendData.map((d, i) => `${i * xStep},${graphHeight - ((d.value / maxVal) * graphHeight)}`).join(' ');

  const inputClass = "border-2 border-gray-300 p-2.5 rounded-xl text-black bg-gray-50 font-bold focus:ring-2 focus:ring-green-400 outline-none text-sm";

  return (
    <div className="pb-10 bg-gray-100 min-h-screen text-black">
      
      

      {/* 🖥️ INTERACTIVE VIEW */}
      <div className="print:hidden p-4">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-4">
            <div><h1 className="text-4xl font-black text-gray-900 tracking-tight">Statistics & Trends</h1></div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="border-2 border-green-300 p-3 rounded-xl text-green-900 bg-green-50 font-bold focus:ring-2 focus:ring-green-500 outline-none">
              <option value="sales">📈 Sales Trend</option>
              <option value="expenses">📉 Expenses Trend</option>
              <option value="top_sellers">🏆 Top Sellers Breakdown</option>
              <option value="low_inventory">⚠️ Low Inventory Chart</option>
              <option value="compare">⚖️ Compare Sales Data</option>
            </select>

            {metric !== 'compare' && metric !== 'low_inventory' && (
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="border-2 border-gray-300 p-3 rounded-xl text-black bg-gray-50 font-bold focus:ring-2 focus:ring-green-400 outline-none">
                <option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="year">This Year</option><option value="custom">Custom Date</option><option value="all">All Time</option>
              </select>
            )}
            
            {metric !== 'compare' && timeRange === 'custom' && (
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="border-2 border-gray-300 p-3 rounded-xl text-black bg-gray-50 font-bold" />
            )}

            <button onClick={() => {setTimeout(()=>window.print(), 100)}} className="ml-4 bg-gray-800 text-white px-6 py-3 rounded-xl font-black hover:bg-black shadow-lg transition-transform active:scale-95">🖨️ Print Graph & Table</button>
          </div>
        </div>

        {/* COMPARISON SETTINGS (Only shows if compare is selected) */}
        {metric === 'compare' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center justify-center">
             <label className="font-bold text-gray-700">Select Comparison Type:</label>
             <select value={compareMode} onChange={e=>setCompareMode(e.target.value)} className={inputClass}>
               <option value="today_vs_yesterday">Today vs Yesterday</option>
               <option value="last_3_vs_prev_3">Last 3 Days vs Prev 3 Days</option>
               <option value="this_week_vs_last_week">This Week vs Last Week</option>
               <option value="this_month_vs_last_month">This Month vs Last Month</option>
               <option value="this_year_vs_last_year">This Year vs Last Year</option>
               <option value="custom">📅 Custom Date Ranges</option>
             </select>

             {compareMode === 'custom' && (
               <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-xl border border-gray-200">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-green-700">Period 1 (Primary)</span>
                    <div className="flex gap-2"><input type="date" value={compStart1} onChange={e=>setCompStart1(e.target.value)} className={inputClass}/> <input type="date" value={compEnd1} onChange={e=>setCompEnd1(e.target.value)} className={inputClass}/></div>
                  </div>
                  <span className="font-black text-gray-400">VS</span>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-500">Period 2 (Comparison)</span>
                    <div className="flex gap-2"><input type="date" value={compStart2} onChange={e=>setCompStart2(e.target.value)} className={inputClass}/> <input type="date" value={compEnd2} onChange={e=>setCompEnd2(e.target.value)} className={inputClass}/></div>
                  </div>
               </div>
             )}
          </div>
        )}

        {metric === 'compare' ? (
          <div className="bg-white p-10 rounded-3xl shadow-lg border border-gray-200 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[450px]">
            <h2 className="text-3xl font-black text-gray-800 mb-10">Sales Comparison Data</h2>
            <div className="flex justify-center items-end gap-16 h-80 w-full border-b-4 border-gray-200 pb-2 relative mt-4">
               
               {/* Period 2 Bar (Yesterday / Past) */}
               <div className="flex flex-col items-center w-36 group">
                 <div className="bg-gray-400 w-full rounded-t-xl transition-all shadow-md flex items-end justify-center pb-4 text-white font-bold opacity-80 group-hover:opacity-100" 
                      style={{ height: `${Math.max((compareData.p2Sales / Math.max(compareData.p1Sales, compareData.p2Sales, 1)) * 200, 40)}px` }}>
                 </div>
                 <div className="mt-4 text-center">
                   <p className="font-bold text-gray-500 uppercase tracking-widest text-xs h-8 flex items-center justify-center">{compareData.label2}</p>
                   <p className="font-black text-2xl text-gray-800">RM {compareData.p2Sales.toFixed(0)}</p>
                 </div>
               </div>

               {/* Period 1 Bar (Today / Current) */}
               <div className="flex flex-col items-center w-36 group">
                 <div className="bg-green-500 w-full rounded-t-xl transition-all shadow-lg flex items-end justify-center pb-4 text-white font-bold" 
                      style={{ height: `${Math.max((compareData.p1Sales / Math.max(compareData.p1Sales, compareData.p2Sales, 1)) * 200, 40)}px` }}>
                 </div>
                 <div className="mt-4 text-center">
                   <p className="font-bold text-green-700 uppercase tracking-widest text-xs h-8 flex items-center justify-center">{compareData.label1}</p>
                   <p className="font-black text-2xl text-green-900">RM {compareData.p1Sales.toFixed(0)}</p>
                 </div>
               </div>
            </div>

            <div className="mt-12 text-center">
              {compareData.diff >= 0 ? (
                 <p className="text-2xl font-bold text-green-700 bg-green-50 px-6 py-2 rounded-full border border-green-200">🚀 Up RM {compareData.diff.toFixed(2)} vs {compareData.label2}</p>
              ) : (
                 <p className="text-2xl font-bold text-yellow-700 bg-yellow-50 px-6 py-2 rounded-full border border-yellow-200">📉 Down RM {Math.abs(compareData.diff).toFixed(2)} vs {compareData.label2}</p>
              )}
            </div>
          </div>
        ) : metric === 'top_sellers' ? (
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-black text-gray-800 mb-8 uppercase tracking-widest">Top Selling Durians by Revenue</h2>
            {topSellers.length === 0 ? (
               <div className="h-[350px] flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"><p className="text-xl font-bold text-gray-400">No sales data found for this period.</p></div>
            ) : (
               <div className="space-y-6">
                 {topSellers.map((item, i) => (
                    <div key={item.type} className="flex items-center gap-4">
                       <div className="w-1/4 text-right font-black text-gray-800">{i===0?'🥇':i===1?'🥈':i===2?'🥉':''}{item.type}</div>
                       <div className="w-2/4 bg-gray-100 rounded-full h-8 overflow-hidden flex"><div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${(item.revenue / topSellersMax) * 100}%` }}></div></div>
                       <div className="w-1/4 font-black text-green-700 text-lg">RM {item.revenue.toFixed(2)}</div>
                    </div>
                 ))}
               </div>
            )}
          </div>
        ) : metric === 'low_inventory' ? (
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-black text-gray-800 mb-8 uppercase tracking-widest">Low Inventory Weight Tracker</h2>
            {lowStock.length === 0 ? (
               <div className="h-[350px] flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"><p className="text-xl font-bold text-green-600">All stock levels are healthy! ✅</p></div>
            ) : (
               <div className="space-y-6">
                 {lowStock.map((item) => (
                    <div key={item.type} className="flex items-center gap-4">
                       <div className="w-1/4 text-right font-black text-gray-800">{item.type}</div>
                       <div className="w-2/4 bg-gray-100 rounded-full h-8 overflow-hidden flex"><div className="bg-yellow-500 h-full rounded-full transition-all" style={{ width: `${(item.total_weight_kg / lowStockMax) * 100}%` }}></div></div>
                       <div className="w-1/4 font-black text-yellow-700 text-lg">{item.total_weight_kg.toFixed(3)} kg <span className="text-sm font-bold text-gray-400 ml-2">({item.total_durians} pcs)</span></div>
                    </div>
                 ))}
               </div>
            )}
          </div>
        ) : (
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-black text-gray-800 mb-8 uppercase tracking-widest">{metric === 'sales' ? 'Sales Revenue Trend' : 'Business Expenses Trend'}</h2>
            {trendData.length === 0 ? (
               <div className="h-[350px] flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"><p className="text-xl font-bold text-gray-400">No data available for this period.</p></div>
            ) : (
              <div className="relative h-[400px] w-full pt-10">
                <div className="absolute left-0 top-0 h-[350px] w-full flex flex-col justify-between z-0">
                   <div className="border-t-2 border-gray-100 w-full text-xs text-gray-400 font-bold -mt-3">RM {maxVal.toFixed(0)}</div>
                   <div className="border-t-2 border-gray-100 w-full text-xs text-gray-400 font-bold -mt-3">RM {(maxVal/2).toFixed(0)}</div>
                   <div className="border-t-2 border-gray-400 w-full"></div>
                </div>
                <svg viewBox={`-10 -10 ${graphWidth + 20} ${graphHeight + 20}`} className="w-full h-[350px] overflow-visible relative z-10 drop-shadow-xl" preserveAspectRatio="none">
                  {/* Strict Green for sales, Yellow for expenses */}
                  <polyline points={polylinePoints} fill="none" stroke={metric === 'sales' ? '#22c55e' : '#eab308'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                  {trendData.map((d, i) => (
                    <circle key={i} cx={i * xStep} cy={graphHeight - ((d.value / maxVal) * graphHeight)} r="8" fill="white" stroke={metric === 'sales' ? '#15803d' : '#ca8a04'} strokeWidth="4" className="hover:r-12 transition-all cursor-pointer"><title>{d.date}: RM {d.value.toFixed(2)}</title></circle>
                  ))}
                </svg>
                <div className="absolute bottom-[-30px] left-0 w-full flex justify-between px-2 text-xs font-bold text-gray-500">
                  {trendData.map((d, i) => ( <div key={i} className="text-center" style={{ width: `${100 / trendData.length}%` }}>{d.date}</div> ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================= */}
      {/* 🖨️ PERFECT PDF PRINT VIEW (GRAPHS + TABLES) */}
      {/* ========================================= */}
      <div className="hidden print:block w-full text-black bg-white font-sans text-xs p-8" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        
        <div className="text-center mb-8 pb-4 border-b-4 border-green-600">
          <img src="/logo.png" alt="Logo" className="w-24 h-24 mx-auto mb-2 object-cover rounded-full border-4 border-green-500" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <h1 className="text-3xl font-black uppercase tracking-widest text-green-800">Ah Wei 33 Durian</h1>
          <h2 className="text-xl font-extrabold mt-1 text-gray-800">
             {metric === 'compare' ? 'Sales Comparison Report' : metric === 'sales' ? 'Sales Trend Analysis' : metric === 'expenses' ? 'Expenses Trend Analysis' : metric === 'top_sellers' ? 'Top Sellers Analysis' : 'Low Inventory Report'}
          </h2>
          <div className="mt-2"><span className="text-gray-800 font-bold bg-yellow-100 px-4 py-1.5 rounded-full border border-yellow-300 inline-block text-xs">Reporting Period: {getReportDateRangeString()}</span></div>
        </div>

        {metric === 'compare' ? (
          <div className="text-center border-4 border-gray-200 p-8 rounded-3xl break-inside-avoid">
             <h3 className="text-xl font-black text-gray-800 uppercase tracking-widest mb-6">Sales Comparison</h3>
             <div className="flex justify-center items-center gap-16">
               <div>
                 <p className="text-gray-500 font-bold uppercase mb-2">{compareData.label2}</p>
                 <p className="text-3xl font-black">RM {compareData.p2Sales.toFixed(2)}</p>
               </div>
               <div className="text-3xl font-black text-gray-300">VS</div>
               <div>
                 <p className="text-green-700 font-bold uppercase mb-2">{compareData.label1}</p>
                 <p className="text-3xl font-black text-green-800">RM {compareData.p1Sales.toFixed(2)}</p>
               </div>
             </div>
             <div className="mt-8 text-center font-bold text-base">
                Net Difference: RM {compareData.diff.toFixed(2)}
             </div>
          </div>
        ) : metric === 'top_sellers' ? (
          <div className="break-inside-avoid">
            <div className="mb-8 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
               <div className="space-y-3">
                 {topSellers.map((item, i) => (
                    <div key={item.type} className="flex items-center gap-4">
                       <div className="w-1/4 text-right font-black text-gray-800 text-xs">{item.type}</div>
                       <div className="w-2/4 bg-gray-200 rounded-full h-4 overflow-hidden flex"><div className="bg-green-500 h-full rounded-full" style={{ width: `${(item.revenue / topSellersMax) * 100}%` }}></div></div>
                       <div className="w-1/4 font-black text-green-800 text-xs">RM {item.revenue.toFixed(2)}</div>
                    </div>
                 ))}
               </div>
            </div>
            {/* Using print:break-before-page for table */}
            <table className="w-full text-left border-collapse border-2 border-gray-300 print:break-before-page">
              <thead><tr className="bg-green-50"><th className="border-b-2 border-green-200 p-2 font-bold text-green-900">Durian Type</th><th className="border-b-2 border-green-200 p-2 text-right font-bold text-green-900">Revenue Generated</th></tr></thead>
              <tbody>
                 {topSellers.map((item, i) => (
                   <tr key={i} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-yellow-50/40'}`}><td className="p-2 font-bold">{item.type}</td><td className="p-2 text-right font-black text-green-700">RM {item.revenue.toFixed(2)}</td></tr>
                 ))}
                 {topSellers.length === 0 && <tr><td colSpan={2} className="p-2 text-center">No sales data.</td></tr>}
              </tbody>
              <tfoot>
                 <tr className="bg-green-100 border-t-2 border-green-300">
                    <td className="p-2 font-black text-right uppercase tracking-widest text-green-900">Total Revenue:</td>
                    <td className="p-2 font-black text-right text-sm text-green-900">RM {topSellers.reduce((a,b)=>a+b.revenue,0).toFixed(2)}</td>
                 </tr>
              </tfoot>
            </table>
          </div>
        ) : metric === 'low_inventory' ? (
          <div className="break-inside-avoid">
             <div className="mb-8 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
               <div className="space-y-3">
                 {lowStock.map((item) => (
                    <div key={item.type} className="flex items-center gap-4">
                       <div className="w-1/4 text-right font-black text-gray-800 text-xs">{item.type}</div>
                       <div className="w-2/4 bg-gray-200 rounded-full h-4 overflow-hidden flex"><div className="bg-yellow-500 h-full rounded-full" style={{ width: `${(item.total_weight_kg / lowStockMax) * 100}%` }}></div></div>
                       <div className="w-1/4 font-black text-yellow-800 text-xs">{item.total_weight_kg.toFixed(3)} kg</div>
                    </div>
                 ))}
               </div>
             </div>
            <table className="w-full text-left border-collapse border-2 border-gray-300 print:break-before-page">
              <thead><tr className="bg-green-50"><th className="border-b-2 border-green-200 p-2 font-bold text-green-900">Durian Type</th><th className="border-b-2 border-green-200 p-2 text-center font-bold text-green-900">Pieces</th><th className="border-b-2 border-green-200 p-2 text-right font-bold text-green-900">Weight</th></tr></thead>
              <tbody>
                 {lowStock.map((item, i) => (
                   <tr key={i} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-yellow-50/40'}`}><td className="p-2 font-bold text-yellow-900">{item.type}</td><td className="p-2 text-center text-yellow-700 font-bold">{item.total_durians} pcs</td><td className="p-2 text-right font-black text-yellow-700">{item.total_weight_kg.toFixed(3)} kg</td></tr>
                 ))}
                 {lowStock.length === 0 && <tr><td colSpan={3} className="p-2 text-center text-green-600 font-bold">No low stock. All healthy!</td></tr>}
              </tbody>
              <tfoot>
                 <tr className="bg-yellow-100 border-t-2 border-yellow-300">
                    <td className="p-2 font-black text-yellow-900 text-right uppercase tracking-widest">Grand Total:</td>
                    <td className="p-2 font-black text-yellow-900 text-center">{lowStock.reduce((a,b)=>a+b.total_durians,0)} pcs</td>
                    <td className="p-2 font-black text-yellow-900 text-right">{lowStock.reduce((a,b)=>a+b.total_weight_kg,0).toFixed(3)} kg</td>
                 </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="break-inside-avoid">
            {trendData.length > 0 && (
              <div className="relative h-[250px] w-full pt-6 mb-10">
                <div className="absolute left-0 top-0 h-[220px] w-full flex flex-col justify-between z-0">
                   <div className="border-t-2 border-gray-200 w-full text-[10px] text-gray-500 font-bold -mt-2">RM {maxVal.toFixed(0)}</div>
                   <div className="border-t-2 border-gray-200 w-full text-[10px] text-gray-500 font-bold -mt-2">RM {(maxVal/2).toFixed(0)}</div>
                   <div className="border-t-2 border-gray-500 w-full"></div>
                </div>
                <svg viewBox={`-10 -10 ${graphWidth + 20} ${graphHeight + 20}`} className="w-full h-[220px] overflow-visible relative z-10" preserveAspectRatio="none">
                  <polyline points={polylinePoints} fill="none" stroke={metric === 'sales' ? '#22c55e' : '#eab308'} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                  {trendData.map((d, i) => (
                    <circle key={i} cx={i * xStep} cy={graphHeight - ((d.value / maxVal) * graphHeight)} r="12" fill="white" stroke={metric === 'sales' ? '#15803d' : '#ca8a04'} strokeWidth="6" />
                  ))}
                </svg>
                <div className="absolute bottom-[-20px] left-0 w-full flex justify-between px-2 text-[10px] font-bold text-gray-600">
                  {trendData.map((d, i) => ( <div key={i} className="text-center" style={{ width: `${100 / trendData.length}%` }}>{d.date}</div> ))}
                </div>
              </div>
            )}

            <table className="w-full text-left border-collapse border-2 border-gray-300 print:break-before-page">
              <thead>
                <tr className="bg-green-50">
                  <th className="border-b-2 border-green-200 p-2 text-green-900 font-bold w-1/2">Date</th>
                  <th className="border-b-2 border-green-200 p-2 text-right text-green-900 font-bold w-1/2">Total Amount (RM)</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((d, index) => (
                  <tr key={index} className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-yellow-50/40'}`}>
                    <td className="p-2 font-bold text-gray-800">{d.date}</td>
                    <td className={`p-2 text-right font-black ${metric === 'sales' ? 'text-green-700' : 'text-yellow-700'}`}>RM {d.value.toFixed(2)}</td>
                  </tr>
                ))}
                {trendData.length === 0 && <tr><td colSpan={2} className="p-2 text-center">No trend data.</td></tr>}
              </tbody>
              <tfoot>
                 <tr className="bg-green-100 border-t-2 border-green-300">
                    <td className="p-2 font-black text-green-900 text-right uppercase tracking-widest">Grand Total:</td>
                    <td className={`p-2 font-black text-right text-sm ${metric === 'sales' ? 'text-green-800' : 'text-yellow-800'}`}>RM {trendData.reduce((a,b)=>a+b.value,0).toFixed(2)}</td>
                 </tr>
              </tfoot>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}