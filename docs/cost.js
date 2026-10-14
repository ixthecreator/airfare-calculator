(function (root) {
  'use strict';
  function number(value) {
    const s = String(value ?? '').trim().replace(/[,，\s]/g, '');
    return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) && Number.isFinite(Number(s)) ? Number(s) : null;
  }
  function calculate(v) {
    const keys = ['miles', 'price', 'tax', 'cash', 'fx'];
    const n = Object.fromEntries(keys.map(k => [k, number(v[k])]));
    if (keys.some(k => n[k] === null)) return { error: '请填完整点数、买分价格、税费、现金价和汇率；金额不能为负数。' };
    if (n.miles <= 0 || !Number.isInteger(n.miles)) return { error: '兑换点数需要是大于 0 的整数。' };
    if (n.fx <= 0) return { error: '汇率需要大于 0（1 美元对应的人民币金额）。' };
    if (!['USD', 'CNY'].includes(v.taxCurrency) || !['USD', 'CNY'].includes(v.cashCurrency)) return { error: '请选择美元或人民币。' };
    if (!['cpp', 'cny'].includes(v.priceUnit)) return { error: '请选择买分价格单位。' };
    const cpp = v.priceUnit === 'cny' ? n.price / (10 * n.fx) : n.price;
    const pointCost = n.miles * cpp / 100;
    const tax = v.taxCurrency === 'CNY' ? n.tax / n.fx : n.tax;
    const cash = v.cashCurrency === 'CNY' ? n.cash / n.fx : n.cash;
    const total = pointCost + tax;
    const savings = cash - total;
    const redemptionCpp = (cash - tax) / n.miles * 100;
    const result = {
      cpp, cnyPerThousand: cpp * 10 * n.fx, pointCost, tax, cash, total, savings,
      ratio: total > 0 ? cash / total : null,
      savingsRate: cash > 0 ? savings / cash : null,
      redemptionCpp, valueRatio: cpp > 0 ? redemptionCpp / cpp : null,
      fx: n.fx, miles: n.miles
    };
    if (Object.values(result).some(x => x !== null && !Number.isFinite(x)) ||
        [total, savings, cash, pointCost, tax].some(x => !Number.isFinite(x * n.fx))) {
      return { error: '数值过大，请缩小输入。' };
    }
    return result;
  }
  root.airfareCost = { number, calculate };
})(globalThis);
