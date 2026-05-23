'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

// --- SHARED STYLES (STRICT GRAY, YELLOW, GREEN) ---
const inputClass = "w-full border-2 border-gray-300 p-3 rounded-xl text-black bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-400 outline-none transition-all font-semibold";
const modalBtnClass = "bg-green-600 text-white font-extrabold py-4 rounded-xl hover:bg-green-700 shadow-md transition-all active:scale-[0.98] text-lg w-full mt-4";
const deleteBtnClass = "bg-gray-200 text-gray-800 font-bold px-4 py-2 rounded-lg hover:bg-yellow-400 hover:text-black transition-colors";

// --- FIFO BATCH PROCESSOR ---
export const processBatchFIFO = (batches: any[], qtyChange: number, weightChange: number) => {
  let newBatches = [...(batches || [])];
  const todayStr = new Date().toISOString().split('T')[0];

  if (qtyChange > 0 || weightChange > 0) {
      let todayBatch = newBatches.find(b => b.date === todayStr);
      if (todayBatch) {
          todayBatch.qty += Math.max(0, qtyChange);
          todayBatch.weight += Math.max(0, weightChange);
      } else {
          newBatches.push({ date: todayStr, qty: Math.max(0, qtyChange), weight: Math.max(0, weightChange) });
      }
  } else if (qtyChange < 0 || weightChange < 0) {
      let qtyToDeduct = Math.abs(qtyChange);
      let weightToDeduct = Math.abs(weightChange);
      newBatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      for (let b of newBatches) {
          if (qtyToDeduct <= 0 && weightToDeduct <= 0) break;
          let qD = Math.min(b.qty, qtyToDeduct);
          let wD = Math.min(b.weight, weightToDeduct);
          b.qty -= qD; b.weight -= wD;
          qtyToDeduct -= qD; weightToDeduct -= wD;
      }
      newBatches = newBatches.filter(b => b.qty > 0 || b.weight > 0);
  }
  return newBatches;
};

const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
  <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4 md:p-8 backdrop-blur-sm">
    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="bg-gray-100 p-6 border-b-2 border-gray-200 flex justify-between items-center shrink-0">
        <h2 className="text-2xl font-black text-green-900">{title}</h2>
        <button onClick={onClose} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-xl font-bold hover:bg-yellow-400 transition-colors shadow-sm">✕ Close</button>
      </div>
      <div className="p-6 overflow-y-auto bg-gray-50/50">{children}</div>
    </div>
  </div>
);

function DurianRow({ item, onSave, onDelete, onViewBatches }: { item: any, onSave: (type: string, data: any) => void, onDelete: (type: string) => void, onViewBatches: (item: any) => void }) {
  const qtyRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  return (
    <tr className="border-b border-gray-200 hover:bg-yellow-50 transition-colors bg-white">
      <td className="p-4 font-extrabold text-gray-900 text-lg">
        {item.type}
        <div className="mt-2">
           <button onClick={() => onViewBatches(item)} className="text-xs bg-gray-200 hover:bg-yellow-300 text-gray-700 font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm">
              📦 Batches
           </button>
        </div>
      </td>
      <td className="p-4 align-top pt-6"><input type="number" ref={qtyRef} defaultValue={item.total_durians} className="border-2 border-gray-300 p-2 rounded-lg w-20 text-center font-bold text-black" /></td>
      <td className="p-4 align-top pt-6"><input type="number" step="0.001" ref={weightRef} defaultValue={Number(item.total_weight_kg).toFixed(3)} className="border-2 border-gray-300 p-2 rounded-lg w-28 text-center font-bold text-black" /></td>
      <td className="p-4 align-top pt-6"><input type="number" step="0.1" ref={priceRef} defaultValue={item.price_per_kg} className="border-2 border-green-300 bg-green-50 p-2 rounded-lg w-24 text-center font-bold text-green-800" /></td>
      <td className="p-4 text-center flex justify-center gap-2 align-top pt-6">
        <button onClick={() => onSave(item.type, { total_durians: qtyRef.current?.value, total_weight_kg: weightRef.current?.value, price_per_kg: priceRef.current?.value })} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm active:scale-95">Save</button>
        <button onClick={() => onDelete(item.type)} className={deleteBtnClass}>Delete</button>
      </td>
    </tr>
  );
}

function PackRow({ item, onSave, onDelete }: { item: any, onSave: (name: string, qty: string) => void, onDelete: (name: string) => void }) {
  const qtyRef = useRef<HTMLInputElement>(null);
  return (
    <tr className="border-b border-gray-200 hover:bg-yellow-50 transition-colors bg-white">
      <td className="p-4 font-extrabold text-gray-900 text-lg">{item.item_name}</td>
      <td className="p-4"><input type="number" ref={qtyRef} defaultValue={item.quantity} className="border-2 border-gray-300 p-3 rounded-xl w-32 text-center font-black text-lg text-black" /></td>
      <td className="p-4 text-center flex justify-center gap-2">
        <button onClick={() => onSave(item.item_name, qtyRef.current?.value || '0')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm active:scale-95">Save</button>
        <button onClick={() => onDelete(item.item_name)} className={deleteBtnClass}>Delete</button>
      </td>
    </tr>
  );
}

export default function AdminModule() {
  const router = useRouter();
  const [adminName, setAdminName] = useState('Unknown Admin');
  const [inventory, setInventory] = useState<any[]>([]);
  const [packInventory, setPackInventory] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [expensesList, setExpensesList] = useState<any[]>([]); 
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [viewBatchDurian, setViewBatchDurian] = useState<any>(null); // NEW: State for Batch View Modal

  // Form States
  const [stockForms, setStockForms] = useState([{ id: 1, type: '', isNew: false, newType: '', qty: '', weight: '', supplierPriceKg: '', newSellingPrice: '', isNewSupplier: false, supplierName: '', receiptFile: null as File | null }]);
  
  // Spoilage State
  const [spoilType, setSpoilType] = useState('');
  const [spoilAction, setSpoilAction] = useState('spoilage'); 
  const [spoilQty, setSpoilQty] = useState('');
  const [spoilWeight, setSpoilWeight] = useState('');
  const [spoilBatch, setSpoilBatch] = useState('auto');
  const [refundAmount, setRefundAmount] = useState('');
  
  const [packItem, setPackItem] = useState('');
  const [packQty, setPackQty] = useState('');
  const [packCost, setPackCost] = useState('');
  
  const [opCategory, setOpCategory] = useState('Staff Salary');
  const [opAmount, setOpAmount] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRate, setStaffRate] = useState('per hour');
  const [expenseReceipt, setExpenseReceipt] = useState<File | null>(null);

  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'error'|'success'}>({show: false, msg: '', type: 'success'});
  const showToast = (msg: string, type: 'error'|'success' = 'success') => {
    setToast({show: true, msg, type});
    setTimeout(() => setToast({show: false, msg: '', type: 'success'}), 4000);
  };

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase.from('profiles').select('account_name').eq('id', session.user.id).single();
      if (profile?.account_name) setAdminName(profile.account_name);
    }

    const { data: durians } = await supabase.from('durian_inventory').select('*').order('type');
    if (durians) setInventory(durians);
    
    const { data: packaging } = await supabase.from('packaging_inventory').select('*');
    if (packaging) setPackInventory(packaging);

    const { data: expenses } = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (expenses) {
       setExpensesList(expenses);
       const uniqueSuppliers = Array.from(new Set(expenses.filter(e => e.supplier_name).map(e => e.supplier_name)));
       setSuppliers(uniqueSuppliers as string[]);
    }
  };

  useEffect(() => {
    const checkAccessAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/auth');
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role !== 'super_admin') {
        alert("Access Denied. Admins only.");
        return router.push('/pos'); 
      }
      fetchData();
    };
    checkAccessAndFetch();
  }, [router]);

  const uploadFile = async (file: File | null) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
    if (uploadError) { showToast("Error uploading file: " + uploadError.message, "error"); return null; }
    const { data } = supabase.storage.from('receipts').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleAddStockRow = () => setStockForms([...stockForms, { id: Date.now(), type: '', isNew: false, newType: '', qty: '', weight: '', supplierPriceKg: '', newSellingPrice: '', isNewSupplier: false, supplierName: '', receiptFile: null }]);
  const handleRemoveStockRow = (id: number) => setStockForms(stockForms.filter(form => form.id !== id));
  const updateStockForm = (id: number, field: string, value: any) => setStockForms(prev => prev.map(form => form.id === id ? { ...form, [field]: value } : form));

  const submitMultiStockIn = async () => {
    for (const form of stockForms) {
      const actualType = form.isNew ? form.newType.trim() : form.type;
      if (!actualType || !form.qty || !form.weight || !form.newSellingPrice || !form.supplierPriceKg) {
        return showToast("Please fill all required fields for all durians!", "error");
      }

      if (window.confirm(`Confirm stock in for ${form.qty} pcs of ${actualType}?`)) {
        const receiptUrl = await uploadFile(form.receiptFile);

        const existing = inventory.find(i => i.type.toLowerCase() === actualType.toLowerCase());
        const updatedBatches = processBatchFIFO(existing?.stock_batches || [], parseInt(form.qty), parseFloat(form.weight));

        if (existing) {
          await supabase.from('durian_inventory').update({ 
            total_durians: existing.total_durians + parseInt(form.qty), 
            total_weight_kg: existing.total_weight_kg + parseFloat(form.weight), 
            price_per_kg: parseFloat(form.newSellingPrice),
            stock_batches: updatedBatches
          }).eq('type', existing.type);
        } else {
          await supabase.from('durian_inventory').insert({ 
            type: actualType, total_durians: parseInt(form.qty), total_weight_kg: parseFloat(form.weight), price_per_kg: parseFloat(form.newSellingPrice), stock_batches: updatedBatches 
          });
        }

        const totalCost = parseFloat(form.weight) * parseFloat(form.supplierPriceKg);
        await supabase.from('expenses').insert({ 
          category: 'Durian Restock', durian_type: actualType, quantity_bought: parseInt(form.qty), 
          weight_bought_kg: parseFloat(form.weight), total_cost_rm: totalCost, 
          description: `Bought @ RM${form.supplierPriceKg}/kg`,
          user_name: adminName, supplier_name: form.supplierName, receipt_url: receiptUrl
        });
      }
    }
    showToast("✅ Stock updated and logged successfully!");
    setStockForms([{ id: Date.now(), type: '', isNew: false, newType: '', qty: '', weight: '', supplierPriceKg: '', newSellingPrice: '', isNewSupplier: false, supplierName: '', receiptFile: null }]);
    fetchData();
    setActiveModal(null);
  };

  const handleSpoilage = async () => {
    if (!spoilType || !spoilQty || !spoilWeight) return showToast("Please fill required fields", "error");
    const target = inventory.find(i => i.type === spoilType);
    if (!target) return;

    if (window.confirm(`Log ${spoilAction.replace('_', ' ')} for ${spoilQty} pcs of ${spoilType}?`)) {
      
      let updatedBatches = [...(target.stock_batches || [])];

      if (spoilAction === 'spoilage' || spoilAction === 'return_supplier') {
        
        // DEDUCT FROM BATCHES
        if (spoilBatch === 'auto') {
          updatedBatches = processBatchFIFO(updatedBatches, -parseInt(spoilQty), -parseFloat(spoilWeight));
        } else {
          const bIdx = parseInt(spoilBatch);
          const selectedB = updatedBatches[bIdx];
          if (parseInt(spoilQty) > selectedB.qty || parseFloat(spoilWeight) > selectedB.weight) {
             return showToast(`❌ Cannot deduct more than what's in this batch! (Max: ${selectedB.qty}pcs / ${selectedB.weight}kg)`, "error");
          }
          selectedB.qty -= parseInt(spoilQty);
          selectedB.weight -= parseFloat(spoilWeight);
          updatedBatches = updatedBatches.filter(b => b.qty > 0 || b.weight > 0); // Remove empty batches
        }

        const lostValue = parseFloat(spoilWeight) * target.price_per_kg;
        await supabase.from('spoilage_returns').insert({ durian_type: spoilType, action_type: spoilAction, quantity: parseInt(spoilQty), weight_kg: parseFloat(spoilWeight), lost_value: lostValue, user_name: adminName });
        await supabase.from('durian_inventory').update({ total_durians: target.total_durians - parseInt(spoilQty), total_weight_kg: target.total_weight_kg - parseFloat(spoilWeight), stock_batches: updatedBatches }).eq('type', spoilType);
        
        if (spoilAction === 'return_supplier' && refundAmount) {
          await supabase.from('expenses').insert({ category: 'Supplier Refund', durian_type: spoilType, total_cost_rm: -Math.abs(parseFloat(refundAmount)), description: `Refund for ${spoilWeight}kg of ${spoilType}`, user_name: adminName });
        }
      } 
      else if (spoilAction === 'customer_return') {
        // ADD BACK TO BATCHES
        updatedBatches = processBatchFIFO(updatedBatches, parseInt(spoilQty), parseFloat(spoilWeight));
        
        await supabase.from('spoilage_returns').insert({ durian_type: spoilType, action_type: 'customer_return', quantity: parseInt(spoilQty), weight_kg: parseFloat(spoilWeight), lost_value: 0, user_name: adminName });
        await supabase.from('durian_inventory').update({ total_durians: target.total_durians + parseInt(spoilQty), total_weight_kg: target.total_weight_kg + parseFloat(spoilWeight), stock_batches: updatedBatches }).eq('type', spoilType);
        
        if (refundAmount) {
          await supabase.from('expenses').insert({ category: 'Customer Refund', durian_type: spoilType, total_cost_rm: Math.abs(parseFloat(refundAmount)), description: `Customer Return: ${spoilWeight}kg of ${spoilType}`, user_name: adminName });
        }
      }
      
      showToast(`✅ Action logged successfully!`);
      setSpoilQty(''); setSpoilWeight(''); setSpoilType(''); setRefundAmount(''); setSpoilBatch('auto');
      fetchData();
      setActiveModal(null);
    }
  };

  const handlePackStockIn = async () => {
    if (!packItem || !packQty || !packCost) return showToast("Please fill all fields", "error");
    if (window.confirm(`Add ${packQty} units to ${packItem}?`)) {
      const target = packInventory.find(p => p.item_name === packItem);
      
      if (target) await supabase.from('packaging_inventory').update({ quantity: target.quantity + parseInt(packQty) }).eq('item_name', packItem);
      else await supabase.from('packaging_inventory').insert({ item_name: packItem, quantity: parseInt(packQty) });
      
      await supabase.from('expenses').insert({ category: 'Packaging', total_cost_rm: parseFloat(packCost), description: `${packQty}x ${packItem}`, user_name: adminName });
      showToast(`✅ Packaging added!`);
      setPackQty(''); setPackItem(''); setPackCost('');
      fetchData();
      setActiveModal(null);
    }
  };

  const handleOpExpense = async () => {
    if (!opAmount) return showToast("Enter amount", "error");
    if (window.confirm(`Log ${opCategory} expense of RM${opAmount}?`)) {
      let desc = opCategory;
      if (opCategory === 'Staff Salary') desc = `Staff: ${staffName} (${staffRate})`;
      const receiptUrl = await uploadFile(expenseReceipt);
      await supabase.from('expenses').insert({ category: opCategory, total_cost_rm: parseFloat(opAmount), description: desc, user_name: adminName, receipt_url: receiptUrl });
      showToast(`✅ Expense logged!`);
      setOpAmount(opCategory === 'Shop Rent' ? '1800' : ''); setStaffName(''); setExpenseReceipt(null);
      fetchData();
      setActiveModal(null);
    }
  };

  const deleteDurian = async (type: string) => {
    if (window.confirm(`⚠️ WARNING: Are you sure you want to completely delete ${type} from inventory?`)) {
      await supabase.from('durian_inventory').delete().eq('type', type);
      showToast(`✅ Deleted ${type}`);
      fetchData();
    }
  };

  const deletePackaging = async (name: string) => {
    if (window.confirm(`⚠️ WARNING: Are you sure you want to completely delete ${name}?`)) {
      await supabase.from('packaging_inventory').delete().eq('item_name', name);
      showToast(`✅ Deleted ${name}`);
      fetchData();
    }
  };

  const selectedSpoilDurian = inventory.find(i => i.type === spoilType);
  const availableBatches = selectedSpoilDurian?.stock_batches || [];

  return (
    <div className="pb-10 text-black bg-gray-50 min-h-screen relative">
      
      {/* TOP NAVIGATION BAR */}
      <div className="flex justify-between items-center bg-gray-200 p-3 shadow-sm print:hidden w-full">
        <div className="flex gap-2">
          <button onClick={() => router.back()} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-bold transition-colors">← Back</button>
          <button onClick={() => window.location.reload()} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-bold transition-colors">🔄 Refresh</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/profile')} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-colors">👤 Profile</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth'); }} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 px-4 py-2 rounded-lg font-bold transition-colors">🚪 Logout</button>
        </div>
      </div>

      {toast.show && (
        <div className={`fixed top-10 left-1/2 transform -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-2xl font-extrabold text-lg transition-all animate-bounce ${toast.type === 'error' ? 'bg-yellow-400 text-black' : 'bg-green-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-200 m-4 mt-8">
        <div>
          <h1 className="text-4xl font-black text-green-900 tracking-tight">Inventory Management</h1>
          <p className="text-gray-500 font-bold mt-1">User: <span className="text-green-700">{adminName}</span></p>
        </div>
      </div>
      
      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
        <button onClick={() => router.push('/today_sales')} className="bg-green-500 text-white p-8 rounded-3xl shadow-lg hover:bg-green-600 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">📊</span><div><h3 className="text-xl font-black group-hover:underline">Today's Sales</h3><p className="font-bold text-green-900 mt-1">Live tracking & Edits</p></div>
        </button>
        <button onClick={() => setActiveModal('stockIn')} className="bg-green-600 text-white p-8 rounded-3xl shadow-lg hover:bg-green-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">📥</span><div><h3 className="text-xl font-black group-hover:underline">Durian Stock In</h3><p className="font-medium text-green-100 mt-1">Add batches & supplier</p></div>
        <button onClick={() => setActiveModal('packStock')} className="bg-gray-200 text-gray-800 p-8 rounded-3xl shadow-lg border-2 border-gray-300 hover:bg-gray-300 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">🛍️</span><div><h3 className="text-xl font-black group-hover:underline">Pack Restock</h3><p className="font-bold text-gray-600 mt-1">Add bags & boxes</p></div>
        </button>
        </button>
        <button onClick={() => setActiveModal('spoilage')} className="bg-yellow-500 text-black p-8 rounded-3xl shadow-lg hover:bg-yellow-600 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">🔄</span><div><h3 className="text-xl font-black group-hover:underline">Spoilage & Returns</h3><p className="font-bold text-yellow-900 mt-1">Record lost & returns</p></div>
        </button>
        <button onClick={() => setActiveModal('expenses')} className="bg-gray-800 text-white p-8 rounded-3xl shadow-lg hover:bg-black hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">💸</span><div><h3 className="text-xl font-black group-hover:underline">Log Expenses</h3><p className="font-medium text-gray-300 mt-1">Rent, Staff & Bills</p></div>
        </button>
        <button onClick={() => setActiveModal('viewReceipts')} className="bg-gray-600 text-white p-8 rounded-3xl shadow-lg hover:bg-gray-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">📄</span><div><h3 className="text-xl font-black group-hover:underline">View Documents</h3><p className="font-bold text-gray-300 mt-1">Check logs & docs</p></div>
        </button>
        <button onClick={() => setActiveModal('manageDurian')} className="bg-white border-4 border-green-600 text-green-900 p-8 rounded-3xl shadow-lg hover:bg-green-50 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">✏️</span><div><h3 className="text-xl font-black group-hover:underline">Edit Durians</h3><p className="font-bold text-green-700 mt-1">Modify/Delete</p></div>
        </button>
        <button onClick={() => setActiveModal('managePack')} className="bg-white border-4 border-yellow-500 text-yellow-900 p-8 rounded-3xl shadow-lg hover:bg-yellow-50 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">📦</span><div><h3 className="text-xl font-black group-hover:underline">Edit Packaging</h3><p className="font-bold text-yellow-800 mt-1">Modify/Delete</p></div>
        </button>
      </div>

      {/* --- MODALS --- */}

      {/* DOCUMENT VIEWER MODAL */}
      {activeModal === 'viewReceipts' && (
        <Modal title="📄 Document & Expense Viewer" onClose={() => setActiveModal(null)}>
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
                {expensesList.map(exp => (
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
                        <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="bg-green-100 text-green-700 border border-green-300 px-4 py-2 rounded-lg font-bold hover:bg-green-200 text-xs shadow-sm">
                          📄 View Document
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs font-bold">No Document</span>
                      )}
                    </td>
                  </tr>
                ))}
                {expensesList.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500 font-bold">No expenses or documents found.</td></tr>}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* STOCK IN WITH SUPPLIER DROPDOWN */}
      {activeModal === 'stockIn' && (
        <Modal title="📥 Durian Stock In" onClose={() => setActiveModal(null)}>
          <button onClick={handleAddStockRow} className="mb-4 bg-gray-200 text-gray-800 font-bold px-5 py-2.5 rounded-xl hover:bg-yellow-400 shadow-sm transition-colors w-full md:w-auto">+ Add Another Durian</button>
          <div className="space-y-6">
            {stockForms.map((form, index) => (
              <div key={form.id} className="p-6 bg-gray-50 border-2 border-gray-200 rounded-2xl relative shadow-sm">
                {stockForms.length > 1 && ( <button onClick={() => handleRemoveStockRow(form.id)} className="absolute top-4 right-4 text-red-500 font-bold">✕ Remove</button> )}
                <h3 className="font-extrabold mb-4 text-green-900 text-lg border-b-2 border-gray-200 pb-2">Durian #{index + 1}</h3>
                <div className="grid md:grid-cols-5 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase">Durian Type</label>
                    {!form.isNew ? (
                      <select value={form.type} onChange={(e) => { if (e.target.value === 'ADD_NEW') updateStockForm(form.id, 'isNew', true); else updateStockForm(form.id, 'type', e.target.value); }} className={inputClass}>
                        <option value="">Select Type...</option>{inventory.map(i => <option key={i.type} value={i.type}>{i.type}</option>)}<option value="ADD_NEW" className="font-bold text-green-600">+ New Type</option>
                      </select>
                    ) : (
                      <div className="flex gap-2"><input type="text" placeholder="New name..." onChange={e=>updateStockForm(form.id, 'newType', e.target.value)} className={inputClass} /><button onClick={() => updateStockForm(form.id, 'isNew', false)} className="bg-gray-300 px-4 rounded-xl font-bold">✕</button></div>
                    )}
                  </div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase">Quantity</label><input type="number" onChange={e=>updateStockForm(form.id, 'qty', e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase">Weight</label><input type="number" step="0.001" onChange={e=>updateStockForm(form.id, 'weight', e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase">Supplier Price/kg</label><input type="number" step="0.1" onChange={e=>updateStockForm(form.id, 'supplierPriceKg', e.target.value)} className={inputClass} /></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase">Selling Price/kg</label><input type="number" step="0.1" onChange={e=>updateStockForm(form.id, 'newSellingPrice', e.target.value)} className="w-full border-2 border-green-300 p-3 rounded-xl bg-green-50 font-bold" /></div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 mt-4 border-t-2 border-gray-200 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supplier Name</label>
                    {!form.isNewSupplier ? (
                      <select value={form.supplierName} onChange={(e) => { if(e.target.value === 'ADD_NEW') updateStockForm(form.id, 'isNewSupplier', true); else updateStockForm(form.id, 'supplierName', e.target.value); }} className={inputClass}>
                         <option value="">Select Supplier...</option>
                         {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                         <option value="ADD_NEW" className="font-bold text-green-600">+ New Supplier</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                         <input type="text" placeholder="New Supplier..." onChange={e=>updateStockForm(form.id, 'supplierName', e.target.value)} className={inputClass} />
                         <button onClick={() => updateStockForm(form.id, 'isNewSupplier', false)} className="bg-gray-300 px-4 rounded-xl font-bold">✕</button>
                      </div>
                    )}
                  </div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Upload Document (Optional)</label><input type="file" accept="image/*,.pdf" onChange={e=>updateStockForm(form.id, 'receiptFile', e.target.files?.[0] || null)} className={inputClass} /></div>
                </div>
              </div>
            ))}
            <button onClick={submitMultiStockIn} className={modalBtnClass}>Submit All Stock In</button>
          </div>
        </Modal>
      )}

      {/* SPOILAGE & RETURNS UPGRADED TO BATCH SELECTION */}
      {activeModal === 'spoilage' && (
        <Modal title="🔄 Spoilage & Returns" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <select value={spoilType} onChange={e=>{setSpoilType(e.target.value); setSpoilBatch('auto');}} className={inputClass}>
               <option value="">Select Durian...</option>
               {inventory.map(i => <option key={i.type} value={i.type}>{i.type}</option>)}
            </select>
            
            <select value={spoilAction} onChange={e=>setSpoilAction(e.target.value)} className={inputClass}>
               <option value="spoilage">🗑️ Spoilage (Rotten/Lost) [- Deduct Stock]</option>
               <option value="return_supplier">🚚 Return to Supplier [- Deduct Stock, Get Refund]</option>
               <option value="customer_return">🔄 Customer Return [+ Add Back Stock, Issue Refund]</option>
            </select>
            
            {/* NEW BATCH SELECTOR - Only shown when deducting stock */}
            {spoilType && (spoilAction === 'spoilage' || spoilAction === 'return_supplier') && availableBatches.length > 0 && (
               <div className="bg-gray-100 p-4 rounded-xl border border-gray-300">
                 <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Select Which Batch To Remove From:</label>
                 <select value={spoilBatch} onChange={e=>setSpoilBatch(e.target.value)} className={inputClass}>
                   <option value="auto">⚡ Auto (Deduct Oldest First / All Batches)</option>
                   {availableBatches.map((b:any, idx:number) => (
                     <option key={idx} value={idx}>Batch: {b.date} - Available: {b.qty}pcs / {Number(b.weight).toFixed(3)}kg</option>
                   ))}
                 </select>
               </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <input type="number" placeholder="Qty (pcs)" value={spoilQty} onChange={e=>setSpoilQty(e.target.value)} className={inputClass} />
              <input type="number" step="0.001" placeholder="Weight (kg)" value={spoilWeight} onChange={e=>setSpoilWeight(e.target.value)} className={inputClass} />
            </div>
            
            {(spoilAction === 'return_supplier' || spoilAction === 'customer_return') && (
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mt-4">
                <label className="text-sm font-bold text-yellow-900 block mb-2">Refund Amount (RM)</label>
                <input type="number" step="0.1" placeholder="RM refunded..." value={refundAmount} onChange={e=>setRefundAmount(e.target.value)} className={inputClass} />
                <p className="text-xs text-yellow-700 mt-2 font-medium">This will automatically adjust your total expenses/revenue logs.</p>
              </div>
            )}

            <button onClick={handleSpoilage} className={modalBtnClass}>Submit Action</button>
          </div>
        </Modal>
      )}

      {activeModal === 'expenses' && (
        <Modal title="💸 Log Expenses" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <select value={opCategory} onChange={e=>setOpCategory(e.target.value)} className={inputClass}>
               <option value="Staff Salary">👨‍💼 Staff Salary</option><option value="Shop Rent">🏢 Shop Rent</option><option value="Utilities">⚡ Utilities</option><option value="Petrol">⛽ Petrol</option><option value="Other">Other</option>
            </select>
            {opCategory === 'Staff Salary' && (
              <div className="flex gap-4">
                <input type="text" placeholder="Staff Name" value={staffName} onChange={e=>setStaffName(e.target.value)} className={inputClass} />
                <select value={staffRate} onChange={e=>setStaffRate(e.target.value)} className={inputClass}><option value="per hour">Per Hour</option><option value="per month">Per Month</option></select>
              </div>
            )}
            <input type="number" step="0.1" placeholder="Total RM" value={opAmount} onChange={e=>setOpAmount(e.target.value)} className="w-full border-2 border-yellow-300 p-5 rounded-2xl bg-yellow-50 text-2xl font-black text-black" />
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Upload Document (Optional)</label>
              <input type="file" accept="image/*,.pdf" onChange={e=>setExpenseReceipt(e.target.files?.[0] || null)} className={inputClass} />
            </div>
            <button onClick={handleOpExpense} className={modalBtnClass}>Log Expense</button>
          </div>
        </Modal>
      )}

      {activeModal === 'packStock' && (
        <Modal title="🛍️ Packaging Restock" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <div className="flex gap-4 mb-4">
               {packInventory.map(p => ( <div key={p.id} className="flex-1 bg-gray-100 p-4 rounded-xl text-center border-2 border-gray-300"><span className="block text-xs font-bold uppercase text-black">{p.item_name}</span><span className="text-xl font-black text-black">{p.quantity}</span></div> ))}
            </div>
            <select value={packItem} onChange={e=>setPackItem(e.target.value)} className={inputClass}><option value="">Select Item...</option><option value="Plastic Bag">Plastic Bag</option><option value="Tupperware M">Tupperware M</option><option value="Tupperware L">Tupperware L</option></select>
            <div className="flex gap-4">
              <input type="number" placeholder="Qty Add" value={packQty} onChange={e=>setPackQty(e.target.value)} className={inputClass} />
              <input type="number" step="0.1" placeholder="Cost (RM)" value={packCost} onChange={e=>setPackCost(e.target.value)} className={inputClass} />
            </div>
            <button onClick={handlePackStockIn} className={modalBtnClass}>Add Packaging Stock</button>
          </div>
        </Modal>
      )}

      {/* MANAGE DURIANS TABLE */}
      {activeModal === 'manageDurian' && (
        <Modal title="✏️ Edit/Delete Durians" onClose={() => setActiveModal(null)}>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[600px]">
              <thead><tr className="border-b-4 border-green-600"><th className="p-4">Type</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Weight</th><th className="p-4 text-center">Price</th><th className="p-4 text-center">Actions</th></tr></thead>
              <tbody>
                {inventory.map(item => (
                  <DurianRow key={item.type} item={item} 
                    onViewBatches={(item) => setViewBatchDurian(item)}
                    onDelete={deleteDurian} 
                    onSave={async (type, data) => {
                      const existingItem = inventory.find(i => i.type === type);
                      const updatedBatches = processBatchFIFO(existingItem?.stock_batches || [], parseInt(data.total_durians) - existingItem.total_durians, parseFloat(data.total_weight_kg) - existingItem.total_weight_kg);
                      await supabase.from('durian_inventory').update({ total_durians: parseInt(data.total_durians), total_weight_kg: parseFloat(data.total_weight_kg), price_per_kg: parseFloat(data.price_per_kg), stock_batches: updatedBatches }).eq('type', type);
                      showToast(`✅ ${type} updated!`); fetchData();
                  }} />
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* NEW MODAL: BATCH VIEWER */}
      {viewBatchDurian && (
        <div className="fixed inset-0 bg-gray-900/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border-4 border-green-500">
             <div className="flex justify-between items-center border-b-2 border-gray-200 pb-2 mb-4">
                <h3 className="text-2xl font-black text-green-900">📦 Stock Batches: {viewBatchDurian.type}</h3>
                <button onClick={() => setViewBatchDurian(null)} className="text-gray-500 font-bold hover:text-red-500 text-xl">✕</button>
             </div>
             <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {(!viewBatchDurian.stock_batches || viewBatchDurian.stock_batches.length === 0) ? (
                   <p className="text-gray-500 italic text-center py-4">No specific batches tracked yet.</p>
                ) : (
                   viewBatchDurian.stock_batches.map((b:any, i:number) => (
                      <div key={i} className={`p-4 rounded-xl border-2 flex justify-between items-center ${b.date === new Date().toISOString().split('T')[0] ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                         <div>
                            <span className="block text-xs font-bold text-gray-500 uppercase">{b.date === new Date().toISOString().split('T')[0] ? '🆕 New (Today)' : '📦 Old Stock'}</span>
                            <span className="text-lg font-black text-gray-800">{b.date}</span>
                         </div>
                         <div className="text-right">
                            <span className="block font-black text-green-700">{b.qty} pcs</span>
                            <span className="text-sm font-bold text-gray-600">{Number(b.weight).toFixed(3)} kg</span>
                         </div>
                      </div>
                   ))
                )}
             </div>
          </div>
        </div>
      )}

      {activeModal === 'managePack' && (
        <Modal title="📦 Edit/Delete Packaging" onClose={() => setActiveModal(null)}>
          <table className="w-full text-left">
            <thead><tr className="border-b-4 border-yellow-500"><th className="p-4">Item Name</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Actions</th></tr></thead>
            <tbody>
              {packInventory.map(item => (
                <PackRow key={item.item_name} item={item} onDelete={deletePackaging} onSave={async (name, qty) => {
                    await supabase.from('packaging_inventory').update({ quantity: parseInt(qty) }).eq('item_name', name);
                    showToast(`✅ ${name} updated!`); fetchData();
                }} />
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}