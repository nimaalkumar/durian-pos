'use client'
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminModule() {
  const router = useRouter();
  const [inventory, setInventory] = useState<any[]>([]);
  const [packInventory, setPackInventory] = useState<any[]>([]);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const [stockForms, setStockForms] = useState([{ id: 1, type: '', isNew: false, newType: '', qty: '', weight: '', supplierPriceKg: '', newSellingPrice: '' }]);
  const [spoilType, setSpoilType] = useState('');
  const [spoilAction, setSpoilAction] = useState('spoilage'); 
  const [spoilQty, setSpoilQty] = useState('');
  const [spoilWeight, setSpoilWeight] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [packItem, setPackItem] = useState('');
  const [packQty, setPackQty] = useState('');
  const [packCost, setPackCost] = useState('');
  const [opCategory, setOpCategory] = useState('Staff Salary');
  const [opAmount, setOpAmount] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRate, setStaffRate] = useState('per hour');

  const [editInventory, setEditInventory] = useState<Record<string, any>>({});
  const [editPackData, setEditPackData] = useState<Record<string, any>>({});

  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'error'|'success'}>({show: false, msg: '', type: 'success'});
  
  const showToast = (msg: string, type: 'error'|'success' = 'success') => {
    setToast({show: true, msg, type});
    setTimeout(() => setToast({show: false, msg: '', type: 'success'}), 4000);
  };

  const fetchData = async () => {
    const { data: durians } = await supabase.from('durian_inventory').select('*').order('type');
    if (durians) {
      setInventory(durians);
      const edits: Record<string, any> = {};
      durians.forEach(d => { edits[d.type] = { total_durians: d.total_durians, total_weight_kg: d.total_weight_kg, price_per_kg: d.price_per_kg }; });
      setEditInventory(edits);
    }
    const { data: packaging } = await supabase.from('packaging_inventory').select('*');
    if (packaging) {
      setPackInventory(packaging);
      const packEdits: Record<string, any> = {};
      packaging.forEach(p => { packEdits[p.item_name] = { quantity: p.quantity }; });
      setEditPackData(packEdits);
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

  const handleAddStockRow = () => setStockForms([...stockForms, { id: Date.now(), type: '', isNew: false, newType: '', qty: '', weight: '', supplierPriceKg: '', newSellingPrice: '' }]);
  const handleRemoveStockRow = (id: number) => setStockForms(stockForms.filter(form => form.id !== id));
  const updateStockForm = (id: number, field: string, value: any) => setStockForms(prev => prev.map(form => form.id === id ? { ...form, [field]: value } : form));

  const submitMultiStockIn = async () => {
    for (const form of stockForms) {
      const actualType = form.isNew ? form.newType.trim() : form.type;
      if (!actualType || !form.qty || !form.weight || !form.newSellingPrice || !form.supplierPriceKg) {
        return showToast("Please fill all fields for all durians!", "error");
      }
      const existing = inventory.find(i => i.type.toLowerCase() === actualType.toLowerCase());
      if (existing) {
        await supabase.from('durian_inventory').update({ total_durians: existing.total_durians + parseInt(form.qty), total_weight_kg: existing.total_weight_kg + parseFloat(form.weight), price_per_kg: parseFloat(form.newSellingPrice) }).eq('type', existing.type);
      } else {
        await supabase.from('durian_inventory').insert({ type: actualType, total_durians: parseInt(form.qty), total_weight_kg: parseFloat(form.weight), price_per_kg: parseFloat(form.newSellingPrice) });
      }
      const totalCost = parseFloat(form.weight) * parseFloat(form.supplierPriceKg);
      await supabase.from('expenses').insert({ category: 'Durian Restock', durian_type: actualType, quantity_bought: parseInt(form.qty), weight_bought_kg: parseFloat(form.weight), total_cost_rm: totalCost, description: `Bought @ RM${form.supplierPriceKg}/kg` });
    }
    showToast("All Durian Stocks updated and Expenses logged!");
    setStockForms([{ id: Date.now(), type: '', isNew: false, newType: '', qty: '', weight: '', supplierPriceKg: '', newSellingPrice: '' }]);
    fetchData();
    setActiveModal(null);
  };

  const handleSpoilage = async () => {
    if (!spoilType || !spoilQty || !spoilWeight) return showToast("Please fill required fields", "error");
    const target = inventory.find(i => i.type === spoilType);
    if (!target) return;
    const lostValue = parseFloat(spoilWeight) * target.price_per_kg;
    await supabase.from('spoilage_returns').insert({ durian_type: spoilType, action_type: spoilAction, quantity: parseInt(spoilQty), weight_kg: parseFloat(spoilWeight), lost_value: lostValue });
    await supabase.from('durian_inventory').update({ total_durians: target.total_durians - parseInt(spoilQty), total_weight_kg: target.total_weight_kg - parseFloat(spoilWeight) }).eq('type', spoilType);
    if (spoilAction === 'return_supplier' && refundAmount) {
      await supabase.from('expenses').insert({ category: 'Supplier Refund', durian_type: spoilType, total_cost_rm: -Math.abs(parseFloat(refundAmount)), description: `Refund for ${spoilWeight}kg of ${spoilType}` });
    }
    showToast(`Action logged successfully!`);
    setSpoilQty(''); setSpoilWeight(''); setSpoilType(''); setRefundAmount('');
    fetchData();
    setActiveModal(null);
  };

  const handlePackStockIn = async () => {
    if (!packItem || !packQty || !packCost) return showToast("Please fill all fields including cost", "error");
    const target = packInventory.find(p => p.item_name === packItem);
    if (!target) return;
    await supabase.from('packaging_inventory').update({ quantity: target.quantity + parseInt(packQty) }).eq('item_name', packItem);
    await supabase.from('expenses').insert({ category: 'Packaging', total_cost_rm: parseFloat(packCost), description: `${packQty}x ${packItem}` });
    showToast(`Packaging stock & expense logged!`);
    setPackQty(''); setPackItem(''); setPackCost('');
    fetchData();
    setActiveModal(null);
  };

  const handleOpExpense = async () => {
    if (!opAmount) return showToast("Please enter amount", "error");
    let desc = opCategory;
    if (opCategory === 'Staff Salary') {
      if (!staffName) return showToast("Enter staff name", "error");
      desc = `Staff: ${staffName} (${staffRate})`;
    }
    await supabase.from('expenses').insert({ category: opCategory, total_cost_rm: parseFloat(opAmount), description: desc });
    showToast(`${opCategory} expense logged!`);
    setOpAmount(opCategory === 'Shop Rent' ? '1800' : ''); setStaffName('');
    fetchData();
    setActiveModal(null);
  };

  useEffect(() => {
    if (opCategory === 'Shop Rent') setOpAmount('1800');
    else setOpAmount('');
  }, [opCategory]);

  const saveDirectEdit = async (type: string) => {
    const data = editInventory[type];
    await supabase.from('durian_inventory').update({ total_durians: parseInt(data.total_durians), total_weight_kg: parseFloat(data.total_weight_kg), price_per_kg: parseFloat(data.price_per_kg) }).eq('type', type);
    showToast(`${type} updated!`);
    fetchData();
  };

  const savePackEdit = async (item_name: string) => {
    const data = editPackData[item_name];
    await supabase.from('packaging_inventory').update({ quantity: parseInt(data.quantity) }).eq('item_name', item_name);
    showToast(`${item_name} updated!`);
    fetchData();
  };

  const inputClass = "w-full border border-gray-300 p-3 rounded-xl text-black bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all shadow-inner font-semibold";

  const Modal = ({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) => (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 md:p-8 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-gray-100 p-6 border-b flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-black text-gray-900">{title}</h2>
          <button onClick={onClose} className="bg-gray-300 text-gray-800 px-6 py-2 rounded-xl font-bold hover:bg-gray-400 shadow-sm transition-colors">✕ Close</button>
        </div>
        <div className="p-6 overflow-y-auto bg-gray-50/50">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="pb-10 text-black bg-gray-50 min-h-screen relative">
      {toast.show && (
        <div className={`fixed top-10 left-1/2 transform -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-2xl text-white font-extrabold text-lg transition-all animate-bounce ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.type === 'error' ? '❌ ' : '✅ '} {toast.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Admin & Inventory Control</h1>
          <p className="text-gray-500 font-medium mt-1">Manage stock, track spoilage, and log business expenses</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <button onClick={() => setActiveModal('stockIn')} className="bg-blue-600 text-white p-10 rounded-3xl shadow-lg hover:bg-blue-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">📥</span>
          <div><h3 className="text-2xl font-black group-hover:underline">Durian Stock In</h3><p className="font-medium text-blue-200 mt-1">Add new batches & log supplier cost</p></div>
        </button>
        <button onClick={() => setActiveModal('spoilage')} className="bg-red-600 text-white p-10 rounded-3xl shadow-lg hover:bg-red-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">🗑️</span>
          <div><h3 className="text-2xl font-black group-hover:underline">Spoilage & Returns</h3><p className="font-medium text-red-200 mt-1">Log rotten durians & supplier refunds</p></div>
        </button>
        <button onClick={() => setActiveModal('expenses')} className="bg-purple-600 text-white p-10 rounded-3xl shadow-lg hover:bg-purple-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">💸</span>
          <div><h3 className="text-2xl font-black group-hover:underline">Log Expenses</h3><p className="font-medium text-purple-200 mt-1">Rent, Staff Salary, TNB & Petrol</p></div>
        </button>
        <button onClick={() => setActiveModal('packStock')} className="bg-orange-500 text-white p-10 rounded-3xl shadow-lg hover:bg-orange-600 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">🛍️</span>
          <div><h3 className="text-2xl font-black group-hover:underline">Packaging Restock</h3><p className="font-medium text-orange-200 mt-1">Add plastic bags & tupperware</p></div>
        </button>
        <button onClick={() => setActiveModal('manageDurian')} className="bg-green-600 text-white p-10 rounded-3xl shadow-lg hover:bg-green-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">✏️</span>
          <div><h3 className="text-2xl font-black group-hover:underline">Manage Durians</h3><p className="font-medium text-green-200 mt-1">Quickly edit current stock & prices</p></div>
        </button>
        <button onClick={() => setActiveModal('managePack')} className="bg-teal-600 text-white p-10 rounded-3xl shadow-lg hover:bg-teal-700 hover:scale-105 transition-all text-left flex flex-col justify-between h-48 group">
          <span className="text-4xl">📦</span>
          <div><h3 className="text-2xl font-black group-hover:underline">Manage Packaging</h3><p className="font-medium text-teal-200 mt-1">Override packaging inventory amounts</p></div>
        </button>
      </div>

      {/* --- MODALS --- */}
      {/* (Previous Modals remain unchanged...) */}

      {/* 5. MANAGE DURIAN MODAL */}
      {activeModal === 'manageDurian' && (
        <Modal title="✏️ Manage Durian Inventory" onClose={() => setActiveModal(null)}>
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-white border-b-2 border-gray-200">
                <th className="p-4 font-bold text-gray-600 sticky top-0 bg-white shadow-sm">Type</th><th className="p-4 font-bold text-gray-600 sticky top-0 bg-white shadow-sm">Qty (pcs)</th><th className="p-4 font-bold text-gray-600 sticky top-0 bg-white shadow-sm">Weight (kg)</th><th className="p-4 font-bold text-gray-600 sticky top-0 bg-white shadow-sm">Price/kg</th><th className="p-4 font-bold text-gray-600 sticky top-0 bg-white shadow-sm text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => (
                <tr key={item.type} className="border-b border-gray-200 hover:bg-gray-100 transition-colors bg-white">
                  <td className="p-4 font-extrabold text-gray-900 text-lg">{item.type}</td>
                  <td className="p-4">
                    <input name="total_durians" type="number" value={String(editInventory[item.type]?.total_durians || '')} onChange={e => { const val = e.target.value; setEditInventory(prev => ({ ...prev, [item.type]: { ...prev[item.type], total_durians: val } })); }} className="border-2 border-gray-300 p-2 rounded-lg w-20 text-black text-center font-bold" />
                  </td>
                  <td className="p-4">
                    <input name="total_weight_kg" type="number" step="0.1" value={String(editInventory[item.type]?.total_weight_kg || '')} onChange={e => { const val = e.target.value; setEditInventory(prev => ({ ...prev, [item.type]: { ...prev[item.type], total_weight_kg: val } })); }} className="border-2 border-gray-300 p-2 rounded-lg w-24 text-center font-bold" />
                  </td>
                  <td className="p-4">
                    <input name="price_per_kg" type="number" step="0.1" value={String(editInventory[item.type]?.price_per_kg || '')} onChange={e => { const val = e.target.value; setEditInventory(prev => ({ ...prev, [item.type]: { ...prev[item.type], price_per_kg: val } })); }} className="border-2 border-green-300 bg-green-50 p-2 rounded-lg w-24 text-black text-center font-bold text-green-800" />
                  </td>
                  <td className="p-4 text-center"><button onClick={() => saveDirectEdit(item.type)} className="bg-gray-800 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-black transition-colors shadow-sm active:scale-95">Save Update</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* 6. MANAGE PACKAGING MODAL */}
      {activeModal === 'managePack' && (
        <Modal title="📦 Manage Packaging Inventory" onClose={() => setActiveModal(null)}>
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-white border-b-2 border-gray-200">
                <th className="p-4 font-bold text-gray-600 sticky top-0 bg-white shadow-sm">Item Name</th><th className="p-4 font-bold text-gray-600 sticky top-0 bg-white shadow-sm">Current Qty</th><th className="p-4 font-bold text-gray-600 sticky top-0 bg-white shadow-sm text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {packInventory.map(item => (
                <tr key={item.item_name} className="border-b border-gray-200 hover:bg-gray-100 transition-colors bg-white">
                  <td className="p-4 font-extrabold text-gray-900 text-lg">{item.item_name}</td>
                  <td className="p-4">
                    <input name="quantity" type="number" value={String(editPackData[item.item_name]?.quantity || '')} onChange={e => { const val = e.target.value; setEditPackData(prev => ({ ...prev, [item.item_name]: { quantity: val } })); }} className="border-2 border-gray-300 p-3 rounded-xl w-32 text-black text-center font-black text-lg" />
                  </td>
                  <td className="p-4 text-center"><button onClick={() => savePackEdit(item.item_name)} className="bg-gray-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-colors shadow-sm active:scale-95 text-lg">Save Update</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}