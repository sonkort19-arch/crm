(function (global) {
  const PERCENT_TOTAL_TARGET = 100;
  const PERCENT_TOTAL_EPSILON = 1e-6;

  function sumPercents(items) {
    if (!items || typeof items !== 'object') return 0;
    return Object.values(items).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }

  function isPercentTotalValid(total) {
    return Math.abs(total - PERCENT_TOTAL_TARGET) <= PERCENT_TOTAL_EPSILON;
  }

  function wouldExceed100(currentTotal, addition) {
    return currentTotal + addition > PERCENT_TOTAL_TARGET + PERCENT_TOTAL_EPSILON;
  }

  function calcService(sum, config) {
    const result = {};
    for (const [name, percent] of Object.entries(config.items)) {
      result[name] = +(sum * percent / 100).toFixed(2);
    }
    return result;
  }

  global.PercentLogic = {
    PERCENT_TOTAL_TARGET,
    PERCENT_TOTAL_EPSILON,
    sumPercents,
    isPercentTotalValid,
    wouldExceed100,
    calcService,
  };
})(typeof window !== 'undefined' ? window : globalThis);
