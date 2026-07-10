// getDynamicChartOptions
const getDynamicChartOptions = (chartInfo, currentThemeColors) => {
  if (!chartInfo) return {}
  
  const isPieOrDoughnut = chartInfo.chartType === 'pie' || chartInfo.chartType === 'doughnut';
  
  if (isPieOrDoughnut) {
    const data = chartInfo.labels.map((label, i) => ({
      name: label,
      value: chartInfo.datasets[0].data[i]
    }))
    
    return {
      tooltip: { trigger: 'item' },
      legend: { top: 'bottom', type: 'scroll' },
      series: [
        {
          name: chartInfo.datasets[0].label,
          type: 'pie',
          radius: chartInfo.chartType === 'doughnut' ? ['40%', '70%'] : '70%',
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: { show: false, position: 'center' },
          emphasis: {
            label: { show: true, fontSize: 16, fontWeight: 'bold' },
          },
          labelLine: { show: false },
          data,
        }
      ]
    }
  } else {
    // Bar or Line
    const isLine = chartInfo.chartType === 'line'
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: isLine ? 'line' : 'shadow' } },
      legend: { top: 'bottom', type: 'scroll' },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: chartInfo.labels, boundaryGap: !isLine },
      yAxis: { type: 'value', splitLine: { show: false } },
      series: chartInfo.datasets.map((dataset, idx) => ({
        name: dataset.label,
        type: chartInfo.chartType,
        smooth: isLine,
        data: dataset.data,
        barWidth: chartInfo.chartType === 'bar' ? '50%' : undefined,
        itemStyle: chartInfo.chartType === 'bar' ? {
          borderRadius: [4, 4, 0, 0]
        } : undefined,
        areaStyle: isLine && idx === 0 ? {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: currentThemeColors.info },
              { offset: 1, color: 'rgba(255,255,255,0)' },
            ],
          }
        } : undefined
      }))
    }
  }
}
