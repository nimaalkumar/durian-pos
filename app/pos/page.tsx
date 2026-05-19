'use client'
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function POSSystem() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [packInventory, setPackInventory] = useState<any[]>([]);
  
  // CART STATE
  const [selectedDurian, setSelectedDurian] = useState<any>(null);
  const [currentQty, setCurrentQty] = useState(1);
  const [currentWeight, setCurrentWeight] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  
  // CHECKOUT STATE
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [orderType, setOrderType] = useState('eat_here'); // Options: 'eat_here', 'pack', 'delivery'
  const [tableNumber, setTableNumber] = useState(''); // NEW: Table Number State
  const [deliveryFee, setDeliveryFee] = useState('');
  const [customPrice, setCustomPrice] = useState(''); 
  const [bagsUsed, setBagsUsed] = useState(0);
  const [tupMUsed, setTupMUsed] = useState(0);
  const [tupLUsed, setTupLUsed] = useState(0);

  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'error'|'success'}>({show: false, msg: '', type: 'success'});
  const showToast = (msg: string, type: 'error'|'success' = 'success') => {
    setToast({show: true, msg, type});
    setTimeout(() => setToast({show: false, msg: '', type: 'success'}), 4000);
  };

  useEffect(() => {
    async function fetchData() {
      const { data: durians } = await supabase.from('durian_inventory').select('*');
      if (durians) setInventory(durians);
      const { data: packaging } = await supabase.from('packaging_inventory').select('*');
      if (packaging) setPackInventory(packaging);
    }
    fetchData();
  }, []);

  // --- CART FUNCTIONS ---
  const addToCart = () => {
    if (!selectedDurian || !currentWeight) return showToast("Enter a weight to add!", "error");
    
    const itemPrice = parseFloat(currentWeight) * selectedDurian.price_per_kg;
    const newItem = {
      type: selectedDurian.type,
      qty: currentQty,
      weight: parseFloat(currentWeight),
      price_per_kg: selectedDurian.price_per_kg,
      total_price: itemPrice
    };

    setCart([...cart, newItem]);
    setSelectedDurian(null);
    setCurrentWeight('');
    setCurrentQty(1);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // --- CALCULATIONS ---
  const basePrice = cart.reduce((sum, item) => sum + item.total_price, 0);
  const finalDurianPrice = customPrice !== '' ? parseFloat(customPrice) : basePrice;
  const finalDeliveryFee = orderType === 'delivery' ? parseFloat(deliveryFee || '0') : 0;
  const grandTotal = finalDurianPrice + finalDeliveryFee;

  const handleCheckout = async () => {
    if (cart.length === 0) return showToast("Cart is empty!", "error");
    
    // SAFETY CHECK: Ensure Table Number is entered if eating in
    if (orderType === 'eat_here' && !tableNumber.trim()) {
      return showToast("Please enter a Table Number!", "error");
    }

    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalWeight = cart.reduce((sum, item) => sum + item.weight, 0);
    const durianTypeLabel = cart.length === 1 ? cart[0].type : `Mixed Order (${cart.length} items)`;

    // 1. Insert Sales Record (Includes cart items & table number)
    const { error } = await supabase.from('sales').insert({
      durian_type: durianTypeLabel, 
      quantity: totalQty, 
      weight_kg: totalWeight, 
      total_price: grandTotal, 
      payment_method: paymentMethod, 
      order_type: orderType, 
      delivery_fee: finalDeliveryFee,
      cart_items: cart,
      table_number: orderType === 'eat_here' ? tableNumber.trim() : null // Saves Table Number
    });

    if (error) return showToast("Error processing sale! " + error.message, "error");

    // 2. Deduct Durian Inventory
    for (const item of cart) {
      const dbItem = inventory.find(i => i.type === item.type);
      if (dbItem) {
        const newQty = dbItem.total_durians - item.qty;
        const newWeight = dbItem.total_weight_kg - item.weight;
        await supabase.from('durian_inventory').update({ total_durians: newQty, total_weight_kg: newWeight }).eq('type', item.type);
        if (newWeight <= 2 || newQty <= 2) showToast(`⚠️ LOW STOCK: ${item.type} is running out!`, "error");
      }
    }

    // 3. Deduct Packaging
    const deductPack = async (name: string, usedQty: number) => {
      if (usedQty > 0) {
        const item = packInventory.find(p => p.item_name === name);
        if (item) await supabase.from('packaging_inventory').update({ quantity: item.quantity - usedQty }).eq('item_name', name);
      }
    };
    await deductPack('Plastic Bag', bagsUsed);
    await deductPack('Tupperware M', tupMUsed);
    await deductPack('Tupperware L', tupLUsed);

    showToast(`✅ Payment Successful! Total: RM ${grandTotal.toFixed(2)}`);
    setTimeout(() => { window.location.reload(); }, 2000); 
  };

  const inputClass = "w-full border-2 border-gray-300 p-3 rounded-xl text-black bg-white focus:ring-2 focus:ring-green-500 outline-none font-bold text-lg transition-all";

  return (
    <div className="pb-10 text-black relative">
      
      {toast.show && (
        <div className={`fixed top-10 left-1/2 transform -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-2xl text-white font-extrabold text-lg transition-all animate-bounce ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.type === 'error' ? '❌ ' : '✅ '} {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-4">
        
        {/* LEFT SIDE: SELECT DURIAN */}
        <div className="md:col-span-6 bg-white p-6 shadow-lg rounded-3xl border border-gray-200 flex flex-col">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4 shrink-0">1. Select Durians</h2>
          <div className="grid gap-3 overflow-y-auto max-h-[750px] pr-2">
            {inventory.map((item) => (
              <button key={item.type} onClick={() => setSelectedDurian(item)} className={`p-5 border-2 rounded-2xl text-left transition-all duration-200 shadow-sm
                  ${selectedDurian?.type === item.type ? 'bg-green-50 border-green-600 ring-4 ring-green-200 text-black transform scale-[1.02]' : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-green-300 text-black'}`}>
                <div className="font-black text-xl text-gray-900">{item.type}</div>
                <div className="text-md text-gray-600 mt-2">
                  <span className="font-extrabold text-green-700 bg-green-100 px-2 py-1 rounded-md">RM {item.price_per_kg}/kg</span> 
                  <span className="mx-2">|</span> 
                  Stock: <span className="font-bold">{Number(item.total_weight_kg).toFixed(2)}kg</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE: CART & CHECKOUT */}
        <div className="md:col-span-6 bg-white p-6 shadow-lg rounded-3xl border border-gray-200 flex flex-col">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-4">2. Manage Order</h2>
          
          <div className="flex-1 overflow-y-auto pr-2">
            
            {/* ADD TO CART WIDGET */}
            <div className={`p-5 rounded-2xl mb-6 border-2 transition-all shadow-sm ${selectedDurian ? 'border-green-400 bg-green-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
              {!selectedDurian ? (
                  <div className="text-center text-gray-400 font-bold py-4">👈 Select a durian from the left to add</div>
              ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-black text-green-900 text-xl">{selectedDurian.type}</span>
                        <span className="font-bold text-green-700 bg-green-200/50 px-3 py-1 rounded-lg">RM {selectedDurian.price_per_kg}/kg</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Qty (pcs)</label>
                        <input type="number" value={currentQty} onChange={e=>setCurrentQty(parseInt(e.target.value)||1)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Weight (kg)</label>
                        <input type="number" step="0.1" value={currentWeight} onChange={e=>setCurrentWeight(e.target.value)} className={inputClass} placeholder="e.g. 1.5" />
                      </div>
                    </div>
                    <button onClick={addToCart} className="w-full bg-green-600 text-white font-extrabold py-3.5 rounded-xl hover:bg-green-700 shadow-md active:scale-95 transition-all text-lg">➕ Add to Order</button>
                  </>
              )}
            </div>

            {/* CART ITEMS LIST */}
            <div className="mb-6">
                <h3 className="font-extrabold text-gray-800 mb-3 flex items-center justify-between">
                  <span>🛒 Items in Cart</span>
                  <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">{cart.length} items</span>
                </h3>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                    {cart.length === 0 && <p className="text-sm text-gray-400 font-bold text-center py-4 bg-gray-50 rounded-xl border border-gray-100">Cart is empty.</p>}
                    {cart.map((item, index) => (
                        <div key={index} className="flex justify-between items-center bg-gray-50 border border-gray-200 p-4 rounded-xl shadow-sm">
                            <div>
                              <p className="font-black text-gray-900 text-lg">{item.type}</p>
                              <p className="text-sm text-gray-500 font-medium mt-0.5">{item.weight}kg ({item.qty}pcs) @ RM{item.price_per_kg}/kg</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-black text-green-700 text-lg">RM {item.total_price.toFixed(2)}</span>
                              <button onClick={()=>removeFromCart(index)} className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-lg font-black transition-colors">✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* NEW 3-BUTTON CHECKOUT CONFIG */}
            <div className="flex gap-2 mb-6 bg-gray-100 p-2 rounded-xl">
              <button onClick={() => setOrderType('eat_here')} className={`flex-1 py-3 rounded-lg font-bold border-2 transition-all ${orderType === 'eat_here' ? 'bg-white text-green-700 border-green-500 shadow-sm' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>🍽️ Eat Here</button>
              <button onClick={() => setOrderType('pack')} className={`flex-1 py-3 rounded-lg font-bold border-2 transition-all ${orderType === 'pack' ? 'bg-white text-orange-700 border-orange-500 shadow-sm' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>🛍️ Pack</button>
              <button onClick={() => setOrderType('delivery')} className={`flex-1 py-3 rounded-lg font-bold border-2 transition-all ${orderType === 'delivery' ? 'bg-white text-blue-700 border-blue-500 shadow-sm' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>🛵 Delivery</button>
            </div>

            {/* CONDITIONAL INPUTS: Table Number OR Delivery Fee */}
            {orderType === 'eat_here' && (
              <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-xl flex items-center justify-between shadow-inner">
                <label className="font-extrabold text-green-900">Table Number:</label>
                <input type="text" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="w-28 border-2 border-green-400 p-2 rounded-lg text-black bg-white focus:ring-2 focus:ring-green-600 outline-none text-center font-black text-lg" placeholder="e.g. 5" />
              </div>
            )}

            {orderType === 'delivery' && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between shadow-inner">
                <label className="font-extrabold text-blue-900">Delivery Charge (RM):</label>
                <input type="number" step="0.1" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className="w-28 border-2 border-blue-300 p-2 rounded-lg text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right font-black text-lg" placeholder="0.00" />
              </div>
            )}

            <h3 className="font-bold text-gray-800 mt-6 mb-3 border-t pt-6">🛍️ Packaging Used</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Bags</label><input type="number" min="0" value={bagsUsed} onChange={(e) => setBagsUsed(parseInt(e.target.value) || 0)} className="w-full border-2 border-gray-200 p-3 rounded-xl text-center font-bold" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Tup M</label><input type="number" min="0" value={tupMUsed} onChange={(e) => setTupMUsed(parseInt(e.target.value) || 0)} className="w-full border-2 border-gray-200 p-3 rounded-xl text-center font-bold" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Tup L</label><input type="number" min="0" value={tupLUsed} onChange={(e) => setTupLUsed(parseInt(e.target.value) || 0)} className="w-full border-2 border-gray-200 p-3 rounded-xl text-center font-bold" /></div>
            </div>

            <div className="mb-2 border-t pt-6">
              <label className="block mb-2 font-bold text-gray-700">Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                <option value="cash">💵 Cash</option>
                <option value="qr">📱 QR DuitNow</option>
              </select>
            </div>
          </div>

          {/* STICKY TOTALS */}
          <div className="mt-4 pt-6 border-t border-gray-200">
            {cart.length > 0 ? (
              <div className="bg-green-50 p-6 rounded-2xl mb-6 border-2 border-green-200 shadow-sm">
                <div className="flex justify-between items-center text-gray-600 mb-3"><span className="font-bold">Calculated Subtotal:</span><span className={customPrice !== '' ? 'line-through' : 'font-extrabold text-black'}>RM {basePrice.toFixed(2)}</span></div>
                <div className="flex justify-between items-center mb-3 pb-3 border-b border-green-200/50"><span className="font-bold text-green-800">Override Total (RM):</span><input type="number" step="0.1" placeholder="Optional" value={customPrice} onChange={e=>setCustomPrice(e.target.value)} className="w-28 border-2 border-green-400 p-2 rounded-lg text-black text-right font-black focus:ring-2 focus:ring-green-600 outline-none" /></div>
                {orderType === 'delivery' && ( <div className="flex justify-between items-center text-blue-700 font-bold mb-3"><span>Delivery Fee:</span><span>+ RM {finalDeliveryFee.toFixed(2)}</span></div> )}
                <div className="flex justify-between items-end mt-4 pt-2"><span className="text-xl font-extrabold text-green-900">Grand Total:</span><span className="text-5xl font-black text-green-800 tracking-tighter">RM {grandTotal.toFixed(2)}</span></div>
              </div>
            ) : (
               <div className="bg-gray-50 p-8 rounded-2xl mb-6 text-center border-2 border-gray-200 border-dashed"><p className="text-gray-400 font-bold text-lg">Add items to cart to see total</p></div>
            )}
            
            <button onClick={handleCheckout} disabled={cart.length === 0} className={`w-full font-black py-5 rounded-2xl text-2xl transition-all shadow-lg uppercase tracking-wide ${(cart.length === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-xl active:scale-[0.98]'}`}>
              Confirm & Pay
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}