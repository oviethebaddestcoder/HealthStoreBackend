export function calculateDeliveryFee(state) {
  if (!state) return 9000; // Default fee if no state provided
  
  const normalizedState = state.toLowerCase().trim();
  
  // Lagos delivery fee
  if (normalizedState === 'lagos') {
    return 10000;
  }
  
  // Nearby states (cheaper delivery) - 5000
  const nearbyStates = ['ogun', 'oyo', 'osun', 'ondo', 'ekiti', 'edo'];
  if (nearbyStates.includes(normalizedState)) {
    return 23000;
  }
  
  // Far states (more expensive delivery) - 6000
  return 27000;
}

export function calculateOrderTotals(items, state, discount = null) {
  const subtotal = items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  const deliveryFee = calculateDeliveryFee(state);
  
  let discountAmount = 0;
  if (discount && discount.percentage) {
    discountAmount = (subtotal * discount.percentage) / 100;
  }

  const total = subtotal + deliveryFee - discountAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee,
    discountAmount: Math.round(discountAmount * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

export function validateNigerianState(state) {
  const nigerianStates = [
    'abia', 'adamawa', 'akwa ibom', 'anambra', 'bauchi', 'bayelsa', 
    'benue', 'borno', 'cross river', 'delta', 'ebonyi', 'edo', 
    'ekiti', 'enugu', 'gombe', 'imo', 'jigawa', 'kaduna', 
    'kano', 'katsina', 'kebbi', 'kogi', 'kwara', 'lagos', 
    'nasarawa', 'niger', 'ogun', 'ondo', 'osun', 'oyo', 
    'plateau', 'rivers', 'sokoto', 'taraba', 'yobe', 'zamfara',
    'fct', 'abuja'
  ];
  
  return nigerianStates.includes(state.toLowerCase());
}

// Helper function to get delivery fee label
export function getDeliveryFeeLabel(state) {
  const fee = calculateDeliveryFee(state);
  const normalizedState = state?.toLowerCase().trim();
  
  if (normalizedState === 'lagos') {
    return `Lagos Delivery - ₦${fee.toLocaleString('en-NG')}`;
  } else if (['ogun', 'oyo', 'osun', 'ondo', 'ekiti', 'edo'].includes(normalizedState)) {
    return `Nearby States Delivery - ₦${fee.toLocaleString('en-NG')}`;
  } else {
    return `Standard Delivery - ₦${fee.toLocaleString('en-NG')}`;
  }
}