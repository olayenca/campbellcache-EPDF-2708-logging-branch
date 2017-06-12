
function CacheMetricStrings () {
}

CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION = "value_calculation_cache";
CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_ALL_TIMER = "value_calculation_time";
CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_SUCCESS_TIMER = "value_calculation_success_latency";
CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_TIMER = "value_calculation_failure_latency";
CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_SUCCESS_COUNTER = "value_calculation_success";
CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_FAILURE_COUNTER = "value_calculation_failure";
CacheMetricStrings.CACHE_TYPE_VALUE_CALCULATION_REJECTION_COUNTER= "value_calculation_rejected_execution";
CacheMetricStrings.CACHE_TYPE_STALE_VALUE_CALCULATION = "stale_value_calculation_cache";
CacheMetricStrings.CACHE_TYPE_CACHE_DISABLED = "disabled_cache";
CacheMetricStrings.CACHE_TYPE_CACHE_DISABLED_REJECTION = "disabled_cache";

CacheMetricStrings.CACHE_TYPE_STALE_CACHE = "stale_distributed_cache";
CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE = "distributed_cache";
CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE_WRITES_COUNTER="distributed_cache_writes";
CacheMetricStrings.CACHE_TYPE_DISTRIBUTED_CACHE_REJECTION = "distributed_cache_rejection";
CacheMetricStrings.CACHE_TYPE_ALL = "cache";

module.exports = CacheMetricStrings;