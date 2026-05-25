'use client'
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

// --- SHARED STYLES ---
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
        <div className="mt-2 flex gap-2">
           <button onClick={() => onViewBatches(item)} className="text-xs bg-gray-200 hover:bg-yellow-300 text-gray-700 font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm">
              📦 Batches
           </button>
           {item.image_url && <span className="text-xs bg-green-100 text-green-800 font-bold py-1.5 px-3 rounded-lg">🖼️ Has Image</span>}
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
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [viewBatchDurian, setViewBatchDurian] = useState<any>(null); 

  // Form States for Stock In (Combined)
  const [stockForms, setStockForms] = useState([{ id: 1, category: 'Durian', type: '', isNew: false, newType: '', qty: '', weight: '', supplierPriceKg: '', newSellingPrice: '', isNewSupplier: false, supplierName: '', receiptFile: null as File | null }]);
  
  // Spoilage State
  const [spoilType, setSpoilType] = useState('');
  const [spoilAction, setSpoilAction] = useState('spoilage'); 
  const [spoilQty, setSpoilQty] = useState('');
  const [spoilWeight, setSpoilWeight] = useState('');
  const [spoilBatch, setSpoilBatch] = useState('auto');
  const [refundAmount, setRefundAmount] = useState('');
  
  // Pack Stock In State
  const [packItem, setPackItem] = useState('');
  const [packQty, setPackQty] = useState('');
  const [packCost, setPackCost] = useState('');
  
  // Operating Expenses State
  const [opCategory, setOpCategory] = useState('Staff Salary');
  const [opAmount, setOpAmount] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRate, setStaffRate] = useState('per hour');
  const [expenseReceipt, setExpenseReceipt] = useState<File | null>(null);

  // Advanced Mix Tupperware Assembly State
  const [mixSources, setMixSources] = useState([{ id: Date.now(), durianType: '', pcs: '', weight: '' }]);
  const [mixSourcePack, setMixSourcePack] = useState('');
  const [mixNumTup, setMixNumTup] = useState('');
  const [mixTotalRM, setMixTotalRM] = useState('');
  const [mixImageFile, setMixImageFile] = useState<File | null>(null);

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

  const handleAddStockRow = () => setStockForms([...stockForms, { id: Date.now(), category: 'Durian', type: '', isNew: false, newType: '', qty: '', weight: '', supplierPriceKg: '', newSellingPrice: '', isNewSupplier: false, supplierName: '', receiptFile: null }]);
  const handleRemoveStockRow = (id: number) => setStockForms(stockForms.filter(form => form.id !== id));
  const updateStockForm = (id: number, field: string, value: any) => setStockForms(prev => prev.map(form => form.id === id ? { ...form, [field]: value } : form));

  const submitMultiStockIn = async () => {
    for (const form of stockForms) {
      const actualType = form.isNew ? form.newType.trim() : form.type;
      if (!actualType || !form.qty || !form.weight || !form.newSellingPrice || !form.supplierPriceKg) {
        return showToast("Please fill all required fields!", "error");
      }

      if (window.confirm(`Confirm stock in for ${form.qty} pcs of ${actualType}?`)) {
        const receiptUrl = await uploadFile(form.receiptFile);
        const existing = inventory.find(i => i.type.toLowerCase() === actualType.toLowerCase());
        const updatedBatches = processBatchFIFO(existing?.stock_batches || [], parseInt(form.qty), parseFloat(form.weight));
        const expenseCategory = form.category === 'Durian' ? 'Durian Restock' : 'Other Fruit Restock';

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
          category: expenseCategory, durian_type: actualType, quantity_bought: parseInt(form.qty), 
          weight_bought_kg: parseFloat(form.weight), total_cost_rm: totalCost, 
          description: `Bought @ RM${form.supplierPriceKg}/kg`,
          user_name: adminName, supplier_name: form.supplierName, receipt_url: receiptUrl
        });
      }
    }
    showToast(`✅ Stock updated and logged successfully!`);
    setStockForms([{ id: Date.now(), category: 'Durian', type: '', isNew: false, newType: '', qty: '', weight: '', supplierPriceKg: '', newSellingPrice: '', isNewSupplier: false, supplierName: '', receiptFile: null }]);
    fetchData();
    setActiveModal(null);
  };

  // Mix Tupperware Assembly Setup
  const handleAddMixSource = () => setMixSources([...mixSources, { id: Date.now(), durianType: '', pcs: '', weight: '' }]);
  const handleRemoveMixSource = (id: number) => setMixSources(mixSources.filter(src => src.id !== id));
  const updateMixSource = (id: number, field: string, value: string) => setMixSources(prev => prev.map(src => src.id === id ? { ...src, [field]: value } : src));

  const submitMixTupperware = async () => {
    if (!mixSourcePack || !mixNumTup || !mixTotalRM || mixSources.some(s => !s.durianType || !s.weight)) {
      return showToast("Please fill all required fields for all durians and packaging", "error");
    }

    const packData = packInventory.find(p => p.item_name === mixSourcePack);
    if (!packData || packData.quantity < parseInt(mixNumTup)) return showToast("Not enough packaging in inventory!", "error");

    // Validate stock for all selected durians
    for (const src of mixSources) {
       const durianData = inventory.find(i => i.type === src.durianType);
       if (!durianData || durianData.total_weight_kg < parseFloat(src.weight)) {
           return showToast(`Not enough stock for ${src.durianType}!`, "error");
       }
    }

    const totalMixWeight = mixSources.reduce((sum, src) => sum + parseFloat(src.weight), 0);
    const mixName = `Mix Durians in ${mixSourcePack}`;

    if (window.confirm(`Confirm creating ${mixNumTup}x ${mixName} (${totalMixWeight}kg total)?`)) {
      
      // 1. Upload Optional Image
      const imageUrl = await uploadFile(mixImageFile);

      // 2. Deduct Source Items
      for (const src of mixSources) {
          const durianData = inventory.find(i => i.type === src.durianType);
          const pcsToDeduct = parseInt(src.pcs) || 0;
          const updatedSourceBatches = processBatchFIFO(durianData.stock_batches || [], -pcsToDeduct, -parseFloat(src.weight));
          
          await supabase.from('durian_inventory').update({
            total_durians: Math.max(0, durianData.total_durians - pcsToDeduct),
            total_weight_kg: Math.max(0, durianData.total_weight_kg - parseFloat(src.weight)),
            stock_batches: updatedSourceBatches
          }).eq('type', src.durianType);
      }

      // 3. Deduct Tupperware
      await supabase.from('packaging_inventory').update({
        quantity: Math.max(0, packData.quantity - parseInt(mixNumTup))
      }).eq('item_name', mixSourcePack);

      // 4. Add New Mixed Item to Inventory
      const existingMix = inventory.find(i => i.type === mixName);
      const pricePerKg = parseFloat(mixTotalRM) / totalMixWeight; 
      
      if (existingMix) {
        const updatedMixBatches = processBatchFIFO(existingMix.stock_batches || [], parseInt(mixNumTup), totalMixWeight);
        await supabase.from('durian_inventory').update({
          total_durians: existingMix.total_durians + parseInt(mixNumTup),
          total_weight_kg: existingMix.total_weight_kg + totalMixWeight,
          price_per_kg: pricePerKg,
          stock_batches: updatedMixBatches,
          image_url: imageUrl || existingMix.image_url // keep old if none uploaded
        }).eq('type', mixName);
      } else {
        const newBatches = processBatchFIFO([], parseInt(mixNumTup), totalMixWeight);
        await supabase.from('durian_inventory').insert({
          type: mixName,
          total_durians: parseInt(mixNumTup),
          total_weight_kg: totalMixWeight,
          price_per_kg: pricePerKg,
          stock_batches: newBatches,
          image_url: imageUrl
        });
      }

      showToast("✅ Mix Durians Assembly Completed!");
      setMixSources([{ id: Date.now(), durianType: '', pcs: '', weight: '' }]); 
      setMixSourcePack(''); setMixNumTup(''); setMixTotalRM(''); setMixImageFile(null);
      setActiveModal(null);
      fetchData();
    }
  };

  const handleSpoilage = async () => {
    if (!spoilType || !spoilQty || !spoilWeight) return showToast("Please fill required fields", "error");
    const target = inventory.find(i => i.type === spoilType);
    if (!target) return;

    if (window.confirm(`Log ${spoilAction.replace('_', ' ')} for ${spoilQty} pcs of ${spoilType}?`)) {
      let updatedBatches = [...(target.stock_batches || [])];

      if (spoilAction === 'spoilage' || spoilAction === 'return_supplier') {
        if (spoilBatch === 'auto') {
          updatedBatches = processBatchFIFO(updatedBatches, -parseInt(spoilQty), -parseFloat(spoilWeight));
        } else {
          const bIdx = parseInt(spoilBatch);
          const selectedB = updatedBatches[bIdx];
          if (parseInt(spoilQty) > selectedB.qty || parseFloat(spoilWeight) > selectedB.weight) {
             return showToast(`❌ Cannot deduct more than what's in this batch!`, "error");
          }
          selectedB.qty -= parseInt(spoilQty);
          selectedB.weight -= parseFloat(spoilWeight);
          updatedBatches = updatedBatches.filter(b => b.qty > 0 || b.weight > 0); 
        }

        const lostValue = parseFloat(spoilWeight) * target.price_per_kg;
        await supabase.from('spoilage_returns').insert({ durian_type: spoilType, action_type: spoilAction, quantity: parseInt(spoilQty), weight_kg: parseFloat(spoilWeight), lost_value: lostValue, user_name: adminName });
        await supabase.from('durian_inventory').update({ total_durians: target.total_durians - parseInt(spoilQty), total_weight_kg: target.total_weight_kg - parseFloat(spoilWeight), stock_batches: updatedBatches }).eq('type', spoilType);
        
        if (spoilAction === 'return_supplier' && refundAmount) {
          await supabase.from('expenses').insert({ category: 'Supplier Refund', durian_type: spoilType, total_cost_rm: -Math.abs(parseFloat(refundAmount)), description: `Refund for ${spoilWeight}kg of ${spoilType}`, user_name: adminName });
        }
      } 
      else if (spoilAction === 'customer_return') {
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
          <span className="text-4xl">📥</span><div><h3 className="text-xl font-black group-hover:underline">Product Stock In</h3><p className="font-medium text-green-100 mt-1">Add Durians & Fruits</p></div>
        </button>

        <button onClick={() => setActiveModal('mixTupperware')} className="bg-purple-600 text-white p-8 rounded-3xl shadow-lg hover:bg-purple-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">🍱</span><div><h3 className="text-xl font-black group-hover:underline">Mix Assembly</h3><p className="font-medium text-purple-200 mt-1">Pack multiple durians</p></div>
        </button>

        <button onClick={() => setActiveModal('packStock')} className="bg-gray-200 text-gray-800 p-8 rounded-3xl shadow-lg border-2 border-gray-300 hover:bg-gray-300 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">🛍️</span><div><h3 className="text-xl font-black group-hover:underline">Packaging Stock In</h3><p className="font-bold text-gray-600 mt-1">Add bags & boxes</p></div>
        </button>
        
        <button onClick={() => setActiveModal('manageInventory')} className="bg-white border-4 border-green-600 text-green-900 p-8 rounded-3xl shadow-lg hover:bg-green-50 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">✏️</span><div><h3 className="text-xl font-black group-hover:underline">Manage Inventory</h3><p className="font-bold text-green-700 mt-1">Modify/Delete Products</p></div>
        </button>

        <button onClick={() => setActiveModal('spoilage')} className="bg-yellow-500 text-black p-8 rounded-3xl shadow-lg hover:bg-yellow-600 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">🔄</span><div><h3 className="text-xl font-black group-hover:underline">Spoilage & Returns</h3><p className="font-bold text-yellow-900 mt-1">Record lost & returns</p></div>
        </button>
        
        <button onClick={() => setActiveModal('expenses')} className="bg-gray-800 text-white p-8 rounded-3xl shadow-lg hover:bg-black hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">💸</span><div><h3 className="text-xl font-black group-hover:underline">Log Expenses</h3><p className="font-medium text-gray-300 mt-1">Rent, Staff & Bills</p></div>
        </button>
        
        <button onClick={() => setActiveModal('managePack')} className="bg-white border-4 border-yellow-500 text-yellow-900 p-8 rounded-3xl shadow-lg hover:bg-yellow-50 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">📦</span><div><h3 className="text-xl font-black group-hover:underline">Edit Packaging</h3><p className="font-bold text-yellow-800 mt-1">Modify/Delete</p></div>
        </button>
      </div>

      {/* --- MODALS --- */}

      {/* COMBINED STOCK IN */}
      {activeModal === 'stockIn' && (
        <Modal title="📥 Product Stock In" onClose={() => setActiveModal(null)}>
          <button onClick={handleAddStockRow} className="mb-4 bg-gray-200 text-gray-800 font-bold px-5 py-2.5 rounded-xl hover:bg-yellow-400 shadow-sm transition-colors w-full md:w-auto">+ Add Another Item</button>
          <div className="space-y-6">
            {stockForms.map((form, index) => (
              <div key={form.id} className="p-6 bg-gray-50 border-2 border-gray-200 rounded-2xl relative shadow-sm">
                {stockForms.length > 1 && ( <button onClick={() => handleRemoveStockRow(form.id)} className="absolute top-4 right-4 text-red-500 font-bold">✕ Remove</button> )}
                <h3 className="font-extrabold mb-4 text-green-900 text-lg border-b-2 border-gray-200 pb-2">Item #{index + 1}</h3>
                
                <div className="mb-4 flex gap-4">
                  <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="radio" name={`cat-${form.id}`} checked={form.category === 'Durian'} onChange={() => updateStockForm(form.id, 'category', 'Durian')} /> Durian</label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="radio" name={`cat-${form.id}`} checked={form.category === 'Other Fruit'} onChange={() => updateStockForm(form.id, 'category', 'Other Fruit')} /> Other Fruit</label>
                </div>

                <div className="grid md:grid-cols-5 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase">{form.category} Type</label>
                    {!form.isNew ? (
                      <select value={form.type} onChange={(e) => { if (e.target.value === 'ADD_NEW') updateStockForm(form.id, 'isNew', true); else updateStockForm(form.id, 'type', e.target.value); }} className={inputClass}>
                        <option value="">Select Type...</option>
                        {inventory.map(i => <option key={i.type} value={i.type}>{i.type}</option>)}
                        <option value="ADD_NEW" className="font-bold text-green-600">+ Add New {form.category}</option>
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

      {/* ADVANCED MIX DURIANS TUPPERWARE ASSEMBLY */}
      {activeModal === 'mixTupperware' && (
        <Modal title="🍱 Mix Durians in Tupperware Assembly" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl mb-4">
              <p className="text-purple-800 font-bold text-sm">Create a new packaged item by combining multiple existing durian stocks and tupperware packaging.</p>
            </div>
            
            <div className="bg-white border-2 border-gray-200 p-4 rounded-2xl mb-4">
               <h3 className="font-bold text-gray-700 uppercase tracking-widest text-xs mb-3">Durians Included in Mix:</h3>
               {mixSources.map((src, idx) => (
                  <div key={src.id} className="grid grid-cols-12 gap-3 mb-3 items-end">
                     <div className="col-span-5">
                       <label className="block text-[10px] font-bold text-gray-500 uppercase">Durian Type</label>
                       <select value={src.durianType} onChange={e=>updateMixSource(src.id, 'durianType', e.target.value)} className={inputClass}>
                         <option value="">Select Existing...</option>
                         {inventory.map(i => <option key={i.type} value={i.type}>{i.type}</option>)}
                       </select>
                     </div>
                     <div className="col-span-3">
                       <label className="block text-[10px] font-bold text-gray-500 uppercase">Pcs Deduct</label>
                       <input type="number" value={src.pcs} onChange={e=>updateMixSource(src.id, 'pcs', e.target.value)} className={inputClass} placeholder="Pcs" />
                     </div>
                     <div className="col-span-3">
                       <label className="block text-[10px] font-bold text-gray-500 uppercase">Weight (kg)</label>
                       <input type="number" step="0.001" value={src.weight} onChange={e=>updateMixSource(src.id, 'weight', e.target.value)} className={inputClass} placeholder="kg" />
                     </div>
                     <div className="col-span-1">
                        {mixSources.length > 1 && <button onClick={() => handleRemoveMixSource(src.id)} className="w-full bg-red-100 text-red-600 font-bold h-[52px] rounded-xl hover:bg-red-200">✕</button>}
                     </div>
                  </div>
               ))}
               <button onClick={handleAddMixSource} className="text-sm font-bold text-purple-600 bg-purple-100 px-4 py-2 rounded-lg hover:bg-purple-200">+ Add Another Durian to Mix</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tupperware Used</label>
                <select value={mixSourcePack} onChange={e=>setMixSourcePack(e.target.value)} className={inputClass}>
                  <option value="">Select Packaging...</option>
                  {packInventory.map(p => <option key={p.id} value={p.item_name}>{p.item_name} ({p.quantity} left)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Number of Tupperware</label>
                <input type="number" value={mixNumTup} onChange={e=>setMixNumTup(e.target.value)} className={inputClass} placeholder="Qty created" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t-2 border-gray-200 pt-4 mt-2">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Upload Picture of Mix (Shows in POS)</label>
                <input type="file" accept="image/*" onChange={e=>setMixImageFile(e.target.files?.[0] || null)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Overall Value/Selling Price (RM)</label>
                <input type="number" step="0.1" value={mixTotalRM} onChange={e=>setMixTotalRM(e.target.value)} className={inputClass} placeholder="Total RM for this assembly" />
              </div>
            </div>
            
            <button onClick={submitMixTupperware} className={modalBtnClass}>Confirm Assembly</button>
          </div>
        </Modal>
      )}

      {/* SPOILAGE & RETURNS UPGRADED TO BATCH SELECTION */}
      {activeModal === 'spoilage' && (
        <Modal title="🔄 Spoilage & Returns" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <select value={spoilType} onChange={e=>{setSpoilType(e.target.value); setSpoilBatch('auto');}} className={inputClass}>
               <option value="">Select Item...</option>
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

      {/* COMBINED MANAGE INVENTORY TABLE */}
      {activeModal === 'manageInventory' && (
        <Modal title="✏️ Manage Inventory (Durians & Fruits)" onClose={() => setActiveModal(null)}>
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

      {/* BATCH VIEWER */}
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