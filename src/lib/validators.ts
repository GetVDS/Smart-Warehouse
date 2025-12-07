// 验证手机号格式（俄罗斯）
export function validateRussianPhone(phone: string): { isValid: boolean; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, error: '手机号不能为空' };
  }
  
  // 移除所有非数字字符
  const cleanPhone = phone.replace(/\D/g, '');
  
  // 俄罗斯手机号验证（通常为11位，以7、8或9开头）
  if (!/^[7-9]\d{10}$/.test(cleanPhone)) {
    return { isValid: false, error: '请输入有效的俄罗斯手机号（11位数字）' };
  }
  
  return { isValid: true };
}

// 验证产品SKU
export function validateProductSKU(sku: string): { isValid: boolean; error?: string } {
  if (!sku || typeof sku !== 'string') {
    return { isValid: false, error: '产品款号不能为空' };
  }
  
  if (sku.length < 2 || sku.length > 50) {
    return { isValid: false, error: '产品款号长度应在2-50个字符之间' };
  }
  
  // 检查是否包含非法字符
  if (!/^[a-zA-Z0-9\-_\u4e00-\u9fa5]+$/.test(sku)) {
    return { isValid: false, error: '产品款号只能包含字母、数字、连字符、下划线和中文字符' };
  }
  
  return { isValid: true };
}

// 验证价格
export function validatePrice(price: any): { isValid: boolean; error?: string; normalizedPrice?: number } {
  const numPrice = parseFloat(price);
  
  if (isNaN(numPrice)) {
    return { isValid: false, error: '价格必须是有效数字' };
  }
  
  if (numPrice < 0) {
    return { isValid: false, error: '价格不能为负数' };
  }
  
  if (numPrice > 999999.99) {
    return { isValid: false, error: '价格超出允许范围' };
  }
  
  return { 
    isValid: true, 
    normalizedPrice: Math.round(numPrice * 100) / 100 // 保留两位小数
  };
}

// 验证数量
export function validateQuantity(quantity: any): { isValid: boolean; error?: string; normalizedQuantity?: number } {
  const numQuantity = parseInt(quantity);
  
  if (isNaN(numQuantity)) {
    return { isValid: false, error: '数量必须是整数' };
  }
  
  if (numQuantity <= 0) {
    return { isValid: false, error: '数量必须大于0' };
  }
  
  if (numQuantity > 9999) {
    return { isValid: false, error: '数量超出允许范围' };
  }
  
  return { isValid: true, normalizedQuantity: numQuantity };
}

// 验证客户名称
export function validateCustomerName(name: string): { isValid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: '客户姓名不能为空' };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return { isValid: false, error: '客户姓名长度应在2-100个字符之间' };
  }
  
  // 检查是否包含非法字符
  if (!/^[\u4e00-\u9fa5a-zA-Z\s\-']+$/.test(trimmedName)) {
    return { isValid: false, error: '客户姓名只能包含中文、英文字母、空格、连字符和撇号' };
  }
  
  return { isValid: true };
}

// 验证订单备注
export function validateOrderNote(note: string): { isValid: boolean; error?: string; normalizedNote?: string } {
  if (!note) {
    return { isValid: true, normalizedNote: '' };
  }
  
  if (typeof note !== 'string') {
    return { isValid: false, error: '备注必须是字符串' };
  }
  
  const trimmedNote = note.trim();
  
  if (trimmedNote.length > 500) {
    return { isValid: false, error: '备注长度不能超过500个字符' };
  }
  
  return { isValid: true, normalizedNote: trimmedNote };
}

// 验证订单项
export function validateOrderItems(items: any[]): { isValid: boolean; error?: string; normalizedItems?: any[] } {
  if (!Array.isArray(items)) {
    return { isValid: false, error: '订单项必须是数组' };
  }
  
  if (items.length === 0) {
    return { isValid: false, error: '至少需要一个订单项' };
  }
  
  if (items.length > 50) {
    return { isValid: false, error: '订单项数量不能超过50个' };
  }
  
  const normalizedItems: any[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // 验证产品ID
    if (!item.productId || typeof item.productId !== 'string') {
      return { isValid: false, error: `第${i + 1}个订单项缺少有效的产品ID` };
    }
    
    // 验证数量
    const quantityResult = validateQuantity(item.quantity);
    if (!quantityResult.isValid) {
      return { isValid: false, error: `第${i + 1}个订单项数量无效: ${quantityResult.error}` };
    }
    
    normalizedItems.push({
      productId: item.productId,
      quantity: quantityResult.normalizedQuantity
    });
  }
  
  return { isValid: true, normalizedItems };
}

// 验证邮箱格式
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: '邮箱不能为空' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: '邮箱格式无效' };
  }
  
  return { isValid: true };
}

// 验证URL格式
export function validateURL(url: string): { isValid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL不能为空' };
  }
  
  try {
    new URL(url);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'URL格式无效' };
  }
}

// 验证ID格式（UUID或ObjectId）
export function validateId(id: string): { isValid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { isValid: false, error: 'ID不能为空' };
  }
  
  // UUID格式验证
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return { isValid: true };
  }
  
  // MongoDB ObjectId格式验证（24位十六进制）
  const objectIdRegex = /^[0-9a-f]{24}$/i;
  if (objectIdRegex.test(id)) {
    return { isValid: true };
  }
  
  return { isValid: false, error: 'ID格式无效' };
}

// 验证日期格式
export function validateDate(date: string): { isValid: boolean; error?: string; normalizedDate?: Date } {
  if (!date || typeof date !== 'string') {
    return { isValid: false, error: '日期不能为空' };
  }
  
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return { isValid: false, error: '日期格式无效' };
  }
  
  return { 
    isValid: true, 
    normalizedDate: parsedDate 
  };
}

// 验证布尔值
export function validateBoolean(value: any): { isValid: boolean; error?: string; normalizedValue?: boolean } {
  if (typeof value === 'boolean') {
    return { isValid: true, normalizedValue: value };
  }
  
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1') {
      return { isValid: true, normalizedValue: true };
    }
    if (lowerValue === 'false' || lowerValue === '0') {
      return { isValid: true, normalizedValue: false };
    }
  }
  
  if (typeof value === 'number') {
    if (value === 1) {
      return { isValid: true, normalizedValue: true };
    }
    if (value === 0) {
      return { isValid: true, normalizedValue: false };
    }
  }
  
  return { isValid: false, error: '布尔值格式无效' };
}

// 验证字符串长度
export function validateStringLength(value: string, minLength: number = 0, maxLength: number = 1000): { isValid: boolean; error?: string; normalizedValue?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, error: '值必须是字符串' };
  }
  
  const trimmedValue = value.trim();
  
  if (trimmedValue.length < minLength) {
    return { isValid: false, error: `字符串长度不能少于${minLength}个字符` };
  }
  
  if (trimmedValue.length > maxLength) {
    return { isValid: false, error: `字符串长度不能超过${maxLength}个字符` };
  }
  
  return { isValid: true, normalizedValue: trimmedValue };
}

// 验证数字范围
export function validateNumberRange(value: any, min: number = Number.MIN_SAFE_INTEGER, max: number = Number.MAX_SAFE_INTEGER): { isValid: boolean; error?: string; normalizedValue?: number } {
  const numValue = parseFloat(value);
  
  if (isNaN(numValue)) {
    return { isValid: false, error: '值必须是有效数字' };
  }
  
  if (numValue < min) {
    return { isValid: false, error: `值不能小于${min}` };
  }
  
  if (numValue > max) {
    return { isValid: false, error: `值不能大于${max}` };
  }
  
  return { isValid: true, normalizedValue: numValue };
}

// 验证数组长度
export function validateArrayLength(array: any[], minLength: number = 0, maxLength: number = 100): { isValid: boolean; error?: string } {
  if (!Array.isArray(array)) {
    return { isValid: false, error: '值必须是数组' };
  }
  
  if (array.length < minLength) {
    return { isValid: false, error: `数组长度不能少于${minLength}` };
  }
  
  if (array.length > maxLength) {
    return { isValid: false, error: `数组长度不能超过${maxLength}` };
  }
  
  return { isValid: true };
}

// 验证枚举值
export function validateEnum(value: any, allowedValues: string[]): { isValid: boolean; error?: string; normalizedValue?: string } {
  if (!allowedValues.includes(value)) {
    return { 
      isValid: false, 
      error: `值必须是以下之一: ${allowedValues.join(', ')}` 
    };
  }
  
  return { isValid: true, normalizedValue: value };
}